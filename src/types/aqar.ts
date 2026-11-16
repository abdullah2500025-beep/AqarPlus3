export type RoleKey =
  | 'sys_owner'
  | 'gm'
  | 'supervisor'
  | 'accountant'
  | 'leasing'
  | 'maint_manager'
  | 'technician'
  | 'receptionist'
  | 'auditor'
  | 'owner';
export type CurrencyCode = 'SAR' | 'AED' | 'USD' | 'EGP' | 'KWD';

export type PermissionKey =
  | 'view_all'
  | 'manage_properties'
  | 'manage_tenants'
  | 'manage_contracts'
  | 'collect_payments'
  | 'reverse_receipts'
  | 'manage_accounting'
  | 'create_expense'
  | 'approve_expense_supervisor'
  | 'approve_expense_manager'
  | 'manage_maintenance'
  | 'execute_maintenance'
  | 'manage_tasks'
  | 'manage_documents'
  | 'manage_users'
  | 'backup_restore'
  | 'view_audit';

export type PermissionLevel = 'view' | 'create' | 'edit' | 'delete_void' | 'approve';

export type PermissionModuleKey =
  | 'properties'
  | 'tenants'
  | 'contracts'
  | 'finance'
  | 'expenses'
  | 'maintenance'
  | 'tasks'
  | 'documents'
  | 'archive'
  | 'team'
  | 'audit'
  | 'backups';

export type StaffStatusState = 'متصل' | 'مشغول' | 'غير متصل';

export interface StaffSecurityConfig {
  twoFactorEnabled?: boolean;
  biometricEnabled?: boolean;
  hasPin?: boolean;
  failedAttempts?: number;
  lockedUntil?: string;
  lastPasswordChangedAt?: string;
  requirePasswordChange90d?: boolean;
  tempPasswordSet?: boolean;
}

export interface StaffNotificationPrefs {
  dndEnabled?: boolean;
  dndFrom?: string;
  dndTo?: string;
  taskAssigned?: boolean;
  taskReminder?: boolean;
  taskApproved?: boolean;
  taskComment?: boolean;
  urgentTicket?: boolean;
}

export interface StaffUser {
  id: string;
  companyId?: string;
  nameAr: string;
  nameEn: string;
  role: RoleKey;
  roleLabelAr: string;
  roleLabelEn: string;
  email: string;
  phone: string;
  approvalLimitSar: number;
  active: boolean;
  ownerId?: string;
  deviceName: string;
  lastActiveAt: string;
  statusState?: StaffStatusState;
  specialty?: string;
  avatarDataUrl?: string;
  allowedPropertyIds?: string[];
  customModulePermissions?: Partial<Record<PermissionModuleKey, PermissionLevel[]>>;
  managerRating?: number;
  lastActivitySummary?: string;
  security?: StaffSecurityConfig;
  notificationPrefs?: StaffNotificationPrefs;
}

export type PropertyType = 'سكني' | 'تجاري' | 'إداري' | 'مختلط';
export type PropertyStatus = 'نشط' | 'متوقف' | 'تحت التطوير' | 'مؤرشف';

export interface OwnerShare {
  ownerId: string;
  sharePercent: number;
}

export type PropertyOwnershipMode = 'مملوك للشركة' | 'إدارة للغير' | 'ملكية مشتركة';

export type ArchiveCategoryId = 'contracts' | 'tenants' | 'receipts' | 'tickets' | 'documents' | 'units';
export type ArchiveMode = 'تلقائي' | 'يدوي' | 'مجدول';

export interface ArchiveMetadata {
  archivedAt?: string;
  archiveReason?: string;
  archivedBy?: string;
  archiveMode?: ArchiveMode;
  preArchiveStatus?: string;
  restoredAsReference?: boolean;
}

export interface SavedArchiveFilter {
  id: string;
  name: string;
  category: ArchiveCategoryId | 'all';
  propertyId?: string;
  tenantId?: string;
  year?: string;
  minAmount?: number;
  timeframe?: 'all' | 'this_month' | 'this_year';
  query?: string;
  createdBy: string;
  createdAt: string;
}

export interface Property {
  id: string;
  companyId?: string;
  ownershipMode?: PropertyOwnershipMode;
  code: string;
  nameAr: string;
  nameEn: string;
  city: string;
  district: string;
  street: string;
  nationalAddress: string;
  type: PropertyType;
  deedNumber: string;
  status: PropertyStatus;
  buildingsCount: number;
  floorsCount: number;
  managementFeePercent: number;
  ownerShares: OwnerShare[];
  electricityMeterMain: string;
  waterMeterMain: string;
  caretakerName: string;
  caretakerPhone: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}

export type UnitStatus =
  | 'شاغرة'
  | 'محجوزة'
  | 'قيد التأجير'
  | 'مؤجرة'
  | 'متأخرة في السداد'
  | 'تحت الصيانة'
  | 'بانتظار الاستلام'
  | 'تحتاج إلى تنظيف'
  | 'موقوفة'
  | 'مؤرشفة';

export type UnitType = 'شقة' | 'فيلا' | 'مكتب' | 'معرض تجاري' | 'استوديو';

export interface Unit {
  id: string;
  propertyId: string;
  buildingName: string;
  floor: number;
  unitNumber: string;
  unitType: UnitType;
  areaSqm: number;
  rooms: number;
  bathrooms: number;
  furnished: boolean;
  acCount: number;
  electricityMeter: string;
  waterMeter: string;
  keyCount: number;
  acRemoteCount: number;
  suggestedMonthlyRent: number;
  suggestedAnnualRent: number;
  officeFee: number;
  securityDeposit?: number;
  acType?: 'سبليت' | 'شباك' | 'مركزي';
  kitchenInstalled?: boolean;
  status: UnitStatus;
  linkedTenantId?: string;
  vacantSince?: string;
  notes?: string;
  archivedAt?: string;
  archiveReason?: string;
  archivedBy?: string;
  archiveMode?: ArchiveMode;
  preArchiveStatus?: string;
}

export interface Owner {
  id: string;
  nameAr: string;
  nameEn: string;
  nationalId: string;
  phone: string;
  email: string;
  iban: string;
  bankName: string;
  totalTransferred: number;
  notes?: string;
}

export interface VendorRatingBreakdown {
  quality: number;
  punctuality: number;
  pricing: number;
  cooperation: number;
}

export interface Vendor {
  id: string;
  nameAr: string;
  nameEn: string;
  crNumber: string;
  vatNumber?: string;
  category: string;
  city?: string;
  nationalAddress?: string;
  iban?: string;
  contactPerson?: string;
  phone: string;
  email: string;
  rating: number;
  ratingBreakdown?: VendorRatingBreakdown;
  avgExecutionDays?: number;
  complaintsCount?: number;
  active: boolean;
}

export interface TenantOnboardingChecklist {
  idVerified: boolean;
  docsArchived: boolean;
  depositPaid: boolean;
  contractSigned: boolean;
  ejarRegistered: boolean;
  handoverSigned: boolean;
}

export type TenantTypeKind = 'فرد' | 'عائلة' | 'شركة';
export type MaritalStatusKind = 'أعزب' | 'متزوج' | 'أرمل';

export interface TenantBehaviorScores {
  paymentCommitment: number;
  unitCare: number;
  cooperation: number;
  penaltyTotal?: number;
}

export interface TenantViolationNote {
  id: string;
  title: string;
  category: 'مخالفة' | 'ملاحظة' | 'تأخر سداد' | 'إشادة';
  details: string;
  createdBy: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  nameAr: string;
  nameEn: string;
  nationalIdOrIqama: string;
  nationality: string;
  phone: string;
  altPhone?: string;
  email: string;
  employer?: string;
  tenantType?: TenantTypeKind;
  birthDate?: string;
  maritalStatus?: MaritalStatusKind;
  familyMembersCount?: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  nationalAddress?: string;
  classification: 'نشط' | 'سابق' | 'محتمل';
  rating: number;
  behaviorScores?: TenantBehaviorScores;
  violationNotes?: TenantViolationNote[];
  onboardingChecklist?: TenantOnboardingChecklist;
  notes?: string;
  createdAt: string;
  archivedAt?: string;
  archiveReason?: string;
  archivedBy?: string;
  archiveMode?: ArchiveMode;
  preArchiveStatus?: string;
}

export type LeadApprovalState = 'لم يُرسل' | 'بانتظار الموافقة' | 'موافق' | 'مرفوض' | 'مطلوب تعديلات';
export type LeadEscalationChannel = 'داخلي' | 'واتساب' | 'بريد إلكتروني' | 'SMS';
export type LeadEscalationStatus = 'بانتظار الموافقة' | 'موافق' | 'مرفوض' | 'أريد تعديلات';

export interface LeadInteraction {
  id: string;
  type: 'call' | 'whatsapp' | 'email' | 'visit' | 'sms' | 'escalation' | 'decision';
  direction: 'inbound' | 'outbound';
  summary: string;
  actorName: string;
  createdAt: string;
}

export interface LeadEscalationSnapshot {
  companyName: string;
  propertyName: string;
  unitNumber: string;
  leadName: string;
  nationalIdOrIqama?: string;
  hasIdPhoto: boolean;
  idImageDataUrl?: string;
  birthDate?: string;
  phone: string;
  rentAmount: number;
  paymentFrequency: PaymentFrequency;
  officeFee: number;
  earlyTerminationFee: number;
  employeeNotes?: string;
  registrationDate: string;
  registrationSource: string;
}

export interface LeadEscalation {
  id: string;
  requestCode: string;
  leadId: string;
  propertyId: string;
  unitId: string;
  recipientType: 'internal' | 'owner';
  recipientId: string;
  recipientName: string;
  recipientPhone?: string;
  recipientEmail?: string;
  channel: LeadEscalationChannel;
  status: LeadEscalationStatus;
  priority: 'عادي' | 'عاجل';
  employeeNotes?: string;
  decisionNotes?: string;
  decidedBy?: string;
  decidedAt?: string;
  token: string;
  tokenExpiresAt: string;
  snapshot: LeadEscalationSnapshot;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  nameAr: string;
  phone: string;
  email?: string;
  nationalIdOrIqama?: string;
  idImageDataUrl?: string;
  birthDate?: string;
  tenantType?: TenantTypeKind;
  familyMembersCount?: number;
  companyCrNumber?: string;
  source: string;
  propertyId: string;
  unitId: string;
  offeredRent: number;
  paymentFrequency?: PaymentFrequency;
  officeFee?: number;
  earlyTerminationFee?: number;
  budgetMonthly?: number;
  roomsRequired?: number;
  preferredArea?: string;
  moveInDate?: string;
  viewingDate: string;
  viewingResult?: string;
  status: 'جديد' | 'تمت المعاينة' | 'عرض سعر' | 'تحويل لعقد' | 'ملغي';
  approvalState?: LeadApprovalState;
  rating?: number;
  assignedTo: string;
  notes?: string;
  convertedToTenantId?: string;
  interactions?: LeadInteraction[];
  createdAt?: string;
  updatedAt?: string;
}

export type ContractLifecycleStatus =
  | 'مسودة'
  | 'بانتظار الاعتماد'
  | 'بانتظار التوثيق'
  | 'نشط'
  | 'بانتظار التجديد'
  | 'منتهي'
  | 'منتهٍ بالإخلاء'
  | 'ملغي';

export type EjarStatus = 'غير موثق' | 'قيد التوثيق' | 'موثق في إيجار' | 'طلب إنهاء';

export type PaymentFrequency = 'شهري' | 'ربع سنوي' | 'نصف سنوي' | 'سنوي';

export interface LeaseContract {
  id: string;
  internalNumber: string;
  ejarNumber: string;
  ejarStatus: EjarStatus;
  lifecycleStatus: ContractLifecycleStatus;
  propertyId: string;
  unitId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  annualRent: number;
  currency?: CurrencyCode;
  paymentFrequency: PaymentFrequency;
  installmentsCount: number;
  securityDeposit: number;
  officeFee: number;
  earlyTerminationFee?: number;
  ejarPortalUrl?: string;
  handoverDate?: string;
  occupancyStartDate?: string;
  occupancyStatus?: 'نشط' | 'قيد الإخلاء' | 'مُخلى';
  keysDeliveredCount?: number;
  remotesDeliveredCount?: number;
  managementCommissionPercent: number;
  includedServices: string;
  version: number;
  renewedFromContractId?: string;
  createdBy: string;
  createdAt: string;
  notes?: string;
  archivedAt?: string;
  archiveReason?: string;
  archivedBy?: string;
  archiveMode?: ArchiveMode;
  preArchiveStatus?: string;
  restoredAsReference?: boolean;
}

export interface HandoverChecklistItem {
  item: string;
  status: 'سليم' | 'يحتاج صيانة' | 'تالف';
  notes?: string;
}

export interface HandoverInspection {
  id: string;
  contractId: string;
  unitId: string;
  propertyId: string;
  type: 'استلام عند التأجير' | 'إخلاء واستلام' | 'استلام أثناء الإشغال';
  date: string;
  inspectorId: string;
  keysReturned: number;
  acRemotesReturned: number;
  electricityReading: string;
  waterReading: string;
  checklist: HandoverChecklistItem[];
  damageCost: number;
  unpaidRentDue: number;
  depositHeld: number;
  netRefundOrDue: number;
  photosDataUrls?: string[];
  tenantSignatureDataUrl?: string;
  notes?: string;
  approvedBy?: string;
  status: 'مسودة' | 'بانتظار الاعتماد' | 'معتمد';
  createdAt: string;
}

export type InstallmentStatus =
  | 'لم تستحق'
  | 'مستحقة اليوم'
  | 'مدفوعة جزئياً'
  | 'مدفوعة بالكامل'
  | 'متأخرة'
  | 'ملغاة';

export interface Installment {
  id: string;
  contractId: string;
  unitId: string;
  propertyId: string;
  tenantId: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  currency?: CurrencyCode;
  lastPaymentDate?: string;
  status: InstallmentStatus;
}

export type PaymentMethod = 'تحويل بنكي' | 'نقدي' | 'شبكة مدى' | 'شيك' | 'سداد إلكتروني';
export type PaymentType = 'إيجار' | 'دفعة مقدمة' | 'تأمين' | 'رسوم مكتب وسعي' | 'عمولة فسخ';

export interface PaymentAllocation {
  installmentId: string;
  amount: number;
}

export interface Payment {
  id: string;
  receiptNumber: string;
  idempotencyKey: string;
  contractId: string;
  unitId: string;
  propertyId: string;
  tenantId: string;
  allocations: PaymentAllocation[];
  amount: number;
  currency?: CurrencyCode;
  paymentMethod: PaymentMethod;
  paymentType: PaymentType;
  referenceNumber?: string;
  receivedBy: string;
  deviceName: string;
  status: 'معتمد' | 'معكوس';
  reversedByReceiptId?: string;
  reversalReason?: string;
  signatureDataUrl?: string;
  notes?: string;
  createdAt: string;
  archivedAt?: string;
  archiveReason?: string;
  archivedBy?: string;
  archiveMode?: ArchiveMode;
  preArchiveStatus?: string;
}

export interface Account {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  type: 'أصول' | 'التزامات' | 'حقوق ملكية' | 'إيرادات' | 'مصروفات';
  balance: number;
}

export interface JournalLine {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  referenceType: 'تحصيل' | 'سند عكسي' | 'مصروف' | 'عمولة' | 'تسوية' | 'تحويل مالك';
  referenceId: string;
  propertyId?: string;
  ownerId?: string;
  createdBy: string;
  lines: JournalLine[];
}

export type ExpenseCategory =
  | 'صيانة'
  | 'نظافة'
  | 'كهرباء'
  | 'مياه'
  | 'تشغيل عام'
  | 'أصول ومعدات'
  | 'مصروفات الصيانة'
  | 'مصروفات التشغيل'
  | 'مصروفات إدارية'
  | 'مصروفات رأس مالية'
  | 'مصروفات تأجير وتسويق'
  | 'مصروفات حكومية وضريبية'
  | 'مصروفات طوارئ'
  | 'مصروفات أخرى';

export type ExpenseApprovalStatus =
  | 'مسودة'
  | 'بانتظار المشرف'
  | 'بانتظار مدير القسم'
  | 'بانتظار المدير'
  | 'بانتظار المالك'
  | 'معتمد'
  | 'مرفوض'
  | 'ملغى';

export type ExpensePaymentStatus = 'مدفوع بالكامل' | 'مدفوع جزئياً' | 'لم يُدفع';

export interface Expense {
  id: string;
  expenseNumber: string;
  date: string;
  category: ExpenseCategory;
  subCategory?: string;
  propertyId: string;
  unitId?: string;
  vendorId?: string;
  ticketId?: string;
  tenantId?: string;
  invoiceNumber: string;
  amount: number;
  vatAmount?: number;
  netAmount?: number;
  currency?: CurrencyCode;
  paymentMethod: PaymentMethod | 'آجل';
  paidFromAccount?: string;
  referenceNumber?: string;
  paymentStatus?: ExpensePaymentStatus;
  paidAmount?: number;
  remainingAmount?: number;
  dueDate?: string;
  bearer: 'المالك' | 'الشركة' | 'المستأجر';
  approvalStatus: ExpenseApprovalStatus;
  approvedBySupervisor?: string;
  approvedByDeptManager?: string;
  approvedByManager?: string;
  approvedByOwner?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  invoiceImageDataUrl?: string;
  invoicePdfDataUrl?: string;
  workPhotosDataUrls?: string[];
  recipientSignatureDataUrl?: string;
  zatcaQrVerified?: boolean;
  zatcaQrRaw?: string;
  registerAsAsset?: boolean;
  isRecurringInstance?: boolean;
  recurringRuleId?: string;
  createdBy: string;
  notes?: string;
  createdAt: string;
}

export interface SupplierInvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type SupplierInvoiceStatus =
  | 'مسودة'
  | 'بانتظار الاعتماد'
  | 'معتمدة'
  | 'مدفوعة جزئياً'
  | 'مدفوعة بالكامل'
  | 'متأخرة'
  | 'ملغاة';

export interface SupplierInvoice {
  id: string;
  invoiceCode: string;
  supplierInvoiceNumber: string;
  invoiceDate: string;
  receivedDate: string;
  dueDate?: string;
  vendorId: string;
  propertyId: string;
  unitId?: string;
  ticketId?: string;
  items: SupplierInvoiceLineItem[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  currency: CurrencyCode;
  status: SupplierInvoiceStatus;
  cancellationReason?: string;
  zatcaQrVerified?: boolean;
  zatcaQrData?: string;
  invoiceImageDataUrl?: string;
  invoicePdfDataUrl?: string;
  beforeAfterPhotos?: string[];
  notes?: string;
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
}

export interface RecurringExpenseRule {
  id: string;
  title: string;
  category: ExpenseCategory;
  subCategory?: string;
  propertyId: string;
  unitId?: string;
  vendorId?: string;
  estimatedAmount: number;
  currency: CurrencyCode;
  bearer: 'المالك' | 'الشركة' | 'المستأجر';
  frequency: 'شهري' | 'ربع سنوي' | 'سنوي';
  dayOfMonth: number;
  enabled: boolean;
  lastGeneratedMonth?: string;
  createdBy: string;
  createdAt: string;
}

export interface PropertyBudget {
  id: string;
  propertyId: string;
  month: string;
  monthlyLimitSar: number;
  alertThresholdPercent: number;
  blockAt100Percent: boolean;
  updatedBy: string;
  updatedAt: string;
}

export interface UnitAsset {
  id: string;
  propertyId: string;
  unitId: string;
  name: string;
  category: string;
  serialNumber: string;
  brand: string;
  purchaseDate: string;
  warrantyExpiry: string;
  condition: 'ممتاز' | 'يحتاج صيانة' | 'تالف';
}

export type TicketPriority = 'عاجل' | 'مرتفع' | 'متوسط' | 'منخفض';
export type TicketStatus =
  | 'جديد'
  | 'تم الإسناد'
  | 'قيد التشخيص'
  | 'بانتظار اعتماد التكلفة'
  | 'قيد التنفيذ'
  | 'مكتمل'
  | 'مغلق';

export interface MaintenanceTicket {
  id: string;
  ticketNumber: string;
  propertyId: string;
  unitId: string;
  tenantId?: string;
  source: 'المستأجر' | 'المشرف' | 'موظف التأجير' | 'المالك' | 'الفحص الدوري';
  category: string;
  priority: TicketPriority;
  title: string;
  description: string;
  assignedTo?: string;
  vendorId?: string;
  scheduledDate?: string;
  diagnosis?: string;
  estimatedCost: number;
  actualCost: number;
  status: TicketStatus;
  assetId?: string;
  linkedExpenseId?: string;
  linkedTaskId?: string;
  rating?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  archiveReason?: string;
  archivedBy?: string;
  archiveMode?: ArchiveMode;
  preArchiveStatus?: string;
  beforeNote?: string;
  afterNote?: string;
}

export type TaskStatus = 'جديدة' | 'مسندة' | 'قيد التنفيذ' | 'بانتظار المراجعة' | 'مكتملة' | 'معلقة';

export interface TaskChecklistStep {
  text: string;
  done: boolean;
}

export interface TaskComment {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  type: string;
  propertyId?: string;
  unitId?: string;
  assignedTo: string;
  createdBy: string;
  dueDate: string;
  priority: TicketPriority;
  status: TaskStatus;
  checklist: TaskChecklistStep[];
  comments: TaskComment[];
  linkedTicketId?: string;
  createdAt: string;
  isQueued?: boolean;
  smartAssignedReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  completedAt?: string;
  estimatedHours?: number;
  actualHours?: number;
  photoNotes?: string[];
  archivedAt?: string;
  archiveReason?: string;
  archivedBy?: string;
  archiveMode?: ArchiveMode;
  preArchiveStatus?: string;
}

export interface CommunicationLog {
  id: string;
  targetType: 'مستأجر' | 'مالك' | 'مورد' | 'موظف';
  targetId: string;
  targetName: string;
  channel: 'اتصال هاتفي' | 'رسالة نصية / واتساب' | 'بريد إلكتروني' | 'ملاحظة داخلية' | 'زيارة ميدانية' | 'موعد مجدول';
  direction?: 'صادر' | 'وارد';
  templateId?: string;
  templateUsed?: string;
  language: 'ar' | 'en' | 'bn';
  summary: string;
  scheduledAt?: string;
  status?: 'مرسل' | 'مقروء' | 'مجدول' | 'مكتمل';
  sentBy: string;
  createdAt: string;
}

export type TemplateCategory = 'payment' | 'contract' | 'maintenance' | 'supplier' | 'internal' | 'custom';
export type TemplateChannel = 'whatsapp' | 'sms' | 'email' | 'internal';

export interface TemplateEditEntry {
  editedBy: string;
  editedAt: string;
  summary: string;
}

export interface CommunicationTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  channel: TemplateChannel;
  language: 'ar' | 'en';
  contentAr: string;
  contentEn?: string;
  isFavorite?: boolean;
  isSeasonal?: boolean;
  usageCount: number;
  scheduleEnabled?: boolean;
  scheduleDaysOffset?: number;
  scheduleTime?: string;
  allowedRoles?: RoleKey[];
  createdBy: string;
  updatedBy?: string;
  updatedAt: string;
  editHistory?: TemplateEditEntry[];
}

export type DocumentCategory =
  | 'عقود إيجار'
  | 'هويات وإقامات'
  | 'صكوك'
  | 'فواتير'
  | 'سندات قبض'
  | 'سندات صرف'
  | 'عروض أسعار'
  | 'تقارير صيانة'
  | 'محاضر التسليم'
  | 'صور العقارات'
  | 'مستندات الموردين'
  | 'مراسلات الشركة';

export interface OcrExtractedData {
  docType: 'عقد إيجار' | 'صك ملكية' | 'هوية / إقامة' | 'فاتورة / مستند مالي' | 'أخرى';
  tenantNameAr?: string;
  tenantNameEn?: string;
  nationalIdOrIqama?: string;
  nationality?: string;
  phone?: string;
  email?: string;
  employer?: string;
  propertyNameAr?: string;
  deedNumber?: string;
  city?: string;
  district?: string;
  street?: string;
  nationalAddress?: string;
  buildingName?: string;
  contractNumber?: string;
  ejarNumber?: string;
  unitNumber?: string;
  unitType?: string;
  startDate?: string;
  endDate?: string;
  annualRent?: number;
  securityDeposit?: number;
  paymentFrequency?: PaymentFrequency;
  landlordNameAr?: string;
  currency?: CurrencyCode;
  expiryDate?: string;
  rawText: string;
  confidenceNote?: string;
}

export interface OcrEntityMatchResult {
  matchedTenant?: {
    id: string;
    nameAr: string;
    nationalIdOrIqama: string;
    matchReason: string;
    fieldsToUpdate: string[];
  };
  matchedProperty?: {
    id: string;
    nameAr: string;
    deedNumber: string;
    matchReason: string;
    fieldsToUpdate: string[];
  };
  matchedUnit?: {
    id: string;
    unitNumber: string;
    propertyId: string;
  };
  suggestedTenantAction: 'update' | 'create' | 'none';
  suggestedPropertyAction: 'update' | 'create' | 'none';
}

export interface OcrSyncSummary {
  tenantAction: 'updated' | 'created' | 'skipped';
  tenantId?: string;
  tenantName?: string;
  tenantUpdatedFields: string[];
  propertyAction: 'updated' | 'created' | 'skipped';
  propertyId?: string;
  propertyName?: string;
  propertyUpdatedFields: string[];
}

export interface DocumentAccessEntry {
  id: string;
  userId: string;
  userName: string;
  deviceName: string;
  action: 'معاينة' | 'تنزيل' | 'تحليل OCR';
  accessedAt: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  category: DocumentCategory;
  fileName: string;
  fileType: string;
  fileSizeKb: number;
  relatedType: 'عقار' | 'وحدة' | 'مستأجر' | 'عقد' | 'مصروف' | 'صيانة' | 'سند' | 'مورد' | 'شركة';
  relatedId: string;
  expiryDate?: string;
  version: number;
  uploadedBy: string;
  dataUrl?: string;
  diskPath?: string;
  ocrStatus?: 'لم يُحلل' | 'تم الاستخراج آلياً';
  ocrRawText?: string;
  ocrExtracted?: OcrExtractedData;
  accessLog?: DocumentAccessEntry[];
  createdAt: string;
  archivedAt?: string;
  archiveReason?: string;
  archivedBy?: string;
  archiveMode?: ArchiveMode;
  preArchiveStatus?: string;
}

export interface VendorQuote {
  vendorId: string;
  vendorName: string;
  amount: number;
  deliveryDays: number;
  warrantyMonths: number;
  notes?: string;
}

export type PurchaseOrderStatus =
  | 'طلب شراء'
  | 'مقارنة عروض'
  | 'معتمد'
  | 'أمر شراء'
  | 'مستلم'
  | 'مفوتر';

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  title: string;
  propertyId: string;
  unitId?: string;
  ticketId?: string;
  category: string;
  status: PurchaseOrderStatus;
  quotes: VendorQuote[];
  selectedVendorId?: string;
  approvedAmount: number;
  currency: CurrencyCode;
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
}

export interface ExecutiveDecision {
  id: string;
  decisionNumber: string;
  title: string;
  category: 'مالي' | 'تشغيلي' | 'صيانة' | 'سياسات' | 'عقود';
  summary: string;
  effectiveDate: string;
  issuedBy: string;
  issuedByName: string;
  status: 'نافذ' | 'تحت المراجعة' | 'منتهي';
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  category: 'مالية' | 'تشغيلية' | 'إدارية';
  targetRoles: RoleKey[];
  relatedView?: string;
  isReadBy: string[];
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  deviceName: string;
  ipAddress?: string;
  geoLocation?: string;
  propertyId?: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  createdAt: string;
}

export interface LoginAuditEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  deviceName: string;
  ipAddress: string;
  geoLocation?: string;
  method: 'كلمة المرور' | 'بصمة / Face ID' | 'مصادقة ثنائية (2FA)' | 'تسجيل خروج عن بُعد';
  success: boolean;
  createdAt: string;
}

export interface SyncConflictRecord {
  id: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  firstActorName: string;
  secondActorName: string;
  firstChangeSummary: string;
  secondChangeSummary: string;
  status: 'بانتظار مراجعة المدير' | 'تم اعتماد التعديل الأحدث' | 'تم الإبقاء على النسخة السابقة';
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface SecurityPolicy {
  minPasswordLength: number;
  requireSpecialChars: boolean;
  passwordExpiryDays: number;
  autoLockMinutes: number;
  maxFailedAttempts: number;
  require2faForManagersAndAccountants: boolean;
}

export interface BackupSnapshot {
  id: string;
  label: string;
  createdAt: string;
  createdBy: string;
  recordCount: number;
  sizeKb: number;
  encrypted?: boolean;
}

export interface BackupCollectionDiff {
  added: number;
  updated: number;
  unchanged: number;
}

export interface BackupPreviewResult {
  id: string;
  exists: boolean;
  encrypted?: boolean;
  requiresPassword?: boolean;
  decryptionError?: string;
  propertiesCount: number;
  unitsCount: number;
  tenantsCount: number;
  contractsCount: number;
  paymentsCount: number;
  templatesCount: number;
  lastUpdatedAt?: string;
  diff?: {
    properties: BackupCollectionDiff;
    units: BackupCollectionDiff;
    tenants: BackupCollectionDiff;
    contracts: BackupCollectionDiff;
    payments: BackupCollectionDiff;
    expenses: BackupCollectionDiff;
    tickets: BackupCollectionDiff;
    totalChanged: number;
  };
}

export interface LoginProfileSummary {
  id: string;
  nameAr: string;
  nameEn: string;
  email: string;
  role: RoleKey;
  roleLabelAr: string;
  roleLabelEn: string;
  hasPin: boolean;
}

export interface AuthSessionInfo {
  authenticated: boolean;
  user?: StaffUser;
  token?: string;
  expiresAt?: string;
  demoLoginEnabled?: boolean;
  loginProfiles?: LoginProfileSummary[];
  companyBranding?: {
    nameAr: string;
    nameEn: string;
    logoDataUrl?: string;
  };
}

export type ReminderChannel = 'بريد إلكتروني' | 'رسائل نصية SMS (محاكاة)' | 'واتساب';

export interface ReminderRule {
  id: string;
  nameAr: string;
  nameEn: string;
  enabled: boolean;
  daysBeforeDue: number;
  channels: ReminderChannel[];
  contractId?: string;
  propertyId?: string;
  templateAr: string;
  templateEn: string;
  lastRunAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface ReminderDispatchLog {
  id: string;
  ruleId: string;
  ruleName: string;
  contractId: string;
  installmentId: string;
  tenantId: string;
  tenantName: string;
  channel: ReminderChannel;
  recipient: string;
  messagePreview: string;
  dueDate: string;
  amount: number;
  currency: CurrencyCode;
  status: 'تم الإرسال (محاكاة)' | 'مجدول';
  sentAt: string;
}

export interface CompanyProfile {
  id: string;
  nameAr: string;
  nameEn: string;
  logoText?: string;
  logoDataUrl?: string;
  crNumber: string;
  vatNumber: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  bankName: string;
  iban: string;
  receiptFooterAr: string;
  isDefault?: boolean;
}

export interface BankAccountConfig {
  id: string;
  bankName: string;
  iban: string;
  accountHolder: string;
  isDefault: boolean;
  showOnReceipts: boolean;
}

export interface ReceiptBrandingConfig {
  layout: 'portrait' | 'landscape';
  showLogo: boolean;
  showVat: boolean;
  showQr: boolean;
  showSignature: boolean;
  showWatermark: boolean;
  accentColor: string;
}

export interface GeneralPreferencesConfig {
  language: 'ar' | 'en';
  rtlAuto: boolean;
  currency: CurrencyCode;
  calendar: 'gregorian' | 'hijri' | 'both';
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD';
  numeralFormat: 'ar' | 'en';
  timezone: string;
  themeMode: 'dark' | 'light' | 'system';
}

export interface AppSecurityCenterConfig {
  lockMethod: 'pin' | 'fingerprint' | 'face' | 'pattern';
  patternCode?: string;
  autoLockTiming: 'immediate' | '1m' | '5m' | '15m' | '30m';
  requirePinBeforeDeleteReceipt: boolean;
  requirePinBeforeCancelPayment: boolean;
  requirePinBeforeEditContract: boolean;
  requirePinBeforeExportData: boolean;
}

export interface NotificationCenterConfig {
  inApp: {
    rentDueBefore: boolean;
    rentDueDay: boolean;
    rentDueAfter: boolean;
    contractExpiry: boolean;
    maintenanceTickets: boolean;
    assignedTasks: boolean;
    syncUpdates: boolean;
  };
  push: {
    rentDue: boolean;
    contractExpiry: boolean;
    maintenance: boolean;
    tasks: boolean;
    sync: boolean;
  };
  workHoursEnabled: boolean;
  workHoursStart: string;
  workHoursEnd: string;
  whatsappAutoEnabled: boolean;
  whatsappDefaultTemplates: {
    rentDueId?: string;
    receiptId?: string;
    maintenanceId?: string;
    contractId?: string;
  };
  emailEnabled?: boolean;
  emailAddress?: string;
  emailReportTypes?: string[];
  defaultWhatsappNumber?: string;
  defaultSmsNumber?: string;
  defaultEmailSender?: string;
}

export interface DiscoveredPrinter {
  id: string;
  name: string;
  connection: 'Bluetooth' | 'USB' | 'Network';
  address: string;
}

export interface PrintShareConfig {
  discoveredPrinters: DiscoveredPrinter[];
  defaultPrinters: {
    receipts?: string;
    reports?: string;
    documents?: string;
  };
  paperSize: 'A4' | 'A5' | 'thermal_80' | 'thermal_58';
  printQuality: 'draft' | 'normal' | 'high';
  defaultShareChannel: 'whatsapp' | 'email' | 'pdf' | 'native';
}

export interface BackupPolicyConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'manual';
  scheduledTime: string;
  storageTarget: 'device' | 'custom_folder' | 'nas' | 'cloud';
  customPath: string;
  archivePath?: string;
  documentsPath?: string;
  encryptBackups: boolean;
}

export interface SyncCenterConfig {
  mode: 'local_only' | 'private_server' | 'lan';
  serverHost: string;
  serverPort: number;
  protocol: 'https' | 'http' | 'wss';
  behavior: 'auto' | 'manual' | 'wifi_only';
  conflictResolution: 'latest_wins' | 'current_device' | 'manual_review';
}

export interface DeveloperErrorEntry {
  id: string;
  timestamp: string;
  source: string;
  message: string;
  severity: 'info' | 'warn' | 'error';
}

export interface DeveloperCenterConfig {
  tempCacheSizeKb: number;
  errorLogs: DeveloperErrorEntry[];
}

export interface HolidayEntry {
  id: string;
  nameAr: string;
  date: string;
  official: boolean;
}

export interface CalendarSettingsConfig {
  calendarType: 'gregorian' | 'hijri' | 'both';
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD';
  numerals: 'ar' | 'en';
  weekStart: 'sat' | 'sun' | 'mon';
  holidays: HolidayEntry[];
  disableWorkOnHolidays: boolean;
  workStart: string;
  workEnd: string;
  workDays: string[];
  ramadanMode: boolean;
  ramadanWorkStart: string;
  ramadanWorkEnd: string;
  rentAlertDays: number[];
  contractAlertDays: number[];
}

export interface CustomFormFieldConfig {
  id: string;
  key: string;
  labelAr: string;
  labelEn: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  visible: boolean;
  required: boolean;
  isCustom?: boolean;
}

export interface FormsCustomizationConfig {
  tenantForm: CustomFormFieldConfig[];
  expenseForm: CustomFormFieldConfig[];
  ticketForm: CustomFormFieldConfig[];
  handoverChecklist: { id: string; labelAr: string; visible: boolean; required: boolean }[];
  customForms: { id: string; titleAr: string; linkedModule: string; fieldsCount: number; active: boolean }[];
}

export interface CatalogCategoryItem {
  id: string;
  nameAr: string;
  nameEn: string;
  description?: string;
  icon?: string;
  color?: string;
  accountCode?: string;
  vatTaxable?: boolean;
  active: boolean;
  subCategories?: string[];
  minUnits?: number;
  defaultVatPercent?: number;
  defaultUsage?: string;
  minArea?: number;
  maxArea?: number;
  defaultRooms?: number;
  defaultBathrooms?: number;
  defaultAmenities?: string[];
  defaultRentCycle?: 'شهري' | 'سنوي';
  linkedBankName?: string;
  linkedIban?: string;
  feePercent?: number;
  minAmount?: number;
  maxAmount?: number;
  termType?: 'قصير الأمد' | 'طويل الأمد';
}

export interface LiabilityRecordItem {
  id: string;
  titleAr: string;
  categoryId: string;
  creditor: string;
  termType: 'قصير الأمد' | 'طويل الأمد';
  interestPercent: number;
  totalAmount: number;
  paidAmount: number;
  dueDate: string;
  accountCode: string;
  notes?: string;
}

export interface DirectoryContactItem {
  id: string;
  name: string;
  phone: string;
  email?: string;
  category: 'مستأجر' | 'مورد' | 'مالك' | 'أخرى';
  company?: string;
  notes?: string;
  archived?: boolean;
  source: 'system' | 'phone' | 'csv' | 'ejar' | 'manual';
  createdAt: string;
}

export interface CompanySettings {
  nameAr: string;
  nameEn: string;
  logoDataUrl?: string;
  vatNumber: string;
  crNumber: string;
  city: string;
  address?: string;
  mapLat?: number;
  mapLng?: number;
  phone: string;
  whatsapp?: string;
  email: string;
  ejarApiMode: 'PDF + مطابقة يدوية' | 'تكامل إيجار المعتمد';
  zatcaPhase: 'المرحلة الأولى (QR + أرشفة)' | 'المرحلة الثانية (الربط والتكامل)';
  supervisorApprovalThreshold: number;
  managerApprovalThreshold: number;
  defaultManagementFeePercent: number;
  baseCurrency?: CurrencyCode;
  currencyRatesToSar?: Record<CurrencyCode, number>;
  dateCalendar?: 'هجري وميلادي' | 'ميلادي فقط';
  bankAccounts?: BankAccountConfig[];
  receiptBranding?: ReceiptBrandingConfig;
  generalPrefs?: GeneralPreferencesConfig;
  securityCenter?: AppSecurityCenterConfig;
  notificationsCenter?: NotificationCenterConfig;
  printShare?: PrintShareConfig;
  backupPolicy?: BackupPolicyConfig;
  syncCenter?: SyncCenterConfig;
  developerCenter?: DeveloperCenterConfig;
  calendarConfig?: CalendarSettingsConfig;
  formsConfig?: FormsCustomizationConfig;
  incomeCategories?: CatalogCategoryItem[];
  expenseCategories?: CatalogCategoryItem[];
  liabilityCategories?: CatalogCategoryItem[];
  liabilityRecords?: LiabilityRecordItem[];
  paymentMethodsConfig?: CatalogCategoryItem[];
  propertyTypesConfig?: CatalogCategoryItem[];
  unitTypesConfig?: CatalogCategoryItem[];
  contactsDirectory?: DirectoryContactItem[];
  contactsAutoSync?: boolean;
  integrationsConfig?: IntegrationsConfig;
}

export interface IntegrationsConfig {
  whatsappBusinessEnabled: boolean;
  whatsappPhoneId?: string;
  smtpEnabled: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSenderEmail?: string;
  smtpUseTls?: boolean;
  smsGatewayEnabled: boolean;
  smsProviderName?: string;
  smsSenderId?: string;
  mapProvider: 'osm' | 'google_maps';
  googleMapsLinked?: boolean;
}

export interface FavoriteReportPreset {
  id: string;
  title: string;
  dataset: 'payments' | 'installments' | 'expenses' | 'units' | 'maintenance';
  fields: string[];
  propertyFilter: string;
  statusFilter: string;
  groupBy: 'none' | 'property' | 'status' | 'month';
  sortField: string;
  sortDir: 'asc' | 'desc';
  createdBy: string;
  createdAt: string;
}

export interface SharedSearchFilter {
  id: string;
  name: string;
  query: string;
  entityType: 'all' | 'property' | 'unit' | 'tenant' | 'contract' | 'payment' | 'expense' | 'task' | 'ticket' | 'document';
  propertyId: string;
  onlyOverdue: boolean;
  minAmount: number;
  isFavorite: boolean;
  isShared: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface MeterReading {
  id: string;
  readingNumber: string;
  propertyId: string;
  unitId?: string;
  meterType: 'كهرباء' | 'مياه';
  meterNumber: string;
  previousReading: number;
  currentReading: number;
  consumption: number;
  billAmount: number;
  currency: CurrencyCode;
  billingPeriod: string;
  paidBy?: 'المستأجر' | 'المالك' | 'الشركة';
  recordedBy: string;
  notes?: string;
  createdAt: string;
}

export interface ScheduledReportConfig {
  id: string;
  title: string;
  dataset: 'payments' | 'installments' | 'expenses' | 'units' | 'maintenance';
  frequency: 'يومي' | 'أسبوعي' | 'شهري';
  deliveryChannel: 'بريد إلكتروني' | 'واتساب' | 'إشعار داخلي';
  recipient: string;
  fields: string[];
  groupBy?: 'none' | 'property' | 'status' | 'month';
  enabled: boolean;
  lastRunAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface ZatcaInvoiceRecord {
  id: string;
  invoiceNumber: string;
  invoiceType: 'فاتورة ضريبية (B2B)' | 'فاتورة ضريبية مبسطة (B2C)' | 'إشعار دائن';
  issueDate: string;
  sellerName: string;
  vatNumber: string;
  buyerName: string;
  buyerVatNumber?: string;
  propertyId?: string;
  unitId?: string;
  relatedPaymentId?: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  totalWithVat: number;
  currency: CurrencyCode;
  tlvBase64: string;
  invoiceHash: string;
  clearanceStatus: 'مؤرشف (المرحلة 1)' | 'تم الربط والتحقق (المرحلة 2)' | 'معلق';
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface AqarDatabaseState {
  settings: CompanySettings;
  companies?: CompanyProfile[];
  users: StaffUser[];
  rolePermissions: Record<RoleKey, PermissionKey[]>;
  properties: Property[];
  units: Unit[];
  meterReadings?: MeterReading[];
  owners: Owner[];
  vendors: Vendor[];
  tenants: Tenant[];
  leads: Lead[];
  leadEscalations?: LeadEscalation[];
  contracts: LeaseContract[];
  handovers: HandoverInspection[];
  installments: Installment[];
  payments: Payment[];
  accounts: Account[];
  journals: JournalEntry[];
  expenses: Expense[];
  supplierInvoices?: SupplierInvoice[];
  recurringExpenses?: RecurringExpenseRule[];
  propertyBudgets?: PropertyBudget[];
  assets: UnitAsset[];
  tickets: MaintenanceTicket[];
  tasks: TaskItem[];
  communications: CommunicationLog[];
  documents: DocumentRecord[];
  purchaseOrders?: PurchaseOrder[];
  decisions?: ExecutiveDecision[];
  notifications: NotificationItem[];
  reminderRules?: ReminderRule[];
  reminderLogs?: ReminderDispatchLog[];
  auditLogs: AuditLog[];
  backups: BackupSnapshot[];
  counters: {
    receipt: number;
    contract: number;
    ticket: number;
    expense: number;
    journal: number;
  };
  processedIdempotencyKeys: string[];
  savedArchiveFilters?: SavedArchiveFilter[];
  archiveLastNightlyRun?: string;
  archiveSeeded?: boolean;
  securityPolicy?: SecurityPolicy;
  loginHistory?: LoginAuditEntry[];
  syncConflicts?: SyncConflictRecord[];
  scheduledReports?: ScheduledReportConfig[];
  favoriteReports?: FavoriteReportPreset[];
  sharedSearchFilters?: SharedSearchFilter[];
  zatcaInvoices?: ZatcaInvoiceRecord[];
  communicationTemplates?: CommunicationTemplate[];
  teamSeeded?: boolean;
  syncRevision?: number;
  entityRevisions?: Record<string, number>;
  lastUpdatedAt: string;
}

export interface OfflineQueuedAction {
  id: string;
  operationId: string;
  idempotencyKey: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  endpoint: string;
  body: unknown;
  entityType?: string;
  entityId?: string;
  baseRevision?: number;
  descriptionAr: string;
  descriptionEn: string;
  queuedAt: string;
  userId: string;
  deviceName: string;
  deviceId?: string;
}
