import twilio from 'twilio';
import { env } from '../config/env';

export const sendSms = async (to: string, message: string): Promise<void> => {
  const client = twilio(env.TWILIO_SID, env.TWILIO_AUTH_TOKEN);

  await client.messages.create({
    body: message,
    from: env.TWILIO_PHONE,
    to,
  });
};

export class SmsService {
  public static async sendSms(to: string, message: string): Promise<void> {
    return sendSms(to, message);
  }
}
