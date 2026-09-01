import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { ToastMessage } from '../types';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-item ${t.type}`}>
          {t.type === 'success' && <CheckCircle2 size={18} color="var(--riot-teal)" />}
          {t.type === 'error' && <AlertCircle size={18} color="var(--riot-red)" />}
          {(t.type === 'info' || t.type === 'warning') && <Info size={18} color="var(--hextech-gold)" />}

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFF' }}>{t.title}</div>
            {t.description && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {t.description}
              </div>
            )}
          </div>

          <button
            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
            onClick={() => onDismiss(t.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
