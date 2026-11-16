/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { AqarProvider, useAqar } from './context/AqarContext';
import { LayoutShell } from './components/LayoutShell';
import { DashboardView } from './components/DashboardView';
import { DailyTasksAlertsView } from './components/DailyTasksAlertsView';
import { PropertiesUnitsView } from './components/PropertiesUnitsView';
import { TenantsCrmView } from './components/TenantsCrmView';
import { LeasingFinanceHubView } from './components/LeasingFinanceHubView';
import { MaintenanceTasksView } from './components/MaintenanceTasksView';
import { AdminHubView } from './components/AdminHubView';
import { DocumentsVaultView } from './components/DocumentsVaultView';
import { SmartArchiveView } from './components/SmartArchiveView';
import { SettingsCenterView } from './components/SettingsCenterView';
import { CommunicationTemplatesView } from './components/CommunicationTemplatesView';
import { OnboardingJourney } from './components/OnboardingJourney';
import { TeamWorkforceView } from './components/TeamWorkforceView';
import { PublicProspectViews } from './components/PublicProspectViews';
import { AuthLoginScreen } from './components/AuthLoginScreen';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { InviteActivationPage } from './components/InviteActivationPage';
import { UserProfileView } from './components/UserProfileView';
import { UnifiedBackButton } from './components/ui/UnifiedComponents';

function AqarWorkspace() {
  const {
    authChecking,
    isAuthenticated,
    loading,
    state,
    companyBranding,
    lastCompanyMeta,
    activeNav,
    setActiveNav,
    goBackNav,
    canAccessNav,
    lang,
    onboardingConfig,
    closeOnboarding,
  } = useAqar();

  const isAr = lang === 'ar';

  if (authChecking) {
    const activeBrandName = isAr
      ? companyBranding?.nameAr || lastCompanyMeta?.nameAr || 'AqarPlus — عقار بلس'
      : companyBranding?.nameEn || lastCompanyMeta?.nameEn || 'AqarPlus Property OS';
    const activeLogo = companyBranding?.logoDataUrl || lastCompanyMeta?.logoDataUrl;
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center p-6"
        style={{
          background:
            'radial-gradient(circle at top right, rgba(38, 71, 141, 0.42), transparent 55%), linear-gradient(155deg, #1E40AF 0%, #0F1E4A 42%, #0A0E1A 100%)',
        }}
      >
        <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-white/10 backdrop-blur-2xl text-white p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#26478D] to-[#0A0E1A] border border-white/20 flex items-center justify-center overflow-hidden shadow-lg">
            {activeLogo ? (
              <img
                src={activeLogo}
                alt={activeBrandName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src="./assets/aistudio/Aqar_plus_8de53ba4.svg"
                alt="AqarPlus"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain p-2.5"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold tracking-tight text-white">{activeBrandName}</h1>
            <p className="text-xs text-blue-100/80 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>{isAr ? 'جاري التحقق من الجلسة الآمنة...' : 'Verifying secure session...'}</span>
            </p>
          </div>
          <div className="flex justify-center pt-1">
            <Loader2 className="w-6 h-6 animate-spin text-blue-200" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthLoginScreen />;
  }

  if (loading || !state) {
    return (
      <div className="min-h-screen flex bg-slate-50 dark:bg-[#0A0E1A] text-slate-900 dark:text-slate-100">
        {/* Sidebar Skeleton */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 border-e border-slate-200 dark:border-white/10 glass-sidebar p-4 space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#26478D] to-[#0A0E1A] text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden border border-white/15">
              <img
                src="./assets/aistudio/Aqar_plus_8de53ba4.svg"
                alt="AqarPlus"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain p-1"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-24 rounded-md aqar-skeleton" />
              <div className="h-2.5 w-16 rounded-md aqar-skeleton" />
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl aqar-skeleton" />
            ))}
          </div>
        </aside>

        {/* Main Viewport Skeleton */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-14 lg:h-16 px-4 lg:px-6 border-b border-slate-200 dark:border-white/10 glass-surface flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="lg:hidden w-8 h-8 rounded-lg bg-gradient-to-br from-[#26478D] to-[#0A0E1A] text-white flex items-center justify-center font-bold text-xs overflow-hidden border border-white/15">
                <img
                  src="./assets/aistudio/Aqar_plus_8de53ba4.svg"
                  alt="AqarPlus"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain p-1"
                />
              </div>
              <div className="h-4 w-32 rounded-md aqar-skeleton" />
            </div>
            <div className="hidden md:block h-9 w-72 rounded-xl aqar-skeleton" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-20 rounded-lg aqar-skeleton" />
              <div className="h-8 w-8 rounded-lg aqar-skeleton" />
            </div>
          </div>

          <div className="p-4 lg:p-6 max-w-[1440px] w-full mx-auto space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="h-3 w-44 rounded-md aqar-skeleton" />
                <div className="h-6 w-60 rounded-lg aqar-skeleton" />
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {lang === 'ar' ? 'جاري تهيئة مساحة العمل...' : 'Loading AqarPlus Workspace...'}
              </div>
            </div>

            {/* 4 KPI Skeleton Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-24 rounded aqar-skeleton" />
                    <div className="h-5 w-5 rounded-md aqar-skeleton" />
                  </div>
                  <div className="h-7 w-32 rounded-md aqar-skeleton" />
                  <div className="h-3 w-40 rounded aqar-skeleton" />
                </div>
              ))}
            </div>

            {/* Content Panels Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 p-5 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-3">
                <div className="h-4 w-48 rounded aqar-skeleton" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-xl aqar-skeleton" />
                ))}
              </div>
              <div className="lg:col-span-5 p-5 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-3">
                <div className="h-4 w-36 rounded aqar-skeleton" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-xl aqar-skeleton" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const routeAuthorized = activeNav === 'dashboard' || activeNav === 'profile' || canAccessNav(activeNav);

  return (
    <>
      <LayoutShell>
        {!routeAuthorized ? (
          <div className="max-w-lg mx-auto my-12 p-6 rounded-2xl border border-red-500/25 bg-white dark:bg-[#11172A] text-center space-y-4 shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'ar' ? 'ليس لديك صلاحية للوصول إلى هذا القسم' : 'Access Restricted'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {lang === 'ar'
                ? 'تم تقييد هذا القسم وفق صلاحيات دورك الوظيفي. يمكنك مراجعة صلاحياتك من الملف الشخصي أو التواصل مع مدير الشركة.'
                : 'This section is restricted under your current role permissions.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <UnifiedBackButton onClick={goBackNav} lang={lang} />
              <button
                type="button"
                onClick={() => setActiveNav('dashboard')}
                className="px-4 py-2 rounded-xl bg-[#26478D] text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
              >
                {lang === 'ar' ? 'العودة للوحة الرئيسية' : 'Go to Dashboard'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeNav === 'dashboard' && <DashboardView />}
            {activeNav === 'daily_hub' && <DailyTasksAlertsView />}
            {activeNav === 'properties' && <PropertiesUnitsView />}
            {activeNav === 'leasing_finance' && <LeasingFinanceHubView />}
            {activeNav === 'tenants' && <TenantsCrmView />}
            {activeNav === 'maintenance' && <MaintenanceTasksView />}
            {activeNav === 'reports' && <AdminHubView key="reports" mode="reports" />}
            {activeNav === 'team' && <TeamWorkforceView />}
            {activeNav === 'documents' && <DocumentsVaultView />}
            {activeNav === 'archive' && <SmartArchiveView />}
            {activeNav === 'templates' && <CommunicationTemplatesView />}
            {activeNav === 'settings' && <SettingsCenterView />}
            {activeNav === 'profile' && <UserProfileView />}
            {activeNav === 'about' && <SettingsCenterView initialSection="about" />}
          </>
        )}
      </LayoutShell>
      {onboardingConfig.open && (
        <OnboardingJourney
          key={`${onboardingConfig.initialStage}-${onboardingConfig.isLockMode}`}
          initialStage={onboardingConfig.initialStage}
          isLockMode={onboardingConfig.isLockMode}
          onComplete={closeOnboarding}
        />
      )}
      <PwaInstallBanner />
    </>
  );
}

export default function App() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const leadDecisionToken = params?.get('leadDecision');
  const isProspectForm = params?.get('prospectForm') === '1';
  const initialInviteToken = params?.get('inviteToken') || '';
  const initialInviteWorkspace = params?.get('workspace') || 'default';
  const [inviteToken, setInviteToken] = useState<string>(initialInviteToken);

  if (leadDecisionToken) {
    return <PublicProspectViews mode="decision" token={leadDecisionToken} />;
  }

  if (isProspectForm) {
    return (
      <PublicProspectViews
        mode="prospect"
        propertyId={params?.get('propertyId') || undefined}
        unitId={params?.get('unitId') || undefined}
      />
    );
  }

  return (
    <AqarProvider>
      {inviteToken ? (
        <InviteActivationPage
          token={inviteToken}
          workspaceSlug={initialInviteWorkspace}
          onExitToLogin={() => {
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.delete('inviteToken');
              window.history.replaceState({}, '', url.toString());
            }
            setInviteToken('');
          }}
        />
      ) : (
        <AqarWorkspace />
      )}
    </AqarProvider>
  );
}
