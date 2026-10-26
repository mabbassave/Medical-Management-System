import { AppError } from './AppError';

export type FaceVerificationDiagnosticCode =
  | 'NO_ELIGIBLE_ENROLLMENT'
  | 'FACE_TEMPLATE_MISSING'
  | 'FACE_TEMPLATE_UNREADABLE'
  | 'FACE_TEMPLATE_INCOMPATIBLE'
  | 'FACE_MISMATCH'
  | 'MATCHED_ACCOUNT_UNAVAILABLE'
  | 'AMBIGUOUS_FACE_MATCH'
  | 'MATCHED_ACCOUNT_INVALID';

export class FaceVerificationError extends AppError {
  public constructor(
    statusCode: number,
    message: string,
    public readonly diagnosticCode: FaceVerificationDiagnosticCode
  ) {
    super(statusCode, message);
  }
}
