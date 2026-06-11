interface AuthEmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const emailShell = (
  title: string,
  description: string,
  actionLabel: string,
  actionUrl: string,
) => ({
  html: `
    <!doctype html>
    <html lang="vi">
      <body style="margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#1f1f1f">
        <div style="max-width:560px;margin:0 auto;padding:32px 16px">
          <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:16px;padding:32px">
            <p style="margin:0 0 24px;color:#6750a4;font-size:20px;font-weight:700">CHATCHOI</p>
            <h1 style="margin:0 0 16px;font-size:24px">${title}</h1>
            <p style="margin:0 0 24px;line-height:1.6;color:#4d4d4d">${description}</p>
            <a href="${actionUrl}" style="display:inline-block;border-radius:10px;background:#6750a4;color:#ffffff;padding:13px 20px;text-decoration:none;font-weight:700">${actionLabel}</a>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#737373">Nếu nút không hoạt động, hãy mở liên kết sau:<br><a href="${actionUrl}" style="color:#6750a4;word-break:break-all">${actionUrl}</a></p>
          </div>
        </div>
      </body>
    </html>
  `.trim(),
  text: `${title}\n\n${description}\n\n${actionLabel}: ${actionUrl}`,
});

export const buildEmailVerificationEmail = (
  verificationUrl: string,
): AuthEmailTemplate => ({
  subject: 'Xác minh email CHATCHOI',
  ...emailShell(
    'Xác minh địa chỉ email',
    'Hoàn tất xác minh để có thể khôi phục tài khoản khi cần. Liên kết này có hiệu lực trong 24 giờ.',
    'Xác minh email',
    verificationUrl,
  ),
});

export const buildPasswordResetEmail = (
  resetUrl: string,
): AuthEmailTemplate => ({
  subject: 'Đặt lại mật khẩu CHATCHOI',
  ...emailShell(
    'Đặt lại mật khẩu',
    'Chúng tôi nhận được yêu cầu đặt lại mật khẩu. Liên kết này chỉ dùng được một lần và có hiệu lực trong 15 phút.',
    'Đặt lại mật khẩu',
    resetUrl,
  ),
});

export const buildPasswordChangedEmail = (): AuthEmailTemplate => ({
  subject: 'Mật khẩu CHATCHOI đã được thay đổi',
  html: `
    <!doctype html>
    <html lang="vi">
      <body style="margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#1f1f1f">
        <div style="max-width:560px;margin:0 auto;padding:32px 16px">
          <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:16px;padding:32px">
            <p style="margin:0 0 24px;color:#6750a4;font-size:20px;font-weight:700">CHATCHOI</p>
            <h1 style="margin:0 0 16px;font-size:24px">Mật khẩu đã được thay đổi</h1>
            <p style="margin:0;line-height:1.6;color:#4d4d4d">Tất cả phiên đăng nhập cũ đã bị thu hồi. Nếu bạn không thực hiện thay đổi này, hãy liên hệ quản trị viên ngay.</p>
          </div>
        </div>
      </body>
    </html>
  `.trim(),
  text: 'Mật khẩu CHATCHOI đã được thay đổi. Tất cả phiên đăng nhập cũ đã bị thu hồi. Nếu bạn không thực hiện thay đổi này, hãy liên hệ quản trị viên ngay.',
});
