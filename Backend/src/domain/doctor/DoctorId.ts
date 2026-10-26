import { AppError } from '../errors/AppError';

export class DoctorId {
  private readonly value: string;

  constructor(id: string) {
    if (!id || id.trim().length === 0) {
      throw new AppError(400, 'DoctorId cannot be empty');
    }
    this.value = id.trim();
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: DoctorId): boolean {
    return this.value === other.getValue();
  }

  public toString(): string {
    return this.value;
  }
}
