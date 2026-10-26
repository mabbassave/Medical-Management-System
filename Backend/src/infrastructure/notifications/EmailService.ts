import nodemailer from 'nodemailer';
import { env } from '../config/env';

export const sendEmail = async (to: string, subject: string, message: string): Promise<void> => {
  const transporter = nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_PORT === 465,
    auth: {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: env.EMAIL_USER || 'no-reply@medical-management.com',
    to,
    subject,
    text: message,
    html: `<p>${message.replace(/\n/g, '<br/>')}</p>`,
  });
};

export class EmailService {
  public static async sendEmail(to: string, subject: string, message: string): Promise<void> {
    return sendEmail(to, subject, message);
  }
}
