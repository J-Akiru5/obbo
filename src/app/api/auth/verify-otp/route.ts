import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
    try {
        const { email, code } = await req.json();

        if (!email || !code) {
            return NextResponse.json({ valid: false, error: 'Email and code are required.' }, { status: 400 });
        }

        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from('email_verifications')
            .select('id, expires_at, used')
            .eq('email', email.toLowerCase())
            .eq('code', code.trim())
            .single();

        if (error || !data) {
            return NextResponse.json({ valid: false, error: 'Invalid verification code.' });
        }

        if (data.used) {
            return NextResponse.json({ valid: false, error: 'This code has already been used.' });
        }

        if (new Date(data.expires_at) < new Date()) {
            return NextResponse.json({ valid: false, error: 'This code has expired. Please request a new one.' });
        }

        // Mark as used
        await supabase
            .from('email_verifications')
            .update({ used: true })
            .eq('id', data.id);

        return NextResponse.json({ valid: true });
    } catch (err) {
        console.error('[verify-otp]', err);
        return NextResponse.json({ valid: false, error: 'Verification failed.' }, { status: 500 });
    }
}
