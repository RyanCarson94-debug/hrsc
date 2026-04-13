import React from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const toastConfig: Record<
  ToastType,
  { icon: React.ReactNode; containerClass: string; iconClass: string }
> = {
  success: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    containerClass: 'bg-slate-900 border border-green-700/60',
    iconClass: 'text-green-400',
  },
  error: {
    icon: <AlertCircle className="w-4 h-4" />,
    containerClass: 'bg-slate-900 border border-red-700/60',
    iconClass: 'text-red-400',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4" />,
    containerClass: 'bg-slate-900 border border-amber-700/60',
    iconClass: 'text-amber-400',
  },
  info: {
    icon: <Info className="w-4 h-4" />,
    containerClass: 'bg-slate-900 border border-blue-700/60',
    iconClass: 'text-blue-400',
  },
};

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const config = toastConfig[toast.type];

  return (
    <div
      className={[
        'flex items-start gap-3 px-4 py-3 rounded-lg shadow-xl min-w-[280px] max-w-sm',
        'animate-[slideIn_0.2s_ease-out]',
        config.containerClass,
      ].join(' ')}
      style={{
        animation: 'slideIn 0.2s ease-out',
      }}
    >
      <span className={['flex-shrink-0 mt-0.5', config.iconClass].join(' ')}>
        {config.icon}
      </span>
      <p className="flex-1 text-sm text-slate-200 leading-snug">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

interface ToastStackProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

export const ToastStack: React.FC<ToastStackProps> = ({ toasts, removeToast }) => {
  if (!toasts.length) return null;

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </>
  );
};

export default ToastStack;
