import React from 'react';
import { useApp } from '../context/AppContext';

// แสดงข้อความทุกตัวเป็น app-message (DC-2.8)
// data-kind = error | notice | info, data-code = error code หรือ notice code (info เว้นว่าง)
export const ToastContainer: React.FC = () => {
  const { messages, removeMessage } = useApp();

  return (
    <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 pointer-events-none" aria-live="polite">
      {messages.map(message => {
        const iconName = message.tone === 'error' ? 'error' : message.tone === 'warning' ? 'warning' : message.tone === 'info' ? 'info' : 'check_circle';
        const iconColor = message.tone === 'error' ? 'text-error' : message.tone === 'warning' ? 'text-warning' : message.tone === 'info' ? 'text-info' : 'text-success';

        return (
          <div
            key={message.id}
            data-testid="app-message"
            data-kind={message.kind}
            data-code={message.code}
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-lg shadow-md border transition-all duration-300 min-w-[300px] max-w-[420px] ${
              message.tone === 'error'
                ? 'bg-error-container text-on-error-container border-error/30'
                : message.tone === 'warning'
                ? 'bg-warning/10 text-on-surface border-warning/40'
                : 'bg-surface-container-lowest text-on-surface border-success/40'
            }`}
          >
            <span className={`material-symbols-outlined ${iconColor} text-xl shrink-0 mt-0.5`}>
              {iconName}
            </span>
            <div className="flex flex-col flex-1">
              {message.code && (
                <span className="font-code-sm text-code-sm font-bold opacity-80">{message.code}</span>
              )}
              <span className="font-body-sm text-body-sm font-medium mt-0.5">{message.text}</span>
            </div>
            <button
              type="button"
              title="ปิดข้อความ"
              className="text-secondary hover:text-on-surface p-1 rounded transition-colors"
              onClick={() => removeMessage(message.id)}
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};
