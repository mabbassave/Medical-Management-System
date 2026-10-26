import { AppError } from '../errors/AppError';

export class Email {
  private readonly value: string;

  constructor(email: string) {
    if (!email || !this.validate(email)) {
      throw new AppError(400, 'Invalid email address format');
    }
    this.value = email.trim().toLowerCase();
  }

  private validate(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: Email): boolean {
    return this.value === other.getValue();
  }

  public toString(): string {
    return this.value;
  }
}
