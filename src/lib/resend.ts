import { Resend } from 'resend';

// Lazily-initialized — no module-level `new Resend()` so build doesn't fail
// when RESEND_API_KEY is not present in the build environment.
export async function sendOtpEmail(email: string, code: string) {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { error } = await resend.emails.send({
        from: 'OBBO iManage <noreply@obbo.com>',
        to: [email],
        subject: `Your OBBO verification code: ${code}`,
        html: `
            <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f8fafc; border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">OBBO iManage</h1>
                </div>
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 28px 24px; text-align: center; margin-bottom: 24px;">
                    <p style="margin: 0 0 16px; font-size: 15px; color: #475569;">Your email verification code is:</p>
                    <div style="display: inline-block; background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 10px; padding: 16px 32px; margin-bottom: 16px;">
                        <span style="font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #1e3a5f; font-family: monospace;">${code}</span>
                    </div>
                    <p style="margin: 0; font-size: 13px; color: #94a3b8;">This code expires in <strong>10 minutes</strong>.</p>
                </div>
                <p style="margin: 0; font-size: 13px; color: #94a3b8; text-align: center;">
                    If you did not request this code, please ignore this email.
                </p>
            </div>
        `,
    });

    if (error) throw new Error(error.message);
}
