import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendMail = async (to, subject, html) => {
  if (!process.env.SMTP_USER) {
    console.warn("SMTP not configured - skipping mail:", subject);
    return;
  }
  const info = await transporter.sendMail({
    from: `"Auction Platform" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
  console.log(`✉️ Mail sent to ${to}: ${info.messageId}`);
  return info;
};
