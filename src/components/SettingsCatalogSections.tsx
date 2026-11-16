import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Download,
  FileSpreadsheet,
  Home,
  Layers,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAqar } from '../context/AqarContext';
import {
  CalendarSettingsConfig,
  CatalogCategoryItem,
  CompanySettings,
  CustomFormFieldConfig,
  DirectoryContactItem,
  FormsCustomizationConfig,
  LiabilityRecordItem,
} from '../types/aqar';
import { exportToCsv, formatDisplayDate, formatSar, localizeDigits } from '../utils/formatters';
import { triggerHaptic } from '../utils/haptics';
import { BottomSheetSelect, GlassToggle, RippleButton } from './SettingsUiPrimitives';

export type CatalogSettingsSectionId =
  | 'contacts'
  | 'calendar'
  | 'forms'
  | 'income_categories'
  | 'expense_categories'
  | 'liabilities_categories'
  | 'payment_methods'
  | 'property_types'
  | 'unit_types';

export const DEFAULT_CALENDAR_CONFIG: CalendarSettingsConfig = {
  calendarType: 'both',
  dateFormat: 'DD/MM/YYYY',
  numerals: 'en',
  weekStart: 'sat',
  holidays: [
    { id: 'hol-1', nameAr: 'يوم التأسيس السعودي', date: '2026-02-22', official: true },
    { id: 'hol-2', nameAr: 'اليوم الوطني السعودي', date: '2026-09-23', official: true },
    { id: 'hol-3', nameAr: 'إجازة عيد الفطر المبارك', date: '2026-03-20', official: true },
    { id: 'hol-4', nameAr: 'إجازة عيد الأضحى المبارك', date: '2026-05-27', official: true },
  ],
  disableWorkOnHolidays: false,
  workStart: '08:00',
  workEnd: '17:00',
  workDays: ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
  ramadanMode: false,
  ramadanWorkStart: '10:00',
  ramadanWorkEnd: '16:00',
  rentAlertDays: [7, 3, 1],
  contractAlertDays: [60, 30, 7],
};

export const DEFAULT_FORMS_CONFIG: FormsCustomizationConfig = {
  tenantForm: [
    { id: 'tf-1', key: 'nameAr', labelAr: 'الاسم الكامل بالعربية', labelEn: 'Full Name (AR)', type: 'text', visible: true, required: true },
    { id: 'tf-2', key: 'nationalIdOrIqama', labelAr: 'رقم الهوية / الإقامة', labelEn: 'National ID', type: 'text', visible: true, required: true },
    { id: 'tf-3', key: 'phone', labelAr: 'رقم الجوال', labelEn: 'Mobile Phone', type: 'text', visible: true, required: true },
    { id: 'tf-4', key: 'email', labelAr: 'البريد الإلكتروني', labelEn: 'Email', type: 'text', visible: true, required: false },
    { id: 'tf-5', key: 'employer', labelAr: 'جهة العمل', labelEn: 'Employer', type: 'text', visible: true, required: false },
    { id: 'tf-6', key: 'emergencyContactPhone', labelAr: 'جوال الطوارئ', labelEn: 'Emergency Phone', type: 'text', visible: true, required: false },
  ],
  expenseForm: [
    { id: 'ef-1', key: 'category', labelAr: 'فئة المصروف', labelEn: 'Category', type: 'select', visible: true, required: true },
    { id: 'ef-2', key: 'amount', labelAr: 'المبلغ شامل الضريبة', labelEn: 'Amount', type: 'number', visible: true, required: true },
    { id: 'ef-3', key: 'invoiceNumber', labelAr: 'رقم الفاتورة الضريبية', labelEn: 'Invoice No.', type: 'text', visible: true, required: true },
    { id: 'ef-4', key: 'vendorId', labelAr: 'المورد / المقاول', labelEn: 'Vendor', type: 'select', visible: true, required: false },
  ],
  ticketForm: [
    { id: 'tk-1', key: 'category', labelAr: 'نوع العطل', labelEn: 'Issue Type', type: 'select', visible: true, required: true },
    { id: 'tk-2', key: 'priority', labelAr: 'الأولوية', labelEn: 'Priority', type: 'select', visible: true, required: true },
    { id: 'tk-3', key: 'estimatedCost', labelAr: 'التكلفة التقديرية', labelEn: 'Estimated Cost', type: 'number', visible: true, required: false },
  ],
  handoverChecklist: [
    { id: 'hc-1', labelAr: 'سلامة التكييف والسباكة', visible: true, required: true },
    { id: 'hc-2', labelAr: 'الأبواب والأقفال والمفاتيح', visible: true, required: true },
    { id: 'hc-3', labelAr: 'قراءة عداد الكهرباء والمياه', visible: true, required: true },
    { id: 'hc-4', labelAr: 'الدهانات والأرضيات والمطبخ', visible: true, required: false },
  ],
  customForms: [
    { id: 'cf-1', titleAr: 'نموذج إقرار استلام المواقف', linkedModule: 'الوحدات', fieldsCount: 4, active: true },
  ],
};

export const DEFAULT_INCOME_CATEGORIES: CatalogCategoryItem[] = [
  { id: 'inc-1', nameAr: 'إيجارات سكنية', nameEn: 'Residential Rent', color: '#10b981', accountCode: '4010', vatTaxable: false, active: true },
  { id: 'inc-2', nameAr: 'إيجارات تجارية', nameEn: 'Commercial Rent', color: '#26478D', accountCode: '4020', vatTaxable: true, active: true },
  { id: 'inc-3', nameAr: 'إيجارات صناعية', nameEn: 'Industrial Rent', color: '#6366f1', accountCode: '4030', vatTaxable: true, active: true },
  { id: 'inc-4', nameAr: 'إيرادات مواقف', nameEn: 'Parking Revenue', color: '#0ea5e9', accountCode: '4040', vatTaxable: true, active: true },
  { id: 'inc-5', nameAr: 'إيرادات إعلانات', nameEn: 'Advertising Income', color: '#f59e0b', accountCode: '4050', vatTaxable: true, active: true },
  { id: 'inc-6', nameAr: 'إيرادات خدمات', nameEn: 'Service Charges', color: '#14b8a6', accountCode: '4060', vatTaxable: true, active: true },
  { id: 'inc-7', nameAr: 'عمولات سعي', nameEn: 'Brokerage Fees', color: '#8b5cf6', accountCode: '4070', vatTaxable: true, active: true },
  { id: 'inc-8', nameAr: 'رسوم إدارية', nameEn: 'Admin Fees', color: '#ec4899', accountCode: '4080', vatTaxable: true, active: true },
  { id: 'inc-9', nameAr: 'إيرادات أخرى', nameEn: 'Other Income', color: '#64748b', accountCode: '4090', vatTaxable: false, active: true },
];

export const DEFAULT_EXPENSE_CATEGORIES: CatalogCategoryItem[] = [
  { id: 'exp-1', nameAr: 'مصروفات الصيانة', nameEn: 'Maintenance', color: '#ef4444', accountCode: '5010', active: true, subCategories: ['تكييف', 'سباكة', 'كهرباء', 'دهانات', 'نجارة', 'تنظيف'] },
  { id: 'exp-2', nameAr: 'مصروفات التشغيل', nameEn: 'Operations', color: '#f59e0b', accountCode: '5020', active: true, subCategories: ['كهرباء', 'مياه', 'بلدية', 'نظافة', 'تأمين'] },
  { id: 'exp-3', nameAr: 'مصروفات إدارية', nameEn: 'Administrative', color: '#3b82f6', accountCode: '5030', active: true, subCategories: ['رواتب', 'قرطاسية', 'اتصالات', 'نقل', 'ضيافة'] },
  { id: 'exp-4', nameAr: 'مصروفات رأس مالية', nameEn: 'Capital Expenditure', color: '#8b5cf6', accountCode: '5040', active: true, subCategories: ['تجهيز وحدات', 'أجهزة تكييف', 'مصاعد'] },
  { id: 'exp-5', nameAr: 'مصروفات تأجير وتسويق', nameEn: 'Marketing & Leasing', color: '#ec4899', accountCode: '5050', active: true, subCategories: ['إعلانات منصات', 'لوحات', 'توثيق إيجار'] },
  { id: 'exp-6', nameAr: 'مصروفات حكومية وضريبية', nameEn: 'Government & Tax', color: '#14b8a6', accountCode: '5060', active: true, subCategories: ['زكاة وضريبة', 'رسوم بلدية', 'دفاع مدني'] },
  { id: 'exp-7', nameAr: 'مصروفات طوارئ', nameEn: 'Emergency', color: '#dc2626', accountCode: '5070', active: true, subCategories: ['تسرب مياه', 'انقطاع كهرباء'] },
  { id: 'exp-8', nameAr: 'مصروفات أخرى', nameEn: 'Other Expenses', color: '#64748b', accountCode: '5090', active: true, subCategories: ['متنوعة'] },
];

export const DEFAULT_LIABILITY_CATEGORIES: CatalogCategoryItem[] = [
  { id: 'lia-1', nameAr: 'قروض بنكية', nameEn: 'Bank Loans', color: '#ef4444', accountCode: '2110', termType: 'طويل الأمد', active: true },
  { id: 'lia-2', nameAr: 'تمويل إسلامي', nameEn: 'Islamic Financing', color: '#10b981', accountCode: '2120', termType: 'طويل الأمد', active: true },
  { id: 'lia-3', nameAr: 'فواتير آجلة للموردين', nameEn: 'Accounts Payable', color: '#f59e0b', accountCode: '2010', termType: 'قصير الأمد', active: true },
  { id: 'lia-4', nameAr: 'رواتب مستحقة', nameEn: 'Accrued Payroll', color: '#3b82f6', accountCode: '2020', termType: 'قصير الأمد', active: true },
  { id: 'lia-5', nameAr: 'ضرائب مستحقة (VAT)', nameEn: 'VAT Payable', color: '#8b5cf6', accountCode: '2030', termType: 'قصير الأمد', active: true },
  { id: 'lia-6', nameAr: 'سندات دفع', nameEn: 'Notes Payable', color: '#0ea5e9', accountCode: '2040', termType: 'قصير الأمد', active: true },
  { id: 'lia-7', nameAr: 'التزامات أخرى', nameEn: 'Other Liabilities', color: '#64748b', accountCode: '2090', termType: 'قصير الأمد', active: true },
];

export const DEFAULT_PAYMENT_METHODS: CatalogCategoryItem[] = [
  { id: 'pm-1', nameAr: 'نقدي', nameEn: 'Cash', color: '#10b981', feePercent: 0, minAmount: 1, maxAmount: 50000, active: true },
  { id: 'pm-2', nameAr: 'تحويل بنكي', nameEn: 'Bank Transfer', color: '#26478D', linkedBankName: 'مصرف الراجحي', linkedIban: 'SA4480000000608010167519', feePercent: 0, active: true },
  { id: 'pm-3', nameAr: 'شيك', nameEn: 'Check', color: '#6366f1', feePercent: 0, active: true },
  { id: 'pm-4', nameAr: 'منصة إيجار / سداد إلكتروني', nameEn: 'Ejar Platform', color: '#0ea5e9', feePercent: 0, active: true },
  { id: 'pm-5', nameAr: 'محافظ إلكترونية (STC Pay / Apple Pay)', nameEn: 'Digital Wallets', color: '#8b5cf6', feePercent: 1.5, active: true },
  { id: 'pm-6', nameAr: 'شبكة مدى', nameEn: 'Mada POS', color: '#14b8a6', feePercent: 0.8, active: true },
  { id: 'pm-7', nameAr: 'آجل', nameEn: 'Credit', color: '#f59e0b', feePercent: 0, active: true },
];

export const DEFAULT_PROPERTY_TYPES: CatalogCategoryItem[] = [
  { id: 'pt-1', nameAr: 'عمارة سكنية', nameEn: 'Residential Building', defaultUsage: 'سكني', minUnits: 3, defaultVatPercent: 0, active: true },
  { id: 'pt-2', nameAr: 'مجمع تجاري', nameEn: 'Commercial Complex', defaultUsage: 'تجاري', minUnits: 2, defaultVatPercent: 15, active: true },
  { id: 'pt-3', nameAr: 'مبنى صناعي', nameEn: 'Industrial Facility', defaultUsage: 'تجاري', minUnits: 1, defaultVatPercent: 15, active: true },
  { id: 'pt-4', nameAr: 'فيلا', nameEn: 'Villa', defaultUsage: 'سكني', minUnits: 1, defaultVatPercent: 0, active: true },
  { id: 'pt-5', nameAr: 'منزل', nameEn: 'House', defaultUsage: 'سكني', minUnits: 1, defaultVatPercent: 0, active: true },
  { id: 'pt-6', nameAr: 'أرض', nameEn: 'Land', defaultUsage: 'مختلط', minUnits: 1, defaultVatPercent: 15, active: true },
  { id: 'pt-7', nameAr: 'موقف سيارات', nameEn: 'Parking Lot', defaultUsage: 'تجاري', minUnits: 1, defaultVatPercent: 15, active: true },
  { id: 'pt-8', nameAr: 'محل تجاري', nameEn: 'Retail Shop', defaultUsage: 'تجاري', minUnits: 1, defaultVatPercent: 15, active: true },
  { id: 'pt-9', nameAr: 'فندق / شقق مفروشة', nameEn: 'Furnished Apartments', defaultUsage: 'سكني', minUnits: 4, defaultVatPercent: 15, active: true },
  { id: 'pt-10', nameAr: 'مخزن', nameEn: 'Warehouse', defaultUsage: 'تجاري', minUnits: 1, defaultVatPercent: 15, active: true },
  { id: 'pt-11', nameAr: 'أخرى', nameEn: 'Other', defaultUsage: 'مختلط', minUnits: 1, defaultVatPercent: 0, active: true },
];

export const DEFAULT_UNIT_TYPES: CatalogCategoryItem[] = [
  { id: 'ut-1', nameAr: 'شقة', nameEn: 'Apartment', minArea: 60, maxArea: 320, defaultRooms: 3, defaultBathrooms: 2, defaultAmenities: ['مطبخ', 'تكييف سبليت'], defaultRentCycle: 'سنوي', active: true },
  { id: 'ut-2', nameAr: 'مكتب', nameEn: 'Office', minArea: 30, maxArea: 500, defaultRooms: 2, defaultBathrooms: 1, defaultAmenities: ['تكييف مركزي'], defaultRentCycle: 'سنوي', active: true },
  { id: 'ut-3', nameAr: 'معرض تجاري / محل', nameEn: 'Commercial Shop', minArea: 25, maxArea: 400, defaultRooms: 1, defaultBathrooms: 1, defaultAmenities: ['واجهة زجاجية'], defaultRentCycle: 'سنوي', active: true },
  { id: 'ut-4', nameAr: 'غرفة (سكن عمالي)', nameEn: 'Staff Room', minArea: 14, maxArea: 35, defaultRooms: 1, defaultBathrooms: 1, defaultAmenities: ['تكييف شباك'], defaultRentCycle: 'شهري', active: true },
  { id: 'ut-5', nameAr: 'موقف', nameEn: 'Parking Slot', minArea: 12, maxArea: 25, defaultRooms: 0, defaultBathrooms: 0, defaultAmenities: ['مظلل'], defaultRentCycle: 'شهري', active: true },
  { id: 'ut-6', nameAr: 'مخزن', nameEn: 'Storage Unit', minArea: 20, maxArea: 600, defaultRooms: 1, defaultBathrooms: 0, defaultAmenities: ['تهوية'], defaultRentCycle: 'سنوي', active: true },
  { id: 'ut-7', nameAr: 'جناح فندقي / استوديو', nameEn: 'Hotel Suite / Studio', minArea: 28, maxArea: 75, defaultRooms: 1, defaultBathrooms: 1, defaultAmenities: ['مفروش', 'مطبخ صغير'], defaultRentCycle: 'شهري', active: true },
  { id: 'ut-8', nameAr: 'دور كامل', nameEn: 'Full Floor', minArea: 180, maxArea: 700, defaultRooms: 5, defaultBathrooms: 4, defaultAmenities: ['مطبخ', 'مجلس', 'تكييف'], defaultRentCycle: 'سنوي', active: true },
  { id: 'ut-9', nameAr: 'أخرى', nameEn: 'Other', minArea: 10, maxArea: 1000, defaultRooms: 1, defaultBathrooms: 1, defaultAmenities: [], defaultRentCycle: 'سنوي', active: true },
];

interface Props {
  section: CatalogSettingsSectionId;
  draft: CompanySettings;
  setDraft: React.Dispatch<React.SetStateAction<CompanySettings>>;
  savePartialSettings: (patch: Partial<CompanySettings>, msg: string) => Promise<void>;
  SectionSubHeader: React.FC<{ onSave?: () => void; saveLabel?: string }>;
}

export function SettingsCatalogSections({
  section,
  draft,
  setDraft,
  savePartialSettings,
  SectionSubHeader,
}: Props) {
  const { state, lang, pushToast } = useAqar();
  const isAr = lang === 'ar';

  // Contacts Directory state
  const [contactSearch, setContactSearch] = useState('');
  const [contactCatFilter, setContactCatFilter] = useState<'all' | DirectoryContactItem['category']>('all');
  const [newContactModal, setNewContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', email: '', category: 'مستأجر' as DirectoryContactItem['category'], company: '' });
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [importSource, setImportSource] = useState<'phone' | 'csv' | 'ejar' | 'manual'>('manual');
  const [manualPasteText, setManualPasteText] = useState('خالد بن سعود,0551122334,مستأجر\nمؤسسة الصيانة الحديثة,0509988776,مورد');
  const [parsedImportRows, setParsedImportRows] = useState<{ name: string; phone: string; category: DirectoryContactItem['category']; duplicate: boolean }[]>([]);

  // Calendar state
  const [newHoliday, setNewHoliday] = useState({ nameAr: '', date: '2026-12-01' });

  // Forms customization state
  const [activeFormKey, setActiveFormKey] = useState<'tenantForm' | 'expenseForm' | 'ticketForm'>('tenantForm');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomFormFieldConfig['type']>('text');
  const [newCustomFormTitle, setNewCustomFormTitle] = useState('');

  // Generic catalog item add/edit state
  const [newCatModal, setNewCatModal] = useState(false);
  const [catDraft, setCatDraft] = useState<{
    nameAr: string;
    nameEn: string;
    description: string;
    color: string;
    accountCode: string;
    vatTaxable: boolean;
    subCatText: string;
    linkedBankName: string;
    linkedIban: string;
    feePercent: number;
    minArea: number;
    maxArea: number;
    defaultRooms: number;
    minUnits: number;
  }>({
    nameAr: '',
    nameEn: '',
    description: '',
    color: '#26478D',
    accountCode: '',
    vatTaxable: true,
    subCatText: '',
    linkedBankName: '',
    linkedIban: '',
    feePercent: 0,
    minArea: 50,
    maxArea: 250,
    defaultRooms: 2,
    minUnits: 1,
  });

  // Liabilities record modal
  const [newLiabilityOpen, setNewLiabilityOpen] = useState(false);
  const [liaForm, setLiaForm] = useState({
    titleAr: '',
    categoryId: 'lia-1',
    creditor: '',
    termType: 'طويل الأمد' as LiabilityRecordItem['termType'],
    interestPercent: 0,
    totalAmount: 50000,
    dueDate: '2027-01-15',
  });

  const baseContacts: DirectoryContactItem[] = useMemo(() => {
    if (!state) return [];
    const stored = draft.contactsDirectory ?? state.settings.contactsDirectory;
    if (stored && stored.length > 0) return stored;
    const seeded: DirectoryContactItem[] = [
      ...state.tenants.map((t) => ({
        id: `cnt-t-${t.id}`,
        name: t.nameAr,
        phone: t.phone,
        email: t.email,
        category: 'مستأجر' as const,
        company: t.employer,
        source: 'system' as const,
        createdAt: t.createdAt,
      })),
      ...state.vendors.map((v) => ({
        id: `cnt-v-${v.id}`,
        name: v.nameAr,
        phone: v.phone,
        email: v.email,
        category: 'مورد' as const,
        company: v.category,
        source: 'system' as const,
        createdAt: '2026-01-01',
      })),
      ...state.owners.map((o) => ({
        id: `cnt-o-${o.id}`,
        name: o.nameAr,
        phone: o.phone,
        email: o.email,
        category: 'مالك' as const,
        source: 'system' as const,
        createdAt: '2026-01-01',
      })),
    ];
    return seeded;
  }, [draft.contactsDirectory, state]);

  if (!state) return null;

  const calendarCfg: CalendarSettingsConfig = draft.calendarConfig || state.settings.calendarConfig || DEFAULT_CALENDAR_CONFIG;
  const formsCfg: FormsCustomizationConfig = draft.formsConfig || state.settings.formsConfig || DEFAULT_FORMS_CONFIG;

  const getCatalogList = (key: keyof Pick<CompanySettings, 'incomeCategories' | 'expenseCategories' | 'liabilityCategories' | 'paymentMethodsConfig' | 'propertyTypesConfig' | 'unitTypesConfig'>, fallback: CatalogCategoryItem[]) => {
    return (draft[key] as CatalogCategoryItem[] | undefined) || (state.settings[key] as CatalogCategoryItem[] | undefined) || fallback;
  };

  const updateCatalogList = (
    key: keyof Pick<CompanySettings, 'incomeCategories' | 'expenseCategories' | 'liabilityCategories' | 'paymentMethodsConfig' | 'propertyTypesConfig' | 'unitTypesConfig'>,
    list: CatalogCategoryItem[]
  ) => {
    setDraft((prev) => ({ ...prev, [key]: list }));
  };

  const moveCatalogItem = (
    key: keyof Pick<CompanySettings, 'incomeCategories' | 'expenseCategories' | 'liabilityCategories' | 'paymentMethodsConfig' | 'propertyTypesConfig' | 'unitTypesConfig'>,
    list: CatalogCategoryItem[],
    index: number,
    dir: -1 | 1
  ) => {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    triggerHaptic('light');
    const copy = [...list];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    updateCatalogList(key, copy);
  };

  const handleParseContactsWizard = () => {
    const existingPhones = new Set(baseContacts.map((c) => c.phone.replace(/\D/g, '')));
    const lines = manualPasteText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed = lines.map((line) => {
      const [name, phone, cat] = line.split(/[,\t;]+/).map((s) => s?.trim() || '');
      const cleanPhone = phone.replace(/\D/g, '');
      return {
        name: name || 'جهة اتصال',
        phone: phone || '0500000000',
        category: (cat === 'مورد' || cat === 'مالك' || cat === 'أخرى' ? cat : 'مستأجر') as DirectoryContactItem['category'],
        duplicate: cleanPhone.length > 0 && existingPhones.has(cleanPhone),
      };
    });
    setParsedImportRows(parsed);
    setImportStep(3);
  };

  const handleImportFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
      const existingPhones = new Set(baseContacts.map((c) => c.phone.replace(/\D/g, '')));
      const parsed = rows.map((r) => {
        const name = String(r['الاسم'] || r['name'] || r['Name'] || 'جهة اتصال');
        const phone = String(r['الجوال'] || r['phone'] || r['Phone'] || '');
        const clean = phone.replace(/\D/g, '');
        return {
          name,
          phone,
          category: 'مستأجر' as const,
          duplicate: clean.length > 0 && existingPhones.has(clean),
        };
      });
      setParsedImportRows(parsed);
      setImportStep(3);
    } catch {
      pushToast('error', 'تعذر قراءة الملف');
    }
  };

  const handleConfirmContactsImport = async () => {
    const nonDups = parsedImportRows.filter((r) => !r.duplicate);
    const created: DirectoryContactItem[] = nonDups.map((r, i) => ({
      id: `cnt-imp-${Date.now()}-${i}`,
      name: r.name,
      phone: r.phone,
      category: r.category,
      source: importSource,
      createdAt: new Date().toISOString().slice(0, 10),
    }));
    const nextList = [...created, ...baseContacts];
    setDraft((prev) => ({ ...prev, contactsDirectory: nextList }));
    await savePartialSettings({ contactsDirectory: nextList }, `تم استيراد ${created.length} جهة اتصال جديدة بنجاح`);
    setImportWizardOpen(false);
    setImportStep(1);
  };

  /* -------------------- SECTION 3: CONTACTS DIRECTORY -------------------- */
  if (section === 'contacts') {
    const filteredContacts = baseContacts.filter((c) => {
      if (c.archived) return false;
      if (contactCatFilter !== 'all' && c.category !== contactCatFilter) return false;
      if (contactSearch.trim()) {
        const q = contactSearch.trim().toLowerCase();
        return c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.email || '').toLowerCase().includes(q);
      }
      return true;
    });

    return (
      <>
        <SectionSubHeader
          onSave={() =>
            savePartialSettings(
              { contactsDirectory: baseContacts, contactsAutoSync: draft.contactsAutoSync },
              isAr ? 'تم حفظ دفتر جهات الاتصال' : 'Contacts saved'
            )
          }
        />

        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
                <input
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="بحث بالاسم أو الجوال أو البريد..."
                  className="w-full ps-9 pe-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent text-xs"
                />
              </div>
              <select
                value={contactCatFilter}
                onChange={(e) => setContactCatFilter(e.target.value as typeof contactCatFilter)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A] text-xs"
              >
                <option value="all">كل التصنيفات ({baseContacts.filter((c) => !c.archived).length})</option>
                <option value="مستأجر">مستأجرين</option>
                <option value="مورد">موردين</option>
                <option value="مالك">مالكين</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <RippleButton variant="secondary" className="!py-2 !px-3" onClick={() => setImportWizardOpen(true)}>
                <Upload className="w-3.5 h-3.5" />
                <span>معالج الاستيراد (5 خطوات)</span>
              </RippleButton>
              <RippleButton
                variant="secondary"
                className="!py-2 !px-3"
                onClick={() => {
                  exportToCsv(
                    'aqarplus-contacts.csv',
                    ['الاسم', 'الجوال', 'البريد', 'التصنيف', 'المصدر'],
                    filteredContacts.map((c) => [c.name, c.phone, c.email || '', c.category, c.source])
                  );
                  pushToast('success', 'تم تصدير دفتر جهات الاتصال (CSV/Excel)');
                }}
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير Excel/CSV</span>
              </RippleButton>
              <RippleButton className="!py-2 !px-3" onClick={() => setNewContactModal(true)}>
                <UserPlus className="w-3.5 h-3.5" />
                <span>إضافة جهة اتصال</span>
              </RippleButton>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface">
            <GlassToggle
              checked={Boolean(draft.contactsAutoSync ?? state.settings.contactsAutoSync)}
              onChange={(next) => setDraft((prev) => ({ ...prev, contactsAutoSync: next }))}
              label="تفعيل المزامنة التلقائية مع جهات اتصال جهاز الموظف"
              description="تحديث أرقام المستأجرين والموردين الجدد تلقائياً"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredContacts.map((c) => (
              <div key={c.id} className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface flex items-start justify-between gap-2 text-xs">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold truncate">{c.name}</span>
                    <span className="px-2 py-0.5 rounded-lg bg-[#26478D]/15 text-[#26478D] dark:text-blue-300 text-[10px] font-semibold">
                      {c.category}
                    </span>
                  </div>
                  <div className="font-mono-num text-slate-600 dark:text-slate-300">{c.phone}</div>
                  {c.email && <div className="text-[11px] text-slate-400 truncate">{c.email}</div>}
                </div>
                <button
                  type="button"
                  title="نقل للأرشيف"
                  onClick={() => {
                    const next = baseContacts.map((x) => (x.id === c.id ? { ...x, archived: true } : x));
                    setDraft((prev) => ({ ...prev, contactsDirectory: next }));
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Add Contact Modal */}
        {newContactModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const item: DirectoryContactItem = {
                  id: `cnt-${Date.now()}`,
                  name: contactForm.name,
                  phone: contactForm.phone,
                  email: contactForm.email,
                  category: contactForm.category,
                  company: contactForm.company,
                  source: 'manual',
                  createdAt: new Date().toISOString().slice(0, 10),
                };
                setDraft((prev) => ({ ...prev, contactsDirectory: [item, ...baseContacts] }));
                setNewContactModal(false);
                setContactForm({ name: '', phone: '', email: '', category: 'مستأجر', company: '' });
              }}
              className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13192B] p-6 space-y-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">إضافة جهة اتصال</h3>
                <button type="button" onClick={() => setNewContactModal(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <input required placeholder="الاسم" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent" />
              <input required placeholder="رقم الجوال" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent font-mono-num" />
              <input placeholder="البريد الإلكتروني" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent" />
              <select value={contactForm.category} onChange={(e) => setContactForm({ ...contactForm, category: e.target.value as DirectoryContactItem['category'] })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A]">
                <option value="مستأجر">مستأجر</option>
                <option value="مورد">مورد</option>
                <option value="مالك">مالك</option>
                <option value="أخرى">أخرى</option>
              </select>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setNewContactModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 cursor-pointer">إلغاء</button>
                <RippleButton type="submit">حفظ</RippleButton>
              </div>
            </form>
          </div>
        )}

        {/* 5-Step Contacts Import Wizard */}
        {importWizardOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13192B] p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-blue-500 font-semibold">معالج استيراد جهات الاتصال · الخطوة {importStep} من 5</div>
                  <h3 className="text-sm font-bold mt-0.5">استيراد ذكي مع كشف التكرار</h3>
                </div>
                <button type="button" onClick={() => setImportWizardOpen(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
              </div>

              {importStep === 1 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ['manual', 'نسخ يدوي / قائمة نصية'],
                        ['csv', 'ملف CSV / Excel'],
                        ['phone', 'جهات اتصال الهاتف'],
                        ['ejar', 'منصة إيجار'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setImportSource(id)}
                        className={`p-3 rounded-xl border text-start cursor-pointer ${
                          importSource === id ? 'border-[#26478D] bg-[#26478D]/10 font-bold' : 'border-slate-200 dark:border-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <RippleButton onClick={() => setImportStep(2)}>التالي: مطابقة الحقول</RippleButton>
                  </div>
                </div>
              )}

              {importStep === 2 && (
                <div className="space-y-3">
                  {importSource === 'csv' ? (
                    <label className="block p-6 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/20 text-center cursor-pointer">
                      <FileSpreadsheet className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                      <span>اختر ملف .xlsx أو .csv (الأعمدة: الاسم، الجوال)</span>
                      <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFileUpload} className="hidden" />
                    </label>
                  ) : (
                    <>
                      <label className="text-[11px] text-slate-500 block">الصق القائمة بصيغة: الاسم,الجوال,التصنيف</label>
                      <textarea rows={4} value={manualPasteText} onChange={(e) => setManualPasteText(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent font-mono-num" />
                      <div className="flex justify-between">
                        <button type="button" onClick={() => setImportStep(1)} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 cursor-pointer">السابق</button>
                        <RippleButton onClick={handleParseContactsWizard}>معاينة وكشف التكرار</RippleButton>
                      </div>
                    </>
                  )}
                </div>
              )}

              {importStep >= 3 && (
                <div className="space-y-3">
                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-white/10 border border-slate-200 dark:border-white/10 rounded-xl">
                    {parsedImportRows.map((row, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-bold">{row.name}</div>
                          <div className="font-mono-num text-slate-500">{row.phone} · {row.category}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.duplicate ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                          {row.duplicate ? 'مكرر (سيتم تخطيه)' : 'جديد ✓'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between">
                    <button type="button" onClick={() => setImportStep(2)} className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 cursor-pointer">رجوع</button>
                    <RippleButton onClick={handleConfirmContactsImport}>
                      تأكيد واستيراد ({parsedImportRows.filter((r) => !r.duplicate).length})
                    </RippleButton>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  /* -------------------- SECTION 4: CALENDAR SETTINGS -------------------- */
  if (section === 'calendar') {
    const syncCalendarPayload = (nextCal: CalendarSettingsConfig) => ({
      calendarConfig: nextCal,
      dateCalendar: (nextCal.calendarType === 'gregorian' ? 'ميلادي فقط' : 'هجري وميلادي') as CompanySettings['dateCalendar'],
      generalPrefs: {
        ...(draft.generalPrefs || state.settings.generalPrefs || {
          language: lang,
          rtlAuto: true,
          currency: 'SAR' as const,
          calendar: nextCal.calendarType,
          dateFormat: nextCal.dateFormat,
          numeralFormat: nextCal.numerals,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Riyadh',
          themeMode: 'dark' as const,
        }),
        calendar: nextCal.calendarType,
        dateFormat: nextCal.dateFormat,
        numeralFormat: nextCal.numerals,
      },
    });

    const updateCal = (patch: Partial<CalendarSettingsConfig>, autoApply = false) => {
      const nextCal = { ...calendarCfg, ...patch };
      const payload = syncCalendarPayload(nextCal);
      setDraft((prev) => ({ ...prev, ...payload }));
      if (autoApply) {
        savePartialSettings(payload, 'تم تطبيق إعدادات التقويم والتنسيق');
      }
    };

    const previewNow = new Date().toISOString();
    const previewDate = formatDisplayDate(previewNow, lang, {
      calendarType: calendarCfg.calendarType,
      dateFormat: calendarCfg.dateFormat,
      numerals: calendarCfg.numerals,
      verboseHijri: true,
    });
    const previewNumber = localizeDigits('12,450.00', calendarCfg.numerals);

    return (
      <>
        <SectionSubHeader
          onSave={() =>
            savePartialSettings(
              syncCalendarPayload(calendarCfg),
              'تم حفظ إعدادات التقويم والعطلات وساعات العمل'
            )
          }
        />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 p-5 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-4">
            <h3 className="text-sm font-bold">إعدادات التقويم والتنسيق</h3>
            <BottomSheetSelect
              label="نوع التقويم"
              value={calendarCfg.calendarType}
              options={[
                { value: 'gregorian', label: 'ميلادي فقط' },
                { value: 'hijri', label: 'هجري فقط' },
                { value: 'both', label: 'عرض الاثنين معاً (هجري وميلادي)' },
              ]}
              onChange={(v) => updateCal({ calendarType: v }, true)}
            />
            <BottomSheetSelect
              label="تنسيق التاريخ"
              value={calendarCfg.dateFormat}
              options={[
                { value: 'DD/MM/YYYY', label: 'يوم/شهر/سنة (DD/MM/YYYY)' },
                { value: 'YYYY-MM-DD', label: 'سنة-شهر-يوم (YYYY-MM-DD)' },
              ]}
              onChange={(v) => updateCal({ dateFormat: v }, true)}
            />
            <div className="grid grid-cols-2 gap-3">
              <BottomSheetSelect
                label="أرقام الأيام"
                value={calendarCfg.numerals}
                options={[
                  { value: 'en', label: 'إنجليزية (123)' },
                  { value: 'ar', label: 'عربية (١٢٣)' },
                ]}
                onChange={(v) => updateCal({ numerals: v }, true)}
              />
              <BottomSheetSelect
                label="بداية الأسبوع"
                value={calendarCfg.weekStart}
                options={[
                  { value: 'sat', label: 'السبت (افتراضي)' },
                  { value: 'sun', label: 'الأحد' },
                  { value: 'mon', label: 'الإثنين' },
                ]}
                onChange={(v) => updateCal({ weekStart: v }, true)}
              />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 space-y-1.5 text-xs">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                معاينة التنسيق المطبق الآن في النظام:
              </div>
              <div className="font-mono-num font-bold text-[#26478D] dark:text-blue-400">
                {previewDate}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
                نموذج المبالغ والأرقام: {previewNumber} ر.س
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/70 dark:border-white/10 space-y-3">
              <h4 className="text-xs font-bold">ساعات العمل الرسمية واستثناءات رمضان</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">بداية الدوام</label>
                  <input type="time" value={calendarCfg.workStart} onChange={(e) => updateCal({ workStart: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent font-mono-num" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">نهاية الدوام</label>
                  <input type="time" value={calendarCfg.workEnd} onChange={(e) => updateCal({ workEnd: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent font-mono-num" />
                </div>
              </div>
              <GlassToggle
                checked={calendarCfg.ramadanMode}
                onChange={(next) => updateCal({ ramadanMode: next })}
                label="تفعيل جدول ساعات العمل في شهر رمضان"
              />
              <GlassToggle
                checked={calendarCfg.disableWorkOnHolidays}
                onChange={(next) => updateCal({ disableWorkOnHolidays: next })}
                label="تعطيل جدولة التنبيهات التلقائية في العطلات الرسمية"
              />
            </div>
          </div>

          <div className="lg:col-span-6 p-5 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-4">
            <h3 className="text-sm font-bold">العطلات الرسمية والمخصصة + التنبيهات الزمنية</h3>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {calendarCfg.holidays.map((h) => (
                <div key={h.id} className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold">{h.nameAr}</div>
                    <div className="font-mono-num text-[11px] text-slate-500">{h.date} · {h.official ? 'رسمية' : 'مخصصة'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateCal({ holidays: calendarCfg.holidays.filter((x) => x.id !== h.id) })}
                    className="p-1 text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <input
                placeholder="اسم العطلة المخصصة"
                value={newHoliday.nameAr}
                onChange={(e) => setNewHoliday({ ...newHoliday, nameAr: e.target.value })}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent"
              />
              <input
                type="date"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent font-mono-num"
              />
              <RippleButton
                className="!py-2"
                onClick={() => {
                  if (!newHoliday.nameAr.trim()) return;
                  updateCal({
                    holidays: [...calendarCfg.holidays, { id: `hol-${Date.now()}`, nameAr: newHoliday.nameAr.trim(), date: newHoliday.date, official: false }],
                  });
                  setNewHoliday({ nameAr: '', date: '2026-12-01' });
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة عطلة</span>
              </RippleButton>
            </div>

            <div className="pt-2 border-t border-slate-200/70 dark:border-white/10 space-y-2 text-xs">
              <div className="font-bold">نوافذ التذكير الزمنية المعتمدة</div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300 font-semibold">
                  استحقاق الإيجار: قبل {calendarCfg.rentAlertDays.join(' / ')} أيام
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-300 font-semibold">
                  انتهاء العقود: قبل {calendarCfg.contractAlertDays.join(' / ')} يوم
                </span>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* -------------------- SECTION 5: FORMS CUSTOMIZATION -------------------- */
  if (section === 'forms') {
    const updateForms = (patch: Partial<FormsCustomizationConfig>) => {
      setDraft((prev) => ({ ...prev, formsConfig: { ...formsCfg, ...patch } }));
    };
    const fields = formsCfg[activeFormKey];

    return (
      <>
        <SectionSubHeader onSave={() => savePartialSettings({ formsConfig: formsCfg }, 'تم حفظ تخصيص النماذج وبنود الفحص')} />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 p-5 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ['tenantForm', 'نموذج المستأجر'],
                  ['expenseForm', 'نموذج المصروف'],
                  ['ticketForm', 'نموذج بلاغ الصيانة'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setActiveFormKey(k)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                    activeFormKey === k ? 'bg-[#26478D] text-white' : 'bg-slate-100 dark:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/10">
              {fields.map((f, idx) => (
                <div key={f.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-bold">{f.labelAr}</div>
                    <div className="text-[10px] text-slate-500 font-mono-num">{f.key} · {f.type}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={f.visible}
                        onChange={() => {
                          const next = fields.map((x, i) => (i === idx ? { ...x, visible: !x.visible } : x));
                          updateForms({ [activeFormKey]: next });
                        }}
                      />
                      <span>ظاهر</span>
                    </label>
                    <label className="inline-flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={() => {
                          const next = fields.map((x, i) => (i === idx ? { ...x, required: !x.required } : x));
                          updateForms({ [activeFormKey]: next });
                        }}
                      />
                      <span>إجباري</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 dark:border-white/10 text-xs">
              <input
                placeholder="اسم حقل مخصص جديد"
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent"
              />
              <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value as CustomFormFieldConfig['type'])} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A]">
                <option value="text">نص</option>
                <option value="number">رقم</option>
                <option value="date">تاريخ</option>
                <option value="checkbox">نعم / لا</option>
              </select>
              <RippleButton
                className="!py-2"
                onClick={() => {
                  if (!newFieldLabel.trim()) return;
                  const nextField: CustomFormFieldConfig = {
                    id: `cf-${Date.now()}`,
                    key: `custom_${Date.now().toString(36)}`,
                    labelAr: newFieldLabel.trim(),
                    labelEn: newFieldLabel.trim(),
                    type: newFieldType,
                    visible: true,
                    required: false,
                    isCustom: true,
                  };
                  updateForms({ [activeFormKey]: [...fields, nextField] });
                  setNewFieldLabel('');
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة حقل</span>
              </RippleButton>
            </div>
          </div>

          <div className="lg:col-span-5 p-5 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-4">
            <h3 className="text-sm font-bold">بنود فحص الاستلام والتسليم + النماذج المخصصة</h3>
            <div className="space-y-2">
              {formsCfg.handoverChecklist.map((item) => (
                <div key={item.id} className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between text-xs">
                  <span className="font-medium">{item.labelAr}</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateForms({
                        handoverChecklist: formsCfg.handoverChecklist.map((x) =>
                          x.id === item.id ? { ...x, required: !x.required } : x
                        ),
                      })
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      item.required ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' : 'bg-slate-200 dark:bg-white/10'
                    }`}
                  >
                    {item.required ? 'إجباري' : 'اختياري'}
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-200/70 dark:border-white/10 space-y-2 text-xs">
              <div className="font-bold">قوالب النماذج المخصصة</div>
              {formsCfg.customForms.map((cf) => (
                <div key={cf.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] flex items-center justify-between">
                  <span className="font-semibold">{cf.titleAr}</span>
                  <span className="text-[11px] text-slate-500">{cf.linkedModule}</span>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  placeholder="اسم نموذج مخصص جديد"
                  value={newCustomFormTitle}
                  onChange={(e) => setNewCustomFormTitle(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent"
                />
                <RippleButton
                  className="!py-2"
                  onClick={() => {
                    if (!newCustomFormTitle.trim()) return;
                    updateForms({
                      customForms: [
                        ...formsCfg.customForms,
                        { id: `cform-${Date.now()}`, titleAr: newCustomFormTitle.trim(), linkedModule: 'العقارات', fieldsCount: 3, active: true },
                      ],
                    });
                    setNewCustomFormTitle('');
                  }}
                >
                  إنشاء
                </RippleButton>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* -------------------- SECTIONS 6-11: CONFIGURABLE CATALOGS -------------------- */
  const catalogConfigs: Record<
    Exclude<CatalogSettingsSectionId, 'contacts' | 'calendar' | 'forms'>,
    {
      fieldKey: keyof Pick<
        CompanySettings,
        'incomeCategories' | 'expenseCategories' | 'liabilityCategories' | 'paymentMethodsConfig' | 'propertyTypesConfig' | 'unitTypesConfig'
      >;
      fallback: CatalogCategoryItem[];
      titleAr: string;
      addButtonAr: string;
      saveMessage: string;
    }
  > = {
    income_categories: {
      fieldKey: 'incomeCategories',
      fallback: DEFAULT_INCOME_CATEGORIES,
      titleAr: 'فئات الدخل والإيرادات',
      addButtonAr: 'إضافة فئة دخل',
      saveMessage: 'تم حفظ فئات الدخل بنجاح',
    },
    expense_categories: {
      fieldKey: 'expenseCategories',
      fallback: DEFAULT_EXPENSE_CATEGORIES,
      titleAr: 'فئات المصاريف والفئات الفرعية',
      addButtonAr: 'إضافة فئة مصروف',
      saveMessage: 'تم حفظ فئات المصاريف بنجاح',
    },
    liabilities_categories: {
      fieldKey: 'liabilityCategories',
      fallback: DEFAULT_LIABILITY_CATEGORIES,
      titleAr: 'فئات الالتزامات والديون',
      addButtonAr: 'إضافة فئة التزام',
      saveMessage: 'تم حفظ فئات الالتزامات بنجاح',
    },
    payment_methods: {
      fieldKey: 'paymentMethodsConfig',
      fallback: DEFAULT_PAYMENT_METHODS,
      titleAr: 'طرق الدفع المعتمدة وإحصائيات الاستخدام',
      addButtonAr: 'إضافة طريقة دفع',
      saveMessage: 'تم حفظ طرق الدفع بنجاح',
    },
    property_types: {
      fieldKey: 'propertyTypesConfig',
      fallback: DEFAULT_PROPERTY_TYPES,
      titleAr: 'أنواع العقارات وخصائصها الافتراضية',
      addButtonAr: 'إضافة نوع عقار',
      saveMessage: 'تم حفظ أنواع العقارات بنجاح',
    },
    unit_types: {
      fieldKey: 'unitTypesConfig',
      fallback: DEFAULT_UNIT_TYPES,
      titleAr: 'أنواع الوحدات ومواصفاتها القياسية',
      addButtonAr: 'إضافة نوع وحدة',
      saveMessage: 'تم حفظ أنواع الوحدات بنجاح',
    },
  };

  const activeCfg = catalogConfigs[section];
  const items = getCatalogList(activeCfg.fieldKey, activeCfg.fallback);
  const liabilities: LiabilityRecordItem[] = draft.liabilityRecords || state.settings.liabilityRecords || [
    {
      id: 'liab-rec-1',
      titleAr: 'تمويل تطوير برج النخيل',
      categoryId: 'lia-2',
      creditor: 'مصرف الإنماء',
      termType: 'طويل الأمد',
      interestPercent: 3.8,
      totalAmount: 450000,
      paidAmount: 150000,
      dueDate: '2027-06-30',
      accountCode: '2120',
    },
  ];

  const getUsageCount = (item: CatalogCategoryItem) => {
    if (section === 'income_categories') {
      const count = state.payments.filter((p) => p.status === 'معتمد').length;
      return item.nameAr.includes('سكن') ? `${count} سند` : 'متاح للتصنيف';
    }
    if (section === 'expense_categories') {
      const matched = state.expenses.filter((e) => e.category.includes(item.nameAr.replace('مصروفات ', '')) || item.nameAr.includes(e.category));
      const sum = matched.reduce((s, e) => s + e.amount, 0);
      return `${matched.length} فاتورة · ${formatSar(sum, lang)}`;
    }
    if (section === 'payment_methods') {
      const matched = state.payments.filter((p) => p.status === 'معتمد' && (p.paymentMethod === item.nameAr || item.nameAr.includes(p.paymentMethod)));
      const sum = matched.reduce((s, p) => s + p.amount, 0);
      return `${matched.length} عملية · ${formatSar(sum, lang)}`;
    }
    if (section === 'property_types') {
      const count = state.properties.filter((p) => item.nameAr.includes(p.type) || p.type.includes(item.nameAr)).length;
      return `${count} عقار مسجل`;
    }
    if (section === 'unit_types') {
      const count = state.units.filter((u) => item.nameAr.includes(u.unitType) || u.unitType.includes(item.nameAr)).length;
      return `${count} وحدة مسجلة`;
    }
    return item.termType || 'نشط';
  };

  return (
    <>
      <SectionSubHeader
        onSave={() =>
          savePartialSettings(
            {
              [activeCfg.fieldKey]: items,
              ...(section === 'liabilities_categories' ? { liabilityRecords: liabilities } : {}),
            },
            activeCfg.saveMessage
          )
        }
      />

      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold">{activeCfg.titleAr}</h3>
          <div className="flex items-center gap-2">
            {section === 'liabilities_categories' && (
              <RippleButton variant="secondary" onClick={() => setNewLiabilityOpen(true)}>
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة التزام مالي</span>
              </RippleButton>
            )}
            <RippleButton onClick={() => setNewCatModal(true)}>
              <Plus className="w-3.5 h-3.5" />
              <span>{activeCfg.addButtonAr}</span>
            </RippleButton>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-2.5 ${
                !item.active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-4 h-4 rounded-md shrink-0"
                    style={{ backgroundColor: item.color || '#26478D' }}
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{item.nameAr}</div>
                    <div className="text-[11px] text-slate-500 truncate">{item.nameEn}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveCatalogItem(activeCfg.fieldKey, items, idx, -1)}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                    title="أعلى"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCatalogItem(activeCfg.fieldKey, items, idx, 1)}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                    title="أسفل"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = items.map((x) => (x.id === item.id ? { ...x, active: !x.active } : x));
                      updateCatalogList(activeCfg.fieldKey, next);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      item.active ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' : 'bg-slate-200 dark:bg-white/10 text-slate-500'
                    }`}
                  >
                    {item.active ? 'نشط' : 'مؤرشف'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-200/70 dark:border-white/10">
                <span className="font-mono-num">{getUsageCount(item)}</span>
                {item.accountCode && <span className="font-mono-num">حساب: {item.accountCode}</span>}
                {item.vatTaxable !== undefined && <span>{item.vatTaxable ? 'خاضع للضريبة' : 'معفى'}</span>}
                {item.minArea !== undefined && <span className="font-mono-num">{item.minArea}-{item.maxArea} م²</span>}
                {item.feePercent !== undefined && item.feePercent > 0 && <span className="font-mono-num">رسوم: {item.feePercent}%</span>}
              </div>

              {item.subCategories && item.subCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {item.subCategories.map((sub, sIdx) => (
                    <span key={sIdx} className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-[10px]">
                      {sub}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Active Liabilities Ledger when on Liabilities Section */}
        {section === 'liabilities_categories' && (
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-3">
            <h4 className="text-sm font-bold">سجل الالتزامات المالية القائمة ومتابعة السداد</h4>
            <div className="space-y-2.5">
              {liabilities.map((rec) => {
                const remaining = Math.max(0, rec.totalAmount - rec.paidAmount);
                return (
                  <div key={rec.id} className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold">{rec.titleAr}</div>
                      <div className="text-[11px] text-slate-500">
                        الدائن: {rec.creditor} · {rec.termType} · استحقاق {rec.dueDate}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-end font-mono-num">
                        <div className="font-bold text-amber-600 dark:text-amber-300">المتبقي: {formatSar(remaining, lang)}</div>
                        <div className="text-[10px] text-slate-400">من {formatSar(rec.totalAmount, lang)}</div>
                      </div>
                      {remaining > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('success');
                            const next = liabilities.map((l) =>
                              l.id === rec.id ? { ...l, paidAmount: Math.min(l.totalAmount, l.paidAmount + 5000) } : l
                            );
                            setDraft((prev) => ({ ...prev, liabilityRecords: next }));
                            pushToast('success', 'تم تسجيل دفعة سداد 5,000 ر.س وتقليل الالتزام');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                        >
                          تسجيل دفعة
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Catalog Item Modal */}
      {newCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const newItem: CatalogCategoryItem = {
                id: `cat-${Date.now()}`,
                nameAr: catDraft.nameAr,
                nameEn: catDraft.nameEn || catDraft.nameAr,
                description: catDraft.description,
                color: catDraft.color,
                accountCode: catDraft.accountCode || undefined,
                vatTaxable: catDraft.vatTaxable,
                active: true,
                subCategories: catDraft.subCatText
                  ? catDraft.subCatText.split(',').map((s) => s.trim()).filter(Boolean)
                  : undefined,
                linkedBankName: catDraft.linkedBankName || undefined,
                linkedIban: catDraft.linkedIban || undefined,
                feePercent: catDraft.feePercent || undefined,
                minArea: section === 'unit_types' ? catDraft.minArea : undefined,
                maxArea: section === 'unit_types' ? catDraft.maxArea : undefined,
                defaultRooms: section === 'unit_types' ? catDraft.defaultRooms : undefined,
                minUnits: section === 'property_types' ? catDraft.minUnits : undefined,
              };
              updateCatalogList(activeCfg.fieldKey, [newItem, ...items]);
              setNewCatModal(false);
              setCatDraft({ ...catDraft, nameAr: '', nameEn: '', description: '', subCatText: '' });
            }}
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13192B] p-6 space-y-3 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{activeCfg.addButtonAr}</h3>
              <button type="button" onClick={() => setNewCatModal(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <input required placeholder="الاسم بالعربية" value={catDraft.nameAr} onChange={(e) => setCatDraft({ ...catDraft, nameAr: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent" />
            <input placeholder="Name (English)" value={catDraft.nameEn} onChange={(e) => setCatDraft({ ...catDraft, nameEn: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent" />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="رقم الحساب (مثال: 4095)" value={catDraft.accountCode} onChange={(e) => setCatDraft({ ...catDraft, accountCode: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent font-mono-num" />
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10">
                <span>اللون:</span>
                <input type="color" value={catDraft.color} onChange={(e) => setCatDraft({ ...catDraft, color: e.target.value })} className="w-7 h-7 bg-transparent cursor-pointer" />
              </div>
            </div>
            {section === 'expense_categories' && (
              <input placeholder="فئات فرعية مفصولة بفاصلة" value={catDraft.subCatText} onChange={(e) => setCatDraft({ ...catDraft, subCatText: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent" />
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setNewCatModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 cursor-pointer">إلغاء</button>
              <RippleButton type="submit">إضافة</RippleButton>
            </div>
          </form>
        </div>
      )}

      {/* Add Liability Modal */}
      {newLiabilityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const rec: LiabilityRecordItem = {
                id: `liab-rec-${Date.now()}`,
                titleAr: liaForm.titleAr,
                categoryId: liaForm.categoryId,
                creditor: liaForm.creditor,
                termType: liaForm.termType,
                interestPercent: liaForm.interestPercent,
                totalAmount: liaForm.totalAmount,
                paidAmount: 0,
                dueDate: liaForm.dueDate,
                accountCode: '2110',
              };
              setDraft((prev) => ({ ...prev, liabilityRecords: [rec, ...liabilities] }));
              setNewLiabilityOpen(false);
            }}
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13192B] p-6 space-y-3 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">إضافة التزام مالي جديد</h3>
              <button type="button" onClick={() => setNewLiabilityOpen(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <input required placeholder="بيان الالتزام" value={liaForm.titleAr} onChange={(e) => setLiaForm({ ...liaForm, titleAr: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent" />
            <input required placeholder="الجهة الدائنة" value={liaForm.creditor} onChange={(e) => setLiaForm({ ...liaForm, creditor: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" required placeholder="المبلغ الإجمالي" value={liaForm.totalAmount} onChange={(e) => setLiaForm({ ...liaForm, totalAmount: Number(e.target.value) })} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent font-mono-num" />
              <input type="date" value={liaForm.dueDate} onChange={(e) => setLiaForm({ ...liaForm, dueDate: e.target.value })} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent font-mono-num" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setNewLiabilityOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 cursor-pointer">إلغاء</button>
              <RippleButton type="submit">حفظ الالتزام</RippleButton>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
