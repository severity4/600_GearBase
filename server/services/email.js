/**
 * Email Service - Replaces GAS MailApp
 * Uses nodemailer for sending emails
 */
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_NAME = process.env.EMAIL_FROM_NAME || '映奧創意工作室';
const FROM_EMAIL = process.env.SMTP_USER || 'noreply@example.com';

async function sendEmail({ to, subject, body }) {
  if (!process.env.SMTP_USER) {
    console.log(`[Email] Skipped (no SMTP config): ${subject} -> ${to}`);
    return { success: true, message: '郵件功能尚未設定 SMTP' };
  }

  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      text: body,
    });
    return { success: true, message: `已寄送至 ${to}` };
  } catch (e) {
    console.error('[Email] Error:', e.message);
    return { success: false, message: '寄信失敗: ' + e.message };
  }
}

module.exports = { sendEmail };
