import mongoose, { Document } from 'mongoose';

export interface IUserDocument extends Document {
  username: string;
  fullName?: string;
  email: string;
  phoneNumber?: string;
  phone?: string;
  password?: string;
  role: 'admin' | 'doctor' | 'nurse' | 'patient';
  linkedId?: string;
  authProvider: 'password' | 'google' | 'apple';
  providerSubject?: string;
  googleSubject?: string;
  status: 'active' | 'pending' | 'suspended';
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  faceEnrollmentStatus: 'unavailable' | 'not_enrolled' | 'enrolling' | 'enrolled';
  faceProviderFaceId?: string;
  faceTemplateEncrypted?: Buffer;
  faceEnrollmentStartedAt?: Date;
  faceEnrolledAt?: Date;
  faceConsentAt?: Date;
  doctorVerificationStatus?: 'verified' | 'not_applicable';
  specialty?: string;
  licenseNumber?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 80,
    },
    fullName: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended'],
      default: 'active',
      required: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      required: function (this: IUserDocument) {
        return this.authProvider === 'password';
      },
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'doctor', 'nurse', 'patient'],
      default: 'patient',
    },
    linkedId: {
      type: String,
      required: false,
    },
    authProvider: {
      type: String,
      enum: ['password', 'google', 'apple'],
      default: 'password',
      required: true,
    },
    providerSubject: {
      type: String,
      trim: true,
      required: false,
    },
    googleSubject: {
      type: String,
      trim: true,
      required: false,
    },
    faceEnrollmentStatus: {
      type: String,
      enum: ['unavailable', 'not_enrolled', 'enrolling', 'enrolled'],
      default: 'not_enrolled',
      required: true,
    },
    faceProviderFaceId: {
      type: String,
      select: false,
    },
    faceTemplateEncrypted: {
      type: Buffer,
      select: false,
    },
    faceEnrollmentStartedAt: {
      type: Date,
      select: false,
    },
    faceEnrolledAt: {
      type: Date,
    },
    faceConsentAt: {
      type: Date,
    },
    doctorVerificationStatus: {
      type: String,
      enum: ['verified', 'not_applicable'],
      default: 'not_applicable',
    },
    specialty: {
      type: String,
      trim: true,
      required: false,
    },
    licenseNumber: {
      type: String,
      trim: true,
      required: false,
    },
    lastLoginAt: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true }
);


userSchema.index(
  { authProvider: 1, providerSubject: 1 },
  {
    unique: true,
    partialFilterExpression: { providerSubject: { $type: 'string' } },
  }
);
userSchema.index(
  { googleSubject: 1 },
  {
    unique: true,
    sparse: true,
  }
);

export const UserModel = mongoose.model<IUserDocument>('User', userSchema);
export { userSchema };
