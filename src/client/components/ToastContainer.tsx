import React from 'react';
import { useApp } from '../context/AppContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  return (
    <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => {
        const iconName = toast.type === 'error' ? 'error' : toast.type === 'warning' ? 'warning' : 'check_circle';
        const iconColor = toast.type === 'error' ? 'text-error' : toast.type === 'warning' ? 'text-warning' : 'text-success';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-lg shadow-md border transition-all duration-300 min-w-[300px] max-w-[420px] ${
              toast.type === 'error'
                ? 'bg-error-container text-on-error-container border-error/30'
                : toast.type === 'warning'
                ? 'bg-warning/10 text-on-surface border-warning/40'
                : 'bg-surface-container-lowest text-on-surface border-success/40'
            }`}
          >
            <span className={`material-symbols-outlined ${iconColor} text-xl shrink-0 mt-0.5`}>
              {iconName}
            </span>
            <div className="flex flex-col flex-1">
              {toast.code && (
                <span className="font-code-sm text-code-sm font-bold opacity-80">{toast.code}</span>
              )}
              <span className="font-body-sm text-body-sm font-medium mt-0.5">{toast.message}</span>
            </div>
            <button
              type="button"
              className="text-secondary hover:text-on-surface p-1 rounded transition-colors"
              onClick={() => removeToast(toast.id)}
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};
