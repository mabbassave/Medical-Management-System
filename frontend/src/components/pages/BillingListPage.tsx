import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Receipt, CheckCircle, Calendar } from 'lucide-react';

import api from '../../shared/services/api';
import { parseAuthorizedPatients } from '../../shared/services/patients';
import { useAuthStore } from '../../store/authStore';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Card } from '../molecules/Card';
import { Button } from '../atoms/Button';
import { Spinner } from '../atoms/Spinner';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

interface InvoiceItem {
  description: string;
  amount: number;
}

interface Invoice {
  invoiceId: string;
  patientId: string;
  appointmentId: string;
  items: InvoiceItem[];
  totalAmount: number;
  status: 'pending' | 'paid';
  createdAt: string;
}

interface Patient {
  patientId: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
}

export const BillingListPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isPatient = user?.role.toLowerCase() === 'patient';
  const canManageInvoices = ['admin', 'doctor', 'nurse'].includes(user?.role.toLowerCase() || '');
  const canPayInvoices = user?.role.toLowerCase() === 'admin' || isPatient;
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchPatients = async () => {
      if (isPatient) {
        try {
          const profileResponse = await api.get('/patients/me', { skipToast: true }) as {
            data?: { patientId?: string };
          };
          if (!profileResponse.data?.patientId) {
            throw new Error('No patient profile is linked to your account.');
          }
          if (isMounted) setSelectedPatientId(profileResponse.data.patientId);
        } catch (err) {
          if (isMounted) setLoadError(err instanceof Error ? err.message : 'Failed to load your billing profile.');
        } finally {
          if (isMounted) setLoading(false);
        }
        return;
      }

      try {
        const list = parseAuthorizedPatients(await api.get('/patients', { skipToast: true }));
        if (isMounted) {
          setPatients(list);
          setSelectedPatientId(list[0]?.patientId || '');
        }
      } catch (err) {
        if (isMounted) setLoadError(err instanceof Error ? err.message : 'Failed to load authorized patients.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchPatients();
    return () => {
      isMounted = false;
    };
  }, [isPatient]);

  // Fetch invoices whenever selected patient changes
  useEffect(() => {
    if (!selectedPatientId) {
      setInvoices([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchInvoices = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const response = await api.get(`/billing/patient/${encodeURIComponent(selectedPatientId)}`, { skipToast: true }) as Invoice[];
        if (!Array.isArray(response)) throw new Error('The billing service returned an invalid invoice list.');
        if (isMounted) setInvoices(response);
      } catch (err: unknown) {
        if (isMounted) {
          setInvoices([]);
          setLoadError(err instanceof Error ? err.message : 'Failed to fetch patient invoices.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchInvoices();

    return () => {
      isMounted = false;
    };
  }, [selectedPatientId]);

  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      setPayingId(invoiceId);
      await api.put(`/billing/${invoiceId}/pay`);
      toast.success('Payment status updated.');
      setInvoices((prev) =>
        prev.map((inv) => inv.invoiceId === invoiceId ? { ...inv, status: 'paid' } : inv)
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update payment status');
    } finally {
      setPayingId(null);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef, [loading, invoices]);

  // Safe invoice content renderer satisfying loading and empty checks
  const renderInvoiceContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16 text-primary">
          <Spinner size="lg" />
          <span className="ml-3 text-sm text-textSecondary font-medium">Loading...</span>
        </div>
      );
    }

    if (loadError) {
      return (
        <div role="alert" className="rounded-md border border-danger/20 bg-danger/10 p-4 text-sm text-danger">
          {loadError}
        </div>
      );
    }

    if (invoices.length === 0) {
      return (
        <Card className="rounded-2xl border border-border bg-surface p-12 text-center shadow-card">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Receipt className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-textPrimary">No invoices found</p>
          <p className="text-xs text-textSecondary mt-1">There are no billable statements for this selection.</p>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {invoices.map((inv) => {
          const isPaid = inv.status === 'paid';
          const items = Array.isArray(inv.items) ? inv.items : [];
          const total = Number(inv.totalAmount || 0);

          return (
            <Card key={inv.invoiceId} className="rounded-2xl border border-border bg-surface p-6 shadow-card hover:shadow-card-hover transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4 mb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-textPrimary" title={inv.invoiceId}>
                        INV-{inv.invoiceId.length > 8 ? inv.invoiceId.slice(0, 8).toUpperCase() : inv.invoiceId.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-textSecondary mt-0.5">
                      Ref Appointment: <span className="font-mono text-textPrimary">{inv.appointmentId}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-textSecondary flex items-center gap-1.5 bg-background px-3 py-1.5 rounded-lg border border-border">
                    <Calendar className="w-3.5 h-3.5 text-textMuted" />
                    {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                    isPaid
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-100 text-amber-700 border border-amber-200'
                  }`}>
                    {isPaid ? 'PAID' : 'PENDING'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 py-1">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center text-xs py-1.5 px-3 rounded-lg bg-background border border-border/60"
                  >
                    <span className="font-medium text-textPrimary">{item?.description || 'Item'}</span>
                    <span className="font-mono font-semibold text-textPrimary">
                      ${Number(item?.amount || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border mt-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-textMuted">
                    Total Amount Due:
                  </span>
                  <p className="text-2xl font-bold tracking-tight text-textPrimary mt-0.5">
                    ${total.toFixed(2)}
                  </p>
                </div>

                {!isPaid && canPayInvoices && (
                  <Button
                    variant="primary"
                    className="text-xs py-2 px-4 gap-2"
                    isLoading={payingId === inv.invoiceId}
                    onClick={() => handleMarkAsPaid(inv.invoiceId)}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Mark as Paid
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div ref={containerRef} className="py-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-textPrimary">Invoices & Billing</h1>
            <p className="text-sm text-textSecondary mt-1">
              Manage patient invoices, payment status, and clinical fee collections.
            </p>
          </div>

          {canManageInvoices && (
            <Link
              to="/billing/new"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Invoice
            </Link>
          )}
        </div>

        {!isPatient && (
          <div className="mb-6 max-w-sm">
            <label className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2">
              Select Patient
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              disabled={patients.length === 0}
              className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-textPrimary font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 shadow-xs"
            >
              {patients.length === 0 ? (
                <option value="">No patients available</option>
              ) : (
                patients.map((p) => (
                  <option key={p.patientId} value={p.patientId}>
                    {(p.fullName || `${p.firstName || ''} ${p.lastName || ''}`).trim() || 'Unnamed Patient'}
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        {renderInvoiceContent()}
      </div>
    </DashboardLayout>
  );
};
