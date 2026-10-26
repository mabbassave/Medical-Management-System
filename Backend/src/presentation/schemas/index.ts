/**
 * Central Zod validation schemas.
 *
 * Every POST / PUT route that accepts a request body must use one of these
 * schemas via the `validate(schema)` middleware.  Keeping all schemas here
 * makes the validation contract easy to audit and keeps individual route files
 * free of inline schema definitions.
 *
 * Written for Zod v4 — use `{ error: '...' }` instead of the v3-era
 * `required_error` / `invalid_type_error` options.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Non-empty trimmed string helper. */
const nonEmptyString = (label: string) =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} cannot be blank`);

/** Loose resource ID check (at least 3 non-empty chars). */
const resourceId = (label: string) =>
  nonEmptyString(label).min(3, `${label} must be a valid ID`);

// ---------------------------------------------------------------------------
// Auth schemas
// ---------------------------------------------------------------------------

export const registerSchema = z
  .object({
    username: nonEmptyString('Username')
      .min(3, 'Username must be at least 3 characters')
      .max(80, 'Username cannot exceed 80 characters'),
    fullName: z.string().trim().max(120).optional(),
    email: z.string({ error: 'Email is required' }).trim().email('Must be a valid email address'),
    phoneNumber: z
      .string()
      .trim()
      .refine(
        (val) => !val || /^\+[1-9]\d{6,14}$/.test(val.replace(/[\s\-()]/g, '')),
        { message: 'Phone number must include country code and 7-15 digits (e.g. +1234567890)' }
      )
      .optional(),
    phone: z.string().trim().optional(),
    password: z
      .string({ error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters'),
    role: z.enum(['patient', 'doctor']).optional(),
    specialty: z.string().trim().optional(),
    licenseNumber: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'doctor') {
      if (!data.specialty || data.specialty.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Medical specialty is required for doctor registration',
          path: ['specialty'],
        });
      }
      if (!data.licenseNumber || data.licenseNumber.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Medical license/registration number is required for doctor registration',
          path: ['licenseNumber'],
        });
      }
    }
  });


export const loginSchema = z
  .object({
    username: z.string().trim().optional(),
    email: z.string().trim().email('Must be a valid email address').optional(),
    password: z.string({ error: 'Password is required' }).min(1, 'Password cannot be blank'),
  })
  .refine((data) => data.username || data.email, {
    message: 'Either username or email is required',
    path: ['username'],
  });

export const forgotPasswordSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .email('Must be a valid email address'),
});

export const verifyResetOtpSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .email('Must be a valid email address'),
  otp: z
    .string({ error: 'OTP is required' })
    .trim()
    .regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
});

export const resetPasswordSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .email('Must be a valid email address'),
  otp: z
    .string({ error: 'OTP is required' })
    .trim()
    .regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
  newPassword: z
    .string({ error: 'New password is required' })
    .min(8, 'New password must be at least 8 characters'),
});

// ---------------------------------------------------------------------------
// Patient schemas
// ---------------------------------------------------------------------------

export const createPatientSchema = z.object({
  firstName: nonEmptyString('First name').max(50, 'First name cannot exceed 50 characters'),
  lastName: nonEmptyString('Last name').max(50, 'Last name cannot exceed 50 characters'),
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .email('Must be a valid email address'),
  phone: z
    .string({ error: 'Phone is required' })
    .trim()
    .min(7, 'Phone number is too short')
    .max(20, 'Phone number is too long'),
  dateOfBirth: z
    .string({ error: 'Date of birth is required' })
    .trim()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'dateOfBirth must be a valid date string' }),
});

// ---------------------------------------------------------------------------
// Doctor schemas
// ---------------------------------------------------------------------------

export const createDoctorSchema = z.object({
  firstName: nonEmptyString('First name').max(50, 'First name cannot exceed 50 characters'),
  lastName: nonEmptyString('Last name').max(50, 'Last name cannot exceed 50 characters'),
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .email('Must be a valid email address'),
  phone: z
    .string({ error: 'Phone is required' })
    .trim()
    .min(7, 'Phone number is too short')
    .max(20, 'Phone number is too long'),
  specialization: nonEmptyString('Specialization').max(100, 'Specialization cannot exceed 100 characters'),
});

// ---------------------------------------------------------------------------
// Appointment schemas
// ---------------------------------------------------------------------------

export const bookAppointmentSchema = z.object({
  patientId: resourceId('patientId'),
  doctorId: resourceId('doctorId'),
  appointmentDate: z
    .string({ error: 'Appointment date is required' })
    .trim()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'appointmentDate must be a valid date string' }),
  notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional(),
});

// ---------------------------------------------------------------------------
// Vitals schemas
// ---------------------------------------------------------------------------

/** Accepts a number OR a numeric string and coerces to a positive finite number. */
const positiveNumber = (label: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? parseFloat(v) : v),
    z
      .number({ error: `${label} must be a number` })
      .positive(`${label} must be a positive number`)
      .finite(`${label} must be a finite number`)
  );

const legacyVitalsSchema = z.object({
  patientId: resourceId('patientId'),
  bloodPressureSystolic: positiveNumber('bloodPressureSystolic'),
  bloodPressureDiastolic: positiveNumber('bloodPressureDiastolic'),
  sugarLevel: positiveNumber('sugarLevel'),
  temperature: positiveNumber('temperature'),
  heartRate: positiveNumber('heartRate'),
  pulseRate: positiveNumber('pulseRate'),
  rbcCount: positiveNumber('rbcCount'),
  wbcCount: positiveNumber('wbcCount'),
});

const scanMetricSchema = z.enum(['heartRate', 'breathingRate', 'hrv', 'stressLevel', 'bloodPressure', 'spo2']);
const scanVitalsSchema = z.object({
  patientId: resourceId('patientId'),
  selectedMetrics: z.array(scanMetricSchema).min(1, 'Select at least one metric').max(6),
  heartRate: z.number().min(35).max(220).optional(),
  breathingRate: z.number().min(4).max(60).optional(),
  hrv: z.number().min(1).max(300).optional(),
  stressLevel: z.number().min(0).max(100).optional(),
  bloodPressure: z.object({
    systolic: z.number().min(50).max(260),
    diastolic: z.number().min(30).max(160),
  }).optional(),
  spo2: z.number().min(50).max(100).optional(),
  scanDuration: z.number().int().min(10).max(30),
  confidence: z.number().min(0).max(1).optional(),
  quality: z.number().min(0).max(1).optional(),
  qualityReason: z.string().trim().max(300).optional(),
});
export const recordDoctorOwnedScanSchema = scanVitalsSchema.omit({ patientId: true });

export const recordVitalsSchema = z.union([scanVitalsSchema, legacyVitalsSchema]);

// ---------------------------------------------------------------------------
// Prescription schemas
// ---------------------------------------------------------------------------

const medicineItemSchema = z.object({
  name: nonEmptyString('Medicine name'),
  dosage: z.string().trim().optional(),
  // Accept older/newer clients that submit frequency as well as clients that
  // still send the original name/dosage/duration/instructions shape.
  frequency: z.string().trim().optional(),
  duration: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
});

export const createPrescriptionSchema = z.object({
  patientId: resourceId('patientId'),
  doctorId: resourceId('doctorId'),
  medicines: z
    .array(medicineItemSchema, { error: 'medicines is required' })
    .min(1, 'At least one medicine is required'),
  diagnosis: nonEmptyString('Diagnosis').max(500, 'Diagnosis cannot exceed 500 characters'),
});

// ---------------------------------------------------------------------------
// Medical Record schemas
// ---------------------------------------------------------------------------

export const createMedicalRecordSchema = z.object({
  patientId: resourceId('patientId'),
  doctorId: resourceId('doctorId').optional(),
  diagnosis: nonEmptyString('Diagnosis').max(500, 'Diagnosis cannot exceed 500 characters'),
  notes: z.string().trim().max(2000, 'Notes cannot exceed 2000 characters').optional(),
  allergies: z.array(z.string().trim().min(1)).optional().default([]),
});

// ---------------------------------------------------------------------------
// Billing schemas
// ---------------------------------------------------------------------------

const invoiceItemSchema = z.object({
  description: nonEmptyString('Item description'),
  amount: z
    .number({ error: 'Item amount must be a number' })
    .positive('Item amount must be positive'),
});

export const createInvoiceSchema = z.object({
  patientId: resourceId('patientId'),
  appointmentId: resourceId('appointmentId'),
  items: z
    .array(invoiceItemSchema, { error: 'items is required' })
    .min(1, 'At least one billing item is required'),
});

// ---------------------------------------------------------------------------
// Pharmacy schemas
// ---------------------------------------------------------------------------

export const addMedicineSchema = z.object({
  name: nonEmptyString('Medicine name').max(100, 'Name cannot exceed 100 characters'),
  quantity: z.preprocess(
    (v) => (typeof v === 'string' ? parseInt(v, 10) : v),
    z
      .number({ error: 'Quantity must be a number' })
      .int('Quantity must be a whole number')
      .nonnegative('Quantity cannot be negative')
  ),
  unitPrice: z.preprocess(
    (v) => (typeof v === 'string' ? parseFloat(v) : v),
    z
      .number({ error: 'Unit price must be a number' })
      .positive('Unit price must be positive')
  ),
  expiryDate: z
    .string({ error: 'Expiry date is required' })
    .trim()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'expiryDate must be a valid date string' }),
});

export const reduceStockSchema = z.object({
  amount: z.preprocess(
    (v) => (typeof v === 'string' ? parseFloat(v) : v),
    z
      .number({ error: 'Amount must be a number' })
      .positive('Amount must be a positive number')
      .finite()
  ),
});

// ---------------------------------------------------------------------------
// Lab Report schemas
// ---------------------------------------------------------------------------

export const createLabReportSchema = z.object({
  doctorId: resourceId('doctorId').optional(),
  testName: nonEmptyString('Test name').max(200, 'Test name cannot exceed 200 characters'),
  result: nonEmptyString('Result').max(2000, 'Result cannot exceed 2000 characters'),
});
