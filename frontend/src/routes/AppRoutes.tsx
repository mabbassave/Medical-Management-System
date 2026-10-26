// Defines public, role-aware, and protected application routes.
import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from './ProtectedRoute';
import { useAuthStore } from '../store/authStore';
import { Spinner } from '../components/atoms/Spinner';
import { normalizeAppRole } from '../shared/utils/roleRoutes';

// --- Auth Pages (Public) ---
import { LoginPage } from '../components/pages/LoginPage';
import { RegisterPage } from '../components/pages/RegisterPage';
const LandingPage = lazy(() => import('../components/pages/LandingPage').then(({ LandingPage }) => ({ default: LandingPage })));
const FaceEnrollPage = lazy(() => import('../components/pages/FaceEnrollPage').then(({ FaceEnrollPage }) => ({ default: FaceEnrollPage })));
const ForgotPasswordPage = lazy(() => import('../components/pages/ForgotPasswordPage').then(({ ForgotPasswordPage }) => ({ default: ForgotPasswordPage })));
const VerifyOtpPage = lazy(() => import('../components/pages/VerifyOtpPage').then(({ VerifyOtpPage }) => ({ default: VerifyOtpPage })));
const ResetPasswordPage = lazy(() => import('../components/pages/ResetPasswordPage').then(({ ResetPasswordPage }) => ({ default: ResetPasswordPage })));
const OAuthCallbackPage = lazy(() => import('../components/pages/OAuthCallbackPage').then(({ OAuthCallbackPage }) => ({ default: OAuthCallbackPage })));

// --- Clinical Modules (Protected) ---
const DashboardPage = lazy(() => import('../components/pages/DashboardPage').then(({ DashboardPage }) => ({ default: DashboardPage })));
const DoctorDashboardPage = lazy(() => import('../components/pages/DoctorDashboardPage').then(({ DoctorDashboardPage }) => ({ default: DoctorDashboardPage })));
const DoctorProfilePage = lazy(() => import('../components/pages/DoctorProfilePage').then(({ DoctorProfilePage }) => ({ default: DoctorProfilePage })));
const PatientListPage = lazy(() => import('../components/pages/PatientListPage').then(({ PatientListPage }) => ({ default: PatientListPage })));
const PatientCreatePage = lazy(() => import('../components/pages/PatientCreatePage').then(({ PatientCreatePage }) => ({ default: PatientCreatePage })));
const PatientDetailPage = lazy(() => import('../components/pages/PatientDetailPage').then(({ PatientDetailPage }) => ({ default: PatientDetailPage })));
const DoctorListPage = lazy(() => import('../components/pages/DoctorListPage').then(({ DoctorListPage }) => ({ default: DoctorListPage })));
const DoctorCreatePage = lazy(() => import('../components/pages/DoctorCreatePage').then(({ DoctorCreatePage }) => ({ default: DoctorCreatePage })));
const DoctorDetailPage = lazy(() => import('../components/pages/DoctorDetailPage').then(({ DoctorDetailPage }) => ({ default: DoctorDetailPage })));
const AppointmentListPage = lazy(() => import('../components/pages/AppointmentListPage').then(({ AppointmentListPage }) => ({ default: AppointmentListPage })));
const AppointmentBookPage = lazy(() => import('../components/pages/AppointmentBookPage').then(({ AppointmentBookPage }) => ({ default: AppointmentBookPage })));
const VitalsRecordPage = lazy(() => import('../components/pages/VitalsRecordPage').then(({ VitalsRecordPage }) => ({ default: VitalsRecordPage })));
const PatientVitalsPage = lazy(() => import('../components/pages/PatientVitalsPage').then(({ PatientVitalsPage }) => ({ default: PatientVitalsPage })));
const PrescriptionListPage = lazy(() => import('../components/pages/PrescriptionListPage').then(({ PrescriptionListPage }) => ({ default: PrescriptionListPage })));
const PrescriptionCreatePage = lazy(() => import('../components/pages/PrescriptionCreatePage').then(({ PrescriptionCreatePage }) => ({ default: PrescriptionCreatePage })));
const MedicalRecordListPage = lazy(() => import('../components/pages/MedicalRecordListPage').then(({ MedicalRecordListPage }) => ({ default: MedicalRecordListPage })));
const MedicalRecordCreatePage = lazy(() => import('../components/pages/MedicalRecordCreatePage').then(({ MedicalRecordCreatePage }) => ({ default: MedicalRecordCreatePage })));
const LabReportListPage = lazy(() => import('../components/pages/LabReportListPage').then(({ LabReportListPage }) => ({ default: LabReportListPage })));
const LabReportUploadPage = lazy(() => import('../components/pages/LabReportUploadPage').then(({ LabReportUploadPage }) => ({ default: LabReportUploadPage })));
const PatientLabReportsPage = lazy(() => import('../components/pages/PatientLabReportsPage').then(({ PatientLabReportsPage }) => ({ default: PatientLabReportsPage })));
const BillingListPage = lazy(() => import('../components/pages/BillingListPage').then(({ BillingListPage }) => ({ default: BillingListPage })));
const BillingCreatePage = lazy(() => import('../components/pages/BillingCreatePage').then(({ BillingCreatePage }) => ({ default: BillingCreatePage })));
const PharmacyListPage = lazy(() => import('../components/pages/PharmacyListPage').then(({ PharmacyListPage }) => ({ default: PharmacyListPage })));
const PharmacyAddPage = lazy(() => import('../components/pages/PharmacyAddPage').then(({ PharmacyAddPage }) => ({ default: PharmacyAddPage })));
const PatientPortalPage = lazy(() => import('../components/pages/PatientPortalPage').then(({ PatientPortalPage }) => ({ default: PatientPortalPage })));
const DoctorAppointmentListPage = lazy(() => import('../components/pages/MyAppointmentListPage').then(({ DoctorAppointmentListPage }) => ({ default: DoctorAppointmentListPage })));
const PatientAppointmentListPage = lazy(() => import('../components/pages/MyAppointmentListPage').then(({ PatientAppointmentListPage }) => ({ default: PatientAppointmentListPage })));

// Renders the correct dashboard based on the logged-in user's role
const RoleAwareDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const role = normalizeAppRole(user?.role);
  if (role === 'doctor') return <DoctorDashboardPage />;
  if (role === 'patient') return <Navigate to="/portal" replace />;
  if (role === 'admin' || role === 'nurse') return <DashboardPage />;
  return <Navigate to="/login" replace />;
};

const RoleAwareAppointmentList: React.FC = () => {
  const { user } = useAuthStore();
  const role = user?.role?.toLowerCase();

  if (role === 'patient') return <PatientAppointmentListPage />;
  if (role === 'doctor') return <DoctorAppointmentListPage />;
  if (role === 'admin') return <AppointmentListPage />;
  return <Navigate to="/dashboard" replace />;
};

const RoleAwareLabReportsPage: React.FC = () => {
  const { user } = useAuthStore();
  const role = user?.role?.toLowerCase();

  if (role === 'patient') return <PatientLabReportsPage />;
  if (['doctor', 'nurse', 'admin'].includes(role || '')) return <LabReportListPage />;
  return <Navigate to="/dashboard" replace />;
};

const RoleAwareLabReportUploadPage: React.FC = () => {
  const { user } = useAuthStore();
  const role = user?.role?.toLowerCase();

  if (['doctor', 'nurse', 'admin'].includes(role || '')) return <LabReportUploadPage />;
  return <Navigate to="/lab-reports" replace />;
};

const RoleAwareVitalsPage: React.FC = () => {
  const { user } = useAuthStore();
  const role = user?.role?.toLowerCase();

  if (role === 'doctor') return <VitalsRecordPage />;
  if (role === 'patient') return <VitalsRecordPage />;
  return <Navigate to="/dashboard" replace />;
};

const RoleAwareVitalsHistoryPage: React.FC = () => {
  const { user } = useAuthStore();
  const role = user?.role?.toLowerCase();

  if (role === 'doctor') return <VitalsRecordPage />;
  if (role === 'patient') return <PatientVitalsPage />;
  return <Navigate to="/dashboard" replace />;
};

const RoleAwareFaceEnrollPage: React.FC = () => {
  const { user } = useAuthStore();
  if (!['patient', 'doctor'].includes(user?.role?.toLowerCase() || '')) {
    return <Navigate to="/dashboard" replace />;
  }
  return <FaceEnrollPage />;
};

export const AppRoutes: React.FC = () => {
  const token = useAuthStore((state) => state.token);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-primary" role="status" aria-label="Loading page">
          <Spinner size="lg" />
        </div>
      }
    >
    <Routes>
      {/* Public landing and auth pages redirect signed-in users to their dashboard. */}
      <Route path="/" element={token ? <Navigate to="/dashboard" replace /> : <LandingPage />} />

      {/* Public Authentication Routes */}
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
      <Route path="/auth/callback" element={<OAuthCallbackPage />} />
      <Route
        path="/face-enrollment-prompt"
        element={<ProtectedRoute><RoleAwareFaceEnrollPage /></ProtectedRoute>}
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* 3. Protected Clinical Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <RoleAwareDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorProfilePage />
          </ProtectedRoute>
        }
      />

      {/* Patients Management */}
      <Route
        path="/patients"
        element={
          <ProtectedRoute>
            <PatientListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/new"
        element={
          <ProtectedRoute>
            <PatientCreatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/:patientId"
        element={
          <ProtectedRoute>
            <PatientDetailPage />
          </ProtectedRoute>
        }
      />

      {/* Doctors Management */}
      <Route
        path="/doctors"
        element={
          <ProtectedRoute>
            <DoctorListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctors/new"
        element={
          <ProtectedRoute>
            <DoctorCreatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctors/:doctorId"
        element={
          <ProtectedRoute>
            <DoctorDetailPage />
          </ProtectedRoute>
        }
      />

      {/* Appointments */}
      <Route
        path="/appointments"
        element={
          <ProtectedRoute>
            <RoleAwareAppointmentList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/appointments/book"
        element={
          <ProtectedRoute>
            <AppointmentBookPage />
          </ProtectedRoute>
        }
      />

      {/* Vitals & Triage */}
      <Route
        path="/vitals"
        element={
          <ProtectedRoute>
            <RoleAwareVitalsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vitals/history"
        element={
          <ProtectedRoute>
            <RoleAwareVitalsHistoryPage />
          </ProtectedRoute>
        }
      />

      {/* Prescriptions */}
      <Route
        path="/prescriptions/patient/:patientId"
        element={
          <ProtectedRoute>
            <PrescriptionListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/prescriptions"
        element={
          <ProtectedRoute>
            <PrescriptionListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/prescriptions/new"
        element={
          <ProtectedRoute>
            <PrescriptionCreatePage />
          </ProtectedRoute>
        }
      />

      {/* Medical Records (EMR) */}
      <Route
        path="/medical-records"
        element={
          <ProtectedRoute>
            <MedicalRecordListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/medical-records/new"
        element={
          <ProtectedRoute>
            <MedicalRecordCreatePage />
          </ProtectedRoute>
        }
      />

      {/* Diagnostic Lab Reports */}
      <Route
        path="/lab-reports"
        element={
          <ProtectedRoute>
            <RoleAwareLabReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lab-reports/upload"
        element={
          <ProtectedRoute>
            <RoleAwareLabReportUploadPage />
          </ProtectedRoute>
        }
      />

      {/* Billing & Invoicing */}
      <Route
        path="/billing"
        element={
          <ProtectedRoute>
            <BillingListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/new"
        element={
          <ProtectedRoute>
            <BillingCreatePage />
          </ProtectedRoute>
        }
      />

      {/* Pharmacy & Stock */}
      <Route
        path="/pharmacy"
        element={
          <ProtectedRoute>
            <PharmacyListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pharmacy/add"
        element={
          <ProtectedRoute>
            <PharmacyAddPage />
          </ProtectedRoute>
        }
      />

      {/* Patient Portal */}
      <Route
        path="/portal"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientPortalPage />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to={token ? '/dashboard' : '/'} replace />} />
    </Routes>
    </Suspense>
  );
};
