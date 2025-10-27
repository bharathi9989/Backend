import nodemailer from "nodemailer";

/**
 * @desc Create and configure a Nodemailer transporter
 */

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * @desc Send email
 * @param {String} to - recipient email
 * @param {String} subject - email subject
 * @param {String} html - email content in HTML
 */

export const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `Auction Platform <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`Mail sent to ${to}:${info.messageId}`);
  } catch (err) {
    console.log(`❌Error sending email`);
  }
};
