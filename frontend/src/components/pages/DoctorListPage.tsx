import React, { useRef,  useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Stethoscope, ArrowRight } from 'lucide-react';
import api from '../../shared/services/api';
import { useAuthStore } from '../../store/authStore';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Card } from '../molecules/Card';
import { SearchBar } from '../molecules/SearchBar';
import { Spinner } from '../atoms/Spinner';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

interface Doctor {
  doctorId: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  email: string;
  phone: string;
  specialization?: string;
  licenseNumber?: string;
}

export const DoctorListPage: React.FC = () => {
  const isAdmin = useAuthStore((state) => state.user?.role.toLowerCase() === 'admin');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/doctors') as Doctor[] | { data: Doctor[] };
        setDoctors(Array.isArray(res) ? res : (res as { data: Doctor[] }).data || []);
      } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to load doctors'); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const filtered = doctors.filter((d) => {
    const q = searchQuery.toLowerCase();
    return `${d.fullName || `${d.firstName || ''} ${d.lastName || ''}`} ${d.specialization || ''} ${d.email}`
      .toLowerCase()
      .includes(q);
  });

  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef, [loading]);

  return (
    <DashboardLayout>
      <div ref={containerRef}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-textPrimary">Doctors Directory</h1>
          <p className="text-sm text-textSecondary mt-0.5">
            Manage hospital medical staff and physician specialties.
          </p>
        </div>
        <Link to="/doctors/new" className="inline-flex items-center justify-center text-xs font-semibold bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl transition-all shadow-xs">
          <Stethoscope className="w-3.5 h-3.5 mr-1.5" />Add Doctor
        </Link>
      </div>
      <div className="mb-6 max-w-md">
        <SearchBar value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by doctor name or specialty..." />
      </div>
      {loading && <div className="flex items-center justify-center py-16 text-primary"><Spinner size="lg" /><span className="ml-3 text-sm text-textSecondary">Loading doctors...</span></div>}
      {!loading && error && <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl text-sm mb-6">{error}</div>}
      {!loading && !error && (
        <Card className="!p-0 overflow-hidden shadow-card">
          {filtered.length === 0
            ? <div className="p-8 text-center text-textSecondary text-sm">No doctors found.</div>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-600">
                    <tr>
                      <th className="px-6 py-3">Doctor Name</th>
                      <th className="px-6 py-3">Specialization</th>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Phone</th>
                      {isAdmin && (
                        <th className="px-6 py-3">License number</th>
                      )}
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {filtered.map((d) => (
                      <tr key={d.doctorId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">Dr. {(d.fullName || `${d.firstName || ''} ${d.lastName || ''}`).replace(/^Dr\.\s*/i, '')}</td>
                        <td className="px-6 py-4"><span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">{d.specialization || 'Not provided'}</span></td>
                        <td className="px-6 py-4 text-slate-600">{d.email}</td>
                        <td className="px-6 py-4 text-slate-600">{d.phone || 'N/A'}</td>
                        {isAdmin && (
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">{d.licenseNumber || 'Not provided'}</td>
                        )}
                        <td className="px-6 py-4 text-right">
                          <Link to={`/doctors/${d.doctorId}`} className="inline-flex items-center text-xs font-semibold text-primary hover:text-primary-hover">
                            View Profile<ArrowRight className="w-3.5 h-3.5 ml-1" />
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
