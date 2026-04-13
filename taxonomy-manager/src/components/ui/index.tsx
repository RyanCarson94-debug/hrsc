import React, { Fragment } from 'react';
import { X, ChevronDown, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

const buttonVariantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:   'bg-brand-600 hover:bg-brand-700 text-white',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600',
  ghost:     'bg-transparent hover:bg-slate-800 text-slate-300 hover:text-white',
  danger:    'bg-red-600 hover:bg-red-700 text-white',
  success:   'bg-green-600 hover:bg-green-700 text-white',
};

const buttonSizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  xs: 'text-xs px-2 py-1',
  sm: 'text-sm px-3 py-1.5',
  md: 'text-sm px-4 py-2',
  lg: 'text-base px-5 py-2.5',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      children,
      className = '',
      disabled,
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900',
          buttonVariantClasses[variant],
          buttonSizeClasses[size],
          isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          className,
        ].join(' ')}
        {...rest}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : icon ? (
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

export interface BadgeProps {
  label: string;
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ label, className = '', dot = false }) => {
  return (
    <span
      className={[
        'text-2xs font-medium px-1.5 py-0.5 rounded border inline-flex items-center gap-1',
        className,
      ].join(' ')}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
      )}
      {label}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, action }) => {
  return (
    <div
      className={[
        'bg-slate-900 border border-slate-800 rounded-xl p-5',
        className,
      ].join(' ')}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && (
            <span className="text-sm font-semibold text-slate-200">{title}</span>
          )}
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className = '', id, ...rest }, ref) => {
    const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs text-slate-400 font-medium mb-1"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={[
              'bg-slate-800 border text-slate-100 rounded-lg px-3 py-2 text-sm w-full transition-colors outline-none',
              'focus:border-brand-500 focus:ring-1 focus:ring-brand-500',
              'placeholder:text-slate-500',
              error ? 'border-red-500' : 'border-slate-700',
              icon ? 'pl-9' : '',
              className,
            ].join(' ')}
            {...rest}
          />
        </div>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ---------------------------------------------------------------------------
// Textarea
// ---------------------------------------------------------------------------

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, ...rest }, ref) => {
    const textareaId = id ?? (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs text-slate-400 font-medium mb-1"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={[
            'bg-slate-800 border text-slate-100 rounded-lg px-3 py-2 text-sm w-full min-h-[80px] resize-y transition-colors outline-none',
            'focus:border-brand-500 focus:ring-1 focus:ring-brand-500',
            'placeholder:text-slate-500',
            error ? 'border-red-500' : 'border-slate-700',
            className,
          ].join(' ')}
          {...rest}
        />
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = '', id, ...rest }, ref) => {
    const selectId = id ?? (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs text-slate-400 font-medium mb-1"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={[
              'appearance-none bg-slate-800 border text-slate-100 rounded-lg px-3 py-2 text-sm w-full transition-colors outline-none pr-8',
              'focus:border-brand-500 focus:ring-1 focus:ring-brand-500',
              error ? 'border-red-500' : 'border-slate-700',
              className,
            ].join(' ')}
            {...rest}
          >
            {placeholder && (
              <option value="" className="bg-slate-800 text-slate-400">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-slate-800">
                {opt.label}
              </option>
            ))}
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <ChevronDown className="w-4 h-4" />
          </span>
        </div>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const spinnerSizeClasses: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '' }) => {
  return (
    <div
      className={[
        'animate-spin rounded-full border-2 border-slate-700 border-t-brand-500',
        spinnerSizeClasses[size],
        className,
      ].join(' ')}
    />
  );
};

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const modalSizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={[
          'bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full flex flex-col',
          modalSizeClasses[size],
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors rounded-md p-1 hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh] scrollbar-thin">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="bg-slate-800/50 px-6 py-4 flex justify-end gap-2 border-t border-slate-800 flex-shrink-0 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 mb-4">
        {icon}
      </div>
      <p className="text-slate-300 font-medium text-sm mb-1">{title}</p>
      {description && (
        <p className="text-slate-500 text-xs max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ConfirmDialog
// ---------------------------------------------------------------------------

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  danger = false,
}) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-300">{description}</p>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  color = 'bg-brand-600/20 text-brand-400',
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-start gap-4">
      <div
        className={[
          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
          color,
        ].join(' ')}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-100 leading-tight">{value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
        {trend && (
          <p className="text-2xs text-slate-500 mt-1">{trend}</p>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

export interface TabsProps {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, active, onChange }) => {
  return (
    <div className="flex gap-1 border-b border-slate-800">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={[
              'px-4 py-2.5 text-sm font-medium transition-colors relative whitespace-nowrap',
              isActive
                ? 'text-white border-b-2 border-brand-500 -mb-px'
                : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent -mb-px',
            ].join(' ')}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={[
                  'ml-1.5 text-2xs px-1.5 py-0.5 rounded-full font-medium',
                  isActive
                    ? 'bg-brand-600/30 text-brand-300'
                    : 'bg-slate-700 text-slate-400',
                ].join(' ')}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
