import React, { forwardRef } from 'react';
import { Label } from '../atoms/Label';
import { Input } from '../atoms/Input';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  required?: boolean;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, id, error, required = false, className = '', ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className={`w-full ${className}`}>
        <Label htmlFor={inputId} required={required}>
          {label}
        </Label>
        <Input id={inputId} ref={ref} error={error} {...props} />
      </div>
    );
  }
);

FormField.displayName = 'FormField';
