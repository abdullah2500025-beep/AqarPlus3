import React from 'react';
import { Loader2 } from 'lucide-react';
import { AQAR_THEME } from '../../theme/designTokens';
import { triggerHaptic } from '../../utils/haptics';

interface UnifiedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function UnifiedButton({
  variant = 'primary',
  loading = false,
  icon,
  children,
  className = '',
  onClick,
  disabled,
  ...rest
}: UnifiedButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    triggerHaptic(variant === 'danger' ? 'warning' : 'light');
    onClick?.(e);
  };

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      onClick={handleClick}
      className={`${AQAR_THEME.buttons[variant]} ${className}`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : icon}
      <span>{children}</span>
    </button>
  );
}

interface UnifiedCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

export function UnifiedCard({ children, className = '', padding = 'md' }: UnifiedCardProps) {
  const padClass = padding === 'sm' ? 'p-4' : padding === 'lg' ? 'p-6' : 'p-5';
  return <div className={`${AQAR_THEME.surface.glassCard} ${padClass} ${className}`}>{children}</div>;
}

interface UnifiedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function UnifiedInput({ label, hint, error, className = '', ...rest }: UnifiedInputProps) {
  return (
    <div className="space-y-1">
      {label && <label className={AQAR_THEME.inputs.label}>{label}</label>}
      <input {...rest} className={`${AQAR_THEME.inputs.base} ${className}`} />
      {error ? (
        <p className="text-[11px] text-red-500 font-medium">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

interface UnifiedSectionHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function UnifiedSectionHeader({ title, subtitle, actions }: UnifiedSectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/10">
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">{title}</h2>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

interface UnifiedEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function UnifiedEmptyState({ icon, title, description, action }: UnifiedEmptyStateProps) {
  return (
    <div className="p-8 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] text-center space-y-2.5">
      {icon && (
        <div className="w-11 h-11 rounded-2xl bg-[#26478D]/10 dark:bg-[#26478D]/25 text-[#26478D] dark:text-blue-400 flex items-center justify-center mx-auto">
          {icon}
        </div>
      )}
      <div className="text-sm font-bold text-slate-900 dark:text-white">{title}</div>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">{description}</p>
      {action && <div className="pt-1 flex justify-center">{action}</div>}
    </div>
  );
}
