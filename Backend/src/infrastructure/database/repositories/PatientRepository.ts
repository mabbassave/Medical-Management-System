import { IPatientRepository } from '../../../domain/patient/IPatientRepository';
import { Patient } from '../../../domain/patient/Patient.entity';
import { PatientId } from '../../../domain/patient/PatientId';
import { Email } from '../../../domain/patient/Email';
import { PatientModel, IPatientDocument } from '../schemas/Patient.schema';

export class PatientRepository implements IPatientRepository {
  public async save(patient: Patient): Promise<void> {
    await PatientModel.findOneAndUpdate(
      { patientId: patient.patientId.getValue() },
      {
        patientId: patient.patientId.getValue(),
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email.getValue(),
        phone: patient.phone,
        dateOfBirth: patient.dateOfBirth,
      },
      { upsert: true, new: true }
    );
  }

  public async findById(patientId: PatientId): Promise<Patient | null> {
    const doc = await PatientModel.findOne({ patientId: patientId.getValue() });
    if (!doc) {
      return null;
    }
    return this.toDomain(doc);
  }

  public async findByEmail(email: Email): Promise<Patient | null> {
    const doc = await PatientModel.findOne({ email: email.getValue() });
    if (!doc) {
      return null;
    }
    return this.toDomain(doc);
  }

  public async findAll(): Promise<Patient[]> {
    const docs = await PatientModel.find();
    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: IPatientDocument): Patient {
    return new Patient({
      patientId: new PatientId(doc.patientId),
      firstName: doc.firstName,
      lastName: doc.lastName,
      email: new Email(doc.email),
      phone: doc.phone,
      dateOfBirth: doc.dateOfBirth ? new Date(doc.dateOfBirth) : undefined,
    });
  }
}
