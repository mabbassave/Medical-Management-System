import { randomUUID } from 'crypto';
import { AppError } from '../../domain/errors/AppError';
import { IUserDocument } from './schemas/User.schema';
import { DoctorModel } from './schemas/Doctor.schema';
import { PatientModel } from './schemas/Patient.schema';

const nameParts = (fullName?: string) => {
  const [firstName, ...remainingName] = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  return {
    ...(firstName ? { firstName } : {}),
    ...(remainingName.length ? { lastName: remainingName.join(' ') } : {}),
  };
};

const profileFields = (user: IUserDocument) => ({
  ...nameParts(user.fullName),
  email: user.email.trim().toLowerCase(),
  userId: user._id,
});

export const ensureUserProfile = async (user: IUserDocument): Promise<string | undefined> => {
  const userId = user._id.toString();
  let linkedId: string | undefined;

  if (user.role === 'patient') {
    let profile =
      (await PatientModel.findOne({ userId: user._id })) ??
      (user.linkedId ? await PatientModel.findOne({ patientId: user.linkedId }) : null) ??
      (await PatientModel.findOne({ email: user.email.trim().toLowerCase() }));

    if (profile?.userId && profile.userId.toString() !== userId) {
      throw new AppError(409, 'Patient profile is linked to another account');
    }
    if (profile && profile.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      if (profile.userId?.toString() !== userId) {
        throw new AppError(409, 'Patient profile email does not match the account');
      }
      profile.email = user.email.trim().toLowerCase();
    }

    if (profile) {
      profile.userId = user._id;
      const name = nameParts(user.fullName);
      if (!profile.firstName && name.firstName) profile.firstName = name.firstName;
      if (!profile.lastName && name.lastName) profile.lastName = name.lastName;
      if (!profile.phone && (user.phoneNumber || user.phone)) {
        profile.phone = user.phoneNumber || user.phone;
      }
      await profile.save();
    } else {
      profile = await PatientModel.create({
        patientId: randomUUID(),
        ...profileFields(user),
        ...((user.phoneNumber || user.phone) ? { phone: user.phoneNumber || user.phone } : {}),
      });
    }

    linkedId = profile.patientId;
  } else if (user.role === 'doctor') {
    let profile =
      (await DoctorModel.findOne({ userId: user._id })) ??
      (user.linkedId ? await DoctorModel.findOne({ doctorId: user.linkedId }) : null) ??
      (await DoctorModel.findOne({ email: user.email.trim().toLowerCase() }));

    if (profile?.userId && profile.userId.toString() !== userId) {
      throw new AppError(409, 'Doctor profile is linked to another account');
    }
    if (profile && profile.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      if (profile.userId?.toString() !== userId) {
        throw new AppError(409, 'Doctor profile email does not match the account');
      }
      profile.email = user.email.trim().toLowerCase();
    }

    if (profile) {
      profile.userId = user._id;
      const name = nameParts(user.fullName);
      if (!profile.firstName && name.firstName) profile.firstName = name.firstName;
      if (!profile.lastName && name.lastName) profile.lastName = name.lastName;
      if (!profile.phone && (user.phoneNumber || user.phone)) {
        profile.phone = user.phoneNumber || user.phone;
      }
      if (!profile.specialization && user.specialty) profile.specialization = user.specialty;
      if (!profile.licenseNumber && user.licenseNumber) profile.licenseNumber = user.licenseNumber;
      await profile.save();
    } else {
      profile = await DoctorModel.create({
        doctorId: randomUUID(),
        ...profileFields(user),
        ...((user.phoneNumber || user.phone) ? { phone: user.phoneNumber || user.phone } : {}),
        ...(user.specialty ? { specialization: user.specialty } : {}),
        ...(user.licenseNumber ? { licenseNumber: user.licenseNumber } : {}),
      });
    }

    linkedId = profile.doctorId;
  } else {
    return undefined;
  }

  if (user.linkedId !== linkedId) {
    user.linkedId = linkedId;
    await user.save();
  }

  return linkedId;
};
