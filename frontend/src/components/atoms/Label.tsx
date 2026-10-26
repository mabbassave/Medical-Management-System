import React from 'react';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  required?: boolean;
}

export const Label: React.FC<LabelProps> = ({
  children,
  required = false,
  className = '',
  ...props
}) => {
  return (
    <label
      className={`block text-sm font-medium text-textPrimary mb-1.5 ${className}`}
      {...props}
    >
      {children}
      {required && <span className="text-danger ml-1">*</span>}
    </label>
  );
};
