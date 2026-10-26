import { randomUUID } from 'crypto';
import { IDoctorRepository } from '../../domain/doctor/IDoctorRepository';
import { Doctor } from '../../domain/doctor/Doctor.entity';
import { DoctorId } from '../../domain/doctor/DoctorId';
import { Email } from '../../domain/patient/Email';
import { CreateDoctorDTO } from './CreateDoctorDTO';
import { AppError } from '../../domain/errors/AppError';

export class DoctorApplicationService {
  constructor(private readonly doctorRepository: IDoctorRepository) {}

  public async createDoctor(dto: CreateDoctorDTO): Promise<string> {
    const email = new Email(dto.email);

    // Check if doctor with this email already exists
    const existingDoctor = await this.doctorRepository.findByEmail(email);
    if (existingDoctor) {
      throw new AppError(409, 'Doctor with this email already exists');
    }

    // Generate unique ID and create domain entity
    const doctorId = new DoctorId(randomUUID());
    const doctor = Doctor.create({
      doctorId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email,
      phone: dto.phone,
      specialization: dto.specialization,
    });

    // Persist doctor
    await this.doctorRepository.save(doctor);

    return doctorId.getValue();
  }

  public async getDoctor(doctorId: string): Promise<Doctor> {
    const id = new DoctorId(doctorId);
    const doctor = await this.doctorRepository.findById(id);

    if (!doctor) {
      throw new AppError(404, 'Doctor not found');
    }

    return doctor;
  }

  public async getAllDoctors(): Promise<Doctor[]> {
    return await this.doctorRepository.findAll();
  }
}
