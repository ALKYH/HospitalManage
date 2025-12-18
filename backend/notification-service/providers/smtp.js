const nodemailer = require('nodemailer');

// 使用环境变量配置 SMTP
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.example.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
  });
  return transporter;
}

async function send({ to, subject, text, html }) {
  const t = getTransporter();
  if (!to) throw new Error('No recipient');
  const mail = { from: process.env.SMTP_FROM || SMTP_USER || 'no-reply@example.com', to, subject, text, html };
  const info = await t.sendMail(mail);
  return info;
}

module.exports = { send };
