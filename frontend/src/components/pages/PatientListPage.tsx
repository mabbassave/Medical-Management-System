import React, { useRef,  useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, ArrowRight, RefreshCw } from 'lucide-react';
import { fetchAuthorizedPatients, type AuthorizedPatient } from '../../shared/services/patients';
import { useAuthStore } from '../../store/authStore';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Card } from '../molecules/Card';
import { SearchBar } from '../molecules/SearchBar';
import { Spinner } from '../atoms/Spinner';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

export const PatientListPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isDoctor = user?.role.toLowerCase() === 'doctor';
  const [patients, setPatients] = useState<AuthorizedPatient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPatients(await fetchAuthorizedPatients());
    } catch (err: unknown) {
      setPatients([]);
      setError(err instanceof Error ? err.message : 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPatients();
  }, [fetchPatients]);

  const filtered = patients.filter((p) => {
    const q = searchQuery.toLowerCase();
    return `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase().includes(q)
      || p.email?.toLowerCase().includes(q)
      || p.phone?.toLowerCase().includes(q);
  });

  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef, [loading]);

  return (
    <DashboardLayout>
      <div ref={containerRef} className={isDoctor ? 'space-y-6' : ''}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-textPrimary">{isDoctor ? 'My Patients' : 'Patients Directory'}</h1>
          <p className="text-sm text-textSecondary mt-0.5">
            {isDoctor ? 'Search and access records for your patients.' : 'View, search, and manage registered clinic patients.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchPatients()}
            disabled={loading}
            aria-label="Refresh patient list"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 hover:text-slate-900 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
          <Link to="/patients/new" className="inline-flex items-center justify-center text-xs font-semibold bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl transition-all shadow-xs">
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />Register Patient
          </Link>
        </div>
      </div>
      <div className={`mb-6 max-w-md ${isDoctor ? 'rounded-xl border border-border bg-surface p-4 shadow-card' : ''}`}>
        <SearchBar value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by patient name or email..." />
      </div>
      {loading && <div className="flex items-center justify-center py-16 text-primary"><Spinner size="lg" /><span className="ml-3 text-sm text-textSecondary">Loading patients...</span></div>}
      {!loading && error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm text-danger"
        >
          <p>{error}</p>
        </div>
      )}
      {!loading && !error && (
        <Card className={`!p-0 overflow-hidden ${isDoctor ? 'shadow-card' : ''}`}>
          {filtered.length === 0
            ? <div className="p-8 text-center text-textSecondary text-sm">
                {patients.length === 0 ? 'No assigned patients are available.' : 'No patients found matching your search.'}
              </div>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-600">
                    <tr>
                      <th className="px-6 py-3">Patient Name</th>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Phone</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {filtered.map((p) => (
                      <tr key={p.patientId} className="transition-colors hover:bg-slate-50/80">
                        <td className="px-6 py-4 font-medium text-slate-900">{p.fullName || `${p.firstName} ${p.lastName}`}</td>
                        <td className="px-6 py-4 text-slate-600">{p.email}</td>
                        <td className="px-6 py-4 text-slate-600">{p.phone || 'N/A'}</td>
                        <td className="px-6 py-4 text-right">
                          <Link to={`/patients/${p.patientId}`} className="inline-flex items-center text-xs font-semibold text-primary hover:text-primary-hover">
                            View Details<ArrowRight className="w-3.5 h-3.5 ml-1" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </Card>
      )}
          </div>
    </DashboardLayout>
  );
};
