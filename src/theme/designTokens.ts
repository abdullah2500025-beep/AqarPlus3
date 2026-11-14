export const AQAR_THEME = {
  colors: {
    primary: '#26478D',
    primaryHover: '#1E3A75',
    secondary: '#97A5BA',
    backgroundDark: '#0A0E1A',
    cardDark: '#1A1F2E',
    surfaceDark: '#13192B',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  typography: {
    headingLarge: 'text-2xl sm:text-[28px] font-bold tracking-tight',
    headingMedium: 'text-lg sm:text-[22px] font-bold',
    headingSmall: 'text-base sm:text-lg font-semibold',
    bodyLarge: 'text-base',
    bodyMedium: 'text-sm',
    bodySmall: 'text-xs',
    caption: 'text-[11px]',
  },
  radius: {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl',
  },
  surface: {
    glassCard:
      'rounded-2xl border border-slate-200 dark:border-white/10 glass-surface',
    panel:
      'rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13192B]',
    subtleStrip:
      'rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03]',
  },
  buttons: {
    primary:
      'inline-flex items-center justify-center gap-2 min-h-[42px] px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#26478D] hover:bg-[#1E3A75] text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#26478D]',
    secondary:
      'inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/15 bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#26478D]',
    ghost:
      'inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap shrink-0',
    danger:
      'inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0',
  },
  inputs: {
    base: 'w-full min-h-[42px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0A0E1A] text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#26478D]',
    compact:
      'w-full min-h-[38px] px-3 py-2 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0A0E1A] text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#26478D]',
    label: 'block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5',
  },
} as const;
