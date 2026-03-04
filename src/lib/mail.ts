import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendVerificationCode(email: string, code: string) {
  await transporter.sendMail({
    from: `"Nexapse" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "[Nexapse] 이메일 인증번호",
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:'Segoe UI',sans-serif;background:#f8f9fa;padding:40px 20px;">
        <div style="background:white;border-radius:16px;padding:40px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <div style="font-size:48px;margin-bottom:8px;">&#x1f9e0;</div>
          <h1 style="color:#6366f1;font-size:24px;margin:0 0 8px;">Nexapse</h1>
          <p style="color:#6b7280;font-size:14px;margin:0 0 32px;">이메일 인증번호를 확인해주세요</p>
          <div style="background:#f1f5f9;border-radius:12px;padding:24px;margin-bottom:24px;">
            <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1e293b;">${code}</span>
          </div>
          <p style="color:#9ca3af;font-size:13px;margin:0;">이 인증번호는 <strong>5분</strong> 후 만료됩니다.</p>
        </div>
      </div>
    `,
  });
}
