import { IDoctorRepository } from '../../../domain/doctor/IDoctorRepository';
import { Doctor } from '../../../domain/doctor/Doctor.entity';
import { DoctorId } from '../../../domain/doctor/DoctorId';
import { Email } from '../../../domain/patient/Email';
import { DoctorModel, IDoctorDocument } from '../schemas/Doctor.schema';

export class DoctorRepository implements IDoctorRepository {
  public async save(doctor: Doctor): Promise<void> {
    await DoctorModel.findOneAndUpdate(
      { doctorId: doctor.doctorId.getValue() },
      {
        doctorId: doctor.doctorId.getValue(),
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        email: doctor.email.getValue(),
        phone: doctor.phone,
        specialization: doctor.specialization,
      },
      { upsert: true, new: true }
    );
  }

  public async findById(doctorId: DoctorId): Promise<Doctor | null> {
    const doc = await DoctorModel.findOne({ doctorId: doctorId.getValue() });
    if (!doc) {
      return null;
    }
    return this.toDomain(doc);
  }

  public async findByEmail(email: Email): Promise<Doctor | null> {
    const doc = await DoctorModel.findOne({ email: email.getValue() });
    if (!doc) {
      return null;
    }
    return this.toDomain(doc);
  }

  public async findAll(): Promise<Doctor[]> {
    const docs = await DoctorModel.find();
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: IDoctorDocument): Doctor {
    return new Doctor({
      doctorId: new DoctorId(doc.doctorId),
      firstName: doc.firstName,
      lastName: doc.lastName,
      email: new Email(doc.email),
      phone: doc.phone,
      specialization: doc.specialization,
    });
  }
}
