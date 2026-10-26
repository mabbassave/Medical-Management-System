import React, { useRef,  useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import api from '../../shared/services/api';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Card } from '../molecules/Card';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

const schema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(7, 'Phone number must be at least 7 digits'),
  specialization: z.string().min(2, 'Specialization is required'),
});
type FormData = z.infer<typeof schema>;

export const DoctorCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await api.post('/doctors', data);
      toast.success('Doctor registered successfully!');
      navigate('/doctors');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create doctor');
    } finally { setIsSubmitting(false); }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef);

  return (
    <DashboardLayout>
      <div ref={containerRef} className="py-2">
        <div className="max-w-2xl mx-auto">
          <Link
            to="/doctors"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-textSecondary hover:text-primary transition-colors mb-6 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Doctors List
          </Link>

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-textPrimary">Add New Doctor</h1>
            <p className="text-sm text-textSecondary mt-1">Register a new medical specialist to the clinical staff roster.</p>
          </div>

          <Card className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card hover:shadow-card-hover transition-all">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField label="First Name" type="text" placeholder="Sarah" required error={errors.firstName?.message} {...register('firstName')} />
                <FormField label="Last Name" type="text" placeholder="Jenkins" required error={errors.lastName?.message} {...register('lastName')} />
              </div>
              <FormField label="Specialization" type="text" placeholder="e.g. Cardiology, Neurology, Pediatrics" required error={errors.specialization?.message} {...register('specialization')} />
              <FormField label="Email Address" type="email" placeholder="doctor@hospital.com" required error={errors.email?.message} {...register('email')} />
              <FormField label="Phone Number" type="tel" placeholder="+1 (555) 000-0000" required error={errors.phone?.message} {...register('phone')} />
              
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button type="button" variant="secondary" onClick={() => navigate('/doctors')}>Cancel</Button>
                <Button type="submit" variant="primary" isLoading={isSubmitting}>Save Doctor Profile</Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};
