import { FiCheckCircle, FiAlertCircle, FiInfo, FiAlertTriangle, FiX } from 'react-icons/fi';
import { useToast } from '../context/ToastContext';

const ICONS = {
  success: FiCheckCircle,
  error:   FiAlertCircle,
  warn:    FiAlertTriangle,
  info:    FiInfo,
};

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();
  if (!toasts.length) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || FiInfo;
        return (
          <div key={t.id} className={`toast toast--${t.type}`} role="status">
            <Icon size={18} className="toast__icon" />
            <span className="toast__msg">{t.message}</span>
            <button
              className="toast__close"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              <FiX size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}