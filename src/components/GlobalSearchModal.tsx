import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Filter,
  Search,
  Share2,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { NavSection, useAqar } from '../context/AqarContext';
import { SharedSearchFilter } from '../types/aqar';
import { formatCurrency } from '../utils/formatters';
import { triggerHaptic } from '../utils/haptics';

type SearchEntityType = SharedSearchFilter['entityType'];

interface SearchHit {
  id: string;
  entityType: Exclude<SearchEntityType, 'all'>;
  typeAr: string;
  title: string;
  subtitle: string;
  propertyId?: string;
  amount?: number;
  isOverdue?: boolean;
  nav: NavSection;
  score: number;
}

const ENTITY_LABELS: { key: SearchEntityType; labelAr: string }[] = [
  { key: 'all', labelAr: 'الكل' },
  { key: 'property', labelAr: 'عقارات' },
  { key: 'unit', labelAr: 'وحدات' },
  { key: 'tenant', labelAr: 'مستأجرون' },
  { key: 'contract', labelAr: 'عقود' },
  { key: 'payment', labelAr: 'إيصالات' },
  { key: 'expense', labelAr: 'مصروفات' },
  { key: 'task', labelAr: 'مهام' },
  { key: 'ticket', labelAr: 'صيانة' },
  { key: 'document', labelAr: 'مستندات' },
];

export function normalizeArabicText(txt: string): string {
  return String(txt || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

// Fuzzy match scorer supporting exact, prefix, substring, token overlap, and 1-2 char typo tolerance
export function fuzzyMatchScore(text: string, rawQuery: string): number {
  const q = normalizeArabicText(rawQuery);
  if (!q) return 10;
  const target = normalizeArabicText(text);
  if (!target) return 0;

  if (target === q) return 100;
  if (target.startsWith(q)) return 90;
  if (target.includes(q)) return 75;

  const qTokens = q.split(/\s+/).filter(Boolean);
  const tTokens = target.split(/\s+/).filter(Boolean);
  let tokenMatches = 0;
  for (const qt of qTokens) {
    if (tTokens.some((tt) => tt.includes(qt))) {
      tokenMatches += 1;
    } else if (qt.length >= 3) {
      // Ordered character subsequence / typo tolerance
      for (const tt of tTokens) {
        let qi = 0;
        for (let ti = 0; ti < tt.length && qi < qt.length; ti++) {
          if (tt[ti] === qt[qi]) qi += 1;
        }
        if (qi >= Math.max(2, qt.length - 1)) {
          tokenMatches += 0.65;
          break;
        }
      }
    }
  }
  if (tokenMatches > 0) {
    return Math.round((tokenMatches / qTokens.length) * 65);
  }
  return 0;
}

interface GlobalSearchModalProps {
  open: boolean;
  initialQuery?: string;
  onClose: () => void;
}

export function GlobalSearchModal({ open, initialQuery = '', onClose }: GlobalSearchModalProps) {
  const { state, currentUser, lang, baseCurrency, convertToBase, setActiveNav, mutate, pushToast } = useAqar();
  const [query, setQuery] = useState(initialQuery);
  const [entityType, setEntityType] = useState<SearchEntityType>('all');
  const [propertyId, setPropertyId] = useState<string>('all');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [minAmount, setMinAmount] = useState<number>(0);

  const [saveOpen, setSaveOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [shareWithTeam, setShareWithTeam] = useState(true);

  React.useEffect(() => {
    if (open && initialQuery) {
      setQuery(initialQuery);
    }
  }, [open, initialQuery]);

  const instantSuggestions = useMemo(() => {
    if (!state) return [];
    const pool = [
      ...state.properties.map((p) => p.nameAr),
      ...state.tenants.slice(0, 6).map((t) => t.nameAr),
      'متأخر',
      'شاغرة',
      'صيانة',
    ];
    const q = normalizeArabicText(query);
    if (!q) return pool.slice(0, 6);
    return pool.filter((item) => fuzzyMatchScore(item, q) > 0).slice(0, 6);
  }, [state, query]);

  const groupedResults = useMemo(() => {
    if (!state) return { total: 0, groups: [] as { type: string; labelAr: string; hits: SearchHit[] }[] };

    const hits: SearchHit[] = [];
    const addHit = (hit: Omit<SearchHit, 'score'>, searchable: string) => {
      if (entityType !== 'all' && hit.entityType !== entityType) return;
      if (propertyId !== 'all' && hit.propertyId !== propertyId) return;
      if (onlyOverdue && !hit.isOverdue) return;
      if (minAmount > 0 && (hit.amount ?? 0) < minAmount) return;

      const score = query.trim() ? fuzzyMatchScore(searchable, query) : 50;
      if (score <= 0) return;
      hits.push({ ...hit, score });
    };

    for (const p of state.properties) {
      addHit(
        {
          id: p.id,
          entityType: 'property',
          typeAr: 'عقار',
          title: p.nameAr,
          subtitle: `${p.code} · ${p.city} · ${p.district}`,
          propertyId: p.id,
          nav: 'properties',
        },
        `${p.nameAr} ${p.nameEn} ${p.code} ${p.district} ${p.city}`
      );
    }

    for (const u of state.units) {
      const prop = state.properties.find((p) => p.id === u.propertyId);
      addHit(
        {
          id: u.id,
          entityType: 'unit',
          typeAr: 'وحدة',
          title: `${u.unitType} ${u.unitNumber}`,
          subtitle: `${prop?.nameAr || ''} · ${u.status}`,
          propertyId: u.propertyId,
          amount: u.suggestedAnnualRent,
          isOverdue: u.status === 'متأخرة في السداد',
          nav: 'properties',
        },
        `${u.unitNumber} ${u.unitType} ${u.status} ${prop?.nameAr || ''}`
      );
    }

    for (const t of state.tenants) {
      const tenantInsts = state.installments.filter(
        (i) => i.tenantId === t.id && (i.status === 'متأخرة' || i.status === 'مستحقة اليوم' || i.status === 'مدفوعة جزئياً') && i.remainingAmount > 0
      );
      const overdueAmt = tenantInsts.reduce((s, i) => s + convertToBase(i.remainingAmount, i.currency || 'SAR'), 0);
      const activeCtr = state.contracts.find((c) => c.tenantId === t.id);
      addHit(
        {
          id: t.id,
          entityType: 'tenant',
          typeAr: 'مستأجر',
          title: t.nameAr,
          subtitle:
            overdueAmt > 0
              ? `${t.phone} · متأخرات: ${formatCurrency(overdueAmt, baseCurrency, lang)}`
              : `${t.nationalIdOrIqama} · ${t.phone}`,
          propertyId: activeCtr?.propertyId,
          amount: overdueAmt,
          isOverdue: tenantInsts.some((i) => i.status === 'متأخرة' || i.remainingAmount > 0),
          nav: 'tenants',
        },
        `${t.nameAr} ${t.nameEn} ${t.phone} ${t.nationalIdOrIqama} ${overdueAmt > 0 ? 'متأخر متأخرين' : ''}`
      );
    }

    for (const c of state.contracts) {
      const prop = state.properties.find((p) => p.id === c.propertyId);
      const ten = state.tenants.find((t) => t.id === c.tenantId);
      addHit(
        {
          id: c.id,
          entityType: 'contract',
          typeAr: 'عقد',
          title: `${c.internalNumber} · ${ten?.nameAr || ''}`,
          subtitle: `${prop?.nameAr || ''} · ${c.lifecycleStatus} · ${formatCurrency(c.annualRent, baseCurrency, lang)}`,
          propertyId: c.propertyId,
          amount: convertToBase(c.annualRent, c.currency || 'SAR'),
          isOverdue: c.lifecycleStatus === 'منتهي',
          nav: 'leasing_finance',
        },
        `${c.internalNumber} ${c.ejarNumber} ${ten?.nameAr || ''} ${prop?.nameAr || ''} ${c.lifecycleStatus}`
      );
    }

    for (const pay of state.payments) {
      const prop = state.properties.find((p) => p.id === pay.propertyId);
      const ten = state.tenants.find((t) => t.id === pay.tenantId);
      const amt = convertToBase(pay.amount, pay.currency || 'SAR');
      addHit(
        {
          id: pay.id,
          entityType: 'payment',
          typeAr: 'إيصال قبض',
          title: `${pay.receiptNumber} · ${ten?.nameAr || ''}`,
          subtitle: `${formatCurrency(amt, baseCurrency, lang)} · ${pay.paymentMethod} · ${prop?.nameAr || ''}`,
          propertyId: pay.propertyId,
          amount: amt,
          nav: 'leasing_finance',
        },
        `${pay.receiptNumber} ${pay.paymentMethod} ${ten?.nameAr || ''} ${prop?.nameAr || ''}`
      );
    }

    for (const exp of state.expenses) {
      const prop = state.properties.find((p) => p.id === exp.propertyId);
      const amt = convertToBase(exp.amount, exp.currency || 'SAR');
      addHit(
        {
          id: exp.id,
          entityType: 'expense',
          typeAr: 'مصروف',
          title: `${exp.expenseNumber} · ${exp.category}`,
          subtitle: `${formatCurrency(amt, baseCurrency, lang)} · ${prop?.nameAr || ''} · ${exp.approvalStatus}`,
          propertyId: exp.propertyId,
          amount: amt,
          nav: 'leasing_finance',
        },
        `${exp.expenseNumber} ${exp.category} ${exp.notes || ''} ${prop?.nameAr || ''}`
      );
    }

    for (const task of state.tasks) {
      addHit(
        {
          id: task.id,
          entityType: 'task',
          typeAr: 'مهمة',
          title: task.title,
          subtitle: `${task.type} · ${task.priority} · ${task.dueDate} · ${task.status}`,
          propertyId: task.propertyId,
          isOverdue: task.priority === 'عاجل',
          nav: 'daily_hub',
        },
        `${task.title} ${task.type} ${task.description} ${task.status}`
      );
    }

    for (const tkt of state.tickets) {
      addHit(
        {
          id: tkt.id,
          entityType: 'ticket',
          typeAr: 'بلاغ صيانة',
          title: `${tkt.ticketNumber} · ${tkt.title}`,
          subtitle: `${tkt.category} · ${tkt.priority} · ${tkt.status}`,
          propertyId: tkt.propertyId,
          amount: tkt.actualCost || tkt.estimatedCost || 0,
          isOverdue: tkt.priority === 'عاجل',
          nav: 'maintenance',
        },
        `${tkt.ticketNumber} ${tkt.title} ${tkt.category} ${tkt.description}`
      );
    }

    for (const doc of state.documents) {
      addHit(
        {
          id: doc.id,
          entityType: 'document',
          typeAr: 'مستند',
          title: doc.title,
          subtitle: `${doc.category} · ${doc.fileName}`,
          nav: 'documents',
        },
        `${doc.title} ${doc.category} ${doc.fileName} ${doc.ocrRawText || ''}`
      );
    }

    hits.sort((a, b) => b.score - a.score);

    const groupMap = new Map<string, { type: string; labelAr: string; hits: SearchHit[] }>();
    for (const h of hits) {
      const g = groupMap.get(h.entityType) || { type: h.entityType, labelAr: h.typeAr, hits: [] };
      g.hits.push(h);
      groupMap.set(h.entityType, g);
    }

    return {
      total: hits.length,
      groups: Array.from(groupMap.values()),
    };
  }, [state, query, entityType, propertyId, onlyOverdue, minAmount, convertToBase, baseCurrency, lang]);

  if (!open || !state) return null;

  const savedFilters = (state.sharedSearchFilters || []).filter(
    (f) => f.isShared || f.createdBy === currentUser?.id
  );

  const applySavedFilter = (f: SharedSearchFilter) => {
    triggerHaptic('light');
    setQuery(f.query);
    setEntityType(f.entityType);
    setPropertyId(f.propertyId);
    setOnlyOverdue(f.onlyOverdue);
    setMinAmount(f.minAmount);
  };

  const applyCompoundPreset = () => {
    triggerHaptic('light');
    setQuery('');
    setEntityType('tenant');
    setPropertyId(state.properties[0]?.id || 'all');
    setOnlyOverdue(true);
    setMinAmount(1000);
  };

  const handleSaveFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filterName.trim()) return;
    const res = await mutate('POST', '/api/search/filters', {
      name: filterName.trim(),
      query,
      entityType,
      propertyId,
      onlyOverdue,
      minAmount,
      isFavorite: true,
      isShared: shareWithTeam,
    });
    if (res) {
      triggerHaptic('success');
      pushToast('success', shareWithTeam ? 'تم حفظ الفلتر ومشاركته مع فريق العمل' : 'تم حفظ الفلتر في المفضلة');
      setFilterName('');
      setSaveOpen(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/75 backdrop-blur-sm p-4 pt-12 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13192B] shadow-2xl overflow-hidden animate-aqar-fade-scale">
        {/* Search Input Header */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center gap-3">
          <Search className="w-5 h-5 text-[#26478D] dark:text-blue-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث موحد ذكي (يدعم التسامح الإملائي): عقار، وحدة، مستأجر، عقد، سند، مهمة، مستند..."
            className="flex-1 bg-transparent text-sm focus:outline-none text-slate-900 dark:text-white"
          />
          <button
            type="button"
            onClick={() => setSaveOpen((v) => !v)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-500" />
            <span>حفظ / مشاركة الفلتر</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instant Suggestions & Compound Preset */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-slate-500 inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#26478D] dark:text-blue-400" />
            <span>اقتراحات فورية:</span>
          </span>
          {instantSuggestions.map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => setQuery(sug)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] hover:border-[#26478D] cursor-pointer"
            >
              {sug}
            </button>
          ))}
          <button
            type="button"
            onClick={applyCompoundPreset}
            className="ms-auto px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold cursor-pointer"
          >
            فلتر مركب سريع: مستأجرين متأخرين + أكثر من 1000 ر.س
          </button>
        </div>

        {/* Compound Filters Strip */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">تصنيف النتيجة</label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as SearchEntityType)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A]"
            >
              {ENTITY_LABELS.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.labelAr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">العقار</label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A]"
            >
              <option value="all">جميع العقارات</option>
              {state.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameAr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">الحد الأدنى للمبلغ (ر.س)</label>
            <input
              type="number"
              min={0}
              value={minAmount || ''}
              onChange={(e) => setMinAmount(Number(e.target.value || 0))}
              placeholder="0"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent font-mono-num"
            />
          </div>
          <div className="flex items-end">
            <label className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2 cursor-pointer">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Filter className="w-3.5 h-3.5 text-amber-500" />
                <span>المتأخرون / العاجل فقط</span>
              </span>
              <input
                type="checkbox"
                checked={onlyOverdue}
                onChange={(e) => setOnlyOverdue(e.target.checked)}
                className="accent-[#26478D]"
              />
            </label>
          </div>
        </div>

        {/* Save / Share Filter Inline Form */}
        {saveOpen && (
          <form
            onSubmit={handleSaveFilter}
            className="p-3.5 border-b border-slate-200 dark:border-white/10 bg-[#26478D]/5 flex flex-wrap items-center gap-2.5 text-xs"
          >
            <input
              required
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="اسم الفلتر المركب (مثال: متأخرات البرج > 1000 ر.س)"
              className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A]"
            />
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={shareWithTeam}
                onChange={(e) => setShareWithTeam(e.target.checked)}
                className="accent-[#26478D]"
              />
              <Share2 className="w-3.5 h-3.5 text-[#26478D] dark:text-blue-400" />
              <span>مشاركة مع فريق العمل</span>
            </label>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#26478D] text-white font-semibold cursor-pointer"
            >
              حفظ الفلتر
            </button>
          </form>
        )}

        {/* Saved & Shared Filters Strip */}
        {savedFilters.length > 0 && (
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-slate-500 font-semibold">الفلاتر المحفوظة والمشتركة:</span>
            {savedFilters.map((f) => (
              <div
                key={f.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03]"
              >
                <button
                  type="button"
                  onClick={() => applySavedFilter(f)}
                  className="font-semibold hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                  <span>{f.name}</span>
                  {f.isShared && <span className="text-slate-400">· مشترك ({f.createdByName})</span>}
                </button>
                <button
                  type="button"
                  onClick={() => mutate('DELETE', `/api/search/filters/${f.id}`)}
                  className="text-red-500 hover:opacity-75 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Unified Grouped Results Sorted by Relevance */}
        <div className="max-h-[420px] overflow-y-auto p-4 space-y-4">
          <div className="text-xs text-slate-500">
            تم العثور على <strong className="font-mono-num text-slate-900 dark:text-white">{groupedResults.total}</strong> نتيجة مرتبة حسب الصلة والتطابق الذكي
          </div>

          {groupedResults.groups.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              لا توجد نتائج مطابقة لشروط البحث والفلترة المركبة.
            </div>
          ) : (
            groupedResults.groups.map((grp) => (
              <div key={grp.type} className="space-y-1.5">
                <div className="text-[11px] font-bold text-[#26478D] dark:text-blue-400 px-1">
                  {grp.labelAr} ({grp.hits.length})
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
                  {grp.hits.slice(0, 8).map((hit) => (
                    <button
                      key={`${hit.entityType}-${hit.id}`}
                      type="button"
                      onClick={() => {
                        setActiveNav(hit.nav);
                        onClose();
                      }}
                      className="w-full px-4 py-2.5 text-start hover:bg-slate-50 dark:hover:bg-white/[0.04] flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{hit.title}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{hit.subtitle}</div>
                      </div>
                      <span className="text-[10px] font-mono-num text-slate-400 shrink-0">صلة {hit.score}%</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
