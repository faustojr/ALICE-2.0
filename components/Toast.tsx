
import React, { useEffect, useState } from 'react';
import { CheckCircleIcon, StarIcon, SparklesIcon } from './Icons';

export type ToastType = 'save' | 'achievement' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const Toast: React.FC<{ toast: ToastItem; onClose: (id: number) => void }> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Start animation
    requestAnimationFrame(() => setIsVisible(true));

    // Determine duration based on type
    // Save notifications are quick (0.5s), others (achievements) need time to be read (3s)
    const duration = toast.type === 'save' ? 500 : 3000;

    // Auto dismiss
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(toast.id), 300); // Wait for exit animation
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, onClose, toast.type]);

  const getStyle = () => {
    switch (toast.type) {
      case 'save':
        return 'bg-slate-800 border-slate-600 text-slate-300';
      case 'achievement':
        return 'bg-yellow-500/10 border-yellow-500/50 text-yellow-200';
      case 'info':
      default:
        return 'bg-blue-900/50 border-blue-500/50 text-blue-200';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'save':
        return <CheckCircleIcon className="w-5 h-5 text-green-400" />;
      case 'achievement':
        return <StarIcon className="w-5 h-5 text-yellow-400" />;
      default:
        return <SparklesIcon className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm
        transition-all duration-300 transform mb-3
        ${getStyle()}
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
      role="alert"
    >
      {getIcon()}
      <span className="font-medium text-sm">{toast.message}</span>
    </div>
  );
};

export const ToastContainer: React.FC<{ toasts: ToastItem[]; onClose: (id: number) => void }> = ({ toasts, onClose }) => {
  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col items-end pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onClose={onClose} />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
