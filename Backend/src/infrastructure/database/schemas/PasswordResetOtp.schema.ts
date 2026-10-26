import mongoose, { Document, Schema } from 'mongoose';

export interface IPasswordResetOtpDocument extends Document {
  email: string;
  otpHash: string;
  expiresAt: Date;
}

const PasswordResetOtpSchema = new Schema<IPasswordResetOtpDocument>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});

export const PasswordResetOtpModel = mongoose.model<IPasswordResetOtpDocument>(
  'PasswordResetOtp',
  PasswordResetOtpSchema
);
