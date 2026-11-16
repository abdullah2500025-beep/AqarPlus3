import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useAqar } from '../context/AqarContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallBanner() {
  const { lang } = useAqar();
  const isAr = lang === 'ar';
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.sessionStorage.getItem('aqarplus_pwa_dismissed') === '1';
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } catch {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="fixed bottom-16 lg:bottom-5 start-4 z-40 max-w-xs rounded-2xl border border-blue-400/30 bg-[#0F172A]/95 backdrop-blur-xl text-white p-3.5 shadow-2xl flex items-center justify-between gap-3 no-print">
      <div className="min-w-0 text-xs">
        <div className="font-bold truncate">
          {isAr ? 'تثبيت تطبيق AqarPlus' : 'Install AqarPlus App'}
        </div>
        <div className="text-[11px] text-slate-300 truncate">
          {isAr ? 'يعمل سريعاً ودون إنترنت على جهازك' : 'Works offline directly on your device'}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => void handleInstall()}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#26478D] hover:bg-[#1e3a75] text-white text-[11px] font-bold cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isAr ? 'تثبيت' : 'Install'}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            window.sessionStorage.setItem('aqarplus_pwa_dismissed', '1');
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          aria-label="Dismiss install prompt"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
