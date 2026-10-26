import { randomUUID } from 'crypto';
import { IPatientRepository } from '../../domain/patient/IPatientRepository';
import { Patient } from '../../domain/patient/Patient.entity';
import { PatientId } from '../../domain/patient/PatientId';
import { Email } from '../../domain/patient/Email';
import { CreatePatientDTO } from './CreatePatientDTO';
import { AppError } from '../../domain/errors/AppError';

export class PatientApplicationService {
  constructor(private readonly patientRepository: IPatientRepository) {}

  public async createPatient(dto: CreatePatientDTO): Promise<string> {
    const email = new Email(dto.email);

    // Check if patient with this email already exists
    const existingPatient = await this.patientRepository.findByEmail(email);
    if (existingPatient) {
      throw new AppError(409, 'Patient with this email already exists');
    }

    // Generate unique ID and create domain entity
    const patientId = new PatientId(randomUUID());
    const patient = Patient.create({
      patientId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email,
      phone: dto.phone,
      dateOfBirth: new Date(dto.dateOfBirth),
    });

    // Persist patient
    await this.patientRepository.save(patient);

    return patientId.getValue();
  }

  public async getPatient(patientId: string): Promise<Patient> {
    const id = new PatientId(patientId);
    const patient = await this.patientRepository.findById(id);

    if (!patient) {
      throw new AppError(404, 'Patient not found');
    }

    return patient;
  }

  public async getAllPatients(): Promise<Patient[]> {
    return await this.patientRepository.findAll();
  }
}
