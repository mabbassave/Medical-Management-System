import React, { useRef,  useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus } from 'lucide-react';

import api from '../../shared/services/api';
import { DashboardLayout } from '../templates/DashboardLayout';
import { Card } from '../molecules/Card';
import { FormField } from '../molecules/FormField';
import { Button } from '../atoms/Button';
import { useFadeUp } from '../../shared/hooks/useFadeUp';

const medicineSchema = z.object({
  name: z.string().min(2, 'Medicine name is required'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  unitPrice: z.coerce.number().min(0.01, 'Unit price must be greater than 0'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
});

type MedicineFormData = z.infer<typeof medicineSchema>;

export const PharmacyAddPage: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MedicineFormData>({
    resolver: zodResolver(medicineSchema) as any,
  });

  const onSubmit = async (data: MedicineFormData) => {
    setIsSubmitting(true);
    try {
      await api.post('/pharmacy', {
        name: data.name,
        quantity: Number(data.quantity),
        unitPrice: Number(data.unitPrice),
        expiryDate: data.expiryDate,
      });

      toast.success('Medicine added to inventory!');
      navigate('/pharmacy');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add medicine');
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  useFadeUp(containerRef);

  return (
    <DashboardLayout>
      <div ref={containerRef} className="py-2">
        <div className="max-w-2xl mx-auto">
          <Link
            to="/pharmacy"
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-textSecondary hover:text-primary transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Pharmacy Inventory
          </Link>

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-textPrimary">
              Add Medication to Pharmacy
            </h1>
            <p className="text-sm text-textSecondary mt-1">
              Enter pharmaceutical details, inventory units, cost per unit, and expiration dating.
            </p>
          </div>

          <Card className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-card hover:shadow-card-hover transition-all">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                label="Medicine Name & Strength"
                type="text"
                placeholder="e.g. Amoxicillin 500mg, Paracetamol 650mg"
                required
                error={errors.name?.message}
                {...register('name')}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField
                  label="Stock Quantity (Units)"
                  type="number"
                  placeholder="100"
                  required
                  error={errors.quantity?.message}
                  {...register('quantity')}
                />

                <FormField
                  label="Unit Price ($)"
                  type="number"
                  step="0.01"
                  placeholder="12.50"
                  required
                  error={errors.unitPrice?.message}
                  {...register('unitPrice')}
                />
              </div>

              <FormField
                label="Expiry Date"
                type="date"
                required
                error={errors.expiryDate?.message}
                {...register('expiryDate')}
              />

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/pharmacy')}
                >
                  Cancel
                </Button>

                <Button type="submit" variant="primary" isLoading={isSubmitting} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add to Stock
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};
