import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ClipboardPlus } from 'lucide-react';
import api from '../../shared/services/api';
import { fetchAuthorizedPatients } from '../../shared/services/patients';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Card } from '../molecules/Card';
import { Label } from '../atoms/Label';
import { Button } from '../atoms/Button';
import { Spinner } from '../atoms/Spinner';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

interface PatientOption {
  patientId: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
}

export const LabReportUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [testName, setTestName] = useState('');
  const [result, setResult] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const list = await fetchAuthorizedPatients();
        setPatients(list);
        if (list.length > 0) setSelectedPatientId(list[0].patientId);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : 'Failed to load patients.');
      } finally {
        setLoadingPatients(false);
      }
    };

    void fetchPatients();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPatientId) {
      toast.error('Please select a patient.');
      return;
    }

    setIsSaving(true);
    try {
      await api.post(`/lab-reports/patient/${encodeURIComponent(selectedPatientId)}`, {
        testName,
        result,
      });
      toast.success('Lab report created successfully.');
      navigate(`/lab-reports?patientId=${encodeURIComponent(selectedPatientId)}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create lab report.');
    } finally {
      setIsSaving(false);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef);

  return (
    <DashboardLayout>
      <div ref={containerRef}>
        <div className="mx-auto max-w-2xl">
          <Link
            to="/lab-reports"
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-textSecondary hover:text-primary transition-colors group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Lab Reports
          </Link>

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-textPrimary">Create Lab Report</h1>
            <p className="text-sm text-textSecondary mt-1">Upload and record diagnostic pathology notes and medical test results.</p>
          </div>

          {loadingPatients ? (
            <div className="flex items-center justify-center py-20 text-primary">
              <Spinner size="lg" />
              <span className="ml-3 text-sm font-medium text-textSecondary">Loading patients...</span>
            </div>
          ) : (
            <Card className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card hover:shadow-card-hover transition-all">
              {patients.length === 0 ? (
                <p className="py-6 text-center text-sm font-medium text-textSecondary">No patients found.</p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="labPatient" required className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2">
                      Select Patient
                    </Label>
                    <select
                      id="labPatient"
                      value={selectedPatientId}
                      onChange={(event) => setSelectedPatientId(event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-textPrimary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-xs"
                      required
                    >
                      {patients.map((patient) => (
                        <option key={patient.patientId} value={patient.patientId}>
                          {(patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`).trim()
                            || 'Unnamed Patient'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="testName" required className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2">
                      Test Name
                    </Label>
                    <input
                      id="testName"
                      value={testName}
                      onChange={(event) => setTestName(event.target.value)}
                      placeholder="e.g., Complete Blood Count, Chest X-Ray, Lipid Panel"
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-textPrimary placeholder:text-textMuted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-xs"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="result" required className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2">
                      Findings & Diagnostic Notes
                    </Label>
                    <textarea
                      id="result"
                      value={result}
                      onChange={(event) => setResult(event.target.value)}
                      rows={6}
                      placeholder="Enter the test findings, observations, normal vs abnormal values, and doctor interpretations..."
                      className="w-full resize-y rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-textPrimary placeholder:text-textMuted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-xs"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
                    <Button type="button" variant="secondary" onClick={() => navigate('/lab-reports')}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" isLoading={isSaving} className="gap-2">
                      <ClipboardPlus className="h-4 w-4" />
                      Save Report
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};
