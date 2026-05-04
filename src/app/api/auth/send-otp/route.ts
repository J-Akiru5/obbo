import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOtpEmail } from '@/lib/resend';

function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();

        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
        }

        const supabase = createAdminClient();

        const { data: rejectedProfile } = await supabase
            .from('profiles')
            .select('id, kyc_status')
            .eq('email', email.toLowerCase())
            .eq('kyc_status', 'rejected')
            .maybeSingle();

        if (rejectedProfile) {
            return NextResponse.json({ error: 'This email has been permanently blocked from re-registration.' }, { status: 403 });
        }

        // Rate-limit: block if a non-expired code was issued < 60s ago
        const { data: recent } = await supabase
            .from('email_verifications')
            .select('created_at')
            .eq('email', email.toLowerCase())
            .eq('used', false)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (recent) {
            const ageSeconds = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
            if (ageSeconds < 60) {
                return NextResponse.json(
                    { error: `Please wait ${Math.ceil(60 - ageSeconds)} seconds before requesting a new code.` },
                    { status: 429 }
                );
            }
        }

        // Invalidate any existing unused codes for this email
        await supabase
            .from('email_verifications')
            .update({ used: true })
            .eq('email', email.toLowerCase())
            .eq('used', false);

        // Generate new OTP
        const code = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

        const { error: insertError } = await supabase
            .from('email_verifications')
            .insert({ email: email.toLowerCase(), code, expires_at: expiresAt });

        if (insertError) throw insertError;

        // Send via Resend
        await sendOtpEmail(email, code);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[send-otp]', err);
        return NextResponse.json({ error: 'Failed to send verification code.' }, { status: 500 });
    }
}
