export interface RegisterDTO {
  username: string;
  fullName?: string;
  email: string;
  phoneNumber?: string;
  phone?: string;
  password: string;
  role?: 'admin' | 'doctor' | 'nurse' | 'patient';
  specialty?: string;
  licenseNumber?: string;
}

