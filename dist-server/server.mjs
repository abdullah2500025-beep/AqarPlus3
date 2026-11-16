// server.ts
import fs3 from "fs";
import http from "http";
import path3 from "path";
import crypto4 from "crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";

// server/store.ts
import fs2 from "fs";
import path2 from "path";
import crypto3 from "crypto";

// server/seed.ts
var DEFAULT_ROLE_PERMISSIONS = {
  sys_owner: [
    "view_all",
    "manage_properties",
    "manage_tenants",
    "manage_contracts",
    "collect_payments",
    "reverse_receipts",
    "manage_accounting",
    "create_expense",
    "approve_expense_supervisor",
    "approve_expense_manager",
    "manage_maintenance",
    "execute_maintenance",
    "manage_tasks",
    "manage_documents",
    "manage_users",
    "backup_restore",
    "view_audit"
  ],
  gm: [
    "view_all",
    "manage_properties",
    "manage_tenants",
    "manage_contracts",
    "collect_payments",
    "reverse_receipts",
    "manage_accounting",
    "create_expense",
    "approve_expense_supervisor",
    "approve_expense_manager",
    "manage_maintenance",
    "execute_maintenance",
    "manage_tasks",
    "manage_documents",
    "manage_users",
    "backup_restore",
    "view_audit"
  ],
  accountant: [
    "view_all",
    "collect_payments",
    "reverse_receipts",
    "manage_accounting",
    "create_expense",
    "manage_documents",
    "view_audit"
  ],
  leasing: [
    "manage_properties",
    "manage_tenants",
    "manage_contracts",
    "manage_tasks",
    "manage_documents"
  ],
  supervisor: [
    "manage_properties",
    "manage_tenants",
    "create_expense",
    "approve_expense_supervisor",
    "manage_maintenance",
    "manage_tasks",
    "manage_documents"
  ],
  maint_manager: [
    "manage_maintenance",
    "execute_maintenance",
    "manage_tasks",
    "create_expense",
    "approve_expense_supervisor",
    "manage_documents"
  ],
  technician: ["execute_maintenance", "manage_tasks", "create_expense"],
  receptionist: ["manage_tenants", "manage_tasks", "manage_documents"],
  auditor: ["view_all", "view_audit"],
  owner: []
};
function createInitialSeed() {
  const now = "2026-11-14T10:15:00.000Z";
  return {
    settings: {
      nameAr: "\u0634\u0631\u0643\u0629 \u062F\u0627\u0631 \u0627\u0644\u0623\u0641\u0642 \u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0623\u0645\u0644\u0627\u0643 \u0648\u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A",
      nameEn: "Dar Al-Ofoq Property Management Co.",
      vatNumber: "310482910300003",
      crNumber: "1010648291",
      city: "\u0627\u0644\u0631\u064A\u0627\u0636",
      address: "\u0637\u0631\u064A\u0642 \u0627\u0644\u0645\u0644\u0643 \u0641\u0647\u062F\u060C \u062D\u064A \u0627\u0644\u0639\u0644\u064A\u0627\u060C \u0628\u0631\u062C \u0627\u0644\u0623\u0639\u0645\u0627\u0644\u060C \u0627\u0644\u062F\u0648\u0631 4",
      mapLat: 24.7136,
      mapLng: 46.6753,
      phone: "0114892200",
      whatsapp: "966505123400",
      email: "ops@aqarplus.sa",
      ejarApiMode: "PDF + \u0645\u0637\u0627\u0628\u0642\u0629 \u064A\u062F\u0648\u064A\u0629",
      zatcaPhase: "\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0623\u0648\u0644\u0649 (QR + \u0623\u0631\u0634\u0641\u0629)",
      supervisorApprovalThreshold: 500,
      managerApprovalThreshold: 2e3,
      defaultManagementFeePercent: 5,
      baseCurrency: "SAR",
      currencyRatesToSar: {
        SAR: 1,
        AED: 1.021,
        USD: 3.75,
        EGP: 0.077,
        KWD: 12.22
      },
      dateCalendar: "\u0647\u062C\u0631\u064A \u0648\u0645\u064A\u0644\u0627\u062F\u064A",
      bankAccounts: [
        {
          id: "bnk-1",
          bankName: "\u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0623\u0647\u0644\u064A \u0627\u0644\u0633\u0639\u0648\u062F\u064A (SNB)",
          iban: "SA1910000041200008819201",
          accountHolder: "\u0634\u0631\u0643\u0629 \u062F\u0627\u0631 \u0627\u0644\u0623\u0641\u0642 \u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0623\u0645\u0644\u0627\u0643 \u0648\u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A",
          isDefault: true,
          showOnReceipts: true
        },
        {
          id: "bnk-2",
          bankName: "\u0645\u0635\u0631\u0641 \u0627\u0644\u0631\u0627\u062C\u062D\u064A",
          iban: "SA4480000123608010778899",
          accountHolder: "\u0634\u0631\u0643\u0629 \u0627\u0644\u062C\u0646\u064A\u062F\u0644 \u0627\u0644\u0639\u0642\u0627\u0631\u064A\u0629 - \u062D\u0633\u0627\u0628 \u0627\u0644\u062A\u062D\u0635\u064A\u0644",
          isDefault: false,
          showOnReceipts: true
        }
      ],
      receiptBranding: {
        layout: "portrait",
        showLogo: true,
        showVat: true,
        showQr: true,
        showSignature: true,
        showWatermark: true,
        accentColor: "#26478D"
      },
      generalPrefs: {
        language: "ar",
        rtlAuto: true,
        currency: "SAR",
        calendar: "both",
        dateFormat: "DD/MM/YYYY",
        numeralFormat: "en",
        timezone: "Asia/Riyadh (UTC+3)",
        themeMode: "dark"
      },
      securityCenter: {
        lockMethod: "pin",
        patternCode: "1-4-7-8-9",
        autoLockTiming: "5m",
        requirePinBeforeDeleteReceipt: true,
        requirePinBeforeCancelPayment: true,
        requirePinBeforeEditContract: true,
        requirePinBeforeExportData: false
      },
      notificationsCenter: {
        inApp: {
          rentDueBefore: true,
          rentDueDay: true,
          rentDueAfter: true,
          contractExpiry: true,
          maintenanceTickets: true,
          assignedTasks: true,
          syncUpdates: true
        },
        push: {
          rentDue: true,
          contractExpiry: true,
          maintenance: true,
          tasks: true,
          sync: false
        },
        workHoursEnabled: true,
        workHoursStart: "08:00",
        workHoursEnd: "20:00",
        whatsappAutoEnabled: true,
        whatsappDefaultTemplates: {
          rentDueId: "tpl-pay-1",
          receiptId: "tpl-pay-2",
          maintenanceId: "tpl-mnt-1",
          contractId: "tpl-ctr-2"
        }
      },
      printShare: {
        discoveredPrinters: [
          { id: "prt-1", name: "HP LaserJet Pro M404dn \xB7 \u0627\u0644\u0625\u062F\u0627\u0631\u0629", connection: "Network", address: "192.168.10.50:9100" },
          { id: "prt-2", name: "Epson TM-T88VI \xB7 \u0637\u0627\u0628\u0639\u0629 \u0627\u0644\u0625\u064A\u0635\u0627\u0644\u0627\u062A \u0627\u0644\u062D\u0631\u0627\u0631\u064A\u0629 80mm", connection: "Bluetooth", address: "BT-00:1A:7D:DA:71:13" },
          { id: "prt-3", name: "Canon imageCLASS \xB7 \u0645\u0643\u062A\u0628 \u0627\u0644\u0627\u0633\u062A\u0642\u0628\u0627\u0644", connection: "USB", address: "USB001" }
        ],
        defaultPrinters: {
          receipts: "prt-2",
          reports: "prt-1",
          documents: "prt-1"
        },
        paperSize: "A4",
        printQuality: "high",
        defaultShareChannel: "whatsapp"
      },
      backupPolicy: {
        frequency: "daily",
        scheduledTime: "02:00",
        storageTarget: "nas",
        customPath: "\\\\NAS-AQAR\\Backups\\AqarPlus",
        encryptBackups: true
      },
      syncCenter: {
        mode: "private_server",
        serverHost: "192.168.10.10",
        serverPort: 3e3,
        protocol: "wss",
        behavior: "auto",
        conflictResolution: "latest_wins"
      },
      developerCenter: {
        tempCacheSizeKb: 3840,
        errorLogs: [
          {
            id: "err-1",
            timestamp: "2026-11-14T08:42:10.000Z",
            source: "SyncEngine/WebSocket",
            message: "\u0625\u0639\u0627\u062F\u0629 \u0627\u062A\u0635\u0627\u0644 \u062A\u0644\u0642\u0627\u0626\u064A\u0629 \u0628\u0639\u062F \u062A\u0628\u062F\u064A\u0644 \u0634\u0628\u0643\u0629 Wi-Fi \u0641\u064A \u062C\u0647\u0627\u0632 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629 \u062E\u0644\u0627\u0644 420ms",
            severity: "info"
          },
          {
            id: "err-2",
            timestamp: "2026-11-14T09:15:33.000Z",
            source: "OCR/GeminiClient",
            message: "\u0627\u0643\u062A\u0645\u0627\u0644 \u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0636\u0648\u0626\u064A \u0644\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 \u0645\u0648\u062D\u062F (\u062B\u0642\u0629 98%)",
            severity: "info"
          }
        ]
      }
    },
    companies: [
      {
        id: "comp-1",
        nameAr: "\u0634\u0631\u0643\u0629 \u062F\u0627\u0631 \u0627\u0644\u0623\u0641\u0642 \u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0623\u0645\u0644\u0627\u0643 \u0648\u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A",
        nameEn: "Dar Al-Ofoq Property Management Co.",
        logoText: "\u062F\u0627\u0631 \u0627\u0644\u0623\u0641\u0642",
        crNumber: "1010648291",
        vatNumber: "310482910300003",
        address: "\u0637\u0631\u064A\u0642 \u0627\u0644\u0645\u0644\u0643 \u0641\u0647\u062F\u060C \u062D\u064A \u0627\u0644\u0639\u0644\u064A\u0627",
        city: "\u0627\u0644\u0631\u064A\u0627\u0636",
        phone: "0114892200",
        email: "ops@aqarplus.sa",
        bankName: "\u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0623\u0647\u0644\u064A \u0627\u0644\u0633\u0639\u0648\u062F\u064A",
        iban: "SA1910000041200008819201",
        receiptFooterAr: "\u0647\u0630\u0627 \u0627\u0644\u0633\u0646\u062F \u0635\u0627\u062F\u0631 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u064B \u0645\u0646 \u0646\u0638\u0627\u0645 AqarPlus \u0648\u0644\u0627 \u064A\u062D\u062A\u0627\u062C \u0625\u0644\u0649 \u062E\u062A\u0645 \u0648\u0631\u0642\u064A",
        isDefault: true
      },
      {
        id: "comp-2",
        nameAr: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0645\u062F\u0627\u0631 \u0644\u0644\u0627\u0633\u062A\u062B\u0645\u0627\u0631 \u0648\u0627\u0644\u062A\u0637\u0648\u064A\u0631 \u0627\u0644\u0639\u0642\u0627\u0631\u064A",
        nameEn: "Al-Madar Real Estate Investment Co.",
        logoText: "\u0627\u0644\u0645\u062F\u0627\u0631",
        crNumber: "1010772210",
        vatNumber: "310992817200003",
        address: "\u0637\u0631\u064A\u0642 \u0623\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643\u060C \u062D\u064A \u0627\u0644\u0645\u0644\u0642\u0627",
        city: "\u0627\u0644\u0631\u064A\u0627\u0636",
        phone: "0112981144",
        email: "finance@almadar.sa",
        bankName: "\u0645\u0635\u0631\u0641 \u0627\u0644\u0631\u0627\u062C\u062D\u064A",
        iban: "SA4480000123608010778899",
        receiptFooterAr: "\u0645\u062D\u0635\u0644 \u0644\u0635\u0627\u0644\u062D \u0645\u062D\u0641\u0638\u0629 \u0634\u0631\u0643\u0629 \u0627\u0644\u0645\u062F\u0627\u0631 \u0627\u0644\u0639\u0642\u0627\u0631\u064A\u0629",
        isDefault: false
      }
    ],
    users: [
      {
        id: "usr-sys",
        nameAr: "\u0639\u0628\u062F\u0627\u0644\u0644\u0647 \u0628\u0646 \u0641\u0647\u062F \u0627\u0644\u0633\u0628\u064A\u0639\u064A",
        nameEn: "Abdullah Al-Subaie",
        role: "sys_owner",
        roleLabelAr: "\u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645",
        roleLabelEn: "System Owner",
        email: "owner.sys@aqarplus.sa",
        phone: "0505123400",
        approvalLimitSar: 1e6,
        active: true,
        deviceName: "MacBook Pro M3 \xB7 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0644\u064A\u0627",
        lastActiveAt: now,
        statusState: "\u0645\u062A\u0635\u0644",
        specialty: "\u0627\u0644\u062D\u0648\u0643\u0645\u0629 \u0648\u0627\u0644\u0623\u0645\u0646 \u0648\u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A",
        managerRating: 5,
        lastActivitySummary: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u0623\u0645\u0627\u0646 \u0648\u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A \u0627\u0644\u064A\u0648\u0645\u064A\u0629",
        security: {
          twoFactorEnabled: false,
          biometricEnabled: true,
          failedAttempts: 0,
          lastPasswordChangedAt: "2026-10-20T09:00:00.000Z",
          requirePasswordChange90d: true
        },
        notificationPrefs: {
          dndEnabled: false,
          taskAssigned: true,
          taskReminder: true,
          taskApproved: true,
          taskComment: true,
          urgentTicket: true
        }
      },
      {
        id: "usr-gm",
        nameAr: "\u0641\u0647\u062F \u0628\u0646 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646 \u0627\u0644\u0633\u0628\u064A\u0639\u064A",
        nameEn: "Fahad Al-Subaie",
        role: "gm",
        roleLabelAr: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0634\u0631\u0643\u0629 / \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
        roleLabelEn: "Company Manager",
        email: "fahad@aqarplus.sa",
        phone: "0505123401",
        approvalLimitSar: 5e5,
        active: true,
        deviceName: "Windows Desktop \xB7 \u0627\u0644\u0645\u0643\u062A\u0628 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
        lastActiveAt: now,
        statusState: "\u0645\u062A\u0635\u0644",
        specialty: "\u0627\u0644\u0625\u0634\u0631\u0627\u0641 \u0627\u0644\u0639\u0627\u0645 \u0648\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062A",
        managerRating: 5,
        lastActivitySummary: "\u0627\u0639\u062A\u0645\u062F \u0645\u0635\u0631\u0648\u0641 \u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0645\u062C\u0645\u0639 \u0642\u0628\u0644 18 \u062F\u0642\u064A\u0642\u0629",
        security: {
          twoFactorEnabled: false,
          biometricEnabled: true,
          failedAttempts: 0,
          lastPasswordChangedAt: "2026-10-25T10:00:00.000Z",
          requirePasswordChange90d: true
        },
        notificationPrefs: {
          dndEnabled: false,
          taskAssigned: true,
          taskReminder: true,
          taskApproved: true,
          taskComment: true,
          urgentTicket: true
        }
      },
      {
        id: "usr-acc",
        nameAr: "\u0633\u0644\u0645\u0627\u0646 \u0628\u0646 \u0646\u0627\u0635\u0631 \u0627\u0644\u062F\u0648\u0633\u0631\u064A",
        nameEn: "Salman Al-Dosari",
        role: "accountant",
        roleLabelAr: "\u0627\u0644\u0645\u062D\u0627\u0633\u0628 \u0627\u0644\u0645\u0627\u0644\u064A",
        roleLabelEn: "Financial Accountant",
        email: "salman@aqarplus.sa",
        phone: "0505123402",
        approvalLimitSar: 5e3,
        active: true,
        deviceName: "Windows Desktop \xB7 \u0642\u0633\u0645 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629",
        lastActiveAt: now,
        statusState: "\u0645\u062A\u0635\u0644",
        specialty: "\u0627\u0644\u062A\u062D\u0635\u064A\u0644 \u0648\u0627\u0644\u0625\u064A\u0635\u0627\u0644\u0627\u062A \u0648\u0627\u0644\u0642\u064A\u0648\u062F \u0627\u0644\u0645\u0627\u0644\u064A\u0629",
        managerRating: 4.8,
        lastActivitySummary: "\u0633\u062C\u0644 \u0633\u0646\u062F \u0642\u0628\u0636 9,000 \u0631.\u0633 \u0642\u0628\u0644 5 \u062F\u0642\u0627\u0626\u0642",
        security: {
          twoFactorEnabled: false,
          biometricEnabled: false,
          failedAttempts: 0,
          lastPasswordChangedAt: "2026-10-15T11:00:00.000Z",
          requirePasswordChange90d: true
        },
        notificationPrefs: {
          dndEnabled: false,
          taskAssigned: true,
          taskReminder: true,
          taskApproved: true,
          taskComment: true,
          urgentTicket: false
        }
      },
      {
        id: "usr-lease",
        nameAr: "\u0631\u064A\u0645 \u0628\u0646\u062A \u062E\u0627\u0644\u062F \u0627\u0644\u0639\u062A\u064A\u0628\u064A",
        nameEn: "Reem Al-Otaibi",
        role: "leasing",
        roleLabelAr: "\u0645\u0648\u0638\u0641 \u0627\u0644\u062A\u0623\u062C\u064A\u0631 \u0648\u0627\u0644\u0639\u0642\u0648\u062F",
        roleLabelEn: "Leasing Agent",
        email: "reem@aqarplus.sa",
        phone: "0505123403",
        approvalLimitSar: 1e3,
        active: true,
        deviceName: "iPad Pro \xB7 \u0645\u0643\u062A\u0628 \u0627\u0644\u062A\u0623\u062C\u064A\u0631",
        lastActiveAt: now,
        statusState: "\u0645\u0634\u063A\u0648\u0644",
        specialty: "\u0627\u0644\u0639\u0642\u0648\u062F \u0648\u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0627\u062A \u0648\u062A\u0648\u062B\u064A\u0642 \u0625\u064A\u062C\u0627\u0631",
        managerRating: 4.9,
        lastActivitySummary: "\u0623\u0631\u0633\u0644\u062A \u062A\u0630\u0643\u064A\u0631 \u062A\u062C\u062F\u064A\u062F \u0639\u0642\u062F \u0627\u0644\u0645\u0639\u0631\u0636 S-01 \u0642\u0628\u0644 12 \u062F\u0642\u064A\u0642\u0629",
        security: {
          twoFactorEnabled: false,
          biometricEnabled: true,
          failedAttempts: 0,
          lastPasswordChangedAt: "2026-11-01T08:30:00.000Z"
        },
        notificationPrefs: {
          dndEnabled: true,
          dndFrom: "21:00",
          dndTo: "08:00",
          taskAssigned: true,
          taskReminder: true,
          taskApproved: true,
          taskComment: true,
          urgentTicket: false
        }
      },
      {
        id: "usr-sup",
        nameAr: "\u0645\u0627\u062C\u062F \u0628\u0646 \u062A\u0631\u0643\u064A \u0627\u0644\u062D\u0631\u0628\u064A",
        nameEn: "Majed Al-Harbi",
        role: "supervisor",
        roleLabelAr: "\u0627\u0644\u0645\u0634\u0631\u0641 \u0627\u0644\u0639\u0642\u0627\u0631\u064A",
        roleLabelEn: "Property Supervisor",
        email: "majed@aqarplus.sa",
        phone: "0505123404",
        approvalLimitSar: 2e3,
        active: true,
        deviceName: "Android Tablet \xB7 \u0645\u064A\u062F\u0627\u0646\u064A",
        lastActiveAt: now,
        statusState: "\u0645\u062A\u0635\u0644",
        specialty: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0625\u0634\u063A\u0627\u0644 \u0648\u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645 \u0648\u0627\u0644\u0625\u062E\u0644\u0627\u0621",
        managerRating: 4.7,
        lastActivitySummary: "\u0631\u0627\u062C\u0639 \u0645\u0635\u0631\u0648\u0641 \u0635\u064A\u0627\u0646\u0629 B-204 \u0648\u0623\u062D\u0627\u0644\u0647 \u0644\u0644\u0645\u062F\u064A\u0631",
        security: {
          twoFactorEnabled: false,
          biometricEnabled: true,
          failedAttempts: 0,
          lastPasswordChangedAt: "2026-10-12T09:00:00.000Z"
        },
        notificationPrefs: {
          dndEnabled: false,
          taskAssigned: true,
          taskReminder: true,
          taskApproved: true,
          taskComment: true,
          urgentTicket: true
        }
      },
      {
        id: "usr-mm",
        nameAr: "\u0628\u062F\u0631 \u0628\u0646 \u0639\u0644\u064A \u0627\u0644\u063A\u0627\u0645\u062F\u064A",
        nameEn: "Badr Al-Ghamdi",
        role: "maint_manager",
        roleLabelAr: "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0635\u064A\u0627\u0646\u0629",
        roleLabelEn: "Maintenance Manager",
        email: "badr@aqarplus.sa",
        phone: "0505123406",
        approvalLimitSar: 1500,
        active: true,
        deviceName: "iPad Air \xB7 \u0642\u0633\u0645 \u0627\u0644\u0635\u064A\u0627\u0646\u0629",
        lastActiveAt: now,
        statusState: "\u0645\u062A\u0635\u0644",
        specialty: "\u062C\u062F\u0648\u0644\u0629 \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0648\u0627\u0644\u0645\u0642\u0627\u0648\u0644\u064A\u0646 \u0648\u0642\u0637\u0639 \u0627\u0644\u063A\u064A\u0627\u0631",
        managerRating: 4.6,
        lastActivitySummary: "\u0623\u0633\u0646\u062F \u0628\u0644\u0627\u063A \u062A\u0633\u0631\u0628 A-102 \u0644\u0644\u0641\u0646\u064A \u0639\u0645\u0631 \u0627\u0644\u0642\u062D\u0637\u0627\u0646\u064A",
        security: {
          twoFactorEnabled: false,
          biometricEnabled: true,
          failedAttempts: 0,
          lastPasswordChangedAt: "2026-10-28T09:00:00.000Z"
        },
        notificationPrefs: {
          dndEnabled: false,
          taskAssigned: true,
          taskReminder: true,
          taskApproved: true,
          taskComment: true,
          urgentTicket: true
        }
      },
      {
        id: "usr-tech",
        nameAr: "\u0639\u0645\u0631 \u0628\u0646 \u0633\u0639\u064A\u062F \u0627\u0644\u0642\u062D\u0637\u0627\u0646\u064A",
        nameEn: "Omar Al-Qahtani",
        role: "technician",
        roleLabelAr: "\u0641\u0646\u064A \u0627\u0644\u0635\u064A\u0627\u0646\u0629",
        roleLabelEn: "Maintenance Technician",
        email: "omar@aqarplus.sa",
        phone: "0505123405",
        approvalLimitSar: 300,
        active: true,
        deviceName: "Android Mobile \xB7 \u062C\u0648\u0627\u0644 \u0627\u0644\u0641\u0646\u064A",
        lastActiveAt: now,
        statusState: "\u0645\u0634\u063A\u0648\u0644",
        specialty: "\u062A\u0643\u064A\u064A\u0641 \u0648\u062A\u0628\u0631\u064A\u062F \u0648\u0633\u0628\u0627\u0643\u0629 \u0648\u0643\u0647\u0631\u0628\u0627\u0621",
        managerRating: 4.9,
        lastActivitySummary: "\u0631\u0641\u0639 \u062A\u0642\u0631\u064A\u0631 \u0641\u062D\u0635 \u0627\u0644\u0643\u0645\u0628\u0631\u0648\u0633\u0631 \u0648\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0635\u064A\u0627\u0646\u0629",
        security: {
          twoFactorEnabled: false,
          biometricEnabled: true,
          failedAttempts: 0,
          lastPasswordChangedAt: "2026-11-02T09:00:00.000Z"
        },
        notificationPrefs: {
          dndEnabled: false,
          taskAssigned: true,
          taskReminder: true,
          taskApproved: true,
          taskComment: true,
          urgentTicket: true
        }
      },
      {
        id: "usr-rec",
        nameAr: "\u0646\u0648\u0631\u0629 \u0628\u0646\u062A \u0633\u0639\u062F \u0627\u0644\u0642\u062D\u0637\u0627\u0646\u064A",
        nameEn: "Noura Al-Qahtani",
        role: "receptionist",
        roleLabelAr: "\u0645\u0648\u0638\u0641 \u0627\u0644\u0627\u0633\u062A\u0642\u0628\u0627\u0644",
        roleLabelEn: "Receptionist",
        email: "noura@aqarplus.sa",
        phone: "0505123407",
        approvalLimitSar: 0,
        active: true,
        deviceName: "Windows Reception \xB7 \u0645\u0643\u062A\u0628 \u0627\u0644\u0627\u0633\u062A\u0642\u0628\u0627\u0644",
        lastActiveAt: "2026-11-14T09:40:00.000Z",
        statusState: "\u0645\u062A\u0635\u0644",
        specialty: "\u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0648\u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0627\u0633\u062A\u0641\u0633\u0627\u0631\u0627\u062A \u0627\u0644\u0623\u0648\u0644\u064A\u0629",
        managerRating: 4.5,
        lastActivitySummary: "\u0627\u0633\u062A\u0642\u0628\u0644\u062A 3 \u0627\u0633\u062A\u0641\u0633\u0627\u0631\u0627\u062A \u0645\u0639\u0627\u064A\u0646\u0629 \u0644\u0648\u062D\u062F\u0627\u062A \u0627\u0644\u0645\u0644\u0642\u0627",
        security: {
          twoFactorEnabled: false,
          biometricEnabled: false,
          failedAttempts: 0,
          lastPasswordChangedAt: "2026-10-30T09:00:00.000Z"
        },
        notificationPrefs: {
          dndEnabled: false,
          taskAssigned: true,
          taskReminder: true,
          taskApproved: false,
          taskComment: true,
          urgentTicket: false
        }
      },
      {
        id: "usr-aud",
        nameAr: "\u062E\u0627\u0644\u062F \u0628\u0646 \u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0627\u0644\u0645\u0646\u064A\u0641",
        nameEn: "Khalid Al-Muneef",
        role: "auditor",
        roleLabelAr: "\u0627\u0644\u0645\u0631\u0627\u062C\u0639",
        roleLabelEn: "Auditor",
        email: "audit@aqarplus.sa",
        phone: "0505123408",
        approvalLimitSar: 0,
        active: true,
        deviceName: "Laptop \xB7 \u0648\u062D\u062F\u0629 \u0627\u0644\u0631\u0642\u0627\u0628\u0629 \u0648\u0627\u0644\u062A\u062F\u0642\u064A\u0642",
        lastActiveAt: "2026-11-14T08:50:00.000Z",
        statusState: "\u063A\u064A\u0631 \u0645\u062A\u0635\u0644",
        specialty: "\u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629 \u0648\u0641\u062D\u0635 \u0627\u0644\u0627\u0645\u062A\u062B\u0627\u0644",
        managerRating: 5,
        lastActivitySummary: "\u0635\u062F\u0651\u0631 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u062A\u062F\u0642\u064A\u0642 \u0627\u0644\u0634\u0647\u0631\u064A \u0648\u0633\u062C\u0644 \u0627\u0644\u0639\u0643\u0633 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u064A",
        security: {
          twoFactorEnabled: false,
          biometricEnabled: false,
          failedAttempts: 0,
          lastPasswordChangedAt: "2026-10-18T09:00:00.000Z",
          requirePasswordChange90d: true
        },
        notificationPrefs: {
          dndEnabled: true,
          dndFrom: "18:00",
          dndTo: "08:00",
          taskAssigned: false,
          taskReminder: false,
          taskApproved: false,
          taskComment: false,
          urgentTicket: false
        }
      },
      {
        id: "usr-owner",
        nameAr: "\u0627\u0644\u0634\u064A\u062E \u0639\u0628\u062F\u0627\u0644\u0639\u0632\u064A\u0632 \u0628\u0646 \u0645\u062D\u0645\u062F \u0627\u0644\u0631\u0627\u062C\u062D\u064A",
        nameEn: "Abdulaziz Al-Rajhi",
        role: "owner",
        roleLabelAr: "\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0627\u0644\u0643",
        roleLabelEn: "Property Owner",
        email: "owner.rajhi@aqarplus.sa",
        phone: "0559812200",
        approvalLimitSar: 0,
        active: true,
        ownerId: "own-1",
        deviceName: "iPhone \xB7 \u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0627\u0644\u0643",
        lastActiveAt: now,
        statusState: "\u063A\u064A\u0631 \u0645\u062A\u0635\u0644",
        specialty: "\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0639\u0648\u0627\u0626\u062F \u0648\u0643\u0634\u0648\u0641 \u0627\u0644\u0645\u0644\u0627\u0643"
      }
    ],
    rolePermissions: DEFAULT_ROLE_PERMISSIONS,
    owners: [
      {
        id: "own-1",
        nameAr: "\u0639\u0628\u062F\u0627\u0644\u0639\u0632\u064A\u0632 \u0628\u0646 \u0645\u062D\u0645\u062F \u0627\u0644\u0631\u0627\u062C\u062D\u064A",
        nameEn: "Abdulaziz Al-Rajhi",
        nationalId: "1029384756",
        phone: "0559812200",
        email: "a.rajhi@outlook.sa",
        iban: "SA4480000123608010998821",
        bankName: "\u0645\u0635\u0631\u0641 \u0627\u0644\u0631\u0627\u062C\u062D\u064A",
        totalTransferred: 145e3,
        notes: "\u0645\u0627\u0644\u0643 \u0645\u062C\u0645\u0639 \u0627\u0644\u064A\u0627\u0633\u0645\u064A\u0646 \u0627\u0644\u0633\u0643\u0646\u064A \u0648\u0634\u0631\u064A\u0643 \u0641\u064A \u0628\u0631\u062C \u0627\u0644\u0645\u0644\u0642\u0627"
      },
      {
        id: "own-2",
        nameAr: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0646\u062E\u0628\u0629 \u0644\u0644\u0627\u0633\u062A\u062B\u0645\u0627\u0631 \u0627\u0644\u0639\u0642\u0627\u0631\u064A",
        nameEn: "Al-Nukhbah Real Estate Investment",
        nationalId: "7001928374",
        phone: "0112983300",
        email: "finance@nukhbah.sa",
        iban: "SA1910000041200009182734",
        bankName: "\u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0623\u0647\u0644\u064A \u0627\u0644\u0633\u0639\u0648\u062F\u064A",
        totalTransferred: 82e3,
        notes: "\u0634\u0631\u064A\u0643 \u0628\u0646\u0633\u0628\u0629 40% \u0641\u064A \u0628\u0631\u062C \u0627\u0644\u0645\u0644\u0642\u0627 \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0627\u0644\u0633\u0643\u0646\u064A"
      }
    ],
    vendors: [
      {
        id: "vnd-1",
        nameAr: "\u0645\u0624\u0633\u0633\u0629 \u0646\u0633\u064A\u0645 \u0644\u0644\u062A\u0643\u064A\u064A\u0641 \u0648\u0627\u0644\u062A\u0628\u0631\u064A\u062F",
        nameEn: "Naseem HVAC Services",
        crNumber: "1010928371",
        vatNumber: "310884422100003",
        category: "\u062A\u0643\u064A\u064A\u0641 \u0648\u062A\u0628\u0631\u064A\u062F",
        city: "\u0627\u0644\u0631\u064A\u0627\u0636",
        nationalAddress: "RYDA8821 \xB7 \u062D\u064A \u0627\u0644\u064A\u0627\u0633\u0645\u064A\u0646",
        iban: "SA1910000041200009911220",
        contactPerson: "\u0645. \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646 \u0627\u0644\u0634\u0645\u0631\u064A",
        phone: "0508819201",
        email: "orders@naseem-hvac.sa",
        rating: 4.8,
        ratingBreakdown: { quality: 4.9, punctuality: 4.8, pricing: 4.6, cooperation: 4.9 },
        avgExecutionDays: 1.5,
        complaintsCount: 0,
        active: true
      },
      {
        id: "vnd-2",
        nameAr: "\u0634\u0631\u0643\u0629 \u0631\u0643\u0627\u0626\u0632 \u0627\u0644\u0633\u0628\u0627\u0643\u0629 \u0648\u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621",
        nameEn: "Rakaiz MEP Contracting",
        crNumber: "1010445566",
        vatNumber: "310772233400003",
        category: "\u0633\u0628\u0627\u0643\u0629 \u0648\u0643\u0647\u0631\u0628\u0627\u0621",
        city: "\u0627\u0644\u0631\u064A\u0627\u0636",
        nationalAddress: "RYDM4410 \xB7 \u062D\u064A \u0627\u0644\u0645\u0644\u0642\u0627",
        iban: "SA4480000123608010556677",
        contactPerson: "\u0623\u062D\u0645\u062F \u0628\u0646 \u0635\u0627\u0644\u062D \u0627\u0644\u0632\u0647\u0631\u0627\u0646\u064A",
        phone: "0553312299",
        email: "billing@rakaiz.sa",
        rating: 4.5,
        ratingBreakdown: { quality: 4.7, punctuality: 4.3, pricing: 4.5, cooperation: 4.5 },
        avgExecutionDays: 2.2,
        complaintsCount: 1,
        active: true
      },
      {
        id: "vnd-3",
        nameAr: "\u0645\u0624\u0633\u0633\u0629 \u0625\u0634\u0631\u0627\u0642\u0629 \u0644\u0644\u0646\u0638\u0627\u0641\u0629 \u0648\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0631\u0627\u0641\u0642",
        nameEn: "Ishraqah Facility Care",
        crNumber: "1010778899",
        vatNumber: "310661188200003",
        category: "\u0646\u0638\u0627\u0641\u0629 \u0648\u0635\u064A\u0627\u0646\u0629 \u0639\u0627\u0645\u0629",
        city: "\u0627\u0644\u0631\u064A\u0627\u0636",
        nationalAddress: "RYDO1104 \xB7 \u062D\u064A \u0627\u0644\u0639\u0644\u064A\u0627",
        iban: "SA5520000001928374650011",
        contactPerson: "\u0633\u0639\u062F \u0628\u0646 \u0641\u0647\u062F \u0627\u0644\u0645\u0637\u064A\u0631\u064A",
        phone: "0541129988",
        email: "care@ishraqah.sa",
        rating: 4.7,
        ratingBreakdown: { quality: 4.8, punctuality: 4.7, pricing: 4.6, cooperation: 4.7 },
        avgExecutionDays: 1,
        complaintsCount: 0,
        active: true
      }
    ],
    properties: [
      {
        id: "prop-1",
        companyId: "comp-1",
        ownershipMode: "\u0625\u062F\u0627\u0631\u0629 \u0644\u0644\u063A\u064A\u0631",
        code: "RYD-YAS-01",
        nameAr: "\u0645\u062C\u0645\u0639 \u0627\u0644\u064A\u0627\u0633\u0645\u064A\u0646 \u0627\u0644\u0633\u0643\u0646\u064A",
        nameEn: "Al-Yasmin Residential Complex",
        city: "\u0627\u0644\u0631\u064A\u0627\u0636",
        district: "\u062D\u064A \u0627\u0644\u064A\u0627\u0633\u0645\u064A\u0646",
        street: "\u0637\u0631\u064A\u0642 \u0623\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643",
        nationalAddress: "RYDA7412 \xB7 13325",
        type: "\u0633\u0643\u0646\u064A",
        deedNumber: "410109034821",
        status: "\u0646\u0634\u0637",
        buildingsCount: 2,
        floorsCount: 4,
        managementFeePercent: 5,
        ownerShares: [{ ownerId: "own-1", sharePercent: 100 }],
        electricityMeterMain: "SEC-30918274",
        waterMeterMain: "NWC-8819201",
        caretakerName: "\u0645\u062D\u0645\u062F \u0625\u0642\u0628\u0627\u0644",
        caretakerPhone: "0539011223",
        createdAt: "2025-01-10T08:00:00.000Z"
      },
      {
        id: "prop-2",
        companyId: "comp-2",
        ownershipMode: "\u0645\u0644\u0643\u064A\u0629 \u0645\u0634\u062A\u0631\u0643\u0629",
        code: "RYD-MLQ-02",
        nameAr: "\u0628\u0631\u062C \u0627\u0644\u0645\u0644\u0642\u0627 \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0627\u0644\u0633\u0643\u0646\u064A",
        nameEn: "Al-Malqa Mixed-Use Tower",
        city: "\u0627\u0644\u0631\u064A\u0627\u0636",
        district: "\u062D\u064A \u0627\u0644\u0645\u0644\u0642\u0627",
        street: "\u0637\u0631\u064A\u0642 \u0623\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643 \u062A\u0642\u0627\u0637\u0639 \u0627\u0644\u062E\u064A\u0631",
        nationalAddress: "RYDM3910 \xB7 13524",
        type: "\u0645\u062E\u062A\u0644\u0637",
        deedNumber: "410108991122",
        status: "\u0646\u0634\u0637",
        buildingsCount: 1,
        floorsCount: 6,
        managementFeePercent: 6,
        ownerShares: [
          { ownerId: "own-1", sharePercent: 60 },
          { ownerId: "own-2", sharePercent: 40 }
        ],
        electricityMeterMain: "SEC-99102938",
        waterMeterMain: "NWC-5510291",
        caretakerName: "\u0623\u0634\u0631\u0641 \u0639\u0644\u064A",
        caretakerPhone: "0534455667",
        createdAt: "2025-04-01T08:00:00.000Z"
      }
    ],
    units: [
      {
        id: "unit-101",
        propertyId: "prop-1",
        buildingName: "\u0645\u0628\u0646\u0649 \u0623",
        floor: 1,
        unitNumber: "A-101",
        unitType: "\u0634\u0642\u0629",
        areaSqm: 135,
        rooms: 3,
        bathrooms: 2,
        furnished: false,
        acCount: 4,
        electricityMeter: "E-101-882",
        waterMeter: "W-101-21",
        keyCount: 4,
        acRemoteCount: 4,
        suggestedMonthlyRent: 4e3,
        suggestedAnnualRent: 48e3,
        officeFee: 1200,
        status: "\u0645\u0624\u062C\u0631\u0629",
        notes: "\u0634\u0642\u0629 \u0632\u0627\u0648\u064A\u0629 \u0645\u0637\u0644\u0629 \u0639\u0644\u0649 \u0627\u0644\u062D\u062F\u064A\u0642\u0629 \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629"
      },
      {
        id: "unit-102",
        propertyId: "prop-1",
        buildingName: "\u0645\u0628\u0646\u0649 \u0623",
        floor: 1,
        unitNumber: "A-102",
        unitType: "\u0634\u0642\u0629",
        areaSqm: 120,
        rooms: 3,
        bathrooms: 2,
        furnished: true,
        acCount: 4,
        electricityMeter: "E-102-883",
        waterMeter: "W-102-22",
        keyCount: 3,
        acRemoteCount: 4,
        suggestedMonthlyRent: 4500,
        suggestedAnnualRent: 54e3,
        officeFee: 1350,
        status: "\u0645\u062A\u0623\u062E\u0631\u0629 \u0641\u064A \u0627\u0644\u0633\u062F\u0627\u062F",
        notes: "\u062A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0645\u0637\u0628\u062E \u0631\u0627\u0643\u0628 \u0648\u0645\u0643\u064A\u0641\u0627\u062A \u0633\u0628\u0644\u064A\u062A \u062D\u062F\u064A\u062B\u0629"
      },
      {
        id: "unit-103",
        propertyId: "prop-1",
        buildingName: "\u0645\u0628\u0646\u0649 \u0623",
        floor: 2,
        unitNumber: "A-201",
        unitType: "\u0634\u0642\u0629",
        areaSqm: 110,
        rooms: 2,
        bathrooms: 2,
        furnished: false,
        acCount: 3,
        electricityMeter: "E-201-884",
        waterMeter: "W-201-23",
        keyCount: 3,
        acRemoteCount: 3,
        suggestedMonthlyRent: 3500,
        suggestedAnnualRent: 42e3,
        officeFee: 1050,
        status: "\u0634\u0627\u063A\u0631\u0629",
        vacantSince: "2026-10-20",
        notes: "\u062C\u0627\u0647\u0632\u0629 \u0644\u0644\u0645\u0639\u0627\u064A\u0646\u0629 \u0648\u0627\u0644\u062A\u0623\u062C\u064A\u0631 \u0627\u0644\u0641\u0648\u0631\u064A"
      },
      {
        id: "unit-104",
        propertyId: "prop-1",
        buildingName: "\u0645\u0628\u0646\u0649 \u0628",
        floor: 2,
        unitNumber: "B-204",
        unitType: "\u0634\u0642\u0629",
        areaSqm: 140,
        rooms: 4,
        bathrooms: 3,
        furnished: false,
        acCount: 5,
        electricityMeter: "E-204-885",
        waterMeter: "W-204-24",
        keyCount: 5,
        acRemoteCount: 5,
        suggestedMonthlyRent: 4800,
        suggestedAnnualRent: 57600,
        officeFee: 1400,
        status: "\u062A\u062D\u062A \u0627\u0644\u0635\u064A\u0627\u0646\u0629",
        notes: "\u064A\u062C\u0631\u064A \u0627\u0633\u062A\u0628\u062F\u0627\u0644 \u0643\u0645\u0628\u0631\u0648\u0633\u0631 \u0645\u0643\u064A\u0641 \u0627\u0644\u0635\u0627\u0644\u0629"
      },
      {
        id: "unit-201",
        propertyId: "prop-2",
        buildingName: "\u0627\u0644\u0628\u0631\u062C \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
        floor: 0,
        unitNumber: "S-01",
        unitType: "\u0645\u0639\u0631\u0636 \u062A\u062C\u0627\u0631\u064A",
        areaSqm: 210,
        rooms: 2,
        bathrooms: 2,
        furnished: false,
        acCount: 4,
        electricityMeter: "E-S01-901",
        waterMeter: "W-S01-09",
        keyCount: 2,
        acRemoteCount: 4,
        suggestedMonthlyRent: 1e4,
        suggestedAnnualRent: 12e4,
        officeFee: 3e3,
        status: "\u0645\u0624\u062C\u0631\u0629",
        notes: "\u0648\u0627\u062C\u0647\u0629 \u0632\u062C\u0627\u062C\u064A\u0629 \u0639\u0644\u0649 \u0627\u0644\u0637\u0631\u064A\u0642 \u0627\u0644\u0631\u0626\u064A\u0633\u064A"
      },
      {
        id: "unit-202",
        propertyId: "prop-2",
        buildingName: "\u0627\u0644\u0628\u0631\u062C \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
        floor: 3,
        unitNumber: "M-302",
        unitType: "\u0645\u0643\u062A\u0628",
        areaSqm: 95,
        rooms: 3,
        bathrooms: 1,
        furnished: false,
        acCount: 3,
        electricityMeter: "E-302-902",
        waterMeter: "W-302-10",
        keyCount: 3,
        acRemoteCount: 3,
        suggestedMonthlyRent: 4e3,
        suggestedAnnualRent: 48e3,
        officeFee: 1200,
        status: "\u0645\u062D\u062C\u0648\u0632\u0629",
        linkedTenantId: "ten-4",
        notes: "\u0645\u0631\u062A\u0628\u0637 \u0628\u0645\u0633\u062A\u0623\u062C\u0631 \u0625\u062F\u0627\u0631\u064A\u0627\u064B \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0648\u062B\u064A\u0642 \u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631"
      },
      {
        id: "unit-203",
        propertyId: "prop-2",
        buildingName: "\u0627\u0644\u0628\u0631\u062C \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
        floor: 4,
        unitNumber: "M-405",
        unitType: "\u0645\u0643\u062A\u0628",
        areaSqm: 85,
        rooms: 2,
        bathrooms: 1,
        furnished: false,
        acCount: 2,
        electricityMeter: "E-405-903",
        waterMeter: "W-405-11",
        keyCount: 2,
        acRemoteCount: 2,
        suggestedMonthlyRent: 3600,
        suggestedAnnualRent: 43200,
        officeFee: 1e3,
        status: "\u062A\u062D\u062A\u0627\u062C \u0625\u0644\u0649 \u062A\u0646\u0638\u064A\u0641",
        vacantSince: "2026-11-11",
        notes: "\u062A\u0645 \u0625\u062E\u0644\u0627\u0621 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u0627\u0644\u0633\u0627\u0628\u0642 \u0648\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u062C\u0647\u064A\u0632"
      },
      {
        id: "unit-arch-1",
        propertyId: "prop-1",
        buildingName: "\u0645\u0644\u062D\u0642 \u0627\u0644\u0633\u0637\u062D",
        floor: 4,
        unitNumber: "R-401",
        unitType: "\u0627\u0633\u062A\u0648\u062F\u064A\u0648",
        areaSqm: 58,
        rooms: 1,
        bathrooms: 1,
        furnished: false,
        acCount: 1,
        electricityMeter: "E-401-701",
        waterMeter: "W-401-19",
        keyCount: 2,
        acRemoteCount: 1,
        suggestedMonthlyRent: 2200,
        suggestedAnnualRent: 26400,
        officeFee: 700,
        status: "\u0645\u0648\u0642\u0648\u0641\u0629",
        linkedTenantId: "ten-arch-1",
        notes: "\u062A\u0645 \u0625\u062E\u0631\u0627\u062C \u0627\u0644\u0648\u062D\u062F\u0629 \u0645\u0624\u0642\u062A\u0627\u064B \u0644\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u0623\u0633\u064A\u0633 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064A \u0648\u0627\u0644\u062A\u0631\u0645\u064A\u0645 \u0627\u0644\u0634\u0627\u0645\u0644",
        archivedAt: "2026-09-18T11:30:00.000Z",
        archiveReason: "\u0625\u063A\u0644\u0627\u0642 \u0644\u0644\u062A\u0631\u0645\u064A\u0645 \u0648\u062A\u062C\u062F\u064A\u062F \u0627\u0644\u0634\u0628\u0643\u0629 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064A\u0629",
        archivedBy: "usr-sup",
        archiveMode: "\u064A\u062F\u0648\u064A",
        preArchiveStatus: "\u0634\u0627\u063A\u0631\u0629"
      },
      {
        id: "unit-arch-2",
        propertyId: "prop-2",
        buildingName: "\u0627\u0644\u0628\u0631\u062C \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
        floor: 1,
        unitNumber: "M-108",
        unitType: "\u0645\u0643\u062A\u0628",
        areaSqm: 72,
        rooms: 2,
        bathrooms: 1,
        furnished: false,
        acCount: 2,
        electricityMeter: "E-108-799",
        waterMeter: "W-108-05",
        keyCount: 2,
        acRemoteCount: 2,
        suggestedMonthlyRent: 3200,
        suggestedAnnualRent: 38400,
        officeFee: 950,
        status: "\u0645\u0624\u0631\u0634\u0641\u0629",
        linkedTenantId: "ten-arch-2",
        notes: "\u062A\u0645 \u062F\u0645\u062C \u0627\u0644\u0645\u0633\u0627\u062D\u0629 \u0645\u0639 \u0627\u0644\u0645\u0639\u0631\u0636 \u0627\u0644\u0623\u0631\u0636\u064A \u062D\u0633\u0628 \u0642\u0631\u0627\u0631 \u0627\u0644\u0645\u0644\u0627\u0643",
        archivedAt: "2025-12-28T10:00:00.000Z",
        archiveReason: "\u062F\u0645\u062C \u0645\u0639\u0645\u0627\u0631\u064A \u0645\u0639 \u0648\u062D\u062F\u0629 \u0645\u062C\u0627\u0648\u0631\u0629",
        archivedBy: "usr-gm",
        archiveMode: "\u062A\u0644\u0642\u0627\u0626\u064A",
        preArchiveStatus: "\u0634\u0627\u063A\u0631\u0629"
      }
    ],
    tenants: [
      {
        id: "ten-1",
        nameAr: "\u0628\u0646\u062F\u0631 \u0628\u0646 \u0645\u062D\u0645\u062F \u0627\u0644\u063A\u0627\u0645\u062F\u064A",
        nameEn: "Bandar Al-Ghamdi",
        nationalIdOrIqama: "1088442211",
        nationality: "\u0633\u0639\u0648\u062F\u064A",
        phone: "0551122334",
        altPhone: "0509988771",
        email: "bandar.g@gmail.com",
        employer: "\u0627\u0644\u0647\u064A\u0626\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629 \u0644\u0644\u0628\u064A\u0627\u0646\u0627\u062A",
        tenantType: "\u0639\u0627\u0626\u0644\u0629",
        birthDate: "1988-04-12",
        maritalStatus: "\u0645\u062A\u0632\u0648\u062C",
        familyMembersCount: 4,
        emergencyContactName: "\u0645\u062D\u0645\u062F \u0627\u0644\u063A\u0627\u0645\u062F\u064A (\u0627\u0644\u0623\u062E)",
        emergencyContactPhone: "0504411229",
        nationalAddress: "RYDA7412 \xB7 \u062D\u064A \u0627\u0644\u064A\u0627\u0633\u0645\u064A\u0646 \xB7 \u0627\u0644\u0631\u064A\u0627\u0636",
        classification: "\u0646\u0634\u0637",
        rating: 5,
        behaviorScores: { paymentCommitment: 5, unitCare: 5, cooperation: 5, penaltyTotal: 0 },
        violationNotes: [
          {
            id: "vn-1",
            title: "\u0625\u0634\u0627\u062F\u0629 \u0627\u0644\u062A\u0632\u0627\u0645 \u0628\u0627\u0644\u0633\u062F\u0627\u062F \u0627\u0644\u0645\u0628\u0643\u0631",
            category: "\u0625\u0634\u0627\u062F\u0629",
            details: "\u0633\u062F\u062F \u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u0642\u0633\u0627\u0637 \u0642\u0628\u0644 \u0645\u0648\u0639\u062F \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u062F\u0648\u0646 \u0623\u064A \u062A\u0623\u062E\u064A\u0631.",
            createdBy: "usr-acc",
            createdAt: "2026-07-14T12:00:00.000Z"
          }
        ],
        onboardingChecklist: {
          idVerified: true,
          docsArchived: true,
          depositPaid: true,
          contractSigned: true,
          ejarRegistered: true,
          handoverSigned: true
        },
        notes: "\u0645\u0633\u062A\u0623\u062C\u0631 \u0645\u0644\u062A\u0632\u0645 \u0628\u0627\u0644\u0633\u062F\u0627\u062F \u0627\u0644\u0645\u0628\u0643\u0631",
        createdAt: "2026-01-12T09:00:00.000Z"
      },
      {
        id: "ten-2",
        nameAr: "\u0637\u0627\u0631\u0642 \u0628\u0646 \u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0627\u0644\u0634\u0647\u0631\u064A",
        nameEn: "Tariq Al-Shehri",
        nationalIdOrIqama: "1077331199",
        nationality: "\u0633\u0639\u0648\u062F\u064A",
        phone: "0547788990",
        altPhone: "0558800112",
        email: "tariq.s@yahoo.com",
        employer: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0627\u062A\u0635\u0627\u0644\u0627\u062A \u0627\u0644\u0645\u062A\u0642\u062F\u0645\u0629",
        tenantType: "\u0641\u0631\u062F",
        birthDate: "1992-09-21",
        maritalStatus: "\u0623\u0639\u0632\u0628",
        emergencyContactName: "\u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0627\u0644\u0634\u0647\u0631\u064A (\u0627\u0644\u0648\u0627\u0644\u062F)",
        emergencyContactPhone: "0501199882",
        nationalAddress: "RYDA7415 \xB7 \u062D\u064A \u0627\u0644\u064A\u0627\u0633\u0645\u064A\u0646 \xB7 \u0627\u0644\u0631\u064A\u0627\u0636",
        classification: "\u0646\u0634\u0637",
        rating: 3,
        behaviorScores: { paymentCommitment: 3, unitCare: 4, cooperation: 4, penaltyTotal: 250 },
        violationNotes: [
          {
            id: "vn-2",
            title: "\u062A\u0623\u062E\u0631 \u0641\u064A \u0627\u0644\u0642\u0633\u0637 \u0627\u0644\u062B\u0627\u0644\u062B \u0648\u0627\u0644\u0631\u0627\u0628\u0639",
            category: "\u062A\u0623\u062E\u0631 \u0633\u062F\u0627\u062F",
            details: "\u062A\u0645 \u0633\u062F\u0627\u062F 9,000 \u0631.\u0633 \u062C\u0632\u0626\u064A\u0627\u064B \u0645\u0646 \u0627\u0644\u0642\u0633\u0637 \u0627\u0644\u062B\u0627\u0644\u062B \u0648\u062C\u0627\u0631\u064D \u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0645\u062A\u0628\u0642\u064A.",
            createdBy: "usr-acc",
            createdAt: "2026-11-05T10:30:00.000Z"
          }
        ],
        onboardingChecklist: {
          idVerified: true,
          docsArchived: true,
          depositPaid: true,
          contractSigned: true,
          ejarRegistered: true,
          handoverSigned: true
        },
        notes: "\u0644\u062F\u064A\u0647 \u062F\u0641\u0639\u0629 \u062C\u0632\u0626\u064A\u0629 \u0648\u0645\u062A\u0628\u0642\u064D \u0642\u064A\u062F \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629",
        createdAt: "2026-02-01T09:00:00.000Z"
      },
      {
        id: "ten-3",
        nameAr: "\u0645\u0624\u0633\u0633\u0629 \u0645\u0630\u0627\u0642 \u0627\u0644\u0628\u0646 \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629",
        nameEn: "Mazaq Al-Bun Trading Est.",
        nationalIdOrIqama: "7022119988",
        nationality: "\u0643\u064A\u0627\u0646 \u062A\u062C\u0627\u0631\u064A \u0633\u0639\u0648\u062F\u064A",
        phone: "0502233445",
        altPhone: "0114422990",
        email: "accounts@mazaqbun.sa",
        employer: "\u0633\u062C\u0644 \u062A\u062C\u0627\u0631\u064A 1010554433",
        tenantType: "\u0634\u0631\u0643\u0629",
        emergencyContactName: "\u0648\u0644\u064A\u062F \u0627\u0644\u0642\u062D\u0637\u0627\u0646\u064A (\u0645\u062F\u064A\u0631 \u0627\u0644\u062A\u0634\u063A\u064A\u0644)",
        emergencyContactPhone: "0559922110",
        nationalAddress: "RYDM3910 \xB7 \u0637\u0631\u064A\u0642 \u0623\u0646\u0633 \u0628\u0646 \u0645\u0627\u0644\u0643 \xB7 \u0627\u0644\u0631\u064A\u0627\u0636",
        classification: "\u0646\u0634\u0637",
        rating: 4,
        behaviorScores: { paymentCommitment: 4, unitCare: 5, cooperation: 4, penaltyTotal: 0 },
        violationNotes: [],
        onboardingChecklist: {
          idVerified: true,
          docsArchived: true,
          depositPaid: true,
          contractSigned: true,
          ejarRegistered: true,
          handoverSigned: true
        },
        notes: "\u0645\u0633\u062A\u0623\u062C\u0631 \u0627\u0644\u0645\u0639\u0631\u0636 \u0627\u0644\u062A\u062C\u0627\u0631\u064A S-01",
        createdAt: "2025-11-20T09:00:00.000Z"
      },
      {
        id: "ten-4",
        nameAr: "\u064A\u0627\u0633\u0631 \u0628\u0646 \u0639\u0628\u062F\u0627\u0644\u0644\u0647 \u0627\u0644\u0645\u0646\u0635\u0648\u0631",
        nameEn: "Yasser Al-Mansour",
        nationalIdOrIqama: "1099887766",
        nationality: "\u0633\u0639\u0648\u062F\u064A",
        phone: "0564455112",
        email: "yasser.m@domain.sa",
        employer: "\u0645\u0643\u062A\u0628 \u0627\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0627\u062A \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629",
        tenantType: "\u0641\u0631\u062F",
        birthDate: "1985-11-02",
        maritalStatus: "\u0645\u062A\u0632\u0648\u062C",
        classification: "\u0645\u062D\u062A\u0645\u0644",
        rating: 4,
        behaviorScores: { paymentCommitment: 4, unitCare: 4, cooperation: 5, penaltyTotal: 0 },
        onboardingChecklist: {
          idVerified: true,
          docsArchived: true,
          depositPaid: false,
          contractSigned: false,
          ejarRegistered: false,
          handoverSigned: false
        },
        notes: "\u0645\u0631\u0628\u0648\u0637 \u0625\u062F\u0627\u0631\u064A\u0627\u064B \u0628\u0627\u0644\u0645\u0643\u062A\u0628 M-302 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0639\u0642\u062F \u0641\u064A \u0625\u064A\u062C\u0627\u0631",
        createdAt: "2026-11-10T11:00:00.000Z"
      },
      {
        id: "ten-arch-1",
        nameAr: "\u062E\u0627\u0644\u062F \u0628\u0646 \u0633\u0639\u0648\u062F \u0627\u0644\u0639\u0644\u064A\u0627\u0646",
        nameEn: "Khalid Al-Olayan",
        nationalIdOrIqama: "1055667788",
        nationality: "\u0633\u0639\u0648\u062F\u064A",
        phone: "0557711223",
        email: "khalid.olayan@gmail.com",
        employer: "\u0634\u0631\u0643\u0629 \u0633\u0627\u0628\u0643 \u0644\u0644\u062A\u0642\u0646\u064A\u0629",
        tenantType: "\u0641\u0631\u062F",
        maritalStatus: "\u0623\u0639\u0632\u0628",
        classification: "\u0633\u0627\u0628\u0642",
        rating: 5,
        behaviorScores: { paymentCommitment: 5, unitCare: 5, cooperation: 5, penaltyTotal: 0 },
        notes: "\u0633\u062F\u062F \u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u0642\u0633\u0627\u0637 \u0642\u0628\u0644 \u0645\u0648\u0639\u062F\u0647\u0627 \u0648\u0623\u0633\u0644\u0645 \u0627\u0644\u0648\u062D\u062F\u0629 R-401 \u0628\u062D\u0627\u0644\u0629 \u0645\u0645\u062A\u0627\u0632\u0629",
        createdAt: "2024-10-01T08:00:00.000Z",
        archivedAt: "2026-09-15T14:00:00.000Z",
        archiveReason: "\u0627\u0646\u062A\u0647\u0627\u0621 \u0645\u062F\u0629 \u0627\u0644\u0639\u0642\u062F \u0648\u0627\u0644\u0625\u062E\u0644\u0627\u0621 \u0627\u0644\u0646\u0638\u0627\u0645\u064A \u0628\u0646\u062C\u0627\u062D",
        archivedBy: "usr-lease",
        archiveMode: "\u062A\u0644\u0642\u0627\u0626\u064A",
        preArchiveStatus: "\u0646\u0634\u0637"
      },
      {
        id: "ten-arch-2",
        nameAr: "\u0645\u0624\u0633\u0633\u0629 \u0623\u0641\u0642 \u0627\u0644\u0631\u064A\u0627\u0636 \u0644\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0627\u062A",
        nameEn: "Ofoq Riyadh Consulting Est.",
        nationalIdOrIqama: "7008822114",
        nationality: "\u0643\u064A\u0627\u0646 \u062A\u062C\u0627\u0631\u064A \u0633\u0639\u0648\u062F\u064A",
        phone: "0508822199",
        email: "admin@ofoq-sa.com",
        employer: "\u0633\u062C\u0644 \u062A\u062C\u0627\u0631\u064A 1010449922",
        tenantType: "\u0634\u0631\u0643\u0629",
        classification: "\u0633\u0627\u0628\u0642",
        rating: 2,
        behaviorScores: { paymentCommitment: 2, unitCare: 3, cooperation: 2, penaltyTotal: 1200 },
        notes: "\u062A\u0623\u062E\u0631 \u0645\u062A\u0643\u0631\u0631 \u0641\u064A \u0627\u0644\u0642\u0633\u0637 \u0627\u0644\u0623\u062E\u064A\u0631 \u0648\u062A\u0645\u062A \u062A\u0633\u0648\u064A\u0629 \u0627\u0644\u0625\u062E\u0644\u0627\u0621 \u0645\u0639 \u062E\u0635\u0645 \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0645\u0646 \u0627\u0644\u062A\u0623\u0645\u064A\u0646",
        createdAt: "2024-11-15T09:00:00.000Z",
        archivedAt: "2025-12-20T16:10:00.000Z",
        archiveReason: "\u0625\u062E\u0644\u0627\u0621 \u0628\u0639\u062F \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0639\u0642\u062F \u0627\u0644\u062A\u062C\u0627\u0631\u064A \u0645\u0639 \u0645\u0644\u0627\u062D\u0638\u0627\u062A \u062A\u0623\u062E\u0631 \u0633\u062F\u0627\u062F",
        archivedBy: "usr-acc",
        archiveMode: "\u062A\u0644\u0642\u0627\u0626\u064A",
        preArchiveStatus: "\u0646\u0634\u0637"
      }
    ],
    leads: [
      {
        id: "lead-1",
        nameAr: "\u0641\u064A\u0635\u0644 \u0628\u0646 \u0646\u0627\u0635\u0631 \u0627\u0644\u0632\u0647\u0631\u0627\u0646\u064A",
        phone: "0558899112",
        email: "faisal.z@outlook.sa",
        nationalIdOrIqama: "1088442211",
        birthDate: "1991-06-14",
        tenantType: "\u0639\u0627\u0626\u0644\u0629",
        familyMembersCount: 4,
        source: "\u0645\u0646\u0635\u0629 \u0639\u0642\u0627\u0631",
        propertyId: "prop-1",
        unitId: "unit-103",
        offeredRent: 41e3,
        paymentFrequency: "\u0631\u0628\u0639 \u0633\u0646\u0648\u064A",
        officeFee: 1e3,
        earlyTerminationFee: 2e3,
        budgetMonthly: 3500,
        roomsRequired: 3,
        preferredArea: "\u062D\u064A \u0627\u0644\u064A\u0627\u0633\u0645\u064A\u0646",
        moveInDate: "2026-12-01",
        viewingDate: "2026-11-16",
        viewingResult: "\u0623\u0628\u062F\u0649 \u0631\u063A\u0628\u0629 \u062C\u062F\u064A\u0629 \u0648\u0637\u0644\u0628 \u062F\u0641\u0639\u062A\u064A\u0646",
        status: "\u0639\u0631\u0636 \u0633\u0639\u0631",
        approvalState: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629",
        rating: 5,
        assignedTo: "usr-lease",
        notes: "\u0627\u0644\u0639\u0645\u064A\u0644 \u0645\u0644\u062A\u0632\u0645 \u0648\u0645\u064A\u0632\u0627\u0646\u064A\u062A\u0647 \u0645\u0646\u0627\u0633\u0628\u0629\u060C \u0623\u0646\u0635\u062D \u0628\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629",
        createdAt: "2026-11-12T10:15:00.000Z",
        updatedAt: "2026-11-14T09:20:00.000Z",
        interactions: [
          {
            id: "lint-1",
            type: "visit",
            direction: "inbound",
            summary: "\u062A\u0645\u062A \u0645\u0639\u0627\u064A\u0646\u0629 \u0648\u062D\u062F\u0629 A-103 \u0648\u0623\u0628\u062F\u0649 \u0631\u063A\u0628\u0629 \u062C\u0627\u062F\u0629 \u0628\u0627\u0644\u062A\u0639\u0627\u0642\u062F",
            actorName: "\u0631\u064A\u0645 \u0627\u0644\u062D\u0631\u0628\u064A",
            createdAt: "2026-11-13T16:30:00.000Z"
          },
          {
            id: "lint-2",
            type: "escalation",
            direction: "outbound",
            summary: "\u0625\u0631\u0633\u0627\u0644 \u0628\u0637\u0627\u0642\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0647\u062A\u0645 \u0644\u0644\u0645\u0627\u0644\u0643 \u0639\u0628\u062F\u0627\u0644\u0639\u0632\u064A\u0632 \u0627\u0644\u0631\u0627\u062C\u062D\u064A \u0644\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0627\u0644\u062F\u0641\u0639 \u0627\u0644\u0631\u0628\u0639 \u0633\u0646\u0648\u064A",
            actorName: "\u0631\u064A\u0645 \u0627\u0644\u062D\u0631\u0628\u064A",
            createdAt: "2026-11-14T09:20:00.000Z"
          }
        ]
      },
      {
        id: "lead-2",
        nameAr: "\u062F. \u0646\u0648\u0631\u0629 \u0628\u0646\u062A \u0641\u0647\u062F \u0627\u0644\u0633\u0627\u0644\u0645",
        phone: "0503344119",
        email: "dr.noura@clinic.sa",
        nationalIdOrIqama: "1044991123",
        birthDate: "1988-03-22",
        tenantType: "\u0634\u0631\u0643\u0629",
        companyCrNumber: "1010558899",
        source: "\u0632\u064A\u0627\u0631\u0629 \u0645\u0628\u0627\u0634\u0631\u0629",
        propertyId: "prop-2",
        unitId: "unit-203",
        offeredRent: 43200,
        paymentFrequency: "\u0633\u0646\u0648\u064A",
        officeFee: 1500,
        earlyTerminationFee: 3e3,
        budgetMonthly: 3800,
        roomsRequired: 2,
        preferredArea: "\u062D\u064A \u0627\u0644\u0645\u0644\u0642\u0627",
        moveInDate: "2026-11-25",
        viewingDate: "2026-11-18",
        status: "\u062C\u062F\u064A\u062F",
        approvalState: "\u0644\u0645 \u064A\u064F\u0631\u0633\u0644",
        rating: 4,
        assignedTo: "usr-lease",
        notes: "\u062A\u0628\u062D\u062B \u0639\u0646 \u0645\u0643\u062A\u0628 \u0625\u062F\u0627\u0631\u064A \u062C\u0627\u0647\u0632 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0627\u0644\u0642\u0627\u062F\u0645",
        createdAt: "2026-11-14T08:00:00.000Z",
        updatedAt: "2026-11-14T08:00:00.000Z",
        interactions: [
          {
            id: "lint-3",
            type: "call",
            direction: "inbound",
            summary: "\u0627\u062A\u0635\u0627\u0644 \u0627\u0633\u062A\u0641\u0633\u0627\u0631 \u0639\u0646 \u0627\u0644\u0645\u0643\u062A\u0628 \u0627\u0644\u0625\u062F\u0627\u0631\u064A B-203 \u0648\u062D\u062C\u0632 \u0645\u0648\u0639\u062F \u0645\u0639\u0627\u064A\u0646\u0629",
            actorName: "\u0631\u064A\u0645 \u0627\u0644\u062D\u0631\u0628\u064A",
            createdAt: "2026-11-14T08:05:00.000Z"
          }
        ]
      }
    ],
    leadEscalations: [
      {
        id: "lesc-1",
        requestCode: "ESC-2026-001",
        leadId: "lead-1",
        propertyId: "prop-1",
        unitId: "unit-103",
        recipientType: "owner",
        recipientId: "own-1",
        recipientName: "\u0639\u0628\u062F\u0627\u0644\u0639\u0632\u064A\u0632 \u0628\u0646 \u0645\u062D\u0645\u062F \u0627\u0644\u0631\u0627\u062C\u062D\u064A",
        recipientPhone: "0559812200",
        recipientEmail: "a.rajhi@outlook.sa",
        channel: "\u0648\u0627\u062A\u0633\u0627\u0628",
        status: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629",
        priority: "\u0639\u0627\u062C\u0644",
        employeeNotes: "\u0627\u0644\u0639\u0645\u064A\u0644 \u0645\u0644\u062A\u0632\u0645 \u0648\u0645\u064A\u0632\u0627\u0646\u064A\u062A\u0647 \u0645\u0646\u0627\u0633\u0628\u0629\u060C \u0623\u0646\u0635\u062D \u0628\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u062F\u0641\u0639 \u0631\u0628\u0639 \u0633\u0646\u0648\u064A",
        token: "tok-esc-2026-001",
        tokenExpiresAt: "2026-11-17T09:20:00.000Z",
        snapshot: {
          companyName: "\u0634\u0631\u0643\u0629 \u062F\u0627\u0631 \u0627\u0644\u0623\u0641\u0642 \u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0623\u0645\u0644\u0627\u0643 \u0648\u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A",
          propertyName: "\u0645\u062C\u0645\u0639 \u0627\u0644\u064A\u0627\u0633\u0645\u064A\u0646 \u0627\u0644\u0633\u0643\u0646\u064A",
          unitNumber: "A-103",
          leadName: "\u0641\u064A\u0635\u0644 \u0628\u0646 \u0646\u0627\u0635\u0631 \u0627\u0644\u0632\u0647\u0631\u0627\u0646\u064A",
          nationalIdOrIqama: "1088442211",
          hasIdPhoto: false,
          birthDate: "1991-06-14",
          phone: "0558899112",
          rentAmount: 41e3,
          paymentFrequency: "\u0631\u0628\u0639 \u0633\u0646\u0648\u064A",
          officeFee: 1e3,
          earlyTerminationFee: 2e3,
          employeeNotes: "\u0627\u0644\u0639\u0645\u064A\u0644 \u0645\u0644\u062A\u0632\u0645 \u0648\u0645\u064A\u0632\u0627\u0646\u064A\u062A\u0647 \u0645\u0646\u0627\u0633\u0628\u0629\u060C \u0623\u0646\u0635\u062D \u0628\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u062F\u0641\u0639 \u0631\u0628\u0639 \u0633\u0646\u0648\u064A",
          registrationDate: "2026-11-12",
          registrationSource: "\u0645\u0646\u0635\u0629 \u0639\u0642\u0627\u0631"
        },
        createdBy: "usr-lease",
        createdByName: "\u0631\u064A\u0645 \u0627\u0644\u062D\u0631\u0628\u064A",
        createdAt: "2026-11-14T09:20:00.000Z"
      }
    ],
    contracts: [
      {
        id: "ctr-1",
        internalNumber: "CNT-2026-001",
        ejarNumber: "EJ-1049283711",
        ejarStatus: "\u0645\u0648\u062B\u0642 \u0641\u064A \u0625\u064A\u062C\u0627\u0631",
        ejarPortalUrl: "https://ejar.sa/contracts/EJ-1049283711",
        lifecycleStatus: "\u0646\u0634\u0637",
        propertyId: "prop-1",
        unitId: "unit-101",
        tenantId: "ten-1",
        startDate: "2026-01-15",
        endDate: "2027-01-14",
        handoverDate: "2026-01-15",
        occupancyStartDate: "2026-01-15",
        occupancyStatus: "\u0646\u0634\u0637",
        keysDeliveredCount: 4,
        remotesDeliveredCount: 4,
        annualRent: 48e3,
        paymentFrequency: "\u0646\u0635\u0641 \u0633\u0646\u0648\u064A",
        installmentsCount: 2,
        securityDeposit: 3e3,
        officeFee: 1200,
        earlyTerminationFee: 4e3,
        managementCommissionPercent: 5,
        includedServices: "\u0627\u0644\u0645\u064A\u0627\u0647 \u0648\u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u062E\u0627\u0631\u062C\u064A\u0629 \u0644\u0644\u0639\u0645\u0627\u0631\u0629",
        version: 1,
        createdBy: "usr-lease",
        createdAt: "2026-01-14T10:00:00.000Z"
      },
      {
        id: "ctr-2",
        internalNumber: "CNT-2026-002",
        ejarNumber: "EJ-1049289922",
        ejarStatus: "\u0645\u0648\u062B\u0642 \u0641\u064A \u0625\u064A\u062C\u0627\u0631",
        ejarPortalUrl: "https://ejar.sa/contracts/EJ-1049289922",
        lifecycleStatus: "\u0646\u0634\u0637",
        propertyId: "prop-1",
        unitId: "unit-102",
        tenantId: "ten-2",
        startDate: "2026-02-01",
        endDate: "2026-12-10",
        handoverDate: "2026-02-01",
        occupancyStartDate: "2026-02-01",
        occupancyStatus: "\u0646\u0634\u0637",
        keysDeliveredCount: 3,
        remotesDeliveredCount: 4,
        annualRent: 54e3,
        paymentFrequency: "\u0631\u0628\u0639 \u0633\u0646\u0648\u064A",
        installmentsCount: 4,
        securityDeposit: 4e3,
        officeFee: 1350,
        earlyTerminationFee: 4500,
        managementCommissionPercent: 5,
        includedServices: "\u0634\u0627\u0645\u0644 \u0627\u0644\u0645\u064A\u0627\u0647 \u0641\u0642\u0637",
        version: 1,
        createdBy: "usr-lease",
        createdAt: "2026-02-01T10:00:00.000Z",
        notes: "\u0642\u0631\u064A\u0628 \u0645\u0646 \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621 - \u064A\u062D\u062A\u0627\u062C \u0645\u062A\u0627\u0628\u0639\u0629 \u062A\u062C\u062F\u064A\u062F \u0642\u0628\u0644 30 \u064A\u0648\u0645\u0627\u064B"
      },
      {
        id: "ctr-3",
        internalNumber: "CNT-2025-019",
        ejarNumber: "EJ-1048112233",
        ejarStatus: "\u0645\u0648\u062B\u0642 \u0641\u064A \u0625\u064A\u062C\u0627\u0631",
        ejarPortalUrl: "https://ejar.sa/contracts/EJ-1048112233",
        lifecycleStatus: "\u0646\u0634\u0637",
        propertyId: "prop-2",
        unitId: "unit-201",
        tenantId: "ten-3",
        startDate: "2025-12-01",
        endDate: "2026-11-30",
        handoverDate: "2025-12-01",
        occupancyStartDate: "2025-12-01",
        occupancyStatus: "\u0646\u0634\u0637",
        keysDeliveredCount: 2,
        remotesDeliveredCount: 4,
        annualRent: 12e4,
        paymentFrequency: "\u0631\u0628\u0639 \u0633\u0646\u0648\u064A",
        installmentsCount: 4,
        securityDeposit: 1e4,
        officeFee: 3e3,
        earlyTerminationFee: 15e3,
        managementCommissionPercent: 6,
        includedServices: "\u0628\u062F\u0648\u0646 \u062E\u062F\u0645\u0627\u062A",
        version: 1,
        createdBy: "usr-lease",
        createdAt: "2025-11-28T10:00:00.000Z",
        notes: "\u0639\u0642\u062F \u062A\u062C\u0627\u0631\u064A \u0642\u0631\u064A\u0628 \u0645\u0646 \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621 \u062E\u0644\u0627\u0644 16 \u064A\u0648\u0645\u0627\u064B"
      },
      {
        id: "ctr-arch-1",
        internalNumber: "CNT-2025-008",
        ejarNumber: "EJ-1047001122",
        ejarStatus: "\u0645\u0648\u062B\u0642 \u0641\u064A \u0625\u064A\u062C\u0627\u0631",
        lifecycleStatus: "\u0645\u0646\u062A\u0647\u064D \u0628\u0627\u0644\u0625\u062E\u0644\u0627\u0621",
        propertyId: "prop-1",
        unitId: "unit-arch-1",
        tenantId: "ten-arch-1",
        startDate: "2025-09-15",
        endDate: "2026-09-14",
        annualRent: 26400,
        paymentFrequency: "\u0646\u0635\u0641 \u0633\u0646\u0648\u064A",
        installmentsCount: 2,
        securityDeposit: 2e3,
        officeFee: 700,
        managementCommissionPercent: 5,
        includedServices: "\u0627\u0644\u0645\u064A\u0627\u0647 \u0641\u0642\u0637",
        version: 1,
        createdBy: "usr-lease",
        createdAt: "2025-09-10T10:00:00.000Z",
        notes: "\u0623\u064F\u062E\u0644\u064A\u062A \u0627\u0644\u0648\u062D\u062F\u0629 R-401 \u0628\u062A\u0633\u0648\u064A\u0629 \u062A\u0623\u0645\u064A\u0646 \u0643\u0627\u0645\u0644\u0629",
        archivedAt: "2026-09-15T14:00:00.000Z",
        archiveReason: "\u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0645\u062F\u0629 \u0648\u0625\u062E\u0644\u0627\u0621 \u0633\u0644\u064A\u0645",
        archivedBy: "usr-lease",
        archiveMode: "\u062A\u0644\u0642\u0627\u0626\u064A",
        preArchiveStatus: "\u0646\u0634\u0637"
      },
      {
        id: "ctr-arch-2",
        internalNumber: "CNT-2025-003",
        ejarNumber: "EJ-1046552211",
        ejarStatus: "\u0645\u0648\u062B\u0642 \u0641\u064A \u0625\u064A\u062C\u0627\u0631",
        lifecycleStatus: "\u0645\u0646\u062A\u0647\u064A",
        propertyId: "prop-2",
        unitId: "unit-arch-2",
        tenantId: "ten-arch-2",
        startDate: "2024-12-20",
        endDate: "2025-12-19",
        annualRent: 38400,
        paymentFrequency: "\u0631\u0628\u0639 \u0633\u0646\u0648\u064A",
        installmentsCount: 4,
        securityDeposit: 3500,
        officeFee: 950,
        managementCommissionPercent: 6,
        includedServices: "\u0628\u062F\u0648\u0646 \u062E\u062F\u0645\u0627\u062A",
        version: 1,
        createdBy: "usr-lease",
        createdAt: "2024-12-15T09:30:00.000Z",
        notes: "\u0639\u0642\u062F \u0645\u0643\u062A\u0628 \u0633\u0627\u0628\u0642 \u0627\u0646\u062A\u0647\u0649 \u0648\u062F\u0645\u062C\u062A \u0627\u0644\u0648\u062D\u062F\u0629 \u0641\u064A \u062E\u0637\u0629 \u0627\u0644\u062A\u0648\u0633\u0639\u0629",
        archivedAt: "2025-12-20T16:10:00.000Z",
        archiveReason: "\u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0639\u0642\u062F \u0627\u0644\u0645\u0627\u0644\u064A \u0644\u0639\u0627\u0645 2025",
        archivedBy: "usr-gm",
        archiveMode: "\u0645\u062C\u062F\u0648\u0644",
        preArchiveStatus: "\u0646\u0634\u0637"
      },
      {
        id: "ctr-arch-3",
        internalNumber: "CNT-2026-000",
        ejarNumber: "EJ-1049000912",
        ejarStatus: "\u063A\u064A\u0631 \u0645\u0648\u062B\u0642",
        lifecycleStatus: "\u0645\u0644\u063A\u064A",
        propertyId: "prop-1",
        unitId: "unit-103",
        tenantId: "ten-arch-1",
        startDate: "2026-10-01",
        endDate: "2027-09-30",
        annualRent: 42e3,
        paymentFrequency: "\u0646\u0635\u0641 \u0633\u0646\u0648\u064A",
        installmentsCount: 2,
        securityDeposit: 3e3,
        officeFee: 1050,
        managementCommissionPercent: 5,
        includedServices: "\u0627\u0644\u0645\u064A\u0627\u0647 \u0648\u0627\u0644\u0635\u064A\u0627\u0646\u0629",
        version: 1,
        createdBy: "usr-lease",
        createdAt: "2026-09-25T13:00:00.000Z",
        notes: "\u0623\u0644\u063A\u064A \u0642\u0628\u0644 \u0627\u0644\u062A\u0648\u062B\u064A\u0642 \u0644\u062A\u0639\u062F\u064A\u0644 \u0631\u063A\u0628\u0629 \u0627\u0644\u0639\u0645\u064A\u0644 \u0644\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u0623\u0631\u0636\u064A\u0629",
        archivedAt: "2026-09-29T17:00:00.000Z",
        archiveReason: "\u0625\u0644\u063A\u0627\u0621 \u0642\u0628\u0644 \u0627\u0644\u062A\u0641\u0639\u064A\u0644 \u0628\u0646\u0627\u0621\u064B \u0639\u0644\u0649 \u0637\u0644\u0628 \u0627\u0644\u0637\u0631\u0641\u064A\u0646",
        archivedBy: "usr-lease",
        archiveMode: "\u064A\u062F\u0648\u064A",
        preArchiveStatus: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0648\u062B\u064A\u0642"
      }
    ],
    handovers: [
      {
        id: "hnd-1",
        contractId: "ctr-1",
        unitId: "unit-101",
        propertyId: "prop-1",
        type: "\u0627\u0633\u062A\u0644\u0627\u0645 \u0639\u0646\u062F \u0627\u0644\u062A\u0623\u062C\u064A\u0631",
        date: "2026-01-15",
        inspectorId: "usr-sup",
        keysReturned: 4,
        acRemotesReturned: 4,
        electricityReading: "14220",
        waterReading: "318",
        checklist: [
          { item: "\u0627\u0644\u0623\u0628\u0648\u0627\u0628 \u0648\u0627\u0644\u0623\u0642\u0641\u0627\u0644", status: "\u0633\u0644\u064A\u0645" },
          { item: "\u0627\u0644\u0645\u0643\u064A\u0641\u0627\u062A \u0648\u0627\u0644\u0631\u064A\u0645\u0648\u062A\u0627\u062A", status: "\u0633\u0644\u064A\u0645" },
          { item: "\u0627\u0644\u0625\u0646\u0627\u0631\u0629 \u0648\u0627\u0644\u0645\u0641\u0627\u062A\u064A\u062D", status: "\u0633\u0644\u064A\u0645" },
          { item: "\u0627\u0644\u0633\u0628\u0627\u0643\u0629 \u0648\u0627\u0644\u0646\u0638\u0627\u0641\u0629", status: "\u0633\u0644\u064A\u0645" }
        ],
        damageCost: 0,
        unpaidRentDue: 0,
        depositHeld: 3e3,
        netRefundOrDue: 3e3,
        approvedBy: "usr-gm",
        status: "\u0645\u0639\u062A\u0645\u062F",
        createdAt: "2026-01-15T12:00:00.000Z"
      }
    ],
    installments: [
      {
        id: "inst-1",
        contractId: "ctr-1",
        unitId: "unit-101",
        propertyId: "prop-1",
        tenantId: "ten-1",
        installmentNumber: 1,
        dueDate: "2026-01-15",
        amount: 24e3,
        paidAmount: 24e3,
        remainingAmount: 0,
        lastPaymentDate: "2026-01-15",
        status: "\u0645\u062F\u0641\u0648\u0639\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644"
      },
      {
        id: "inst-2",
        contractId: "ctr-1",
        unitId: "unit-101",
        propertyId: "prop-1",
        tenantId: "ten-1",
        installmentNumber: 2,
        dueDate: "2026-07-15",
        amount: 24e3,
        paidAmount: 24e3,
        remainingAmount: 0,
        lastPaymentDate: "2026-07-14",
        status: "\u0645\u062F\u0641\u0648\u0639\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644"
      },
      {
        id: "inst-3",
        contractId: "ctr-2",
        unitId: "unit-102",
        propertyId: "prop-1",
        tenantId: "ten-2",
        installmentNumber: 1,
        dueDate: "2026-02-01",
        amount: 13500,
        paidAmount: 13500,
        remainingAmount: 0,
        lastPaymentDate: "2026-02-01",
        status: "\u0645\u062F\u0641\u0648\u0639\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644"
      },
      {
        id: "inst-4",
        contractId: "ctr-2",
        unitId: "unit-102",
        propertyId: "prop-1",
        tenantId: "ten-2",
        installmentNumber: 2,
        dueDate: "2026-05-01",
        amount: 13500,
        paidAmount: 13500,
        remainingAmount: 0,
        lastPaymentDate: "2026-05-03",
        status: "\u0645\u062F\u0641\u0648\u0639\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644"
      },
      {
        id: "inst-5",
        contractId: "ctr-2",
        unitId: "unit-102",
        propertyId: "prop-1",
        tenantId: "ten-2",
        installmentNumber: 3,
        dueDate: "2026-08-01",
        amount: 13500,
        paidAmount: 9e3,
        remainingAmount: 4500,
        lastPaymentDate: "2026-08-12",
        status: "\u0645\u062F\u0641\u0648\u0639\u0629 \u062C\u0632\u0626\u064A\u0627\u064B"
      },
      {
        id: "inst-6",
        contractId: "ctr-2",
        unitId: "unit-102",
        propertyId: "prop-1",
        tenantId: "ten-2",
        installmentNumber: 4,
        dueDate: "2026-11-01",
        amount: 13500,
        paidAmount: 0,
        remainingAmount: 13500,
        status: "\u0645\u062A\u0623\u062E\u0631\u0629"
      },
      {
        id: "inst-7",
        contractId: "ctr-3",
        unitId: "unit-201",
        propertyId: "prop-2",
        tenantId: "ten-3",
        installmentNumber: 1,
        dueDate: "2025-12-01",
        amount: 3e4,
        paidAmount: 3e4,
        remainingAmount: 0,
        lastPaymentDate: "2025-12-01",
        status: "\u0645\u062F\u0641\u0648\u0639\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644"
      },
      {
        id: "inst-8",
        contractId: "ctr-3",
        unitId: "unit-201",
        propertyId: "prop-2",
        tenantId: "ten-3",
        installmentNumber: 2,
        dueDate: "2026-03-01",
        amount: 3e4,
        paidAmount: 3e4,
        remainingAmount: 0,
        lastPaymentDate: "2026-03-01",
        status: "\u0645\u062F\u0641\u0648\u0639\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644"
      },
      {
        id: "inst-9",
        contractId: "ctr-3",
        unitId: "unit-201",
        propertyId: "prop-2",
        tenantId: "ten-3",
        installmentNumber: 3,
        dueDate: "2026-06-01",
        amount: 3e4,
        paidAmount: 3e4,
        remainingAmount: 0,
        lastPaymentDate: "2026-06-02",
        status: "\u0645\u062F\u0641\u0648\u0639\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644"
      },
      {
        id: "inst-10",
        contractId: "ctr-3",
        unitId: "unit-201",
        propertyId: "prop-2",
        tenantId: "ten-3",
        installmentNumber: 4,
        dueDate: "2026-11-14",
        amount: 3e4,
        paidAmount: 0,
        remainingAmount: 3e4,
        status: "\u0645\u0633\u062A\u062D\u0642\u0629 \u0627\u0644\u064A\u0648\u0645"
      }
    ],
    payments: [
      {
        id: "pay-1",
        receiptNumber: "RCP-2026-0001",
        idempotencyKey: "seed-pay-1",
        contractId: "ctr-1",
        unitId: "unit-101",
        propertyId: "prop-1",
        tenantId: "ten-1",
        allocations: [{ installmentId: "inst-2", amount: 24e3 }],
        amount: 24e3,
        paymentMethod: "\u062A\u062D\u0648\u064A\u0644 \u0628\u0646\u0643\u064A",
        paymentType: "\u0625\u064A\u062C\u0627\u0631",
        referenceNumber: "TRN-9920184",
        receivedBy: "usr-acc",
        deviceName: "Windows Desktop \xB7 \u0642\u0633\u0645 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629",
        status: "\u0645\u0639\u062A\u0645\u062F",
        createdAt: "2026-07-14T11:20:00.000Z"
      },
      {
        id: "pay-2",
        receiptNumber: "RCP-2026-0002",
        idempotencyKey: "seed-pay-2",
        contractId: "ctr-2",
        unitId: "unit-102",
        propertyId: "prop-1",
        tenantId: "ten-2",
        allocations: [{ installmentId: "inst-5", amount: 9e3 }],
        amount: 9e3,
        paymentMethod: "\u0634\u0628\u0643\u0629 \u0645\u062F\u0649",
        paymentType: "\u0625\u064A\u062C\u0627\u0631",
        referenceNumber: "POS-441022",
        receivedBy: "usr-acc",
        deviceName: "Windows Desktop \xB7 \u0642\u0633\u0645 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629",
        status: "\u0645\u0639\u062A\u0645\u062F",
        notes: "\u0633\u062F\u0627\u062F \u062C\u0632\u0626\u064A \u0644\u0644\u062F\u0641\u0639\u0629 \u0627\u0644\u062B\u0627\u0644\u062B\u0629 - \u0627\u0644\u0645\u062A\u0628\u0642\u064A 4,500 \u0631.\u0633",
        createdAt: "2026-08-12T15:40:00.000Z"
      },
      {
        id: "pay-3",
        receiptNumber: "RCP-2026-0003",
        idempotencyKey: "seed-pay-3",
        contractId: "ctr-3",
        unitId: "unit-201",
        propertyId: "prop-2",
        tenantId: "ten-3",
        allocations: [{ installmentId: "inst-9", amount: 3e4 }],
        amount: 3e4,
        paymentMethod: "\u062A\u062D\u0648\u064A\u0644 \u0628\u0646\u0643\u064A",
        paymentType: "\u0625\u064A\u062C\u0627\u0631",
        referenceNumber: "TRN-7712900",
        receivedBy: "usr-acc",
        deviceName: "Windows Desktop \xB7 \u0642\u0633\u0645 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629",
        status: "\u0645\u0639\u062A\u0645\u062F",
        createdAt: "2026-06-02T09:10:00.000Z"
      },
      {
        id: "pay-arch-1",
        receiptNumber: "RCP-2025-0084",
        idempotencyKey: "seed-pay-arch-1",
        contractId: "ctr-arch-2",
        unitId: "unit-arch-2",
        propertyId: "prop-2",
        tenantId: "ten-arch-2",
        allocations: [],
        amount: 9600,
        paymentMethod: "\u062A\u062D\u0648\u064A\u0644 \u0628\u0646\u0643\u064A",
        paymentType: "\u0625\u064A\u062C\u0627\u0631",
        referenceNumber: "TRN-5519002",
        receivedBy: "usr-acc",
        deviceName: "Windows Desktop \xB7 \u0642\u0633\u0645 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629",
        status: "\u0645\u0639\u062A\u0645\u062F",
        notes: "\u062F\u0641\u0639\u0629 \u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0631\u0628\u0639 \u0627\u0644\u0623\u062E\u064A\u0631 \u0644\u0639\u0627\u0645 2025 (\u0645\u0642\u0641\u0644\u0629 \u0636\u0645\u0646 \u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0627\u0644\u0645\u0646\u062A\u0647\u064A\u0629)",
        createdAt: "2025-09-20T10:15:00.000Z",
        archivedAt: "2026-01-05T02:00:00.000Z",
        archiveReason: "\u0625\u0642\u0641\u0627\u0644 \u0627\u0644\u0633\u0646\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 2025",
        archivedBy: "usr-acc",
        archiveMode: "\u0645\u062C\u062F\u0648\u0644",
        preArchiveStatus: "\u0645\u0639\u062A\u0645\u062F"
      },
      {
        id: "pay-arch-2",
        receiptNumber: "RCP-2026-0000",
        idempotencyKey: "seed-pay-arch-2",
        contractId: "ctr-1",
        unitId: "unit-101",
        propertyId: "prop-1",
        tenantId: "ten-1",
        allocations: [],
        amount: 24e3,
        paymentMethod: "\u0634\u064A\u0643",
        paymentType: "\u0625\u064A\u062C\u0627\u0631",
        referenceNumber: "CHK-88120",
        receivedBy: "usr-acc",
        deviceName: "Windows Desktop \xB7 \u0642\u0633\u0645 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629",
        status: "\u0645\u0639\u0643\u0648\u0633",
        reversedByReceiptId: "REV-2026-0001",
        reversalReason: "\u0627\u0633\u062A\u0628\u062F\u0627\u0644 \u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639 \u0645\u0646 \u0634\u064A\u0643 \u0625\u0644\u0649 \u062D\u0648\u0627\u0644\u0629 \u0628\u0646\u0643\u064A\u0629 \u0641\u0648\u0631\u064A\u0629",
        notes: "\u0639\u064F\u0643\u0633 \u0628\u0642\u064A\u062F \u0645\u062D\u0627\u0633\u0628\u064A \u0645\u0637\u0627\u0628\u0642",
        createdAt: "2026-07-13T12:00:00.000Z",
        archivedAt: "2026-07-13T13:15:00.000Z",
        archiveReason: "\u0633\u0646\u062F \u0645\u0639\u0643\u0648\u0633 \u0645\u062D\u0627\u0633\u0628\u064A\u0627\u064B",
        archivedBy: "usr-acc",
        archiveMode: "\u062A\u0644\u0642\u0627\u0626\u064A",
        preArchiveStatus: "\u0645\u0639\u062A\u0645\u062F"
      }
    ],
    accounts: [
      { id: "acc-1010", code: "1010", nameAr: "\u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0623\u0647\u0644\u064A / \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A", nameEn: "Operating Bank Account", type: "\u0623\u0635\u0648\u0644", balance: 215e3 },
      { id: "acc-1020", code: "1020", nameAr: "\u0627\u0644\u0635\u0646\u062F\u0648\u0642 \u0627\u0644\u0646\u0642\u062F\u064A", nameEn: "Petty Cash", type: "\u0623\u0635\u0648\u0644", balance: 12500 },
      { id: "acc-1200", code: "1200", nameAr: "\u0630\u0645\u0645 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631\u064A\u0646", nameEn: "Tenant Receivables", type: "\u0623\u0635\u0648\u0644", balance: 48e3 },
      { id: "acc-2100", code: "2100", nameAr: "\u0627\u0644\u062A\u0623\u0645\u064A\u0646\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u0644\u0645\u0629", nameEn: "Security Deposits Held", type: "\u0627\u0644\u062A\u0632\u0627\u0645\u0627\u062A", balance: 17e3 },
      { id: "acc-2200", code: "2200", nameAr: "\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0645\u0644\u0627\u0643 (\u0645\u0633\u062A\u062D\u0642\u0627\u062A \u0627\u0644\u0645\u0644\u0627\u0643)", nameEn: "Owners Payable", type: "\u0627\u0644\u062A\u0632\u0627\u0645\u0627\u062A", balance: 158400 },
      { id: "acc-2300", code: "2300", nameAr: "\u0630\u0645\u0645 \u0627\u0644\u0645\u0648\u0631\u062F\u064A\u0646 \u0648\u0627\u0644\u0645\u0642\u0627\u0648\u0644\u064A\u0646", nameEn: "Vendors Payable", type: "\u0627\u0644\u062A\u0632\u0627\u0645\u0627\u062A", balance: 1850 },
      { id: "acc-4100", code: "4100", nameAr: "\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0639\u0645\u0648\u0644\u0629 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0623\u0645\u0644\u0627\u0643", nameEn: "Property Management Commission", type: "\u0625\u064A\u0631\u0627\u062F\u0627\u062A", balance: 11250 },
      { id: "acc-4200", code: "4200", nameAr: "\u0639\u0645\u0648\u0644\u0627\u062A \u0627\u0644\u062A\u0623\u062C\u064A\u0631 \u0648\u0627\u0644\u0633\u0639\u064A", nameEn: "Leasing & Brokerage Fees", type: "\u0625\u064A\u0631\u0627\u062F\u0627\u062A", balance: 5550 },
      { id: "acc-5100", code: "5100", nameAr: "\u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0648\u0627\u0644\u0625\u0635\u0644\u0627\u062D", nameEn: "Maintenance & Repairs Expense", type: "\u0645\u0635\u0631\u0648\u0641\u0627\u062A", balance: 3400 },
      { id: "acc-5200", code: "5200", nameAr: "\u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621 \u0648\u0627\u0644\u0645\u064A\u0627\u0647 \u0648\u0627\u0644\u062A\u0634\u063A\u064A\u0644", nameEn: "Utilities & Operations Expense", type: "\u0645\u0635\u0631\u0648\u0641\u0627\u062A", balance: 2150 }
    ],
    journals: [
      {
        id: "jrn-1",
        entryNumber: "JRN-2026-0001",
        date: "2026-07-14",
        description: "\u062A\u062D\u0635\u064A\u0644 \u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0648\u062D\u062F\u0629 A-101 \u0628\u0645\u0648\u062C\u0628 \u0633\u0646\u062F RCP-2026-0001 \u0648\u062A\u0648\u0632\u064A\u0639 \u0639\u0645\u0648\u0644\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 5%",
        referenceType: "\u062A\u062D\u0635\u064A\u0644",
        referenceId: "pay-1",
        propertyId: "prop-1",
        ownerId: "own-1",
        createdBy: "usr-acc",
        lines: [
          { accountId: "acc-1010", accountName: "\u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0623\u0647\u0644\u064A / \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A", debit: 24e3, credit: 0 },
          { accountId: "acc-2200", accountName: "\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0645\u0644\u0627\u0643 (\u0645\u0633\u062A\u062D\u0642\u0627\u062A \u0627\u0644\u0645\u0644\u0627\u0643)", debit: 0, credit: 22800 },
          { accountId: "acc-4100", accountName: "\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0639\u0645\u0648\u0644\u0629 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0623\u0645\u0644\u0627\u0643", debit: 0, credit: 1200 }
        ]
      },
      {
        id: "jrn-2",
        entryNumber: "JRN-2026-0002",
        date: "2026-08-12",
        description: "\u062A\u062D\u0635\u064A\u0644 \u062F\u0641\u0639\u0629 \u062C\u0632\u0626\u064A\u0629 \u0644\u0644\u0648\u062D\u062F\u0629 A-102 \u0628\u0645\u0648\u062C\u0628 \u0633\u0646\u062F RCP-2026-0002",
        referenceType: "\u062A\u062D\u0635\u064A\u0644",
        referenceId: "pay-2",
        propertyId: "prop-1",
        ownerId: "own-1",
        createdBy: "usr-acc",
        lines: [
          { accountId: "acc-1010", accountName: "\u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0623\u0647\u0644\u064A / \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A", debit: 9e3, credit: 0 },
          { accountId: "acc-2200", accountName: "\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0645\u0644\u0627\u0643 (\u0645\u0633\u062A\u062D\u0642\u0627\u062A \u0627\u0644\u0645\u0644\u0627\u0643)", debit: 0, credit: 8550 },
          { accountId: "acc-4100", accountName: "\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0639\u0645\u0648\u0644\u0629 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0623\u0645\u0644\u0627\u0643", debit: 0, credit: 450 }
        ]
      }
    ],
    expenses: [
      {
        id: "exp-1",
        expenseNumber: "EXP-2026-0001",
        date: "2026-10-28",
        category: "\u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0627\u0644\u062A\u0634\u063A\u064A\u0644",
        subCategory: "\u0643\u0647\u0631\u0628\u0627\u0621 \u0645\u0634\u0627\u0639\u0627\u062A",
        propertyId: "prop-1",
        invoiceNumber: "INV-SEC-88120",
        amount: 1450,
        vatAmount: 189.13,
        netAmount: 1260.87,
        paymentMethod: "\u062A\u062D\u0648\u064A\u0644 \u0628\u0646\u0643\u064A",
        paidFromAccount: "\u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0623\u0647\u0644\u064A \u0627\u0644\u0633\u0639\u0648\u062F\u064A (SNB)",
        paymentStatus: "\u0645\u062F\u0641\u0648\u0639 \u0628\u0627\u0644\u0643\u0627\u0645\u0644",
        paidAmount: 1450,
        remainingAmount: 0,
        bearer: "\u0627\u0644\u0645\u0627\u0644\u0643",
        approvalStatus: "\u0645\u0639\u062A\u0645\u062F",
        approvedBySupervisor: "usr-sup",
        approvedByManager: "usr-gm",
        zatcaQrVerified: true,
        createdBy: "usr-sup",
        notes: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0643\u0647\u0631\u0628\u0627\u0621 \u0627\u0644\u0645\u0645\u0631\u0627\u062A \u0648\u0627\u0644\u0645\u0635\u0639\u062F \u0627\u0644\u0634\u0647\u0631\u064A\u0629 \u0644\u0645\u062C\u0645\u0639 \u0627\u0644\u064A\u0627\u0633\u0645\u064A\u0646",
        createdAt: "2026-10-28T09:30:00.000Z"
      },
      {
        id: "exp-2",
        expenseNumber: "EXP-2026-0002",
        date: "2026-11-12",
        category: "\u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0627\u0644\u0635\u064A\u0627\u0646\u0629",
        subCategory: "\u062A\u0643\u064A\u064A\u0641 \u0648\u062A\u0628\u0631\u064A\u062F",
        propertyId: "prop-1",
        unitId: "unit-104",
        vendorId: "vnd-1",
        ticketId: "tkt-1",
        invoiceNumber: "INV-NAS-4410",
        amount: 1850,
        vatAmount: 241.3,
        netAmount: 1608.7,
        paymentMethod: "\u062A\u062D\u0648\u064A\u0644 \u0628\u0646\u0643\u064A",
        paidFromAccount: "\u0627\u0644\u0628\u0646\u0643 \u0627\u0644\u0623\u0647\u0644\u064A \u0627\u0644\u0633\u0639\u0648\u062F\u064A (SNB)",
        paymentStatus: "\u0644\u0645 \u064A\u064F\u062F\u0641\u0639",
        paidAmount: 0,
        remainingAmount: 1850,
        dueDate: "2026-11-20",
        bearer: "\u0627\u0644\u0645\u0627\u0644\u0643",
        approvalStatus: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u062F\u064A\u0631",
        approvedBySupervisor: "usr-sup",
        approvedByDeptManager: "usr-mm",
        zatcaQrVerified: true,
        createdBy: "usr-tech",
        notes: "\u0627\u0633\u062A\u0628\u062F\u0627\u0644 \u0643\u0645\u0628\u0631\u0648\u0633\u0631 \u0645\u0643\u064A\u0641 \u0633\u0628\u0644\u064A\u062A \u0627\u0644\u0635\u0627\u0644\u0629 - \u062A\u0645\u062A \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0645\u0634\u0631\u0641 \u0648\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0645\u062F\u064A\u0631",
        createdAt: "2026-11-12T14:20:00.000Z"
      },
      {
        id: "exp-3",
        expenseNumber: "EXP-2026-0003",
        date: "2026-11-13",
        category: "\u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0627\u0644\u062A\u0634\u063A\u064A\u0644",
        subCategory: "\u0646\u0638\u0627\u0641\u0629 \u0639\u0627\u0645\u0629",
        propertyId: "prop-2",
        unitId: "unit-203",
        vendorId: "vnd-3",
        invoiceNumber: "INV-ISH-902",
        amount: 420,
        vatAmount: 54.78,
        netAmount: 365.22,
        paymentMethod: "\u0646\u0642\u062F\u064A",
        paidFromAccount: "\u0627\u0644\u0635\u0646\u062F\u0648\u0642 \u0627\u0644\u0646\u0642\u062F\u064A",
        paymentStatus: "\u0644\u0645 \u064A\u064F\u062F\u0641\u0639",
        paidAmount: 0,
        remainingAmount: 420,
        dueDate: "2026-11-18",
        bearer: "\u0627\u0644\u0645\u0627\u0644\u0643",
        approvalStatus: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0634\u0631\u0641",
        createdBy: "usr-lease",
        notes: "\u062A\u0646\u0638\u064A\u0641 \u0634\u0627\u0645\u0644 \u0648\u062A\u062C\u0647\u064A\u0632 \u0627\u0644\u0645\u0643\u062A\u0628 M-405 \u0628\u0639\u062F \u0627\u0644\u0625\u062E\u0644\u0627\u0621",
        createdAt: "2026-11-13T11:00:00.000Z"
      }
    ],
    supplierInvoices: [
      {
        id: "sinv-1",
        invoiceCode: "SINV-2026-001",
        supplierInvoiceNumber: "NAS-2026-4410",
        invoiceDate: "2026-11-12",
        receivedDate: "2026-11-12",
        dueDate: "2026-11-25",
        vendorId: "vnd-1",
        propertyId: "prop-1",
        unitId: "unit-104",
        ticketId: "tkt-1",
        items: [
          { id: "si-1", description: "\u062A\u0648\u0631\u064A\u062F \u0643\u0645\u0628\u0631\u0648\u0633\u0631 \u0633\u0628\u0644\u064A\u062A 24,000 \u0648\u062D\u062F\u0629 \u0623\u0635\u0644\u064A", quantity: 1, unitPrice: 1300, total: 1300 },
          { id: "si-2", description: "\u0623\u062C\u0648\u0631 \u0641\u0643 \u0648\u062A\u0631\u0643\u064A\u0628 \u0648\u062A\u0639\u0628\u0626\u0629 \u0641\u0631\u064A\u0648\u0646 410A", quantity: 1, unitPrice: 308.7, total: 308.7 }
        ],
        subtotal: 1608.7,
        vatAmount: 241.3,
        totalAmount: 1850,
        paidAmount: 0,
        remainingAmount: 1850,
        currency: "SAR",
        status: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F",
        zatcaQrVerified: true,
        zatcaQrData: "ZATCA|310884422100003|2026-11-12|1850.00|241.30",
        notes: "\u0636\u0645\u0627\u0646 12 \u0634\u0647\u0631\u0627\u064B \u0639\u0644\u0649 \u0627\u0644\u0643\u0645\u0628\u0631\u0648\u0633\u0631 \u0648\u0627\u0644\u062A\u0631\u0643\u064A\u0628",
        createdBy: "usr-mm",
        createdAt: "2026-11-12T14:25:00.000Z"
      },
      {
        id: "sinv-2",
        invoiceCode: "SINV-2026-002",
        supplierInvoiceNumber: "RKZ-2026-1182",
        invoiceDate: "2026-11-05",
        receivedDate: "2026-11-06",
        dueDate: "2026-11-12",
        vendorId: "vnd-2",
        propertyId: "prop-2",
        items: [
          { id: "si-3", description: "\u0635\u064A\u0627\u0646\u0629 \u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629 \u0648\u062A\u063A\u064A\u064A\u0631 \u0642\u0648\u0627\u0637\u0639 \u0627\u0644\u0645\u0645\u0631\u0627\u062A", quantity: 2, unitPrice: 950, total: 1900 },
          { id: "si-4", description: "\u0641\u062D\u0635 \u0645\u0636\u062E\u0627\u062A \u0627\u0644\u0645\u064A\u0627\u0647 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629", quantity: 1, unitPrice: 600, total: 600 }
        ],
        subtotal: 2500,
        vatAmount: 375,
        totalAmount: 2875,
        paidAmount: 1500,
        remainingAmount: 1375,
        currency: "SAR",
        status: "\u0645\u062A\u0623\u062E\u0631\u0629",
        zatcaQrVerified: true,
        zatcaQrData: "ZATCA|310772233400003|2026-11-05|2875.00|375.00",
        notes: "\u0633\u064F\u062F\u062F\u062A \u062F\u0641\u0639\u0629 \u0623\u0648\u0644\u0649 1,500 \u0631.\u0633 \u0648\u0645\u062A\u0628\u0642\u064A 1,375 \u0631.\u0633",
        createdBy: "usr-acc",
        approvedBy: "usr-gm",
        createdAt: "2026-11-06T09:15:00.000Z"
      }
    ],
    recurringExpenses: [
      {
        id: "rexp-1",
        title: "\u0643\u0647\u0631\u0628\u0627\u0621 \u0627\u0644\u0645\u0634\u0627\u0639\u0627\u062A \u0648\u0627\u0644\u0645\u0635\u0627\u0639\u062F \u0627\u0644\u0634\u0647\u0631\u064A\u0629",
        category: "\u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0627\u0644\u062A\u0634\u063A\u064A\u0644",
        subCategory: "\u0643\u0647\u0631\u0628\u0627\u0621 \u0645\u0634\u0627\u0639\u0627\u062A",
        propertyId: "prop-1",
        estimatedAmount: 1450,
        currency: "SAR",
        bearer: "\u0627\u0644\u0645\u0627\u0644\u0643",
        frequency: "\u0634\u0647\u0631\u064A",
        dayOfMonth: 28,
        enabled: true,
        lastGeneratedMonth: "2026-10",
        createdBy: "usr-acc",
        createdAt: "2026-01-01T08:00:00.000Z"
      },
      {
        id: "rexp-2",
        title: "\u0639\u0642\u062F \u0627\u0644\u0646\u0638\u0627\u0641\u0629 \u0627\u0644\u062F\u0648\u0631\u064A\u0629 \u0644\u0644\u0645\u0645\u0631\u0627\u062A \u0648\u0627\u0644\u0648\u0627\u062C\u0647\u0629",
        category: "\u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0627\u0644\u062A\u0634\u063A\u064A\u0644",
        subCategory: "\u0646\u0638\u0627\u0641\u0629 \u0639\u0627\u0645\u0629",
        propertyId: "prop-2",
        vendorId: "vnd-3",
        estimatedAmount: 1800,
        currency: "SAR",
        bearer: "\u0627\u0644\u0645\u0627\u0644\u0643",
        frequency: "\u0634\u0647\u0631\u064A",
        dayOfMonth: 5,
        enabled: true,
        lastGeneratedMonth: "2026-10",
        createdBy: "usr-sup",
        createdAt: "2026-02-01T08:00:00.000Z"
      }
    ],
    propertyBudgets: [
      {
        id: "pbdg-1",
        propertyId: "prop-1",
        month: "2026-11",
        monthlyLimitSar: 5e3,
        alertThresholdPercent: 80,
        blockAt100Percent: false,
        updatedBy: "usr-gm",
        updatedAt: "2026-11-01T08:00:00.000Z"
      },
      {
        id: "pbdg-2",
        propertyId: "prop-2",
        month: "2026-11",
        monthlyLimitSar: 8e3,
        alertThresholdPercent: 80,
        blockAt100Percent: false,
        updatedBy: "usr-gm",
        updatedAt: "2026-11-01T08:00:00.000Z"
      }
    ],
    assets: [
      {
        id: "ast-1",
        propertyId: "prop-1",
        unitId: "unit-104",
        name: "\u0645\u0643\u064A\u0641 \u0633\u0628\u0644\u064A\u062A \u062C\u0631\u064A 24 \u0623\u0644\u0641 \u0648\u062D\u062F\u0629 - \u0627\u0644\u0635\u0627\u0644\u0629",
        category: "\u062A\u0643\u064A\u064A\u0641 \u0648\u062A\u0628\u0631\u064A\u062F",
        serialNumber: "GREE-24K-882910",
        brand: "Gree",
        purchaseDate: "2025-02-15",
        warrantyExpiry: "2027-02-15",
        condition: "\u064A\u062D\u062A\u0627\u062C \u0635\u064A\u0627\u0646\u0629"
      },
      {
        id: "ast-2",
        propertyId: "prop-1",
        unitId: "unit-101",
        name: "\u0633\u062E\u0627\u0646 \u0645\u064A\u0627\u0647 \u062E\u0632\u0641 \u0633\u0639\u0648\u062F\u064A 80 \u0644\u062A\u0631",
        category: "\u0633\u0628\u0627\u0643\u0629",
        serialNumber: "SH-80L-119283",
        brand: "\u0627\u0644\u062E\u0632\u0641 \u0627\u0644\u0633\u0639\u0648\u062F\u064A",
        purchaseDate: "2025-06-10",
        warrantyExpiry: "2028-06-10",
        condition: "\u0645\u0645\u062A\u0627\u0632"
      }
    ],
    tickets: [
      {
        id: "tkt-1",
        ticketNumber: "MNT-2026-001",
        propertyId: "prop-1",
        unitId: "unit-104",
        source: "\u0627\u0644\u0645\u0634\u0631\u0641",
        category: "\u062A\u0643\u064A\u064A\u0641 \u0648\u062A\u0628\u0631\u064A\u062F",
        priority: "\u0639\u0627\u062C\u0644",
        title: "\u062A\u0648\u0642\u0641 \u0627\u0644\u062A\u0628\u0631\u064A\u062F \u0641\u064A \u0645\u0643\u064A\u0641 \u0627\u0644\u0635\u0627\u0644\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
        description: "\u0627\u0644\u0645\u0643\u064A\u0641 \u064A\u0639\u0645\u0644 \u0645\u0631\u0648\u062D\u0629 \u0641\u0642\u0637 \u0645\u0639 \u0635\u0648\u062A \u0637\u0642\u0637\u0642\u0629 \u0645\u0646 \u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u062E\u0627\u0631\u062C\u064A\u0629.",
        assignedTo: "usr-tech",
        vendorId: "vnd-1",
        scheduledDate: "2026-11-14",
        diagnosis: "\u062A\u0644\u0641 \u0641\u064A \u0636\u0627\u063A\u0637 \u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u062E\u0627\u0631\u062C\u064A\u0629 \u0648\u064A\u062D\u062A\u0627\u062C \u0627\u0633\u062A\u0628\u062F\u0627\u0644 \u0643\u0645\u0628\u0631\u0648\u0633\u0631 \u062C\u062F\u064A\u062F \u0645\u0634\u0645\u0648\u0644 \u0628\u0639\u0631\u0636 \u0627\u0644\u0633\u0639\u0631",
        estimatedCost: 1850,
        actualCost: 1850,
        status: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u062A\u0643\u0644\u0641\u0629",
        assetId: "ast-1",
        linkedExpenseId: "exp-2",
        linkedTaskId: "tsk-1",
        createdBy: "usr-sup",
        createdAt: "2026-11-11T09:00:00.000Z",
        updatedAt: "2026-11-12T14:20:00.000Z"
      },
      {
        id: "tkt-2",
        ticketNumber: "MNT-2026-002",
        propertyId: "prop-1",
        unitId: "unit-102",
        tenantId: "ten-2",
        source: "\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631",
        category: "\u0633\u0628\u0627\u0643\u0629",
        priority: "\u0645\u0631\u062A\u0641\u0639",
        title: "\u062A\u0633\u0631\u0628 \u0645\u064A\u0627\u0647 \u0623\u0633\u0641\u0644 \u0645\u063A\u0633\u0644\u0629 \u0627\u0644\u0645\u0637\u0628\u062E",
        description: "\u0623\u0628\u0644\u063A \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u0639\u0646 \u062A\u0633\u0631\u0628 \u0645\u064A\u0627\u0647 \u062E\u0641\u064A\u0641 \u0639\u0646\u062F \u0641\u062A\u062D \u062E\u0644\u0627\u0637 \u0627\u0644\u0645\u0637\u0628\u062E.",
        assignedTo: "usr-tech",
        scheduledDate: "2026-11-15",
        estimatedCost: 280,
        actualCost: 0,
        status: "\u062A\u0645 \u0627\u0644\u0625\u0633\u0646\u0627\u062F",
        linkedTaskId: "tsk-2",
        createdBy: "usr-sup",
        createdAt: "2026-11-13T16:15:00.000Z",
        updatedAt: "2026-11-13T17:00:00.000Z"
      },
      {
        id: "tkt-arch-1",
        ticketNumber: "MNT-2026-000",
        propertyId: "prop-1",
        unitId: "unit-101",
        tenantId: "ten-1",
        source: "\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631",
        category: "\u0643\u0647\u0631\u0628\u0627\u0621",
        priority: "\u0645\u062A\u0648\u0633\u0637",
        title: "\u062A\u0628\u062F\u064A\u0644 \u0642\u0627\u0637\u0639 \u0643\u0647\u0631\u0628\u0627\u0621 \u0627\u0644\u0645\u0637\u0628\u062E \u0627\u0644\u0631\u0626\u064A\u0633\u064A 32 \u0623\u0645\u0628\u064A\u0631",
        description: "\u0641\u0635\u0644 \u0645\u062A\u0643\u0631\u0631 \u0644\u0644\u0642\u0627\u0637\u0639 \u0639\u0646\u062F \u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0641\u0631\u0646 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0626\u064A.",
        assignedTo: "usr-tech",
        vendorId: "vnd-2",
        scheduledDate: "2026-08-05",
        diagnosis: "\u0636\u0639\u0641 \u0646\u0642\u0627\u0637 \u0627\u0644\u062A\u0644\u0627\u0645\u0633 \u0641\u064A \u0627\u0644\u0642\u0627\u0637\u0639 \u0627\u0644\u0642\u062F\u064A\u0645 \u0648\u062A\u0645 \u0627\u0633\u062A\u0628\u062F\u0627\u0644\u0647 \u0628\u0642\u0627\u0637\u0639 \u0634\u0646\u0627\u064A\u062F\u0631 \u0623\u0635\u0644\u064A",
        estimatedCost: 300,
        actualCost: 260,
        status: "\u0645\u063A\u0644\u0642",
        rating: 5,
        beforeNote: "\u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u062A\u0638\u0647\u0631 \u0633\u062E\u0648\u0646\u0629 \u0641\u064A \u0627\u0644\u0642\u0627\u0637\u0639 \u0631\u0642\u0645 4",
        afterNote: "\u062A\u0645 \u0627\u0644\u062A\u0631\u0643\u064A\u0628 \u0648\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u0623\u062D\u0645\u0627\u0644 \u0628\u0646\u062C\u0627\u062D \u062E\u0644\u0627\u0644 45 \u062F\u0642\u064A\u0642\u0629",
        createdBy: "usr-sup",
        createdAt: "2026-08-04T10:00:00.000Z",
        updatedAt: "2026-08-05T12:15:00.000Z",
        archivedAt: "2026-08-06T09:00:00.000Z",
        archiveReason: "\u0628\u0644\u0627\u063A \u0645\u0646\u062C\u0632 \u0648\u0645\u063A\u0644\u0642 \u0628\u062A\u0642\u064A\u064A\u0645 5/5",
        archivedBy: "usr-sup",
        archiveMode: "\u062A\u0644\u0642\u0627\u0626\u064A",
        preArchiveStatus: "\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630"
      }
    ],
    tasks: [
      {
        id: "tsk-1",
        title: "\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0639\u062A\u0645\u0627\u062F \u0648\u0627\u0633\u062A\u0628\u062F\u0627\u0644 \u0643\u0645\u0628\u0631\u0648\u0633\u0631 \u0634\u0642\u0629 B-204",
        description: "\u0631\u0641\u0639 \u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0639\u0631\u0636 \u0648\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u062A\u0643\u0644\u0641\u0629 \u0645\u0646 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u062B\u0645 \u062A\u0648\u062B\u064A\u0642 \u0635\u0648\u0631 \u0642\u0628\u0644 \u0648\u0628\u0639\u062F",
        type: "\u0635\u064A\u0627\u0646\u0629",
        propertyId: "prop-1",
        unitId: "unit-104",
        assignedTo: "usr-tech",
        createdBy: "usr-sup",
        dueDate: "2026-11-15",
        priority: "\u0639\u0627\u062C\u0644",
        status: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629",
        checklist: [
          { text: "\u0641\u062D\u0635 \u0627\u0644\u0648\u062D\u062F\u0629 \u0627\u0644\u062E\u0627\u0631\u062C\u064A\u0629 \u0648\u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0639\u0637\u0644", done: true },
          { text: "\u0625\u0635\u062F\u0627\u0631 \u0639\u0631\u0636 \u0633\u0639\u0631 \u0648\u0631\u0641\u0639 \u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0635\u064A\u0627\u0646\u0629", done: true },
          { text: "\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0648\u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u062A\u0631\u0643\u064A\u0628", done: false }
        ],
        comments: [
          {
            id: "cmt-1",
            authorName: "\u0639\u0645\u0631 \u0627\u0644\u0642\u062D\u0637\u0627\u0646\u064A",
            text: "\u062A\u0645 \u0641\u062D\u0635 \u0627\u0644\u062C\u0647\u0627\u0632 \u0648\u0627\u0644\u062C\u0647\u0627\u0632 \u062A\u062D\u062A \u0627\u0644\u0636\u0645\u0627\u0646 \u0627\u0644\u062C\u0632\u0626\u064A\u060C \u062A\u0645 \u0631\u0641\u0639 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0644\u0644\u0645\u0634\u0631\u0641.",
            createdAt: "2026-11-12T14:25:00.000Z"
          }
        ],
        linkedTicketId: "tkt-1",
        createdAt: "2026-11-11T09:10:00.000Z"
      },
      {
        id: "tsk-2",
        title: "\u0645\u0639\u0627\u0644\u062C\u0629 \u062A\u0633\u0631\u0628 \u0645\u063A\u0633\u0644\u0629 \u0634\u0642\u0629 A-102",
        description: "\u0632\u064A\u0627\u0631\u0629 \u0645\u064A\u062F\u0627\u0646\u064A\u0629 \u0648\u062A\u0628\u062F\u064A\u0644 \u0644\u064A \u0627\u0644\u062A\u063A\u0630\u064A\u0629 \u0648\u0627\u0644\u062C\u0644\u062F.",
        type: "\u0635\u064A\u0627\u0646\u0629",
        propertyId: "prop-1",
        unitId: "unit-102",
        assignedTo: "usr-tech",
        createdBy: "usr-sup",
        dueDate: "2026-11-15",
        priority: "\u0645\u0631\u062A\u0641\u0639",
        status: "\u0645\u0633\u0646\u062F\u0629",
        checklist: [
          { text: "\u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u0644\u062A\u0623\u0643\u064A\u062F \u0645\u0648\u0639\u062F \u0627\u0644\u062F\u062E\u0648\u0644", done: true },
          { text: "\u0625\u0635\u0644\u0627\u062D \u0627\u0644\u062A\u0633\u0631\u0628 \u0648\u062A\u0635\u0648\u064A\u0631 \u0627\u0644\u0646\u062A\u064A\u062C\u0629", done: false }
        ],
        comments: [],
        linkedTicketId: "tkt-2",
        createdAt: "2026-11-13T17:00:00.000Z"
      },
      {
        id: "tsk-3",
        title: "\u0645\u062A\u0627\u0628\u0639\u0629 \u062A\u062D\u0635\u064A\u0644 \u0627\u0644\u0645\u062A\u0623\u062E\u0631\u0627\u062A \u0644\u0644\u0648\u062D\u062F\u0629 A-102 \u0648\u062A\u062C\u062F\u064A\u062F \u0639\u0642\u062F S-01",
        description: "\u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u0637\u0627\u0631\u0642 \u0627\u0644\u0634\u0647\u0631\u064A \u0644\u0633\u062F\u0627\u062F 18,000 \u0631.\u0633 \u0627\u0644\u0645\u062A\u0628\u0642\u064A\u0629\u060C \u0648\u062A\u062C\u0647\u064A\u0632 \u0639\u0631\u0636 \u062A\u062C\u062F\u064A\u062F \u0627\u0644\u0645\u0639\u0631\u0636 \u0627\u0644\u062A\u062C\u0627\u0631\u064A.",
        type: "\u062A\u062D\u0635\u064A\u0644 \u0625\u064A\u062C\u0627\u0631",
        propertyId: "prop-1",
        unitId: "unit-102",
        assignedTo: "usr-acc",
        createdBy: "usr-gm",
        dueDate: "2026-11-14",
        priority: "\u0639\u0627\u062C\u0644",
        status: "\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630",
        checklist: [
          { text: "\u0625\u0631\u0633\u0627\u0644 \u062A\u0630\u0643\u064A\u0631 \u0633\u062F\u0627\u062F \u0631\u0633\u0645\u064A \u0639\u0628\u0631 \u0627\u0644\u0642\u0648\u0627\u0644\u0628", done: true },
          { text: "\u062A\u062D\u0635\u064A\u0644 \u0627\u0644\u062F\u0641\u0639\u0629 \u0648\u0625\u0635\u062F\u0627\u0631 \u0633\u0646\u062F \u0627\u0644\u0642\u0628\u0636", done: false }
        ],
        comments: [],
        createdAt: "2026-11-13T08:00:00.000Z"
      },
      {
        id: "tsk-4",
        title: "\u062A\u0648\u062B\u064A\u0642 \u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 \u0644\u0644\u0645\u0643\u062A\u0628 \u0627\u0644\u0645\u062D\u062C\u0648\u0632 M-302",
        description: "\u0627\u0644\u0639\u0645\u064A\u0644 \u064A\u0627\u0633\u0631 \u0627\u0644\u0645\u0646\u0635\u0648\u0631 \u0645\u0631\u0628\u0648\u0637 \u0628\u0627\u0644\u0648\u062D\u062F\u0629 \u0625\u062F\u0627\u0631\u064A\u0627\u064B - \u064A\u062C\u0628 \u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u0627\u0644\u062A\u0648\u062B\u064A\u0642 \u0641\u064A \u0625\u064A\u062C\u0627\u0631 \u0642\u0628\u0644 \u0627\u0644\u062A\u0641\u0639\u064A\u0644.",
        type: "\u062A\u062C\u062F\u064A\u062F \u0639\u0642\u062F",
        propertyId: "prop-2",
        unitId: "unit-202",
        assignedTo: "usr-lease",
        createdBy: "usr-lease",
        dueDate: "2026-11-16",
        priority: "\u0645\u062A\u0648\u0633\u0637",
        status: "\u062C\u062F\u064A\u062F\u0629",
        checklist: [
          { text: "\u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0647\u0648\u064A\u0629 \u0648\u0627\u0644\u0633\u062C\u0644", done: true },
          { text: "\u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0639\u0642\u062F \u0641\u064A \u0625\u064A\u062C\u0627\u0631 \u0648\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0631\u0633\u0645\u064A", done: false }
        ],
        comments: [],
        createdAt: "2026-11-14T08:30:00.000Z"
      },
      {
        id: "tsk-arch-1",
        title: "\u0641\u062D\u0635 \u0648\u0645\u0639\u0627\u064A\u0646\u0629 \u0625\u062E\u0644\u0627\u0621 \u0627\u0644\u0627\u0633\u062A\u0648\u062F\u064A\u0648 R-401",
        description: "\u062C\u0631\u062F \u0627\u0644\u0645\u0641\u0627\u062A\u064A\u062D \u0648\u0627\u0644\u0631\u064A\u0645\u0648\u062A\u0627\u062A \u0648\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0639\u062F\u0627\u062F\u0627\u062A \u0642\u0628\u0644 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u0623\u0633\u064A\u0633",
        type: "\u0627\u0633\u062A\u0644\u0627\u0645 \u0648\u0625\u062E\u0644\u0627\u0621",
        propertyId: "prop-1",
        unitId: "unit-arch-1",
        assignedTo: "usr-sup",
        createdBy: "usr-lease",
        dueDate: "2026-09-15",
        priority: "\u0645\u062A\u0648\u0633\u0637",
        status: "\u0645\u0643\u062A\u0645\u0644\u0629",
        checklist: [
          { text: "\u0627\u0633\u062A\u0644\u0627\u0645 \u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u0641\u0627\u062A\u064A\u062D \u0648\u0627\u0644\u0631\u064A\u0645\u0648\u062A\u0627\u062A", done: true },
          { text: "\u062A\u0648\u062B\u064A\u0642 \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621 \u0648\u0627\u0644\u0645\u064A\u0627\u0647", done: true }
        ],
        comments: [],
        createdAt: "2026-09-14T09:00:00.000Z",
        archivedAt: "2026-09-16T02:00:00.000Z",
        archiveReason: "\u0645\u0647\u0645\u0629 \u0645\u0646\u062C\u0632\u0629 \u0648\u0645\u0624\u0631\u0634\u0641\u0629",
        archivedBy: "usr-sup",
        archiveMode: "\u062A\u0644\u0642\u0627\u0626\u064A",
        preArchiveStatus: "\u0645\u0643\u062A\u0645\u0644\u0629"
      }
    ],
    communications: [
      {
        id: "com-1",
        targetType: "\u0645\u0633\u062A\u0623\u062C\u0631",
        targetId: "ten-2",
        targetName: "\u0637\u0627\u0631\u0642 \u0628\u0646 \u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0627\u0644\u0634\u0647\u0631\u064A",
        channel: "\u0631\u0633\u0627\u0644\u0629 \u0646\u0635\u064A\u0629 / \u0648\u0627\u062A\u0633\u0627\u0628",
        templateUsed: "\u0637\u0644\u0628 \u0633\u062F\u0627\u062F \u0627\u0644\u0645\u062A\u0623\u062E\u0631\u0627\u062A",
        language: "ar",
        summary: "\u062A\u0630\u0643\u064A\u0631 \u0628\u0633\u062F\u0627\u062F \u0627\u0644\u0645\u062A\u0628\u0642\u064A \u0645\u0646 \u0627\u0644\u0642\u0633\u0637 \u0627\u0644\u062B\u0627\u0644\u062B (4,500 \u0631.\u0633) \u0648\u0627\u0644\u0642\u0633\u0637 \u0627\u0644\u0631\u0627\u0628\u0639 \u0627\u0644\u0645\u0633\u062A\u062D\u0642 (13,500 \u0631.\u0633).",
        sentBy: "usr-acc",
        createdAt: "2026-11-13T10:30:00.000Z"
      },
      {
        id: "com-2",
        targetType: "\u0645\u0633\u062A\u0623\u062C\u0631",
        targetId: "ten-3",
        targetName: "\u0645\u0624\u0633\u0633\u0629 \u0645\u0630\u0627\u0642 \u0627\u0644\u0628\u0646 \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629",
        channel: "\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A",
        templateUsed: "\u062A\u0630\u0643\u064A\u0631 \u0627\u0644\u0625\u064A\u062C\u0627\u0631 \u0648\u062A\u062C\u062F\u064A\u062F \u0627\u0644\u0639\u0642\u062F",
        language: "ar",
        summary: "\u0625\u0634\u0639\u0627\u0631 \u0628\u0642\u0631\u0628 \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0639\u0642\u062F EJ-1048112233 \u0628\u062A\u0627\u0631\u064A\u062E 2026-11-30 \u0648\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0627\u0644\u062F\u0641\u0639\u0629 \u0627\u0644\u0631\u0627\u0628\u0639\u0629.",
        sentBy: "usr-lease",
        createdAt: "2026-11-14T09:00:00.000Z"
      }
    ],
    documents: [
      {
        id: "doc-1",
        title: "\u0635\u0643 \u0645\u0644\u0643\u064A\u0629 \u0645\u062C\u0645\u0639 \u0627\u0644\u064A\u0627\u0633\u0645\u064A\u0646 \u0627\u0644\u0633\u0643\u0646\u064A",
        category: "\u0635\u0643\u0648\u0643",
        fileName: "deed-410109034821.pdf",
        fileType: "PDF",
        fileSizeKb: 1420,
        relatedType: "\u0639\u0642\u0627\u0631",
        relatedId: "prop-1",
        version: 1,
        uploadedBy: "usr-gm",
        ocrStatus: "\u062A\u0645 \u0627\u0644\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0622\u0644\u064A\u0627\u064B",
        ocrExtracted: {
          docType: "\u0635\u0643 \u0645\u0644\u0643\u064A\u0629",
          propertyNameAr: "\u0645\u062C\u0645\u0639 \u0627\u0644\u064A\u0627\u0633\u0645\u064A\u0646 \u0627\u0644\u0633\u0643\u0646\u064A",
          deedNumber: "410109034821",
          city: "\u0627\u0644\u0631\u064A\u0627\u0636",
          district: "\u062D\u064A \u0627\u0644\u064A\u0627\u0633\u0645\u064A\u0646",
          rawText: "\u0635\u0643 \u0645\u0644\u0643\u064A\u0629 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0631\u0642\u0645 410109034821 - \u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0631\u064A\u0627\u0636 - \u062D\u064A \u0627\u0644\u064A\u0627\u0633\u0645\u064A\u0646 - \u0645\u062C\u0645\u0639 \u0627\u0644\u064A\u0627\u0633\u0645\u064A\u0646 \u0627\u0644\u0633\u0643\u0646\u064A",
          confidenceNote: "\u062A\u0645\u062A \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629 \u0627\u0644\u0645\u0631\u062C\u0639\u064A\u0629 \u0645\u0639 \u0633\u062C\u0644 \u0627\u0644\u0635\u0643\u0648\u0643"
        },
        accessLog: [
          {
            id: "dacc-1",
            userId: "usr-gm",
            userName: "\u0633\u0639\u062F \u0628\u0646 \u0639\u0628\u062F\u0627\u0644\u0639\u0632\u064A\u0632 \u0627\u0644\u0631\u0627\u062C\u062D\u064A",
            deviceName: "MacBook Pro \xB7 \u0645\u0643\u062A\u0628 \u0627\u0644\u0625\u062F\u0627\u0631\u0629",
            action: "\u0645\u0639\u0627\u064A\u0646\u0629",
            accessedAt: "2026-11-10T09:15:00.000Z"
          }
        ],
        createdAt: "2025-01-10T09:00:00.000Z"
      },
      {
        id: "doc-2",
        title: "\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0645\u0648\u062D\u062F - \u0628\u0646\u062F\u0631 \u0627\u0644\u063A\u0627\u0645\u062F\u064A (A-101)",
        category: "\u0639\u0642\u0648\u062F \u0625\u064A\u062C\u0627\u0631",
        fileName: "ejar-EJ-1049283711.pdf",
        fileType: "PDF",
        fileSizeKb: 890,
        relatedType: "\u0639\u0642\u062F",
        relatedId: "ctr-1",
        expiryDate: "2027-01-14",
        version: 1,
        uploadedBy: "usr-lease",
        ocrStatus: "\u062A\u0645 \u0627\u0644\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0622\u0644\u064A\u0627\u064B",
        ocrExtracted: {
          docType: "\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631",
          tenantNameAr: "\u0628\u0646\u062F\u0631 \u0628\u0646 \u0645\u062D\u0645\u062F \u0627\u0644\u063A\u0627\u0645\u062F\u064A",
          nationalIdOrIqama: "1088442211",
          ejarNumber: "EJ-1049283711",
          unitNumber: "A-101",
          startDate: "2026-01-15",
          endDate: "2027-01-14",
          annualRent: 48e3,
          currency: "SAR",
          rawText: "\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 \u0645\u0648\u062D\u062F \u0631\u0642\u0645 EJ-1049283711 - \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631: \u0628\u0646\u062F\u0631 \u0628\u0646 \u0645\u062D\u0645\u062F \u0627\u0644\u063A\u0627\u0645\u062F\u064A - \u0627\u0644\u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0633\u0646\u0648\u064A: 48,000 \u0631.\u0633"
        },
        accessLog: [],
        createdAt: "2026-01-14T10:15:00.000Z"
      },
      {
        id: "doc-3",
        title: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0635\u064A\u0627\u0646\u0629 \u0645\u0643\u064A\u0641 B-204 - \u0645\u0624\u0633\u0633\u0629 \u0646\u0633\u064A\u0645",
        category: "\u0641\u0648\u0627\u062A\u064A\u0631",
        fileName: "INV-NAS-4410.pdf",
        fileType: "PDF",
        fileSizeKb: 315,
        relatedType: "\u0645\u0635\u0631\u0648\u0641",
        relatedId: "exp-2",
        version: 1,
        uploadedBy: "usr-tech",
        ocrStatus: "\u0644\u0645 \u064A\u064F\u062D\u0644\u0644",
        accessLog: [],
        createdAt: "2026-11-12T14:20:00.000Z"
      },
      {
        id: "doc-4",
        title: "\u0635\u0648\u0631\u0629 \u0647\u0648\u064A\u0629 \u0648\u0637\u0646\u064A\u0629 - \u0637\u0627\u0631\u0642 \u0627\u0644\u0634\u0647\u0631\u064A (A-102)",
        category: "\u0647\u0648\u064A\u0627\u062A \u0648\u0625\u0642\u0627\u0645\u0627\u062A",
        fileName: "id-1077331199.jpg",
        fileType: "JPG",
        fileSizeKb: 420,
        relatedType: "\u0645\u0633\u062A\u0623\u062C\u0631",
        relatedId: "ten-2",
        expiryDate: "2026-12-05",
        version: 1,
        uploadedBy: "usr-lease",
        ocrStatus: "\u062A\u0645 \u0627\u0644\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0622\u0644\u064A\u0627\u064B",
        ocrExtracted: {
          docType: "\u0647\u0648\u064A\u0629 / \u0625\u0642\u0627\u0645\u0629",
          tenantNameAr: "\u0637\u0627\u0631\u0642 \u0628\u0646 \u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0627\u0644\u0634\u0647\u0631\u064A",
          nationalIdOrIqama: "1077331199",
          nationality: "\u0633\u0639\u0648\u062F\u064A",
          expiryDate: "2026-12-05",
          rawText: "\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0647\u0648\u064A\u0629 \u0627\u0644\u0648\u0637\u0646\u064A\u0629 - \u0627\u0644\u0627\u0633\u0645: \u0637\u0627\u0631\u0642 \u0628\u0646 \u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0627\u0644\u0634\u0647\u0631\u064A - \u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064A\u0629: 1077331199 - \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621: 2026-12-05"
        },
        accessLog: [],
        createdAt: "2026-02-01T09:10:00.000Z"
      },
      {
        id: "doc-arch-1",
        title: "\u0647\u0648\u064A\u0629 \u0648\u0637\u0646\u064A\u0629 \u0645\u0646\u062A\u0647\u064A\u0629 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 - \u062E\u0627\u0644\u062F \u0627\u0644\u0639\u0644\u064A\u0627\u0646 (R-401)",
        category: "\u0647\u0648\u064A\u0627\u062A \u0648\u0625\u0642\u0627\u0645\u0627\u062A",
        fileName: "id-1055667788-expired.pdf",
        fileType: "PDF",
        fileSizeKb: 380,
        relatedType: "\u0645\u0633\u062A\u0623\u062C\u0631",
        relatedId: "ten-arch-1",
        expiryDate: "2026-06-30",
        version: 1,
        uploadedBy: "usr-lease",
        ocrStatus: "\u062A\u0645 \u0627\u0644\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0622\u0644\u064A\u0627\u064B",
        ocrExtracted: {
          docType: "\u0647\u0648\u064A\u0629 / \u0625\u0642\u0627\u0645\u0629",
          tenantNameAr: "\u062E\u0627\u0644\u062F \u0628\u0646 \u0633\u0639\u0648\u062F \u0627\u0644\u0639\u0644\u064A\u0627\u0646",
          nationalIdOrIqama: "1055667788",
          nationality: "\u0633\u0639\u0648\u062F\u064A",
          expiryDate: "2026-06-30",
          rawText: "\u0647\u0648\u064A\u0629 \u0648\u0637\u0646\u064A\u0629 - \u062E\u0627\u0644\u062F \u0628\u0646 \u0633\u0639\u0648\u062F \u0627\u0644\u0639\u0644\u064A\u0627\u0646 - \u0627\u0646\u062A\u0647\u062A \u0641\u064A 2026-06-30"
        },
        accessLog: [],
        createdAt: "2025-09-10T09:40:00.000Z",
        archivedAt: "2026-07-01T02:00:00.000Z",
        archiveReason: "\u0627\u0646\u062A\u0647\u0627\u0621 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0648\u062B\u064A\u0642\u0629 (\u0645\u0634\u0641\u0631\u0629 \u0644\u0644\u0623\u063A\u0631\u0627\u0636 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064A\u0629)",
        archivedBy: "usr-gm",
        archiveMode: "\u0645\u062C\u062F\u0648\u0644",
        preArchiveStatus: "\u0646\u0634\u0637"
      },
      {
        id: "doc-arch-2",
        title: "\u0646\u0633\u062E\u0629 \u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 2025 - \u0645\u0624\u0633\u0633\u0629 \u0623\u0641\u0642 \u0627\u0644\u0631\u064A\u0627\u0636 (M-108)",
        category: "\u0639\u0642\u0648\u062F \u0625\u064A\u062C\u0627\u0631",
        fileName: "ejar-EJ-1046552211.pdf",
        fileType: "PDF",
        fileSizeKb: 910,
        relatedType: "\u0639\u0642\u062F",
        relatedId: "ctr-arch-2",
        expiryDate: "2025-12-19",
        version: 1,
        uploadedBy: "usr-lease",
        ocrStatus: "\u062A\u0645 \u0627\u0644\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0622\u0644\u064A\u0627\u064B",
        ocrExtracted: {
          docType: "\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631",
          tenantNameAr: "\u0645\u0624\u0633\u0633\u0629 \u0623\u0641\u0642 \u0627\u0644\u0631\u064A\u0627\u0636 \u0644\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u0627\u062A",
          ejarNumber: "EJ-1046552211",
          unitNumber: "M-108",
          annualRent: 38400,
          rawText: "\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 \u0645\u0648\u062D\u062F EJ-1046552211 - \u0627\u0646\u062A\u0647\u0649 \u0641\u064A 2025-12-19"
        },
        accessLog: [],
        createdAt: "2024-12-15T10:00:00.000Z",
        archivedAt: "2025-12-21T02:00:00.000Z",
        archiveReason: "\u0648\u062B\u064A\u0642\u0629 \u0639\u0642\u062F \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629",
        archivedBy: "usr-lease",
        archiveMode: "\u062A\u0644\u0642\u0627\u0626\u064A",
        preArchiveStatus: "\u0646\u0634\u0637"
      }
    ],
    purchaseOrders: [
      {
        id: "po-1",
        poNumber: "PO-2026-001",
        title: "\u062A\u0648\u0631\u064A\u062F \u0648\u062A\u0631\u0643\u064A\u0628 \u0643\u0645\u0628\u0631\u0648\u0633\u0631 \u0645\u0643\u064A\u0641 \u0633\u0628\u0644\u064A\u062A 24 \u0623\u0644\u0641 \u0648\u062D\u062F\u0629 - \u0634\u0642\u0629 B-204",
        propertyId: "prop-1",
        unitId: "unit-104",
        ticketId: "tkt-1",
        category: "\u062A\u0643\u064A\u064A\u0641 \u0648\u062A\u0628\u0631\u064A\u062F",
        status: "\u0645\u0642\u0627\u0631\u0646\u0629 \u0639\u0631\u0648\u0636",
        quotes: [
          {
            vendorId: "vnd-1",
            vendorName: "\u0645\u0624\u0633\u0633\u0629 \u0646\u0633\u064A\u0645 \u0627\u0644\u062A\u0643\u064A\u064A\u0641 \u0648\u0627\u0644\u0635\u064A\u0627\u0646\u0629",
            amount: 1850,
            deliveryDays: 2,
            warrantyMonths: 12,
            notes: "\u0634\u0627\u0645\u0644 \u0627\u0644\u0641\u0631\u064A\u0648\u0646 \u0648\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u0636\u063A\u0637"
          },
          {
            vendorId: "vnd-2",
            vendorName: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0631\u0648\u0627\u062F \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0641\u0646\u064A\u0629",
            amount: 2150,
            deliveryDays: 3,
            warrantyMonths: 12,
            notes: "\u062A\u0648\u0635\u064A\u0644 \u0648\u062A\u0631\u0643\u064A\u0628 \u062E\u0644\u0627\u0644 72 \u0633\u0627\u0639\u0629"
          }
        ],
        selectedVendorId: "vnd-1",
        approvedAmount: 1850,
        currency: "SAR",
        createdBy: "usr-sup",
        createdAt: "2026-11-12T10:00:00.000Z"
      },
      {
        id: "po-2",
        poNumber: "PO-2026-002",
        title: "\u062A\u062C\u0647\u064A\u0632 \u0648\u062A\u0644\u0645\u064A\u0639 \u0645\u062F\u0627\u062E\u0644 \u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0623\u0631\u0636\u064A \u0648\u062A\u0631\u0643\u064A\u0628 \u0625\u0636\u0627\u0621\u0629 LED - \u0628\u0631\u062C \u0627\u0644\u0645\u0644\u0642\u0627",
        propertyId: "prop-2",
        category: "\u0643\u0647\u0631\u0628\u0627\u0621 \u0648\u0625\u0636\u0627\u0621\u0629",
        status: "\u0623\u0645\u0631 \u0634\u0631\u0627\u0621",
        quotes: [
          {
            vendorId: "vnd-2",
            vendorName: "\u0634\u0631\u0643\u0629 \u0627\u0644\u0631\u0648\u0627\u062F \u0644\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0641\u0646\u064A\u0629",
            amount: 3400,
            deliveryDays: 4,
            warrantyMonths: 24,
            notes: "\u0625\u0636\u0627\u0621\u0629 \u0645\u0648\u0641\u0631\u0629 \u0644\u0644\u0637\u0627\u0642\u0629 \u0639\u0627\u0644\u064A\u0629 \u0627\u0644\u062C\u0648\u062F\u0629"
          }
        ],
        selectedVendorId: "vnd-2",
        approvedAmount: 3400,
        currency: "SAR",
        createdBy: "usr-sup",
        approvedBy: "usr-gm",
        createdAt: "2026-11-08T11:30:00.000Z"
      }
    ],
    decisions: [
      {
        id: "dec-1",
        decisionNumber: "DEC-2026-014",
        title: "\u0627\u0639\u062A\u0645\u0627\u062F \u0633\u064A\u0627\u0633\u0629 \u062D\u0633\u0645 \u0627\u0644\u062A\u062C\u062F\u064A\u062F \u0627\u0644\u0645\u0628\u0643\u0631 5% \u0644\u0644\u0645\u0644\u062A\u0632\u0645\u064A\u0646 \u0628\u0627\u0644\u0633\u062F\u0627\u062F",
        category: "\u0639\u0642\u0648\u062F",
        summary: "\u064A\u064F\u0645\u0646\u062D \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631\u0648\u0646 \u0627\u0644\u0645\u0644\u062A\u0632\u0645\u0648\u0646 \u0628\u0633\u062F\u0627\u062F \u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u0642\u0633\u0627\u0637 \u062F\u0648\u0646 \u062A\u0623\u062E\u064A\u0631 \u062E\u0635\u0645 5% \u0639\u0646\u062F \u062A\u062C\u062F\u064A\u062F \u0627\u0644\u0639\u0642\u062F \u0642\u0628\u0644 \u0627\u0646\u062A\u0647\u0627\u0626\u0647 \u0628\u0640 30 \u064A\u0648\u0645\u0627\u064B.",
        effectiveDate: "2026-11-01",
        issuedBy: "usr-gm",
        issuedByName: "\u0633\u0639\u062F \u0628\u0646 \u0639\u0628\u062F\u0627\u0644\u0639\u0632\u064A\u0632 \u0627\u0644\u0631\u0627\u062C\u062D\u064A",
        status: "\u0646\u0627\u0641\u0630",
        createdAt: "2026-11-01T09:00:00.000Z"
      },
      {
        id: "dec-2",
        decisionNumber: "DEC-2026-015",
        title: "\u0625\u0644\u0632\u0627\u0645 \u0631\u0641\u0639 \u0639\u0631\u0636\u064A \u0633\u0639\u0631 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0644\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0641\u0648\u0642 1,500 \u0631.\u0633",
        category: "\u0645\u0627\u0644\u064A",
        summary: "\u0644\u0627 \u064A\u064F\u0639\u062A\u0645\u062F \u0623\u064A \u0645\u0635\u0631\u0648\u0641 \u0623\u0648 \u0623\u0645\u0631 \u0634\u0631\u0627\u0621 \u0635\u064A\u0627\u0646\u0629 \u062A\u062A\u062C\u0627\u0648\u0632 \u0642\u064A\u0645\u062A\u0647 1,500 \u0631.\u0633 \u062F\u0648\u0646 \u0625\u0631\u0641\u0627\u0642 \u0639\u0631\u0636\u064A \u0623\u0633\u0639\u0627\u0631 \u0645\u0642\u0627\u0631\u0646\u064A\u0646.",
        effectiveDate: "2026-11-10",
        issuedBy: "usr-gm",
        issuedByName: "\u0633\u0639\u062F \u0628\u0646 \u0639\u0628\u062F\u0627\u0644\u0639\u0632\u064A\u0632 \u0627\u0644\u0631\u0627\u062C\u062D\u064A",
        status: "\u0646\u0627\u0641\u0630",
        createdAt: "2026-11-10T12:00:00.000Z"
      }
    ],
    notifications: [
      {
        id: "not-1",
        titleAr: "\u0645\u0635\u0631\u0648\u0641 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
        titleEn: "Expense awaiting GM approval",
        messageAr: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0635\u064A\u0627\u0646\u0629 \u0634\u0642\u0629 B-204 \u0628\u0645\u0628\u0644\u063A 1,850 \u0631.\u0633 \u062A\u0645\u062A \u0645\u0631\u0627\u062C\u0639\u062A\u0647\u0627 \u0645\u0646 \u0627\u0644\u0645\u0634\u0631\u0641 \u0648\u062A\u0646\u062A\u0638\u0631 \u0627\u0639\u062A\u0645\u0627\u062F\u0643.",
        messageEn: "Maintenance invoice for Unit B-204 (1,850 SAR) approved by supervisor and awaiting GM sign-off.",
        category: "\u0645\u0627\u0644\u064A\u0629",
        targetRoles: ["gm", "accountant"],
        relatedView: "accounting",
        isReadBy: [],
        createdAt: "2026-11-12T14:22:00.000Z"
      },
      {
        id: "not-2",
        titleAr: "\u0639\u0642\u062F \u062A\u062C\u0627\u0631\u064A \u064A\u0642\u062A\u0631\u0628 \u0645\u0646 \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621 (16 \u064A\u0648\u0645\u0627\u064B)",
        titleEn: "Commercial lease expiring in 16 days",
        messageAr: "\u0639\u0642\u062F \u0627\u0644\u0645\u0639\u0631\u0636 S-01 (\u0645\u0624\u0633\u0633\u0629 \u0645\u0630\u0627\u0642 \u0627\u0644\u0628\u0646) \u064A\u0646\u062A\u0647\u064A \u0641\u064A 2026-11-30 \u0645\u0639 \u062F\u0641\u0639\u0629 \u0645\u0633\u062A\u062D\u0642\u0629 \u0627\u0644\u064A\u0648\u0645.",
        messageEn: "Lease for Showroom S-01 expires on 2026-11-30 with installment due today.",
        category: "\u062A\u0634\u063A\u064A\u0644\u064A\u0629",
        targetRoles: ["gm", "leasing", "supervisor", "accountant"],
        relatedView: "leasing",
        isReadBy: [],
        createdAt: "2026-11-14T08:00:00.000Z"
      }
    ],
    reminderRules: [
      {
        id: "rem-1",
        nameAr: "\u062A\u0630\u0643\u064A\u0631 \u0645\u0628\u0643\u0631 \u0642\u0628\u0644 \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0628\u0640 7 \u0623\u064A\u0627\u0645",
        nameEn: "7-Day Advance Rent Reminder",
        enabled: true,
        daysBeforeDue: 7,
        channels: ["\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A", "\u0648\u0627\u062A\u0633\u0627\u0628"],
        templateAr: "\u0645\u0631\u062D\u0628\u0627\u064B {tenant}\u060C \u0646\u0648\u062F \u062A\u0630\u0643\u064A\u0631\u0643\u0645 \u0628\u0627\u0642\u062A\u0631\u0627\u0628 \u0645\u0648\u0639\u062F \u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0627\u0644\u0642\u0633\u0637 \u0631\u0642\u0645 {installment} \u0644\u0639\u0642\u062F {contract} (\u0627\u0644\u0648\u062D\u062F\u0629 {unit}) \u0628\u0642\u064A\u0645\u0629 {amount} \u0628\u062A\u0627\u0631\u064A\u062E {dueDate}.",
        templateEn: "Hello {tenant}, your rent installment #{installment} for contract {contract} (Unit {unit}) of {amount} is due on {dueDate}.",
        lastRunAt: "2026-11-14T08:00:00.000Z",
        createdBy: "usr-lease",
        createdAt: "2026-10-01T09:00:00.000Z"
      },
      {
        id: "rem-2",
        nameAr: "\u062A\u0646\u0628\u064A\u0647 \u064A\u0648\u0645 \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0648\u0627\u0644\u0645\u062A\u0623\u062E\u0631\u0627\u062A \u0639\u0628\u0631 SMS \u0648\u0627\u0644\u0648\u0627\u062A\u0633\u0627\u0628",
        nameEn: "Due Date & Overdue SMS/WhatsApp Alert",
        enabled: true,
        daysBeforeDue: 0,
        channels: ["\u0631\u0633\u0627\u0626\u0644 \u0646\u0635\u064A\u0629 SMS (\u0645\u062D\u0627\u0643\u0627\u0629)", "\u0648\u0627\u062A\u0633\u0627\u0628"],
        templateAr: "\u0639\u0632\u064A\u0632\u064A {tenant}\u060C \u0646\u0631\u062C\u0648 \u0627\u0644\u0645\u0628\u0627\u062F\u0631\u0629 \u0628\u0633\u062F\u0627\u062F \u062F\u0641\u0639\u0629 \u0627\u0644\u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0645\u0633\u062A\u062D\u0642\u0629 \u0644\u0644\u0648\u062D\u062F\u0629 {unit} \u0628\u0645\u0628\u0644\u063A {amount} (\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 {dueDate}).",
        templateEn: "Dear {tenant}, rent installment for Unit {unit} ({amount}) due on {dueDate} requires settlement.",
        lastRunAt: "2026-11-14T08:30:00.000Z",
        createdBy: "usr-acc",
        createdAt: "2026-10-15T09:00:00.000Z"
      }
    ],
    reminderLogs: [
      {
        id: "rlog-1",
        ruleId: "rem-2",
        ruleName: "\u062A\u0646\u0628\u064A\u0647 \u064A\u0648\u0645 \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0648\u0627\u0644\u0645\u062A\u0623\u062E\u0631\u0627\u062A \u0639\u0628\u0631 SMS \u0648\u0627\u0644\u0648\u0627\u062A\u0633\u0627\u0628",
        contractId: "ctr-3",
        installmentId: "inst-10",
        tenantId: "ten-3",
        tenantName: "\u0645\u0624\u0633\u0633\u0629 \u0645\u0630\u0627\u0642 \u0627\u0644\u0628\u0646 \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629",
        channel: "\u0648\u0627\u062A\u0633\u0627\u0628",
        recipient: "0502233445",
        messagePreview: "\u0639\u0632\u064A\u0632\u064A \u0645\u0624\u0633\u0633\u0629 \u0645\u0630\u0627\u0642 \u0627\u0644\u0628\u0646 \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629\u060C \u0646\u0631\u062C\u0648 \u0627\u0644\u0645\u0628\u0627\u062F\u0631\u0629 \u0628\u0633\u062F\u0627\u062F \u062F\u0641\u0639\u0629 \u0627\u0644\u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0645\u0633\u062A\u062D\u0642\u0629 \u0644\u0644\u0648\u062D\u062F\u0629 S-01 \u0628\u0645\u0628\u0644\u063A 30,000 \u0631.\u0633 (\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 2026-11-14).",
        dueDate: "2026-11-14",
        amount: 3e4,
        currency: "SAR",
        status: "\u062A\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 (\u0645\u062D\u0627\u0643\u0627\u0629)",
        sentAt: "2026-11-14T08:30:00.000Z"
      },
      {
        id: "rlog-2",
        ruleId: "rem-1",
        ruleName: "\u062A\u0630\u0643\u064A\u0631 \u0645\u0628\u0643\u0631 \u0642\u0628\u0644 \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0628\u0640 7 \u0623\u064A\u0627\u0645",
        contractId: "ctr-2",
        installmentId: "inst-6",
        tenantId: "ten-2",
        tenantName: "\u0637\u0627\u0631\u0642 \u0628\u0646 \u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0627\u0644\u0634\u0647\u0631\u064A",
        channel: "\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A",
        recipient: "tariq.s@yahoo.com",
        messagePreview: "\u0645\u0631\u062D\u0628\u0627\u064B \u0637\u0627\u0631\u0642 \u0628\u0646 \u0625\u0628\u0631\u0627\u0647\u064A\u0645 \u0627\u0644\u0634\u0647\u0631\u064A\u060C \u0646\u0648\u062F \u062A\u0630\u0643\u064A\u0631\u0643\u0645 \u0628\u0627\u0642\u062A\u0631\u0627\u0628 \u0645\u0648\u0639\u062F \u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0627\u0644\u0642\u0633\u0637 \u0631\u0642\u0645 4 \u0644\u0639\u0642\u062F CNT-2026-002 (\u0627\u0644\u0648\u062D\u062F\u0629 A-102) \u0628\u0642\u064A\u0645\u0629 13,500 \u0631.\u0633 \u0628\u062A\u0627\u0631\u064A\u062E 2026-11-01.",
        dueDate: "2026-11-01",
        amount: 13500,
        currency: "SAR",
        status: "\u062A\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 (\u0645\u062D\u0627\u0643\u0627\u0629)",
        sentAt: "2026-11-13T10:00:00.000Z"
      }
    ],
    auditLogs: [
      {
        id: "aud-1",
        userId: "usr-tech",
        userName: "\u0639\u0645\u0631 \u0628\u0646 \u0633\u0639\u064A\u062F \u0627\u0644\u0642\u062D\u0637\u0627\u0646\u064A",
        userRole: "\u0641\u0646\u064A \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0627\u0644\u0645\u064A\u062F\u0627\u0646\u064A",
        deviceName: "Android Mobile \xB7 \u062C\u0648\u0627\u0644 \u0627\u0644\u0641\u0646\u064A",
        action: "\u0631\u0641\u0639 \u0641\u0627\u062A\u0648\u0631\u0629 \u0635\u064A\u0627\u0646\u0629",
        entityType: "Expense",
        entityId: "exp-2",
        summary: "\u0631\u0641\u0639 \u0641\u0627\u062A\u0648\u0631\u0629 \u0635\u064A\u0627\u0646\u0629 INV-NAS-4410 \u0628\u0645\u0628\u0644\u063A 1,850 \u0631.\u0633 \u0644\u0644\u0628\u0644\u0627\u063A MNT-2026-001",
        newValue: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0634\u0631\u0641",
        createdAt: "2026-11-12T14:20:00.000Z"
      },
      {
        id: "aud-2",
        userId: "usr-sup",
        userName: "\u0645\u0627\u062C\u062F \u0628\u0646 \u062A\u0631\u0643\u064A \u0627\u0644\u062D\u0631\u0628\u064A",
        userRole: "\u0645\u0634\u0631\u0641 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u062A\u0634\u063A\u064A\u0644",
        deviceName: "Android Tablet \xB7 \u0645\u064A\u062F\u0627\u0646\u064A",
        action: "\u0627\u0639\u062A\u0645\u0627\u062F \u0645\u0631\u062D\u0644\u0629 \u0623\u0648\u0644\u0649 (\u0645\u0634\u0631\u0641)",
        entityType: "Expense",
        entityId: "exp-2",
        summary: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0648\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0645\u0635\u0631\u0648\u0641 EXP-2026-0002 \u0648\u0625\u062D\u0627\u0644\u062A\u0647 \u0644\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0644\u062A\u062C\u0627\u0648\u0632 \u062D\u062F 500 \u0631.\u0633",
        oldValue: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0634\u0631\u0641",
        newValue: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u062F\u064A\u0631",
        createdAt: "2026-11-12T14:22:00.000Z"
      },
      {
        id: "aud-3",
        userId: "usr-lease",
        userName: "\u0631\u064A\u0645 \u0628\u0646\u062A \u062E\u0627\u0644\u062F \u0627\u0644\u0639\u062A\u064A\u0628\u064A",
        userRole: "\u0645\u0633\u0624\u0648\u0644\u0629 \u0627\u0644\u062A\u0623\u062C\u064A\u0631 \u0648\u0627\u0644\u0639\u0642\u0648\u062F",
        deviceName: "iPad Pro \xB7 \u0645\u0643\u062A\u0628 \u0627\u0644\u062A\u0623\u062C\u064A\u0631",
        action: "\u0631\u0628\u0637 \u0625\u062F\u0627\u0631\u064A \u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u0628\u0648\u062D\u062F\u0629",
        entityType: "Unit",
        entityId: "unit-202",
        summary: "\u0631\u0628\u0637 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u064A\u0627\u0633\u0631 \u0627\u0644\u0645\u0646\u0635\u0648\u0631 \u0628\u0627\u0644\u0645\u0643\u062A\u0628 M-302 \u0643\u0648\u062D\u062F\u0629 \u0645\u062D\u062C\u0648\u0632\u0629 \u062F\u0648\u0646 \u0625\u0646\u0634\u0627\u0621 \u0639\u0642\u062F \u062A\u0644\u0642\u0627\u0626\u064A",
        oldValue: "\u0634\u0627\u063A\u0631\u0629",
        newValue: "\u0645\u062D\u062C\u0648\u0632\u0629",
        createdAt: "2026-11-10T11:05:00.000Z"
      }
    ],
    backups: [
      {
        id: "bkp-1",
        label: "\u0646\u0633\u062E\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0629 \u064A\u0648\u0645\u064A\u0629 \u0645\u0634\u0641\u0631\u0629 \xB7 2026-11-14",
        createdAt: "2026-11-14T03:00:00.000Z",
        createdBy: "\u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0622\u0644\u064A",
        recordCount: 48,
        sizeKb: 64
      }
    ],
    counters: {
      receipt: 3,
      contract: 3,
      ticket: 2,
      expense: 3,
      journal: 2
    },
    processedIdempotencyKeys: ["seed-pay-1", "seed-pay-2", "seed-pay-3", "seed-pay-arch-1", "seed-pay-arch-2"],
    savedArchiveFilters: [
      {
        id: "af-1",
        name: "\u0639\u0642\u0648\u062F 2025 \u0641\u0648\u0642 20,000 \u0631.\u0633",
        category: "contracts",
        year: "2025",
        minAmount: 2e4,
        timeframe: "all",
        createdBy: "usr-gm",
        createdAt: "2026-10-10T09:00:00.000Z"
      },
      {
        id: "af-2",
        name: "\u0627\u0644\u0625\u064A\u0635\u0627\u0644\u0627\u062A \u0627\u0644\u0645\u0639\u0643\u0648\u0633\u0629 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0636\u0631\u064A\u0628\u064A\u0629",
        category: "receipts",
        timeframe: "this_year",
        createdBy: "usr-acc",
        createdAt: "2026-10-15T11:30:00.000Z"
      }
    ],
    archiveLastNightlyRun: "2026-11-14T02:00:00.000Z",
    archiveSeeded: true,
    securityPolicy: {
      minPasswordLength: 8,
      requireSpecialChars: true,
      passwordExpiryDays: 90,
      autoLockMinutes: 5,
      maxFailedAttempts: 5,
      require2faForManagersAndAccountants: true
    },
    loginHistory: [
      {
        id: "lgn-1",
        userId: "usr-gm",
        userName: "\u0641\u0647\u062F \u0628\u0646 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646 \u0627\u0644\u0633\u0628\u064A\u0639\u064A",
        userRole: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0634\u0631\u0643\u0629 / \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
        deviceName: "Windows Desktop \xB7 \u0627\u0644\u0645\u0643\u062A\u0628 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
        ipAddress: "192.168.10.24",
        geoLocation: "\u0627\u0644\u0631\u064A\u0627\u0636 \xB7 \u0627\u0644\u0639\u0644\u064A\u0627",
        method: "\u0645\u0635\u0627\u062F\u0642\u0629 \u062B\u0646\u0627\u0626\u064A\u0629 (2FA)",
        success: true,
        createdAt: "2026-11-14T08:05:00.000Z"
      },
      {
        id: "lgn-2",
        userId: "usr-acc",
        userName: "\u0633\u0644\u0645\u0627\u0646 \u0628\u0646 \u0646\u0627\u0635\u0631 \u0627\u0644\u062F\u0648\u0633\u0631\u064A",
        userRole: "\u0627\u0644\u0645\u062D\u0627\u0633\u0628 \u0627\u0644\u0645\u0627\u0644\u064A",
        deviceName: "Windows Desktop \xB7 \u0642\u0633\u0645 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629",
        ipAddress: "192.168.10.31",
        geoLocation: "\u0627\u0644\u0631\u064A\u0627\u0636 \xB7 \u0627\u0644\u0639\u0644\u064A\u0627",
        method: "\u0645\u0635\u0627\u062F\u0642\u0629 \u062B\u0646\u0627\u0626\u064A\u0629 (2FA)",
        success: true,
        createdAt: "2026-11-14T08:15:00.000Z"
      },
      {
        id: "lgn-3",
        userId: "usr-tech",
        userName: "\u0639\u0645\u0631 \u0628\u0646 \u0633\u0639\u064A\u062F \u0627\u0644\u0642\u062D\u0637\u0627\u0646\u064A",
        userRole: "\u0641\u0646\u064A \u0627\u0644\u0635\u064A\u0627\u0646\u0629",
        deviceName: "Android Mobile \xB7 \u062C\u0648\u0627\u0644 \u0627\u0644\u0641\u0646\u064A",
        ipAddress: "10.42.19.88",
        geoLocation: "\u0627\u0644\u0631\u064A\u0627\u0636 \xB7 \u0627\u0644\u064A\u0627\u0633\u0645\u064A\u0646 (\u0645\u064A\u062F\u0627\u0646\u064A)",
        method: "\u0628\u0635\u0645\u0629 / Face ID",
        success: true,
        createdAt: "2026-11-14T09:12:00.000Z"
      }
    ],
    syncConflicts: [
      {
        id: "cnf-1",
        entityType: "Unit",
        entityId: "unit-203",
        entityLabel: "\u0627\u0644\u0645\u0643\u062A\u0628 M-405 \xB7 \u0628\u0631\u062C \u0627\u0644\u0645\u0644\u0642\u0627",
        firstActorName: "\u0631\u064A\u0645 \u0627\u0644\u0639\u062A\u064A\u0628\u064A (iPad Pro)",
        secondActorName: "\u0645\u0627\u062C\u062F \u0627\u0644\u062D\u0631\u0628\u064A (Android Tablet - \u0648\u0636\u0639 \u0639\u062F\u0645 \u0627\u0644\u0627\u062A\u0635\u0627\u0644)",
        firstChangeSummary: "\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0645\u0642\u062A\u0631\u062D \u0625\u0644\u0649 62,000 \u0631.\u0633",
        secondChangeSummary: '\u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u062C\u0647\u064A\u0632 \u0625\u0644\u0649 "\u062A\u062D\u062A\u0627\u062C \u0625\u0644\u0649 \u062A\u0646\u0638\u064A\u0641"',
        status: "\u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0623\u062D\u062F\u062B",
        resolvedBy: "\u0641\u0647\u062F \u0627\u0644\u0633\u0628\u064A\u0639\u064A",
        resolvedAt: "2026-11-13T16:40:00.000Z",
        createdAt: "2026-11-13T16:10:00.000Z"
      }
    ],
    communicationTemplates: [
      {
        id: "tpl-pay-1",
        name: "\u062A\u0630\u0643\u064A\u0631 \u0642\u0628\u0644 \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642",
        category: "payment",
        channel: "whatsapp",
        language: "ar",
        contentAr: "\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u064A\u0643\u0645 {{tenant_name}}\u060C\n\u0646\u0648\u062F \u062A\u0630\u0643\u064A\u0631\u0643\u0645 \u0628\u0623\u0646 \u0625\u064A\u062C\u0627\u0631 \u0648\u062D\u062F\u0629 {{unit_number}} \u0641\u064A {{property_name}} \u0628\u0642\u064A\u0645\u0629 {{amount}} \u0631\u064A\u0627\u0644 \u0645\u0633\u062A\u062D\u0642 \u0628\u062A\u0627\u0631\u064A\u062E {{due_date}}.\n\u064A\u0645\u0643\u0646\u0643\u0645 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0639\u0644\u0649 \u0627\u0644\u062D\u0633\u0627\u0628:\n{{bank_name}} - {{iban}}\n\u0634\u0627\u0643\u0631\u064A\u0646 \u062A\u0639\u0627\u0648\u0646\u0643\u0645.\n\u2014 {{company_name}}",
        contentEn: "Dear {{tenant_name}}, friendly reminder that rent for {{unit_number}} at {{property_name}} ({{amount}} SAR) is due on {{due_date}}. Bank: {{bank_name}} - {{iban}}. \u2014 {{company_name}}",
        isFavorite: true,
        usageCount: 48,
        scheduleEnabled: true,
        scheduleDaysOffset: 3,
        scheduleTime: "09:00",
        allowedRoles: ["sys_owner", "gm", "accountant", "leasing"],
        createdBy: "usr-gm",
        updatedAt: "2026-11-10T09:00:00.000Z"
      },
      {
        id: "tpl-pay-2",
        name: "\u0625\u0634\u0639\u0627\u0631 \u0628\u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645",
        category: "payment",
        channel: "whatsapp",
        language: "ar",
        contentAr: "\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u062F\u0641\u0639\u062A\u0643\u0645 \u0628\u0642\u064A\u0645\u0629 {{paid_amount}} \u0631\u064A\u0627\u0644 \u0628\u0646\u062C\u0627\u062D.\n\u0631\u0642\u0645 \u0627\u0644\u0625\u064A\u0635\u0627\u0644: {{receipt_number}}\n\u0627\u0644\u0648\u062D\u062F\u0629: {{unit_number}} \xB7 {{property_name}}\n\u0627\u0644\u0645\u062A\u0628\u0642\u064A: {{remaining}} \u0631\u064A\u0627\u0644.\n\u0634\u0643\u0631\u0627\u064B \u0644\u0627\u0644\u062A\u0632\u0627\u0645\u0643\u0645 \u2014 {{company_name}}",
        contentEn: "Payment of {{paid_amount}} SAR received successfully. Receipt: {{receipt_number}}. Remaining balance: {{remaining}} SAR. Thank you \u2014 {{company_name}}",
        isFavorite: true,
        usageCount: 64,
        allowedRoles: ["sys_owner", "gm", "accountant"],
        createdBy: "usr-acc",
        updatedAt: "2026-11-11T10:30:00.000Z"
      },
      {
        id: "tpl-pay-3",
        name: "\u062A\u0646\u0628\u064A\u0647 \u062A\u0623\u062E\u064A\u0631",
        category: "payment",
        channel: "whatsapp",
        language: "ar",
        contentAr: "\u0639\u0632\u064A\u0632\u064A/\u0629 {{tenant_name}}\u060C \u0646\u0623\u0633\u0641 \u0644\u0625\u0628\u0644\u0627\u063A\u0643\u0645 \u0628\u062A\u0623\u062E\u0631 \u0633\u062F\u0627\u062F \u0625\u064A\u062C\u0627\u0631 {{unit_number}} ({{property_name}}) \u0627\u0644\u0645\u0633\u062A\u062D\u0642 \u0645\u0646\u0630 {{days_overdue}} \u064A\u0648\u0645 \u0628\u0645\u0628\u0644\u063A {{amount}} \u0631\u064A\u0627\u0644. \u0646\u0631\u062C\u0648 \u0627\u0644\u0633\u062F\u0627\u062F \u0641\u064A \u0623\u0642\u0631\u0628 \u0648\u0642\u062A \u0644\u062A\u062C\u0646\u0628 \u0623\u064A \u0631\u0633\u0648\u0645 \u0625\u0636\u0627\u0641\u064A\u0629.\n\u2014 {{company_name}}",
        contentEn: "Dear {{tenant_name}}, your rent for {{unit_number}} is {{days_overdue}} days overdue ({{amount}} SAR). Please settle promptly. \u2014 {{company_name}}",
        isFavorite: true,
        usageCount: 29,
        allowedRoles: ["sys_owner", "gm", "accountant", "leasing"],
        createdBy: "usr-acc",
        updatedAt: "2026-11-12T12:00:00.000Z"
      },
      {
        id: "tpl-pay-4",
        name: "\u0625\u0634\u0639\u0627\u0631 \u062F\u0641\u0639\u0629 \u062C\u0632\u0626\u064A\u0629",
        category: "payment",
        channel: "sms",
        language: "ar",
        contentAr: "\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 {{paid_amount}} \u0631\u064A\u0627\u0644 \u0645\u0646 \u0625\u062C\u0645\u0627\u0644\u064A {{total_due}} \u0631\u064A\u0627\u0644 \u0644\u0648\u062D\u062F\u0629 {{unit_number}}. \u0627\u0644\u0645\u062A\u0628\u0642\u064A: {{remaining}} \u0631\u064A\u0627\u0644. \u0646\u0631\u062C\u0648 \u0633\u062F\u0627\u062F \u0627\u0644\u0645\u062A\u0628\u0642\u064A \u0642\u0628\u0644 {{new_due_date}}.",
        contentEn: "Partial payment {{paid_amount}} SAR received out of {{total_due}} SAR. Remaining {{remaining}} SAR due before {{new_due_date}}.",
        usageCount: 15,
        allowedRoles: ["sys_owner", "gm", "accountant"],
        createdBy: "usr-acc",
        updatedAt: "2026-11-08T14:00:00.000Z"
      },
      {
        id: "tpl-ctr-1",
        name: "\u062A\u0631\u062D\u064A\u0628 \u0645\u0633\u062A\u0623\u062C\u0631 \u062C\u062F\u064A\u062F",
        category: "contract",
        channel: "whatsapp",
        language: "ar",
        contentAr: "\u0623\u0647\u0644\u0627\u064B \u0628\u0643 {{tenant_name}} \u0641\u064A {{property_name}}. \u0646\u062A\u0645\u0646\u0649 \u0644\u0643 \u0625\u0642\u0627\u0645\u0629 \u0645\u0631\u064A\u062D\u0629.\n\u0631\u0642\u0645 \u0648\u062D\u062F\u062A\u0643: {{unit_number}}\n\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0642\u0627\u0631: {{manager_name}} - {{manager_phone}}\n\u2014 {{company_name}}",
        contentEn: "Welcome {{tenant_name}} to {{property_name}}! Unit: {{unit_number}}. Property Manager: {{manager_name}} ({{manager_phone}}). \u2014 {{company_name}}",
        isFavorite: true,
        usageCount: 22,
        allowedRoles: ["sys_owner", "gm", "leasing", "receptionist"],
        createdBy: "usr-lease",
        updatedAt: "2026-11-05T11:00:00.000Z"
      },
      {
        id: "tpl-ctr-2",
        name: "\u062A\u0630\u0643\u064A\u0631 \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0639\u0642\u062F",
        category: "contract",
        channel: "whatsapp",
        language: "ar",
        contentAr: "\u0639\u0632\u064A\u0632\u064A {{tenant_name}}\u060C \u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 {{unit_number}} \u0641\u064A {{property_name}} \u0633\u064A\u0646\u062A\u0647\u064A \u0641\u064A {{end_date}}. \u0646\u0631\u062C\u0648 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0644\u062A\u062C\u062F\u064A\u062F \u0627\u0644\u0639\u0642\u062F \u0623\u0648 \u062A\u0631\u062A\u064A\u0628 \u0625\u062C\u0631\u0627\u0621\u0627\u062A \u0627\u0644\u0625\u062E\u0644\u0627\u0621.\n\u2014 {{company_name}}",
        contentEn: "Dear {{tenant_name}}, lease for {{unit_number}} ends on {{end_date}}. Please contact us for renewal or handover.",
        usageCount: 18,
        scheduleEnabled: true,
        scheduleDaysOffset: 30,
        scheduleTime: "10:00",
        allowedRoles: ["sys_owner", "gm", "leasing"],
        createdBy: "usr-lease",
        updatedAt: "2026-11-06T09:15:00.000Z"
      },
      {
        id: "tpl-ctr-3",
        name: "\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062A\u062C\u062F\u064A\u062F",
        category: "contract",
        channel: "whatsapp",
        language: "ar",
        contentAr: "\u062A\u0645 \u062A\u062C\u062F\u064A\u062F \u0639\u0642\u062F {{unit_number}} ({{property_name}}) \u0628\u0646\u062C\u0627\u062D \u0644\u0645\u062F\u0629 {{duration}} \u0628\u0642\u064A\u0645\u0629 {{new_rent}} \u0631\u064A\u0627\u0644 \u0633\u0646\u0648\u064A\u0627\u064B. \u0634\u0643\u0631\u0627\u064B \u0644\u062B\u0642\u062A\u0643\u0645 \u2014 {{company_name}}.",
        contentEn: "Your lease for {{unit_number}} has been renewed for {{duration}} at {{new_rent}} SAR. Thank you \u2014 {{company_name}}.",
        usageCount: 11,
        allowedRoles: ["sys_owner", "gm", "leasing"],
        createdBy: "usr-lease",
        updatedAt: "2026-11-04T15:00:00.000Z"
      },
      {
        id: "tpl-ctr-4",
        name: "\u0625\u0634\u0639\u0627\u0631 \u0625\u062E\u0644\u0627\u0621",
        category: "contract",
        channel: "email",
        language: "ar",
        contentAr: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0637\u0644\u0628 \u0627\u0644\u0625\u062E\u0644\u0627\u0621 \u0644\u0648\u062D\u062F\u0629 {{unit_number}} \u0641\u064A {{property_name}}. \u0646\u0631\u062C\u0648 \u0627\u0644\u062D\u0636\u0648\u0631 \u0641\u064A {{handover_date}} \u0644\u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0648\u062D\u062F\u0629 \u0648\u062A\u0633\u0644\u064A\u0645 \u0627\u0644\u0645\u0641\u0627\u062A\u064A\u062D \u0645\u0639 \u0627\u0644\u0645\u0634\u0631\u0641 {{manager_name}}.",
        contentEn: "Move-out request logged for {{unit_number}}. Please attend on {{handover_date}} for unit inspection and key handover.",
        usageCount: 7,
        allowedRoles: ["sys_owner", "gm", "leasing", "supervisor"],
        createdBy: "usr-lease",
        updatedAt: "2026-11-03T12:20:00.000Z"
      },
      {
        id: "tpl-mnt-1",
        name: "\u0627\u0633\u062A\u0644\u0627\u0645 \u0628\u0644\u0627\u063A \u0635\u064A\u0627\u0646\u0629",
        category: "maintenance",
        channel: "whatsapp",
        language: "ar",
        contentAr: "\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0628\u0644\u0627\u063A\u0643\u0645 \u0631\u0642\u0645 {{ticket_id}} \u0628\u062E\u0635\u0648\u0635 {{issue_type}} \u0641\u064A {{unit_number}}.\n\u0633\u064A\u062A\u0645 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0643\u0645 \u062E\u0644\u0627\u0644 {{response_time}} \u0644\u062A\u0631\u062A\u064A\u0628 \u0627\u0644\u0645\u0648\u0639\u062F.\n\u0634\u0643\u0631\u0627\u064B \u0644\u0635\u0628\u0631\u0643\u0645.\n\u2014 \u0641\u0631\u064A\u0642 \u0627\u0644\u0635\u064A\u0627\u0646\u0629\u060C {{company_name}}",
        contentEn: "Maintenance ticket {{ticket_id}} for {{issue_type}} in {{unit_number}} received. We will contact you within {{response_time}}.",
        isFavorite: true,
        usageCount: 34,
        allowedRoles: ["sys_owner", "gm", "maint_manager", "technician", "receptionist"],
        createdBy: "usr-mnt",
        updatedAt: "2026-11-09T13:00:00.000Z"
      },
      {
        id: "tpl-mnt-2",
        name: "\u0625\u0633\u0646\u0627\u062F \u0644\u0641\u0646\u064A \u0627\u0644\u0635\u064A\u0627\u0646\u0629",
        category: "maintenance",
        channel: "whatsapp",
        language: "ar",
        contentAr: "\u062A\u0645 \u0625\u0633\u0646\u0627\u062F \u0628\u0644\u0627\u063A\u0643\u0645 ({{ticket_id}}) \u0644\u0644\u0641\u0646\u064A {{technician_name}}. \u0633\u064A\u0635\u0644\u0643\u0645 \u062E\u0644\u0627\u0644 {{eta}}. \u0631\u0642\u0645 \u0627\u0644\u062A\u0648\u0627\u0635\u0644: {{tech_phone}}.",
        contentEn: "Ticket {{ticket_id}} assigned to technician {{technician_name}} (ETA: {{eta}}, Phone: {{tech_phone}}).",
        usageCount: 27,
        allowedRoles: ["sys_owner", "gm", "maint_manager", "technician"],
        createdBy: "usr-mnt",
        updatedAt: "2026-11-07T16:10:00.000Z"
      },
      {
        id: "tpl-mnt-3",
        name: "\u0627\u0643\u062A\u0645\u0627\u0644 \u0627\u0644\u0625\u0635\u0644\u0627\u062D",
        category: "maintenance",
        channel: "whatsapp",
        language: "ar",
        contentAr: "\u062A\u0645 \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621 \u0645\u0646 \u0625\u0635\u0644\u0627\u062D {{issue_type}} \u0641\u064A {{unit_number}} (\u0628\u0644\u0627\u063A {{ticket_id}}). \u0646\u0631\u062C\u0648 \u0627\u0644\u062A\u0623\u0643\u064A\u062F \u0639\u0644\u0649 \u062C\u0648\u062F\u0629 \u0627\u0644\u0639\u0645\u0644. \u0634\u0643\u0631\u0627\u064B \u0644\u0635\u0628\u0631\u0643\u0645 \u2014 {{company_name}}.",
        contentEn: "Maintenance {{issue_type}} in {{unit_number}} ({{ticket_id}}) is completed. Please confirm service quality.",
        usageCount: 25,
        allowedRoles: ["sys_owner", "gm", "maint_manager", "technician"],
        createdBy: "usr-mnt",
        updatedAt: "2026-11-09T18:00:00.000Z"
      },
      {
        id: "tpl-sup-1",
        name: "\u0637\u0644\u0628 \u0639\u0631\u0636 \u0633\u0639\u0631",
        category: "supplier",
        channel: "email",
        language: "ar",
        contentAr: "\u0627\u0644\u0633\u0627\u062F\u0629 \u0627\u0644\u0645\u0648\u0631\u062F\u064A\u0646\u060C \u0646\u0631\u062C\u0648 \u062A\u0632\u0648\u064A\u062F\u0646\u0627 \u0628\u0639\u0631\u0636 \u0633\u0639\u0631 \u0644\u0640 {{service_description}} \u0641\u064A {{property_name}} - {{unit_number}}. \u0646\u0631\u062C\u0648 \u0627\u0644\u0631\u062F \u062E\u0644\u0627\u0644 {{deadline}}.\n\u2014 {{company_name}}",
        contentEn: "Please provide a quotation for {{service_description}} at {{property_name}} - {{unit_number}} before {{deadline}}.",
        usageCount: 14,
        allowedRoles: ["sys_owner", "gm", "maint_manager", "accountant"],
        createdBy: "usr-mnt",
        updatedAt: "2026-11-02T11:00:00.000Z"
      },
      {
        id: "tpl-sup-2",
        name: "\u062A\u0623\u0643\u064A\u062F \u0637\u0644\u0628 \u0639\u0645\u0644",
        category: "supplier",
        channel: "whatsapp",
        language: "ar",
        contentAr: "\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0637\u0644\u0628 \u0627\u0644\u0639\u0645\u0644 \u0631\u0642\u0645 {{work_order_id}}. \u0627\u0644\u0645\u0648\u0639\u062F: {{scheduled_date}} \u0627\u0644\u0633\u0627\u0639\u0629 {{scheduled_time}}. \u0627\u0644\u0645\u0648\u0642\u0639: {{location}}.",
        contentEn: "Work order {{work_order_id}} confirmed for {{scheduled_date}} at {{scheduled_time}}. Location: {{location}}.",
        usageCount: 12,
        allowedRoles: ["sys_owner", "gm", "maint_manager"],
        createdBy: "usr-mnt",
        updatedAt: "2026-11-04T10:00:00.000Z"
      },
      {
        id: "tpl-sup-3",
        name: "\u0627\u0639\u062A\u0645\u0627\u062F \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0648\u0631\u062F",
        category: "supplier",
        channel: "email",
        language: "ar",
        contentAr: "\u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0641\u0627\u062A\u0648\u0631\u062A\u0643\u0645 \u0631\u0642\u0645 {{invoice_number}} \u0628\u0642\u064A\u0645\u0629 {{amount}} \u0631\u064A\u0627\u0644. \u0633\u064A\u062A\u0645 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u062E\u0644\u0627\u0644 {{payment_days}} \u064A\u0648\u0645 \u0639\u0645\u0644.\n\u2014 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629\u060C {{company_name}}",
        contentEn: "Invoice {{invoice_number}} for {{amount}} SAR approved. Payment will be transferred within {{payment_days}} business days.",
        usageCount: 19,
        allowedRoles: ["sys_owner", "gm", "accountant"],
        createdBy: "usr-acc",
        updatedAt: "2026-11-05T14:40:00.000Z"
      },
      {
        id: "tpl-int-1",
        name: "\u0625\u0633\u0646\u0627\u062F \u0645\u0647\u0645\u0629 \u062F\u0627\u062E\u0644\u064A\u0629",
        category: "internal",
        channel: "internal",
        language: "ar",
        contentAr: "\u062A\u0645 \u0625\u0633\u0646\u0627\u062F \u0645\u0647\u0645\u0629 \u062C\u062F\u064A\u062F\u0629: {{task_title}} \u0641\u064A {{property_name}}. \u0627\u0644\u0645\u0648\u0639\u062F \u0627\u0644\u0646\u0647\u0627\u0626\u064A: {{deadline}}. \u0627\u0644\u0623\u0648\u0644\u0648\u064A\u0629: {{priority}}.",
        contentEn: "New task assigned: {{task_title}} at {{property_name}}. Due: {{deadline}} ({{priority}}).",
        usageCount: 31,
        allowedRoles: ["sys_owner", "gm", "supervisor", "maint_manager"],
        createdBy: "usr-gm",
        updatedAt: "2026-11-11T08:00:00.000Z"
      },
      {
        id: "tpl-int-2",
        name: "\u062A\u0630\u0643\u064A\u0631 \u0628\u0645\u0647\u0645\u0629 \u0639\u0627\u062C\u0644\u0629",
        category: "internal",
        channel: "internal",
        language: "ar",
        contentAr: "\u062A\u0646\u0628\u064A\u0647: \u0644\u062F\u064A\u0643 \u0645\u0647\u0645\u0629 \u0633\u062A\u0646\u062A\u0647\u064A \u062E\u0644\u0627\u0644 {{hours_left}} \u0633\u0627\u0639\u0629: {{task_title}} ({{property_name}}).",
        contentEn: "Reminder: Task {{task_title}} is due in {{hours_left}} hours.",
        usageCount: 16,
        allowedRoles: ["sys_owner", "gm", "supervisor", "maint_manager"],
        createdBy: "usr-gm",
        updatedAt: "2026-11-10T15:00:00.000Z"
      },
      {
        id: "tpl-int-3",
        name: "\u0627\u0639\u062A\u0645\u0627\u062F \u0645\u0635\u0631\u0648\u0641 \u0645\u0648\u0638\u0641",
        category: "internal",
        channel: "internal",
        language: "ar",
        contentAr: "\u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0645\u0635\u0631\u0648\u0641\u0643 \u0631\u0642\u0645 {{expense_id}} \u0628\u0642\u064A\u0645\u0629 {{amount}} \u0631\u064A\u0627\u0644. \u0627\u0644\u0645\u0631\u062C\u0648 \u0631\u0641\u0639 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0623\u0635\u0644\u064A\u0629 \u0641\u064A \u0642\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u0646\u062F\u0627\u062A.",
        contentEn: "Expense {{expense_id}} ({{amount}} SAR) approved. Please upload the original invoice.",
        usageCount: 20,
        allowedRoles: ["sys_owner", "gm", "accountant", "supervisor"],
        createdBy: "usr-acc",
        updatedAt: "2026-11-08T17:00:00.000Z"
      },
      {
        id: "tpl-cus-1",
        name: "\u062A\u0647\u0646\u0626\u0629 \u0645\u0648\u0633\u0645\u064A\u0629 (\u0627\u0644\u0623\u0639\u064A\u0627\u062F \u0648\u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0627\u062A)",
        category: "custom",
        channel: "whatsapp",
        language: "ar",
        contentAr: "\u0639\u0632\u064A\u0632\u064A/\u0629 {{tenant_name}}\u060C \u062A\u062A\u0642\u062F\u0645 \u0623\u0633\u0631\u0629 {{company_name}} \u0628\u0623\u0635\u062F\u0642 \u0627\u0644\u062A\u0647\u0627\u0646\u064A \u0648\u0627\u0644\u062A\u0628\u0631\u064A\u0643\u0627\u062A \u0628\u0645\u0646\u0627\u0633\u0628\u0629 \u062D\u0644\u0648\u0644 \u0627\u0644\u0639\u064A\u062F \u0627\u0644\u0645\u0628\u0627\u0631\u0643\u060C \u0633\u0627\u0626\u0644\u064A\u0646 \u0627\u0644\u0644\u0647 \u0623\u0646 \u064A\u062F\u064A\u0645 \u0639\u0644\u064A\u0643\u0645 \u0627\u0644\u062E\u064A\u0631 \u0648\u0627\u0644\u0628\u0631\u0643\u0629.",
        contentEn: "Dear {{tenant_name}}, warm seasonal greetings from {{company_name}}. Wishing you happiness and prosperity.",
        isFavorite: true,
        isSeasonal: true,
        usageCount: 9,
        allowedRoles: ["sys_owner", "gm", "leasing", "receptionist"],
        createdBy: "usr-gm",
        updatedAt: "2026-11-01T12:00:00.000Z"
      }
    ],
    meterReadings: [
      {
        id: "mr-1",
        readingNumber: "MTR-2026-001",
        propertyId: "prop-1",
        unitId: "unit-101",
        meterType: "\u0643\u0647\u0631\u0628\u0627\u0621",
        meterNumber: "ELC-99011",
        previousReading: 14200,
        currentReading: 14860,
        consumption: 660,
        billAmount: 215,
        currency: "SAR",
        billingPeriod: "2026-11",
        recordedBy: "\u0641\u0647\u062F \u0628\u0646 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646 \u0627\u0644\u0633\u0628\u064A\u0639\u064A",
        notes: "\u0642\u0631\u0627\u0621\u0629 \u0634\u0647\u0631 \u0646\u0648\u0641\u0645\u0628\u0631 \u0627\u0644\u062F\u0648\u0631\u064A\u0629 - \u0639\u0645\u0627\u0631\u0629 \u0627\u0644\u0646\u062E\u064A\u0644",
        createdAt: "2026-11-10T09:30:00.000Z"
      },
      {
        id: "mr-2",
        readingNumber: "MTR-2026-002",
        propertyId: "prop-2",
        unitId: "unit-201",
        meterType: "\u0645\u064A\u0627\u0647",
        meterNumber: "WTR-44021",
        previousReading: 3180,
        currentReading: 3245,
        consumption: 65,
        billAmount: 95,
        currency: "SAR",
        billingPeriod: "2026-11",
        recordedBy: "\u0623\u062D\u0645\u062F \u0627\u0644\u0639\u0644\u064A",
        notes: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0633\u062A\u0647\u0644\u0627\u0643 \u0627\u0644\u0645\u064A\u0627\u0647 \u0627\u0644\u0634\u0647\u0631\u064A\u0629",
        createdAt: "2026-11-11T11:15:00.000Z"
      }
    ],
    teamSeeded: true,
    lastUpdatedAt: now
  };
}

// server/cryptoAuth.ts
import crypto from "crypto";
var SCRYPT_KEYLEN = 64;
var SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
var PBKDF2_ITERATIONS = 1e5;
function hashSecret(secret) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(secret, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS).toString("hex");
  return `scrypt$${salt}$${derived}`;
}
function verifySecret(secret, storedHash) {
  if (!storedHash || !secret) return false;
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hexHash] = parts;
  if (!salt || !hexHash) return false;
  try {
    const derived = crypto.scryptSync(secret, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
    const expected = Buffer.from(hexHash, "hex");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}
function toBase64Url(input) {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64Url(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  return Buffer.from(padded, "base64");
}
function signSessionToken(payload, secret) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(encodedPayload).digest();
  return `${encodedPayload}.${toBase64Url(sig)}`;
}
function verifySessionToken(token, secret) {
  if (!token || !secret) return null;
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;
  const encodedPayload = token.slice(0, dotIdx);
  const encodedSig = token.slice(dotIdx + 1);
  if (!encodedPayload || !encodedSig) return null;
  try {
    const expectedSig = crypto.createHmac("sha256", secret).update(encodedPayload).digest();
    const providedSig = fromBase64Url(encodedSig);
    if (expectedSig.length !== providedSig.length) return null;
    if (!crypto.timingSafeEqual(expectedSig, providedSig)) return null;
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8"));
    if (!payload || !payload.uid || !payload.sid || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
function signEphemeralToken(payload, secret) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(`eph:${encodedPayload}`).digest();
  return `${encodedPayload}.${toBase64Url(sig)}`;
}
function verifyEphemeralToken(token, secret) {
  if (!token || !secret) return null;
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return null;
  const encodedPayload = token.slice(0, dotIdx);
  const encodedSig = token.slice(dotIdx + 1);
  if (!encodedPayload || !encodedSig) return null;
  try {
    const expectedSig = crypto.createHmac("sha256", secret).update(`eph:${encodedPayload}`).digest();
    const providedSig = fromBase64Url(encodedSig);
    if (expectedSig.length !== providedSig.length) return null;
    if (!crypto.timingSafeEqual(expectedSig, providedSig)) return null;
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8"));
    if (!payload || typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
function encryptBackupPayload(plaintextJson, password) {
  const normalized = (password || "").trim();
  if (normalized.length < 4) {
    throw new Error("\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0627\u0644\u062A\u0634\u0641\u064A\u0631 \u064A\u062C\u0628 \u0623\u0646 \u0644\u0627 \u062A\u0642\u0644 \u0639\u0646 4 \u0623\u062D\u0631\u0641/\u0623\u0631\u0642\u0627\u0645");
  }
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(normalized, salt, PBKDF2_ITERATIONS, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintextJson, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope = {
    format: "aqarplus-aes-256-gcm",
    version: 1,
    kdf: "pbkdf2-sha256",
    iterations: PBKDF2_ITERATIONS,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  return JSON.stringify(envelope, null, 2);
}
function isEncryptedBackupEnvelope(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed?.format === "aqarplus-aes-256-gcm" && typeof parsed.ciphertext === "string";
  } catch {
    return false;
  }
}
function decryptBackupPayload(rawEnvelope, password) {
  const envelope = JSON.parse(rawEnvelope);
  if (envelope.format !== "aqarplus-aes-256-gcm") {
    return rawEnvelope;
  }
  const normalized = (password || "").trim();
  if (!normalized) {
    throw new Error("\u0647\u0630\u0647 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0645\u0634\u0641\u0631\u0629 \u2014 \u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0641\u0643 \u0627\u0644\u062A\u0634\u0641\u064A\u0631");
  }
  try {
    const salt = Buffer.from(envelope.salt, "base64");
    const iv = Buffer.from(envelope.iv, "base64");
    const tag = Buffer.from(envelope.tag, "base64");
    const ciphertext = Buffer.from(envelope.ciphertext, "base64");
    const key = crypto.pbkdf2Sync(
      normalized,
      salt,
      envelope.iterations || PBKDF2_ITERATIONS,
      32,
      "sha256"
    );
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    throw new Error("\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0641\u0643 \u0627\u0644\u062A\u0634\u0641\u064A\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629 \u0623\u0648 \u0623\u0646 \u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u062A\u0627\u0644\u0641");
  }
}

// server/sqlitePersistence.ts
import fs from "fs";
import path from "path";
import crypto2 from "crypto";
import { DatabaseSync } from "node:sqlite";
var ARRAY_COLLECTIONS = [
  "companies",
  "users",
  "employeeInvitations",
  "customRoles",
  "properties",
  "units",
  "meterReadings",
  "owners",
  "vendors",
  "tenants",
  "leads",
  "leadEscalations",
  "contracts",
  "handovers",
  "installments",
  "payments",
  "accounts",
  "journals",
  "expenses",
  "supplierInvoices",
  "recurringExpenses",
  "propertyBudgets",
  "assets",
  "tickets",
  "tasks",
  "communications",
  "documents",
  "purchaseOrders",
  "decisions",
  "notifications",
  "reminderRules",
  "reminderLogs",
  "auditLogs",
  "backups",
  "savedArchiveFilters",
  "loginHistory",
  "syncConflicts",
  "scheduledReports",
  "favoriteReports",
  "sharedSearchFilters",
  "zatcaInvoices",
  "communicationTemplates"
];
var SINGLETON_KEYS = [
  "settings",
  "rolePermissions",
  "roleModulePermissions",
  "counters",
  "processedIdempotencyKeys",
  "archiveLastNightlyRun",
  "archiveSeeded",
  "securityPolicy",
  "communicationTemplates",
  "teamSeeded",
  "syncRevision",
  "entityRevisions",
  "lastUpdatedAt"
];
var SqlitePersistence = class {
  constructor(dataDir) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = path.join(dataDir, "aqarplus.sqlite");
    this.db = new DatabaseSync(this.dbPath);
    this.initSchema();
  }
  initSchema() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entities (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        revision INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (collection, id)
      );

      CREATE INDEX IF NOT EXISTS idx_entities_collection ON entities (collection, sort_order);

      CREATE TABLE IF NOT EXISTS operations_log (
        operation_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        method TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        result_json TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        session_id TEXT,
        user_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        app_type TEXT DEFAULT 'web',
        device_id TEXT,
        ip_address TEXT,
        remember_me INTEGER NOT NULL DEFAULT 1,
        refresh_token_hash TEXT,
        refresh_expires_at TEXT,
        created_at TEXT NOT NULL,
        last_seen_at TEXT,
        expires_at TEXT NOT NULL,
        revoked_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id, revoked_at);

      CREATE TABLE IF NOT EXISTS trusted_devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_hash TEXT NOT NULL,
        device_name TEXT NOT NULL,
        app_type TEXT NOT NULL DEFAULT 'web',
        trusted_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL,
        revoked_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices (user_id, device_hash, revoked_at);

      CREATE TABLE IF NOT EXISTS user_credentials (
        user_id TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        pin_hash TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS invite_secrets (
        invitation_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        code_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        canceled_at TEXT,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_invite_token_hash ON invite_secrets (token_hash);

      CREATE TABLE IF NOT EXISTS recovery_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        purpose TEXT NOT NULL,
        target_value TEXT,
        code_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_recovery_user_purpose ON recovery_tokens (user_id, purpose, used_at);

      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        related_type TEXT,
        related_id TEXT,
        mime_type TEXT,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        content_base64 TEXT,
        disk_path TEXT,
        created_at TEXT NOT NULL
      );
    `);
    const cols = this.db.prepare(`PRAGMA table_info(sessions)`).all().map((c) => c.name);
    if (!cols.includes("session_id")) this.db.exec(`ALTER TABLE sessions ADD COLUMN session_id TEXT`);
    if (!cols.includes("ip_address")) this.db.exec(`ALTER TABLE sessions ADD COLUMN ip_address TEXT`);
    if (!cols.includes("remember_me")) this.db.exec(`ALTER TABLE sessions ADD COLUMN remember_me INTEGER NOT NULL DEFAULT 1`);
    if (!cols.includes("last_seen_at")) this.db.exec(`ALTER TABLE sessions ADD COLUMN last_seen_at TEXT`);
    if (!cols.includes("app_type")) this.db.exec(`ALTER TABLE sessions ADD COLUMN app_type TEXT DEFAULT 'web'`);
    if (!cols.includes("device_id")) this.db.exec(`ALTER TABLE sessions ADD COLUMN device_id TEXT`);
    if (!cols.includes("refresh_token_hash")) this.db.exec(`ALTER TABLE sessions ADD COLUMN refresh_token_hash TEXT`);
    if (!cols.includes("refresh_expires_at")) this.db.exec(`ALTER TABLE sessions ADD COLUMN refresh_expires_at TEXT`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_refresh ON sessions (refresh_token_hash);`);
  }
  getOrCreateSessionSecret() {
    if (process.env.AQAR_SESSION_SECRET && process.env.AQAR_SESSION_SECRET.length >= 16) {
      return process.env.AQAR_SESSION_SECRET;
    }
    const row = this.db.prepare(`SELECT value FROM meta WHERE key = 'session_secret'`).get();
    if (row?.value) return row.value;
    const generated = crypto2.randomBytes(32).toString("hex");
    this.db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('session_secret', ?)`).run(generated);
    return generated;
  }
  hasState() {
    const row = this.db.prepare(`SELECT value FROM meta WHERE key = 'singleton:settings'`).get();
    return Boolean(row?.value);
  }
  loadState() {
    if (!this.hasState()) return null;
    const result = {};
    const metaRows = this.db.prepare(`SELECT key, value FROM meta WHERE key LIKE 'singleton:%'`).all();
    for (const row of metaRows) {
      const prop = row.key.slice("singleton:".length);
      try {
        result[prop] = JSON.parse(row.value);
      } catch {
        result[prop] = row.value;
      }
    }
    for (const col of ARRAY_COLLECTIONS) {
      if (col === "communicationTemplates" && Array.isArray(result[col])) continue;
      const rows = this.db.prepare(`SELECT data FROM entities WHERE collection = ? ORDER BY sort_order ASC`).all(String(col));
      result[String(col)] = rows.map((r) => JSON.parse(r.data));
    }
    return result;
  }
  saveState(state) {
    const now = state.lastUpdatedAt || (/* @__PURE__ */ new Date()).toISOString();
    const revisions = state.entityRevisions || {};
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const upsertMeta = this.db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`);
      for (const key of SINGLETON_KEYS) {
        const val = state[key];
        if (val !== void 0) {
          upsertMeta.run(`singleton:${String(key)}`, JSON.stringify(val));
        }
      }
      const deleteCollection = this.db.prepare(`DELETE FROM entities WHERE collection = ?`);
      const insertEntity = this.db.prepare(
        `INSERT INTO entities (collection, id, sort_order, revision, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)`
      );
      const upsertAttachment = this.db.prepare(
        `INSERT OR REPLACE INTO attachments (id, related_type, related_id, mime_type, size_bytes, content_base64, disk_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const col of ARRAY_COLLECTIONS) {
        const list = state[col] || [];
        deleteCollection.run(String(col));
        for (let idx = 0; idx < list.length; idx++) {
          const item = list[idx];
          const entityId = String(item?.id || `${String(col)}-${idx}`);
          const revKey = `${String(col)}:${entityId}`;
          const rev = revisions[revKey] || 1;
          insertEntity.run(String(col), entityId, idx, rev, now, JSON.stringify(item));
          if (col === "documents" && typeof item?.dataUrl === "string" && item.dataUrl.length > 0) {
            upsertAttachment.run(
              entityId,
              String(item.relatedType || "document"),
              String(item.relatedId || ""),
              String(item.fileType || "application/octet-stream"),
              Math.round(Buffer.byteLength(item.dataUrl, "utf8")),
              item.dataUrl,
              typeof item.diskPath === "string" ? item.diskPath : null,
              String(item.createdAt || now)
            );
          }
        }
      }
      this.db.exec("COMMIT");
    } catch (err) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
      }
      throw err;
    }
  }
  hasOperation(operationId) {
    if (!operationId) return null;
    const row = this.db.prepare(
      `SELECT operation_id as operationId, user_id as userId, method, endpoint, entity_type as entityType, entity_id as entityId, result_json as resultJson, status, created_at as createdAt FROM operations_log WHERE operation_id = ?`
    ).get(operationId);
    return row || null;
  }
  recordOperation(entry) {
    this.db.prepare(
      `INSERT OR IGNORE INTO operations_log (operation_id, user_id, method, endpoint, entity_type, entity_id, result_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      entry.operationId,
      entry.userId,
      entry.method,
      entry.endpoint,
      entry.entityType || null,
      entry.entityId || null,
      entry.resultJson || null,
      entry.status,
      entry.createdAt
    );
  }
  ensureSeedCredentials(users) {
    const defaultPasswordHash = hashSecret("Aqar@2026");
    const defaultPinHash = hashSecret("1234");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const check = this.db.prepare(`SELECT user_id FROM user_credentials WHERE user_id = ?`);
    const insert = this.db.prepare(
      `INSERT INTO user_credentials (user_id, password_hash, pin_hash, updated_at) VALUES (?, ?, ?, ?)`
    );
    for (const u of users) {
      const existing = check.get(u.id);
      if (!existing) {
        insert.run(u.id, defaultPasswordHash, defaultPinHash, now);
      }
    }
  }
  verifyUserPassword(userId, password) {
    const row = this.db.prepare(`SELECT password_hash as passwordHash FROM user_credentials WHERE user_id = ?`).get(userId);
    return verifySecret(password, row?.passwordHash);
  }
  verifyUserPin(userId, pin) {
    const row = this.db.prepare(`SELECT pin_hash as pinHash FROM user_credentials WHERE user_id = ?`).get(userId);
    return verifySecret(pin, row?.pinHash);
  }
  updateUserCredentials(userId, input) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = this.db.prepare(`SELECT password_hash as passwordHash, pin_hash as pinHash FROM user_credentials WHERE user_id = ?`).get(userId);
    const nextPasswordHash = input.password ? hashSecret(input.password) : existing?.passwordHash || hashSecret("Aqar@2026");
    const nextPinHash = input.pin ? hashSecret(input.pin) : existing?.pinHash || null;
    this.db.prepare(
      `INSERT OR REPLACE INTO user_credentials (user_id, password_hash, pin_hash, updated_at) VALUES (?, ?, ?, ?)`
    ).run(userId, nextPasswordHash, nextPinHash, now);
  }
  disableUserPin(userId) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(`UPDATE user_credentials SET pin_hash = NULL, updated_at = ? WHERE user_id = ?`).run(now, userId);
  }
  getCredentialStatus(userId) {
    const row = this.db.prepare(`SELECT user_id as userId, password_hash as passwordHash, pin_hash as pinHash, updated_at as updatedAt FROM user_credentials WHERE user_id = ?`).get(userId);
    return {
      userId,
      hasPassword: Boolean(row?.passwordHash),
      hasPin: Boolean(row?.pinHash),
      updatedAt: row?.updatedAt
    };
  }
  createSession(rawToken, userId, deviceName, expiresAt, opts) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(
      `INSERT OR REPLACE INTO sessions (token_hash, session_id, user_id, device_name, app_type, device_id, ip_address, remember_me, refresh_token_hash, refresh_expires_at, created_at, last_seen_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    ).run(
      sha256Hex(rawToken),
      opts?.sessionId || null,
      userId,
      deviceName,
      opts?.appType === "desktop" ? "desktop" : "web",
      opts?.deviceId || null,
      opts?.ipAddress || null,
      opts?.rememberMe === false ? 0 : 1,
      opts?.rawRefreshToken ? sha256Hex(opts.rawRefreshToken) : null,
      opts?.refreshExpiresAt || null,
      now,
      now,
      expiresAt
    );
  }
  isSessionActive(rawToken) {
    const row = this.db.prepare(
      `SELECT token_hash as tokenHash, session_id as sessionId, user_id as userId, device_name as deviceName, app_type as appType, device_id as deviceId, ip_address as ipAddress, remember_me as rememberMeInt, refresh_token_hash as refreshTokenHash, refresh_expires_at as refreshExpiresAt, created_at as createdAt, last_seen_at as lastSeenAt, expires_at as expiresAt, revoked_at as revokedAt FROM sessions WHERE token_hash = ?`
    ).get(sha256Hex(rawToken));
    if (!row || row.revokedAt) return null;
    if (Date.now() > new Date(row.expiresAt).getTime()) return null;
    return {
      tokenHash: row.tokenHash,
      sessionId: row.sessionId,
      userId: row.userId,
      deviceName: row.deviceName,
      appType: row.appType === "desktop" ? "desktop" : "web",
      deviceId: row.deviceId,
      ipAddress: row.ipAddress,
      rememberMe: row.rememberMeInt !== 0,
      refreshTokenHash: row.refreshTokenHash,
      refreshExpiresAt: row.refreshExpiresAt,
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt || row.createdAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt
    };
  }
  findSessionByRefreshToken(rawRefreshToken) {
    if (!rawRefreshToken) return null;
    const row = this.db.prepare(
      `SELECT token_hash as tokenHash, session_id as sessionId, user_id as userId, device_name as deviceName, app_type as appType, device_id as deviceId, ip_address as ipAddress, remember_me as rememberMeInt, refresh_token_hash as refreshTokenHash, refresh_expires_at as refreshExpiresAt, created_at as createdAt, last_seen_at as lastSeenAt, expires_at as expiresAt, revoked_at as revokedAt FROM sessions WHERE refresh_token_hash = ?`
    ).get(sha256Hex(rawRefreshToken));
    if (!row || row.revokedAt) return null;
    const refExp = row.refreshExpiresAt || row.expiresAt;
    if (Date.now() > new Date(refExp).getTime()) return null;
    return {
      tokenHash: row.tokenHash,
      sessionId: row.sessionId,
      userId: row.userId,
      deviceName: row.deviceName,
      appType: row.appType === "desktop" ? "desktop" : "web",
      deviceId: row.deviceId,
      ipAddress: row.ipAddress,
      rememberMe: row.rememberMeInt !== 0,
      refreshTokenHash: row.refreshTokenHash,
      refreshExpiresAt: row.refreshExpiresAt,
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt || row.createdAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt
    };
  }
  rotateSessionTokens(oldRefreshToken, newAccessToken, newRefreshToken, newExpiresAt, newRefreshExpiresAt) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const info = this.db.prepare(
      `UPDATE sessions SET token_hash = ?, refresh_token_hash = ?, expires_at = ?, refresh_expires_at = ?, last_seen_at = ? WHERE refresh_token_hash = ? AND revoked_at IS NULL`
    ).run(
      sha256Hex(newAccessToken),
      sha256Hex(newRefreshToken),
      newExpiresAt,
      newRefreshExpiresAt,
      now,
      sha256Hex(oldRefreshToken)
    );
    return Number(info.changes || 0) > 0;
  }
  updateSessionLastSeen(rawToken) {
    this.db.prepare(`UPDATE sessions SET last_seen_at = ? WHERE token_hash = ? AND revoked_at IS NULL`).run((/* @__PURE__ */ new Date()).toISOString(), sha256Hex(rawToken));
  }
  listActiveSessionsForUser(userId, currentRawToken) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const currentHash = currentRawToken ? sha256Hex(currentRawToken) : "";
    const rows = this.db.prepare(
      `SELECT token_hash as tokenHash, session_id as sessionId, user_id as userId, device_name as deviceName, app_type as appType, device_id as deviceId, ip_address as ipAddress, remember_me as rememberMeInt, created_at as createdAt, last_seen_at as lastSeenAt, expires_at as expiresAt FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC`
    ).all(userId, now);
    return rows.map((r) => ({
      id: r.sessionId || r.tokenHash.slice(0, 16),
      sessionId: r.sessionId || r.tokenHash.slice(0, 16),
      userId: r.userId,
      deviceName: r.deviceName,
      appType: r.appType === "desktop" ? "desktop" : "web",
      deviceId: r.deviceId || void 0,
      ipAddress: r.ipAddress || void 0,
      rememberMe: r.rememberMeInt !== 0,
      createdAt: r.createdAt,
      lastSeenAt: r.lastSeenAt || r.createdAt,
      expiresAt: r.expiresAt,
      isCurrent: Boolean(currentHash && r.tokenHash === currentHash)
    }));
  }
  revokeSession(rawToken) {
    this.db.prepare(`UPDATE sessions SET revoked_at = ? WHERE token_hash = ?`).run((/* @__PURE__ */ new Date()).toISOString(), sha256Hex(rawToken));
  }
  revokeSessionById(userId, sessionIdOrPrefix) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const info = this.db.prepare(
      `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL AND (session_id = ? OR substr(token_hash, 1, 16) = ?)`
    ).run(now, userId, sessionIdOrPrefix, sessionIdOrPrefix);
    return Number(info.changes || 0);
  }
  revokeOtherSessionsForUser(userId, keepRawToken) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (keepRawToken) {
      const info2 = this.db.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL AND token_hash != ?`).run(now, userId, sha256Hex(keepRawToken));
      return Number(info2.changes || 0);
    }
    const info = this.db.prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`).run(now, userId);
    return Number(info.changes || 0);
  }
  registerOrTouchTrustedDevice(userId, deviceId, deviceName, appType = "web") {
    if (!deviceId) return;
    const deviceHash = sha256Hex(`${userId}:${deviceId}`);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = this.db.prepare(`SELECT id FROM trusted_devices WHERE user_id = ? AND device_hash = ? AND revoked_at IS NULL`).get(userId, deviceHash);
    if (existing) {
      this.db.prepare(`UPDATE trusted_devices SET device_name = ?, app_type = ?, last_used_at = ? WHERE id = ?`).run(deviceName, appType, now, existing.id);
      return;
    }
    this.db.prepare(
      `INSERT INTO trusted_devices (id, user_id, device_hash, device_name, app_type, trusted_at, last_used_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
    ).run(`td-${crypto2.randomBytes(6).toString("hex")}`, userId, deviceHash, deviceName, appType, now, now);
  }
  isTrustedDevice(userId, deviceId) {
    if (!deviceId) return false;
    const deviceHash = sha256Hex(`${userId}:${deviceId}`);
    const row = this.db.prepare(`SELECT id FROM trusted_devices WHERE user_id = ? AND device_hash = ? AND revoked_at IS NULL`).get(userId, deviceHash);
    return Boolean(row);
  }
  listTrustedDevices(userId, currentDeviceId) {
    const currentHash = currentDeviceId ? sha256Hex(`${userId}:${currentDeviceId}`) : "";
    const rows = this.db.prepare(
      `SELECT id, user_id as userId, device_hash as deviceHash, device_name as deviceName, app_type as appType, trusted_at as trustedAt, last_used_at as lastUsedAt FROM trusted_devices WHERE user_id = ? AND revoked_at IS NULL ORDER BY last_used_at DESC`
    ).all(userId);
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      deviceName: r.deviceName,
      appType: r.appType === "desktop" ? "desktop" : "web",
      trustedAt: r.trustedAt,
      lastUsedAt: r.lastUsedAt,
      isCurrent: Boolean(currentHash && r.deviceHash === currentHash)
    }));
  }
  revokeTrustedDevice(userId, trustedDeviceId) {
    const info = this.db.prepare(`UPDATE trusted_devices SET revoked_at = ? WHERE user_id = ? AND id = ? AND revoked_at IS NULL`).run((/* @__PURE__ */ new Date()).toISOString(), userId, trustedDeviceId);
    return Number(info.changes || 0);
  }
  createInviteSecret(input) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(
      `INSERT OR REPLACE INTO invite_secrets (invitation_id, user_id, company_id, token_hash, code_hash, expires_at, used_at, canceled_at, failed_attempts, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?)`
    ).run(
      input.invitationId,
      input.userId,
      input.companyId,
      sha256Hex(input.rawToken),
      hashSecret(input.verificationCode),
      input.expiresAt,
      now
    );
  }
  findInviteSecretByToken(rawToken) {
    if (!rawToken) return null;
    const row = this.db.prepare(
      `SELECT invitation_id as invitationId, user_id as userId, company_id as companyId, token_hash as tokenHash, code_hash as codeHash, expires_at as expiresAt, used_at as usedAt, canceled_at as canceledAt, failed_attempts as failedAttempts, created_at as createdAt FROM invite_secrets WHERE token_hash = ?`
    ).get(sha256Hex(rawToken));
    return row || null;
  }
  verifyAndConsumeInviteSecret(rawToken, verificationCode) {
    const rec = this.findInviteSecretByToken(rawToken);
    if (!rec) return { ok: false, reason: "\u0631\u0627\u0628\u0637 \u0627\u0644\u062F\u0639\u0648\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" };
    if (rec.canceledAt) return { ok: false, reason: "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0647\u0630\u0647 \u0627\u0644\u062F\u0639\u0648\u0629 \u0645\u0646 \u0642\u0650\u0628\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629" };
    if (rec.usedAt) return { ok: false, reason: "\u062A\u0645 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0647\u0630\u0647 \u0627\u0644\u062F\u0639\u0648\u0629 \u0648\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0633\u0628\u0642\u0627\u064B" };
    if (Date.now() > new Date(rec.expiresAt).getTime()) {
      return { ok: false, reason: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0631\u0627\u0628\u0637 \u0627\u0644\u062F\u0639\u0648\u0629 \u2014 \u0627\u0637\u0644\u0628 \u0645\u0646 \u0645\u062F\u064A\u0631 \u0627\u0644\u0634\u0631\u0643\u0629 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644", expired: true };
    }
    if (rec.failedAttempts >= 5) {
      return { ok: false, reason: "\u062A\u0645 \u062A\u0639\u0644\u064A\u0642 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0644\u0647\u0630\u0647 \u0627\u0644\u062F\u0639\u0648\u0629 \u0644\u0643\u062B\u0631\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u062E\u0627\u0637\u0626\u0629" };
    }
    if (!verifySecret(verificationCode.trim(), rec.codeHash)) {
      this.db.prepare(`UPDATE invite_secrets SET failed_attempts = failed_attempts + 1 WHERE invitation_id = ?`).run(rec.invitationId);
      return { ok: false, reason: "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0645\u0643\u0648\u0646 \u0645\u0646 6 \u0623\u0631\u0642\u0627\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" };
    }
    this.db.prepare(`UPDATE invite_secrets SET used_at = ? WHERE invitation_id = ?`).run((/* @__PURE__ */ new Date()).toISOString(), rec.invitationId);
    return { ok: true, record: rec };
  }
  cancelInviteSecret(invitationId) {
    this.db.prepare(`UPDATE invite_secrets SET canceled_at = ? WHERE invitation_id = ? AND used_at IS NULL`).run((/* @__PURE__ */ new Date()).toISOString(), invitationId);
  }
  createRecoveryToken(input) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(`UPDATE recovery_tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL`).run(now, input.userId, input.purpose);
    this.db.prepare(
      `INSERT INTO recovery_tokens (id, user_id, purpose, target_value, code_hash, expires_at, used_at, failed_attempts, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?)`
    ).run(
      input.id,
      input.userId,
      input.purpose,
      input.targetValue || null,
      hashSecret(input.code),
      input.expiresAt,
      now
    );
  }
  verifyAndConsumeRecoveryToken(userId, purpose, code) {
    const row = this.db.prepare(
      `SELECT id, user_id as userId, purpose, target_value as targetValue, code_hash as codeHash, expires_at as expiresAt, used_at as usedAt, failed_attempts as failedAttempts, created_at as createdAt FROM recovery_tokens WHERE user_id = ? AND purpose = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`
    ).get(userId, purpose);
    if (!row) {
      return { ok: false, reason: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0637\u0644\u0628 \u0631\u0645\u0632 \u062A\u062D\u0642\u0642 \u0646\u0634\u0637 \u2014 \u0627\u0637\u0644\u0628 \u0631\u0645\u0632\u0627\u064B \u062C\u062F\u064A\u062F\u0627\u064B" };
    }
    if (Date.now() > new Date(row.expiresAt).getTime()) {
      return { ok: false, reason: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u2014 \u0627\u0637\u0644\u0628 \u0631\u0645\u0632\u0627\u064B \u062C\u062F\u064A\u062F\u0627\u064B" };
    }
    if (row.failedAttempts >= 5) {
      return { ok: false, reason: "\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0631\u0645\u0632 (5 \u0645\u062D\u0627\u0648\u0644\u0627\u062A) \u2014 \u0627\u0637\u0644\u0628 \u0631\u0645\u0632\u0627\u064B \u062C\u062F\u064A\u062F\u0627\u064B" };
    }
    if (!verifySecret(code.trim(), row.codeHash)) {
      this.db.prepare(`UPDATE recovery_tokens SET failed_attempts = failed_attempts + 1 WHERE id = ?`).run(row.id);
      return { ok: false, reason: "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" };
    }
    this.db.prepare(`UPDATE recovery_tokens SET used_at = ? WHERE id = ?`).run((/* @__PURE__ */ new Date()).toISOString(), row.id);
    return { ok: true, record: row };
  }
  getDiagnostics() {
    const entitiesCount = this.db.prepare(`SELECT COUNT(*) as c FROM entities`).get().c;
    const operationsCount = this.db.prepare(`SELECT COUNT(*) as c FROM operations_log`).get().c;
    const activeSessionsCount = this.db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE revoked_at IS NULL AND expires_at > ?`).get((/* @__PURE__ */ new Date()).toISOString()).c;
    const pragmaRow = this.db.prepare(`PRAGMA journal_mode`).get();
    const journalMode = String(pragmaRow?.journal_mode || "wal").toLowerCase();
    const dbSizeBytes = fs.existsSync(this.dbPath) ? fs.statSync(this.dbPath).size : 0;
    return {
      engine: "sqlite-wal",
      journalMode,
      dbPath: this.dbPath,
      entitiesCount,
      operationsCount,
      activeSessionsCount,
      dbSizeKb: Math.max(1, Math.round(dbSizeBytes / 1024))
    };
  }
  close() {
    try {
      this.db.close();
    } catch {
    }
  }
};

// src/utils/rbac.ts
var RBAC_MODULES = [
  { key: "dashboard", labelAr: "\u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645", labelEn: "Dashboard", groupAr: "\u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A" },
  { key: "properties", labelAr: "\u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A", labelEn: "Properties", groupAr: "\u0627\u0644\u0645\u062D\u0641\u0638\u0629" },
  { key: "units", labelAr: "\u0627\u0644\u0648\u062D\u062F\u0627\u062A", labelEn: "Units", groupAr: "\u0627\u0644\u0645\u062D\u0641\u0638\u0629" },
  { key: "tenants", labelAr: "\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631\u0648\u0646 \u0648\u0627\u0644\u0645\u0647\u062A\u0645\u0648\u0646", labelEn: "Tenants & Leads", groupAr: "\u0627\u0644\u062A\u0623\u062C\u064A\u0631" },
  { key: "contracts", labelAr: "\u0627\u0644\u0639\u0642\u0648\u062F \u0648\u0625\u064A\u062C\u0627\u0631", labelEn: "Contracts", groupAr: "\u0627\u0644\u062A\u0623\u062C\u064A\u0631" },
  { key: "payments", labelAr: "\u0627\u0644\u062F\u0641\u0639\u0627\u062A \u0648\u0627\u0644\u062A\u062D\u0635\u064A\u0644", labelEn: "Payments", groupAr: "\u0627\u0644\u0645\u0627\u0644\u064A\u0629" },
  { key: "finance", labelAr: "\u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0648\u0627\u0644\u0645\u062D\u0627\u0633\u0628\u0629", labelEn: "Finance & Ledger", groupAr: "\u0627\u0644\u0645\u0627\u0644\u064A\u0629" },
  { key: "receipts", labelAr: "\u0627\u0644\u0625\u064A\u0635\u0627\u0644\u0627\u062A \u0648\u0627\u0644\u0633\u0646\u062F\u0627\u062A", labelEn: "Receipts", groupAr: "\u0627\u0644\u0645\u0627\u0644\u064A\u0629" },
  { key: "expenses", labelAr: "\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0648\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0627\u062A", labelEn: "Expenses", groupAr: "\u0627\u0644\u0645\u0627\u0644\u064A\u0629" },
  { key: "maintenance", labelAr: "\u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u0648\u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A", labelEn: "Maintenance", groupAr: "\u0627\u0644\u062A\u0634\u063A\u064A\u0644" },
  { key: "tasks", labelAr: "\u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u064A\u0648\u0645\u064A\u0629", labelEn: "Tasks", groupAr: "\u0627\u0644\u062A\u0634\u063A\u064A\u0644" },
  { key: "reports", labelAr: "\u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0648\u0627\u0644\u062A\u062D\u0644\u064A\u0644\u0627\u062A", labelEn: "Reports", groupAr: "\u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631" },
  { key: "documents", labelAr: "\u062E\u0632\u0646\u0629 \u0627\u0644\u0645\u0633\u062A\u0646\u062F\u0627\u062A", labelEn: "Documents", groupAr: "\u0627\u0644\u0623\u0631\u0634\u0641\u0629" },
  { key: "archive", labelAr: "\u0627\u0644\u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u0630\u0643\u064A", labelEn: "Smart Archive", groupAr: "\u0627\u0644\u0623\u0631\u0634\u0641\u0629" },
  { key: "team", labelAr: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u0648\u0646 \u0648\u0641\u0631\u064A\u0642 \u0627\u0644\u0639\u0645\u0644", labelEn: "Team & Workforce", groupAr: "\u0627\u0644\u0625\u062F\u0627\u0631\u0629" },
  { key: "audit", labelAr: "\u0633\u062C\u0644 \u0627\u0644\u062A\u062F\u0642\u064A\u0642", labelEn: "Audit Logs", groupAr: "\u0627\u0644\u0625\u062F\u0627\u0631\u0629" },
  { key: "settings", labelAr: "\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A", labelEn: "Settings", groupAr: "\u0627\u0644\u0625\u062F\u0627\u0631\u0629" },
  { key: "backups", labelAr: "\u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A", labelEn: "Backups", groupAr: "\u0627\u0644\u0625\u062F\u0627\u0631\u0629" }
];
var ROLE_TEMPLATES = [
  {
    key: "sys_owner",
    labelAr: "\u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645",
    labelEn: "System Owner",
    tierAr: "\u062A\u062D\u0643\u0645 \u0643\u0627\u0645\u0644",
    descAr: "\u0627\u0644\u062A\u062D\u0643\u0645 \u0627\u0644\u0643\u0627\u0645\u0644 \u0628\u0627\u0644\u0645\u0646\u0634\u0623\u0629\u060C \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0648\u0627\u0644\u0623\u062F\u0648\u0627\u0631\u060C \u0627\u0644\u0623\u0645\u0627\u0646\u060C \u0648\u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A",
    defaultLimitSar: 9999999
  },
  {
    key: "gm",
    labelAr: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0634\u0631\u0643\u0629",
    labelEn: "Company Manager",
    tierAr: "\u0645\u0631\u062A\u0641\u0639",
    descAr: "\u0627\u0644\u0625\u0634\u0631\u0627\u0641 \u0627\u0644\u0639\u0627\u0645\u060C \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0645\u0627\u0644\u064A\u0629\u060C \u0648\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0627\u0644\u0643\u0628\u0631\u0649 \u0648\u0627\u0644\u0642\u0631\u0627\u0631\u0627\u062A",
    defaultLimitSar: 5e5
  },
  {
    key: "supervisor",
    labelAr: "\u0627\u0644\u0645\u0634\u0631\u0641 \u0627\u0644\u0639\u0642\u0627\u0631\u064A",
    labelEn: "Property Supervisor",
    tierAr: "\u0645\u062A\u0648\u0633\u0637-\u0645\u0631\u062A\u0641\u0639",
    descAr: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0648\u062D\u062F\u0627\u062A\u060C \u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0625\u0634\u063A\u0627\u0644 \u0648\u0645\u062D\u0627\u0636\u0631 \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645 \u0648\u0627\u0644\u0625\u062E\u0644\u0627\u0621",
    defaultLimitSar: 25e3
  },
  {
    key: "accountant",
    labelAr: "\u0627\u0644\u0645\u062D\u0627\u0633\u0628",
    labelEn: "Accountant",
    tierAr: "\u0645\u0627\u0644\u064A \u0641\u0642\u0637",
    descAr: "\u0627\u0644\u062A\u062D\u0635\u064A\u0644\u060C \u0633\u0646\u062F\u0627\u062A \u0627\u0644\u0642\u0628\u0636\u060C \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062A\u060C \u0627\u0644\u0642\u064A\u0648\u062F \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u064A\u0629 \u0648\u062A\u0642\u0627\u0631\u064A\u0631 \u0627\u0644\u0645\u0644\u0627\u0643",
    defaultLimitSar: 5e4
  },
  {
    key: "leasing",
    labelAr: "\u0645\u0648\u0638\u0641 \u0627\u0644\u062A\u0623\u062C\u064A\u0631",
    labelEn: "Leasing Agent",
    tierAr: "\u0645\u062A\u0648\u0633\u0637",
    descAr: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631\u064A\u0646\u060C \u0625\u0628\u0631\u0627\u0645 \u0627\u0644\u0639\u0642\u0648\u062F\u060C \u0627\u0644\u062A\u0648\u062B\u064A\u0642 \u0641\u064A \u0625\u064A\u062C\u0627\u0631 \u0648\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0645\u062A\u0623\u062E\u0631\u0627\u062A",
    defaultLimitSar: 0
  },
  {
    key: "maint_manager",
    labelAr: "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0635\u064A\u0627\u0646\u0629",
    labelEn: "Maintenance Manager",
    tierAr: "\u062A\u0634\u063A\u064A\u0644\u064A",
    descAr: "\u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0628\u0644\u0627\u063A\u0627\u062A \u0627\u0644\u0635\u064A\u0627\u0646\u0629\u060C \u0625\u0633\u0646\u0627\u062F \u0627\u0644\u0645\u0647\u0627\u0645 \u0644\u0644\u0641\u0646\u064A\u064A\u0646\u060C \u0648\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0648\u0631\u062F\u064A\u0646",
    defaultLimitSar: 15e3
  },
  {
    key: "technician",
    labelAr: "\u0641\u0646\u064A \u0627\u0644\u0635\u064A\u0627\u0646\u0629",
    labelEn: "Technician",
    tierAr: "\u0645\u062D\u062F\u0648\u062F",
    descAr: "\u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u0645\u064A\u062F\u0627\u0646\u064A\u0629 \u0627\u0644\u0645\u0633\u0646\u062F\u0629 \u0648\u0631\u0641\u0639 \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0648\u0627\u0644\u062A\u0634\u062E\u064A\u0635 \u0648\u0627\u0644\u0635\u0648\u0631",
    defaultLimitSar: 0
  },
  {
    key: "receptionist",
    labelAr: "\u0645\u0648\u0638\u0641 \u0627\u0644\u0627\u0633\u062A\u0642\u0628\u0627\u0644",
    labelEn: "Receptionist",
    tierAr: "\u0623\u0633\u0627\u0633\u064A",
    descAr: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0623\u0648\u0644\u064A\u0629 \u0644\u0644\u0639\u0645\u0644\u0627\u0621\u060C \u0631\u0641\u0639 \u0627\u0644\u0645\u0633\u062A\u0646\u062F\u0627\u062A\u060C \u0648\u062A\u0648\u062C\u064A\u0647 \u0627\u0644\u0628\u0644\u0627\u063A\u0627\u062A",
    defaultLimitSar: 0
  },
  {
    key: "auditor",
    labelAr: "\u0627\u0644\u0645\u0631\u0627\u062C\u0639",
    labelEn: "Auditor",
    tierAr: "\u0644\u0644\u0642\u0631\u0627\u0621\u0629 \u0641\u0642\u0637",
    descAr: "\u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0627\u0644\u0643\u0627\u0645\u0644 \u0639\u0644\u0649 \u0627\u0644\u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0648\u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A\u0629 \u0648\u0633\u062C\u0644 \u0627\u0644\u062A\u062F\u0642\u064A\u0642 \u062F\u0648\u0646 \u062A\u0639\u062F\u064A\u0644",
    defaultLimitSar: 0
  },
  {
    key: "owner",
    labelAr: "\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0627\u0644\u0643",
    labelEn: "Owner Portal",
    tierAr: "\u0645\u062D\u0641\u0638\u0629 \u0627\u0644\u0645\u0627\u0644\u0643",
    descAr: "\u0645\u062A\u0627\u0628\u0639\u0629 \u0639\u0648\u0627\u0626\u062F \u0648\u0625\u0634\u063A\u0627\u0644 \u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u0645\u0644\u0648\u0643\u0629 \u0648\u0645\u0633\u062A\u0646\u062F\u0627\u062A \u0627\u0644\u062A\u0633\u0648\u064A\u0629 \u0641\u0642\u0637",
    defaultLimitSar: 0
  }
];
var ALL_ACTIONS = ["view", "create", "edit", "delete_void", "approve", "export", "manage"];
function getDefaultModulePermissionsForRole(role) {
  if (role === "sys_owner" || role === "gm") {
    return Object.fromEntries(RBAC_MODULES.map((m) => [m.key, [...ALL_ACTIONS]]));
  }
  if (role === "auditor") {
    return Object.fromEntries(
      RBAC_MODULES.filter((m) => m.key !== "settings" && m.key !== "backups").map((m) => [
        m.key,
        ["view", "export"]
      ])
    );
  }
  if (role === "accountant") {
    return {
      dashboard: ["view"],
      properties: ["view"],
      units: ["view"],
      tenants: ["view"],
      contracts: ["view"],
      payments: ["view", "create", "edit", "approve", "export"],
      finance: ["view", "create", "edit", "approve", "export", "manage"],
      receipts: ["view", "create", "delete_void", "export"],
      expenses: ["view", "create", "edit", "export"],
      reports: ["view", "export"],
      documents: ["view", "create", "export"],
      archive: ["view", "export"],
      audit: ["view"]
    };
  }
  if (role === "supervisor") {
    return {
      dashboard: ["view"],
      properties: ["view", "create", "edit", "export"],
      units: ["view", "create", "edit", "export"],
      tenants: ["view", "create", "edit"],
      contracts: ["view", "create", "edit", "approve"],
      maintenance: ["view", "create", "edit", "approve"],
      tasks: ["view", "create", "edit", "approve"],
      expenses: ["view", "create", "approve"],
      reports: ["view", "export"],
      documents: ["view", "create"],
      archive: ["view", "create"]
    };
  }
  if (role === "leasing") {
    return {
      dashboard: ["view"],
      properties: ["view", "edit"],
      units: ["view", "create", "edit"],
      tenants: ["view", "create", "edit", "export"],
      contracts: ["view", "create", "edit", "export"],
      tasks: ["view", "create"],
      documents: ["view", "create"],
      archive: ["view"]
    };
  }
  if (role === "maint_manager") {
    return {
      dashboard: ["view"],
      properties: ["view"],
      units: ["view"],
      maintenance: ["view", "create", "edit", "approve", "manage"],
      tasks: ["view", "create", "edit", "approve", "manage"],
      expenses: ["view", "create", "approve"],
      documents: ["view", "create"],
      reports: ["view"]
    };
  }
  if (role === "technician") {
    return {
      dashboard: ["view"],
      units: ["view"],
      maintenance: ["view", "create", "edit"],
      tasks: ["view", "create", "edit"],
      expenses: ["view", "create"]
    };
  }
  if (role === "receptionist") {
    return {
      dashboard: ["view"],
      properties: ["view"],
      units: ["view"],
      tenants: ["view", "create", "edit"],
      tasks: ["view", "create"],
      documents: ["view", "create"],
      maintenance: ["view", "create"]
    };
  }
  if (role === "owner") {
    return {
      dashboard: ["view"],
      properties: ["view"],
      units: ["view"],
      tenants: ["view"],
      contracts: ["view"],
      payments: ["view"],
      finance: ["view"],
      receipts: ["view"],
      reports: ["view", "export"],
      documents: ["view"],
      archive: ["view"]
    };
  }
  return { dashboard: ["view"] };
}
function buildAllDefaultRoleModulePermissions() {
  const out = {};
  for (const r of ROLE_TEMPLATES) {
    out[r.key] = getDefaultModulePermissionsForRole(r.key);
  }
  return out;
}
function mergeModulePermissions(base, overlay) {
  if (!overlay) return { ...base };
  const merged = {};
  for (const m of RBAC_MODULES) {
    const key = m.key;
    if (overlay[key] !== void 0) {
      merged[key] = Array.from(new Set(overlay[key] || []));
    } else if (base[key] !== void 0) {
      merged[key] = Array.from(new Set(base[key] || []));
    }
  }
  return merged;
}
function deriveLegacyPermissionsFromModules(modulePerms) {
  const set = /* @__PURE__ */ new Set();
  const hasAny = (mod, actions) => {
    const list = modulePerms[mod] || [];
    return list.includes("manage") || actions.some((a) => list.includes(a));
  };
  if (hasAny("properties", ["create", "edit", "delete_void", "manage"]) || hasAny("units", ["create", "edit", "manage"])) {
    set.add("manage_properties");
  }
  if (hasAny("tenants", ["create", "edit", "delete_void", "manage"])) {
    set.add("manage_tenants");
  }
  if (hasAny("contracts", ["create", "edit", "approve", "manage"])) {
    set.add("manage_contracts");
  }
  if (hasAny("payments", ["create", "edit", "manage"])) {
    set.add("collect_payments");
  }
  if (hasAny("receipts", ["delete_void", "approve", "manage"])) {
    set.add("reverse_receipts");
  }
  if (hasAny("finance", ["create", "edit", "approve", "manage"])) {
    set.add("manage_accounting");
  }
  if (hasAny("expenses", ["create"])) {
    set.add("create_expense");
  }
  if (hasAny("expenses", ["approve"])) {
    set.add("approve_expense_supervisor");
  }
  if (hasAny("expenses", ["manage"])) {
    set.add("approve_expense_manager");
  }
  if (hasAny("maintenance", ["manage", "approve"])) {
    set.add("manage_maintenance");
  }
  if (hasAny("maintenance", ["create", "edit"])) {
    set.add("execute_maintenance");
  }
  if (hasAny("tasks", ["create", "edit", "approve", "manage"])) {
    set.add("manage_tasks");
  }
  if (hasAny("documents", ["create", "edit", "delete_void", "manage"])) {
    set.add("manage_documents");
  }
  if (hasAny("team", ["create", "edit", "delete_void", "manage"]) || hasAny("settings", ["manage"])) {
    set.add("manage_users");
  }
  if (hasAny("backups", ["create", "manage", "approve"])) {
    set.add("backup_restore");
  }
  if (hasAny("audit", ["view", "export", "manage"])) {
    set.add("view_audit");
  }
  if (hasAny("reports", ["view"]) && hasAny("finance", ["view"])) {
    set.add("view_all");
  }
  return Array.from(set);
}
function getEffectiveModulePermissions(state, user) {
  if (!user) return {};
  const customRole = user.customRoleId ? state?.customRoles?.find((r) => r.id === user.customRoleId) : void 0;
  const baseTemplate = customRole ? customRole.modulePermissions : state?.roleModulePermissions?.[user.role] || getDefaultModulePermissionsForRole(user.role);
  const effective = mergeModulePermissions(baseTemplate, user.customModulePermissions);
  const legacyList = customRole ? customRole.legacyPermissions : state?.rolePermissions?.[user.role] || [];
  const ensureLegacy = (perm, mod, actions) => {
    if (!legacyList.includes(perm)) return;
    if (user.customModulePermissions && user.customModulePermissions[mod] !== void 0) return;
    const cur = new Set(effective[mod] || []);
    for (const a of actions) cur.add(a);
    effective[mod] = Array.from(cur);
  };
  ensureLegacy("manage_properties", "properties", ["view", "create", "edit"]);
  ensureLegacy("manage_properties", "units", ["view", "create", "edit"]);
  ensureLegacy("manage_tenants", "tenants", ["view", "create", "edit"]);
  ensureLegacy("manage_contracts", "contracts", ["view", "create", "edit"]);
  ensureLegacy("collect_payments", "payments", ["view", "create"]);
  ensureLegacy("collect_payments", "receipts", ["view", "create"]);
  ensureLegacy("reverse_receipts", "receipts", ["view", "delete_void"]);
  ensureLegacy("manage_accounting", "finance", ["view", "create", "edit"]);
  ensureLegacy("create_expense", "expenses", ["view", "create"]);
  ensureLegacy("approve_expense_supervisor", "expenses", ["view", "approve"]);
  ensureLegacy("approve_expense_manager", "expenses", ["view", "approve", "manage"]);
  ensureLegacy("manage_maintenance", "maintenance", ["view", "create", "edit", "approve", "manage"]);
  ensureLegacy("execute_maintenance", "maintenance", ["view", "edit"]);
  ensureLegacy("manage_tasks", "tasks", ["view", "create", "edit"]);
  ensureLegacy("manage_documents", "documents", ["view", "create", "edit"]);
  ensureLegacy("manage_users", "team", ["view", "create", "edit", "delete_void", "manage"]);
  ensureLegacy("backup_restore", "backups", ["view", "create", "approve", "manage"]);
  ensureLegacy("view_audit", "audit", ["view", "export"]);
  return effective;
}
function userHasModuleAction(state, user, module, action = "view") {
  if (!user || !user.active) return false;
  if (user.accountStatus && user.accountStatus !== "\u0646\u0634\u0637") return false;
  if (user.role === "sys_owner" && !user.customModulePermissions && !user.customRoleId) {
    return true;
  }
  const effective = getEffectiveModulePermissions(state, user);
  const actions = effective[module] || [];
  if (actions.includes("manage")) return true;
  return actions.includes(action);
}
function userHasLegacyPermission(state, user, permission) {
  if (!user || !user.active) return false;
  if (user.accountStatus && user.accountStatus !== "\u0646\u0634\u0637") return false;
  if (user.customRoleId) {
    const customRole = state?.customRoles?.find((r) => r.id === user.customRoleId);
    if (customRole) {
      const derived = deriveLegacyPermissionsFromModules(
        getEffectiveModulePermissions(state, user)
      );
      return customRole.legacyPermissions.includes(permission) || derived.includes(permission);
    }
  }
  if (user.customModulePermissions) {
    const derived = deriveLegacyPermissionsFromModules(
      getEffectiveModulePermissions(state, user)
    );
    if (derived.includes(permission)) return true;
  }
  const perms = state?.rolePermissions?.[user.role] || [];
  return perms.includes(permission);
}
function getNavRequiredModules(nav) {
  switch (nav) {
    case "dashboard":
      return ["dashboard"];
    case "daily_hub":
      return ["tasks", "dashboard"];
    case "properties":
      return ["properties", "units"];
    case "leasing_finance":
    case "leasing":
    case "finance":
    case "accounting":
      return ["contracts", "payments", "finance", "receipts", "expenses"];
    case "tenants":
      return ["tenants"];
    case "maintenance":
      return ["maintenance", "tasks"];
    case "reports":
    case "admin":
      return ["reports", "audit"];
    case "team":
      return ["team"];
    case "documents":
      return ["documents"];
    case "archive":
      return ["archive"];
    case "templates":
      return ["tenants", "contracts", "settings"];
    case "settings":
      return ["settings", "backups"];
    case "about":
    case "profile":
      return ["dashboard"];
    default:
      return ["dashboard"];
  }
}
function userCanAccessNav(state, user, nav) {
  if (!user || !user.active) return false;
  if (user.accountStatus && user.accountStatus !== "\u0646\u0634\u0637") return false;
  if (nav === "profile" || nav === "about" || nav === "dashboard") return true;
  if (user.role === "owner") {
    const ownerAllowed = /* @__PURE__ */ new Set(["dashboard", "properties", "leasing_finance", "tenants", "reports", "documents", "archive", "profile", "about"]);
    return ownerAllowed.has(nav);
  }
  const modules = getNavRequiredModules(nav);
  return modules.some((m) => userHasModuleAction(state, user, m, "view"));
}
function getRecommendedLandingNav(state, user) {
  if (!user || !user.active || user.accountStatus && user.accountStatus !== "\u0646\u0634\u0637") {
    return { nav: "dashboard" };
  }
  if (user.role === "accountant" && userCanAccessNav(state, user, "leasing_finance")) {
    return { nav: "leasing_finance", leasingFinanceTab: "finance" };
  }
  if ((user.role === "maint_manager" || user.role === "technician") && userCanAccessNav(state, user, "maintenance")) {
    return { nav: "maintenance" };
  }
  if (user.role === "leasing" && userCanAccessNav(state, user, "tenants")) {
    return { nav: "tenants" };
  }
  if (user.role === "supervisor" && userCanAccessNav(state, user, "properties")) {
    return { nav: "properties" };
  }
  if (user.role === "receptionist" && userCanAccessNav(state, user, "daily_hub")) {
    return { nav: "daily_hub" };
  }
  return { nav: "dashboard" };
}
function getAllowedNavsForUser(state, user) {
  const allNavs = [
    "dashboard",
    "daily_hub",
    "properties",
    "leasing_finance",
    "tenants",
    "maintenance",
    "reports",
    "team",
    "documents",
    "archive",
    "templates",
    "settings",
    "profile",
    "about"
  ];
  return allNavs.filter((n) => userCanAccessNav(state, user, n));
}

// server/store.ts
var PermissionDeniedError = class extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 403;
    this.name = "PermissionDeniedError";
  }
};
var RATES_TO_SAR = {
  SAR: 1,
  AED: 1.021,
  USD: 3.75,
  EGP: 0.077,
  KWD: 12.22
};
function toSar(amount, currency = "SAR", rates) {
  const rate = rates?.[currency] ?? RATES_TO_SAR[currency] ?? 1;
  return Math.round(amount * rate * 100) / 100;
}
function currencyLabelAr(currency = "SAR") {
  switch (currency) {
    case "AED":
      return "\u062F.\u0625";
    case "USD":
      return "$";
    case "EGP":
      return "\u062C.\u0645";
    case "KWD":
      return "\u062F.\u0643";
    default:
      return "\u0631.\u0633";
  }
}
function getBaseDataDir() {
  return process.env.AQARPLUS_USER_DATA_DIR ? path2.resolve(process.env.AQARPLUS_USER_DATA_DIR) : path2.resolve(process.cwd(), "data");
}
function getWorkspacePaths(workspaceId = "default") {
  const base = getBaseDataDir();
  const dataDir = workspaceId === "default" ? base : path2.join(base, "workspaces", workspaceId);
  return {
    dataDir,
    dbFile: path2.join(dataDir, "aqarplus.sqlite"),
    jsonFile: path2.join(dataDir, "aqarplus-db.json"),
    backupDir: path2.join(dataDir, "backups"),
    archiveDir: path2.join(dataDir, "archive"),
    documentsDir: path2.join(dataDir, "documents")
  };
}
function ensureWorkspaceDirs(paths) {
  if (!fs2.existsSync(paths.dataDir)) fs2.mkdirSync(paths.dataDir, { recursive: true });
  if (!fs2.existsSync(paths.backupDir)) fs2.mkdirSync(paths.backupDir, { recursive: true });
  if (!fs2.existsSync(paths.archiveDir)) fs2.mkdirSync(paths.archiveDir, { recursive: true });
  if (!fs2.existsSync(paths.documentsDir)) fs2.mkdirSync(paths.documentsDir, { recursive: true });
}
function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
function pad4(n) {
  return String(n).padStart(4, "0");
}
function pad3(n) {
  return String(n).padStart(3, "0");
}
var AqarStore = class {
  constructor(workspaceId = "default", provision) {
    this.propIndex = /* @__PURE__ */ new Map();
    this.unitIndex = /* @__PURE__ */ new Map();
    this.tenantIndex = /* @__PURE__ */ new Map();
    this.contractIndex = /* @__PURE__ */ new Map();
    this.idempotencyIndex = /* @__PURE__ */ new Set();
    this.workspaceId = workspaceId || "default";
    this.paths = getWorkspacePaths(this.workspaceId);
    ensureWorkspaceDirs(this.paths);
    this.sqlite = new SqlitePersistence(this.paths.dataDir);
    if (provision) {
      this.state = this.initializeProvisionedWorkspace(provision);
    } else {
      this.state = this.loadInitialState();
      this.sqlite.ensureSeedCredentials(
        this.state.users.filter((u) => u.accountStatus !== "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0641\u0639\u064A\u0644")
      );
    }
    this.rebuildIndexes();
  }
  static workspaceExists(workspaceId) {
    if (workspaceId === "default") return true;
    const paths = getWorkspacePaths(workspaceId);
    return fs2.existsSync(paths.dbFile);
  }
  getPersistence() {
    return this.sqlite;
  }
  getSessionSecret() {
    return this.sqlite.getOrCreateSessionSecret();
  }
  normalizePhoneKey(raw) {
    const digits = (raw || "").replace(/[^\d]/g, "");
    if (digits.length >= 9) {
      return digits.slice(-9);
    }
    return digits;
  }
  findUserByLoginIdentifier(identifier) {
    const raw = (identifier || "").trim();
    const norm = raw.toLowerCase();
    if (!norm) return void 0;
    const phoneKey = this.normalizePhoneKey(raw);
    return this.state.users.find(
      (u) => u.id.toLowerCase() === norm || u.email.toLowerCase() === norm || u.username && u.username.toLowerCase() === norm || u.phone === raw || phoneKey.length >= 9 && this.normalizePhoneKey(u.phone) === phoneKey
    );
  }
  assertAccountLoginAllowed(user) {
    const status = user.accountStatus || (user.active ? "\u0646\u0634\u0637" : "\u0645\u0648\u0642\u0648\u0641");
    if (status === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0641\u0639\u064A\u0644") {
      throw new Error("\u062D\u0633\u0627\u0628\u0643 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0641\u0639\u064A\u0644 \u2014 \u064A\u0631\u062C\u0649 \u0641\u062A\u062D \u0631\u0627\u0628\u0637 \u0627\u0644\u062F\u0639\u0648\u0629 \u0648\u0625\u0643\u0645\u0627\u0644 \u0625\u0639\u062F\u0627\u062F \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0623\u0648\u0644\u0627\u064B");
    }
    if (status === "\u0645\u0631\u0641\u0648\u0636") {
      throw new Error("\u062A\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628 \u062A\u0641\u0639\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0646 \u0642\u0650\u0628\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629");
    }
    if (status === "\u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0648\u0635\u0648\u0644") {
      throw new Error("\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0648\u0635\u0648\u0644 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0625\u0644\u0649 \u0627\u0644\u0634\u0631\u0643\u0629");
    }
    if (!user.active || status === "\u0645\u0648\u0642\u0648\u0641") {
      throw new Error("\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0646 \u0642\u0650\u0628\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629");
    }
  }
  getLoginProfiles() {
    return this.state.users.filter((u) => u.active && (!u.accountStatus || u.accountStatus === "\u0646\u0634\u0637")).map((u) => ({
      id: u.id,
      nameAr: u.nameAr,
      nameEn: u.nameEn,
      email: u.email,
      role: u.role,
      roleLabelAr: u.roleLabelAr,
      roleLabelEn: u.roleLabelEn,
      hasPin: u.security?.pinEnabled !== false && this.sqlite.getCredentialStatus(u.id).hasPin
    }));
  }
  hasUserWithIdentifier(identifier) {
    return this.findUserByLoginIdentifier(identifier);
  }
  authenticatePasswordDetailed(identifier, password, deviceName) {
    const user = this.findUserByLoginIdentifier(identifier);
    if (!user) {
      throw new Error("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    }
    this.assertAccountLoginAllowed(user);
    if (user.security?.lockedUntil && new Date(user.security.lockedUntil).getTime() > Date.now()) {
      const waitSec = Math.ceil((new Date(user.security.lockedUntil).getTime() - Date.now()) / 1e3);
      throw new Error(`\u062A\u0645 \u0642\u0641\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0624\u0642\u062A\u0627\u064B \u0644\u0643\u062B\u0631\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u062E\u0627\u0637\u0626\u0629. \u062D\u0627\u0648\u0644 \u0628\u0639\u062F ${waitSec} \u062B\u0627\u0646\u064A\u0629.`);
    }
    if (!this.sqlite.verifyUserPassword(user.id, password)) {
      if (!user.security) user.security = {};
      user.security.failedAttempts = (user.security.failedAttempts || 0) + 1;
      if (user.security.failedAttempts >= 5) {
        user.security.lockedUntil = new Date(Date.now() + 5 * 60 * 1e3).toISOString();
      }
      this.recordLoginEvent({
        userId: user.id,
        deviceName: deviceName || user.deviceName,
        method: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631",
        success: false
      });
      this.persist();
      throw new Error("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    }
    const hadSuspiciousFailures = (user.security?.failedAttempts || 0) >= 3;
    if (user.security) {
      user.security.failedAttempts = 0;
      user.security.lockedUntil = void 0;
      user.security.pinFailedAttempts = 0;
      user.security.pinLockedUntil = void 0;
      user.security.requirePasswordAfterPinLock = false;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    user.statusState = "\u0645\u062A\u0635\u0644";
    user.lastLoginAt = now;
    user.lastActiveAt = now;
    this.recordLoginEvent({
      userId: user.id,
      deviceName: deviceName || user.deviceName,
      method: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631",
      success: true
    });
    this.persist();
    return { user, hadSuspiciousFailures };
  }
  authenticatePassword(identifier, password, deviceName) {
    return this.authenticatePasswordDetailed(identifier, password, deviceName).user;
  }
  authenticatePin(userIdOrIdentifier, pin, deviceName) {
    const user = this.findUserByLoginIdentifier(userIdOrIdentifier);
    if (!user) {
      throw new Error("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648 \u0631\u0645\u0632 PIN \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    }
    this.assertAccountLoginAllowed(user);
    if (user.security?.pinEnabled === false || !this.sqlite.getCredentialStatus(user.id).hasPin) {
      throw new Error("\u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0631\u0645\u0632 PIN \u0645\u0639\u0637\u0651\u0644 \u0644\u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u2014 \u0627\u0633\u062A\u062E\u062F\u0645 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631");
    }
    if (user.security?.requirePasswordAfterPinLock) {
      throw new Error("\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0631\u0645\u0632 PIN \u0645\u0624\u0642\u062A\u0627\u064B \u0644\u0643\u062B\u0631\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u062E\u0627\u0637\u0626\u0629 \u2014 \u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0623\u0648\u0644\u0627\u064B");
    }
    if (user.security?.lockedUntil && new Date(user.security.lockedUntil).getTime() > Date.now()) {
      const waitSec = Math.ceil((new Date(user.security.lockedUntil).getTime() - Date.now()) / 1e3);
      throw new Error(`\u062A\u0645 \u0642\u0641\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0624\u0642\u062A\u0627\u064B \u0644\u0643\u062B\u0631\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u062E\u0627\u0637\u0626\u0629. \u062D\u0627\u0648\u0644 \u0628\u0639\u062F ${waitSec} \u062B\u0627\u0646\u064A\u0629.`);
    }
    if (user.security?.pinLockedUntil && new Date(user.security.pinLockedUntil).getTime() > Date.now()) {
      const waitSec = Math.ceil((new Date(user.security.pinLockedUntil).getTime() - Date.now()) / 1e3);
      throw new Error(`\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 ${waitSec} \u062B\u0627\u0646\u064A\u0629 \u0642\u0628\u0644 \u0625\u0639\u0627\u062F\u0629 \u0625\u062F\u062E\u0627\u0644 \u0631\u0645\u0632 PIN.`);
    }
    if (!/^\d{4,6}$/.test(pin) || !this.sqlite.verifyUserPin(user.id, pin)) {
      if (!user.security) user.security = {};
      user.security.pinFailedAttempts = (user.security.pinFailedAttempts || 0) + 1;
      const fails = user.security.pinFailedAttempts;
      if (fails >= 5) {
        user.security.pinLockedUntil = new Date(Date.now() + 10 * 60 * 1e3).toISOString();
        user.security.requirePasswordAfterPinLock = true;
      } else if (fails === 4) {
        user.security.pinLockedUntil = new Date(Date.now() + 120 * 1e3).toISOString();
      } else if (fails === 3) {
        user.security.pinLockedUntil = new Date(Date.now() + 30 * 1e3).toISOString();
      }
      this.recordLoginEvent({
        userId: user.id,
        deviceName: deviceName || user.deviceName,
        method: "\u0628\u0635\u0645\u0629 / Face ID",
        success: false
      });
      this.persist();
      if (fails >= 5) {
        throw new Error("\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0645\u062D\u0627\u0648\u0644\u0627\u062A PIN \u0627\u0644\u0645\u0633\u0645\u0648\u062D\u0629 \u2014 \u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0644\u0644\u0645\u062A\u0627\u0628\u0639\u0629");
      }
      throw new Error("\u0631\u0645\u0632 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0633\u0631\u064A\u0639 (PIN) \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    }
    if (user.security) {
      user.security.failedAttempts = 0;
      user.security.lockedUntil = void 0;
      user.security.pinFailedAttempts = 0;
      user.security.pinLockedUntil = void 0;
      user.security.requirePasswordAfterPinLock = false;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    user.statusState = "\u0645\u062A\u0635\u0644";
    user.lastLoginAt = now;
    user.lastActiveAt = now;
    this.recordLoginEvent({
      userId: user.id,
      deviceName: deviceName || user.deviceName,
      method: "\u0628\u0635\u0645\u0629 / Face ID",
      success: true
    });
    this.persist();
    return user;
  }
  updateUserCredentials(actorUserId, targetUserId, input, deviceName) {
    const actor = this.getActingUser(actorUserId);
    const isSelf = actor.id === targetUserId;
    if (!isSelf && actor.role !== "sys_owner") {
      throw new PermissionDeniedError("\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u062F\u062E\u0648\u0644 \u0645\u0648\u0638\u0641 \u0622\u062E\u0631 \u062D\u0635\u0631\u064A \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645");
    }
    if (isSelf && input.newPassword) {
      if (!input.currentPassword || !this.sqlite.verifyUserPassword(actor.id, input.currentPassword)) {
        throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
      }
    }
    if (isSelf && input.newPin && input.currentPin !== void 0) {
      if (!this.sqlite.verifyUserPin(actor.id, input.currentPin)) {
        throw new Error("\u0631\u0645\u0632 PIN \u0627\u0644\u062D\u0627\u0644\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      }
    }
    if (input.newPassword && input.newPassword.length < 8) {
      throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u064A\u062C\u0628 \u0623\u0646 \u0644\u0627 \u062A\u0642\u0644 \u0639\u0646 8 \u0623\u062D\u0631\u0641");
    }
    if (input.newPin && !/^\d{4,6}$/.test(input.newPin)) {
      throw new Error("\u0631\u0645\u0632 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0633\u0631\u064A\u0639 (PIN) \u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0643\u0648\u0646 \u0645\u0646 4 \u0625\u0644\u0649 6 \u0623\u0631\u0642\u0627\u0645");
    }
    this.sqlite.updateUserCredentials(targetUserId, {
      password: input.newPassword,
      pin: input.newPin
    });
    const target = this.state.users.find((u) => u.id === targetUserId);
    if (target) {
      target.security = {
        ...target.security || {},
        hasPin: input.newPin ? true : target.security?.hasPin,
        lastPasswordChangedAt: (/* @__PURE__ */ new Date()).toISOString(),
        tempPasswordSet: !isSelf
      };
    }
    this.addAudit(
      actor,
      "\u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0623\u0645\u0627\u0646 \u0648\u0627\u0644\u062F\u062E\u0648\u0644",
      "StaffUser",
      targetUserId,
      isSelf ? "\u062A\u062D\u062F\u064A\u062B \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 / \u0631\u0645\u0632 PIN \u0627\u0644\u0634\u062E\u0635\u064A" : `\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0644\u0645\u0648\u0638\u0641 ${target?.nameAr || targetUserId}`,
      { deviceName }
    );
    this.persist();
    return { revokedOtherSessions: 0 };
  }
  bumpEntityRevision(entityKey) {
    if (!this.state.entityRevisions) this.state.entityRevisions = {};
    const next = (this.state.entityRevisions[entityKey] || 1) + 1;
    this.state.entityRevisions[entityKey] = next;
    return next;
  }
  rebuildIndexes() {
    this.propIndex = new Map(this.state.properties.map((p) => [p.id, p]));
    this.unitIndex = new Map(this.state.units.map((u) => [u.id, u]));
    this.tenantIndex = new Map(this.state.tenants.map((t) => [t.id, t]));
    this.contractIndex = new Map(this.state.contracts.map((c) => [c.id, c]));
    this.idempotencyIndex = new Set(this.state.processedIdempotencyKeys || []);
  }
  runTransaction(fn) {
    const snapshot = structuredClone(this.state);
    try {
      const result = fn();
      this.rebuildIndexes();
      return result;
    } catch (err) {
      this.state = snapshot;
      this.rebuildIndexes();
      throw err;
    }
  }
  normalizeParsedState(parsed, seed) {
    const mergeMissingById = (existing = [], seedItems = []) => {
      const seen = new Set(existing.map((x) => x.id));
      return [...existing, ...seedItems.filter((item) => !seen.has(item.id))];
    };
    const parsedUsers = Array.isArray(parsed.users) ? parsed.users : seed.users;
    const parsedProperties = Array.isArray(parsed.properties) ? parsed.properties : seed.properties;
    const shouldSeedArchive = !parsed.archiveSeeded && parsedProperties.length > 0;
    const shouldSeedTeam = !parsed.teamSeeded && parsedUsers.length > 0;
    const mergedUsers = shouldSeedTeam ? [
      ...parsedUsers.map((u) => {
        const seedMatch = seed.users.find((su) => su.id === u.id);
        return {
          ...seedMatch,
          ...u,
          statusState: u.statusState || seedMatch?.statusState || "\u0645\u062A\u0635\u0644",
          specialty: u.specialty || seedMatch?.specialty,
          managerRating: u.managerRating ?? seedMatch?.managerRating ?? 4.8,
          lastActivitySummary: u.lastActivitySummary || seedMatch?.lastActivitySummary,
          security: u.security || seedMatch?.security,
          notificationPrefs: u.notificationPrefs || seedMatch?.notificationPrefs
        };
      }),
      ...seed.users.filter((su) => !parsedUsers.some((pu) => pu.id === su.id))
    ] : parsedUsers;
    const defaultCompanyId = this.getWorkspaceCompanyId(parsed.companies || seed.companies);
    const normalizedUsers = mergedUsers.map((u) => ({
      ...u,
      companyId: u.companyId || defaultCompanyId,
      username: u.username || (u.email ? u.email.split("@")[0].toLowerCase() : u.id),
      accountStatus: u.accountStatus || (u.active ? "\u0646\u0634\u0637" : "\u0645\u0648\u0642\u0648\u0641"),
      createdAt: u.createdAt || u.lastActiveAt,
      joinedAt: u.joinedAt || (u.active ? u.createdAt || u.lastActiveAt : void 0)
    }));
    const mergedRolePermissions = {
      ...DEFAULT_ROLE_PERMISSIONS,
      ...parsed.rolePermissions || {}
    };
    const mergedRoleModulePermissions = {
      ...buildAllDefaultRoleModulePermissions(),
      ...parsed.roleModulePermissions || {}
    };
    return {
      ...seed,
      ...parsed,
      users: normalizedUsers,
      employeeInvitations: Array.isArray(parsed.employeeInvitations) ? parsed.employeeInvitations : [],
      customRoles: Array.isArray(parsed.customRoles) ? parsed.customRoles : [],
      rolePermissions: mergedRolePermissions,
      roleModulePermissions: mergedRoleModulePermissions,
      properties: parsedProperties,
      units: shouldSeedArchive ? mergeMissingById(parsed.units || [], seed.units) : parsed.units || seed.units,
      payments: shouldSeedArchive ? mergeMissingById(parsed.payments || [], seed.payments) : parsed.payments || seed.payments,
      tickets: shouldSeedArchive ? mergeMissingById(parsed.tickets || [], seed.tickets) : parsed.tickets || seed.tickets,
      tasks: shouldSeedArchive ? mergeMissingById(parsed.tasks || [], seed.tasks) : parsed.tasks || seed.tasks,
      documents: shouldSeedArchive ? mergeMissingById(parsed.documents || [], seed.documents) : parsed.documents || seed.documents,
      savedArchiveFilters: Array.isArray(parsed.savedArchiveFilters) && parsed.savedArchiveFilters.length > 0 ? parsed.savedArchiveFilters : shouldSeedArchive ? seed.savedArchiveFilters : [],
      archiveLastNightlyRun: parsed.archiveLastNightlyRun || seed.archiveLastNightlyRun,
      archiveSeeded: parsed.archiveSeeded ?? true,
      securityPolicy: parsed.securityPolicy || seed.securityPolicy,
      loginHistory: this.workspaceId !== "default" ? Array.isArray(parsed.loginHistory) ? parsed.loginHistory : [] : Array.isArray(parsed.loginHistory) && parsed.loginHistory.length > 0 ? parsed.loginHistory : seed.loginHistory,
      syncConflicts: this.workspaceId !== "default" ? Array.isArray(parsed.syncConflicts) ? parsed.syncConflicts : [] : Array.isArray(parsed.syncConflicts) && parsed.syncConflicts.length > 0 ? parsed.syncConflicts : seed.syncConflicts,
      teamSeeded: parsed.teamSeeded ?? true,
      settings: {
        ...seed.settings,
        ...parsed.settings || {},
        currencyRatesToSar: {
          ...seed.settings.currencyRatesToSar,
          ...parsed.settings?.currencyRatesToSar || {}
        },
        bankAccounts: Array.isArray(parsed.settings?.bankAccounts) && parsed.settings.bankAccounts.length > 0 ? parsed.settings.bankAccounts : seed.settings.bankAccounts,
        receiptBranding: {
          ...seed.settings.receiptBranding,
          ...parsed.settings?.receiptBranding || {}
        },
        generalPrefs: {
          ...seed.settings.generalPrefs,
          ...parsed.settings?.generalPrefs || {}
        },
        securityCenter: {
          ...seed.settings.securityCenter,
          ...parsed.settings?.securityCenter || {}
        },
        notificationsCenter: {
          ...seed.settings.notificationsCenter,
          ...parsed.settings?.notificationsCenter || {}
        },
        printShare: {
          ...seed.settings.printShare,
          ...parsed.settings?.printShare || {}
        },
        backupPolicy: {
          ...seed.settings.backupPolicy,
          ...parsed.settings?.backupPolicy || {}
        },
        syncCenter: {
          ...seed.settings.syncCenter,
          ...parsed.settings?.syncCenter || {}
        },
        developerCenter: {
          ...seed.settings.developerCenter,
          ...parsed.settings?.developerCenter || {}
        }
      },
      companies: Array.isArray(parsed.companies) && parsed.companies.length > 0 ? parsed.companies : seed.companies,
      vendors: (parsed.vendors || seed.vendors).map((v) => {
        const seedV = seed.vendors.find((sv) => sv.id === v.id);
        return { ...seedV, ...v };
      }),
      tenants: (shouldSeedArchive ? mergeMissingById(parsed.tenants || [], seed.tenants) : parsed.tenants || seed.tenants).map((t) => {
        const seedT = seed.tenants.find((st) => st.id === t.id);
        return { ...seedT, ...t };
      }),
      contracts: (shouldSeedArchive ? mergeMissingById(parsed.contracts || [], seed.contracts) : parsed.contracts || seed.contracts).map((c) => {
        const seedC = seed.contracts.find((sc) => sc.id === c.id);
        return { ...seedC, ...c };
      }),
      leads: (parsed.leads || seed.leads).map((l) => {
        const seedL = seed.leads.find((sl) => sl.id === l.id);
        return { ...seedL, ...l };
      }),
      leadEscalations: Array.isArray(parsed.leadEscalations) && parsed.leadEscalations.length > 0 ? parsed.leadEscalations : seed.leadEscalations,
      supplierInvoices: Array.isArray(parsed.supplierInvoices) && parsed.supplierInvoices.length > 0 ? parsed.supplierInvoices : seed.supplierInvoices,
      recurringExpenses: Array.isArray(parsed.recurringExpenses) && parsed.recurringExpenses.length > 0 ? parsed.recurringExpenses : seed.recurringExpenses,
      propertyBudgets: Array.isArray(parsed.propertyBudgets) && parsed.propertyBudgets.length > 0 ? parsed.propertyBudgets : seed.propertyBudgets,
      purchaseOrders: Array.isArray(parsed.purchaseOrders) ? parsed.purchaseOrders : seed.purchaseOrders,
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : seed.decisions,
      reminderRules: Array.isArray(parsed.reminderRules) ? parsed.reminderRules : seed.reminderRules,
      reminderLogs: Array.isArray(parsed.reminderLogs) ? parsed.reminderLogs : seed.reminderLogs,
      communicationTemplates: Array.isArray(parsed.communicationTemplates) && parsed.communicationTemplates.length > 0 ? parsed.communicationTemplates : seed.communicationTemplates,
      meterReadings: this.workspaceId !== "default" ? Array.isArray(parsed.meterReadings) ? parsed.meterReadings : [] : Array.isArray(parsed.meterReadings) && parsed.meterReadings.length > 0 ? parsed.meterReadings : seed.meterReadings,
      scheduledReports: Array.isArray(parsed.scheduledReports) ? parsed.scheduledReports : [],
      favoriteReports: Array.isArray(parsed.favoriteReports) ? parsed.favoriteReports : [],
      sharedSearchFilters: Array.isArray(parsed.sharedSearchFilters) ? parsed.sharedSearchFilters : [],
      zatcaInvoices: Array.isArray(parsed.zatcaInvoices) ? parsed.zatcaInvoices : [],
      syncRevision: typeof parsed.syncRevision === "number" ? parsed.syncRevision : 1,
      entityRevisions: parsed.entityRevisions || {}
    };
  }
  initializeProvisionedWorkspace(input) {
    const existing = this.sqlite.loadState();
    if (existing && Array.isArray(existing.users) && existing.users.length > 0) {
      throw new Error("\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0639\u0645\u0644 \u0647\u0630\u0647 \u0645\u0641\u0639\u0651\u0644\u0629 \u0645\u0633\u0628\u0642\u0627\u064B \u2014 \u0627\u062E\u062A\u0631 \u0645\u0639\u0631\u0651\u0641 \u0634\u0631\u0643\u0629 \u0645\u062E\u062A\u0644\u0641\u0627\u064B \u0623\u0648 \u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644");
    }
    const base = createInitialSeed();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const companyEn = (input.companyNameEn || input.companyNameAr || "AqarPlus Workspace").trim();
    const adminId = `usr-${this.workspaceId}-owner`;
    const adminUser = {
      id: adminId,
      companyId: `comp-${this.workspaceId}`,
      nameAr: input.adminNameAr.trim(),
      nameEn: input.adminNameAr.trim(),
      username: input.adminEmail.trim().toLowerCase().split("@")[0],
      jobTitle: "\u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645 \u0648\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
      department: "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0644\u064A\u0627",
      email: input.adminEmail.trim().toLowerCase(),
      phone: (input.adminPhone || "").trim(),
      role: "sys_owner",
      roleLabelAr: "\u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645",
      roleLabelEn: "System Owner",
      approvalLimitSar: 1e7,
      deviceName: input.deviceName || "Web Terminal",
      lastActiveAt: now,
      lastLoginAt: now,
      joinedAt: now,
      createdAt: now,
      statusState: "\u0645\u062A\u0635\u0644",
      active: true,
      accountStatus: "\u0646\u0634\u0637",
      security: {
        hasPin: Boolean(input.pin),
        lastPasswordChangedAt: now
      }
    };
    const fresh = {
      ...base,
      settings: {
        ...base.settings,
        nameAr: input.companyNameAr.trim(),
        nameEn: companyEn,
        email: adminUser.email,
        phone: adminUser.phone
      },
      companies: [
        {
          id: `comp-${this.workspaceId}`,
          nameAr: input.companyNameAr.trim(),
          nameEn: companyEn,
          city: base.settings.city,
          vatNumber: "",
          crNumber: "",
          address: base.settings.address || "",
          phone: adminUser.phone,
          email: adminUser.email,
          bankName: base.settings.bankAccounts?.[0]?.bankName || "",
          iban: base.settings.bankAccounts?.[0]?.iban || "",
          receiptFooterAr: "",
          isDefault: true
        }
      ],
      users: [adminUser],
      properties: [],
      units: [],
      meterReadings: [],
      owners: [],
      vendors: [],
      tenants: [],
      leads: [],
      leadEscalations: [],
      contracts: [],
      handovers: [],
      installments: [],
      payments: [],
      journals: [],
      expenses: [],
      supplierInvoices: [],
      recurringExpenses: [],
      propertyBudgets: [],
      assets: [],
      tickets: [],
      tasks: [],
      communications: [],
      documents: [],
      purchaseOrders: [],
      decisions: [],
      notifications: [],
      reminderLogs: [],
      auditLogs: [],
      backups: [],
      loginHistory: [],
      syncConflicts: [],
      zatcaInvoices: [],
      employeeInvitations: [],
      customRoles: [],
      archiveSeeded: true,
      teamSeeded: true,
      rolePermissions: JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS)),
      roleModulePermissions: buildAllDefaultRoleModulePermissions(),
      counters: {
        receipt: 0,
        expense: 0,
        ticket: 0,
        journal: 0,
        contract: 0
      },
      processedIdempotencyKeys: [],
      entityRevisions: {},
      syncRevision: 1,
      lastUpdatedAt: now
    };
    this.sqlite.saveState(fresh);
    const randomPin = crypto3.randomInt(1e5, 999999).toString();
    this.sqlite.updateUserCredentials(adminId, {
      password: input.password,
      pin: input.pin || randomPin
    });
    return fresh;
  }
  loadInitialState() {
    const seed = createInitialSeed();
    try {
      const fromSqlite = this.sqlite.loadState();
      if (fromSqlite && Array.isArray(fromSqlite.properties) && Array.isArray(fromSqlite.users)) {
        return this.normalizeParsedState(fromSqlite, seed);
      }
      if (this.workspaceId === "default" && fs2.existsSync(this.paths.jsonFile)) {
        const raw = fs2.readFileSync(this.paths.jsonFile, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.properties) && Array.isArray(parsed.users)) {
          const normalized = this.normalizeParsedState(parsed, seed);
          this.sqlite.saveState(normalized);
          try {
            fs2.copyFileSync(this.paths.jsonFile, `${this.paths.jsonFile}.migrated.bak`);
          } catch {
          }
          return normalized;
        }
      }
    } catch (err) {
      console.error("Failed to load SQLite/JSON DB, initializing seed:", err);
    }
    this.persist(seed);
    return seed;
  }
  persist(nextState = this.state) {
    ensureWorkspaceDirs(this.paths);
    nextState.syncRevision = (nextState.syncRevision || 0) + 1;
    nextState.lastUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.sqlite.saveState(nextState);
    if (nextState === this.state) {
      this.rebuildIndexes();
    }
  }
  getState() {
    return this.state;
  }
  getWorkspaceCompanyId(companies = this.state?.companies) {
    const def = (companies || []).find((c) => c.isDefault) || (companies || [])[0];
    return def?.id || `comp-${this.workspaceId}`;
  }
  getCompanySummary() {
    const def = (this.state.companies || []).find((c) => c.isDefault) || (this.state.companies || [])[0];
    return {
      id: def?.id || `comp-${this.workspaceId}`,
      nameAr: this.state.settings?.nameAr || def?.nameAr || "AqarPlus",
      nameEn: this.state.settings?.nameEn || def?.nameEn || "AqarPlus",
      logoDataUrl: this.state.settings?.logoDataUrl
    };
  }
  sanitizeUsersForActor(actor) {
    const canManageUsers = this.userHasPermission(actor, "manage_users") || userHasModuleAction(this.state, actor, "team", "view");
    if (canManageUsers) {
      return this.state.users;
    }
    return this.state.users.map((u) => {
      const isSelf = u.id === actor.id;
      return {
        id: u.id,
        companyId: u.companyId,
        nameAr: u.nameAr,
        nameEn: u.nameEn,
        username: isSelf ? u.username : void 0,
        jobTitle: u.jobTitle,
        department: u.department,
        role: u.role,
        roleLabelAr: u.roleLabelAr,
        roleLabelEn: u.roleLabelEn,
        customRoleId: isSelf ? u.customRoleId : void 0,
        email: isSelf ? u.email : "",
        phone: isSelf ? u.phone : "",
        secondaryPhone: isSelf ? u.secondaryPhone : void 0,
        approvalLimitSar: isSelf ? u.approvalLimitSar : 0,
        active: u.active,
        accountStatus: u.accountStatus,
        ownerId: isSelf ? u.ownerId : void 0,
        deviceName: isSelf ? u.deviceName : "",
        lastActiveAt: u.lastActiveAt,
        lastLoginAt: isSelf ? u.lastLoginAt : void 0,
        joinedAt: isSelf ? u.joinedAt : void 0,
        createdAt: isSelf ? u.createdAt : void 0,
        statusState: u.statusState,
        specialty: u.specialty,
        avatarDataUrl: u.avatarDataUrl,
        allowedPropertyIds: isSelf ? u.allowedPropertyIds : void 0,
        customModulePermissions: isSelf ? u.customModulePermissions : void 0,
        security: isSelf ? u.security : void 0,
        notificationPrefs: isSelf ? u.notificationPrefs : void 0,
        pendingEmailVerification: isSelf ? u.pendingEmailVerification : void 0,
        pendingPhoneVerification: isSelf ? u.pendingPhoneVerification : void 0
      };
    });
  }
  getStateForUser(userId) {
    if (!userId) {
      throw new Error("\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A");
    }
    const user = this.state.users.find(
      (u) => u.id === userId && u.active && (!u.accountStatus || u.accountStatus === "\u0646\u0634\u0637")
    );
    if (!user) {
      throw new Error("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0647 \u0623\u0648 \u0645\u0648\u0642\u0648\u0641");
    }
    const canViewAudit = this.userHasPermission(user, "view_audit") || userHasModuleAction(this.state, user, "audit", "view");
    const canBackup = this.userHasPermission(user, "backup_restore") || userHasModuleAction(this.state, user, "backups", "view");
    const canViewTeam = this.userHasPermission(user, "manage_users") || userHasModuleAction(this.state, user, "team", "view");
    const sanitizedUsers = this.sanitizeUsersForActor(user);
    const visibleInvitations = canViewTeam ? this.state.employeeInvitations || [] : [];
    if (user.role !== "owner" && user.role !== "gm" && user.role !== "sys_owner") {
      const allowedProps = user.allowedPropertyIds;
      if (Array.isArray(allowedProps) && allowedProps.length > 0) {
        const propSet = new Set(allowedProps);
        const unitSet = new Set(this.state.units.filter((u) => propSet.has(u.propertyId)).map((u) => u.id));
        const ctrSet = new Set(this.state.contracts.filter((c) => propSet.has(c.propertyId)).map((c) => c.id));
        const tenantSet = new Set(
          this.state.contracts.filter((c) => propSet.has(c.propertyId)).map((c) => c.tenantId)
        );
        return {
          ...this.state,
          users: sanitizedUsers,
          employeeInvitations: visibleInvitations,
          auditLogs: canViewAudit ? this.state.auditLogs.filter((a) => !a.propertyId || propSet.has(a.propertyId)) : [],
          loginHistory: canViewAudit ? this.state.loginHistory : [],
          backups: canBackup ? this.state.backups : [],
          properties: this.state.properties.filter((p) => propSet.has(p.id)),
          units: this.state.units.filter((u) => unitSet.has(u.id)),
          tenants: this.state.tenants.filter((t) => tenantSet.has(t.id)),
          contracts: this.state.contracts.filter((c) => ctrSet.has(c.id)),
          handovers: this.state.handovers.filter((h) => propSet.has(h.propertyId)),
          installments: this.state.installments.filter((i) => propSet.has(i.propertyId)),
          payments: this.state.payments.filter((p) => propSet.has(p.propertyId)),
          expenses: this.state.expenses.filter((e) => propSet.has(e.propertyId)),
          supplierInvoices: (this.state.supplierInvoices || []).filter((si) => propSet.has(si.propertyId)),
          propertyBudgets: (this.state.propertyBudgets || []).filter((pb) => propSet.has(pb.propertyId)),
          tickets: this.state.tickets.filter((t) => propSet.has(t.propertyId)),
          tasks: this.state.tasks.filter((t) => !t.propertyId || propSet.has(t.propertyId) || t.assignedTo === user.id),
          leads: this.state.leads.filter((l) => propSet.has(l.propertyId)),
          leadEscalations: (this.state.leadEscalations || []).filter((le) => propSet.has(le.propertyId)),
          meterReadings: (this.state.meterReadings || []).filter((mr) => propSet.has(mr.propertyId)),
          documents: this.state.documents.filter(
            (d) => d.relatedType === "\u0634\u0631\u0643\u0629" || d.relatedType === "\u0639\u0642\u0627\u0631" && propSet.has(d.relatedId) || d.relatedType === "\u0648\u062D\u062F\u0629" && unitSet.has(d.relatedId) || d.relatedType === "\u0639\u0642\u062F" && ctrSet.has(d.relatedId) || d.relatedType === "\u0645\u0633\u062A\u0623\u062C\u0631" && tenantSet.has(d.relatedId)
          )
        };
      }
      return {
        ...this.state,
        users: sanitizedUsers,
        employeeInvitations: visibleInvitations,
        auditLogs: canViewAudit ? this.state.auditLogs : [],
        loginHistory: canViewAudit ? this.state.loginHistory : [],
        backups: canBackup ? this.state.backups : []
      };
    }
    if (user.role !== "owner" || !user.ownerId) {
      return {
        ...this.state,
        users: sanitizedUsers,
        employeeInvitations: visibleInvitations,
        auditLogs: canViewAudit ? this.state.auditLogs : [],
        loginHistory: canViewAudit ? this.state.loginHistory : [],
        backups: canBackup ? this.state.backups : []
      };
    }
    const ownedPropIds = new Set(
      this.state.properties.filter((p) => p.ownerShares.some((s) => s.ownerId === user.ownerId)).map((p) => p.id)
    );
    const ownedUnitIds = new Set(
      this.state.units.filter((u) => ownedPropIds.has(u.propertyId)).map((u) => u.id)
    );
    const ownedContractIds = new Set(
      this.state.contracts.filter((c) => ownedPropIds.has(c.propertyId)).map((c) => c.id)
    );
    const ownedTenantIds = new Set(
      this.state.contracts.filter((c) => ownedPropIds.has(c.propertyId)).map((c) => c.tenantId)
    );
    return {
      ...this.state,
      users: sanitizedUsers,
      employeeInvitations: [],
      properties: this.state.properties.filter((p) => ownedPropIds.has(p.id)),
      units: this.state.units.filter((u) => ownedUnitIds.has(u.id)),
      contracts: this.state.contracts.filter((c) => ownedContractIds.has(c.id)),
      handovers: this.state.handovers.filter((h) => ownedPropIds.has(h.propertyId)),
      installments: this.state.installments.filter((i) => ownedPropIds.has(i.propertyId)),
      payments: this.state.payments.filter((p) => ownedPropIds.has(p.propertyId)),
      expenses: this.state.expenses.filter((e) => ownedPropIds.has(e.propertyId) && e.approvalStatus === "\u0645\u0639\u062A\u0645\u062F"),
      supplierInvoices: (this.state.supplierInvoices || []).filter((si) => ownedPropIds.has(si.propertyId)),
      propertyBudgets: (this.state.propertyBudgets || []).filter((pb) => ownedPropIds.has(pb.propertyId)),
      tickets: this.state.tickets.filter((t) => ownedPropIds.has(t.propertyId)),
      leads: this.state.leads.filter((l) => ownedPropIds.has(l.propertyId)),
      leadEscalations: (this.state.leadEscalations || []).filter((le) => ownedPropIds.has(le.propertyId)),
      meterReadings: (this.state.meterReadings || []).filter((mr) => ownedPropIds.has(mr.propertyId)),
      owners: this.state.owners.filter((o) => o.id === user.ownerId),
      tenants: this.state.tenants.filter((t) => ownedTenantIds.has(t.id)),
      documents: this.state.documents.filter(
        (d) => d.relatedType === "\u0639\u0642\u0627\u0631" && ownedPropIds.has(d.relatedId) || d.relatedType === "\u0648\u062D\u062F\u0629" && ownedUnitIds.has(d.relatedId) || d.relatedType === "\u0639\u0642\u062F" && ownedContractIds.has(d.relatedId) || d.relatedType === "\u0645\u0633\u062A\u0623\u062C\u0631" && ownedTenantIds.has(d.relatedId)
      ),
      auditLogs: [],
      loginHistory: [],
      backups: []
    };
  }
  getActingUser(userId) {
    const user = this.state.users.find(
      (u) => u.id === userId && u.active && (!u.accountStatus || u.accountStatus === "\u0646\u0634\u0637")
    );
    if (!user) throw new Error("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0645\u0648\u0642\u0648\u0641");
    return user;
  }
  userHasPermission(user, permission) {
    return userHasLegacyPermission(this.state, user, permission);
  }
  assertPermission(userId, permission) {
    const user = this.getActingUser(userId);
    if (!this.userHasPermission(user, permission)) {
      throw new PermissionDeniedError(`\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0646\u0641\u064A\u0630 \u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 (${permission})`);
    }
    return user;
  }
  assertModuleAction(userId, module, action = "view") {
    const user = this.getActingUser(userId);
    if (!userHasModuleAction(this.state, user, module, action)) {
      throw new PermissionDeniedError(`\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 (${action}) \u0639\u0644\u0649 \u0642\u0633\u0645 (${module})`);
    }
    return user;
  }
  addAudit(user, action, entityType, entityId, summary, opts) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    user.lastActiveAt = now;
    user.lastActivitySummary = summary;
    const entry = {
      id: uid("aud"),
      userId: user.id,
      userName: user.nameAr,
      userRole: user.roleLabelAr,
      deviceName: opts?.deviceName || user.deviceName,
      ipAddress: opts?.ipAddress || "192.168.10.1",
      geoLocation: opts?.geoLocation || "\u0627\u0644\u0631\u064A\u0627\u0636 \xB7 \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629",
      propertyId: opts?.propertyId,
      action,
      entityType,
      entityId,
      summary,
      oldValue: opts?.oldValue,
      newValue: opts?.newValue,
      reason: opts?.reason,
      createdAt: now
    };
    this.state.auditLogs.unshift(entry);
    if (this.state.auditLogs.length > 500) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 500);
    }
  }
  addNotification(titleAr, titleEn, messageAr, messageEn, category, targetRoles, relatedView) {
    const item = {
      id: uid("not"),
      titleAr,
      titleEn,
      messageAr,
      messageEn,
      category,
      targetRoles,
      relatedView,
      isReadBy: [],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.notifications.unshift(item);
    if (this.state.notifications.length > 100) {
      this.state.notifications = this.state.notifications.slice(0, 100);
    }
  }
  // 1. Properties & Units
  createProperty(userId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_properties");
    const prop = {
      ...input,
      id: uid("prop"),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.properties.push(prop);
    this.addAudit(user, "\u0625\u0636\u0627\u0641\u0629 \u0639\u0642\u0627\u0631 \u062C\u062F\u064A\u062F", "Property", prop.id, `\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0639\u0642\u0627\u0631 ${prop.nameAr} (${prop.code})`, {
      deviceName,
      newValue: prop.status
    });
    this.persist();
    return prop;
  }
  createUnit(userId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_properties");
    const prop = this.state.properties.find((p) => p.id === input.propertyId);
    if (!prop) throw new Error("\u0627\u0644\u0639\u0642\u0627\u0631 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const duplicate = this.state.units.find(
      (u) => u.propertyId === input.propertyId && u.unitNumber.trim() === input.unitNumber.trim()
    );
    if (duplicate) throw new Error("\u0631\u0642\u0645 \u0627\u0644\u0648\u062D\u062F\u0629 \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0639\u0642\u0627\u0631");
    const unit = {
      ...input,
      id: uid("unit")
    };
    this.state.units.push(unit);
    this.addAudit(user, "\u0625\u0636\u0627\u0641\u0629 \u0648\u062D\u062F\u0629 \u062C\u062F\u064A\u062F\u0629", "Unit", unit.id, `\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0648\u062D\u062F\u0629 ${unit.unitNumber} \u0641\u064A ${prop.nameAr}`, {
      deviceName,
      newValue: unit.status
    });
    this.persist();
    return unit;
  }
  updateUnitStatus(userId, unitId, status, reason, deviceName) {
    const user = this.assertPermission(userId, "manage_properties");
    const unit = this.state.units.find((u) => u.id === unitId);
    if (!unit) throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    const hasActiveContract = this.state.contracts.some(
      (c) => c.unitId === unitId && (c.lifecycleStatus === "\u0646\u0634\u0637" || c.lifecycleStatus === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u062C\u062F\u064A\u062F")
    );
    if (status === "\u0634\u0627\u063A\u0631\u0629" && hasActiveContract) {
      throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0648\u062D\u062F\u0629 \u0625\u0644\u0649 \u0634\u0627\u063A\u0631\u0629 \u0645\u0639 \u0648\u062C\u0648\u062F \u0639\u0642\u062F \u0646\u0634\u0637\u061B \u064A\u062C\u0628 \u0625\u062A\u0645\u0627\u0645 \u0625\u062C\u0631\u0627\u0621 \u0627\u0644\u0625\u062E\u0644\u0627\u0621 \u0648\u0645\u062D\u0636\u0631 \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645 \u0623\u0648\u0644\u0627\u064B");
    }
    const oldStatus = unit.status;
    unit.status = status;
    if (status === "\u0645\u0648\u0642\u0648\u0641\u0629" || status === "\u0645\u0624\u0631\u0634\u0641\u0629") {
      unit.preArchiveStatus = oldStatus;
      unit.archivedAt = (/* @__PURE__ */ new Date()).toISOString();
      unit.archivedBy = user.id;
      unit.archiveMode = "\u062A\u0644\u0642\u0627\u0626\u064A";
      unit.archiveReason = reason || (status === "\u0645\u0624\u0631\u0634\u0641\u0629" ? "\u0623\u0631\u0634\u0641\u0629 \u0648\u062D\u062F\u0629 \u0639\u0642\u0627\u0631\u064A\u0629" : "\u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0648\u062D\u062F\u0629 \u0645\u0624\u0642\u062A\u0627\u064B");
    } else if (unit.archivedAt) {
      unit.archivedAt = void 0;
      unit.archiveReason = void 0;
      unit.archivedBy = void 0;
      unit.archiveMode = void 0;
    }
    if (status === "\u0634\u0627\u063A\u0631\u0629") {
      unit.linkedTenantId = void 0;
      unit.vacantSince = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    }
    this.addAudit(user, "\u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629 \u0648\u062D\u062F\u0629", "Unit", unit.id, `\u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0627\u0644\u0648\u062D\u062F\u0629 ${unit.unitNumber} \u0645\u0646 ${oldStatus} \u0625\u0644\u0649 ${status}`, {
      oldValue: oldStatus,
      newValue: status,
      reason,
      deviceName
    });
    this.persist();
    return unit;
  }
  linkTenantToUnit(userId, unitId, tenantId, deviceName) {
    const user = this.assertPermission(userId, "manage_tenants");
    const unit = this.state.units.find((u) => u.id === unitId);
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!unit || !tenant) throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0623\u0648 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    if (unit.status === "\u0645\u0624\u062C\u0631\u0629") throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0645\u0624\u062C\u0631\u0629 \u062D\u0627\u0644\u064A\u0627\u064B \u0628\u0639\u0642\u062F \u0633\u0627\u0631\u064A");
    const oldVal = unit.status;
    unit.linkedTenantId = tenant.id;
    if (unit.status === "\u0634\u0627\u063A\u0631\u0629" || unit.status === "\u062A\u062D\u062A\u0627\u062C \u0625\u0644\u0649 \u062A\u0646\u0638\u064A\u0641") {
      unit.status = "\u0645\u062D\u062C\u0648\u0632\u0629";
    }
    this.addAudit(
      user,
      "\u0631\u0628\u0637 \u0625\u062F\u0627\u0631\u064A \u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u0628\u0648\u062D\u062F\u0629",
      "Unit",
      unit.id,
      `\u0631\u0628\u0637 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${tenant.nameAr} \u0628\u0627\u0644\u0648\u062D\u062F\u0629 ${unit.unitNumber} \u0643\u062D\u062C\u0632 \u0625\u062F\u0627\u0631\u064A (\u062F\u0648\u0646 \u0625\u0646\u0634\u0627\u0621 \u0639\u0642\u062F \u062A\u0644\u0642\u0627\u0626\u064A)`,
      { oldValue: oldVal, newValue: unit.status, deviceName }
    );
    this.persist();
    return unit;
  }
  // 2. Tenants & Leads
  createTenant(userId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_tenants");
    const dup = this.state.tenants.find((t) => t.nationalIdOrIqama.trim() === input.nationalIdOrIqama.trim());
    if (dup) {
      throw new Error(`\u062A\u0646\u0628\u064A\u0647 \u062A\u0643\u0631\u0627\u0631: \u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064A\u0629/\u0627\u0644\u0625\u0642\u0627\u0645\u0629 \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B \u0628\u0627\u0633\u0645 ${dup.nameAr}`);
    }
    const tenant = {
      ...input,
      id: uid("ten"),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.tenants.push(tenant);
    this.addAudit(user, "\u062A\u0633\u062C\u064A\u0644 \u0645\u0633\u062A\u0623\u062C\u0631 \u062C\u062F\u064A\u062F", "Tenant", tenant.id, `\u0625\u0636\u0627\u0641\u0629 \u0645\u0644\u0641 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${tenant.nameAr}`, {
      deviceName,
      newValue: tenant.nationalIdOrIqama
    });
    this.persist();
    return tenant;
  }
  deleteTenant(userId, tenantId, deviceName) {
    const user = this.assertPermission(userId, "manage_tenants");
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error("\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const hasActiveContract = this.state.contracts.some(
      (c) => c.tenantId === tenantId && (c.lifecycleStatus === "\u0646\u0634\u0637" || c.lifecycleStatus === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0648\u062B\u064A\u0642")
    );
    if (hasActiveContract) {
      throw new Error("\u0642\u0627\u0639\u062F\u0629 \u062D\u0645\u0627\u064A\u0629: \u064A\u0648\u062C\u062F \u0639\u0642\u062F \u0646\u0634\u0637 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631\u061B \u064A\u062C\u0628 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0639\u0642\u062F \u0623\u0648\u0644\u0627\u064B \u0642\u0628\u0644 \u0627\u0644\u0623\u0631\u0634\u0641\u0629");
    }
    const prev = tenant.classification;
    tenant.preArchiveStatus = prev;
    tenant.classification = "\u0633\u0627\u0628\u0642";
    tenant.archivedAt = (/* @__PURE__ */ new Date()).toISOString();
    tenant.archivedBy = user.id;
    tenant.archiveMode = "\u064A\u062F\u0648\u064A";
    tenant.archiveReason = tenant.archiveReason || "\u0646\u0642\u0644 \u0644\u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631\u064A\u0646 \u0627\u0644\u0633\u0627\u0628\u0642\u064A\u0646";
    this.addAudit(user, "\u0646\u0642\u0644 \u0645\u0633\u062A\u0623\u062C\u0631 \u0644\u0644\u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u0630\u0643\u064A", "Tenant", tenantId, `\u0623\u0631\u0634\u0641\u0629 \u0645\u0644\u0641 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${tenant.nameAr}`, {
      oldValue: prev,
      newValue: "\u0633\u0627\u0628\u0642 (\u0645\u0624\u0631\u0634\u0641)",
      deviceName
    });
    this.persist();
  }
  createLead(userId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_contracts");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const lead = {
      ...input,
      id: uid("lead"),
      approvalState: input.approvalState || "\u0644\u0645 \u064A\u064F\u0631\u0633\u0644",
      rating: input.rating ?? 4,
      createdAt: input.createdAt || now,
      updatedAt: now,
      interactions: input.interactions || [
        {
          id: uid("lint"),
          type: "visit",
          direction: "inbound",
          summary: `\u062A\u0633\u062C\u064A\u0644 \u0645\u0647\u062A\u0645 \u062C\u062F\u064A\u062F (${input.source || "\u0625\u062F\u062E\u0627\u0644 \u064A\u062F\u0648\u064A"})`,
          actorName: user.nameAr,
          createdAt: now
        }
      ]
    };
    this.state.leads.unshift(lead);
    this.addAudit(user, "\u062A\u0633\u062C\u064A\u0644 \u0639\u0645\u064A\u0644 \u0645\u062D\u062A\u0645\u0644", "Lead", lead.id, `\u062A\u0633\u062C\u064A\u0644 \u0627\u0633\u062A\u0641\u0633\u0627\u0631/\u0645\u0639\u0627\u064A\u0646\u0629 \u0644\u0644\u0639\u0645\u064A\u0644 ${lead.nameAr}`, {
      propertyId: lead.propertyId,
      deviceName
    });
    this.persist();
    return lead;
  }
  // 3. Contracts & Installment Schedule
  createContract(userId, input, deviceName) {
    return this.runTransaction(() => {
      const user = this.assertPermission(userId, "manage_contracts");
      const unit = this.unitIndex.get(input.unitId) || this.state.units.find((u) => u.id === input.unitId);
      const tenant = this.tenantIndex.get(input.tenantId) || this.state.tenants.find((t) => t.id === input.tenantId);
      if (!unit || !tenant) throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u0623\u0648 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      const activeOnUnit = this.state.contracts.find(
        (c) => c.unitId === unit.id && (c.lifecycleStatus === "\u0646\u0634\u0637" || c.lifecycleStatus === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0648\u062B\u064A\u0642")
      );
      if (activeOnUnit) {
        throw new Error(`\u064A\u0648\u062C\u062F \u0639\u0642\u062F \u0633\u0627\u0631\u064A \u0623\u0648 \u0642\u064A\u062F \u0627\u0644\u062A\u0648\u062B\u064A\u0642 \u0628\u0627\u0644\u0641\u0639\u0644 \u0639\u0644\u0649 \u0627\u0644\u0648\u062D\u062F\u0629 ${unit.unitNumber} (${activeOnUnit.internalNumber})`);
      }
      this.state.counters.contract += 1;
      const freqMap = {
        \u0634\u0647\u0631\u064A: 12,
        "\u0631\u0628\u0639 \u0633\u0646\u0648\u064A": 4,
        "\u0646\u0635\u0641 \u0633\u0646\u0648\u064A": 2,
        \u0633\u0646\u0648\u064A: 1
      };
      const count = freqMap[input.paymentFrequency] || 2;
      const contractCurrency = input.currency || this.state.settings.baseCurrency || "SAR";
      const contract = {
        ...input,
        currency: contractCurrency,
        id: uid("ctr"),
        internalNumber: `CNT-2026-${pad3(this.state.counters.contract)}`,
        installmentsCount: count,
        version: 1,
        createdBy: user.id,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.state.contracts.unshift(contract);
      if (contract.lifecycleStatus === "\u0646\u0634\u0637") {
        unit.status = "\u0645\u0624\u062C\u0631\u0629";
        unit.linkedTenantId = void 0;
        tenant.classification = "\u0646\u0634\u0637";
      } else if (contract.lifecycleStatus === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0648\u062B\u064A\u0642") {
        unit.status = "\u0642\u064A\u062F \u0627\u0644\u062A\u0623\u062C\u064A\u0631";
        unit.linkedTenantId = tenant.id;
      }
      const start = new Date(contract.startDate);
      const perInst = Math.round(contract.annualRent / count * 100) / 100;
      const createdInstallments = [];
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      for (let i = 0; i < count; i++) {
        const due = new Date(start);
        due.setMonth(due.getMonth() + i * (12 / count));
        const dueStr = due.toISOString().slice(0, 10);
        const amt = i === count - 1 ? Math.round((contract.annualRent - perInst * (count - 1)) * 100) / 100 : perInst;
        const status = dueStr < todayStr ? "\u0645\u062A\u0623\u062E\u0631\u0629" : dueStr === todayStr ? "\u0645\u0633\u062A\u062D\u0642\u0629 \u0627\u0644\u064A\u0648\u0645" : "\u0644\u0645 \u062A\u0633\u062A\u062D\u0642";
        const inst = {
          id: uid("inst"),
          contractId: contract.id,
          unitId: contract.unitId,
          propertyId: contract.propertyId,
          tenantId: contract.tenantId,
          installmentNumber: i + 1,
          dueDate: dueStr,
          amount: amt,
          paidAmount: 0,
          remainingAmount: amt,
          currency: contractCurrency,
          status
        };
        this.state.installments.push(inst);
        createdInstallments.push(inst);
      }
      this.addAudit(
        user,
        "\u0625\u0646\u0634\u0627\u0621 \u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631",
        "LeaseContract",
        contract.id,
        `\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0639\u0642\u062F ${contract.internalNumber} \u0644\u0644\u0648\u062D\u062F\u0629 ${unit.unitNumber} (${contract.lifecycleStatus} \xB7 \u0625\u064A\u062C\u0627\u0631: ${contract.ejarStatus})`,
        { deviceName, newValue: contract.lifecycleStatus }
      );
      this.addNotification(
        `\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0639\u0642\u062F ${contract.internalNumber}`,
        `Contract ${contract.internalNumber} created`,
        `\u0627\u0644\u0648\u062D\u062F\u0629 ${unit.unitNumber} \u0644\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${tenant.nameAr} \u0628\u0642\u064A\u0645\u0629 ${contract.annualRent.toLocaleString()} \u0631.\u0633`,
        `Unit ${unit.unitNumber} for ${tenant.nameEn} (${contract.annualRent.toLocaleString()} SAR)`,
        "\u062A\u0634\u063A\u064A\u0644\u064A\u0629",
        ["gm", "accountant", "supervisor"],
        "leasing"
      );
      this.persist();
      return { contract, installments: createdInstallments };
    });
  }
  updateContractEjarStatus(userId, contractId, ejarNumber, ejarStatus, lifecycleStatus, deviceName) {
    const user = this.assertPermission(userId, "manage_contracts");
    const contract = this.state.contracts.find((c) => c.id === contractId);
    if (!contract) throw new Error("\u0627\u0644\u0639\u0642\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const oldVal = `${contract.lifecycleStatus} / ${contract.ejarStatus}`;
    const prevLifecycle = contract.lifecycleStatus;
    contract.ejarNumber = ejarNumber;
    contract.ejarStatus = ejarStatus;
    contract.lifecycleStatus = lifecycleStatus;
    contract.version += 1;
    if (lifecycleStatus === "\u0645\u0646\u062A\u0647\u064A" || lifecycleStatus === "\u0645\u0646\u062A\u0647\u064D \u0628\u0627\u0644\u0625\u062E\u0644\u0627\u0621" || lifecycleStatus === "\u0645\u0644\u063A\u064A") {
      contract.preArchiveStatus = prevLifecycle;
      contract.archivedAt = contract.archivedAt || (/* @__PURE__ */ new Date()).toISOString();
      contract.archivedBy = user.id;
      contract.archiveMode = "\u062A\u0644\u0642\u0627\u0626\u064A";
      contract.archiveReason = contract.archiveReason || `\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0639\u0642\u062F \u0625\u0644\u0649 ${lifecycleStatus}`;
    }
    const unit = this.state.units.find((u) => u.id === contract.unitId);
    if (unit && lifecycleStatus === "\u0646\u0634\u0637") {
      unit.status = "\u0645\u0624\u062C\u0631\u0629";
      unit.linkedTenantId = void 0;
    }
    this.addAudit(
      user,
      "\u062A\u062D\u062F\u064A\u062B \u062A\u0648\u062B\u064A\u0642 \u0648\u062D\u0627\u0644\u0629 \u0627\u0644\u0639\u0642\u062F",
      "LeaseContract",
      contract.id,
      `\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0639\u0642\u062F ${contract.internalNumber} (\u0627\u0644\u0625\u0635\u062F\u0627\u0631 ${contract.version}) \u0625\u0644\u0649 ${lifecycleStatus} \xB7 \u0625\u064A\u062C\u0627\u0631: ${ejarStatus}`,
      { oldValue: oldVal, newValue: `${lifecycleStatus} / ${ejarStatus}`, deviceName }
    );
    this.persist();
    return contract;
  }
  // 4. Handover / Eviction Inspection
  createHandoverInspection(userId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_properties");
    const contract = this.state.contracts.find((c) => c.id === input.contractId);
    const unit = this.state.units.find((u) => u.id === input.unitId);
    if (!contract || !unit) throw new Error("\u0627\u0644\u0639\u0642\u062F \u0623\u0648 \u0627\u0644\u0648\u062D\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    const netRefundOrDue = input.depositHeld - input.damageCost - input.unpaidRentDue;
    const handover = {
      ...input,
      id: uid("hnd"),
      inspectorId: user.id,
      netRefundOrDue,
      status: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.handovers.unshift(handover);
    this.addAudit(
      user,
      "\u0625\u0639\u062F\u0627\u062F \u0645\u062D\u0636\u0631 \u0627\u0633\u062A\u0644\u0627\u0645/\u0625\u062E\u0644\u0627\u0621",
      "HandoverInspection",
      handover.id,
      `\u0645\u062D\u0636\u0631 ${handover.type} \u0644\u0644\u0648\u062D\u062F\u0629 ${unit.unitNumber} - \u0635\u0627\u0641\u064A \u0627\u0644\u062A\u0633\u0648\u064A\u0629: ${netRefundOrDue} \u0631.\u0633`,
      { deviceName, newValue: handover.status }
    );
    this.addNotification(
      `\u0645\u062D\u0636\u0631 ${handover.type} \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F`,
      `Handover inspection awaiting approval`,
      `\u0627\u0644\u0648\u062D\u062F\u0629 ${unit.unitNumber} \u062C\u0627\u0647\u0632\u0629 \u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u062A\u0633\u0648\u064A\u0629 \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0648\u062D\u0627\u0644\u0629 \u0627\u0644\u0648\u062D\u062F\u0629`,
      `Unit ${unit.unitNumber} inspection ready for approval`,
      "\u062A\u0634\u063A\u064A\u0644\u064A\u0629",
      ["gm", "supervisor"],
      "leasing"
    );
    this.persist();
    return handover;
  }
  approveHandover(userId, handoverId, nextUnitStatus, deviceName) {
    return this.runTransaction(() => {
      const user = this.assertPermission(userId, "approve_expense_supervisor");
      const handover = this.state.handovers.find((h) => h.id === handoverId);
      if (!handover) throw new Error("\u0627\u0644\u0645\u062D\u0636\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      handover.status = "\u0645\u0639\u062A\u0645\u062F";
      handover.approvedBy = user.id;
      const unit = this.unitIndex.get(handover.unitId) || this.state.units.find((u) => u.id === handover.unitId);
      const contract = this.contractIndex.get(handover.contractId) || this.state.contracts.find((c) => c.id === handover.contractId);
      if (handover.type === "\u0625\u062E\u0644\u0627\u0621 \u0648\u0627\u0633\u062A\u0644\u0627\u0645") {
        if (contract) {
          contract.preArchiveStatus = contract.lifecycleStatus;
          contract.lifecycleStatus = "\u0645\u0646\u062A\u0647\u064D \u0628\u0627\u0644\u0625\u062E\u0644\u0627\u0621";
          contract.archivedAt = (/* @__PURE__ */ new Date()).toISOString();
          contract.archivedBy = user.id;
          contract.archiveMode = "\u062A\u0644\u0642\u0627\u0626\u064A";
          contract.archiveReason = "\u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0639\u0642\u062F \u0628\u0645\u062D\u0636\u0631 \u0625\u062E\u0644\u0627\u0621 \u0648\u0627\u0633\u062A\u0644\u0627\u0645 \u0645\u0639\u062A\u0645\u062F";
          const tenant = this.tenantIndex.get(contract.tenantId) || this.state.tenants.find((t) => t.id === contract.tenantId);
          const stillHasOtherActiveContract = this.state.contracts.some(
            (c) => c.id !== contract.id && c.tenantId === contract.tenantId && (c.lifecycleStatus === "\u0646\u0634\u0637" || c.lifecycleStatus === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0648\u062B\u064A\u0642")
          );
          if (tenant && !stillHasOtherActiveContract) {
            tenant.preArchiveStatus = tenant.classification;
            tenant.classification = "\u0633\u0627\u0628\u0642";
            tenant.archivedAt = (/* @__PURE__ */ new Date()).toISOString();
            tenant.archivedBy = user.id;
            tenant.archiveMode = "\u062A\u0644\u0642\u0627\u0626\u064A";
            tenant.archiveReason = `\u0625\u062E\u0644\u0627\u0621 \u0627\u0644\u0648\u062D\u062F\u0629 ${unit?.unitNumber || handover.unitId}`;
          }
        }
        if (unit) {
          unit.status = nextUnitStatus;
          unit.linkedTenantId = void 0;
          if (nextUnitStatus === "\u0634\u0627\u063A\u0631\u0629") {
            unit.vacantSince = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
          }
        }
      }
      this.addAudit(
        user,
        "\u0627\u0639\u062A\u0645\u0627\u062F \u0645\u062D\u0636\u0631 \u0627\u0633\u062A\u0644\u0627\u0645 \u0648\u0625\u062E\u0644\u0627\u0621",
        "HandoverInspection",
        handover.id,
        `\u0627\u0639\u062A\u0645\u0627\u062F \u0645\u062D\u0636\u0631 \u0627\u0644\u0648\u062D\u062F\u0629 ${unit?.unitNumber || handover.unitId} \u0648\u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0627\u0644\u0648\u062D\u062F\u0629 \u0625\u0644\u0649 ${nextUnitStatus}`,
        { deviceName, oldValue: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F", newValue: "\u0645\u0639\u062A\u0645\u062F" }
      );
      this.persist();
      return handover;
    });
  }
  // 5. Payments, Partial Allocation, Receipts & Reversal
  recordPayment(userId, input, deviceName) {
    return this.runTransaction(() => {
      const user = this.assertPermission(userId, "collect_payments");
      if (this.idempotencyIndex.has(input.idempotencyKey) || this.state.processedIdempotencyKeys.includes(input.idempotencyKey)) {
        const existing = this.state.payments.find((p) => p.idempotencyKey === input.idempotencyKey);
        if (existing) return existing;
      }
      const cleanRef = input.referenceNumber ? input.referenceNumber.trim() : "";
      if (cleanRef) {
        const dupRef = this.state.payments.find(
          (p) => p.contractId === input.contractId && p.referenceNumber === cleanRef && p.amount === input.amount && p.status === "\u0645\u0639\u062A\u0645\u062F"
        );
        if (dupRef) return dupRef;
      }
      if (!input.amount || input.amount <= 0) throw new Error("\u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0627\u0644\u0645\u0628\u0644\u063A \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631");
      const contract = this.contractIndex.get(input.contractId) || this.state.contracts.find((c) => c.id === input.contractId);
      if (!contract) throw new Error("\u0627\u0644\u0639\u0642\u062F \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      const property = this.propIndex.get(contract.propertyId) || this.state.properties.find((p) => p.id === contract.propertyId);
      const unit = this.unitIndex.get(contract.unitId) || this.state.units.find((u) => u.id === contract.unitId);
      const allocations = [];
      let remainingToAllocate = input.amount;
      if (input.paymentType === "\u0625\u064A\u062C\u0627\u0631") {
        const contractInstallments = this.state.installments.filter((i) => i.contractId === contract.id && i.remainingAmount > 0 && i.status !== "\u0645\u0644\u063A\u0627\u0629").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        if (input.installmentId && !input.autoAllocateOldest) {
          const target = contractInstallments.find((i) => i.id === input.installmentId);
          if (!target) throw new Error("\u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0645\u0633\u062F\u062F \u0628\u0627\u0644\u0643\u0627\u0645\u0644");
          if (input.amount > target.remainingAmount) {
            throw new Error(
              `\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u062F\u062E\u0644 (${input.amount}) \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u0645\u062A\u0628\u0642\u064A \u0639\u0644\u0649 \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 (${target.remainingAmount})\u061B \u0641\u0639\u0651\u0644 \u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u0639\u0644\u0649 \u0623\u0642\u062F\u0645 \u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0625\u0630\u0627 \u0623\u0631\u062F\u062A \u0633\u062F\u0627\u062F \u0639\u062F\u0629 \u062F\u0641\u0639\u0627\u062A.`
            );
          }
          const applied = Math.min(remainingToAllocate, target.remainingAmount);
          target.paidAmount = Math.round((target.paidAmount + applied) * 100) / 100;
          target.remainingAmount = Math.round((target.amount - target.paidAmount) * 100) / 100;
          target.lastPaymentDate = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
          target.status = target.remainingAmount === 0 ? "\u0645\u062F\u0641\u0648\u0639\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644" : "\u0645\u062F\u0641\u0648\u0639\u0629 \u062C\u0632\u0626\u064A\u0627\u064B";
          allocations.push({ installmentId: target.id, amount: applied });
          remainingToAllocate -= applied;
        } else {
          const totalOpen = contractInstallments.reduce((acc, i) => acc + i.remainingAmount, 0);
          if (contractInstallments.length > 0 && input.amount > totalOpen) {
            throw new Error(`\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u062F\u062E\u0644 \u064A\u062A\u062C\u0627\u0648\u0632 \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642\u0627\u062A \u0627\u0644\u0645\u062A\u0628\u0642\u064A\u0629 \u0639\u0644\u0649 \u0627\u0644\u0639\u0642\u062F (${totalOpen} \u0631.\u0633)`);
          }
          for (const inst of contractInstallments) {
            if (remainingToAllocate <= 0) break;
            const applied = Math.min(remainingToAllocate, inst.remainingAmount);
            inst.paidAmount = Math.round((inst.paidAmount + applied) * 100) / 100;
            inst.remainingAmount = Math.round((inst.amount - inst.paidAmount) * 100) / 100;
            inst.lastPaymentDate = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
            inst.status = inst.remainingAmount === 0 ? "\u0645\u062F\u0641\u0648\u0639\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644" : "\u0645\u062F\u0641\u0648\u0639\u0629 \u062C\u0632\u0626\u064A\u0627\u064B";
            allocations.push({ installmentId: inst.id, amount: applied });
            remainingToAllocate = Math.round((remainingToAllocate - applied) * 100) / 100;
          }
        }
      }
      this.state.counters.receipt += 1;
      const receiptNumber = `RCP-2026-${pad4(this.state.counters.receipt)}`;
      const payCurrency = contract.currency || this.state.settings.baseCurrency || "SAR";
      const amountSar = toSar(input.amount, payCurrency, this.state.settings.currencyRatesToSar);
      const payment = {
        id: uid("pay"),
        receiptNumber,
        idempotencyKey: input.idempotencyKey,
        contractId: contract.id,
        unitId: contract.unitId,
        propertyId: contract.propertyId,
        tenantId: contract.tenantId,
        allocations,
        amount: input.amount,
        currency: payCurrency,
        paymentMethod: input.paymentMethod,
        paymentType: input.paymentType,
        referenceNumber: input.referenceNumber,
        receivedBy: user.id,
        deviceName: deviceName || user.deviceName,
        status: "\u0645\u0639\u062A\u0645\u062F",
        signatureDataUrl: input.signatureDataUrl,
        notes: input.notes,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.state.payments.unshift(payment);
      this.state.processedIdempotencyKeys.push(input.idempotencyKey);
      this.idempotencyIndex.add(input.idempotencyKey);
      if (unit && unit.status === "\u0645\u062A\u0623\u062E\u0631\u0629 \u0641\u064A \u0627\u0644\u0633\u062F\u0627\u062F") {
        const stillOverdue = this.state.installments.some(
          (i) => i.unitId === unit.id && i.status === "\u0645\u062A\u0623\u062E\u0631\u0629" && i.remainingAmount > 0
        );
        if (!stillOverdue) {
          unit.status = "\u0645\u0624\u062C\u0631\u0629";
        }
      }
      this.state.counters.journal += 1;
      const debitAccountId = input.paymentMethod === "\u0646\u0642\u062F\u064A" ? "acc-1020" : "acc-1010";
      const debitAccount = this.state.accounts.find((a) => a.id === debitAccountId);
      const mgmtPct = property?.managementFeePercent ?? contract.managementCommissionPercent ?? 5;
      const mgmtFee = input.paymentType === "\u0625\u064A\u062C\u0627\u0631" ? Math.round(amountSar * (mgmtPct / 100) * 100) / 100 : 0;
      const ownerNet = Math.round((amountSar - mgmtFee) * 100) / 100;
      const lines = [{ accountId: debitAccount.id, accountName: debitAccount.nameAr, debit: amountSar, credit: 0 }];
      if (input.paymentType === "\u062A\u0623\u0645\u064A\u0646") {
        const depAcc = this.state.accounts.find((a) => a.id === "acc-2100");
        lines.push({ accountId: depAcc.id, accountName: depAcc.nameAr, debit: 0, credit: amountSar });
        depAcc.balance += amountSar;
      } else if (input.paymentType === "\u0631\u0633\u0648\u0645 \u0645\u0643\u062A\u0628 \u0648\u0633\u0639\u064A" || input.paymentType === "\u0639\u0645\u0648\u0644\u0629 \u0641\u0633\u062E") {
        const feeAcc = this.state.accounts.find((a) => a.id === "acc-4200");
        lines.push({ accountId: feeAcc.id, accountName: feeAcc.nameAr, debit: 0, credit: amountSar });
        feeAcc.balance += amountSar;
      } else {
        const ownerAcc = this.state.accounts.find((a) => a.id === "acc-2200");
        const commAcc = this.state.accounts.find((a) => a.id === "acc-4100");
        lines.push({ accountId: ownerAcc.id, accountName: ownerAcc.nameAr, debit: 0, credit: ownerNet });
        if (mgmtFee > 0) {
          lines.push({ accountId: commAcc.id, accountName: commAcc.nameAr, debit: 0, credit: mgmtFee });
          commAcc.balance += mgmtFee;
        }
        ownerAcc.balance += ownerNet;
      }
      debitAccount.balance += amountSar;
      const journal = {
        id: uid("jrn"),
        entryNumber: `JRN-2026-${pad4(this.state.counters.journal)}`,
        date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        description: `\u0633\u0646\u062F \u0642\u0628\u0636 ${receiptNumber} (${input.paymentType}) \u0644\u0644\u0648\u062D\u062F\u0629 ${unit?.unitNumber || ""} - ${input.paymentMethod}${payCurrency !== "SAR" ? ` [${input.amount} ${payCurrency}]` : ""}`,
        referenceType: "\u062A\u062D\u0635\u064A\u0644",
        referenceId: payment.id,
        propertyId: contract.propertyId,
        ownerId: property?.ownerShares[0]?.ownerId,
        createdBy: user.id,
        lines
      };
      this.state.journals.unshift(journal);
      this.addAudit(
        user,
        "\u062A\u0633\u062C\u064A\u0644 \u062F\u0641\u0639\u0629 \u0648\u0625\u0635\u062F\u0627\u0631 \u0633\u0646\u062F \u0642\u0628\u0636",
        "Payment",
        payment.id,
        `\u0625\u0635\u062F\u0627\u0631 \u0633\u0646\u062F ${receiptNumber} \u0628\u0645\u0628\u0644\u063A ${input.amount.toLocaleString()} \u0631.\u0633 \u0644\u0644\u0648\u062D\u062F\u0629 ${unit?.unitNumber || ""}`,
        { deviceName: payment.deviceName, newValue: `${input.amount} \u0631.\u0633` }
      );
      this.addNotification(
        `\u0633\u0646\u062F \u0642\u0628\u0636 \u062C\u062F\u064A\u062F ${receiptNumber}`,
        `New Receipt ${receiptNumber}`,
        `\u062A\u0645 \u062A\u062D\u0635\u064A\u0644 ${input.amount.toLocaleString()} \u0631.\u0633 \u0644\u0644\u0648\u062D\u062F\u0629 ${unit?.unitNumber || ""} \u0628\u0648\u0627\u0633\u0637\u0629 ${user.nameAr}`,
        `Collected ${input.amount.toLocaleString()} SAR for unit ${unit?.unitNumber || ""}`,
        "\u0645\u0627\u0644\u064A\u0629",
        ["gm", "accountant", "supervisor", "owner"],
        "finance"
      );
      this.persist();
      return payment;
    });
  }
  reverseReceipt(userId, paymentId, reason, deviceName) {
    return this.runTransaction(() => {
      const user = this.assertPermission(userId, "reverse_receipts");
      if (!reason || reason.trim().length < 5) {
        throw new Error("\u064A\u062C\u0628 \u0625\u062F\u062E\u0627\u0644 \u0633\u0628\u0628 \u0648\u0627\u0636\u062D \u0644\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0633\u0646\u062F \u0648\u0625\u0635\u062F\u0627\u0631 \u062D\u0631\u0643\u0629 \u0639\u0643\u0633\u064A\u0629");
      }
      const original = this.state.payments.find((p) => p.id === paymentId);
      if (!original) throw new Error("\u0627\u0644\u0633\u0646\u062F \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      if (original.status === "\u0645\u0639\u0643\u0648\u0633") throw new Error("\u0647\u0630\u0627 \u0627\u0644\u0633\u0646\u062F \u062A\u0645 \u0639\u0643\u0633\u0647 \u0645\u0633\u0628\u0642\u0627\u064B");
      original.preArchiveStatus = "\u0645\u0639\u062A\u0645\u062F";
      original.status = "\u0645\u0639\u0643\u0648\u0633";
      original.reversalReason = reason;
      original.archivedAt = (/* @__PURE__ */ new Date()).toISOString();
      original.archivedBy = user.id;
      original.archiveMode = "\u062A\u0644\u0642\u0627\u0626\u064A";
      original.archiveReason = `\u0633\u0646\u062F \u0645\u0644\u063A\u0649 \u0628\u0642\u064A\u062F \u0639\u0643\u0633\u064A: ${reason}`;
      for (const alloc of original.allocations) {
        const inst = this.state.installments.find((i) => i.id === alloc.installmentId);
        if (inst) {
          inst.paidAmount = Math.max(0, Math.round((inst.paidAmount - alloc.amount) * 100) / 100);
          inst.remainingAmount = Math.round((inst.amount - inst.paidAmount) * 100) / 100;
          const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
          if (inst.paidAmount > 0) {
            inst.status = "\u0645\u062F\u0641\u0648\u0639\u0629 \u062C\u0632\u0626\u064A\u0627\u064B";
          } else {
            inst.status = inst.dueDate < todayStr ? "\u0645\u062A\u0623\u062E\u0631\u0629" : inst.dueDate === todayStr ? "\u0645\u0633\u062A\u062D\u0642\u0629 \u0627\u0644\u064A\u0648\u0645" : "\u0644\u0645 \u062A\u0633\u062A\u062D\u0642";
          }
        }
      }
      this.state.counters.receipt += 1;
      const revReceiptNo = `REV-2026-${pad4(this.state.counters.receipt)}`;
      original.reversedByReceiptId = revReceiptNo;
      const origJournal = this.state.journals.find((j) => j.referenceId === original.id);
      if (origJournal) {
        this.state.counters.journal += 1;
        const revLines = origJournal.lines.map((l) => {
          const acc = this.state.accounts.find((a) => a.id === l.accountId);
          if (acc) {
            if (acc.type === "\u0623\u0635\u0648\u0644" || acc.type === "\u0645\u0635\u0631\u0648\u0641\u0627\u062A") {
              acc.balance += l.credit - l.debit;
            } else {
              acc.balance += l.debit - l.credit;
            }
          }
          return {
            accountId: l.accountId,
            accountName: l.accountName,
            debit: l.credit,
            credit: l.debit
          };
        });
        this.state.journals.unshift({
          id: uid("jrn"),
          entryNumber: `JRN-2026-${pad4(this.state.counters.journal)}`,
          date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
          description: `\u0642\u064A\u062F \u0639\u0643\u0633\u064A \u0644\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0633\u0646\u062F ${original.receiptNumber} (${revReceiptNo}) - \u0627\u0644\u0633\u0628\u0628: ${reason}`,
          referenceType: "\u0633\u0646\u062F \u0639\u0643\u0633\u064A",
          referenceId: original.id,
          propertyId: original.propertyId,
          createdBy: user.id,
          lines: revLines
        });
      }
      this.addAudit(
        user,
        "\u0625\u0635\u062F\u0627\u0631 \u0633\u0646\u062F \u0639\u0643\u0633\u064A \u0648\u0625\u0644\u063A\u0627\u0621 \u062A\u062D\u0635\u064A\u0644",
        "Payment",
        original.id,
        `\u0639\u0643\u0633 \u0627\u0644\u0633\u0646\u062F ${original.receiptNumber} \u0628\u0633\u0646\u062F \u0639\u0643\u0633\u064A ${revReceiptNo} \u0628\u0645\u0628\u0644\u063A ${original.amount.toLocaleString()} \u0631.\u0633`,
        { oldValue: "\u0645\u0639\u062A\u0645\u062F", newValue: "\u0645\u0639\u0643\u0648\u0633", reason, deviceName }
      );
      this.addNotification(
        `\u062D\u0631\u0643\u0629 \u0639\u0643\u0633\u064A\u0629 \u0644\u0644\u0633\u0646\u062F ${original.receiptNumber}`,
        `Receipt ${original.receiptNumber} reversed`,
        `\u0623\u0635\u062F\u0631 ${user.nameAr} \u0633\u0646\u062F\u0627\u064B \u0639\u0643\u0633\u064A\u0627\u064B (${revReceiptNo}) \u0628\u0633\u0628\u0628: ${reason}`,
        `${user.nameEn} issued reversal ${revReceiptNo}: ${reason}`,
        "\u0625\u062F\u0627\u0631\u064A\u0629",
        ["gm", "accountant"],
        "finance"
      );
      this.persist();
      return original;
    });
  }
  // 6. Expenses & Multi-Stage Approval
  createExpense(userId, input, deviceName) {
    const user = this.assertPermission(userId, "create_expense");
    const { isDraft, ...restInput } = input;
    const dupInvoice = this.state.expenses.find(
      (e) => e.invoiceNumber.trim() && e.invoiceNumber.trim().toLowerCase() === restInput.invoiceNumber.trim().toLowerCase() && (e.vendorId || "") === (restInput.vendorId || "") && e.approvalStatus !== "\u0645\u0631\u0641\u0648\u0636" && e.approvalStatus !== "\u0645\u0644\u063A\u0649"
    );
    if (dupInvoice) {
      throw new Error(`\u062A\u0646\u0628\u064A\u0647: \u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 ${restInput.invoiceNumber} \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B (${dupInvoice.expenseNumber})`);
    }
    const expCurrency = restInput.currency || this.state.settings.baseCurrency || "SAR";
    const amountSar = toSar(restInput.amount, expCurrency, this.state.settings.currencyRatesToSar);
    const expMonth = (restInput.date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)).slice(0, 7);
    const budget = (this.state.propertyBudgets || []).find(
      (b) => b.propertyId === restInput.propertyId && b.month === expMonth
    );
    if (budget && budget.monthlyLimitSar > 0 && !isDraft) {
      const spentSoFar = this.state.expenses.filter(
        (e) => e.propertyId === restInput.propertyId && e.date.startsWith(expMonth) && e.approvalStatus !== "\u0645\u0631\u0641\u0648\u0636" && e.approvalStatus !== "\u0645\u0644\u063A\u0649"
      ).reduce((s, e) => s + toSar(e.amount, e.currency || "SAR", this.state.settings.currencyRatesToSar), 0);
      const nextTotal = spentSoFar + amountSar;
      if (budget.blockAt100Percent && nextTotal > budget.monthlyLimitSar && user.role !== "gm" && user.role !== "sys_owner") {
        throw new Error(
          `\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u0645\u064A\u0632\u0627\u0646\u064A\u0629 \u0627\u0644\u0634\u0647\u0631\u064A\u0629 \u0644\u0644\u0639\u0642\u0627\u0631 (${budget.monthlyLimitSar.toLocaleString()} \u0631.\u0633): \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0627\u0644\u062D\u0627\u0644\u064A \u0633\u064A\u0635\u0644 \u0628\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A \u0625\u0644\u0649 ${Math.round(nextTotal).toLocaleString()} \u0631.\u0633. \u064A\u062A\u0637\u0644\u0628 \u0627\u0633\u062A\u062B\u0646\u0627\u0621 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645.`
        );
      }
      const pct = Math.round(nextTotal / budget.monthlyLimitSar * 100);
      if (pct >= (budget.alertThresholdPercent || 80)) {
        const prop = this.state.properties.find((p) => p.id === restInput.propertyId);
        this.addNotification(
          `\u062A\u0646\u0628\u064A\u0647 \u0645\u064A\u0632\u0627\u0646\u064A\u0629 ${prop?.nameAr || restInput.propertyId} (${pct}%)`,
          `Budget Alert (${pct}%)`,
          `\u0648\u0635\u0644 \u0625\u062C\u0645\u0627\u0644\u064A \u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0634\u0647\u0631 ${expMonth} \u0625\u0644\u0649 ${Math.round(nextTotal).toLocaleString()} \u0645\u0646 \u0623\u0635\u0644 ${budget.monthlyLimitSar.toLocaleString()} \u0631.\u0633`,
          `Monthly spending reached ${pct}% of limit`,
          "\u0645\u0627\u0644\u064A\u0629",
          ["gm", "sys_owner", "accountant", "supervisor"],
          "accounting"
        );
      }
    }
    const vatAmount = restInput.vatAmount !== void 0 ? restInput.vatAmount : Math.round((restInput.amount - restInput.amount / 1.15) * 100) / 100;
    const netAmount = restInput.netAmount !== void 0 ? restInput.netAmount : Math.round((restInput.amount - vatAmount) * 100) / 100;
    const paymentStatus = restInput.paymentStatus || (restInput.paymentMethod === "\u0622\u062C\u0644" ? "\u0644\u0645 \u064A\u064F\u062F\u0641\u0639" : "\u0644\u0645 \u064A\u064F\u062F\u0641\u0639");
    const paidAmount = restInput.paidAmount !== void 0 ? restInput.paidAmount : paymentStatus === "\u0645\u062F\u0641\u0648\u0639 \u0628\u0627\u0644\u0643\u0627\u0645\u0644" ? restInput.amount : 0;
    const remainingAmount = Math.max(0, Math.round((restInput.amount - paidAmount) * 100) / 100);
    this.state.counters.expense += 1;
    const expense = {
      ...restInput,
      vatAmount,
      netAmount,
      paymentStatus,
      paidAmount,
      remainingAmount,
      currency: expCurrency,
      id: uid("exp"),
      expenseNumber: `EXP-2026-${pad4(this.state.counters.expense)}`,
      approvalStatus: isDraft ? "\u0645\u0633\u0648\u062F\u0629" : "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0634\u0631\u0641",
      createdBy: user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.expenses.unshift(expense);
    if (restInput.ticketId && !isDraft) {
      const tkt = this.state.tickets.find((t) => t.id === restInput.ticketId);
      if (tkt) {
        tkt.linkedExpenseId = expense.id;
        tkt.actualCost = expense.amount;
        tkt.status = "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u062A\u0643\u0644\u0641\u0629";
        tkt.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      }
    }
    this.addAudit(
      user,
      isDraft ? "\u062D\u0641\u0638 \u0645\u0633\u0648\u062F\u0629 \u0645\u0635\u0631\u0648\u0641" : "\u062A\u0633\u062C\u064A\u0644 \u0645\u0635\u0631\u0648\u0641 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F",
      "Expense",
      expense.id,
      `${isDraft ? "\u0645\u0633\u0648\u062F\u0629" : "\u0631\u0641\u0639"} \u0627\u0644\u0645\u0635\u0631\u0648\u0641 ${expense.expenseNumber} \u0628\u0645\u0628\u0644\u063A ${expense.amount.toLocaleString()} \u0631.\u0633 (${expense.category})`,
      { deviceName, propertyId: expense.propertyId, newValue: expense.approvalStatus }
    );
    if (!isDraft) {
      this.addNotification(
        `\u0645\u0635\u0631\u0648\u0641 \u062C\u062F\u064A\u062F ${expense.expenseNumber} \u064A\u0646\u062A\u0638\u0631 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629`,
        `New expense ${expense.expenseNumber} pending`,
        `\u0645\u0628\u0644\u063A ${expense.amount.toLocaleString()} \u0631.\u0633 - ${expense.category}`,
        `${expense.amount.toLocaleString()} SAR - ${expense.category}`,
        "\u0645\u0627\u0644\u064A\u0629",
        ["supervisor", "maint_manager", "gm"],
        "accounting"
      );
    }
    this.persist();
    return expense;
  }
  postExpenseJournal(user, expense) {
    const expCurrency = expense.currency || "SAR";
    const expAmountSar = toSar(expense.amount, expCurrency, this.state.settings.currencyRatesToSar);
    this.state.counters.journal += 1;
    const isMaint = expense.category === "\u0635\u064A\u0627\u0646\u0629" || expense.category === "\u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0627\u0644\u0635\u064A\u0627\u0646\u0629";
    const expAccId = isMaint ? "acc-5100" : "acc-5200";
    const expAcc = this.state.accounts.find((a) => a.id === expAccId);
    const creditAccId = expense.bearer === "\u0627\u0644\u0645\u0627\u0644\u0643" ? "acc-2200" : expense.paymentMethod === "\u0646\u0642\u062F\u064A" ? "acc-1020" : expense.paymentMethod === "\u0622\u062C\u0644" ? "acc-2300" : "acc-1010";
    const creditAcc = this.state.accounts.find((a) => a.id === creditAccId);
    if (expense.bearer === "\u0627\u0644\u0645\u0627\u0644\u0643") {
      const bankAcc = this.state.accounts.find((a) => a.id === "acc-1010");
      const ownerAcc = this.state.accounts.find((a) => a.id === "acc-2200");
      ownerAcc.balance -= expAmountSar;
      bankAcc.balance -= expAmountSar;
      this.state.journals.unshift({
        id: uid("jrn"),
        entryNumber: `JRN-2026-${pad4(this.state.counters.journal)}`,
        date: expense.date,
        description: `\u0627\u0639\u062A\u0645\u0627\u062F \u0645\u0635\u0631\u0648\u0641 ${expense.expenseNumber} (${expense.category}) \u0645\u062D\u0645\u0644 \u0639\u0644\u0649 \u0627\u0644\u0645\u0627\u0644\u0643${expCurrency !== "SAR" ? ` [${expense.amount} ${expCurrency}]` : ""}`,
        referenceType: "\u0645\u0635\u0631\u0648\u0641",
        referenceId: expense.id,
        propertyId: expense.propertyId,
        createdBy: user.id,
        lines: [
          { accountId: ownerAcc.id, accountName: ownerAcc.nameAr, debit: expAmountSar, credit: 0 },
          { accountId: bankAcc.id, accountName: bankAcc.nameAr, debit: 0, credit: expAmountSar }
        ]
      });
    } else {
      expAcc.balance += expAmountSar;
      creditAcc.balance -= expAmountSar;
      this.state.journals.unshift({
        id: uid("jrn"),
        entryNumber: `JRN-2026-${pad4(this.state.counters.journal)}`,
        date: expense.date,
        description: `\u0627\u0639\u062A\u0645\u0627\u062F \u0645\u0635\u0631\u0648\u0641 ${expense.expenseNumber} (${expense.category}) \u0639\u0644\u0649 \u062D\u0633\u0627\u0628 ${expense.bearer}${expCurrency !== "SAR" ? ` [${expense.amount} ${expCurrency}]` : ""}`,
        referenceType: "\u0645\u0635\u0631\u0648\u0641",
        referenceId: expense.id,
        propertyId: expense.propertyId,
        createdBy: user.id,
        lines: [
          { accountId: expAcc.id, accountName: expAcc.nameAr, debit: expAmountSar, credit: 0 },
          { accountId: creditAcc.id, accountName: creditAcc.nameAr, debit: 0, credit: expAmountSar }
        ]
      });
    }
    if (expense.registerAsAsset && expense.unitId) {
      this.state.assets.unshift({
        id: uid("ast"),
        propertyId: expense.propertyId,
        unitId: expense.unitId,
        name: expense.subCategory || expense.notes || `\u0623\u0635\u0644 \u0631\u0623\u0633\u0645\u0627\u0644\u064A ${expense.expenseNumber}`,
        category: "\u0623\u0635\u0648\u0644 \u0648\u0645\u0639\u062F\u0627\u062A \u0631\u0623\u0633\u0645\u0627\u0644\u064A\u0629",
        serialNumber: expense.invoiceNumber || expense.expenseNumber,
        brand: this.state.vendors.find((v) => v.id === expense.vendorId)?.nameAr || "\u062A\u0648\u0631\u064A\u062F \u0645\u0628\u0627\u0634\u0631",
        purchaseDate: expense.date,
        warrantyExpiry: `${Number(expense.date.slice(0, 4)) + 2}${expense.date.slice(4)}`,
        condition: "\u0645\u0645\u062A\u0627\u0632"
      });
    }
    if (expense.ticketId) {
      const tkt = this.state.tickets.find((t) => t.id === expense.ticketId);
      if (tkt) {
        if (expense.paymentStatus === "\u0645\u062F\u0641\u0648\u0639 \u0628\u0627\u0644\u0643\u0627\u0645\u0644") {
          tkt.status = "\u0645\u0643\u062A\u0645\u0644";
        } else if (tkt.status === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u062A\u0643\u0644\u0641\u0629") {
          tkt.status = "\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630";
        }
        tkt.actualCost = expense.amount;
        tkt.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      }
    }
  }
  decideExpense(userId, expenseId, decision, reason, deviceName) {
    return this.runTransaction(() => {
      const user = this.getActingUser(userId);
      const expense = this.state.expenses.find((e) => e.id === expenseId);
      if (!expense) throw new Error("\u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      if (expense.approvalStatus === "\u0645\u0639\u062A\u0645\u062F" || expense.approvalStatus === "\u0645\u0631\u0641\u0648\u0636" || expense.approvalStatus === "\u0645\u0644\u063A\u0649") {
        throw new Error("\u062A\u0645 \u062D\u0633\u0645 \u0647\u0630\u0627 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0645\u0633\u0628\u0642\u0627\u064B");
      }
      const oldStatus = expense.approvalStatus;
      if (decision === "submit") {
        if (expense.approvalStatus !== "\u0645\u0633\u0648\u062F\u0629") throw new Error("\u064A\u0645\u0643\u0646 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0645\u0633\u0648\u062F\u0627\u062A \u0641\u0642\u0637 \u0644\u0644\u0627\u0639\u062A\u0645\u0627\u062F");
        expense.approvalStatus = "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0634\u0631\u0641";
        this.addAudit(user, "\u0625\u0631\u0633\u0627\u0644 \u0645\u0633\u0648\u062F\u0629 \u0645\u0635\u0631\u0648\u0641 \u0644\u0644\u0627\u0639\u062A\u0645\u0627\u062F", "Expense", expense.id, `\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 ${expense.expenseNumber} \u0644\u0644\u0627\u0639\u062A\u0645\u0627\u062F`, {
          oldValue: oldStatus,
          newValue: expense.approvalStatus,
          propertyId: expense.propertyId,
          deviceName
        });
        this.persist();
        return expense;
      }
      if (decision === "approve" && expense.createdBy === user.id && user.role !== "gm" && user.role !== "sys_owner") {
        throw new Error("\u0627\u0644\u0641\u0635\u0644 \u0628\u064A\u0646 \u0627\u0644\u0645\u0647\u0627\u0645: \u0644\u0627 \u064A\u0645\u0643\u0646 \u0644\u0644\u0645\u0648\u0638\u0641 \u0627\u0639\u062A\u0645\u0627\u062F \u0645\u0635\u0631\u0648\u0641 \u0642\u0627\u0645 \u0628\u0631\u0641\u0639\u0647 \u0628\u0646\u0641\u0633\u0647");
      }
      if (decision === "reject") {
        if (!reason) throw new Error("\u064A\u062C\u0628 \u0630\u0643\u0631 \u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636");
        this.assertPermission(userId, "approve_expense_supervisor");
        expense.approvalStatus = "\u0645\u0631\u0641\u0648\u0636";
        expense.rejectionReason = reason;
        this.addAudit(user, "\u0631\u0641\u0636 \u0645\u0635\u0631\u0648\u0641", "Expense", expense.id, `\u0631\u0641\u0636 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 ${expense.expenseNumber}`, {
          oldValue: oldStatus,
          newValue: "\u0645\u0631\u0641\u0648\u0636",
          reason,
          propertyId: expense.propertyId,
          deviceName
        });
        this.persist();
        return expense;
      }
      const expAmountSar = toSar(expense.amount, expense.currency || "SAR", this.state.settings.currencyRatesToSar);
      const isTopExec = user.role === "gm" || user.role === "sys_owner";
      if (expense.approvalStatus === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0634\u0631\u0641") {
        if (isTopExec) {
          this.assertPermission(userId, "approve_expense_manager");
          expense.approvedBySupervisor = user.id;
          expense.approvedByDeptManager = user.id;
          expense.approvedByManager = user.id;
          expense.approvalStatus = expAmountSar > 2e4 ? "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0627\u0644\u0643" : "\u0645\u0639\u062A\u0645\u062F";
        } else {
          this.assertPermission(userId, "approve_expense_supervisor");
          expense.approvedBySupervisor = user.id;
          if (expAmountSar < 1e3) {
            expense.approvalStatus = "\u0645\u0639\u062A\u0645\u062F";
          } else if (expAmountSar <= 5e3) {
            expense.approvalStatus = user.role === "maint_manager" ? "\u0645\u0639\u062A\u0645\u062F" : "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0645\u062F\u064A\u0631 \u0627\u0644\u0642\u0633\u0645";
            if (user.role === "maint_manager") expense.approvedByDeptManager = user.id;
          } else {
            expense.approvalStatus = "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u062F\u064A\u0631";
          }
        }
      } else if (expense.approvalStatus === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0645\u062F\u064A\u0631 \u0627\u0644\u0642\u0633\u0645") {
        if (isTopExec) {
          this.assertPermission(userId, "approve_expense_manager");
          expense.approvedByDeptManager = user.id;
          expense.approvedByManager = user.id;
          expense.approvalStatus = expAmountSar > 2e4 ? "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0627\u0644\u0643" : "\u0645\u0639\u062A\u0645\u062F";
        } else {
          this.assertPermission(userId, "approve_expense_supervisor");
          expense.approvedByDeptManager = user.id;
          expense.approvalStatus = expAmountSar > 5e3 ? "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u062F\u064A\u0631" : "\u0645\u0639\u062A\u0645\u062F";
        }
      } else if (expense.approvalStatus === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u062F\u064A\u0631") {
        this.assertPermission(userId, "approve_expense_manager");
        expense.approvedByManager = user.id;
        expense.approvalStatus = expAmountSar > 2e4 ? "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0627\u0644\u0643" : "\u0645\u0639\u062A\u0645\u062F";
      } else if (expense.approvalStatus === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0627\u0644\u0643") {
        if (user.role !== "owner" && user.role !== "sys_owner" && user.role !== "gm") {
          throw new Error("\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0646\u0647\u0627\u0626\u064A\u0629 \u0644\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0641\u0648\u0642 20,000 \u0631.\u0633 \u0645\u062E\u0635\u0635\u0629 \u0644\u0644\u0645\u0627\u0644\u0643 \u0623\u0648 \u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645");
        }
        expense.approvedByOwner = user.id;
        expense.approvalStatus = "\u0645\u0639\u062A\u0645\u062F";
      }
      if (expense.approvalStatus === "\u0645\u0639\u062A\u0645\u062F") {
        this.postExpenseJournal(user, expense);
      }
      this.addAudit(
        user,
        "\u0627\u0639\u062A\u0645\u0627\u062F \u0645\u0635\u0631\u0648\u0641",
        "Expense",
        expense.id,
        `\u062A\u062D\u062F\u064A\u062B \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0645\u0635\u0631\u0648\u0641 ${expense.expenseNumber} \u0645\u0646 ${oldStatus} \u0625\u0644\u0649 ${expense.approvalStatus}`,
        { oldValue: oldStatus, newValue: expense.approvalStatus, propertyId: expense.propertyId, deviceName }
      );
      this.persist();
      return expense;
    });
  }
  // 7. Maintenance Tickets & Tasks
  createTicket(userId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_maintenance");
    this.state.counters.ticket += 1;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const { createLinkedTask, ...ticketData } = input;
    const ticket = {
      ...ticketData,
      id: uid("tkt"),
      ticketNumber: `MNT-2026-${pad3(this.state.counters.ticket)}`,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now
    };
    if (createLinkedTask !== false) {
      const task = {
        id: uid("tsk"),
        title: `\u062A\u0646\u0641\u064A\u0630 \u0635\u064A\u0627\u0646\u0629 ${ticket.ticketNumber}: ${ticket.title}`,
        description: ticket.description,
        type: "\u0635\u064A\u0627\u0646\u0629",
        propertyId: ticket.propertyId,
        unitId: ticket.unitId,
        assignedTo: ticket.assignedTo || "usr-tech",
        createdBy: user.id,
        dueDate: ticket.scheduledDate || new Date(Date.now() + 864e5 * 2).toISOString().slice(0, 10),
        priority: ticket.priority,
        status: ticket.assignedTo ? "\u0645\u0633\u0646\u062F\u0629" : "\u062C\u062F\u064A\u062F\u0629",
        checklist: [
          { text: "\u0645\u0639\u0627\u064A\u0646\u0629 \u0627\u0644\u0639\u0637\u0644 \u0648\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062A\u0634\u062E\u064A\u0635", done: false },
          { text: "\u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0625\u0635\u0644\u0627\u062D \u0648\u062A\u0648\u062B\u064A\u0642 \u0635\u0648\u0631 \u0642\u0628\u0644 \u0648\u0628\u0639\u062F", done: false }
        ],
        comments: [],
        linkedTicketId: ticket.id,
        createdAt: now
      };
      this.state.tasks.unshift(task);
      ticket.linkedTaskId = task.id;
    }
    this.state.tickets.unshift(ticket);
    this.addAudit(
      user,
      "\u0641\u062A\u062D \u0628\u0644\u0627\u063A \u0635\u064A\u0627\u0646\u0629",
      "MaintenanceTicket",
      ticket.id,
      `\u0641\u062A\u062D \u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber}: ${ticket.title} (\u0627\u0644\u0623\u0648\u0644\u0648\u064A\u0629: ${ticket.priority})`,
      { deviceName, newValue: ticket.status }
    );
    this.addNotification(
      `\u0628\u0644\u0627\u063A \u0635\u064A\u0627\u0646\u0629 ${ticket.priority}: ${ticket.ticketNumber}`,
      `Maintenance ticket ${ticket.ticketNumber}`,
      ticket.title,
      ticket.title,
      "\u062A\u0634\u063A\u064A\u0644\u064A\u0629",
      ["supervisor", "technician", "gm"],
      "maintenance"
    );
    this.persist();
    return ticket;
  }
  updateTicket(userId, ticketId, patch, deviceName) {
    const user = this.assertPermission(userId, "execute_maintenance");
    const ticket = this.state.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error("\u0628\u0644\u0627\u063A \u0627\u0644\u0635\u064A\u0627\u0646\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const oldStatus = ticket.status;
    Object.assign(ticket, patch, { updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
    if (patch.status === "\u0645\u0643\u062A\u0645\u0644" || patch.status === "\u0645\u063A\u0644\u0642") {
      ticket.preArchiveStatus = oldStatus;
      ticket.archivedAt = ticket.archivedAt || (/* @__PURE__ */ new Date()).toISOString();
      ticket.archivedBy = user.id;
      ticket.archiveMode = "\u062A\u0644\u0642\u0627\u0626\u064A";
      ticket.archiveReason = ticket.archiveReason || `\u0625\u063A\u0644\u0627\u0642 \u0628\u0644\u0627\u063A \u0627\u0644\u0635\u064A\u0627\u0646\u0629 (${patch.status})`;
    }
    if (ticket.linkedTaskId && (patch.status === "\u0645\u0643\u062A\u0645\u0644" || patch.status === "\u0645\u063A\u0644\u0642")) {
      const tsk = this.state.tasks.find((t) => t.id === ticket.linkedTaskId);
      if (tsk) {
        tsk.preArchiveStatus = tsk.status;
        tsk.status = "\u0645\u0643\u062A\u0645\u0644\u0629";
        tsk.archivedAt = tsk.archivedAt || (/* @__PURE__ */ new Date()).toISOString();
        tsk.archivedBy = user.id;
        tsk.archiveMode = "\u062A\u0644\u0642\u0627\u0626\u064A";
        tsk.archiveReason = `\u0627\u0643\u062A\u0645\u0644 \u0627\u0644\u0628\u0644\u0627\u063A \u0627\u0644\u0645\u0631\u062A\u0628\u0637 ${ticket.ticketNumber}`;
      }
    }
    this.addAudit(
      user,
      "\u062A\u062D\u062F\u064A\u062B \u0628\u0644\u0627\u063A \u0635\u064A\u0627\u0646\u0629",
      "MaintenanceTicket",
      ticket.id,
      `\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0628\u0644\u0627\u063A ${ticket.ticketNumber} \u0625\u0644\u0649 ${ticket.status}`,
      { oldValue: oldStatus, newValue: ticket.status, deviceName }
    );
    this.persist();
    return ticket;
  }
  pickSmartAssignee(taskType, propertyId) {
    const typeLower = taskType.toLowerCase();
    const preferredRoles = typeLower.includes("\u0635\u064A\u0627\u0646\u0629") || typeLower.includes("\u062A\u0643\u064A\u064A\u0641") || typeLower.includes("\u0633\u0628\u0627\u0643\u0629") ? ["technician", "maint_manager", "supervisor"] : typeLower.includes("\u062A\u0623\u062C\u064A\u0631") || typeLower.includes("\u0639\u0642\u062F") || typeLower.includes("\u0645\u0639\u0627\u064A\u0646\u0629") ? ["leasing", "supervisor", "receptionist"] : typeLower.includes("\u0645\u0627\u0644\u064A") || typeLower.includes("\u062A\u062D\u0635\u064A\u0644") || typeLower.includes("\u0641\u0627\u062A\u0648\u0631\u0629") ? ["accountant", "gm"] : typeLower.includes("\u062A\u0633\u0644\u064A\u0645") || typeLower.includes("\u0625\u062E\u0644\u0627\u0621") || typeLower.includes("\u0627\u0633\u062A\u0644\u0627\u0645") ? ["supervisor", "leasing"] : ["supervisor", "leasing", "receptionist", "gm"];
    const candidates = this.state.users.filter((u) => {
      if (!u.active || u.role === "owner" || u.role === "auditor") return false;
      if (u.statusState === "\u063A\u064A\u0631 \u0645\u062A\u0635\u0644") return false;
      if (propertyId && Array.isArray(u.allowedPropertyIds) && u.allowedPropertyIds.length > 0) {
        if (!u.allowedPropertyIds.includes(propertyId)) return false;
      }
      return true;
    });
    if (candidates.length === 0) {
      return { reason: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u0648\u0638\u0641 \u0645\u062A\u0635\u0644 \u0645\u062A\u0627\u062D \u062D\u0627\u0644\u064A\u0627\u064B \u2014 \u062A\u0645 \u0627\u0644\u062D\u0641\u0638 \u0641\u064A \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631" };
    }
    const activeLoad = (uidStr) => this.state.tasks.filter((t) => t.assignedTo === uidStr && t.status !== "\u0645\u0643\u062A\u0645\u0644\u0629" && !t.archivedAt).length;
    const scored = candidates.map((u) => {
      const roleIdx = preferredRoles.indexOf(u.role);
      const roleScore = roleIdx === -1 ? 10 : roleIdx * 20;
      const loadScore = activeLoad(u.id) * 15;
      const statusScore = u.statusState === "\u0645\u0634\u063A\u0648\u0644" ? 25 : 0;
      return { user: u, score: roleScore + loadScore + statusScore, load: activeLoad(u.id) };
    }).sort((a, b) => a.score - b.score);
    const best = scored[0];
    return {
      user: best.user,
      reason: `\u0625\u0633\u0646\u0627\u062F \u0630\u0643\u064A \u0644\u0640 ${best.user.nameAr} (${best.user.roleLabelAr}) \xB7 \u0639\u0628\u0621 \u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u062D\u0627\u0644\u064A: ${best.load} \u0645\u0647\u0627\u0645`
    };
  }
  createTask(userId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_tasks");
    const { autoAssignSmart, ...rawInput } = input;
    let finalAssignee = rawInput.assignedTo;
    let isQueued = false;
    let smartReason;
    if (autoAssignSmart || !finalAssignee) {
      const picked = this.pickSmartAssignee(rawInput.type, rawInput.propertyId);
      if (picked.user) {
        finalAssignee = picked.user.id;
        smartReason = picked.reason;
      } else {
        finalAssignee = "";
        isQueued = true;
        smartReason = picked.reason;
      }
    }
    const task = {
      ...rawInput,
      assignedTo: finalAssignee,
      status: isQueued ? "\u062C\u062F\u064A\u062F\u0629" : rawInput.status || (finalAssignee ? "\u0645\u0633\u0646\u062F\u0629" : "\u062C\u062F\u064A\u062F\u0629"),
      isQueued,
      smartAssignedReason: smartReason,
      id: uid("tsk"),
      createdBy: user.id,
      comments: [],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.tasks.unshift(task);
    this.addAudit(
      user,
      isQueued ? "\u0625\u0636\u0627\u0641\u0629 \u0645\u0647\u0645\u0629 \u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631" : "\u0625\u0646\u0634\u0627\u0621 \u0648\u0625\u0633\u0646\u0627\u062F \u0645\u0647\u0645\u0629 \u0641\u0631\u064A\u0642",
      "TaskItem",
      task.id,
      `\u0625\u0633\u0646\u0627\u062F \u0645\u0647\u0645\u0629 "${task.title}"${smartReason ? ` (${smartReason})` : ""}`,
      {
        deviceName,
        propertyId: task.propertyId,
        newValue: task.status
      }
    );
    if (isQueued) {
      this.addNotification(
        `\u0645\u0647\u0645\u0629 \u0641\u064A \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631: ${task.title}`,
        `Queued Task: ${task.title}`,
        `\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0645\u0648\u0638\u0641 \u0645\u062A\u0627\u062D \u062D\u0627\u0644\u064A\u0627\u064B\u060C \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0648\u062C\u064A\u0647 \u0627\u0644\u0645\u062F\u064A\u0631.`,
        `No eligible staff available right now; task placed in queue.`,
        "\u062A\u0634\u063A\u064A\u0644\u064A\u0629",
        ["gm", "sys_owner", "supervisor", "maint_manager"],
        "team"
      );
    } else if (finalAssignee) {
      const targetUser = this.state.users.find((u) => u.id === finalAssignee);
      if (targetUser) {
        this.addNotification(
          task.priority === "\u0639\u0627\u062C\u0644" ? `\u0645\u0647\u0645\u0629 \u0639\u0627\u062C\u0644\u0629: ${task.title}` : `\u0645\u0647\u0645\u0629 \u062C\u062F\u064A\u062F\u0629 \u0645\u0633\u0646\u062F\u0629: ${task.title}`,
          `New task assigned: ${task.title}`,
          `\u062A\u0645 \u0625\u0633\u0646\u0627\u062F \u0645\u0647\u0645\u0629 (${task.type}) \u0625\u0644\u0649 ${targetUser.nameAr} \u2014 \u0627\u0644\u0645\u0648\u0639\u062F \u0627\u0644\u0646\u0647\u0627\u0626\u064A: ${task.dueDate}`,
          `Assigned to ${targetUser.nameEn} \xB7 Due: ${task.dueDate}`,
          "\u062A\u0634\u063A\u064A\u0644\u064A\u0629",
          [targetUser.role, "supervisor", "gm"],
          "team"
        );
      }
    }
    this.persist();
    return task;
  }
  updateTask(userId, taskId, patch, deviceName) {
    const user = this.assertPermission(userId, "manage_tasks");
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error("\u0627\u0644\u0645\u0647\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    const oldStatus = task.status;
    if (patch.status) {
      task.status = patch.status;
      if (patch.status === "\u0645\u0643\u062A\u0645\u0644\u0629") {
        task.completedAt = task.completedAt || (/* @__PURE__ */ new Date()).toISOString();
        task.preArchiveStatus = oldStatus;
        task.archivedAt = task.archivedAt || (/* @__PURE__ */ new Date()).toISOString();
        task.archivedBy = user.id;
        task.archiveMode = "\u062A\u0644\u0642\u0627\u0626\u064A";
        task.archiveReason = task.archiveReason || "\u0625\u0646\u062C\u0627\u0632 \u0627\u0644\u0645\u0647\u0645\u0629 \u0628\u0646\u062C\u0627\u062D";
      }
    }
    if (patch.checklist) task.checklist = patch.checklist;
    if (patch.actualHours !== void 0) task.actualHours = patch.actualHours;
    if (patch.photoNotes) task.photoNotes = patch.photoNotes;
    if (patch.assignedTo !== void 0) {
      task.assignedTo = patch.assignedTo;
      if (patch.assignedTo) task.isQueued = false;
    }
    if (patch.commentText) {
      task.comments.push({
        id: uid("cmt"),
        authorName: user.nameAr,
        text: patch.commentText,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      const assignee = this.state.users.find((u) => u.id === task.assignedTo);
      if (assignee && assignee.id !== user.id) {
        this.addNotification(
          `\u062A\u0639\u0644\u064A\u0642 \u062C\u062F\u064A\u062F \u0639\u0644\u0649 \u0645\u0647\u0645\u0629: ${task.title}`,
          `Comment on task: ${task.title}`,
          `${user.nameAr} \u0623\u0636\u0627\u0641 \u062A\u0639\u0644\u064A\u0642\u0627\u064B: "${patch.commentText}"`,
          `${user.nameEn} commented: "${patch.commentText}"`,
          "\u062A\u0634\u063A\u064A\u0644\u064A\u0629",
          [assignee.role],
          "team"
        );
      }
    }
    this.addAudit(user, "\u062A\u062D\u062F\u064A\u062B \u0645\u0647\u0645\u0629", "TaskItem", task.id, `\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0647\u0645\u0629 "${task.title}" (${task.status})`, {
      oldValue: oldStatus,
      newValue: task.status,
      propertyId: task.propertyId,
      deviceName
    });
    this.persist();
    return task;
  }
  reassignTask(userId, taskId, newAssigneeId, reason, deviceName) {
    const user = this.assertPermission(userId, "manage_tasks");
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error("\u0627\u0644\u0645\u0647\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    const targetUser = this.state.users.find((u) => u.id === newAssigneeId && u.active);
    if (!targetUser) throw new Error("\u0627\u0644\u0645\u0648\u0638\u0641 \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D");
    const prevAssignee = this.state.users.find((u) => u.id === task.assignedTo);
    task.assignedTo = targetUser.id;
    task.isQueued = false;
    if (task.status === "\u062C\u062F\u064A\u062F\u0629") task.status = "\u0645\u0633\u0646\u062F\u0629";
    task.smartAssignedReason = `\u0625\u0639\u0627\u062F\u0629 \u0625\u0633\u0646\u0627\u062F \u064A\u062F\u0648\u064A\u0629 \u0625\u0644\u0649 ${targetUser.nameAr}${reason ? ` \xB7 ${reason}` : ""}`;
    this.addAudit(
      user,
      "\u0625\u0639\u0627\u062F\u0629 \u0625\u0633\u0646\u0627\u062F \u0645\u0647\u0645\u0629",
      "TaskItem",
      task.id,
      `\u0625\u0639\u0627\u062F\u0629 \u0625\u0633\u0646\u0627\u062F \u0627\u0644\u0645\u0647\u0645\u0629 "${task.title}" \u0625\u0644\u0649 ${targetUser.nameAr}`,
      {
        oldValue: prevAssignee?.nameAr || "\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631",
        newValue: targetUser.nameAr,
        reason,
        propertyId: task.propertyId,
        deviceName
      }
    );
    this.addNotification(
      `\u0625\u0639\u0627\u062F\u0629 \u0625\u0633\u0646\u0627\u062F \u0645\u0647\u0645\u0629 \u0625\u0644\u064A\u0643: ${task.title}`,
      `Task reassigned to you: ${task.title}`,
      `\u0623\u064F\u0633\u0646\u062F\u062A \u0627\u0644\u0645\u0647\u0645\u0629 \u0625\u0644\u0649 ${targetUser.nameAr} \u0645\u0646 \u0642\u0650\u0628\u0644 ${user.nameAr}`,
      `Reassigned to ${targetUser.nameEn} by ${user.nameEn}`,
      "\u062A\u0634\u063A\u064A\u0644\u064A\u0629",
      [targetUser.role],
      "team"
    );
    this.persist();
    return task;
  }
  reviewTask(userId, taskId, decision, reason, deviceName) {
    const user = this.assertPermission(userId, "approve_expense_supervisor");
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error("\u0627\u0644\u0645\u0647\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    const oldStatus = task.status;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const assignee = this.state.users.find((u) => u.id === task.assignedTo);
    if (decision === "approve") {
      task.status = "\u0645\u0643\u062A\u0645\u0644\u0629";
      task.approvedBy = user.id;
      task.approvedAt = now;
      task.completedAt = task.completedAt || now;
      task.rejectedReason = void 0;
      task.preArchiveStatus = oldStatus;
      task.archivedAt = task.archivedAt || now;
      task.archivedBy = user.id;
      task.archiveMode = "\u062A\u0644\u0642\u0627\u0626\u064A";
      task.archiveReason = reason || "\u0627\u0639\u062A\u0645\u0627\u062F \u0648\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0645\u0647\u0645\u0629 \u0628\u0639\u062F \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0645\u0634\u0631\u0641";
      if (assignee) {
        this.addNotification(
          `\u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0645\u0647\u0645\u0629: ${task.title}`,
          `Task approved: ${task.title}`,
          `\u0627\u0639\u062A\u0645\u062F ${user.nameAr} \u0625\u0646\u062C\u0627\u0632 \u0627\u0644\u0645\u0647\u0645\u0629 \u0648\u0623\u064F\u063A\u0644\u0642\u062A \u0641\u064A \u0627\u0644\u0623\u0631\u0634\u064A\u0641.`,
          `${user.nameEn} approved task completion.`,
          "\u062A\u0634\u063A\u064A\u0644\u064A\u0629",
          [assignee.role],
          "team"
        );
      }
    } else {
      task.status = "\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630";
      task.rejectedReason = reason || "\u064A\u0631\u062C\u0649 \u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0648\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0631\u0641\u0639 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629";
      task.comments.push({
        id: uid("cmt"),
        authorName: user.nameAr,
        text: `\u0645\u0644\u0627\u062D\u0638\u0629 \u0645\u0631\u0627\u062C\u0639\u0629: ${task.rejectedReason}`,
        createdAt: now
      });
      if (assignee) {
        this.addNotification(
          `\u0625\u0639\u0627\u062F\u0629 \u0645\u0647\u0645\u0629 \u0644\u0644\u0627\u0633\u062A\u0643\u0645\u0627\u0644: ${task.title}`,
          `Task returned for follow-up: ${task.title}`,
          `\u0645\u0644\u0627\u062D\u0638\u0629 ${user.nameAr}: ${task.rejectedReason}`,
          `Review note: ${task.rejectedReason}`,
          "\u062A\u0634\u063A\u064A\u0644\u064A\u0629",
          [assignee.role],
          "team"
        );
      }
    }
    this.addAudit(
      user,
      decision === "approve" ? "\u0627\u0639\u062A\u0645\u0627\u062F \u0648\u0625\u063A\u0644\u0627\u0642 \u0645\u0647\u0645\u0629" : "\u0625\u0631\u062C\u0627\u0639 \u0645\u0647\u0645\u0629 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629",
      "TaskItem",
      task.id,
      `${decision === "approve" ? "\u0627\u0639\u062A\u0645\u0627\u062F" : "\u0625\u0631\u062C\u0627\u0639"} \u0627\u0644\u0645\u0647\u0645\u0629 "${task.title}"`,
      { oldValue: oldStatus, newValue: task.status, reason, propertyId: task.propertyId, deviceName }
    );
    this.persist();
    return task;
  }
  // 8. Documents, Communications, Vendors, Permissions, Backups
  addCommunication(userId, input, deviceName) {
    const user = this.getActingUser(userId);
    const log = {
      ...input,
      id: uid("com"),
      sentBy: user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.communications.unshift(log);
    this.addAudit(user, "\u062A\u0633\u062C\u064A\u0644 \u0645\u0631\u0627\u0633\u0644\u0629", "Communication", log.id, `\u062A\u0633\u062C\u064A\u0644 ${log.channel} \u0645\u0639 ${log.targetName}`, {
      deviceName
    });
    this.persist();
    return log;
  }
  addDocument(userId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_documents");
    const doc = {
      ...input,
      id: uid("doc"),
      uploadedBy: user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const writtenPath = this.writeDocumentToDisk(doc);
    if (writtenPath) doc.diskPath = writtenPath;
    this.state.documents.unshift(doc);
    this.addAudit(user, "\u0623\u0631\u0634\u0641\u0629 \u0645\u0633\u062A\u0646\u062F", "Document", doc.id, `\u0631\u0641\u0639 \u0627\u0644\u0645\u0633\u062A\u0646\u062F "${doc.title}" (${doc.category})`, { deviceName });
    this.persist();
    return doc;
  }
  createVendor(userId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_maintenance");
    const vendor = { ...input, id: uid("vnd") };
    this.state.vendors.push(vendor);
    this.addAudit(user, "\u0625\u0636\u0627\u0641\u0629 \u0645\u0642\u0627\u0648\u0644/\u0645\u0648\u0631\u062F", "Vendor", vendor.id, `\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0648\u0631\u062F ${vendor.nameAr}`, { deviceName });
    this.persist();
    return vendor;
  }
  toggleRolePermission(userId, role, permission, deviceName) {
    const user = this.assertPermission(userId, "manage_users");
    if (user.role !== "sys_owner" && user.role !== "gm") {
      throw new Error("\u062A\u0639\u062F\u064A\u0644 \u0645\u0635\u0641\u0648\u0641\u0629 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0645\u062A\u0627\u062D \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645 \u0623\u0648 \u0645\u062F\u064A\u0631 \u0627\u0644\u0634\u0631\u0643\u0629 \u0641\u0642\u0637");
    }
    if (user.role === role) {
      throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0644\u0623\u064A \u0645\u0633\u062A\u062E\u062F\u0645 \u062A\u0639\u062F\u064A\u0644 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u062F\u0648\u0631\u0647 \u0627\u0644\u062D\u0627\u0644\u064A \u0644\u0636\u0645\u0627\u0646 \u0627\u0644\u062D\u0648\u0643\u0645\u0629");
    }
    if (user.role === "gm" && (role === "sys_owner" || role === "gm")) {
      throw new Error("\u064A\u0633\u062A\u0637\u064A\u0639 \u0645\u062F\u064A\u0631 \u0627\u0644\u0634\u0631\u0643\u0629 \u062A\u0639\u062F\u064A\u0644 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0627\u0644\u062A\u0627\u0628\u0639\u064A\u0646 \u0644\u0647 \u0641\u0642\u0637");
    }
    if (role === "sys_owner" && permission === "manage_users") {
      throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0633\u062D\u0628 \u0635\u0644\u0627\u062D\u064A\u0629 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646 \u0645\u0646 \u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645");
    }
    const list = this.state.rolePermissions[role] || [];
    if (list.includes(permission)) {
      this.state.rolePermissions[role] = list.filter((p) => p !== permission);
    } else {
      this.state.rolePermissions[role] = [...list, permission];
    }
    this.addAudit(
      user,
      "\u062A\u0639\u062F\u064A\u0644 \u0645\u0635\u0641\u0648\u0641\u0629 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A",
      "RolePermissions",
      role,
      `\u062A\u0639\u062F\u064A\u0644 \u0635\u0644\u0627\u062D\u064A\u0629 ${permission} \u0644\u0644\u062F\u0648\u0631 ${role}`,
      { deviceName }
    );
    this.persist();
    return this.state.rolePermissions;
  }
  markNotificationsRead(userId) {
    for (const n of this.state.notifications) {
      if (!n.isReadBy.includes(userId)) n.isReadBy.push(userId);
    }
    this.persist();
  }
  createBackup(userId, label, deviceName, encryptPassword) {
    const user = this.assertPermission(userId, "backup_restore");
    ensureWorkspaceDirs(this.paths);
    const id = uid("bkp");
    const json = JSON.stringify(this.state, null, 2);
    const shouldEncrypt = Boolean(this.state.settings.backupPolicy?.encryptBackups || encryptPassword?.trim());
    const ext = shouldEncrypt ? ".enc.json" : ".json";
    const payloadToWrite = shouldEncrypt ? encryptBackupPayload(json, encryptPassword?.trim() || "AqarBackup@2026") : json;
    const defaultPath = path2.join(this.paths.backupDir, `${id}${ext}`);
    fs2.writeFileSync(defaultPath, payloadToWrite, "utf-8");
    const targetDir = this.getBackupsDir();
    if (targetDir !== this.paths.backupDir) {
      try {
        fs2.mkdirSync(targetDir, { recursive: true });
        fs2.writeFileSync(path2.join(targetDir, `${id}${ext}`), payloadToWrite, "utf-8");
      } catch {
      }
    }
    const recordCount = this.state.properties.length + this.state.units.length + this.state.tenants.length + this.state.contracts.length + this.state.payments.length + this.state.expenses.length + this.state.tickets.length;
    const snap = {
      id,
      label: label || `\u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 ${shouldEncrypt ? "\u0645\u0634\u0641\u0631\u0629 " : "\u064A\u062F\u0648\u064A\u0629 "}\xB7 ${(/* @__PURE__ */ new Date()).toLocaleDateString("ar-SA")}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdBy: user.nameAr,
      recordCount,
      sizeKb: Math.max(1, Math.round(Buffer.byteLength(payloadToWrite, "utf-8") / 1024)),
      encrypted: shouldEncrypt
    };
    this.state.backups.unshift(snap);
    this.addAudit(
      user,
      shouldEncrypt ? "\u0625\u0646\u0634\u0627\u0621 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0645\u0634\u0641\u0631\u0629 AES-256" : "\u0625\u0646\u0634\u0627\u0621 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629",
      "Backup",
      snap.id,
      `\u062D\u0641\u0638 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 (${snap.sizeKb} KB${shouldEncrypt ? " \xB7 AES-256-GCM" : ""})`,
      { deviceName }
    );
    this.persist();
    return snap;
  }
  restoreBackup(userId, backupId, deviceName, mode = "replace", password) {
    const user = this.assertPermission(userId, "backup_restore");
    const filePath = this.resolveBackupFile(backupId);
    if (!filePath) {
      throw new Error("\u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645 (\u062C\u0631\u0628 \u0625\u0646\u0634\u0627\u0621 \u0646\u0633\u062E\u0629 \u062C\u062F\u064A\u062F\u0629 \u0623\u0648\u0644\u0627\u064B)");
    }
    const raw = fs2.readFileSync(filePath, "utf-8");
    const decryptedRaw = isEncryptedBackupEnvelope(raw) ? decryptBackupPayload(raw, password) : raw;
    const restored = JSON.parse(decryptedRaw);
    try {
      this.createBackup(userId, `\u0646\u0633\u062E\u0629 \u0623\u0645\u0627\u0646 \u062A\u0644\u0642\u0627\u0626\u064A\u0629 \u0642\u0628\u0644 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 (${backupId})`, deviceName);
    } catch {
    }
    const currentBackups = this.state.backups;
    if (mode === "merge") {
      const mergeArrays = (current = [], incoming = []) => {
        const ids = new Set(current.map((x) => x.id));
        return [...current, ...incoming.filter((x) => !ids.has(x.id))];
      };
      this.state.properties = mergeArrays(this.state.properties, restored.properties);
      this.state.units = mergeArrays(this.state.units, restored.units);
      this.state.tenants = mergeArrays(this.state.tenants, restored.tenants);
      this.state.contracts = mergeArrays(this.state.contracts, restored.contracts);
      this.state.installments = mergeArrays(this.state.installments, restored.installments);
      this.state.payments = mergeArrays(this.state.payments, restored.payments);
      this.state.expenses = mergeArrays(this.state.expenses, restored.expenses);
      this.state.tickets = mergeArrays(this.state.tickets, restored.tickets);
      this.state.tasks = mergeArrays(this.state.tasks, restored.tasks);
      this.state.documents = mergeArrays(this.state.documents, restored.documents);
      this.state.vendors = mergeArrays(this.state.vendors, restored.vendors);
      this.state.owners = mergeArrays(this.state.owners, restored.owners);
      this.state.accounts = mergeArrays(this.state.accounts, restored.accounts);
      this.state.journals = mergeArrays(this.state.journals, restored.journals);
      this.state.communicationTemplates = mergeArrays(
        this.state.communicationTemplates || [],
        restored.communicationTemplates || []
      );
      this.state.reminderRules = mergeArrays(this.state.reminderRules || [], restored.reminderRules || []);
      this.state.zatcaInvoices = mergeArrays(this.state.zatcaInvoices || [], restored.zatcaInvoices || []);
      this.state.meterReadings = mergeArrays(this.state.meterReadings || [], restored.meterReadings || []);
      if (restored.counters) {
        this.state.counters = {
          receipt: Math.max(this.state.counters.receipt, restored.counters.receipt || 0),
          contract: Math.max(this.state.counters.contract, restored.counters.contract || 0),
          ticket: Math.max(this.state.counters.ticket, restored.counters.ticket || 0),
          expense: Math.max(this.state.counters.expense, restored.counters.expense || 0),
          journal: Math.max(this.state.counters.journal, restored.counters.journal || 0)
        };
      }
      this.addAudit(
        user,
        "\u062F\u0645\u062C \u0630\u0643\u064A \u0645\u0646 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629",
        "Backup",
        backupId,
        "\u062A\u0645 \u062F\u0645\u062C \u0627\u0644\u0633\u062C\u0644\u0627\u062A \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0645\u0646 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 \u0645\u0639 \u0627\u0644\u0625\u0628\u0642\u0627\u0621 \u0639\u0644\u0649 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u0627\u0644\u064A\u0629",
        { deviceName }
      );
    } else {
      this.state = restored;
      this.state.backups = currentBackups;
      this.sqlite.ensureSeedCredentials(this.state.users);
      this.addAudit(
        user,
        "\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 (\u0627\u0633\u062A\u0628\u062F\u0627\u0644 \u0643\u0627\u0645\u0644)",
        "Backup",
        backupId,
        "\u062A\u0645\u062A \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u0638\u0627\u0645 \u0648\u0627\u0633\u062A\u0628\u062F\u0627\u0644 \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0628\u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0645\u062E\u062A\u0627\u0631\u0629",
        { deviceName }
      );
    }
    this.persist();
    return this.state;
  }
  // 9. Automated Rent Due Reminder Scheduler (Linked to Contracts)
  createReminderRule(userId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_contracts");
    if (!this.state.reminderRules) this.state.reminderRules = [];
    const rule = {
      ...input,
      id: uid("rem"),
      createdBy: user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.reminderRules.unshift(rule);
    this.addAudit(user, "\u0625\u0646\u0634\u0627\u0621 \u0642\u0627\u0639\u062F\u0629 \u062C\u062F\u0648\u0644\u0629 \u062A\u0646\u0628\u064A\u0647\u0627\u062A", "ReminderRule", rule.id, `\u062C\u062F\u0648\u0644\u0629 \u062A\u0646\u0628\u064A\u0647 \u0625\u064A\u062C\u0627\u0631: ${rule.nameAr}`, {
      deviceName,
      newValue: `${rule.daysBeforeDue} \u064A\u0648\u0645 \xB7 ${rule.channels.join(", ")}`
    });
    this.persist();
    return rule;
  }
  toggleReminderRule(userId, ruleId, enabled, deviceName) {
    const user = this.assertPermission(userId, "manage_contracts");
    const rule = (this.state.reminderRules || []).find((r) => r.id === ruleId);
    if (!rule) throw new Error("\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u062C\u062F\u0648\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    rule.enabled = enabled;
    this.addAudit(
      user,
      "\u062A\u0639\u062F\u064A\u0644 \u062D\u0627\u0644\u0629 \u062C\u062F\u0648\u0644\u0629 \u0627\u0644\u062A\u0646\u0628\u064A\u0647",
      "ReminderRule",
      rule.id,
      `${enabled ? "\u062A\u0641\u0639\u064A\u0644" : "\u0625\u064A\u0642\u0627\u0641"} \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u062A\u0646\u0628\u064A\u0647: ${rule.nameAr}`,
      { deviceName }
    );
    this.persist();
    return rule;
  }
  deleteReminderRule(userId, ruleId, deviceName) {
    const user = this.assertPermission(userId, "manage_contracts");
    this.state.reminderRules = (this.state.reminderRules || []).filter((r) => r.id !== ruleId);
    this.addAudit(user, "\u062D\u0630\u0641 \u0642\u0627\u0639\u062F\u0629 \u062C\u062F\u0648\u0644\u0629 \u062A\u0646\u0628\u064A\u0647\u0627\u062A", "ReminderRule", ruleId, `\u062D\u0630\u0641 \u0642\u0627\u0639\u062F\u0629 \u062A\u0646\u0628\u064A\u0647 \u0645\u062C\u062F\u0648\u0644\u0629`, { deviceName });
    this.persist();
  }
  runReminderScheduler(userId, opts, deviceName) {
    const user = this.getActingUser(userId);
    if (!this.state.reminderRules) this.state.reminderRules = [];
    if (!this.state.reminderLogs) this.state.reminderLogs = [];
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const todayMs = (/* @__PURE__ */ new Date("2026-11-14T00:00:00Z")).getTime();
    const createdLogs = [];
    const openInstallments = this.state.installments.filter((i) => {
      if (i.remainingAmount <= 0 || i.status === "\u0645\u0644\u063A\u0627\u0629") return false;
      if (opts?.contractId && i.contractId !== opts.contractId) return false;
      const ctr = this.state.contracts.find((c) => c.id === i.contractId);
      return ctr && (ctr.lifecycleStatus === "\u0646\u0634\u0637" || ctr.lifecycleStatus === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u062C\u062F\u064A\u062F");
    });
    const activeRules = opts?.ruleId ? this.state.reminderRules.filter((r) => r.id === opts.ruleId) : this.state.reminderRules.filter((r) => r.enabled);
    if (opts?.contractId && opts?.channels && opts.channels.length > 0) {
      const targetInst = openInstallments[0];
      const ctr = this.state.contracts.find((c) => c.id === opts.contractId);
      if (!ctr) throw new Error("\u0627\u0644\u0639\u0642\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      const tenant = this.state.tenants.find((t) => t.id === ctr.tenantId);
      const unit = this.state.units.find((u) => u.id === ctr.unitId);
      const curr = targetInst?.currency || ctr.currency || "SAR";
      const amt = targetInst ? targetInst.remainingAmount : 0;
      const dueStr = targetInst ? targetInst.dueDate : ctr.endDate;
      for (const ch of opts.channels) {
        const msg = (opts.customMessage || `\u062A\u0630\u0643\u064A\u0631 \u062A\u0644\u0642\u0627\u0626\u064A \u0645\u0646 AqarPlus: \u0639\u0632\u064A\u0632\u064A ${tenant?.nameAr || ""}, \u064A\u0633\u062A\u062D\u0642 \u0627\u0644\u0642\u0633\u0637 \u0631\u0642\u0645 ${targetInst?.installmentNumber || 1} \u0644\u0639\u0642\u062F ${ctr.internalNumber} (\u0648\u062D\u062F\u0629 ${unit?.unitNumber || ""}) \u0628\u0645\u0628\u0644\u063A ${amt.toLocaleString()} ${currencyLabelAr(curr)} \u0628\u062A\u0627\u0631\u064A\u062E ${dueStr}.`).replace(/\{tenant\}/g, tenant?.nameAr || "").replace(/\{contract\}/g, ctr.internalNumber).replace(/\{unit\}/g, unit?.unitNumber || "").replace(/\{installment\}/g, String(targetInst?.installmentNumber || 1)).replace(/\{amount\}/g, `${amt.toLocaleString()} ${currencyLabelAr(curr)}`).replace(/\{dueDate\}/g, dueStr);
        const recipient = ch === "\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A" ? tenant?.email || "\u2014" : tenant?.phone || "\u2014";
        const log = {
          id: uid("rlog"),
          ruleId: opts.ruleId || "manual-contract",
          ruleName: opts.ruleId ? activeRules[0]?.nameAr || "\u062A\u0646\u0628\u064A\u0647 \u0639\u0642\u062F \u0641\u0648\u0631\u064A" : `\u0625\u0634\u0639\u0627\u0631 \u0645\u062C\u062F\u0648\u0644 \u0644\u0644\u0639\u0642\u062F ${ctr.internalNumber}`,
          contractId: ctr.id,
          installmentId: targetInst?.id || ctr.id,
          tenantId: ctr.tenantId,
          tenantName: tenant?.nameAr || "\u2014",
          channel: ch,
          recipient,
          messagePreview: msg,
          dueDate: dueStr,
          amount: amt,
          currency: curr,
          status: "\u062A\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 (\u0645\u062D\u0627\u0643\u0627\u0629)",
          sentAt: nowIso
        };
        this.state.reminderLogs.unshift(log);
        createdLogs.push(log);
        this.state.communications.unshift({
          id: uid("com"),
          targetType: "\u0645\u0633\u062A\u0623\u062C\u0631",
          targetId: ctr.tenantId,
          targetName: tenant?.nameAr || "\u2014",
          channel: ch === "\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A" ? "\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A" : "\u0631\u0633\u0627\u0644\u0629 \u0646\u0635\u064A\u0629 / \u0648\u0627\u062A\u0633\u0627\u0628",
          templateUsed: "\u062A\u0630\u0643\u064A\u0631 \u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0627\u0644\u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0645\u062C\u062F\u0648\u0644",
          language: "ar",
          summary: `[${ch}] ${msg}`,
          sentBy: user.id,
          createdAt: nowIso
        });
      }
    } else {
      for (const rule of activeRules) {
        for (const inst of openInstallments) {
          if (rule.contractId && rule.contractId !== inst.contractId) continue;
          if (rule.propertyId && rule.propertyId !== "all" && rule.propertyId !== inst.propertyId) continue;
          const dueMs = (/* @__PURE__ */ new Date(`${inst.dueDate}T00:00:00Z`)).getTime();
          const daysDiff = Math.ceil((dueMs - todayMs) / 864e5);
          if (daysDiff > rule.daysBeforeDue) continue;
          const ctr = this.state.contracts.find((c) => c.id === inst.contractId);
          const tenant = this.state.tenants.find((t) => t.id === inst.tenantId);
          const unit = this.state.units.find((u) => u.id === inst.unitId);
          const curr = inst.currency || ctr?.currency || "SAR";
          for (const ch of rule.channels) {
            const msg = rule.templateAr.replace(/\{tenant\}/g, tenant?.nameAr || "").replace(/\{contract\}/g, ctr?.internalNumber || "").replace(/\{unit\}/g, unit?.unitNumber || "").replace(/\{installment\}/g, String(inst.installmentNumber)).replace(/\{amount\}/g, `${inst.remainingAmount.toLocaleString()} ${currencyLabelAr(curr)}`).replace(/\{dueDate\}/g, inst.dueDate);
            const recipient = ch === "\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A" ? tenant?.email || "\u2014" : tenant?.phone || "\u2014";
            const log = {
              id: uid("rlog"),
              ruleId: rule.id,
              ruleName: rule.nameAr,
              contractId: inst.contractId,
              installmentId: inst.id,
              tenantId: inst.tenantId,
              tenantName: tenant?.nameAr || "\u2014",
              channel: ch,
              recipient,
              messagePreview: msg,
              dueDate: inst.dueDate,
              amount: inst.remainingAmount,
              currency: curr,
              status: "\u062A\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 (\u0645\u062D\u0627\u0643\u0627\u0629)",
              sentAt: nowIso
            };
            this.state.reminderLogs.unshift(log);
            createdLogs.push(log);
            this.state.communications.unshift({
              id: uid("com"),
              targetType: "\u0645\u0633\u062A\u0623\u062C\u0631",
              targetId: inst.tenantId,
              targetName: tenant?.nameAr || "\u2014",
              channel: ch === "\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A" ? "\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A" : "\u0631\u0633\u0627\u0644\u0629 \u0646\u0635\u064A\u0629 / \u0648\u0627\u062A\u0633\u0627\u0628",
              templateUsed: rule.nameAr,
              language: "ar",
              summary: `[${ch}] ${msg}`,
              sentBy: user.id,
              createdAt: nowIso
            });
          }
        }
        rule.lastRunAt = nowIso;
      }
    }
    if (this.state.reminderLogs.length > 200) {
      this.state.reminderLogs = this.state.reminderLogs.slice(0, 200);
    }
    if (createdLogs.length > 0) {
      this.addAudit(
        user,
        "\u062A\u0634\u063A\u064A\u0644 \u062C\u062F\u0648\u0644\u0629 \u062A\u0646\u0628\u064A\u0647\u0627\u062A \u0627\u0644\u0625\u064A\u062C\u0627\u0631",
        "ReminderScheduler",
        opts?.contractId || "all",
        `\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 ${createdLogs.length} \u062A\u0646\u0628\u064A\u0647 \u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0625\u064A\u062C\u0627\u0631 \u062A\u0644\u0642\u0627\u0626\u064A \u0644\u0644\u0645\u0633\u062A\u0623\u062C\u0631\u064A\u0646`,
        { deviceName }
      );
      this.addNotification(
        `\u0625\u0631\u0633\u0627\u0644 ${createdLogs.length} \u062A\u0646\u0628\u064A\u0647 \u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0625\u064A\u062C\u0627\u0631`,
        `Dispatched ${createdLogs.length} rent reminders`,
        `\u062A\u0645 \u062A\u0648\u062B\u064A\u0642 \u062A\u0646\u0628\u064A\u0647\u0627\u062A \u0627\u0644\u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0645\u062C\u062F\u0648\u0644\u0629 \u0639\u0628\u0631 \u0627\u0644\u0628\u0631\u064A\u062F / SMS / \u0648\u0627\u062A\u0633\u0627\u0628 \u0641\u064A \u0633\u062C\u0644 \u0627\u0644\u062A\u0648\u0627\u0635\u0644.`,
        `Automated rent reminders recorded in communication logs.`,
        "\u0645\u0627\u0644\u064A\u0629",
        ["gm", "accountant", "leasing"],
        "leasing"
      );
    }
    this.persist();
    return createdLogs;
  }
  // 10. Multi-Company & Settings Management
  createCompany(userId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_users");
    if (!this.state.companies) this.state.companies = [];
    const comp = {
      ...input,
      id: uid("comp")
    };
    this.state.companies.push(comp);
    this.addAudit(user, "\u0625\u0636\u0627\u0641\u0629 \u0634\u0631\u0643\u0629 \u0639\u0642\u0627\u0631\u064A\u0629", "CompanyProfile", comp.id, `\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0634\u0631\u0643\u0629 ${comp.nameAr} (\u0633\u062C\u0644: ${comp.crNumber})`, {
      deviceName
    });
    this.persist();
    return comp;
  }
  updateSettings(userId, patch, deviceName) {
    const user = this.assertPermission(userId, "manage_users");
    const prev = this.state.settings;
    this.state.settings = {
      ...prev,
      ...patch,
      baseCurrency: "SAR",
      currencyRatesToSar: RATES_TO_SAR,
      receiptBranding: patch.receiptBranding ? { ...prev.receiptBranding || {}, ...patch.receiptBranding } : prev.receiptBranding,
      generalPrefs: patch.generalPrefs ? { ...prev.generalPrefs || {}, ...patch.generalPrefs } : prev.generalPrefs,
      securityCenter: patch.securityCenter ? { ...prev.securityCenter || {}, ...patch.securityCenter } : prev.securityCenter,
      notificationsCenter: patch.notificationsCenter ? { ...prev.notificationsCenter || {}, ...patch.notificationsCenter } : prev.notificationsCenter,
      printShare: patch.printShare ? { ...prev.printShare || {}, ...patch.printShare } : prev.printShare,
      backupPolicy: patch.backupPolicy ? { ...prev.backupPolicy || {}, ...patch.backupPolicy } : prev.backupPolicy,
      syncCenter: patch.syncCenter ? { ...prev.syncCenter || {}, ...patch.syncCenter } : prev.syncCenter,
      developerCenter: patch.developerCenter ? { ...prev.developerCenter || {}, ...patch.developerCenter } : prev.developerCenter
    };
    const defaultComp = (this.state.companies || []).find((c) => c.isDefault) || this.state.companies?.[0];
    if (defaultComp) {
      if (patch.nameAr) defaultComp.nameAr = patch.nameAr;
      if (patch.nameEn) defaultComp.nameEn = patch.nameEn;
      if (patch.crNumber) defaultComp.crNumber = patch.crNumber;
      if (patch.vatNumber) defaultComp.vatNumber = patch.vatNumber;
      if (patch.city) defaultComp.city = patch.city;
      if (patch.address) defaultComp.address = patch.address;
      if (patch.phone) defaultComp.phone = patch.phone;
      if (patch.email) defaultComp.email = patch.email;
      if (patch.logoDataUrl !== void 0) defaultComp.logoDataUrl = patch.logoDataUrl;
    }
    if (patch.securityCenter?.autoLockTiming && this.state.securityPolicy) {
      const minsMap = { immediate: 0, "1m": 1, "5m": 5, "15m": 15, "30m": 30 };
      if (patch.securityCenter.autoLockTiming in minsMap) {
        this.state.securityPolicy.autoLockMinutes = minsMap[patch.securityCenter.autoLockTiming];
      }
    }
    this.addAudit(
      user,
      "\u062A\u062D\u062F\u064A\u062B \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645 \u0648\u0627\u0644\u0645\u0631\u0643\u0632",
      "CompanySettings",
      "settings",
      `\u062A\u062D\u062F\u064A\u062B \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u0648\u0627\u0644\u0639\u0645\u0644\u0629 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629 (${this.state.settings.baseCurrency || "SAR"})`,
      { deviceName }
    );
    this.persist();
    return this.state.settings;
  }
  // 11. Document Archive Access Log & OCR Attachment
  recordDocumentAccess(userId, docId, action, deviceName) {
    const user = this.getActingUser(userId);
    const doc = this.state.documents.find((d) => d.id === docId);
    if (!doc) throw new Error("\u0627\u0644\u0645\u0633\u062A\u0646\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    if (!doc.accessLog) doc.accessLog = [];
    const entry = {
      id: uid("dacc"),
      userId: user.id,
      userName: user.nameAr,
      deviceName: deviceName || user.deviceName,
      action,
      accessedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    doc.accessLog.unshift(entry);
    if (doc.accessLog.length > 50) doc.accessLog = doc.accessLog.slice(0, 50);
    this.addAudit(user, `${action} \u0645\u0633\u062A\u0646\u062F`, "Document", doc.id, `${action} \u0627\u0644\u0645\u0633\u062A\u0646\u062F "${doc.title}"`, { deviceName });
    this.persist();
    return doc;
  }
  attachDocumentOcr(userId, docId, ocrExtracted, ocrRawText, deviceName) {
    const user = this.assertPermission(userId, "manage_documents");
    const doc = this.state.documents.find((d) => d.id === docId);
    if (!doc) throw new Error("\u0627\u0644\u0645\u0633\u062A\u0646\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    doc.ocrStatus = "\u062A\u0645 \u0627\u0644\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0622\u0644\u064A\u0627\u064B";
    doc.ocrExtracted = ocrExtracted;
    doc.ocrRawText = ocrRawText;
    if (!doc.expiryDate && ocrExtracted.expiryDate) {
      doc.expiryDate = ocrExtracted.expiryDate;
    }
    this.recordDocumentAccess(user.id, doc.id, "\u062A\u062D\u0644\u064A\u0644 OCR", deviceName);
    this.persist();
    return doc;
  }
  // 12. Owner Payout Transfers (تحويل مستحقات الملاك + قيد محاسبي متوازن)
  recordOwnerTransfer(userId, ownerId, input, deviceName) {
    return this.runTransaction(() => {
      const user = this.assertPermission(userId, "manage_accounting");
      const owner = this.state.owners.find((o) => o.id === ownerId);
      if (!owner) throw new Error("\u0627\u0644\u0645\u0627\u0644\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      if (!input.amount || input.amount <= 0) throw new Error("\u064A\u062C\u0628 \u0625\u062F\u062E\u0627\u0644 \u0645\u0628\u0644\u063A \u062A\u062D\u0648\u064A\u0644 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631");
      const curr = input.currency || "SAR";
      const amountSar = toSar(input.amount, curr, this.state.settings.currencyRatesToSar);
      owner.totalTransferred = Math.round((owner.totalTransferred + amountSar) * 100) / 100;
      const cashAccountId = input.paymentMethod === "\u0646\u0642\u062F\u064A" ? "acc-1010" : "acc-1020";
      const cashAcc = this.state.accounts.find((a) => a.id === cashAccountId) || this.state.accounts[0];
      const payableAcc = this.state.accounts.find((a) => a.id === "acc-2200");
      if (cashAcc) cashAcc.balance = Math.round((cashAcc.balance - amountSar) * 100) / 100;
      if (payableAcc) payableAcc.balance = Math.round((payableAcc.balance - amountSar) * 100) / 100;
      this.state.counters.journal += 1;
      const journal = {
        id: uid("jrn"),
        entryNumber: `JRN-2026-${pad4(this.state.counters.journal)}`,
        date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        description: `\u062A\u062D\u0648\u064A\u0644 \u0645\u0633\u062A\u062D\u0642\u0627\u062A \u0644\u0644\u0645\u0627\u0644\u0643 ${owner.nameAr} (${input.paymentMethod || "\u062A\u062D\u0648\u064A\u0644 \u0628\u0646\u0643\u064A"}${input.referenceNumber ? ` \xB7 \u0645\u0631\u062C\u0639 ${input.referenceNumber}` : ""})${input.notes ? ` - ${input.notes}` : ""}`,
        referenceType: "\u062A\u062D\u0648\u064A\u0644 \u0645\u0627\u0644\u0643",
        referenceId: owner.id,
        ownerId: owner.id,
        createdBy: user.id,
        lines: [
          { accountId: "acc-2200", accountName: payableAcc?.nameAr || "\u0645\u0633\u062A\u062D\u0642\u0627\u062A \u0627\u0644\u0645\u0644\u0627\u0643", debit: amountSar, credit: 0 },
          { accountId: cashAcc.id, accountName: cashAcc.nameAr, debit: 0, credit: amountSar }
        ]
      };
      this.state.journals.unshift(journal);
      this.addAudit(
        user,
        "\u062A\u062D\u0648\u064A\u0644 \u0645\u0633\u062A\u062D\u0642\u0627\u062A \u0645\u0627\u0644\u0643",
        "Owner",
        owner.id,
        `\u062A\u062D\u0648\u064A\u0644 \u0645\u0628\u0644\u063A ${input.amount.toLocaleString()} ${currencyLabelAr(curr)} (${amountSar.toLocaleString()} \u0631.\u0633) \u0644\u0644\u0645\u0627\u0644\u0643 ${owner.nameAr}`,
        { deviceName, newValue: `${amountSar} \u0631.\u0633` }
      );
      this.addNotification(
        `\u062A\u062D\u0648\u064A\u0644 \u0645\u0633\u062A\u062D\u0642\u0627\u062A \u0644\u0644\u0645\u0627\u0644\u0643 ${owner.nameAr}`,
        `Payout transferred to ${owner.nameEn}`,
        `\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u062A\u062D\u0648\u064A\u0644 \u0645\u0627\u0644\u064A \u0628\u0642\u064A\u0645\u0629 ${input.amount.toLocaleString()} ${currencyLabelAr(curr)} \u0648\u062A\u062D\u062F\u064A\u062B \u0643\u0634\u0641 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0627\u0644\u0643.`,
        `Transferred ${input.amount.toLocaleString()} ${curr} to owner account.`,
        "\u0645\u0627\u0644\u064A\u0629",
        ["gm", "accountant", "owner"],
        "accounting"
      );
      this.persist();
      return { owner, journal };
    });
  }
  // 13. Fast Contract Renewal (التجديد دون تكرار الإدخال)
  renewContract(userId, contractId, input, deviceName) {
    return this.runTransaction(() => {
      const user = this.assertPermission(userId, "manage_contracts");
      const prev = this.contractIndex.get(contractId) || this.state.contracts.find((c) => c.id === contractId);
      if (!prev) throw new Error("\u0627\u0644\u0639\u0642\u062F \u0627\u0644\u0623\u0633\u0627\u0633\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      if (prev.lifecycleStatus === "\u0646\u0634\u0637" || prev.lifecycleStatus === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u062C\u062F\u064A\u062F") {
        prev.lifecycleStatus = "\u0645\u0646\u062A\u0647\u064A";
      }
      const freqMap = {
        \u0634\u0647\u0631\u064A: 12,
        "\u0631\u0628\u0639 \u0633\u0646\u0648\u064A": 4,
        "\u0646\u0635\u0641 \u0633\u0646\u0648\u064A": 2,
        \u0633\u0646\u0648\u064A: 1
      };
      const count = freqMap[input.paymentFrequency] || 2;
      this.state.counters.contract += 1;
      const contractCurrency = input.currency || prev.currency || "SAR";
      const renewed = {
        id: uid("ctr"),
        internalNumber: `CNT-2026-${pad3(this.state.counters.contract)}`,
        ejarNumber: input.ejarNumber || "",
        ejarStatus: input.ejarNumber ? "\u0645\u0648\u062B\u0642 \u0641\u064A \u0625\u064A\u062C\u0627\u0631" : "\u0642\u064A\u062F \u0627\u0644\u062A\u0648\u062B\u064A\u0642",
        lifecycleStatus: "\u0646\u0634\u0637",
        propertyId: prev.propertyId,
        unitId: prev.unitId,
        tenantId: prev.tenantId,
        startDate: input.startDate,
        endDate: input.endDate,
        annualRent: input.annualRent,
        currency: contractCurrency,
        paymentFrequency: input.paymentFrequency,
        installmentsCount: count,
        securityDeposit: prev.securityDeposit,
        officeFee: 0,
        managementCommissionPercent: prev.managementCommissionPercent,
        includedServices: prev.includedServices,
        version: prev.version + 1,
        renewedFromContractId: prev.id,
        createdBy: user.id,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        notes: input.notes || `\u062A\u062C\u062F\u064A\u062F \u0645\u0628\u0627\u0634\u0631 \u0644\u0644\u0639\u0642\u062F ${prev.internalNumber}`
      };
      this.state.contracts.unshift(renewed);
      const start = new Date(renewed.startDate);
      const perInst = Math.round(renewed.annualRent / count * 100) / 100;
      const createdInstallments = [];
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      for (let i = 0; i < count; i++) {
        const due = new Date(start);
        due.setMonth(due.getMonth() + i * (12 / count));
        const dueStr = due.toISOString().slice(0, 10);
        const amt = i === count - 1 ? Math.round((renewed.annualRent - perInst * (count - 1)) * 100) / 100 : perInst;
        const inst = {
          id: uid("inst"),
          contractId: renewed.id,
          unitId: renewed.unitId,
          propertyId: renewed.propertyId,
          tenantId: renewed.tenantId,
          installmentNumber: i + 1,
          dueDate: dueStr,
          amount: amt,
          paidAmount: 0,
          remainingAmount: amt,
          currency: contractCurrency,
          status: dueStr < todayStr ? "\u0645\u062A\u0623\u062E\u0631\u0629" : dueStr === todayStr ? "\u0645\u0633\u062A\u062D\u0642\u0629 \u0627\u0644\u064A\u0648\u0645" : "\u0644\u0645 \u062A\u0633\u062A\u062D\u0642"
        };
        this.state.installments.push(inst);
        createdInstallments.push(inst);
      }
      const unit = this.state.units.find((u) => u.id === renewed.unitId);
      if (unit) unit.status = "\u0645\u0624\u062C\u0631\u0629";
      this.addAudit(
        user,
        "\u062A\u062C\u062F\u064A\u062F \u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631",
        "LeaseContract",
        renewed.id,
        `\u062A\u062C\u062F\u064A\u062F \u0627\u0644\u0639\u0642\u062F ${prev.internalNumber} \u0625\u0644\u0649 ${renewed.internalNumber} (\u0625\u0635\u062F\u0627\u0631 v${renewed.version}) \u0628\u0642\u064A\u0645\u0629 ${renewed.annualRent.toLocaleString()} ${currencyLabelAr(contractCurrency)}`,
        { deviceName, oldValue: prev.internalNumber, newValue: renewed.internalNumber }
      );
      this.persist();
      return { contract: renewed, installments: createdInstallments };
    });
  }
  // 14. Purchase Orders & Contractor Quotes
  createPurchaseOrder(userId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_maintenance");
    if (!this.state.purchaseOrders) this.state.purchaseOrders = [];
    const po = {
      ...input,
      id: uid("po"),
      poNumber: `PO-2026-${pad3(this.state.purchaseOrders.length + 1)}`,
      createdBy: user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.purchaseOrders.unshift(po);
    this.addAudit(user, "\u0625\u0646\u0634\u0627\u0621 \u0637\u0644\u0628 \u0634\u0631\u0627\u0621 \u0648\u0645\u0642\u0627\u0631\u0646\u0629 \u0639\u0631\u0648\u0636", "PurchaseOrder", po.id, `\u0625\u0646\u0634\u0627\u0621 ${po.poNumber}: ${po.title}`, {
      deviceName
    });
    this.persist();
    return po;
  }
  updatePurchaseOrder(userId, poId, patch, deviceName) {
    const user = this.getActingUser(userId);
    if (!this.state.purchaseOrders) this.state.purchaseOrders = [];
    const po = this.state.purchaseOrders.find((p) => p.id === poId);
    if (!po) throw new Error("\u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u0627\u0621 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    if (patch.status) po.status = patch.status;
    if (patch.selectedVendorId) po.selectedVendorId = patch.selectedVendorId;
    if (typeof patch.approvedAmount === "number") po.approvedAmount = patch.approvedAmount;
    if (patch.quotes) po.quotes = patch.quotes;
    if (patch.status === "\u0645\u0639\u062A\u0645\u062F" || patch.status === "\u0623\u0645\u0631 \u0634\u0631\u0627\u0621") {
      po.approvedBy = user.id;
    }
    this.addAudit(user, "\u062A\u062D\u062F\u064A\u062B \u0637\u0644\u0628 \u0634\u0631\u0627\u0621", "PurchaseOrder", po.id, `\u062A\u062D\u062F\u064A\u062B ${po.poNumber} \u0625\u0644\u0649 \u0627\u0644\u062D\u0627\u0644\u0629: ${po.status}`, {
      deviceName,
      newValue: po.status
    });
    this.persist();
    return po;
  }
  // 15. Executive Decisions Log
  createDecision(userId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_users");
    if (!this.state.decisions) this.state.decisions = [];
    const dec = {
      ...input,
      id: uid("dec"),
      decisionNumber: `DEC-2026-${pad3(this.state.decisions.length + 14)}`,
      issuedBy: user.id,
      issuedByName: user.nameAr,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.decisions.unshift(dec);
    this.addAudit(user, "\u0625\u0635\u062F\u0627\u0631 \u0642\u0631\u0627\u0631 \u0625\u062F\u0627\u0631\u064A", "ExecutiveDecision", dec.id, `${dec.decisionNumber}: ${dec.title}`, {
      deviceName
    });
    this.addNotification(
      `\u0642\u0631\u0627\u0631 \u0625\u062F\u0627\u0631\u064A \u062C\u062F\u064A\u062F: ${dec.title}`,
      `New Executive Decision: ${dec.title}`,
      dec.summary,
      dec.summary,
      "\u0625\u062F\u0627\u0631\u064A\u0629",
      ["gm", "accountant", "leasing", "supervisor", "technician"],
      "admin"
    );
    this.persist();
    return dec;
  }
  // 16. Tenant Onboarding Policy Checklist
  updateTenantChecklist(userId, tenantId, checklist, deviceName) {
    const user = this.assertPermission(userId, "manage_tenants");
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error("\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    tenant.onboardingChecklist = checklist;
    const completedCount = Object.values(checklist).filter(Boolean).length;
    this.addAudit(
      user,
      "\u062A\u062D\u062F\u064A\u062B \u0642\u0627\u0626\u0645\u0629 \u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u062A\u0633\u0643\u064A\u0646",
      "Tenant",
      tenant.id,
      `\u0627\u0643\u062A\u0645\u0627\u0644 ${completedCount}/6 \u0628\u0646\u0648\u062F \u062A\u0633\u0643\u064A\u0646 \u0644\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${tenant.nameAr}`,
      { deviceName }
    );
    this.persist();
    return tenant;
  }
  // 17. Bulk Excel/CSV Import (Units & Tenants)
  bulkImportRecords(userId, type, rows, deviceName) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("\u0627\u0644\u0645\u0644\u0641 \u0644\u0627 \u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0635\u0641\u0648\u0641 \u0635\u0627\u0644\u062D\u0629 \u0644\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F");
    }
    let inserted = 0;
    let skipped = 0;
    if (type === "tenants") {
      const user = this.assertPermission(userId, "manage_tenants");
      for (const r of rows) {
        const nameAr = String(r.nameAr || r["\u0627\u0644\u0627\u0633\u0645"] || r["\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631"] || "").trim();
        const nationalIdOrIqama = String(r.nationalIdOrIqama || r["\u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064A\u0629"] || r["\u0627\u0644\u0647\u0648\u064A\u0629"] || "").trim();
        const phone = String(r.phone || r["\u0627\u0644\u062C\u0648\u0627\u0644"] || r["\u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644"] || "").trim();
        if (!nameAr || !nationalIdOrIqama) {
          skipped += 1;
          continue;
        }
        const exists = this.state.tenants.some((t) => t.nationalIdOrIqama === nationalIdOrIqama);
        if (exists) {
          skipped += 1;
          continue;
        }
        this.state.tenants.push({
          id: uid("ten"),
          nameAr,
          nameEn: String(r.nameEn || r["\u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629"] || nameAr),
          nationalIdOrIqama,
          nationality: String(r.nationality || r["\u0627\u0644\u062C\u0646\u0633\u064A\u0629"] || "\u0633\u0639\u0648\u062F\u064A"),
          phone: phone || "0500000000",
          email: String(r.email || r["\u0627\u0644\u0628\u0631\u064A\u062F"] || ""),
          employer: String(r.employer || r["\u062C\u0647\u0629 \u0627\u0644\u0639\u0645\u0644"] || ""),
          classification: "\u0645\u062D\u062A\u0645\u0644",
          rating: 4,
          onboardingChecklist: {
            idVerified: false,
            docsArchived: false,
            depositPaid: false,
            contractSigned: false,
            ejarRegistered: false,
            handoverSigned: false
          },
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        inserted += 1;
      }
      this.addAudit(
        user,
        "\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u062C\u0645\u0627\u0639\u064A \u0644\u0644\u0645\u0633\u062A\u0623\u062C\u0631\u064A\u0646 \u0645\u0646 Excel",
        "Tenant",
        "bulk",
        `\u062A\u0645 \u0627\u0633\u062A\u064A\u0631\u0627\u062F ${inserted} \u0645\u0633\u062A\u0623\u062C\u0631 \u0648\u062A\u062E\u0637\u064A ${skipped} \u0635\u0641 \u0645\u0643\u0631\u0631 \u0623\u0648 \u0646\u0627\u0642\u0635`,
        { deviceName }
      );
    } else {
      const user = this.assertPermission(userId, "manage_properties");
      const fallbackPropId = this.state.properties[0]?.id;
      for (const r of rows) {
        const unitNumber = String(r.unitNumber || r["\u0631\u0642\u0645 \u0627\u0644\u0648\u062D\u062F\u0629"] || r["\u0627\u0644\u0648\u062D\u062F\u0629"] || "").trim();
        const propNameOrId = String(r.propertyId || r["\u0627\u0644\u0639\u0642\u0627\u0631"] || "").trim();
        const prop = this.state.properties.find((p) => p.id === propNameOrId || p.nameAr === propNameOrId) || this.state.properties.find((p) => p.id === fallbackPropId);
        if (!unitNumber || !prop) {
          skipped += 1;
          continue;
        }
        const exists = this.state.units.some((u) => u.propertyId === prop.id && u.unitNumber === unitNumber);
        if (exists) {
          skipped += 1;
          continue;
        }
        const annual = Number(r.suggestedAnnualRent || r["\u0627\u0644\u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0633\u0646\u0648\u064A"] || 36e3) || 36e3;
        this.state.units.push({
          id: uid("unit"),
          propertyId: prop.id,
          buildingName: String(r.buildingName || r["\u0627\u0644\u0645\u0628\u0646\u0649"] || "\u0627\u0644\u0645\u0628\u0646\u0649 \u0627\u0644\u0631\u0626\u064A\u0633\u064A"),
          floor: Number(r.floor || r["\u0627\u0644\u062F\u0648\u0631"] || 1) || 1,
          unitNumber,
          unitType: String(r.unitType || r["\u0627\u0644\u0646\u0648\u0639"] || "\u0634\u0642\u0629"),
          areaSqm: Number(r.areaSqm || r["\u0627\u0644\u0645\u0633\u0627\u062D\u0629"] || 120) || 120,
          rooms: Number(r.rooms || r["\u0627\u0644\u063A\u0631\u0641"] || 3) || 3,
          bathrooms: Number(r.bathrooms || r["\u062F\u0648\u0631\u0627\u062A \u0627\u0644\u0645\u064A\u0627\u0647"] || 2) || 2,
          furnished: Boolean(r.furnished),
          acCount: Number(r.acCount || 3) || 3,
          electricityMeter: String(r.electricityMeter || r["\u0639\u062F\u0627\u062F \u0627\u0644\u0643\u0647\u0631\u0628\u0627\u0621"] || ""),
          waterMeter: String(r.waterMeter || r["\u0639\u062F\u0627\u062F \u0627\u0644\u0645\u064A\u0627\u0647"] || ""),
          keyCount: 3,
          acRemoteCount: 3,
          suggestedMonthlyRent: Math.round(annual / 12),
          suggestedAnnualRent: annual,
          officeFee: 1e3,
          status: "\u0634\u0627\u063A\u0631\u0629"
        });
        inserted += 1;
      }
      this.addAudit(
        user,
        "\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u062C\u0645\u0627\u0639\u064A \u0644\u0644\u0648\u062D\u062F\u0627\u062A \u0645\u0646 Excel",
        "Unit",
        "bulk",
        `\u062A\u0645 \u0627\u0633\u062A\u064A\u0631\u0627\u062F ${inserted} \u0648\u062D\u062F\u0629 \u0648\u062A\u062E\u0637\u064A ${skipped} \u0635\u0641 \u0645\u0643\u0631\u0631 \u0623\u0648 \u0646\u0627\u0642\u0635`,
        { deviceName }
      );
    }
    this.persist();
    return { inserted, skipped };
  }
  // 18. Gemini OCR Entity Matching & Automatic Field Sync (Tenants & Properties)
  findOcrEntityMatches(extracted) {
    const cleanDigits = (s) => (s || "").replace(/\D+/g, "");
    const norm = (s) => (s || "").trim().toLowerCase();
    const idDigits = cleanDigits(extracted.nationalIdOrIqama);
    const phoneDigits = cleanDigits(extracted.phone);
    const tenantNameNorm = norm(extracted.tenantNameAr);
    let matchedTenant;
    let tenantReason = "";
    if (idDigits.length >= 6) {
      matchedTenant = this.state.tenants.find((t) => cleanDigits(t.nationalIdOrIqama) === idDigits);
      if (matchedTenant) tenantReason = "\u0645\u0637\u0627\u0628\u0642\u0629 \u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064A\u0629 / \u0627\u0644\u0625\u0642\u0627\u0645\u0629";
    }
    if (!matchedTenant && phoneDigits.length >= 8) {
      matchedTenant = this.state.tenants.find((t) => cleanDigits(t.phone).endsWith(phoneDigits.slice(-9)));
      if (matchedTenant) tenantReason = "\u0645\u0637\u0627\u0628\u0642\u0629 \u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644";
    }
    if (!matchedTenant && tenantNameNorm.length >= 4) {
      matchedTenant = this.state.tenants.find(
        (t) => norm(t.nameAr) === tenantNameNorm || norm(t.nameAr).includes(tenantNameNorm) || tenantNameNorm.includes(norm(t.nameAr))
      );
      if (matchedTenant) tenantReason = "\u0645\u0637\u0627\u0628\u0642\u0629 \u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629";
    }
    const tenantFieldsToUpdate = [];
    if (matchedTenant) {
      if (extracted.tenantNameAr && extracted.tenantNameAr.trim() && matchedTenant.nameAr !== extracted.tenantNameAr.trim()) {
        tenantFieldsToUpdate.push("\u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629");
      }
      if (extracted.tenantNameEn && extracted.tenantNameEn.trim() && (!matchedTenant.nameEn || matchedTenant.nameEn === matchedTenant.nameAr)) {
        tenantFieldsToUpdate.push("\u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629");
      }
      if (extracted.nationalIdOrIqama && !matchedTenant.nationalIdOrIqama) {
        tenantFieldsToUpdate.push("\u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064A\u0629/\u0627\u0644\u0625\u0642\u0627\u0645\u0629");
      }
      if (extracted.nationality && extracted.nationality.trim() && !matchedTenant.nationality) {
        tenantFieldsToUpdate.push("\u0627\u0644\u062C\u0646\u0633\u064A\u0629");
      }
      if (extracted.phone && (!matchedTenant.phone || matchedTenant.phone === "0500000000")) {
        tenantFieldsToUpdate.push("\u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644");
      }
      if (extracted.email && !matchedTenant.email) {
        tenantFieldsToUpdate.push("\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A");
      }
      if (extracted.employer && !matchedTenant.employer) {
        tenantFieldsToUpdate.push("\u062C\u0647\u0629 \u0627\u0644\u0639\u0645\u0644");
      }
    }
    const deedDigits = cleanDigits(extracted.deedNumber);
    const propNameNorm = norm(extracted.propertyNameAr || extracted.buildingName);
    let matchedProperty;
    let propertyReason = "";
    if (deedDigits.length >= 4) {
      matchedProperty = this.state.properties.find((p) => cleanDigits(p.deedNumber) === deedDigits);
      if (matchedProperty) propertyReason = "\u0645\u0637\u0627\u0628\u0642\u0629 \u0631\u0642\u0645 \u0627\u0644\u0635\u0643";
    }
    if (!matchedProperty && propNameNorm.length >= 3) {
      matchedProperty = this.state.properties.find(
        (p) => norm(p.nameAr) === propNameNorm || norm(p.nameAr).includes(propNameNorm) || propNameNorm.includes(norm(p.nameAr))
      );
      if (matchedProperty) propertyReason = "\u0645\u0637\u0627\u0628\u0642\u0629 \u0627\u0633\u0645 \u0627\u0644\u0639\u0642\u0627\u0631";
    }
    const propertyFieldsToUpdate = [];
    if (matchedProperty) {
      if (extracted.deedNumber && !matchedProperty.deedNumber) propertyFieldsToUpdate.push("\u0631\u0642\u0645 \u0627\u0644\u0635\u0643");
      if (extracted.city && !matchedProperty.city) propertyFieldsToUpdate.push("\u0627\u0644\u0645\u062F\u064A\u0646\u0629");
      if (extracted.district && !matchedProperty.district) propertyFieldsToUpdate.push("\u0627\u0644\u062D\u064A");
      if (extracted.street && !matchedProperty.street) propertyFieldsToUpdate.push("\u0627\u0644\u0634\u0627\u0631\u0639");
      if (extracted.nationalAddress && !matchedProperty.nationalAddress) propertyFieldsToUpdate.push("\u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0648\u0637\u0646\u064A");
    }
    let matchedUnit;
    if (extracted.unitNumber) {
      const unitNumNorm = norm(extracted.unitNumber);
      matchedUnit = this.state.units.find(
        (u) => (!matchedProperty || u.propertyId === matchedProperty.id) && norm(u.unitNumber) === unitNumNorm
      );
    }
    const hasTenantData = Boolean(extracted.tenantNameAr || extracted.nationalIdOrIqama);
    const hasPropertyData = Boolean(extracted.propertyNameAr || extracted.deedNumber);
    return {
      matchedTenant: matchedTenant ? {
        id: matchedTenant.id,
        nameAr: matchedTenant.nameAr,
        nationalIdOrIqama: matchedTenant.nationalIdOrIqama,
        matchReason: tenantReason,
        fieldsToUpdate: tenantFieldsToUpdate
      } : void 0,
      matchedProperty: matchedProperty ? {
        id: matchedProperty.id,
        nameAr: matchedProperty.nameAr,
        deedNumber: matchedProperty.deedNumber,
        matchReason: propertyReason,
        fieldsToUpdate: propertyFieldsToUpdate
      } : void 0,
      matchedUnit: matchedUnit ? {
        id: matchedUnit.id,
        unitNumber: matchedUnit.unitNumber,
        propertyId: matchedUnit.propertyId
      } : void 0,
      suggestedTenantAction: matchedTenant ? "update" : hasTenantData ? "create" : "none",
      suggestedPropertyAction: matchedProperty ? "update" : hasPropertyData ? "create" : "none"
    };
  }
  syncOcrToEntities(userId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_documents");
    const extracted = input.extracted;
    const matches = this.findOcrEntityMatches(extracted);
    const summary = {
      tenantAction: "skipped",
      tenantUpdatedFields: [],
      propertyAction: "skipped",
      propertyUpdatedFields: []
    };
    let linkedTenant;
    let linkedProperty;
    if (input.applyTenant !== false) {
      const targetId = input.targetTenantId || matches.matchedTenant?.id;
      if (targetId) {
        const tenant = this.state.tenants.find((t) => t.id === targetId);
        if (tenant) {
          const updatedFields = [];
          if (extracted.tenantNameAr?.trim() && (!tenant.nameAr || tenant.nameAr.length < 3)) {
            tenant.nameAr = extracted.tenantNameAr.trim();
            updatedFields.push("nameAr");
          }
          if (extracted.tenantNameEn?.trim() && (!tenant.nameEn || tenant.nameEn === tenant.nameAr)) {
            tenant.nameEn = extracted.tenantNameEn.trim();
            updatedFields.push("nameEn");
          }
          if (extracted.nationalIdOrIqama?.trim() && !tenant.nationalIdOrIqama) {
            tenant.nationalIdOrIqama = extracted.nationalIdOrIqama.trim();
            updatedFields.push("nationalIdOrIqama");
          }
          if (extracted.nationality?.trim() && (!tenant.nationality || tenant.nationality === "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F")) {
            tenant.nationality = extracted.nationality.trim();
            updatedFields.push("nationality");
          }
          if (extracted.phone?.trim() && (!tenant.phone || tenant.phone === "0500000000")) {
            tenant.phone = extracted.phone.trim();
            updatedFields.push("phone");
          }
          if (extracted.email?.trim() && !tenant.email) {
            tenant.email = extracted.email.trim();
            updatedFields.push("email");
          }
          if (extracted.employer?.trim() && !tenant.employer) {
            tenant.employer = extracted.employer.trim();
            updatedFields.push("employer");
          }
          if (!tenant.onboardingChecklist) {
            tenant.onboardingChecklist = {
              idVerified: false,
              docsArchived: false,
              depositPaid: false,
              contractSigned: false,
              ejarRegistered: false,
              handoverSigned: false
            };
          }
          if (extracted.docType === "\u0647\u0648\u064A\u0629 / \u0625\u0642\u0627\u0645\u0629" || extracted.nationalIdOrIqama) {
            tenant.onboardingChecklist.idVerified = true;
            updatedFields.push("idVerified");
          }
          tenant.onboardingChecklist.docsArchived = true;
          linkedTenant = tenant;
          summary.tenantAction = "updated";
          summary.tenantId = tenant.id;
          summary.tenantName = tenant.nameAr;
          summary.tenantUpdatedFields = updatedFields;
          this.addAudit(
            user,
            "\u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0633\u062A\u0623\u062C\u0631 \u0622\u0644\u064A\u0627\u064B \u0645\u0646 OCR",
            "Tenant",
            tenant.id,
            `\u0631\u0628\u0637 \u0646\u062A\u0627\u0626\u062C Gemini OCR \u0628\u0645\u0644\u0641 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${tenant.nameAr} (${updatedFields.join(", ") || "\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0647\u0648\u064A\u0629 \u0648\u0627\u0644\u0623\u0631\u0634\u0641\u0629"})`,
            { deviceName }
          );
        }
      } else if (input.createMissing !== false && (extracted.tenantNameAr || extracted.nationalIdOrIqama) && this.userHasPermission(user, "manage_tenants")) {
        const tenant = this.createTenant(
          userId,
          {
            nameAr: extracted.tenantNameAr?.trim() || `\u0645\u0633\u062A\u0623\u062C\u0631 ${extracted.nationalIdOrIqama}`,
            nameEn: extracted.tenantNameEn?.trim() || extracted.tenantNameAr?.trim() || "",
            nationalIdOrIqama: extracted.nationalIdOrIqama?.trim() || `TMP-${Date.now().toString().slice(-6)}`,
            nationality: extracted.nationality?.trim() || "\u0633\u0639\u0648\u062F\u064A",
            phone: extracted.phone?.trim() || "0500000000",
            email: extracted.email?.trim() || "",
            employer: extracted.employer?.trim() || "",
            classification: extracted.docType === "\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631" ? "\u0646\u0634\u0637" : "\u0645\u062D\u062A\u0645\u0644",
            rating: 4,
            onboardingChecklist: {
              idVerified: Boolean(extracted.nationalIdOrIqama),
              docsArchived: true,
              depositPaid: false,
              contractSigned: extracted.docType === "\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631",
              ejarRegistered: Boolean(extracted.ejarNumber),
              handoverSigned: false
            },
            notes: `\u062A\u0645 \u0625\u0646\u0634\u0627\u0624\u0647 \u0648\u0631\u0628\u0637 \u062D\u0642\u0648\u0644\u0647 \u0622\u0644\u064A\u0627\u064B \u0639\u0628\u0631 Gemini OCR (${extracted.docType})`
          },
          deviceName
        );
        linkedTenant = tenant;
        summary.tenantAction = "created";
        summary.tenantId = tenant.id;
        summary.tenantName = tenant.nameAr;
        summary.tenantUpdatedFields = ["nameAr", "nationalIdOrIqama", "nationality", "phone", "employer"];
      }
    }
    if (input.applyProperty !== false) {
      const targetPropId = input.targetPropertyId || matches.matchedProperty?.id;
      if (targetPropId) {
        const prop = this.state.properties.find((p) => p.id === targetPropId);
        if (prop) {
          const updatedFields = [];
          if (extracted.deedNumber?.trim() && !prop.deedNumber) {
            prop.deedNumber = extracted.deedNumber.trim();
            updatedFields.push("deedNumber");
          }
          if (extracted.city?.trim() && (!prop.city || prop.city === "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F")) {
            prop.city = extracted.city.trim();
            updatedFields.push("city");
          }
          if (extracted.district?.trim() && (!prop.district || prop.district === "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F")) {
            prop.district = extracted.district.trim();
            updatedFields.push("district");
          }
          if (extracted.street?.trim() && !prop.street) {
            prop.street = extracted.street.trim();
            updatedFields.push("street");
          }
          if (extracted.nationalAddress?.trim() && !prop.nationalAddress) {
            prop.nationalAddress = extracted.nationalAddress.trim();
            updatedFields.push("nationalAddress");
          }
          linkedProperty = prop;
          summary.propertyAction = "updated";
          summary.propertyId = prop.id;
          summary.propertyName = prop.nameAr;
          summary.propertyUpdatedFields = updatedFields;
          this.addAudit(
            user,
            "\u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0639\u0642\u0627\u0631 \u0622\u0644\u064A\u0627\u064B \u0645\u0646 OCR",
            "Property",
            prop.id,
            `\u0631\u0628\u0637 \u0646\u062A\u0627\u0626\u062C Gemini OCR \u0628\u0627\u0644\u0639\u0642\u0627\u0631 ${prop.nameAr} (${updatedFields.join(", ") || "\u062A\u062D\u0642\u0642 \u0627\u0644\u0635\u0643 \u0648\u0627\u0644\u0645\u0648\u0642\u0639"})`,
            { deviceName }
          );
        }
      } else if (input.createMissing !== false && (extracted.propertyNameAr || extracted.deedNumber) && this.userHasPermission(user, "manage_properties")) {
        const propName = extracted.propertyNameAr?.trim() || extracted.buildingName?.trim() || `\u0639\u0642\u0627\u0631 \u0635\u0643 ${extracted.deedNumber}`;
        const prop = this.createProperty(
          userId,
          {
            companyId: this.state.companies?.[0]?.id,
            ownershipMode: "\u0625\u062F\u0627\u0631\u0629 \u0644\u0644\u063A\u064A\u0631",
            code: `PRP-OCR-${Math.floor(100 + Math.random() * 899)}`,
            nameAr: propName,
            nameEn: propName,
            city: extracted.city?.trim() || "\u0627\u0644\u0631\u064A\u0627\u0636",
            district: extracted.district?.trim() || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F",
            street: extracted.street?.trim() || "",
            nationalAddress: extracted.nationalAddress?.trim() || "",
            type: "\u0633\u0643\u0646\u064A",
            deedNumber: extracted.deedNumber?.trim() || "",
            status: "\u0646\u0634\u0637",
            buildingsCount: 1,
            floorsCount: 3,
            managementFeePercent: this.state.settings.defaultManagementFeePercent || 5,
            ownerShares: this.state.owners[0] ? [{ ownerId: this.state.owners[0].id, sharePercent: 100 }] : [],
            electricityMeterMain: "",
            waterMeterMain: "",
            caretakerName: "",
            caretakerPhone: ""
          },
          deviceName
        );
        linkedProperty = prop;
        summary.propertyAction = "created";
        summary.propertyId = prop.id;
        summary.propertyName = prop.nameAr;
        summary.propertyUpdatedFields = ["nameAr", "deedNumber", "city", "district", "street", "nationalAddress"];
      }
    }
    let linkedDoc;
    if (input.docId) {
      const doc = this.state.documents.find((d) => d.id === input.docId);
      if (doc) {
        if (linkedTenant && (extracted.docType === "\u0647\u0648\u064A\u0629 / \u0625\u0642\u0627\u0645\u0629" || !linkedProperty)) {
          doc.relatedType = "\u0645\u0633\u062A\u0623\u062C\u0631";
          doc.relatedId = linkedTenant.id;
        } else if (linkedProperty) {
          doc.relatedType = "\u0639\u0642\u0627\u0631";
          doc.relatedId = linkedProperty.id;
        }
        linkedDoc = doc;
      }
    }
    this.persist();
    return {
      summary,
      tenant: linkedTenant,
      property: linkedProperty,
      doc: linkedDoc
    };
  }
  resetToFreshWorkspace(userId, deviceName) {
    const user = this.assertPermission(userId, "manage_properties");
    if (this.state.properties.length > 0 || this.state.payments.length > 0) {
      this.createBackup(userId, "\u0646\u0633\u062E\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0629 \u0642\u0628\u0644 \u0627\u0644\u0625\u0639\u062F\u0627\u062F \u0627\u0644\u0623\u0648\u0644\u064A", deviceName);
    }
    this.state.properties = [];
    this.state.units = [];
    this.state.meterReadings = [];
    this.state.tenants = [];
    this.state.leads = [];
    this.state.leadEscalations = [];
    this.state.contracts = [];
    this.state.handovers = [];
    this.state.installments = [];
    this.state.payments = [];
    this.state.journals = [];
    this.state.expenses = [];
    this.state.supplierInvoices = [];
    this.state.recurringExpenses = [];
    this.state.propertyBudgets = [];
    this.state.assets = [];
    this.state.tickets = [];
    this.state.tasks = [];
    this.state.communications = [];
    this.state.documents = [];
    this.state.purchaseOrders = [];
    this.state.decisions = [];
    this.state.notifications = [];
    this.state.reminderLogs = [];
    this.state.accounts = this.state.accounts.map((acc) => ({ ...acc, balance: 0 }));
    this.state.counters = {
      receipt: 1,
      contract: 1,
      ticket: 1,
      expense: 1,
      journal: 1
    };
    this.addAudit(
      user,
      "\u062A\u0647\u064A\u0626\u0629 \u0645\u0633\u0627\u062D\u0629 \u0639\u0645\u0644 \u062C\u062F\u064A\u062F\u0629",
      "Workspace",
      "fresh-onboarding",
      "\u0628\u062F\u0621 \u0645\u0633\u0627\u062D\u0629 \u0639\u0645\u0644 \u0646\u0638\u064A\u0641\u0629 \u0639\u0628\u0631 \u0631\u062D\u0644\u0629 \u0627\u0644\u0625\u0639\u062F\u0627\u062F \u0627\u0644\u0623\u0648\u0644\u064A",
      { deviceName }
    );
    this.state.archiveSeeded = true;
    this.persist();
    return this.getStateForUser(userId);
  }
  // 14. Smart Archive Center (Manual Archive, Restore with Conflict Check, Scheduled Job, Saved Filters)
  assertArchiveAccess(user, category, action) {
    const allowedByRole = {
      sys_owner: ["contracts", "tenants", "receipts", "tickets", "documents", "units"],
      gm: ["contracts", "tenants", "receipts", "tickets", "documents", "units"],
      accountant: ["contracts", "receipts"],
      supervisor: ["units", "tenants"],
      leasing: ["tenants"],
      maint_manager: ["tickets", "units"],
      technician: ["tickets"],
      receptionist: ["tenants", "documents"],
      auditor: ["contracts", "tenants", "receipts", "tickets", "documents", "units"],
      owner: ["contracts", "receipts", "units"]
    };
    const allowed = allowedByRole[user.role] || [];
    if (!allowed.includes(category)) {
      throw new Error(`\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0642\u0633\u0645 \u0627\u0644\u0623\u0631\u0634\u064A\u0641 (${category})`);
    }
    if (action === "write" && (user.role === "owner" || user.role === "auditor" || user.role === "leasing" && category !== "tenants")) {
      throw new Error("\u0635\u0644\u0627\u062D\u064A\u062A\u0643 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645 \u0644\u0644\u0639\u0631\u0636 \u0627\u0644\u0645\u0631\u062C\u0639\u064A \u0641\u0642\u0637");
    }
  }
  archiveEntity(userId, input, deviceName) {
    return this.runTransaction(() => {
      const user = this.getActingUser(userId);
      this.assertArchiveAccess(user, input.category, "write");
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const reason = (input.reason || "").trim() || "\u0646\u0642\u0644 \u064A\u062F\u0648\u064A \u0644\u0644\u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u0630\u0643\u064A";
      let summary = "";
      if (input.category === "contracts") {
        const ctr = this.state.contracts.find((c) => c.id === input.entityId);
        if (!ctr) throw new Error("\u0627\u0644\u0639\u0642\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
        ctr.preArchiveStatus = ctr.lifecycleStatus;
        if (ctr.lifecycleStatus === "\u0646\u0634\u0637" || ctr.lifecycleStatus === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u062C\u062F\u064A\u062F" || ctr.lifecycleStatus === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0648\u062B\u064A\u0642") {
          ctr.lifecycleStatus = "\u0645\u0646\u062A\u0647\u064A";
          const unit = this.state.units.find((u) => u.id === ctr.unitId);
          if (unit && unit.status === "\u0645\u0624\u062C\u0631\u0629") {
            unit.status = "\u0634\u0627\u063A\u0631\u0629";
            unit.vacantSince = now.slice(0, 10);
          }
        }
        ctr.archivedAt = now;
        ctr.archivedBy = user.id;
        ctr.archiveMode = "\u064A\u062F\u0648\u064A";
        ctr.archiveReason = reason;
        summary = `\u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0639\u0642\u062F ${ctr.internalNumber}`;
      } else if (input.category === "tenants") {
        const ten = this.state.tenants.find((t) => t.id === input.entityId);
        if (!ten) throw new Error("\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
        const hasActiveCtr = this.state.contracts.some(
          (c) => c.tenantId === ten.id && (c.lifecycleStatus === "\u0646\u0634\u0637" || c.lifecycleStatus === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0648\u062B\u064A\u0642")
        );
        if (hasActiveCtr) throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0623\u0631\u0634\u0641\u0629 \u0645\u0633\u062A\u0623\u062C\u0631 \u0644\u062F\u064A\u0647 \u0639\u0642\u062F \u0646\u0634\u0637 \u062D\u0627\u0644\u064A\u0627\u064B\u061B \u0642\u0645 \u0628\u0625\u0646\u0647\u0627\u0621 \u0623\u0648 \u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0639\u0642\u062F \u0623\u0648\u0644\u0627\u064B");
        ten.preArchiveStatus = ten.classification;
        ten.classification = "\u0633\u0627\u0628\u0642";
        ten.archivedAt = now;
        ten.archivedBy = user.id;
        ten.archiveMode = "\u064A\u062F\u0648\u064A";
        ten.archiveReason = reason;
        summary = `\u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${ten.nameAr}`;
      } else if (input.category === "receipts") {
        const pay = this.state.payments.find((p) => p.id === input.entityId);
        if (!pay) throw new Error("\u0627\u0644\u0625\u064A\u0635\u0627\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
        pay.preArchiveStatus = pay.status;
        pay.archivedAt = now;
        pay.archivedBy = user.id;
        pay.archiveMode = "\u064A\u062F\u0648\u064A";
        pay.archiveReason = reason;
        summary = `\u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0625\u064A\u0635\u0627\u0644 ${pay.receiptNumber}`;
      } else if (input.category === "tickets") {
        if (input.targetKind === "task") {
          const tsk = this.state.tasks.find((t) => t.id === input.entityId);
          if (!tsk) throw new Error("\u0627\u0644\u0645\u0647\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
          tsk.preArchiveStatus = tsk.status;
          tsk.status = "\u0645\u0643\u062A\u0645\u0644\u0629";
          tsk.archivedAt = now;
          tsk.archivedBy = user.id;
          tsk.archiveMode = "\u064A\u062F\u0648\u064A";
          tsk.archiveReason = reason;
          summary = `\u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0645\u0647\u0645\u0629 "${tsk.title}"`;
        } else {
          const tkt = this.state.tickets.find((t) => t.id === input.entityId);
          if (!tkt) throw new Error("\u0627\u0644\u0628\u0644\u0627\u063A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
          tkt.preArchiveStatus = tkt.status;
          if (tkt.status !== "\u0645\u0643\u062A\u0645\u0644" && tkt.status !== "\u0645\u063A\u0644\u0642") tkt.status = "\u0645\u063A\u0644\u0642";
          tkt.archivedAt = now;
          tkt.archivedBy = user.id;
          tkt.archiveMode = "\u064A\u062F\u0648\u064A";
          tkt.archiveReason = reason;
          summary = `\u0623\u0631\u0634\u0641\u0629 \u0628\u0644\u0627\u063A \u0627\u0644\u0635\u064A\u0627\u0646\u0629 ${tkt.ticketNumber}`;
        }
      } else if (input.category === "documents") {
        const doc = this.state.documents.find((d) => d.id === input.entityId);
        if (!doc) throw new Error("\u0627\u0644\u0645\u0633\u062A\u0646\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
        doc.preArchiveStatus = "\u0646\u0634\u0637";
        doc.archivedAt = now;
        doc.archivedBy = user.id;
        doc.archiveMode = "\u064A\u062F\u0648\u064A";
        doc.archiveReason = reason;
        summary = `\u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0645\u0633\u062A\u0646\u062F "${doc.title}"`;
      } else if (input.category === "units") {
        const unit = this.state.units.find((u) => u.id === input.entityId);
        if (!unit) throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
        const hasActiveCtr = this.state.contracts.some(
          (c) => c.unitId === unit.id && (c.lifecycleStatus === "\u0646\u0634\u0637" || c.lifecycleStatus === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0648\u062B\u064A\u0642")
        );
        if (hasActiveCtr) throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u062E\u0631\u0627\u062C \u0648\u062D\u062F\u0629 \u0645\u0624\u062C\u0631\u0629 \u0628\u0639\u0642\u062F \u0646\u0634\u0637 \u0644\u0644\u0623\u0631\u0634\u064A\u0641 \u0642\u0628\u0644 \u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0639\u0642\u062F");
        unit.preArchiveStatus = unit.status;
        unit.status = "\u0645\u0624\u0631\u0634\u0641\u0629";
        unit.archivedAt = now;
        unit.archivedBy = user.id;
        unit.archiveMode = "\u064A\u062F\u0648\u064A";
        unit.archiveReason = reason;
        summary = `\u0646\u0642\u0644 \u0627\u0644\u0648\u062D\u062F\u0629 ${unit.unitNumber} \u0625\u0644\u0649 \u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u0648\u062D\u062F\u0627\u062A \u0627\u0644\u0645\u062A\u0648\u0642\u0641\u0629`;
      }
      this.addAudit(user, "\u0646\u0642\u0644 \u0625\u0644\u0649 \u0627\u0644\u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u0630\u0643\u064A", input.category, input.entityId, `${summary} \u2014 \u0627\u0644\u0633\u0628\u0628: ${reason}`, {
        reason,
        newValue: "\u0645\u0624\u0631\u0634\u0641",
        deviceName
      });
      this.writeArchiveBundleToDisk();
      this.persist();
      return { archivedAt: now, summary };
    });
  }
  restoreArchivedEntity(userId, input, deviceName) {
    return this.runTransaction(() => {
      const user = this.getActingUser(userId);
      this.assertArchiveAccess(user, input.category, "write");
      const reason = (input.reason || "").trim() || "\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0645\u0646 \u0627\u0644\u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u0630\u0643\u064A";
      let restoredSummary = "";
      let referenceOnly = Boolean(input.referenceOnly);
      if (input.category === "contracts") {
        const ctr = this.state.contracts.find((c) => c.id === input.entityId);
        if (!ctr) throw new Error("\u0627\u0644\u0639\u0642\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
        const conflictingActive = this.state.contracts.find(
          (c) => c.id !== ctr.id && c.unitId === ctr.unitId && (c.lifecycleStatus === "\u0646\u0634\u0637" || c.lifecycleStatus === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0648\u062B\u064A\u0642")
        );
        if (conflictingActive && !input.referenceOnly) {
          throw new Error(
            `CONFLICT_ACTIVE_CONTRACT: \u0627\u0644\u0648\u062D\u062F\u0629 \u0645\u0631\u062A\u0628\u0637\u0629 \u062D\u0627\u0644\u064A\u0627\u064B \u0628\u0639\u0642\u062F \u0623\u062D\u062F\u062B (${conflictingActive.internalNumber}). \u064A\u0645\u0643\u0646\u0643 \u0627\u0633\u062A\u0639\u0627\u062F\u062A\u0647 \u0643\u0633\u062C\u0644 \u0645\u0631\u062C\u0639\u064A \u0641\u0642\u0637.`
          );
        }
        if (referenceOnly) {
          ctr.restoredAsReference = true;
          ctr.archivedAt = void 0;
          ctr.archiveReason = void 0;
          ctr.lifecycleStatus = "\u0645\u0646\u062A\u0647\u064A";
          restoredSummary = `\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0639\u0642\u062F ${ctr.internalNumber} \u0643\u0633\u062C\u0644 \u0645\u0631\u062C\u0639\u064A \u0641\u0642\u0637`;
        } else {
          ctr.lifecycleStatus = ctr.preArchiveStatus === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0648\u062B\u064A\u0642" || ctr.preArchiveStatus === "\u0646\u0634\u0637" ? ctr.preArchiveStatus : "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u062C\u062F\u064A\u062F";
          ctr.archivedAt = void 0;
          ctr.archiveReason = void 0;
          ctr.restoredAsReference = false;
          const unit = this.state.units.find((u) => u.id === ctr.unitId);
          if (unit && ctr.lifecycleStatus === "\u0646\u0634\u0637") {
            unit.status = "\u0645\u0624\u062C\u0631\u0629";
          }
          restoredSummary = `\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0639\u0642\u062F ${ctr.internalNumber} \u0625\u0644\u0649 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0639\u0642\u0648\u062F (${ctr.lifecycleStatus})`;
        }
      } else if (input.category === "tenants") {
        const ten = this.state.tenants.find((t) => t.id === input.entityId);
        if (!ten) throw new Error("\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
        ten.classification = ten.preArchiveStatus === "\u0645\u062D\u062A\u0645\u0644" ? "\u0645\u062D\u062A\u0645\u0644" : "\u0646\u0634\u0637";
        ten.archivedAt = void 0;
        ten.archiveReason = void 0;
        restoredSummary = `\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0645\u0644\u0641 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${ten.nameAr} \u0625\u0644\u0649 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0646\u0634\u0637`;
      } else if (input.category === "receipts") {
        const pay = this.state.payments.find((p) => p.id === input.entityId);
        if (!pay) throw new Error("\u0627\u0644\u0625\u064A\u0635\u0627\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
        if (pay.status === "\u0645\u0639\u0643\u0648\u0633") {
          referenceOnly = true;
          pay.archivedAt = void 0;
          restoredSummary = `\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0625\u064A\u0635\u0627\u0644 \u0627\u0644\u0645\u0639\u0643\u0648\u0633 ${pay.receiptNumber} \u0644\u0644\u0639\u0631\u0636 \u0627\u0644\u0645\u0631\u062C\u0639\u064A \u062F\u0648\u0646 \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0623\u0631\u0635\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0633\u0628\u064A\u0629`;
        } else {
          pay.archivedAt = void 0;
          pay.archiveReason = void 0;
          restoredSummary = `\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0625\u064A\u0635\u0627\u0644 ${pay.receiptNumber} \u0645\u0646 \u0627\u0644\u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u0645\u0627\u0644\u064A`;
        }
      } else if (input.category === "tickets") {
        if (input.targetKind === "task") {
          const tsk = this.state.tasks.find((t) => t.id === input.entityId);
          if (!tsk) throw new Error("\u0627\u0644\u0645\u0647\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
          tsk.status = "\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630";
          tsk.archivedAt = void 0;
          tsk.archiveReason = void 0;
          restoredSummary = `\u0625\u0639\u0627\u062F\u0629 \u0641\u062A\u062D \u0627\u0644\u0645\u0647\u0645\u0629 "${tsk.title}"`;
        } else {
          const tkt = this.state.tickets.find((t) => t.id === input.entityId);
          if (!tkt) throw new Error("\u0627\u0644\u0628\u0644\u0627\u063A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
          tkt.status = "\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630";
          tkt.archivedAt = void 0;
          tkt.archiveReason = void 0;
          tkt.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          restoredSummary = `\u0625\u0639\u0627\u062F\u0629 \u0641\u062A\u062D \u0628\u0644\u0627\u063A \u0627\u0644\u0635\u064A\u0627\u0646\u0629 ${tkt.ticketNumber}`;
        }
      } else if (input.category === "documents") {
        const doc = this.state.documents.find((d) => d.id === input.entityId);
        if (!doc) throw new Error("\u0627\u0644\u0645\u0633\u062A\u0646\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
        doc.archivedAt = void 0;
        doc.archiveReason = void 0;
        restoredSummary = `\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u0633\u062A\u0646\u062F "${doc.title}" \u0644\u0644\u0645\u0633\u062A\u0646\u062F\u0627\u062A \u0627\u0644\u0646\u0634\u0637\u0629`;
      } else if (input.category === "units") {
        const unit = this.state.units.find((u) => u.id === input.entityId);
        if (!unit) throw new Error("\u0627\u0644\u0648\u062D\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
        unit.status = "\u0634\u0627\u063A\u0631\u0629";
        unit.vacantSince = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        unit.archivedAt = void 0;
        unit.archiveReason = void 0;
        restoredSummary = `\u0625\u0639\u0627\u062F\u0629 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0648\u062D\u062F\u0629 ${unit.unitNumber} \u0643\u0648\u062D\u062F\u0629 \u0634\u0627\u063A\u0631\u0629`;
      }
      this.addAudit(user, "\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0645\u0646 \u0627\u0644\u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u0630\u0643\u064A", input.category, input.entityId, `${restoredSummary} \u2014 ${reason}`, {
        reason,
        newValue: referenceOnly ? "\u0633\u062C\u0644 \u0645\u0631\u062C\u0639\u064A" : "\u0646\u0634\u0637",
        deviceName
      });
      this.persist();
      return { restoredSummary, referenceOnly };
    });
  }
  runScheduledArchival(userId, deviceName) {
    return this.runTransaction(() => {
      const user = this.assertPermission(userId, "manage_contracts");
      const now = /* @__PURE__ */ new Date();
      const nowIso = now.toISOString();
      const todayStr = nowIso.slice(0, 10);
      const oneYearAgoMs = now.getTime() - 365 * 864e5;
      const thirtyDaysAgoMs = now.getTime() - 30 * 864e5;
      let count = 0;
      for (const ctr of this.state.contracts) {
        if (!ctr.archivedAt && (ctr.lifecycleStatus === "\u0645\u0646\u062A\u0647\u064A" || ctr.lifecycleStatus === "\u0645\u0646\u062A\u0647\u064D \u0628\u0627\u0644\u0625\u062E\u0644\u0627\u0621" || ctr.lifecycleStatus === "\u0645\u0644\u063A\u064A")) {
          ctr.archivedAt = nowIso;
          ctr.archiveMode = "\u0645\u062C\u062F\u0648\u0644";
          ctr.archiveReason = ctr.archiveReason || "\u0623\u0631\u0634\u0641\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0629 \u0644\u0639\u0642\u062F \u0645\u0646\u062A\u0647\u064A";
          count += 1;
        } else if (!ctr.archivedAt && ctr.endDate < todayStr && !ctr.restoredAsReference && ctr.lifecycleStatus === "\u0646\u0634\u0637") {
          ctr.preArchiveStatus = ctr.lifecycleStatus;
          ctr.lifecycleStatus = "\u0645\u0646\u062A\u0647\u064A";
          ctr.archivedAt = nowIso;
          ctr.archiveMode = "\u0645\u062C\u062F\u0648\u0644";
          ctr.archiveReason = "\u0627\u0646\u062A\u0647\u0627\u0621 \u0645\u062F\u0629 \u0627\u0644\u0639\u0642\u062F (\u0623\u0631\u0634\u0641\u0629 \u0644\u064A\u0644\u064A\u0629 \u0645\u062C\u062F\u0648\u0644\u0629)";
          count += 1;
        }
      }
      for (const pay of this.state.payments) {
        const payTime = new Date(pay.createdAt).getTime();
        if (!pay.archivedAt && (pay.status === "\u0645\u0639\u0643\u0648\u0633" || payTime < oneYearAgoMs)) {
          pay.archivedAt = nowIso;
          pay.archiveMode = "\u0645\u062C\u062F\u0648\u0644";
          pay.archiveReason = pay.status === "\u0645\u0639\u0643\u0648\u0633" ? "\u0633\u0646\u062F \u0645\u0639\u0643\u0648\u0633 \u0645\u062D\u0627\u0633\u0628\u064A\u0627\u064B" : "\u0625\u0642\u0641\u0627\u0644 \u0633\u0646\u0629 \u0645\u0627\u0644\u064A\u0629 \u0633\u0627\u0628\u0642\u0629 (> \u0633\u0646\u0629)";
          count += 1;
        }
      }
      for (const doc of this.state.documents) {
        if (!doc.archivedAt && doc.expiryDate && doc.expiryDate < todayStr) {
          doc.archivedAt = nowIso;
          doc.archiveMode = "\u0645\u062C\u062F\u0648\u0644";
          doc.archiveReason = "\u0627\u0646\u062A\u0647\u0627\u0621 \u062A\u0627\u0631\u064A\u062E \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0648\u062B\u064A\u0642\u0629";
          count += 1;
        }
      }
      for (const tkt of this.state.tickets) {
        const updTime = new Date(tkt.updatedAt).getTime();
        if (!tkt.archivedAt && (tkt.status === "\u0645\u0643\u062A\u0645\u0644" || tkt.status === "\u0645\u063A\u0644\u0642") && updTime < thirtyDaysAgoMs) {
          tkt.archivedAt = nowIso;
          tkt.archiveMode = "\u0645\u062C\u062F\u0648\u0644";
          tkt.archiveReason = "\u0623\u0631\u0634\u0641\u0629 \u062F\u0648\u0631\u064A\u0629 \u0644\u0628\u0644\u0627\u063A \u0645\u0646\u062C\u0632";
          count += 1;
        }
      }
      this.state.archiveLastNightlyRun = nowIso;
      const summary = count > 0 ? `\u062A\u0645 \u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u062C\u062F\u0648\u0644\u0629 \u0627\u0644\u0644\u064A\u0644\u064A\u0629 \u0648\u0646\u0642\u0644 ${count} \u0633\u062C\u0644 \u0645\u0646\u062A\u0647\u064A \u0625\u0644\u0649 \u0627\u0644\u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u0630\u0643\u064A` : "\u062A\u0645 \u0641\u062D\u0635 \u0643\u0627\u0641\u0629 \u0627\u0644\u0633\u062C\u0644\u0627\u062A \u0648\u0644\u0627 \u062A\u0648\u062C\u062F \u0639\u0646\u0627\u0635\u0631 \u0645\u0646\u062A\u0647\u064A\u0629 \u062C\u062F\u064A\u062F\u0629 \u0644\u0644\u0623\u0631\u0634\u0641\u0629";
      this.addAudit(user, "\u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0644\u064A\u0644\u064A\u0629 \u0627\u0644\u0645\u062C\u062F\u0648\u0644\u0629", "SmartArchive", "nightly-job", summary, { deviceName });
      this.persist();
      return { archivedCount: count, summary };
    });
  }
  saveArchiveFilter(userId, input, deviceName) {
    const user = this.getActingUser(userId);
    if (!this.state.savedArchiveFilters) this.state.savedArchiveFilters = [];
    const filter = {
      ...input,
      id: uid("af"),
      createdBy: user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.savedArchiveFilters.unshift(filter);
    this.addAudit(user, "\u062D\u0641\u0638 \u0641\u0644\u062A\u0631 \u0628\u062D\u062B \u0641\u064A \u0627\u0644\u0623\u0631\u0634\u064A\u0641", "SavedArchiveFilter", filter.id, `\u062D\u0641\u0638 \u0627\u0644\u0641\u0644\u062A\u0631 "${filter.name}"`, {
      deviceName
    });
    this.persist();
    return filter;
  }
  deleteArchiveFilter(userId, filterId) {
    this.getActingUser(userId);
    this.state.savedArchiveFilters = (this.state.savedArchiveFilters || []).filter((f) => f.id !== filterId);
    this.persist();
  }
  // 15. Team & Workforce Management (Users, 5-Level Permissions, Property Scope, Security Policy, Conflicts)
  createStaffUser(userId, input, deviceName) {
    const actor = this.assertPermission(userId, "manage_users");
    if (actor.role !== "sys_owner") {
      throw new Error("\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646 \u0627\u0644\u062C\u062F\u062F \u0635\u0644\u0627\u062D\u064A\u0629 \u062D\u0635\u0631\u064A\u0629 \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645 (System Owner) \u0641\u0642\u0637");
    }
    if (!input.nameAr?.trim() || !input.phone?.trim()) {
      throw new Error("\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644 \u0648\u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644 \u0645\u0637\u0644\u0648\u0628\u0627\u0646 \u0644\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0648\u0638\u0641");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newUser = {
      id: uid("usr"),
      nameAr: input.nameAr.trim(),
      nameEn: (input.nameEn || input.nameAr).trim(),
      role: input.role,
      roleLabelAr: input.roleLabelAr,
      roleLabelEn: input.roleLabelEn,
      email: input.email?.trim() || `staff-${Date.now().toString().slice(-4)}@aqarplus.sa`,
      phone: input.phone.trim(),
      approvalLimitSar: Number(input.approvalLimitSar || 0),
      active: true,
      deviceName: "\u062C\u0647\u0627\u0632 \u0645\u0633\u062C\u0644 \u062C\u062F\u064A\u062F \xB7 \u0648\u064A\u0628/\u062C\u0648\u0627\u0644",
      lastActiveAt: now,
      statusState: "\u0645\u062A\u0635\u0644",
      specialty: input.specialty?.trim() || input.roleLabelAr,
      avatarDataUrl: input.avatarDataUrl,
      allowedPropertyIds: input.allowedPropertyIds && input.allowedPropertyIds.length > 0 ? input.allowedPropertyIds : void 0,
      customModulePermissions: input.customModulePermissions,
      managerRating: 5,
      lastActivitySummary: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062D\u0633\u0627\u0628 \u0648\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A",
      security: {
        twoFactorEnabled: Boolean(input.twoFactorEnabled),
        biometricEnabled: Boolean(input.biometricEnabled),
        failedAttempts: 0,
        lastPasswordChangedAt: now,
        requirePasswordChange90d: true,
        tempPasswordSet: true
      },
      notificationPrefs: {
        dndEnabled: false,
        taskAssigned: true,
        taskReminder: true,
        taskApproved: true,
        taskComment: true,
        urgentTicket: true
      }
    };
    this.state.users.push(newUser);
    this.sqlite.updateUserCredentials(newUser.id, {
      password: input.tempPassword || "Aqar@2026",
      pin: "1234"
    });
    this.addAudit(
      actor,
      "\u0625\u0636\u0627\u0641\u0629 \u0645\u0648\u0638\u0641 \u062C\u062F\u064A\u062F",
      "StaffUser",
      newUser.id,
      `\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0648\u0638\u0641 ${newUser.nameAr} \u0628\u062F\u0648\u0631 (${newUser.roleLabelAr})${newUser.allowedPropertyIds ? ` \xB7 \u0645\u0642\u064A\u062F \u0628\u0640 ${newUser.allowedPropertyIds.length} \u0639\u0642\u0627\u0631\u0627\u062A` : ""}`,
      { newValue: newUser.roleLabelAr, deviceName }
    );
    this.addNotification(
      `\u0627\u0646\u0636\u0645\u0627\u0645 \u0645\u0648\u0638\u0641 \u062C\u062F\u064A\u062F: ${newUser.nameAr}`,
      `New staff added: ${newUser.nameEn}`,
      `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 ${newUser.nameAr} (${newUser.roleLabelAr}) \u0648\u0625\u0631\u0633\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0645\u0624\u0642\u062A\u0629.`,
      `${newUser.nameEn} joined as ${newUser.roleLabelEn}.`,
      "\u0625\u062F\u0627\u0631\u064A\u0629",
      ["gm", "sys_owner"],
      "team"
    );
    this.persist();
    return newUser;
  }
  deleteStaffUser(userId, targetUserId, deviceName) {
    const actor = this.assertPermission(userId, "manage_users");
    if (actor.role !== "sys_owner") {
      throw new Error("\u062D\u0630\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646 \u0635\u0644\u0627\u062D\u064A\u0629 \u062D\u0635\u0631\u064A\u0629 \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645 (System Owner) \u0641\u0642\u0637");
    }
    if (actor.id === targetUserId) {
      throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628\u0643 \u0627\u0644\u062D\u0627\u0644\u064A");
    }
    const target = this.state.users.find((u) => u.id === targetUserId);
    if (!target) throw new Error("\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    if (target.role === "sys_owner") {
      const ownerCount = this.state.users.filter((u) => u.role === "sys_owner").length;
      if (ownerCount <= 1) {
        throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0648\u062D\u064A\u062F");
      }
    }
    this.state.users = this.state.users.filter((u) => u.id !== targetUserId);
    this.addAudit(
      actor,
      "\u062D\u0630\u0641 \u062D\u0633\u0627\u0628 \u0645\u0633\u062A\u062E\u062F\u0645",
      "StaffUser",
      targetUserId,
      `\u062D\u0630\u0641 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${target.nameAr} (${target.roleLabelAr}) \u0628\u0648\u0627\u0633\u0637\u0629 \u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645`,
      { oldValue: target.roleLabelAr, deviceName }
    );
    this.persist();
    return { deletedId: targetUserId };
  }
  updateStaffUser(userId, targetUserId, patch, deviceName) {
    const actor = this.getActingUser(userId);
    const target = this.state.users.find((u) => u.id === targetUserId);
    if (!target) throw new Error("\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const touchesPermissionsOrGovernance = patch.role !== void 0 || patch.active !== void 0 || patch.allowedPropertyIds !== void 0 || patch.customModulePermissions !== void 0 || patch.approvalLimitSar !== void 0;
    if (actor.id === targetUserId && touchesPermissionsOrGovernance) {
      throw new Error("\u0644\u0627 \u064A\u0633\u062A\u0637\u064A\u0639 \u0623\u064A \u0645\u0633\u062A\u062E\u062F\u0645 \u062A\u0639\u062F\u064A\u0644 \u0635\u0644\u0627\u062D\u064A\u0627\u062A\u0647 \u0623\u0648 \u062F\u0648\u0631\u0647 \u0627\u0644\u062E\u0627\u0635");
    }
    const isSelfOnlyUpdate = actor.id === targetUserId && !touchesPermissionsOrGovernance && patch.managerRating === void 0;
    if (!isSelfOnlyUpdate) {
      this.assertPermission(userId, "manage_users");
      if (actor.role !== "sys_owner" && actor.role !== "gm") {
        throw new Error("\u062A\u0639\u062F\u064A\u0644 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0645\u062A\u0627\u062D \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645 \u0623\u0648 \u0645\u062F\u064A\u0631 \u0627\u0644\u0634\u0631\u0643\u0629 \u0641\u0642\u0637");
      }
      if (actor.role === "gm") {
        if (target.role === "sys_owner" || target.role === "gm") {
          throw new Error("\u064A\u0633\u062A\u0637\u064A\u0639 \u0645\u062F\u064A\u0631 \u0627\u0644\u0634\u0631\u0643\u0629 \u062A\u0639\u062F\u064A\u0644 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0627\u0644\u062A\u0627\u0628\u0639\u064A\u0646 \u0644\u0647 \u0641\u0642\u0637");
        }
        if (patch.role === "sys_owner" || patch.role === "gm") {
          throw new Error("\u0644\u0627 \u064A\u0645\u0644\u0643 \u0645\u062F\u064A\u0631 \u0627\u0644\u0634\u0631\u0643\u0629 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0631\u0642\u064A\u0629 \u0645\u0633\u062A\u062E\u062F\u0645 \u0625\u0644\u0649 \u0645\u062F\u064A\u0631 \u0634\u0631\u0643\u0629 \u0623\u0648 \u0645\u0627\u0644\u0643 \u0646\u0638\u0627\u0645");
        }
      }
    }
    const oldRole = target.roleLabelAr;
    if (patch.nameAr !== void 0) target.nameAr = patch.nameAr.trim();
    if (patch.nameEn !== void 0) target.nameEn = patch.nameEn.trim();
    if (patch.email !== void 0) target.email = patch.email.trim();
    if (patch.phone !== void 0) target.phone = patch.phone.trim();
    if (patch.role !== void 0) target.role = patch.role;
    if (patch.roleLabelAr !== void 0) target.roleLabelAr = patch.roleLabelAr;
    if (patch.roleLabelEn !== void 0) target.roleLabelEn = patch.roleLabelEn;
    if (patch.specialty !== void 0) target.specialty = patch.specialty;
    if (patch.approvalLimitSar !== void 0) target.approvalLimitSar = Number(patch.approvalLimitSar);
    if (patch.active !== void 0) target.active = patch.active;
    if (patch.statusState !== void 0) target.statusState = patch.statusState;
    if (patch.managerRating !== void 0) target.managerRating = Math.min(5, Math.max(1, Number(patch.managerRating)));
    if (patch.allowedPropertyIds !== void 0) {
      target.allowedPropertyIds = patch.allowedPropertyIds.length > 0 ? patch.allowedPropertyIds : void 0;
    }
    if (patch.customModulePermissions !== void 0) {
      target.customModulePermissions = patch.customModulePermissions;
    }
    if (patch.security) {
      target.security = { ...target.security || {}, ...patch.security };
    }
    if (patch.notificationPrefs) {
      target.notificationPrefs = { ...target.notificationPrefs || {}, ...patch.notificationPrefs };
    }
    this.addAudit(
      actor,
      "\u062A\u062D\u062F\u064A\u062B \u0645\u0644\u0641 \u0648\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0645\u0648\u0638\u0641",
      "StaffUser",
      target.id,
      `\u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A/\u0635\u0644\u0627\u062D\u064A\u0627\u062A ${target.nameAr}${patch.roleLabelAr ? ` (${oldRole} \u2190 ${patch.roleLabelAr})` : ""}`,
      { oldValue: oldRole, newValue: target.roleLabelAr, deviceName }
    );
    this.persist();
    return target;
  }
  updateSecurityPolicy(userId, patch, deviceName) {
    const actor = this.assertPermission(userId, "manage_users");
    const current = this.state.securityPolicy || {
      minPasswordLength: 8,
      requireSpecialChars: true,
      passwordExpiryDays: 90,
      autoLockMinutes: 5,
      maxFailedAttempts: 5,
      require2faForManagersAndAccountants: true
    };
    this.state.securityPolicy = { ...current, ...patch };
    this.addAudit(
      actor,
      "\u062A\u062D\u062F\u064A\u062B \u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u0623\u0645\u0627\u0646 \u0648\u0643\u0644\u0645\u0627\u062A \u0627\u0644\u0645\u0631\u0648\u0631",
      "SecurityPolicy",
      "company-security",
      `\u062A\u062D\u062F\u064A\u062B \u0633\u064A\u0627\u0633\u0627\u062A \u0627\u0644\u0623\u0645\u0627\u0646: \u0627\u0644\u0637\u0648\u0644 \u0627\u0644\u0623\u062F\u0646\u0649 ${this.state.securityPolicy.minPasswordLength}\u060C \u0627\u0644\u0642\u0641\u0644 ${this.state.securityPolicy.autoLockMinutes} \u062F`,
      { deviceName }
    );
    this.persist();
    return this.state.securityPolicy;
  }
  recordLoginEvent(input) {
    const user = this.state.users.find((u) => u.id === input.userId);
    if (!user) return;
    if (!this.state.loginHistory) this.state.loginHistory = [];
    const entry = {
      id: uid("lgn"),
      userId: user.id,
      userName: user.nameAr,
      userRole: user.roleLabelAr,
      deviceName: input.deviceName || user.deviceName,
      ipAddress: input.ipAddress || "192.168.10.1",
      geoLocation: "\u0627\u0644\u0631\u064A\u0627\u0636 \xB7 \u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629",
      method: input.method || "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631",
      success: input.success !== false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.loginHistory.unshift(entry);
    if (this.state.loginHistory.length > 100) {
      this.state.loginHistory = this.state.loginHistory.slice(0, 100);
    }
    user.lastActiveAt = entry.createdAt;
    this.persist();
  }
  resolveSyncConflict(userId, conflictId, resolution, deviceName) {
    const actor = this.assertPermission(userId, "manage_users");
    const cnf = (this.state.syncConflicts || []).find((c) => c.id === conflictId);
    if (!cnf) throw new Error("\u0633\u062C\u0644 \u0627\u0644\u062A\u0639\u0627\u0631\u0636 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    cnf.status = resolution;
    cnf.resolvedBy = actor.nameAr;
    cnf.resolvedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.addAudit(actor, "\u0645\u0639\u0627\u0644\u062C\u0629 \u062A\u0639\u0627\u0631\u0636 \u0645\u0632\u0627\u0645\u0646\u0629", "SyncConflict", cnf.id, `${resolution} \u0644\u0640 ${cnf.entityLabel}`, {
      newValue: resolution,
      deviceName
    });
    this.persist();
    return cnf;
  }
  // 14. Communication Templates Library & System Maintenance
  createTemplate(userId, input, deviceName) {
    const actor = this.getActingUser(userId);
    if (!this.state.communicationTemplates) this.state.communicationTemplates = [];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const tpl = {
      ...input,
      id: uid("tpl"),
      usageCount: 0,
      createdBy: actor.id,
      updatedBy: actor.nameAr,
      updatedAt: now,
      editHistory: [{ editedBy: actor.nameAr, editedAt: now, summary: "\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0642\u0627\u0644\u0628" }]
    };
    this.state.communicationTemplates.unshift(tpl);
    this.addAudit(actor, "\u0625\u0646\u0634\u0627\u0621 \u0642\u0627\u0644\u0628 \u062A\u0648\u0627\u0635\u0644", "CommunicationTemplate", tpl.id, `\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0642\u0627\u0644\u0628 "${tpl.name}" (${tpl.category})`, {
      deviceName
    });
    this.persist();
    return tpl;
  }
  updateTemplate(userId, templateId, patch, deviceName) {
    const actor = this.getActingUser(userId);
    const list = this.state.communicationTemplates || [];
    const tpl = list.find((t) => t.id === templateId);
    if (!tpl) throw new Error("\u0627\u0644\u0642\u0627\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    Object.assign(tpl, patch, {
      updatedBy: actor.nameAr,
      updatedAt: now
    });
    if (!tpl.editHistory) tpl.editHistory = [];
    tpl.editHistory.unshift({
      editedBy: actor.nameAr,
      editedAt: now,
      summary: patch.isFavorite !== void 0 && Object.keys(patch).length === 1 ? "\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0641\u0636\u0644\u0629" : "\u062A\u062D\u062F\u064A\u062B \u0645\u062D\u062A\u0648\u0649/\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0642\u0627\u0644\u0628"
    });
    if (tpl.editHistory.length > 20) tpl.editHistory = tpl.editHistory.slice(0, 20);
    this.addAudit(actor, "\u062A\u062D\u062F\u064A\u062B \u0642\u0627\u0644\u0628 \u062A\u0648\u0627\u0635\u0644", "CommunicationTemplate", tpl.id, `\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0642\u0627\u0644\u0628 "${tpl.name}"`, {
      deviceName
    });
    this.persist();
    return tpl;
  }
  deleteTemplate(userId, templateId, deviceName) {
    const actor = this.getActingUser(userId);
    const existing = (this.state.communicationTemplates || []).find((t) => t.id === templateId);
    this.state.communicationTemplates = (this.state.communicationTemplates || []).filter((t) => t.id !== templateId);
    this.addAudit(actor, "\u062D\u0630\u0641 \u0642\u0627\u0644\u0628 \u062A\u0648\u0627\u0635\u0644", "CommunicationTemplate", templateId, `\u062D\u0630\u0641 \u0627\u0644\u0642\u0627\u0644\u0628 "${existing?.name || templateId}"`, {
      deviceName
    });
    this.persist();
  }
  useTemplate(userId, templateId, input, deviceName) {
    const actor = this.getActingUser(userId);
    const tpl = (this.state.communicationTemplates || []).find((t) => t.id === templateId);
    if (tpl) {
      tpl.usageCount = (tpl.usageCount || 0) + 1;
    }
    let log;
    if (!input.localOnly) {
      log = {
        id: uid("com"),
        targetType: input.targetType,
        targetId: input.targetId,
        targetName: input.targetName,
        channel: input.channel,
        templateId,
        templateUsed: tpl?.name || "\u0642\u0627\u0644\u0628 \u062A\u0648\u0627\u0635\u0644",
        language: input.language,
        summary: input.summary,
        status: "\u0645\u0631\u0633\u0644",
        sentBy: actor.id,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.state.communications.unshift(log);
    }
    this.addAudit(actor, "\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0642\u0627\u0644\u0628 \u062A\u0648\u0627\u0635\u0644", "CommunicationTemplate", templateId, `\u0625\u0631\u0633\u0627\u0644 \u0631\u0633\u0627\u0644\u0629 \u0639\u0628\u0631 "${tpl?.name || templateId}" \u0625\u0644\u0649 ${input.targetName}`, {
      deviceName
    });
    this.persist();
    return { template: tpl, log };
  }
  importTemplates(userId, templates, deviceName) {
    const actor = this.getActingUser(userId);
    if (!this.state.communicationTemplates) this.state.communicationTemplates = [];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let count = 0;
    for (const raw of templates) {
      if (!raw.name || !raw.contentAr) continue;
      this.state.communicationTemplates.unshift({
        id: uid("tpl"),
        name: String(raw.name),
        category: raw.category || "custom",
        channel: raw.channel || "whatsapp",
        language: raw.language || "ar",
        contentAr: String(raw.contentAr),
        contentEn: raw.contentEn ? String(raw.contentEn) : void 0,
        isFavorite: Boolean(raw.isFavorite),
        isSeasonal: Boolean(raw.isSeasonal),
        usageCount: 0,
        createdBy: actor.id,
        updatedBy: actor.nameAr,
        updatedAt: now,
        editHistory: [{ editedBy: actor.nameAr, editedAt: now, summary: "\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0642\u0627\u0644\u0628" }]
      });
      count += 1;
    }
    this.addAudit(actor, "\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0642\u0648\u0627\u0644\u0628 \u062A\u0648\u0627\u0635\u0644", "CommunicationTemplate", "bulk-import", `\u0627\u0633\u062A\u064A\u0631\u0627\u062F ${count} \u0642\u0627\u0644\u0628 \u062A\u0648\u0627\u0635\u0644`, {
      deviceName
    });
    this.persist();
    return count;
  }
  diffCollection(current = [], incoming = []) {
    const curMap = new Map(current.map((item) => [item.id, JSON.stringify(item)]));
    let added = 0;
    let updated = 0;
    let unchanged = 0;
    for (const item of incoming) {
      const existing = curMap.get(item.id);
      if (existing === void 0) {
        added += 1;
      } else if (existing !== JSON.stringify(item)) {
        updated += 1;
      } else {
        unchanged += 1;
      }
    }
    return { added, updated, unchanged };
  }
  previewBackup(backupId, password) {
    const filePath = this.resolveBackupFile(backupId);
    if (!filePath) {
      return {
        id: backupId,
        exists: false,
        propertiesCount: 0,
        unitsCount: 0,
        tenantsCount: 0,
        contractsCount: 0,
        paymentsCount: 0,
        templatesCount: 0
      };
    }
    const raw = fs2.readFileSync(filePath, "utf-8");
    const encrypted = isEncryptedBackupEnvelope(raw);
    let decryptedRaw = raw;
    if (encrypted) {
      if (!password?.trim()) {
        return {
          id: backupId,
          exists: true,
          encrypted: true,
          requiresPassword: true,
          propertiesCount: 0,
          unitsCount: 0,
          tenantsCount: 0,
          contractsCount: 0,
          paymentsCount: 0,
          templatesCount: 0
        };
      }
      try {
        decryptedRaw = decryptBackupPayload(raw, password);
      } catch (err) {
        return {
          id: backupId,
          exists: true,
          encrypted: true,
          requiresPassword: true,
          decryptionError: err.message,
          propertiesCount: 0,
          unitsCount: 0,
          tenantsCount: 0,
          contractsCount: 0,
          paymentsCount: 0,
          templatesCount: 0
        };
      }
    }
    const parsed = JSON.parse(decryptedRaw);
    const diff = {
      properties: this.diffCollection(this.state.properties, parsed.properties || []),
      units: this.diffCollection(this.state.units, parsed.units || []),
      tenants: this.diffCollection(this.state.tenants, parsed.tenants || []),
      contracts: this.diffCollection(this.state.contracts, parsed.contracts || []),
      payments: this.diffCollection(this.state.payments, parsed.payments || []),
      expenses: this.diffCollection(this.state.expenses, parsed.expenses || []),
      tickets: this.diffCollection(this.state.tickets, parsed.tickets || [])
    };
    const totalChanged = Object.values(diff).reduce((s, d) => s + d.added + d.updated, 0);
    return {
      id: backupId,
      exists: true,
      encrypted,
      requiresPassword: false,
      propertiesCount: parsed.properties?.length || 0,
      unitsCount: parsed.units?.length || 0,
      tenantsCount: parsed.tenants?.length || 0,
      contractsCount: parsed.contracts?.length || 0,
      paymentsCount: parsed.payments?.length || 0,
      templatesCount: parsed.communicationTemplates?.length || 0,
      lastUpdatedAt: parsed.lastUpdatedAt,
      diff: { ...diff, totalChanged }
    };
  }
  clearTempCache(userId, deviceName) {
    const actor = this.assertPermission(userId, "manage_users");
    if (!this.state.settings.developerCenter) {
      this.state.settings.developerCenter = { tempCacheSizeKb: 0, errorLogs: [] };
    }
    this.state.settings.developerCenter.tempCacheSizeKb = 0;
    this.state.settings.developerCenter.errorLogs.unshift({
      id: uid("err"),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      source: "StorageManager",
      message: "\u062A\u0645 \u062A\u0646\u0638\u064A\u0641 \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0645\u0624\u0642\u062A\u0629 \u0648\u0630\u0627\u0643\u0631\u0629 \u0627\u0644\u062A\u062E\u0632\u064A\u0646 \u0627\u0644\u0645\u0631\u062D\u0644\u064A \u0628\u0646\u062C\u0627\u062D",
      severity: "info"
    });
    this.addAudit(actor, "\u062A\u0646\u0638\u064A\u0641 \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0645\u0624\u0642\u062A\u0629", "SystemMaintenance", "cache", "\u062A\u0646\u0638\u064A\u0641 \u0630\u0627\u0643\u0631\u0629 \u0627\u0644\u062A\u062E\u0632\u064A\u0646 \u0627\u0644\u0645\u0624\u0642\u062A\u0629", { deviceName });
    this.persist();
    return this.state.settings;
  }
  // 16. Tenant Files Center (Update Profile, Violations/Notes, Appointments, Contract Edits)
  updateTenant(userId, tenantId, patch, deviceName) {
    const user = this.assertPermission(userId, "manage_tenants");
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error("\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    if (patch.nationalIdOrIqama && patch.nationalIdOrIqama.trim() !== tenant.nationalIdOrIqama) {
      const dup = this.state.tenants.find(
        (t) => t.id !== tenantId && t.nationalIdOrIqama.trim() === patch.nationalIdOrIqama.trim()
      );
      if (dup) throw new Error(`\u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064A\u0629/\u0627\u0644\u0625\u0642\u0627\u0645\u0629 \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B \u0644\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${dup.nameAr}`);
    }
    const oldSnapshot = JSON.stringify({
      nameAr: tenant.nameAr,
      phone: tenant.phone,
      email: tenant.email,
      nationalIdOrIqama: tenant.nationalIdOrIqama,
      tenantType: tenant.tenantType
    });
    Object.assign(tenant, patch);
    if (patch.behaviorScores) {
      const bs = patch.behaviorScores;
      tenant.rating = Math.round((bs.paymentCommitment + bs.unitCare + bs.cooperation) / 3 * 10) / 10;
    }
    this.addAudit(user, "\u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0644\u0641 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631", "Tenant", tenant.id, `\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${tenant.nameAr}`, {
      oldValue: oldSnapshot,
      newValue: JSON.stringify({
        nameAr: tenant.nameAr,
        phone: tenant.phone,
        email: tenant.email,
        nationalIdOrIqama: tenant.nationalIdOrIqama,
        tenantType: tenant.tenantType
      }),
      deviceName
    });
    this.persist();
    return tenant;
  }
  addTenantViolationNote(userId, tenantId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_tenants");
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error("\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    if (!tenant.violationNotes) tenant.violationNotes = [];
    const entry = {
      id: uid("vn"),
      title: input.title,
      category: input.category,
      details: input.details,
      createdBy: user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    tenant.violationNotes.unshift(entry);
    this.addAudit(user, "\u0625\u0636\u0627\u0641\u0629 \u0645\u0644\u0627\u062D\u0638\u0629 / \u0645\u062E\u0627\u0644\u0641\u0629 \u0645\u0633\u062A\u0623\u062C\u0631", "Tenant", tenant.id, `${input.category}: ${input.title} (${tenant.nameAr})`, {
      deviceName
    });
    this.persist();
    return entry;
  }
  scheduleTenantAppointment(userId, tenantId, input, deviceName) {
    const user = this.getActingUser(userId);
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error("\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const log = {
      id: uid("com"),
      targetType: "\u0645\u0633\u062A\u0623\u062C\u0631",
      targetId: tenant.id,
      targetName: tenant.nameAr,
      channel: "\u0645\u0648\u0639\u062F \u0645\u062C\u062F\u0648\u0644",
      direction: "\u0635\u0627\u062F\u0631",
      language: "ar",
      summary: `${input.title} \u2014 ${input.scheduledAt}${input.notes ? ` \xB7 ${input.notes}` : ""}`,
      scheduledAt: input.scheduledAt,
      status: "\u0645\u062C\u062F\u0648\u0644",
      sentBy: user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.communications.unshift(log);
    if (input.createTask && this.userHasPermission(user, "manage_tasks")) {
      this.state.tasks.unshift({
        id: uid("tsk"),
        title: `\u0645\u0648\u0639\u062F \u0645\u0639 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${tenant.nameAr}: ${input.title}`,
        description: input.notes || input.title,
        type: "\u0645\u062A\u0627\u0628\u0639\u0629 \u0645\u0633\u062A\u0623\u062C\u0631",
        propertyId: input.propertyId,
        unitId: input.unitId,
        assignedTo: user.id,
        createdBy: user.id,
        dueDate: input.scheduledAt.slice(0, 10),
        priority: "\u0645\u062A\u0648\u0633\u0637",
        status: "\u0645\u0633\u0646\u062F\u0629",
        checklist: [{ text: "\u062A\u0623\u0643\u064A\u062F \u062D\u0636\u0648\u0631 \u0627\u0644\u0645\u0648\u0639\u062F \u0648\u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0646\u062A\u064A\u062C\u0629", done: false }],
        comments: [],
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    this.addAudit(user, "\u062C\u062F\u0648\u0644\u0629 \u0645\u0648\u0639\u062F \u0645\u0639 \u0645\u0633\u062A\u0623\u062C\u0631", "Communication", log.id, `\u062C\u062F\u0648\u0644\u0629 \u0645\u0648\u0639\u062F (${input.title}) \u0645\u0639 ${tenant.nameAr} \u0628\u062A\u0627\u0631\u064A\u062E ${input.scheduledAt}`, {
      deviceName,
      propertyId: input.propertyId
    });
    this.persist();
    return log;
  }
  updateContractDetails(userId, contractId, patch, deviceName) {
    const user = this.assertPermission(userId, "manage_contracts");
    const contract = this.state.contracts.find((c) => c.id === contractId);
    if (!contract) throw new Error("\u0627\u0644\u0639\u0642\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const prevSummary = `${contract.ejarNumber || "-"} / ${contract.occupancyStatus || "\u0646\u0634\u0637"}`;
    Object.assign(contract, patch);
    contract.version += 1;
    this.addAudit(
      user,
      "\u062A\u0639\u062F\u064A\u0644 \u0628\u0646\u0648\u062F \u0648\u0628\u064A\u0627\u0646\u0627\u062A \u0625\u0634\u063A\u0627\u0644 \u0627\u0644\u0639\u0642\u062F",
      "LeaseContract",
      contract.id,
      `\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0639\u0642\u062F ${contract.internalNumber} (\u0627\u0644\u0625\u0635\u062F\u0627\u0631 ${contract.version})`,
      { oldValue: prevSummary, newValue: JSON.stringify(patch), propertyId: contract.propertyId, deviceName }
    );
    this.persist();
    return contract;
  }
  // 17. Expenses Edit, Payment Voucher & Reasoned Cancellation + Vendors + Invoices + Budgets
  updateOrCancelExpense(userId, expenseId, input, deviceName) {
    return this.runTransaction(() => {
      const user = this.getActingUser(userId);
      const expense = this.state.expenses.find((e) => e.id === expenseId);
      if (!expense) throw new Error("\u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      if (input.action === "pay") {
        if (expense.approvalStatus !== "\u0645\u0639\u062A\u0645\u062F") {
          throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0633\u062C\u064A\u0644 \u0633\u062F\u0627\u062F \u0644\u0645\u0635\u0631\u0648\u0641 \u0642\u0628\u0644 \u0627\u0639\u062A\u0645\u0627\u062F\u0647");
        }
        const addedPay = Number(input.paidAmount || expense.remainingAmount || expense.amount);
        if (addedPay <= 0) throw new Error("\u064A\u062C\u0628 \u0625\u062F\u062E\u0627\u0644 \u0645\u0628\u0644\u063A \u0633\u062F\u0627\u062F \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631");
        const nextPaid = Math.min(expense.amount, Math.round(((expense.paidAmount || 0) + addedPay) * 100) / 100);
        expense.paidAmount = nextPaid;
        expense.remainingAmount = Math.max(0, Math.round((expense.amount - nextPaid) * 100) / 100);
        expense.paymentStatus = expense.remainingAmount === 0 ? "\u0645\u062F\u0641\u0648\u0639 \u0628\u0627\u0644\u0643\u0627\u0645\u0644" : "\u0645\u062F\u0641\u0648\u0639 \u062C\u0632\u0626\u064A\u0627\u064B";
        if (input.paymentMethod) expense.paymentMethod = input.paymentMethod;
        if (input.paidFromAccount) expense.paidFromAccount = input.paidFromAccount;
        if (input.referenceNumber) expense.referenceNumber = input.referenceNumber;
        if (expense.ticketId && expense.paymentStatus === "\u0645\u062F\u0641\u0648\u0639 \u0628\u0627\u0644\u0643\u0627\u0645\u0644") {
          const tkt = this.state.tickets.find((t) => t.id === expense.ticketId);
          if (tkt) {
            tkt.status = "\u0645\u0643\u062A\u0645\u0644";
            tkt.actualCost = expense.amount;
            tkt.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          }
        }
        this.addAudit(
          user,
          "\u062A\u0633\u062C\u064A\u0644 \u0633\u0646\u062F \u0635\u0631\u0641 / \u0633\u062F\u0627\u062F \u0645\u0635\u0631\u0648\u0641",
          "Expense",
          expense.id,
          `\u0633\u062F\u0627\u062F ${addedPay.toLocaleString()} \u0631.\u0633 \u0644\u0644\u0645\u0635\u0631\u0648\u0641 ${expense.expenseNumber} (${expense.paymentStatus})`,
          { propertyId: expense.propertyId, newValue: `${nextPaid} / ${expense.amount}`, deviceName }
        );
        this.persist();
        return expense;
      }
      if (input.action === "cancel") {
        if (!input.reason || input.reason.trim().length < 4) {
          throw new Error("\u064A\u062C\u0628 \u0643\u062A\u0627\u0628\u0629 \u0633\u0628\u0628 \u0648\u0627\u0636\u062D \u0644\u0625\u0644\u063A\u0627\u0621/\u062D\u0630\u0641 \u0627\u0644\u0645\u0635\u0631\u0648\u0641");
        }
        const prevStatus = expense.approvalStatus;
        if (prevStatus === "\u0645\u0639\u062A\u0645\u062F") {
          this.assertPermission(userId, "approve_expense_manager");
          const origJournal = this.state.journals.find((j) => j.referenceId === expense.id && j.referenceType === "\u0645\u0635\u0631\u0648\u0641");
          if (origJournal) {
            this.state.counters.journal += 1;
            const revLines = origJournal.lines.map((l) => {
              const acc = this.state.accounts.find((a) => a.id === l.accountId);
              if (acc) {
                if (acc.type === "\u0623\u0635\u0648\u0644" || acc.type === "\u0645\u0635\u0631\u0648\u0641\u0627\u062A") acc.balance += l.credit - l.debit;
                else acc.balance += l.debit - l.credit;
              }
              return { accountId: l.accountId, accountName: l.accountName, debit: l.credit, credit: l.debit };
            });
            this.state.journals.unshift({
              id: uid("jrn"),
              entryNumber: `JRN-2026-${pad4(this.state.counters.journal)}`,
              date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
              description: `\u0639\u0643\u0633 \u0648\u0625\u0644\u063A\u0627\u0621 \u0645\u0635\u0631\u0648\u0641 \u0645\u0639\u062A\u0645\u062F ${expense.expenseNumber} - \u0627\u0644\u0633\u0628\u0628: ${input.reason}`,
              referenceType: "\u0633\u0646\u062F \u0639\u0643\u0633\u064A",
              referenceId: expense.id,
              propertyId: expense.propertyId,
              createdBy: user.id,
              lines: revLines
            });
          }
        } else {
          this.assertPermission(userId, "create_expense");
        }
        expense.approvalStatus = "\u0645\u0644\u063A\u0649";
        expense.cancellationReason = input.reason.trim();
        this.addAudit(
          user,
          "\u0625\u0644\u063A\u0627\u0621 \u0648\u062D\u0641\u0638 \u0623\u0631\u0634\u064A\u0641\u064A \u0644\u0645\u0635\u0631\u0648\u0641",
          "Expense",
          expense.id,
          `\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 ${expense.expenseNumber} (${expense.amount.toLocaleString()} \u0631.\u0633)`,
          { oldValue: prevStatus, newValue: "\u0645\u0644\u063A\u0649", reason: input.reason.trim(), propertyId: expense.propertyId, deviceName }
        );
        this.persist();
        return expense;
      }
      this.assertPermission(userId, "create_expense");
      if (expense.approvalStatus === "\u0645\u0639\u062A\u0645\u062F" && user.role !== "gm" && user.role !== "sys_owner") {
        throw new Error("\u062A\u0639\u062F\u064A\u0644 \u0645\u0635\u0631\u0648\u0641 \u0645\u0639\u062A\u0645\u062F \u064A\u062A\u0637\u0644\u0628 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645");
      }
      const oldSummary = `${expense.category} / ${expense.amount} / ${expense.invoiceNumber}`;
      if (input.patch) {
        Object.assign(expense, input.patch);
      }
      this.addAudit(
        user,
        "\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0635\u0631\u0648\u0641",
        "Expense",
        expense.id,
        `\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 ${expense.expenseNumber}`,
        { oldValue: oldSummary, newValue: `${expense.category} / ${expense.amount} / ${expense.invoiceNumber}`, propertyId: expense.propertyId, deviceName }
      );
      this.persist();
      return expense;
    });
  }
  updateVendor(userId, vendorId, patch, deviceName) {
    const user = this.assertPermission(userId, "manage_maintenance");
    const vendor = this.state.vendors.find((v) => v.id === vendorId);
    if (!vendor) throw new Error("\u0627\u0644\u0645\u0648\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const oldRating = vendor.rating;
    Object.assign(vendor, patch);
    if (patch.ratingBreakdown) {
      const b = patch.ratingBreakdown;
      vendor.ratingBreakdown = b;
      vendor.rating = Math.round((b.quality + b.punctuality + b.pricing + b.cooperation) / 4 * 10) / 10;
    }
    this.addAudit(user, "\u062A\u062D\u062F\u064A\u062B \u0645\u0644\u0641 \u0648\u062A\u0642\u064A\u064A\u0645 \u0645\u0648\u0631\u062F", "Vendor", vendor.id, `\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0648\u0631\u062F ${vendor.nameAr} (\u0627\u0644\u062A\u0642\u064A\u064A\u0645: ${vendor.rating}/5)`, {
      oldValue: String(oldRating),
      newValue: String(vendor.rating),
      deviceName
    });
    this.persist();
    return vendor;
  }
  createSupplierInvoice(userId, input, deviceName) {
    const user = this.assertPermission(userId, "create_expense");
    if (!this.state.supplierInvoices) this.state.supplierInvoices = [];
    const invoiceCode = `SINV-2026-${pad3(this.state.supplierInvoices.length + 1)}`;
    const inv = {
      ...input,
      id: uid("sinv"),
      invoiceCode,
      createdBy: user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.supplierInvoices.unshift(inv);
    this.addAudit(
      user,
      "\u062A\u0633\u062C\u064A\u0644 \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0648\u0631\u062F \u062A\u0641\u0635\u064A\u0644\u064A\u0629",
      "SupplierInvoice",
      inv.id,
      `\u0641\u0627\u062A\u0648\u0631\u0629 ${inv.invoiceCode} (${inv.supplierInvoiceNumber}) \u0628\u0642\u064A\u0645\u0629 ${inv.totalAmount.toLocaleString()} \u0631.\u0633`,
      { propertyId: inv.propertyId, newValue: inv.status, deviceName }
    );
    this.persist();
    return inv;
  }
  updateSupplierInvoice(userId, invoiceId, patch, deviceName) {
    const user = this.getActingUser(userId);
    if (!this.state.supplierInvoices) this.state.supplierInvoices = [];
    const inv = this.state.supplierInvoices.find((i) => i.id === invoiceId);
    if (!inv) throw new Error("\u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0645\u0648\u0631\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    const oldStatus = inv.status;
    if (patch.payAmount && patch.payAmount > 0) {
      this.assertPermission(userId, "manage_accounting");
      inv.paidAmount = Math.min(inv.totalAmount, Math.round((inv.paidAmount + patch.payAmount) * 100) / 100);
      inv.remainingAmount = Math.max(0, Math.round((inv.totalAmount - inv.paidAmount) * 100) / 100);
      inv.status = inv.remainingAmount === 0 ? "\u0645\u062F\u0641\u0648\u0639\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644" : "\u0645\u062F\u0641\u0648\u0639\u0629 \u062C\u0632\u0626\u064A\u0627\u064B";
    } else if (patch.status) {
      if (patch.status === "\u0645\u0639\u062A\u0645\u062F\u0629") {
        this.assertPermission(userId, "approve_expense_supervisor");
        inv.approvedBy = user.id;
      }
      if (patch.status === "\u0645\u0644\u063A\u0627\u0629") {
        if (!patch.cancellationReason?.trim()) throw new Error("\u064A\u062C\u0628 \u0625\u062F\u062E\u0627\u0644 \u0633\u0628\u0628 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629");
        inv.cancellationReason = patch.cancellationReason.trim();
      }
      inv.status = patch.status;
    }
    this.addAudit(
      user,
      "\u062A\u062D\u062F\u064A\u062B \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0648\u0631\u062F",
      "SupplierInvoice",
      inv.id,
      `\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 ${inv.invoiceCode} \u0625\u0644\u0649 ${inv.status}`,
      { oldValue: oldStatus, newValue: inv.status, reason: patch.cancellationReason, propertyId: inv.propertyId, deviceName }
    );
    this.persist();
    return inv;
  }
  createRecurringExpense(userId, input, deviceName) {
    const user = this.assertPermission(userId, "create_expense");
    if (!this.state.recurringExpenses) this.state.recurringExpenses = [];
    const rule = {
      ...input,
      id: uid("rexp"),
      createdBy: user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.recurringExpenses.unshift(rule);
    this.addAudit(user, "\u062C\u062F\u0648\u0644\u0629 \u0645\u0635\u0631\u0648\u0641 \u062F\u0648\u0631\u064A \u0645\u062A\u0643\u0631\u0631", "RecurringExpenseRule", rule.id, `\u0625\u0636\u0627\u0641\u0629 \u0645\u0635\u0631\u0648\u0641 \u0645\u062A\u0643\u0631\u0631: ${rule.title}`, {
      propertyId: rule.propertyId,
      deviceName
    });
    this.persist();
    return rule;
  }
  toggleRecurringExpense(userId, ruleId, enabled, deviceName) {
    const user = this.assertPermission(userId, "create_expense");
    const rule = (this.state.recurringExpenses || []).find((r) => r.id === ruleId);
    if (!rule) throw new Error("\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0627\u0644\u0645\u062A\u0643\u0631\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    rule.enabled = enabled;
    this.addAudit(user, "\u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0645\u0635\u0631\u0648\u0641 \u0645\u062A\u0643\u0631\u0631", "RecurringExpenseRule", rule.id, `${enabled ? "\u062A\u0641\u0639\u064A\u0644" : "\u0625\u064A\u0642\u0627\u0641"}: ${rule.title}`, {
      propertyId: rule.propertyId,
      deviceName
    });
    this.persist();
    return rule;
  }
  generateDueRecurringExpenses(userId, targetMonth, deviceName) {
    const user = this.assertPermission(userId, "create_expense");
    const month = targetMonth || (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
    const created = [];
    for (const rule of this.state.recurringExpenses || []) {
      if (!rule.enabled || rule.lastGeneratedMonth === month) continue;
      const dayStr = String(Math.min(28, Math.max(1, rule.dayOfMonth))).padStart(2, "0");
      const vat = Math.round((rule.estimatedAmount - rule.estimatedAmount / 1.15) * 100) / 100;
      this.state.counters.expense += 1;
      const exp = {
        id: uid("exp"),
        expenseNumber: `EXP-2026-${pad4(this.state.counters.expense)}`,
        date: `${month}-${dayStr}`,
        category: rule.category,
        subCategory: rule.subCategory,
        propertyId: rule.propertyId,
        unitId: rule.unitId,
        vendorId: rule.vendorId,
        invoiceNumber: `REC-${month.replace("-", "")}-${pad3(this.state.counters.expense)}`,
        amount: rule.estimatedAmount,
        vatAmount: vat,
        netAmount: Math.round((rule.estimatedAmount - vat) * 100) / 100,
        currency: rule.currency,
        paymentMethod: "\u062A\u062D\u0648\u064A\u0644 \u0628\u0646\u0643\u064A",
        paymentStatus: "\u0644\u0645 \u064A\u064F\u062F\u0641\u0639",
        paidAmount: 0,
        remainingAmount: rule.estimatedAmount,
        dueDate: `${month}-${dayStr}`,
        bearer: rule.bearer,
        approvalStatus: "\u0645\u0633\u0648\u062F\u0629",
        isRecurringInstance: true,
        recurringRuleId: rule.id,
        createdBy: user.id,
        notes: `\u062A\u0648\u0644\u064A\u062F \u062A\u0644\u0642\u0627\u0626\u064A \u0644\u0645\u0635\u0631\u0648\u0641 \u0645\u062A\u0643\u0631\u0631 (${rule.frequency}): ${rule.title}`,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.state.expenses.unshift(exp);
      rule.lastGeneratedMonth = month;
      created.push(exp);
    }
    if (created.length > 0) {
      this.addAudit(
        user,
        "\u062A\u0648\u0644\u064A\u062F \u0645\u0633\u0648\u062F\u0627\u062A \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062A \u0627\u0644\u062F\u0648\u0631\u064A\u0629",
        "RecurringExpenseRule",
        month,
        `\u062A\u0645 \u062A\u0648\u0644\u064A\u062F ${created.length} \u0645\u0633\u0648\u062F\u0629 \u0645\u0635\u0631\u0648\u0641 \u062F\u0648\u0631\u064A \u0644\u0634\u0647\u0631 ${month}`,
        { deviceName }
      );
      this.persist();
    }
    return created;
  }
  upsertPropertyBudget(userId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_accounting");
    if (!this.state.propertyBudgets) this.state.propertyBudgets = [];
    let existing = this.state.propertyBudgets.find((b) => b.propertyId === input.propertyId && b.month === input.month);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (existing) {
      existing.monthlyLimitSar = Number(input.monthlyLimitSar);
      if (input.alertThresholdPercent !== void 0) existing.alertThresholdPercent = input.alertThresholdPercent;
      if (input.blockAt100Percent !== void 0) existing.blockAt100Percent = input.blockAt100Percent;
      existing.updatedBy = user.id;
      existing.updatedAt = now;
    } else {
      existing = {
        id: uid("pbdg"),
        propertyId: input.propertyId,
        month: input.month,
        monthlyLimitSar: Number(input.monthlyLimitSar),
        alertThresholdPercent: input.alertThresholdPercent ?? 80,
        blockAt100Percent: Boolean(input.blockAt100Percent),
        updatedBy: user.id,
        updatedAt: now
      };
      this.state.propertyBudgets.unshift(existing);
    }
    this.addAudit(
      user,
      "\u062A\u062D\u062F\u064A\u062F \u0645\u064A\u0632\u0627\u0646\u064A\u0629 \u0634\u0647\u0631\u064A\u0629 \u0644\u0644\u0639\u0642\u0627\u0631",
      "PropertyBudget",
      existing.id,
      `\u062A\u062D\u062F\u064A\u062F \u0645\u064A\u0632\u0627\u0646\u064A\u0629 ${existing.month} \u0628\u0645\u0628\u0644\u063A ${existing.monthlyLimitSar.toLocaleString()} \u0631.\u0633`,
      { propertyId: existing.propertyId, deviceName }
    );
    this.persist();
    return existing;
  }
  // 18. Lead Management, Smart Escalation to Owner/Manager & Public Prospect Intake
  updateLead(userId, leadId, patch, deviceName) {
    const user = this.assertPermission(userId, "manage_contracts");
    const lead = this.state.leads.find((l) => l.id === leadId);
    if (!lead) throw new Error("\u0645\u0644\u0641 \u0627\u0644\u0645\u0647\u062A\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const { newInteraction, ...rest } = patch;
    Object.assign(lead, rest);
    lead.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (newInteraction) {
      if (!lead.interactions) lead.interactions = [];
      lead.interactions.unshift({
        id: uid("lint"),
        type: newInteraction.type,
        direction: newInteraction.direction,
        summary: newInteraction.summary,
        actorName: user.nameAr,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    this.addAudit(
      user,
      newInteraction ? "\u062A\u0633\u062C\u064A\u0644 \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0645\u0647\u062A\u0645" : "\u062A\u062D\u062F\u064A\u062B \u0645\u0644\u0641 \u0645\u0647\u062A\u0645",
      "Lead",
      lead.id,
      newInteraction ? `${newInteraction.summary} (${lead.nameAr})` : `\u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0647\u062A\u0645 ${lead.nameAr}`,
      { propertyId: lead.propertyId, deviceName }
    );
    this.persist();
    return lead;
  }
  createPublicLead(input) {
    if (!input.nameAr?.trim() || !input.phone?.trim()) {
      throw new Error("\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0627\u0633\u0645 \u0648\u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644");
    }
    const cleanPhone = input.phone.trim();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const targetUnit = input.unitId && this.state.units.find((u) => u.id === input.unitId) || input.propertyId && this.state.units.find((u) => u.propertyId === input.propertyId && u.status === "\u0634\u0627\u063A\u0631\u0629") || this.state.units.find((u) => u.status === "\u0634\u0627\u063A\u0631\u0629") || this.state.units[0];
    const targetProp = input.propertyId && this.state.properties.find((p) => p.id === input.propertyId) || targetUnit && this.state.properties.find((p) => p.id === targetUnit.propertyId) || this.state.properties[0];
    const existingLead = this.state.leads.find((l) => l.phone.trim() === cleanPhone);
    if (existingLead) {
      existingLead.updatedAt = now;
      if (input.nationalIdOrIqama?.trim()) existingLead.nationalIdOrIqama = input.nationalIdOrIqama.trim();
      if (input.birthDate?.trim()) existingLead.birthDate = input.birthDate.trim();
      if (input.idImageDataUrl) existingLead.idImageDataUrl = input.idImageDataUrl;
      if (input.notes) {
        existingLead.notes = `${existingLead.notes ? `${existingLead.notes} | ` : ""}\u0627\u0647\u062A\u0645\u0627\u0645 \u062C\u062F\u064A\u062F (${now.slice(0, 10)}): ${input.notes}`;
      }
      if (!existingLead.interactions) existingLead.interactions = [];
      existingLead.interactions.unshift({
        id: uid("lint"),
        type: "visit",
        direction: "inbound",
        summary: `\u0625\u0639\u0627\u062F\u0629 \u062A\u0633\u062C\u064A\u0644 \u0627\u0647\u062A\u0645\u0627\u0645 \u0639\u0628\u0631 ${input.source || "\u0631\u0627\u0628\u0637 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0639\u0627\u0645"}${targetProp ? ` (${targetProp.nameAr})` : ""}`,
        actorName: "\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0630\u0643\u064A\u0629",
        createdAt: now
      });
      this.addNotification(
        `\u062A\u062C\u062F\u064A\u062F \u0627\u0647\u062A\u0645\u0627\u0645 \u0639\u0645\u064A\u0644 \u0645\u0633\u062C\u0644: ${existingLead.nameAr}`,
        `Returning lead inquiry: ${existingLead.nameAr}`,
        `\u062A\u0645 \u0631\u0628\u0637 \u0637\u0644\u0628 \u062C\u062F\u064A\u062F \u0628\u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644 ${cleanPhone} \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u062F\u0648\u0646 \u062A\u0643\u0631\u0627\u0631.`,
        `Linked duplicate phone ${cleanPhone} automatically.`,
        "\u062A\u0634\u063A\u064A\u0644\u064A\u0629",
        ["leasing", "gm", "supervisor"],
        "tenants"
      );
      this.persist();
      return { lead: existingLead, merged: true, propertyName: targetProp?.nameAr || "\u0627\u0644\u0639\u0642\u0627\u0631" };
    }
    const lead = {
      id: uid("lead"),
      nameAr: input.nameAr.trim(),
      phone: cleanPhone,
      email: input.email?.trim() || void 0,
      nationalIdOrIqama: input.nationalIdOrIqama?.trim() || void 0,
      birthDate: input.birthDate?.trim() || void 0,
      idImageDataUrl: input.idImageDataUrl || void 0,
      tenantType: input.tenantType || "\u0641\u0631\u062F",
      familyMembersCount: input.familyMembersCount,
      companyCrNumber: input.companyCrNumber,
      source: input.source || "\u0631\u0627\u0628\u0637 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0639\u0627\u0645",
      propertyId: targetProp?.id || "",
      unitId: targetUnit?.id || "",
      offeredRent: targetUnit?.suggestedMonthlyRent || input.budgetMonthly || 3500,
      paymentFrequency: "\u0634\u0647\u0631\u064A",
      officeFee: targetUnit?.officeFee || 500,
      earlyTerminationFee: 1e3,
      budgetMonthly: input.budgetMonthly,
      roomsRequired: input.roomsRequired,
      moveInDate: input.moveInDate,
      viewingDate: now.slice(0, 10),
      status: "\u062C\u062F\u064A\u062F",
      approvalState: "\u0644\u0645 \u064A\u064F\u0631\u0633\u0644",
      rating: 4,
      assignedTo: "usr-lease",
      notes: input.notes?.trim() || "\u0645\u0633\u062C\u0644 \u0630\u0627\u062A\u064A\u0627\u064B \u0639\u0628\u0631 \u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0627\u0633\u062A\u0642\u0637\u0627\u0628 \u0627\u0644\u0639\u0627\u0645",
      createdAt: now,
      updatedAt: now,
      interactions: [
        {
          id: uid("lint"),
          type: "visit",
          direction: "inbound",
          summary: `\u062A\u0633\u062C\u064A\u0644 \u0630\u0627\u062A\u064A \u0645\u0646 \u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0647\u062A\u0645\u064A\u0646 (${input.source || "\u0631\u0627\u0628\u0637 \u0639\u0627\u0645"})`,
          actorName: input.nameAr.trim(),
          createdAt: now
        }
      ]
    };
    this.state.leads.unshift(lead);
    this.addNotification(
      `\u0645\u0647\u062A\u0645 \u062C\u062F\u064A\u062F \u0639\u0628\u0631 \u0627\u0644\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0639\u0627\u0645\u0629: ${lead.nameAr}`,
      `New Public Prospect: ${lead.nameAr}`,
      `${targetProp?.nameAr || ""} ${targetUnit ? `\xB7 \u0648\u062D\u062F\u0629 ${targetUnit.unitNumber}` : ""} \xB7 ${lead.phone}`,
      `${lead.phone} \xB7 ${lead.source}`,
      "\u062A\u0634\u063A\u064A\u0644\u064A\u0629",
      ["leasing", "gm", "supervisor"],
      "tenants"
    );
    this.persist();
    return { lead, merged: false, propertyName: targetProp?.nameAr || "\u0627\u0644\u0639\u0642\u0627\u0631" };
  }
  escalateLead(userId, leadId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_contracts");
    const lead = this.state.leads.find((l) => l.id === leadId);
    if (!lead) throw new Error("\u0645\u0644\u0641 \u0627\u0644\u0645\u0647\u062A\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const unit = this.state.units.find((u) => u.id === (input.unitId || lead.unitId)) || this.state.units[0];
    const prop = this.state.properties.find((p) => p.id === (unit?.propertyId || lead.propertyId)) || this.state.properties[0];
    if (!prop || !unit) throw new Error("\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0639\u0642\u0627\u0631 \u0648\u0627\u0644\u0648\u062D\u062F\u0629 \u0642\u0628\u0644 \u0627\u0644\u0625\u0631\u0633\u0627\u0644");
    if (input.rentAmount !== void 0) lead.offeredRent = input.rentAmount;
    if (input.paymentFrequency) lead.paymentFrequency = input.paymentFrequency;
    if (input.officeFee !== void 0) lead.officeFee = input.officeFee;
    if (input.earlyTerminationFee !== void 0) lead.earlyTerminationFee = input.earlyTerminationFee;
    if (input.nationalIdOrIqama !== void 0) lead.nationalIdOrIqama = input.nationalIdOrIqama.trim() || void 0;
    if (input.birthDate !== void 0) lead.birthDate = input.birthDate.trim() || void 0;
    if (input.idImageDataUrl !== void 0) lead.idImageDataUrl = input.idImageDataUrl || void 0;
    lead.unitId = unit.id;
    lead.propertyId = prop.id;
    let recipientName = "";
    let recipientPhone = "";
    let recipientEmail = "";
    let targetRoles = ["gm", "supervisor"];
    if (input.recipientType === "owner") {
      const owner = this.state.owners.find((o) => o.id === input.recipientId);
      if (!owner) throw new Error("\u0627\u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062E\u062A\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      recipientName = owner.nameAr;
      recipientPhone = owner.phone;
      recipientEmail = owner.email;
      targetRoles = ["owner", "gm"];
    } else {
      const mgr = this.state.users.find((u) => u.id === input.recipientId);
      if (!mgr) throw new Error("\u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u062E\u062A\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      recipientName = mgr.nameAr;
      recipientPhone = mgr.phone;
      recipientEmail = mgr.email;
      targetRoles = [mgr.role];
    }
    if (!this.state.leadEscalations) this.state.leadEscalations = [];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1e3).toISOString();
    const requestCode = `ESC-2026-${pad3(this.state.leadEscalations.length + 1)}`;
    const token = `tok-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const company = prop.companyId && this.state.companies?.find((c) => c.id === prop.companyId) || void 0;
    const companyName = company?.nameAr || this.state.settings.nameAr;
    const esc = {
      id: uid("lesc"),
      requestCode,
      leadId: lead.id,
      propertyId: prop.id,
      unitId: unit.id,
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      recipientName,
      recipientPhone,
      recipientEmail,
      channel: input.channel,
      status: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629",
      priority: input.priority || "\u0639\u0627\u062F\u064A",
      employeeNotes: input.employeeNotes?.trim() || lead.notes || void 0,
      token,
      tokenExpiresAt: expiresAt,
      snapshot: {
        companyName,
        propertyName: prop.nameAr,
        unitNumber: unit.unitNumber,
        leadName: lead.nameAr,
        nationalIdOrIqama: lead.nationalIdOrIqama,
        hasIdPhoto: Boolean(lead.idImageDataUrl),
        idImageDataUrl: lead.idImageDataUrl,
        birthDate: lead.birthDate,
        phone: lead.phone,
        rentAmount: lead.offeredRent,
        paymentFrequency: lead.paymentFrequency || "\u0634\u0647\u0631\u064A",
        officeFee: lead.officeFee ?? unit.officeFee ?? 0,
        earlyTerminationFee: lead.earlyTerminationFee ?? 1e3,
        employeeNotes: input.employeeNotes?.trim() || lead.notes || void 0,
        registrationDate: (lead.createdAt || now).slice(0, 10),
        registrationSource: lead.source || "\u0625\u062F\u062E\u0627\u0644 \u064A\u062F\u0648\u064A"
      },
      createdBy: user.id,
      createdByName: user.nameAr,
      createdAt: now
    };
    this.state.leadEscalations.unshift(esc);
    lead.approvalState = "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629";
    lead.updatedAt = now;
    if (!lead.interactions) lead.interactions = [];
    lead.interactions.unshift({
      id: uid("lint"),
      type: "escalation",
      direction: "outbound",
      summary: `\u0625\u0631\u0633\u0627\u0644 \u0628\u0637\u0627\u0642\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0647\u062A\u0645 (${esc.requestCode}) \u0639\u0628\u0631 ${esc.channel} \u0625\u0644\u0649 ${recipientName}`,
      actorName: user.nameAr,
      createdAt: now
    });
    this.addNotification(
      `\u0637\u0644\u0628 \u0645\u0631\u0627\u062C\u0639\u0629 \u0645\u0647\u062A\u0645 \u062C\u062F\u064A\u062F ${esc.requestCode}: ${lead.nameAr}`,
      `Lead Approval Request ${esc.requestCode}`,
      `${prop.nameAr} \xB7 \u0648\u062D\u062F\u0629 ${unit.unitNumber} \xB7 \u0627\u0644\u0625\u064A\u062C\u0627\u0631 ${esc.snapshot.rentAmount.toLocaleString()} \u0631.\u0633 (${esc.snapshot.paymentFrequency})`,
      `${lead.nameAr} \xB7 ${unit.unitNumber}`,
      "\u062A\u0634\u063A\u064A\u0644\u064A\u0629",
      targetRoles,
      "tenants"
    );
    this.addAudit(
      user,
      "\u0625\u0631\u0633\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0647\u062A\u0645 \u0644\u0644\u0645\u0627\u0644\u0643 \u0623\u0648 \u0627\u0644\u0645\u0633\u0624\u0648\u0644",
      "LeadEscalation",
      esc.id,
      `\u062A\u0635\u0639\u064A\u062F \u0645\u0644\u0641 \u0627\u0644\u0645\u0647\u062A\u0645 ${lead.nameAr} (${esc.requestCode}) \u0625\u0644\u0649 ${recipientName} \u0639\u0628\u0631 ${esc.channel}`,
      { propertyId: prop.id, newValue: esc.status, deviceName }
    );
    this.persist();
    return esc;
  }
  getLeadEscalationByToken(token) {
    const esc = (this.state.leadEscalations || []).find((e) => e.token === token);
    if (!esc) throw new Error("\u0631\u0627\u0628\u0637 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const expired = new Date(esc.tokenExpiresAt).getTime() < Date.now() && esc.status === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629";
    const unit = this.state.units.find((u) => u.id === esc.unitId);
    return {
      escalation: esc,
      expired,
      propertyName: esc.snapshot.propertyName,
      unitNumber: esc.snapshot.unitNumber,
      unitType: unit?.unitType || "\u0634\u0642\u0629"
    };
  }
  decideLeadEscalation(actorUserId, escalationIdOrToken, input, deviceName) {
    if (!this.state.leadEscalations) this.state.leadEscalations = [];
    const esc = input.isToken ? this.state.leadEscalations.find((e) => e.token === escalationIdOrToken) : this.state.leadEscalations.find((e) => e.id === escalationIdOrToken);
    if (!esc) throw new Error("\u0637\u0644\u0628 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    if (input.isToken && new Date(esc.tokenExpiresAt).getTime() < Date.now() && esc.status === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629") {
      throw new Error("\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0631\u0627\u0628\u0637 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 (72 \u0633\u0627\u0639\u0629)");
    }
    if ((input.decision === "\u0645\u0631\u0641\u0648\u0636" || input.decision === "\u0623\u0631\u064A\u062F \u062A\u0639\u062F\u064A\u0644\u0627\u062A") && !input.decisionNotes?.trim()) {
      throw new Error(input.decision === "\u0645\u0631\u0641\u0648\u0636" ? "\u064A\u0631\u062C\u0649 \u0643\u062A\u0627\u0628\u0629 \u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636" : "\u064A\u0631\u062C\u0649 \u062A\u0648\u0636\u064A\u062D \u0627\u0644\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629");
    }
    const actingUser = actorUserId ? this.state.users.find((u) => u.id === actorUserId && u.active) : void 0;
    if (!input.isToken && !actingUser) {
      throw new Error("\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0644\u0628\u062A \u0641\u064A \u0627\u0644\u0637\u0644\u0628");
    }
    const deciderName = input.isToken ? esc.recipientName : actingUser.nameAr;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const oldStatus = esc.status;
    esc.status = input.decision;
    esc.decisionNotes = input.decisionNotes?.trim() || void 0;
    esc.decidedBy = deciderName;
    esc.decidedAt = now;
    const lead = this.state.leads.find((l) => l.id === esc.leadId);
    if (lead) {
      lead.approvalState = input.decision === "\u0645\u0648\u0627\u0641\u0642" ? "\u0645\u0648\u0627\u0641\u0642" : input.decision === "\u0645\u0631\u0641\u0648\u0636" ? "\u0645\u0631\u0641\u0648\u0636" : "\u0645\u0637\u0644\u0648\u0628 \u062A\u0639\u062F\u064A\u0644\u0627\u062A";
      lead.updatedAt = now;
      if (!lead.interactions) lead.interactions = [];
      lead.interactions.unshift({
        id: uid("lint"),
        type: "decision",
        direction: "inbound",
        summary: `\u0642\u0631\u0627\u0631 ${deciderName} (${esc.requestCode}): ${input.decision}${esc.decisionNotes ? ` \u2014 ${esc.decisionNotes}` : ""}`,
        actorName: deciderName,
        createdAt: now
      });
    }
    this.addNotification(
      `\u0642\u0631\u0627\u0631 \u0637\u0644\u0628 \u0627\u0644\u0645\u0647\u062A\u0645 ${esc.requestCode}: ${input.decision}`,
      `Lead Decision ${esc.requestCode}: ${input.decision}`,
      `${esc.snapshot.leadName} \xB7 ${deciderName}${esc.decisionNotes ? ` \xB7 "${esc.decisionNotes}"` : ""}`,
      `${esc.snapshot.leadName} \xB7 ${input.decision}`,
      "\u062A\u0634\u063A\u064A\u0644\u064A\u0629",
      ["leasing", "supervisor", "gm"],
      "tenants"
    );
    const auditActor = actingUser || {
      id: esc.recipientId,
      nameAr: deciderName,
      nameEn: deciderName,
      role: "owner",
      roleLabelAr: "\u0645\u0627\u0644\u0643 \u0639\u0628\u0631 \u0631\u0627\u0628\u0637 \u0622\u0645\u0646",
      roleLabelEn: "External Owner Link",
      email: esc.recipientEmail || "",
      phone: esc.recipientPhone || "",
      approvalLimitSar: 0,
      active: true,
      deviceName: deviceName || "External Owner Portal",
      lastActiveAt: now
    };
    this.addAudit(
      auditActor,
      `\u0642\u0631\u0627\u0631 \u0627\u0644\u0645\u0631\u0627\u062C\u0639 \u0639\u0644\u0649 \u0637\u0644\u0628 \u0645\u0647\u062A\u0645 (${input.decision})`,
      "LeadEscalation",
      esc.id,
      `\u0628\u062A ${deciderName} \u0641\u064A \u0637\u0644\u0628 \u0627\u0644\u0645\u0647\u062A\u0645 ${esc.snapshot.leadName} (${esc.requestCode}): ${input.decision}`,
      { oldValue: oldStatus, newValue: esc.status, reason: esc.decisionNotes, propertyId: esc.propertyId, deviceName }
    );
    this.persist();
    return esc;
  }
  convertLeadToTenant(userId, leadId, deviceName) {
    return this.runTransaction(() => {
      const user = this.assertPermission(userId, "manage_tenants");
      const lead = this.state.leads.find((l) => l.id === leadId);
      if (!lead) throw new Error("\u0645\u0644\u0641 \u0627\u0644\u0645\u0647\u062A\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      if (lead.convertedToTenantId) {
        const existing = this.state.tenants.find((t) => t.id === lead.convertedToTenantId);
        if (existing) return { lead, tenant: existing };
      }
      const dupTenant = lead.nationalIdOrIqama ? this.state.tenants.find((t) => t.nationalIdOrIqama === lead.nationalIdOrIqama) : this.state.tenants.find((t) => t.phone === lead.phone);
      let tenant;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (dupTenant) {
        tenant = dupTenant;
      } else {
        tenant = {
          id: uid("ten"),
          nameAr: lead.nameAr,
          nameEn: "",
          nationalIdOrIqama: lead.nationalIdOrIqama || `10${Math.floor(1e7 + Math.random() * 89999999)}`,
          nationality: "\u0633\u0639\u0648\u062F\u064A",
          phone: lead.phone,
          email: lead.email || "",
          tenantType: lead.tenantType || "\u0641\u0631\u062F",
          birthDate: lead.birthDate,
          familyMembersCount: lead.familyMembersCount,
          classification: "\u0645\u062D\u062A\u0645\u0644",
          rating: lead.rating ?? 4,
          behaviorScores: { paymentCommitment: 4, unitCare: 4, cooperation: 4, penaltyTotal: 0 },
          onboardingChecklist: {
            idVerified: Boolean(lead.nationalIdOrIqama),
            docsArchived: Boolean(lead.idImageDataUrl),
            depositPaid: false,
            contractSigned: false,
            ejarRegistered: false,
            handoverSigned: false
          },
          notes: lead.notes ? `\u0645\u062D\u0648\u0651\u0644 \u0645\u0646 \u0645\u0647\u062A\u0645 (${lead.source}): ${lead.notes}` : `\u0645\u062D\u0648\u0651\u0644 \u0645\u0646 \u0645\u0647\u062A\u0645 (${lead.source})`,
          createdAt: now
        };
        this.state.tenants.unshift(tenant);
      }
      lead.status = "\u062A\u062D\u0648\u064A\u0644 \u0644\u0639\u0642\u062F";
      lead.convertedToTenantId = tenant.id;
      lead.updatedAt = now;
      if (!lead.interactions) lead.interactions = [];
      lead.interactions.unshift({
        id: uid("lint"),
        type: "decision",
        direction: "outbound",
        summary: `\u062A\u0645 \u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0645\u0647\u062A\u0645 \u0625\u0644\u0649 \u0645\u0644\u0641 \u0645\u0633\u062A\u0623\u062C\u0631 \u0631\u0633\u0645\u064A (${tenant.nameAr})`,
        actorName: user.nameAr,
        createdAt: now
      });
      this.addAudit(
        user,
        "\u062A\u062D\u0648\u064A\u0644 \u0645\u0647\u062A\u0645 \u0625\u0644\u0649 \u0645\u0633\u062A\u0623\u062C\u0631",
        "Lead",
        lead.id,
        `\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0645\u0647\u062A\u0645 ${lead.nameAr} \u0625\u0644\u0649 \u0645\u0644\u0641 \u0645\u0633\u062A\u0623\u062C\u0631 (${tenant.id})`,
        { propertyId: lead.propertyId, newValue: tenant.id, deviceName }
      );
      this.persist();
      return { lead, tenant };
    });
  }
  // 19. Utility Meters & Readings (Exclusive Currency Selector)
  createMeterReading(userId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_properties");
    const prop = this.state.properties.find((p) => p.id === input.propertyId);
    if (!prop) throw new Error("\u0627\u0644\u0639\u0642\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    if (!input.meterNumber?.trim()) throw new Error("\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0631\u0642\u0645 \u0627\u0644\u0639\u062F\u0627\u062F");
    const prevVal = Number(input.previousReading || 0);
    const currVal = Number(input.currentReading || 0);
    if (currVal < prevVal) throw new Error("\u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0623\u0648 \u062A\u0633\u0627\u0648\u064A \u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629");
    if (!this.state.meterReadings) this.state.meterReadings = [];
    const reading = {
      id: uid("mr"),
      readingNumber: `MTR-2026-${pad3(this.state.meterReadings.length + 1)}`,
      propertyId: prop.id,
      unitId: input.unitId || void 0,
      meterType: input.meterType,
      meterNumber: input.meterNumber.trim(),
      previousReading: prevVal,
      currentReading: currVal,
      consumption: Math.max(0, currVal - prevVal),
      billAmount: Number(input.billAmount || 0),
      currency: input.currency || "SAR",
      billingPeriod: input.billingPeriod || "2026-11",
      paidBy: input.paidBy || "\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631",
      recordedBy: user.nameAr,
      notes: input.notes?.trim() || void 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.meterReadings.unshift(reading);
    this.addAudit(
      user,
      "\u062A\u0633\u062C\u064A\u0644 \u0642\u0631\u0627\u0621\u0629 \u0639\u062F\u0627\u062F",
      "MeterReading",
      reading.id,
      `\u0642\u0631\u0627\u0621\u0629 \u0639\u062F\u0627\u062F ${reading.meterType} (${reading.meterNumber}) \u0628\u0642\u064A\u0645\u0629 ${reading.billAmount} ${reading.currency}`,
      { propertyId: prop.id, newValue: String(reading.currentReading), deviceName }
    );
    this.persist();
    return reading;
  }
  // 20. Sync Engine (Delta Pull & Multi-Device Conflict Evaluation)
  getSyncDelta(userId, sinceIso) {
    const conflicts = this.state.syncConflicts || [];
    const pendingConflictsCount = conflicts.filter((c) => c.status === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0645\u062F\u064A\u0631").length;
    const hasChanges = !sinceIso || this.state.lastUpdatedAt > sinceIso;
    return {
      hasChanges,
      serverRevision: this.state.syncRevision || 1,
      lastUpdatedAt: this.state.lastUpdatedAt,
      pendingConflictsCount,
      syncConflicts: conflicts,
      state: hasChanges ? this.getStateForUser(userId) : void 0
    };
  }
  evaluateSyncOperationConflict(userId, op, clientLastUpdatedAt) {
    const opKey = op.operationId || op.idempotencyKey;
    const existingOp = this.sqlite.hasOperation(opKey);
    if (existingOp || this.idempotencyIndex.has(op.idempotencyKey)) {
      let cachedResult;
      if (existingOp?.resultJson) {
        try {
          cachedResult = JSON.parse(existingOp.resultJson);
        } catch {
          cachedResult = void 0;
        }
      }
      return { skipDuplicate: true, cachedResult };
    }
    const isMutationOnExisting = op.method === "PATCH" || op.method === "DELETE";
    const entityKey = op.entityType && op.entityId ? `${op.entityType}:${op.entityId}` : void 0;
    const serverEntityRev = entityKey ? this.state.entityRevisions?.[entityKey] || 1 : void 0;
    const revisionMismatch = isMutationOnExisting && typeof op.baseRevision === "number" && typeof serverEntityRev === "number" && serverEntityRev > op.baseRevision;
    const timestampMismatch = isMutationOnExisting && typeof op.baseRevision !== "number" && Boolean(clientLastUpdatedAt && this.state.lastUpdatedAt > clientLastUpdatedAt);
    if (revisionMismatch || timestampMismatch) {
      const user = this.state.users.find((u) => u.id === userId);
      const policy = this.state.settings.syncCenter?.conflictResolution || "latest_wins";
      const status = policy === "manual_review" ? "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0645\u062F\u064A\u0631" : "\u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0623\u062D\u062F\u062B";
      const conflict = {
        id: uid("cnf"),
        entityType: op.entityType || "SyncBatch",
        entityId: op.entityId || op.endpoint,
        entityLabel: op.descriptionAr || op.endpoint,
        firstActorName: "\u0627\u0644\u062E\u0627\u062F\u0645 \u0627\u0644\u0645\u0631\u0643\u0632\u064A (\u062A\u0639\u062F\u064A\u0644 \u0645\u062A\u0632\u0627\u0645\u0646)",
        secondActorName: `${user?.nameAr || userId} (${op.deviceName || "\u062C\u0647\u0627\u0632 \u0637\u0631\u0641\u064A"})`,
        firstChangeSummary: revisionMismatch ? `\u0646\u0633\u062E\u0629 \u0627\u0644\u062E\u0627\u062F\u0645 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0631\u0642\u0645 ${serverEntityRev} \u0645\u0642\u0627\u0628\u0644 \u0646\u0633\u062E\u0629 \u0627\u0644\u0639\u0645\u064A\u0644 ${op.baseRevision}` : `\u062A\u0639\u062F\u064A\u0644 \u0633\u0627\u0628\u0642 \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645 \u0628\u062A\u0627\u0631\u064A\u062E ${this.state.lastUpdatedAt.slice(0, 16).replace("T", " ")}`,
        secondChangeSummary: `\u0645\u0632\u0627\u0645\u0646\u0629 \u0645\u0646 \u0648\u0636\u0639 \u0639\u062F\u0645 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 (${op.descriptionAr})`,
        status,
        resolvedBy: status === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0645\u062F\u064A\u0631" ? void 0 : "\u0645\u062D\u0631\u0643 \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A",
        resolvedAt: status === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0645\u062F\u064A\u0631" ? void 0 : (/* @__PURE__ */ new Date()).toISOString(),
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (!this.state.syncConflicts) this.state.syncConflicts = [];
      this.state.syncConflicts.unshift(conflict);
      this.persist();
      return { skipDuplicate: false, conflict };
    }
    return { skipDuplicate: false };
  }
  recordSyncOperationResult(operationId, userId, method, endpoint, result, entityType, entityId) {
    if (!operationId) return;
    if (!this.state.processedIdempotencyKeys.includes(operationId)) {
      this.state.processedIdempotencyKeys.push(operationId);
      if (this.state.processedIdempotencyKeys.length > 2e3) {
        this.state.processedIdempotencyKeys = this.state.processedIdempotencyKeys.slice(-2e3);
      }
    }
    this.idempotencyIndex.add(operationId);
    if (entityType && entityId) {
      this.bumpEntityRevision(`${entityType}:${entityId}`);
    }
    this.sqlite.recordOperation({
      operationId,
      userId,
      method,
      endpoint,
      entityType,
      entityId,
      resultJson: JSON.stringify(result),
      status: "completed",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  // 21. Advanced Report Builder — Scheduled Reports
  createScheduledReport(userId, input, deviceName) {
    const user = this.assertPermission(userId, "view_audit");
    if (!input.title?.trim()) throw new Error("\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u062C\u062F\u0648\u0644");
    if (!this.state.scheduledReports) this.state.scheduledReports = [];
    const schedule = {
      id: uid("sch"),
      title: input.title.trim(),
      dataset: input.dataset,
      frequency: input.frequency || "\u0623\u0633\u0628\u0648\u0639\u064A",
      deliveryChannel: input.deliveryChannel || "\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A",
      recipient: input.recipient?.trim() || user.email,
      fields: Array.isArray(input.fields) && input.fields.length > 0 ? input.fields : ["id"],
      groupBy: input.groupBy || "none",
      enabled: true,
      createdBy: user.nameAr,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.scheduledReports.unshift(schedule);
    this.addAudit(
      user,
      "\u0625\u0646\u0634\u0627\u0621 \u062C\u062F\u0648\u0644\u0629 \u062A\u0642\u0631\u064A\u0631 \u062A\u0644\u0642\u0627\u0626\u064A",
      "ScheduledReport",
      schedule.id,
      `\u062C\u062F\u0648\u0644\u0629 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 (${schedule.title}) \u0628\u062A\u0643\u0631\u0627\u0631 ${schedule.frequency} \u0639\u0628\u0631 ${schedule.deliveryChannel}`,
      { deviceName }
    );
    this.persist();
    return schedule;
  }
  deleteScheduledReport(userId, scheduleId, deviceName) {
    const user = this.assertPermission(userId, "view_audit");
    const list = this.state.scheduledReports || [];
    const target = list.find((s) => s.id === scheduleId);
    if (!target) throw new Error("\u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u062C\u062F\u0648\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    this.state.scheduledReports = list.filter((s) => s.id !== scheduleId);
    this.addAudit(
      user,
      "\u062D\u0630\u0641 \u062C\u062F\u0648\u0644\u0629 \u062A\u0642\u0631\u064A\u0631",
      "ScheduledReport",
      scheduleId,
      `\u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u062C\u062F\u0648\u0644: ${target.title}`,
      { deviceName }
    );
    this.persist();
    return { deletedId: scheduleId };
  }
  runScheduledReportNow(userId, scheduleId, deviceName) {
    const user = this.assertPermission(userId, "view_audit");
    const target = (this.state.scheduledReports || []).find((s) => s.id === scheduleId);
    if (!target) throw new Error("\u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u062C\u062F\u0648\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    target.lastRunAt = (/* @__PURE__ */ new Date()).toISOString();
    this.state.notifications.unshift({
      id: uid("ntf"),
      titleAr: `\u062A\u0642\u0631\u064A\u0631 \u0645\u062C\u062F\u0648\u0644 \u062C\u0627\u0647\u0632: ${target.title}`,
      titleEn: `Scheduled Report Ready: ${target.title}`,
      messageAr: `\u062A\u0645 \u062A\u0648\u0644\u064A\u062F \u0648\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 (${target.title}) \u0625\u0644\u0649 ${target.recipient} \u0639\u0628\u0631 ${target.deliveryChannel}.`,
      messageEn: `Generated report (${target.title}) for ${target.recipient}.`,
      category: "\u0645\u0627\u0644\u064A\u0629",
      targetRoles: ["gm", "accountant", "sys_owner"],
      relatedView: "reports",
      isReadBy: [],
      createdAt: target.lastRunAt
    });
    this.addAudit(
      user,
      "\u062A\u0634\u063A\u064A\u0644 \u0641\u0648\u0631\u064A \u0644\u062A\u0642\u0631\u064A\u0631 \u0645\u062C\u062F\u0648\u0644",
      "ScheduledReport",
      target.id,
      `\u062A\u0645 \u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u062C\u062F\u0648\u0644 (${target.title}) \u0648\u0625\u0631\u0633\u0627\u0644\u0647 \u0639\u0628\u0631 ${target.deliveryChannel}`,
      { deviceName }
    );
    this.persist();
    return target;
  }
  // 22. ZATCA Phase 1/2 TLV QR E-Invoicing & Tax Archive
  buildZatcaTlvBase64(sellerName, vatNumber, timestamp, totalWithVat, vatAmount) {
    const encodeTag = (tag, value) => {
      const buf = Buffer.from(value, "utf-8");
      return Buffer.concat([Buffer.from([tag, buf.length]), buf]);
    };
    return Buffer.concat([
      encodeTag(1, sellerName),
      encodeTag(2, vatNumber),
      encodeTag(3, timestamp),
      encodeTag(4, totalWithVat.toFixed(2)),
      encodeTag(5, vatAmount.toFixed(2))
    ]).toString("base64");
  }
  createZatcaInvoice(userId, input, deviceName) {
    const user = this.assertPermission(userId, "manage_accounting");
    const subtotal = Number(input.subtotal || 0);
    if (subtotal <= 0) throw new Error("\u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0635\u0627\u0641\u064A \u0645\u0628\u0644\u063A \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631");
    if (!input.buyerName?.trim()) throw new Error("\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644 / \u0627\u0644\u0645\u0634\u062A\u0631\u064A");
    const vatRate = input.vatRate !== void 0 ? Number(input.vatRate) : 15;
    const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
    const totalWithVat = Math.round((subtotal + vatAmount) * 100) / 100;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (!this.state.zatcaInvoices) this.state.zatcaInvoices = [];
    const invNum = `INV-ZATCA-${(/* @__PURE__ */ new Date()).getFullYear()}-${pad4(this.state.zatcaInvoices.length + 1)}`;
    const sellerName = this.state.settings.nameAr;
    const vatNumber = this.state.settings.vatNumber || "310489211400003";
    const tlvBase64 = this.buildZatcaTlvBase64(sellerName, vatNumber, now, totalWithVat, vatAmount);
    const invoiceHash = crypto3.createHash("sha256").update(`${invNum}|${vatNumber}|${now}|${totalWithVat.toFixed(2)}|${vatAmount.toFixed(2)}`).digest("hex");
    const clearanceStatus = this.state.settings.zatcaPhase.includes("\u0627\u0644\u062B\u0627\u0646\u064A\u0629") ? "\u062A\u0645 \u0627\u0644\u0631\u0628\u0637 \u0648\u0627\u0644\u062A\u062D\u0642\u0642 (\u0627\u0644\u0645\u0631\u062D\u0644\u0629 2)" : "\u0645\u0624\u0631\u0634\u0641 (\u0627\u0644\u0645\u0631\u062D\u0644\u0629 1)";
    const record = {
      id: uid("zatca"),
      invoiceNumber: invNum,
      invoiceType: input.invoiceType || "\u0641\u0627\u062A\u0648\u0631\u0629 \u0636\u0631\u064A\u0628\u064A\u0629 \u0645\u0628\u0633\u0637\u0629 (B2C)",
      issueDate: now.slice(0, 10),
      sellerName,
      vatNumber,
      buyerName: input.buyerName.trim(),
      buyerVatNumber: input.buyerVatNumber?.trim() || void 0,
      propertyId: input.propertyId || void 0,
      unitId: input.unitId || void 0,
      relatedPaymentId: input.relatedPaymentId || void 0,
      subtotal,
      vatRate,
      vatAmount,
      totalWithVat,
      currency: "SAR",
      tlvBase64,
      invoiceHash,
      clearanceStatus,
      notes: input.notes?.trim() || void 0,
      createdBy: user.nameAr,
      createdAt: now
    };
    this.state.zatcaInvoices.unshift(record);
    this.state.documents.unshift({
      id: uid("doc"),
      title: `\u0641\u0627\u062A\u0648\u0631\u0629 \u0636\u0631\u064A\u0628\u064A\u0629 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629 ${record.invoiceNumber} \u2014 ${record.buyerName}`,
      category: "\u0641\u0648\u0627\u062A\u064A\u0631",
      fileName: `${record.invoiceNumber}.json`,
      fileType: "application/json",
      fileSizeKb: 4,
      relatedType: record.propertyId ? "\u0639\u0642\u0627\u0631" : "\u0634\u0631\u0643\u0629",
      relatedId: record.propertyId || "company",
      version: 1,
      uploadedBy: user.id,
      ocrStatus: "\u062A\u0645 \u0627\u0644\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0622\u0644\u064A\u0627\u064B",
      ocrRawText: `ZATCA TLV: ${tlvBase64}
SHA256: ${invoiceHash}
Total: ${totalWithVat} SAR`,
      createdAt: now
    });
    this.addAudit(
      user,
      "\u0625\u0635\u062F\u0627\u0631 \u0641\u0627\u062A\u0648\u0631\u0629 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629 ZATCA",
      "ZatcaInvoice",
      record.id,
      `\u0625\u0635\u062F\u0627\u0631 ${record.invoiceNumber} \u0644\u0644\u0639\u0645\u064A\u0644 ${record.buyerName} \u0628\u0625\u062C\u0645\u0627\u0644\u064A ${totalWithVat} \u0631.\u0633 (\u0636\u0631\u064A\u0628\u0629 ${vatAmount} \u0631.\u0633) \u0648\u0623\u0631\u0634\u0641\u062A\u0647\u0627 \u0636\u0631\u064A\u0628\u064A\u0627\u064B`,
      { propertyId: record.propertyId, newValue: record.invoiceHash.slice(0, 12), deviceName }
    );
    this.persist();
    return record;
  }
  // 23. Favorite Custom Reports & Shared Compound Search Filters
  saveFavoriteReport(userId, input, deviceName) {
    const user = this.getActingUser(userId);
    if (!this.state.favoriteReports) this.state.favoriteReports = [];
    const preset = {
      ...input,
      id: uid("favr"),
      createdBy: user.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.favoriteReports.unshift(preset);
    this.addAudit(user, "\u062D\u0641\u0638 \u062A\u0642\u0631\u064A\u0631 \u0645\u0641\u0636\u0644", "FavoriteReport", preset.id, `\u062D\u0641\u0638 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0645\u0641\u0636\u0644 "${preset.title}"`, {
      deviceName
    });
    this.persist();
    return preset;
  }
  deleteFavoriteReport(userId, presetId) {
    this.getActingUser(userId);
    this.state.favoriteReports = (this.state.favoriteReports || []).filter((r) => r.id !== presetId);
    this.persist();
    return { deletedId: presetId };
  }
  saveSharedSearchFilter(userId, input, deviceName) {
    const user = this.getActingUser(userId);
    if (!this.state.sharedSearchFilters) this.state.sharedSearchFilters = [];
    const filter = {
      ...input,
      id: uid("sf"),
      createdBy: user.id,
      createdByName: user.nameAr,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.state.sharedSearchFilters.unshift(filter);
    this.addAudit(
      user,
      filter.isShared ? "\u0645\u0634\u0627\u0631\u0643\u0629 \u0641\u0644\u062A\u0631 \u0628\u062D\u062B \u0645\u0648\u062D\u062F" : "\u062D\u0641\u0638 \u0641\u0644\u062A\u0631 \u0628\u062D\u062B \u0645\u0641\u0636\u0644",
      "SharedSearchFilter",
      filter.id,
      `\u062D\u0641\u0638 \u0627\u0644\u0641\u0644\u062A\u0631 "${filter.name}"`,
      { deviceName }
    );
    this.persist();
    return filter;
  }
  deleteSharedSearchFilter(userId, filterId) {
    this.getActingUser(userId);
    this.state.sharedSearchFilters = (this.state.sharedSearchFilters || []).filter((f) => f.id !== filterId);
    this.persist();
    return { deletedId: filterId };
  }
  // ==================== CUSTOM LOCAL / DESKTOP DISK STORAGE ====================
  resolveStorageDir(configuredPath, fallbackDir) {
    const raw = (configuredPath || "").trim();
    if (!raw) return fallbackDir;
    if (process.platform !== "win32" && (/^[A-Za-z]:[\\/]/.test(raw) || raw.startsWith("\\\\"))) {
      return fallbackDir;
    }
    try {
      const resolved = path2.resolve(raw);
      if (!fs2.existsSync(resolved)) fs2.mkdirSync(resolved, { recursive: true });
      return resolved;
    } catch {
      return fallbackDir;
    }
  }
  getBackupsDir() {
    return this.resolveStorageDir(this.state.settings.backupPolicy?.customPath, this.paths.backupDir);
  }
  getArchiveDir() {
    return this.resolveStorageDir(this.state.settings.backupPolicy?.archivePath, this.paths.archiveDir);
  }
  getDocumentsDir() {
    return this.resolveStorageDir(this.state.settings.backupPolicy?.documentsPath, this.paths.documentsDir);
  }
  resolveBackupFile(backupId) {
    const candidates = [
      path2.join(this.getBackupsDir(), `${backupId}.enc.json`),
      path2.join(this.getBackupsDir(), `${backupId}.json`),
      path2.join(this.paths.backupDir, `${backupId}.enc.json`),
      path2.join(this.paths.backupDir, `${backupId}.json`)
    ];
    for (const candidate of candidates) {
      if (fs2.existsSync(candidate)) return candidate;
    }
    return null;
  }
  writeDocumentToDisk(doc) {
    try {
      const dir = this.getDocumentsDir();
      if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
      const safeBase = (doc.fileName || `${doc.id}.json`).replace(/[<>:"/\\|?*]+/g, "_");
      const targetFile = path2.join(dir, `${doc.id}_${safeBase}`);
      if (doc.dataUrl && doc.dataUrl.includes(";base64,")) {
        const base64Part = doc.dataUrl.split(";base64,")[1];
        fs2.writeFileSync(targetFile, Buffer.from(base64Part, "base64"));
      } else {
        const metaFile = path2.join(dir, `${doc.id}_${safeBase}.meta.json`);
        fs2.writeFileSync(metaFile, JSON.stringify({ id: doc.id, title: doc.title, category: doc.category, fileName: doc.fileName, createdAt: doc.createdAt }, null, 2), "utf-8");
        return metaFile;
      }
      return targetFile;
    } catch {
      return null;
    }
  }
  writeArchiveBundleToDisk() {
    try {
      const dir = this.getArchiveDir();
      if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
      const bundles = {
        contracts: this.state.contracts.filter((c) => Boolean(c.archivedAt)),
        tenants: this.state.tenants.filter((t) => Boolean(t.archivedAt)),
        receipts: this.state.payments.filter((p) => Boolean(p.archivedAt)),
        tickets: this.state.tickets.filter((t) => Boolean(t.archivedAt)),
        documents: this.state.documents.filter((d) => Boolean(d.archivedAt)),
        units: this.state.units.filter((u) => Boolean(u.archivedAt))
      };
      let written = 0;
      for (const [key, items] of Object.entries(bundles)) {
        const filePath = path2.join(dir, `archive-${key}.json`);
        fs2.writeFileSync(filePath, JSON.stringify({ updatedAt: (/* @__PURE__ */ new Date()).toISOString(), count: items.length, items }, null, 2), "utf-8");
        written += 1;
      }
      return written;
    } catch {
      return 0;
    }
  }
  validateStorageFolder(targetPath) {
    const raw = (targetPath || "").trim();
    if (!raw) return { ok: false, resolvedPath: "", error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0645\u0633\u0627\u0631 \u0627\u0644\u0645\u062C\u0644\u062F \u0623\u0648\u0644\u0627\u064B" };
    if (process.platform !== "win32" && (/^[A-Za-z]:[\\/]/.test(raw) || raw.startsWith("\\\\"))) {
      return {
        ok: true,
        resolvedPath: raw
      };
    }
    try {
      const resolved = path2.resolve(raw);
      if (!fs2.existsSync(resolved)) fs2.mkdirSync(resolved, { recursive: true });
      const probe = path2.join(resolved, `.aqarplus-probe-${Date.now()}.tmp`);
      fs2.writeFileSync(probe, "ok", "utf-8");
      fs2.unlinkSync(probe);
      return { ok: true, resolvedPath: resolved };
    } catch (err) {
      return { ok: false, resolvedPath: raw, error: err.message };
    }
  }
  getStorageStatus() {
    ensureWorkspaceDirs(this.paths);
    const backupsDir = this.getBackupsDir();
    const archiveDir = this.getArchiveDir();
    const documentsDir = this.getDocumentsDir();
    const countFiles = (dir) => {
      try {
        return fs2.existsSync(dir) ? fs2.readdirSync(dir).length : 0;
      } catch {
        return 0;
      }
    };
    return {
      dataDir: this.paths.dataDir,
      backupsDir,
      archiveDir,
      documentsDir,
      backupsFilesCount: countFiles(backupsDir),
      archiveFilesCount: countFiles(archiveDir),
      documentsFilesCount: countFiles(documentsDir),
      platform: process.platform,
      sqlite: this.sqlite.getDiagnostics()
    };
  }
  syncFoldersToDisk(userId, deviceName) {
    const user = this.assertPermission(userId, "backup_restore");
    ensureWorkspaceDirs(this.paths);
    const backupsDir = this.getBackupsDir();
    let backupsSynced = 0;
    try {
      if (!fs2.existsSync(backupsDir)) fs2.mkdirSync(backupsDir, { recursive: true });
      for (const bkp of this.state.backups) {
        const src = path2.join(this.paths.backupDir, `${bkp.id}.json`);
        const dst = path2.join(backupsDir, `${bkp.id}.json`);
        if (fs2.existsSync(src) && src !== dst) {
          fs2.copyFileSync(src, dst);
          backupsSynced += 1;
        } else if (fs2.existsSync(dst)) {
          backupsSynced += 1;
        }
      }
    } catch {
    }
    const archiveFilesSynced = this.writeArchiveBundleToDisk();
    let documentsSynced = 0;
    for (const doc of this.state.documents) {
      const written = this.writeDocumentToDisk(doc);
      if (written) {
        doc.diskPath = written;
        documentsSynced += 1;
      }
    }
    this.addAudit(
      user,
      "\u0645\u0632\u0627\u0645\u0646\u0629 \u0645\u062C\u0644\u062F\u0627\u062A \u0627\u0644\u062A\u062E\u0632\u064A\u0646 \u0639\u0644\u0649 \u0627\u0644\u0642\u0631\u0635",
      "StoragePaths",
      "sync",
      `\u0646\u0633\u062E \u0627\u062D\u062A\u064A\u0627\u0637\u064A (${backupsSynced}) \xB7 \u0623\u0631\u0634\u064A\u0641 (${archiveFilesSynced}) \xB7 \u0645\u0633\u062A\u0646\u062F\u0627\u062A (${documentsSynced})`,
      { deviceName }
    );
    this.persist();
    return {
      backupsSynced,
      archiveFilesSynced,
      documentsSynced,
      status: this.getStorageStatus()
    };
  }
  // 22. Employee Invitations, Workforce Lifecycle, Custom Roles, Profile & Credential Recovery
  isLocalSimulationAllowed() {
    return process.env.NODE_ENV !== "production" || process.env.AQAR_LOCAL_RECOVERY_PREVIEW === "true";
  }
  assertTeamManager(userId) {
    const actor = this.assertModuleAction(userId, "team", "manage");
    if (actor.role !== "sys_owner" && actor.role !== "gm") {
      throw new PermissionDeniedError("\u0625\u062F\u0627\u0631\u0629 \u0641\u0631\u064A\u0642 \u0627\u0644\u0639\u0645\u0644 \u0648\u0627\u0644\u062F\u0639\u0648\u0627\u062A \u0645\u062A\u0627\u062D\u0629 \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645 \u0623\u0648 \u0645\u062F\u064A\u0631 \u0627\u0644\u0634\u0631\u0643\u0629 \u0641\u0642\u0637");
    }
    return actor;
  }
  resolveRoleMeta(role, customRoleId) {
    if (customRoleId && Array.isArray(this.state.customRoles)) {
      const custom = this.state.customRoles.find((r) => r.id === customRoleId);
      if (custom) {
        return { roleLabelAr: custom.nameAr, roleLabelEn: custom.nameEn };
      }
    }
    const tpl = ROLE_TEMPLATES.find((t) => t.key === role);
    if (tpl) {
      return { roleLabelAr: tpl.labelAr, roleLabelEn: tpl.labelEn };
    }
    return { roleLabelAr: "\u0645\u0648\u0638\u0641", roleLabelEn: "Staff Member" };
  }
  buildInviteDeliveryNotice(channel, recipientPhone, recipientEmail, inviteUrl, verificationCode, companyNameAr) {
    const cleanPhone = (recipientPhone || "").replace(/[^\d]/g, "");
    const waPhone = cleanPhone.startsWith("05") ? `966${cleanPhone.slice(1)}` : cleanPhone;
    const messageText = `\u0645\u0631\u062D\u0628\u0627\u064B\u060C \u0646\u062F\u0639\u0648\u0643 \u0644\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u0625\u0644\u0649 \u0641\u0631\u064A\u0642 ${companyNameAr} \u0641\u064A \u0646\u0638\u0627\u0645 AqarPlus.
\u0631\u0627\u0628\u0637 \u0627\u0644\u062A\u0641\u0639\u064A\u0644:
${inviteUrl}
\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642: ${verificationCode}`;
    const integrations = this.state.settings?.integrationsConfig;
    if (channel === "whatsapp") {
      const externalGatewayConfigured = Boolean(integrations?.whatsappBusinessEnabled);
      return {
        handoffUrl: `https://wa.me/${waPhone}?text=${encodeURIComponent(messageText)}`,
        externalGatewayConfigured,
        deliveryNotice: externalGatewayConfigured ? "\u062A\u0645 \u062A\u062C\u0647\u064A\u0632 \u0627\u0644\u062F\u0639\u0648\u0629 \u0648\u0625\u0631\u0633\u0627\u0644\u0647\u0627 \u0639\u0628\u0631 \u0628\u0648\u0627\u0628\u0629 \u0648\u0627\u062A\u0633\u0627\u0628 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0645\u062A\u0635\u0644\u0629." : "\u062A\u0645 \u062A\u0648\u0644\u064A\u062F \u0631\u0627\u0628\u0637 \u0627\u0644\u062F\u0639\u0648\u0629 \u0648\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u062D\u0644\u064A\u0627\u064B \u2014 \u0627\u0633\u062A\u062E\u062F\u0645 \u0632\u0631 \u0641\u062A\u062D \u0648\u0627\u062A\u0633\u0627\u0628 \u0623\u0648 \u0646\u0633\u062E \u0627\u0644\u0631\u0627\u0628\u0637 \u0644\u0625\u0631\u0633\u0627\u0644\u0647 \u0644\u0644\u0645\u0648\u0638\u0641 (\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u0648\u0627\u0628\u0629 WhatsApp API \u0645\u0641\u0639\u0651\u0644\u0629 \u0644\u0644\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0622\u0644\u064A)."
      };
    }
    if (channel === "email") {
      const externalGatewayConfigured = Boolean(integrations?.smtpEnabled);
      const subject = `\u062F\u0639\u0648\u0629 \u0627\u0646\u0636\u0645\u0627\u0645 \u0625\u0644\u0649 ${companyNameAr} \u2014 AqarPlus`;
      return {
        handoffUrl: `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(messageText)}`,
        externalGatewayConfigured,
        deliveryNotice: externalGatewayConfigured ? "\u062A\u0645 \u062A\u062C\u0647\u064A\u0632 \u0627\u0644\u062F\u0639\u0648\u0629 \u0648\u0625\u0631\u0633\u0627\u0644\u0647\u0627 \u0639\u0628\u0631 \u062E\u0627\u062F\u0645 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A (SMTP) \u0627\u0644\u0645\u0641\u0639\u0651\u0644." : "\u062A\u0645 \u062A\u0648\u0644\u064A\u062F \u0631\u0627\u0628\u0637 \u0627\u0644\u062F\u0639\u0648\u0629 \u0648\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u062D\u0644\u064A\u0627\u064B \u2014 \u0627\u0633\u062A\u062E\u062F\u0645 \u0632\u0631 \u0641\u062A\u062D \u0627\u0644\u0628\u0631\u064A\u062F \u0623\u0648 \u0646\u0633\u062E \u0627\u0644\u0631\u0627\u0628\u0637 \u0644\u0625\u0631\u0633\u0627\u0644\u0647 \u0644\u0644\u0645\u0648\u0638\u0641 (\u0644\u0627 \u062A\u0648\u062C\u062F \u0625\u0639\u062F\u0627\u062F\u0627\u062A SMTP \u0645\u0641\u0639\u0651\u0644\u0629)."
      };
    }
    if (channel === "sms") {
      const externalGatewayConfigured = Boolean(integrations?.smsGatewayEnabled);
      return {
        handoffUrl: `sms:${cleanPhone}?body=${encodeURIComponent(messageText)}`,
        externalGatewayConfigured,
        deliveryNotice: externalGatewayConfigured ? "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u062F\u0639\u0648\u0629 \u0627\u0644\u0646\u0635\u064A\u0629 \u0639\u0628\u0631 \u0628\u0648\u0627\u0628\u0629 SMS \u0627\u0644\u0645\u062A\u0635\u0644\u0629." : "\u062A\u0645 \u062A\u0648\u0644\u064A\u062F \u0631\u0627\u0628\u0637 \u0627\u0644\u062F\u0639\u0648\u0629 \u0648\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u062D\u0644\u064A\u0627\u064B \u2014 \u0627\u0633\u062A\u062E\u062F\u0645 \u0632\u0631 \u0641\u062A\u062D \u0627\u0644\u0631\u0633\u0627\u0626\u0644 SMS \u0623\u0648 \u0646\u0633\u062E \u0627\u0644\u0631\u0627\u0628\u0637 \u0644\u0625\u0631\u0633\u0627\u0644\u0647 \u0644\u0644\u0645\u0648\u0638\u0641 (\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u0648\u0627\u0628\u0629 SMS \u0645\u0641\u0639\u0651\u0644\u0629)."
      };
    }
    return {
      handoffUrl: inviteUrl,
      externalGatewayConfigured: false,
      deliveryNotice: "\u062A\u0645 \u062A\u0648\u0644\u064A\u062F \u0631\u0627\u0628\u0637 \u0627\u0644\u062F\u0639\u0648\u0629 \u0648\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0645\u0643\u0648\u0646 \u0645\u0646 6 \u0623\u0631\u0642\u0627\u0645 \u2014 \u0627\u0646\u0633\u062E \u0627\u0644\u0631\u0627\u0628\u0637 \u0648\u0627\u0644\u0631\u0645\u0632 \u0648\u0623\u0631\u0633\u0644\u0647\u0645\u0627 \u0644\u0644\u0645\u0648\u0638\u0641."
    };
  }
  createEmployeeWithInvite(actorUserId, input, originUrl, deviceName) {
    return this.runTransaction(() => {
      const actor = this.assertTeamManager(actorUserId);
      if (!input.nameAr?.trim() || !input.phone?.trim() || !input.email?.trim()) {
        throw new Error("\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644\u060C \u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u060C \u0648\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u062D\u0642\u0648\u0644 \u0645\u0637\u0644\u0648\u0628\u0629");
      }
      const normEmail = input.email.trim().toLowerCase();
      const normPhone = input.phone.trim();
      const normUsername = input.username?.trim() ? input.username.trim().toLowerCase() : void 0;
      if (actor.role === "gm" && (input.role === "sys_owner" || input.role === "gm")) {
        throw new PermissionDeniedError("\u0625\u0636\u0627\u0641\u0629 \u0645\u0627\u0644\u0643 \u0646\u0638\u0627\u0645 \u0623\u0648 \u0645\u062F\u064A\u0631 \u0639\u0627\u0645 \u0635\u0644\u0627\u062D\u064A\u0629 \u062D\u0635\u0631\u064A\u0629 \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645 \u0641\u0642\u0637");
      }
      if (this.state.users.some((u) => u.email.toLowerCase() === normEmail)) {
        throw new Error("\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644 \u0644\u062D\u0633\u0627\u0628 \u0622\u062E\u0631 \u062F\u0627\u062E\u0644 \u0627\u0644\u0634\u0631\u0643\u0629");
      }
      if (this.state.users.some((u) => u.phone === normPhone)) {
        throw new Error("\u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644 \u0627\u0644\u0623\u0633\u0627\u0633\u064A \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0644\u0645\u0648\u0638\u0641 \u0622\u062E\u0631");
      }
      if (normUsername && this.state.users.some((u) => u.username?.toLowerCase() === normUsername)) {
        throw new Error("\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644 \u2014 \u0627\u062E\u062A\u0631 \u0627\u0633\u0645\u0627\u064B \u0622\u062E\u0631");
      }
      if (input.customRoleId) {
        const customExists = (this.state.customRoles || []).some((r) => r.id === input.customRoleId);
        if (!customExists) throw new Error("\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0645\u062E\u0635\u0635 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      }
      const companyId = this.getWorkspaceCompanyId();
      const company = this.getCompanySummary();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1e3).toISOString();
      const meta = this.resolveRoleMeta(input.role, input.customRoleId);
      const newUser = {
        id: uid("usr"),
        companyId,
        nameAr: input.nameAr.trim(),
        nameEn: (input.nameEn || input.nameAr).trim(),
        username: normUsername,
        jobTitle: input.jobTitle?.trim() || meta.roleLabelAr,
        department: input.department?.trim() || "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629",
        role: input.role,
        roleLabelAr: meta.roleLabelAr,
        roleLabelEn: meta.roleLabelEn,
        customRoleId: input.customRoleId,
        email: normEmail,
        phone: normPhone,
        secondaryPhone: input.secondaryPhone?.trim() || void 0,
        approvalLimitSar: Number(input.approvalLimitSar || 0),
        active: false,
        accountStatus: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0641\u0639\u064A\u0644",
        deviceName: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0641\u0639\u064A\u0644 \u0639\u0628\u0631 \u0627\u0644\u062F\u0639\u0648\u0629",
        lastActiveAt: now,
        createdAt: now,
        statusState: "\u063A\u064A\u0631 \u0645\u062A\u0635\u0644",
        specialty: input.jobTitle?.trim() || meta.roleLabelAr,
        avatarDataUrl: input.avatarDataUrl,
        allowedPropertyIds: input.allowedPropertyIds && input.allowedPropertyIds.length > 0 ? input.allowedPropertyIds : void 0,
        customModulePermissions: input.customModulePermissions,
        managerRating: 5,
        lastActivitySummary: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062D\u0633\u0627\u0628 \u0648\u0625\u0631\u0633\u0627\u0644 \u062F\u0639\u0648\u0629 \u0627\u0644\u062A\u0641\u0639\u064A\u0644",
        security: {
          twoFactorEnabled: false,
          biometricEnabled: false,
          hasPin: false,
          failedAttempts: 0,
          lastPasswordChangedAt: void 0,
          requirePasswordChange90d: true,
          tempPasswordSet: false
        },
        notificationPrefs: {
          dndEnabled: false,
          taskAssigned: true,
          taskReminder: true,
          taskApproved: true,
          taskComment: true,
          urgentTicket: true
        }
      };
      const rawToken = crypto3.randomBytes(24).toString("hex");
      const verificationCode = String(crypto3.randomInt(1e5, 1e6));
      const invId = uid("inv");
      this.sqlite.createInviteSecret({
        invitationId: invId,
        userId: newUser.id,
        companyId,
        rawToken,
        verificationCode,
        expiresAt
      });
      const baseOrigin = (originUrl || "").replace(/\/+$/, "");
      const inviteUrl = `${baseOrigin}/?inviteToken=${encodeURIComponent(rawToken)}&workspace=${encodeURIComponent(this.workspaceId)}`;
      const channel = input.channel || "copy_link";
      const delivery = this.buildInviteDeliveryNotice(
        channel,
        newUser.phone,
        newUser.email,
        inviteUrl,
        verificationCode,
        company.nameAr
      );
      const invitation = {
        id: invId,
        userId: newUser.id,
        companyId,
        companyNameAr: company.nameAr,
        fullName: newUser.nameAr,
        jobTitle: newUser.jobTitle,
        department: newUser.department,
        email: newUser.email,
        phone: newUser.phone,
        secondaryPhone: newUser.secondaryPhone,
        username: newUser.username,
        role: newUser.role,
        roleLabelAr: newUser.roleLabelAr,
        customRoleId: newUser.customRoleId,
        channel,
        deliveryMode: delivery.externalGatewayConfigured ? "gateway" : "handoff",
        deliveryNote: delivery.deliveryNotice,
        status: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0641\u0639\u064A\u0644",
        tokenPreview: sha256Hex(rawToken).slice(0, 12),
        invitedByUserId: actor.id,
        invitedByName: actor.nameAr,
        sentAt: now,
        expiresAt,
        resendCount: 0
      };
      if (!Array.isArray(this.state.employeeInvitations)) {
        this.state.employeeInvitations = [];
      }
      this.state.users.push(newUser);
      this.state.employeeInvitations.unshift(invitation);
      this.addAudit(
        actor,
        "\u0625\u0636\u0627\u0641\u0629 \u0645\u0648\u0638\u0641 \u0648\u0625\u0631\u0633\u0627\u0644 \u062F\u0639\u0648\u0629 \u0627\u0646\u0636\u0645\u0627\u0645",
        "EmployeeInvitation",
        invId,
        `\u0625\u0636\u0627\u0641\u0629 ${newUser.nameAr} (${newUser.roleLabelAr}) \u0628\u062D\u0627\u0644\u0629 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0641\u0639\u064A\u0644 \u0648\u0625\u0635\u062F\u0627\u0631 \u062F\u0639\u0648\u0629 \u0639\u0628\u0631 ${channel}`,
        { newValue: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0641\u0639\u064A\u0644", deviceName }
      );
      this.addNotification(
        `\u062F\u0639\u0648\u0629 \u0645\u0648\u0638\u0641 \u062C\u062F\u064A\u062F: ${newUser.nameAr}`,
        `New Employee Invite: ${newUser.nameEn}`,
        `\u0623\u0635\u062F\u0631 ${actor.nameAr} \u062F\u0639\u0648\u0629 \u0627\u0646\u0636\u0645\u0627\u0645 \u0625\u0644\u0649 ${newUser.nameAr} (${newUser.roleLabelAr}).`,
        `${actor.nameEn} invited ${newUser.nameEn}.`,
        "\u0625\u062F\u0627\u0631\u064A\u0629",
        ["sys_owner", "gm"],
        "team"
      );
      this.persist();
      return {
        user: newUser,
        invitation,
        inviteUrl,
        verificationCode,
        handoffUrl: delivery.handoffUrl,
        externalGatewayConfigured: delivery.externalGatewayConfigured,
        deliveryNotice: delivery.deliveryNotice
      };
    });
  }
  resendEmployeeInvitation(actorUserId, invitationId, channel, originUrl, deviceName) {
    return this.runTransaction(() => {
      const actor = this.assertTeamManager(actorUserId);
      const list = this.state.employeeInvitations || [];
      const inv = list.find((item) => item.id === invitationId);
      if (!inv) throw new Error("\u0627\u0644\u062F\u0639\u0648\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
      if (inv.status === "\u0645\u0642\u0628\u0648\u0644\u0629") {
        throw new Error("\u062A\u0645 \u0642\u0628\u0648\u0644 \u0647\u0630\u0647 \u0627\u0644\u062F\u0639\u0648\u0629 \u0648\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0633\u0628\u0642\u0627\u064B");
      }
      const targetUser = this.state.users.find((u) => u.id === inv.userId);
      if (!targetUser) throw new Error("\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0648\u0638\u0641 \u0627\u0644\u0645\u0631\u062A\u0628\u0637 \u0628\u0627\u0644\u062F\u0639\u0648\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      if (targetUser.accountStatus === "\u0645\u0631\u0641\u0648\u0636" || targetUser.accountStatus === "\u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0648\u0635\u0648\u0644") {
        throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0639\u0627\u062F\u0629 \u0625\u0631\u0633\u0627\u0644 \u062F\u0639\u0648\u0629 \u0644\u062D\u0633\u0627\u0628 \u0645\u0631\u0641\u0648\u0636 \u0623\u0648 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0648\u0635\u0648\u0644");
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1e3).toISOString();
      const rawToken = crypto3.randomBytes(24).toString("hex");
      const verificationCode = String(crypto3.randomInt(1e5, 1e6));
      const nextChannel = channel || inv.channel || "copy_link";
      const company = this.getCompanySummary();
      this.sqlite.cancelInviteSecret(inv.id);
      this.sqlite.createInviteSecret({
        invitationId: inv.id,
        userId: targetUser.id,
        companyId: inv.companyId || this.getWorkspaceCompanyId(),
        rawToken,
        verificationCode,
        expiresAt
      });
      const baseOrigin = (originUrl || "").replace(/\/+$/, "");
      const inviteUrl = `${baseOrigin}/?inviteToken=${encodeURIComponent(rawToken)}&workspace=${encodeURIComponent(this.workspaceId)}`;
      const delivery = this.buildInviteDeliveryNotice(
        nextChannel,
        targetUser.phone,
        targetUser.email,
        inviteUrl,
        verificationCode,
        company.nameAr
      );
      inv.channel = nextChannel;
      inv.status = "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0641\u0639\u064A\u0644";
      inv.deliveryMode = delivery.externalGatewayConfigured ? "gateway" : "handoff";
      inv.deliveryNote = delivery.deliveryNotice;
      inv.tokenPreview = sha256Hex(rawToken).slice(0, 12);
      inv.sentAt = now;
      inv.expiresAt = expiresAt;
      inv.canceledAt = void 0;
      inv.resendCount = (inv.resendCount || 0) + 1;
      this.addAudit(
        actor,
        "\u0625\u0639\u0627\u062F\u0629 \u0625\u0631\u0633\u0627\u0644 \u062F\u0639\u0648\u0629 \u0645\u0648\u0638\u0641",
        "EmployeeInvitation",
        inv.id,
        `\u0625\u0639\u0627\u062F\u0629 \u0625\u0631\u0633\u0627\u0644 \u062F\u0639\u0648\u0629 \u0627\u0644\u0645\u0648\u0638\u0641 ${targetUser.nameAr} \u0639\u0628\u0631 ${nextChannel} (\u0627\u0644\u0645\u0631\u0629 #${inv.resendCount})`,
        { deviceName }
      );
      this.persist();
      return {
        invitation: inv,
        inviteUrl,
        verificationCode,
        handoffUrl: delivery.handoffUrl,
        externalGatewayConfigured: delivery.externalGatewayConfigured,
        deliveryNotice: delivery.deliveryNotice
      };
    });
  }
  cancelEmployeeInvitation(actorUserId, invitationId, deviceName) {
    return this.runTransaction(() => {
      const actor = this.assertTeamManager(actorUserId);
      const list = this.state.employeeInvitations || [];
      const inv = list.find((item) => item.id === invitationId);
      if (!inv) throw new Error("\u0627\u0644\u062F\u0639\u0648\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
      if (inv.status === "\u0645\u0642\u0628\u0648\u0644\u0629") {
        throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0644\u063A\u0627\u0621 \u062F\u0639\u0648\u0629 \u062A\u0645 \u0642\u0628\u0648\u0644\u0647\u0627 \u0648\u062A\u0641\u0639\u064A\u0644\u0647\u0627 \u0628\u0627\u0644\u0641\u0639\u0644");
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      this.sqlite.cancelInviteSecret(inv.id);
      inv.status = "\u0645\u0644\u063A\u0627\u0629";
      inv.canceledAt = now;
      this.addAudit(
        actor,
        "\u0625\u0644\u063A\u0627\u0621 \u062F\u0639\u0648\u0629 \u0645\u0648\u0638\u0641",
        "EmployeeInvitation",
        inv.id,
        `\u0625\u0644\u063A\u0627\u0621 \u062F\u0639\u0648\u0629 \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u0627\u0644\u0645\u0648\u062C\u0647\u0629 \u0625\u0644\u0649 ${inv.fullName}`,
        { oldValue: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0641\u0639\u064A\u0644", newValue: "\u0645\u0644\u063A\u0627\u0629", deviceName }
      );
      this.persist();
      return inv;
    });
  }
  getPublicInvitationByToken(rawToken) {
    const company = this.getCompanySummary();
    const secret = this.sqlite.findInviteSecretByToken(rawToken);
    if (!secret) {
      return { valid: false, reason: "\u0631\u0627\u0628\u0637 \u0627\u0644\u062F\u0639\u0648\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u0645\u0646\u062A\u0647\u064A", company };
    }
    const workspaceCompanyId = this.getWorkspaceCompanyId();
    if (secret.companyId !== workspaceCompanyId) {
      return { valid: false, reason: "\u0647\u0630\u0647 \u0627\u0644\u062F\u0639\u0648\u0629 \u062A\u062E\u0635 \u0634\u0631\u0643\u0629 \u0623\u062E\u0631\u0649 \u0648\u0644\u0627 \u062A\u0646\u062A\u0645\u064A \u0644\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u062D\u0627\u0644\u064A\u0629", company };
    }
    const inv = (this.state.employeeInvitations || []).find((i) => i.id === secret.invitationId);
    const user = this.state.users.find((u) => u.id === secret.userId);
    if (!inv || !user) {
      return { valid: false, reason: "\u0645\u0644\u0641 \u0627\u0644\u062F\u0639\u0648\u0629 \u0623\u0648 \u0627\u0644\u0645\u0648\u0638\u0641 \u0644\u0645 \u064A\u0639\u062F \u0645\u0648\u062C\u0648\u062F\u0627\u064B", company };
    }
    if (secret.canceledAt || inv.status === "\u0645\u0644\u063A\u0627\u0629") {
      return { valid: false, reason: "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0647\u0630\u0647 \u0627\u0644\u062F\u0639\u0648\u0629 \u0645\u0646 \u0642\u0650\u0628\u0644 \u0645\u062F\u064A\u0631 \u0627\u0644\u0634\u0631\u0643\u0629", invitation: inv, company };
    }
    if (secret.usedAt || inv.status === "\u0645\u0642\u0628\u0648\u0644\u0629") {
      return { valid: false, reason: "\u062A\u0645 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0647\u0630\u0647 \u0627\u0644\u062F\u0639\u0648\u0629 \u0648\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0633\u0628\u0642\u0627\u064B", invitation: inv, company };
    }
    if (Date.now() > new Date(secret.expiresAt).getTime()) {
      inv.status = "\u0645\u0646\u062A\u0647\u064A\u0629";
      this.persist();
      return {
        valid: false,
        expired: true,
        reason: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0631\u0627\u0628\u0637 \u0627\u0644\u062F\u0639\u0648\u0629 \u2014 \u0627\u0637\u0644\u0628 \u0645\u0646 \u0645\u0627\u0644\u0643 \u0627\u0644\u0634\u0631\u0643\u0629 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644",
        invitation: inv,
        company
      };
    }
    if (user.accountStatus === "\u0645\u0631\u0641\u0648\u0636" || user.accountStatus === "\u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0648\u0635\u0648\u0644") {
      return { valid: false, reason: "\u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0631\u0641\u0648\u0636 \u0623\u0648 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0648\u0635\u0648\u0644", invitation: inv, company };
    }
    return {
      valid: true,
      invitation: inv,
      company,
      invitee: {
        nameAr: user.nameAr,
        nameEn: user.nameEn,
        email: user.email,
        phone: user.phone,
        username: user.username,
        jobTitle: user.jobTitle,
        department: user.department,
        roleLabelAr: user.roleLabelAr,
        roleLabelEn: user.roleLabelEn
      }
    };
  }
  acceptEmployeeInvitation(rawToken, input) {
    return this.runTransaction(() => {
      if (!input.acceptedTerms) {
        throw new Error("\u064A\u062C\u0628 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0634\u0631\u0648\u0637 \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0648\u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0644\u0625\u062A\u0645\u0627\u0645 \u0627\u0644\u062A\u0641\u0639\u064A\u0644");
      }
      if (!input.verificationCode?.trim()) {
        throw new Error("\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0645\u0643\u0648\u0646 \u0645\u0646 6 \u0623\u0631\u0642\u0627\u0645");
      }
      if (!input.password || input.password.length < 8) {
        throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0646 \u0644\u0627 \u062A\u0642\u0644 \u0639\u0646 8 \u0623\u062D\u0631\u0641");
      }
      if (input.password !== input.confirmPassword) {
        throw new Error("\u0643\u0644\u0645\u062A\u0627 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u062A\u064A\u0646");
      }
      if (input.pin && !/^\d{4,6}$/.test(input.pin)) {
        throw new Error("\u0631\u0645\u0632 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0633\u0631\u064A\u0639 (PIN) \u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0643\u0648\u0646 \u0645\u0646 4 \u0625\u0644\u0649 6 \u0623\u0631\u0642\u0627\u0645");
      }
      const secretCheck = this.sqlite.findInviteSecretByToken(rawToken);
      if (!secretCheck) {
        throw new Error("\u0631\u0627\u0628\u0637 \u0627\u0644\u062F\u0639\u0648\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D");
      }
      if (secretCheck.companyId !== this.getWorkspaceCompanyId()) {
        throw new PermissionDeniedError("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0642\u0628\u0648\u0644 \u062F\u0639\u0648\u0629 \u062A\u062E\u0635 \u0634\u0631\u0643\u0629 \u0623\u062E\u0631\u0649");
      }
      const consumed = this.sqlite.verifyAndConsumeInviteSecret(rawToken, input.verificationCode);
      if (!consumed.ok) {
        if (consumed.expired) {
          const expInv = (this.state.employeeInvitations || []).find((i) => i.id === secretCheck.invitationId);
          if (expInv && expInv.status === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0641\u0639\u064A\u0644") {
            expInv.status = "\u0645\u0646\u062A\u0647\u064A\u0629";
            this.persist();
          }
        }
        throw new Error(consumed.reason);
      }
      const user = this.state.users.find((u) => u.id === consumed.record.userId);
      const inv = (this.state.employeeInvitations || []).find((i) => i.id === consumed.record.invitationId);
      if (!user || !inv) {
        throw new Error("\u0645\u0644\u0641 \u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      }
      this.sqlite.updateUserCredentials(user.id, {
        password: input.password,
        pin: input.pin || void 0
      });
      const now = (/* @__PURE__ */ new Date()).toISOString();
      user.active = true;
      user.accountStatus = "\u0646\u0634\u0637";
      user.joinedAt = now;
      user.lastActiveAt = now;
      user.deviceName = input.deviceName || "\u0645\u062A\u0635\u0641\u062D \u0627\u0644\u0648\u064A\u0628 \xB7 \u0645\u0641\u0639\u0651\u0644 \u0639\u0628\u0631 \u0627\u0644\u062F\u0639\u0648\u0629";
      user.statusState = "\u0645\u062A\u0635\u0644";
      user.lastActivitySummary = "\u062A\u0645 \u0642\u0628\u0648\u0644 \u0627\u0644\u062F\u0639\u0648\u0629 \u0648\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0634\u062E\u0635\u064A";
      user.security = {
        ...user.security || {},
        hasPin: Boolean(input.pin),
        failedAttempts: 0,
        lockedUntil: void 0,
        lastPasswordChangedAt: now,
        tempPasswordSet: false
      };
      inv.status = "\u0645\u0642\u0628\u0648\u0644\u0629";
      inv.acceptedAt = now;
      this.addAudit(
        user,
        "\u062A\u0641\u0639\u064A\u0644 \u062D\u0633\u0627\u0628 \u0645\u0648\u0638\u0641 \u0639\u0628\u0631 \u0627\u0644\u062F\u0639\u0648\u0629",
        "EmployeeInvitation",
        inv.id,
        `\u0642\u0627\u0645 \u0627\u0644\u0645\u0648\u0638\u0641 ${user.nameAr} \u0628\u062A\u0641\u0639\u064A\u0644 \u062D\u0633\u0627\u0628\u0647 \u0648\u0642\u0628\u0648\u0644 \u0634\u0631\u0648\u0637 \u0627\u0644\u0634\u0631\u0643\u0629 (${inv.roleLabelAr})`,
        { oldValue: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0641\u0639\u064A\u0644", newValue: "\u0646\u0634\u0637", deviceName: input.deviceName }
      );
      this.addNotification(
        `\u0627\u0646\u0636\u0645\u0627\u0645 \u0645\u0648\u0638\u0641 \u0645\u0641\u0639\u0651\u0644: ${user.nameAr}`,
        `Employee Activated: ${user.nameEn}`,
        `\u0623\u062A\u0645 ${user.nameAr} (${user.roleLabelAr}) \u062A\u0641\u0639\u064A\u0644 \u062D\u0633\u0627\u0628\u0647 \u0639\u0628\u0631 \u0631\u0627\u0628\u0637 \u0627\u0644\u062F\u0639\u0648\u0629 \u0648\u0623\u0635\u0628\u062D \u0646\u0634\u0637\u0627\u064B \u0627\u0644\u0622\u0646.`,
        `${user.nameEn} activated their account.`,
        "\u0625\u062F\u0627\u0631\u064A\u0629",
        ["sys_owner", "gm"],
        "team"
      );
      this.persist();
      return { user, company: this.getCompanySummary() };
    });
  }
  updateEmployeeAdmin(actorUserId, targetUserId, patch, deviceName) {
    return this.runTransaction(() => {
      const actor = this.assertTeamManager(actorUserId);
      const target = this.state.users.find((u) => u.id === targetUserId);
      if (!target) throw new Error("\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
      const touchesGovernance = patch.role !== void 0 || patch.customRoleId !== void 0 || patch.customModulePermissions !== void 0 || patch.allowedPropertyIds !== void 0 || patch.approvalLimitSar !== void 0 || patch.accountStatus !== void 0;
      if (actor.id === targetUserId && touchesGovernance) {
        throw new PermissionDeniedError("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0644\u0623\u064A \u0645\u0633\u062A\u062E\u062F\u0645 \u062A\u0639\u062F\u064A\u0644 \u062F\u0648\u0631\u0647 \u0623\u0648 \u0635\u0644\u0627\u062D\u064A\u0627\u062A\u0647 \u0623\u0648 \u062D\u0627\u0644\u0629 \u062D\u0633\u0627\u0628\u0647 \u0628\u0646\u0641\u0633\u0647");
      }
      if (actor.role === "gm" && (target.role === "sys_owner" || target.role === "gm")) {
        throw new PermissionDeniedError("\u0644\u0627 \u064A\u0645\u0644\u0643 \u0645\u062F\u064A\u0631 \u0627\u0644\u0634\u0631\u0643\u0629 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0639\u062F\u064A\u0644 \u062D\u0633\u0627\u0628 \u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645 \u0623\u0648 \u0645\u062F\u064A\u0631 \u0634\u0631\u0643\u0629 \u0622\u062E\u0631");
      }
      if (actor.role === "gm" && (patch.role === "sys_owner" || patch.role === "gm")) {
        throw new PermissionDeniedError("\u062A\u0631\u0642\u064A\u0629 \u0645\u0648\u0638\u0641 \u0625\u0644\u0649 \u0645\u0627\u0644\u0643 \u0646\u0638\u0627\u0645 \u0623\u0648 \u0645\u062F\u064A\u0631 \u0639\u0627\u0645 \u0645\u062D\u0635\u0648\u0631\u0629 \u0628\u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645 \u0641\u0642\u0637");
      }
      if (patch.email !== void 0) {
        const normEmail = patch.email.trim().toLowerCase();
        if (!normEmail) throw new Error("\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D");
        if (this.state.users.some((u) => u.id !== targetUserId && u.email.toLowerCase() === normEmail)) {
          throw new Error("\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u062D\u0633\u0627\u0628 \u0622\u062E\u0631");
        }
        target.email = normEmail;
      }
      if (patch.phone !== void 0) {
        const normPhone = patch.phone.trim();
        if (!normPhone) throw new Error("\u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644 \u0627\u0644\u0623\u0633\u0627\u0633\u064A \u0645\u0637\u0644\u0648\u0628");
        if (this.state.users.some((u) => u.id !== targetUserId && u.phone === normPhone)) {
          throw new Error("\u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644 \u0645\u0633\u062C\u0644 \u0644\u0645\u0648\u0638\u0641 \u0622\u062E\u0631");
        }
        target.phone = normPhone;
      }
      if (patch.username !== void 0) {
        const normUser = patch.username.trim().toLowerCase();
        if (normUser && this.state.users.some((u) => u.id !== targetUserId && u.username?.toLowerCase() === normUser)) {
          throw new Error("\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644");
        }
        target.username = normUser || void 0;
      }
      if (patch.nameAr !== void 0 && patch.nameAr.trim()) target.nameAr = patch.nameAr.trim();
      if (patch.nameEn !== void 0) target.nameEn = patch.nameEn.trim() || target.nameAr;
      if (patch.jobTitle !== void 0) target.jobTitle = patch.jobTitle.trim();
      if (patch.department !== void 0) target.department = patch.department.trim();
      if (patch.secondaryPhone !== void 0) target.secondaryPhone = patch.secondaryPhone.trim() || void 0;
      if (patch.avatarDataUrl !== void 0) target.avatarDataUrl = patch.avatarDataUrl || void 0;
      if (patch.approvalLimitSar !== void 0) target.approvalLimitSar = Number(patch.approvalLimitSar || 0);
      if (patch.allowedPropertyIds !== void 0) {
        target.allowedPropertyIds = patch.allowedPropertyIds && patch.allowedPropertyIds.length > 0 ? patch.allowedPropertyIds : void 0;
      }
      if (patch.customModulePermissions !== void 0) {
        target.customModulePermissions = patch.customModulePermissions || void 0;
      }
      if (patch.customRoleId !== void 0) {
        if (patch.customRoleId === null || patch.customRoleId === "") {
          target.customRoleId = void 0;
        } else {
          const custom = (this.state.customRoles || []).find((r) => r.id === patch.customRoleId);
          if (!custom) throw new Error("\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0645\u062E\u0635\u0635 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
          target.customRoleId = custom.id;
          target.role = custom.baseRoleKey;
          target.roleLabelAr = custom.nameAr;
          target.roleLabelEn = custom.nameEn;
        }
      }
      if (patch.role !== void 0 && patch.role !== target.role) {
        target.role = patch.role;
        const meta = this.resolveRoleMeta(patch.role, target.customRoleId);
        target.roleLabelAr = meta.roleLabelAr;
        target.roleLabelEn = meta.roleLabelEn;
      } else if (patch.role !== void 0 && !patch.customRoleId && target.customRoleId === void 0) {
        const meta = this.resolveRoleMeta(target.role, void 0);
        target.roleLabelAr = meta.roleLabelAr;
        target.roleLabelEn = meta.roleLabelEn;
      }
      let terminateSessions = false;
      const prevStatus = target.accountStatus || (target.active ? "\u0646\u0634\u0637" : "\u0645\u0648\u0642\u0648\u0641");
      if (patch.accountStatus !== void 0) {
        if (target.role === "sys_owner" && patch.accountStatus !== "\u0646\u0634\u0637") {
          const activeOwners = this.state.users.filter(
            (u) => u.id !== target.id && u.role === "sys_owner" && u.active && (!u.accountStatus || u.accountStatus === "\u0646\u0634\u0637")
          );
          if (activeOwners.length === 0) {
            throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u064A\u0642\u0627\u0641 \u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0648\u062D\u064A\u062F \u0627\u0644\u0646\u0634\u0637 \u0641\u064A \u0627\u0644\u0634\u0631\u0643\u0629");
          }
        }
        target.accountStatus = patch.accountStatus;
        if (patch.accountStatus === "\u0646\u0634\u0637") {
          target.active = true;
          target.terminatedAt = void 0;
          target.terminationReason = void 0;
          if (!target.joinedAt) target.joinedAt = (/* @__PURE__ */ new Date()).toISOString();
        } else {
          target.active = false;
          target.statusState = "\u063A\u064A\u0631 \u0645\u062A\u0635\u0644";
          if (patch.accountStatus === "\u0645\u0648\u0642\u0648\u0641" || patch.accountStatus === "\u0645\u0631\u0641\u0648\u0636" || patch.accountStatus === "\u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0648\u0635\u0648\u0644") {
            target.terminatedAt = (/* @__PURE__ */ new Date()).toISOString();
            target.terminationReason = patch.terminationReason?.trim() || void 0;
            this.sqlite.revokeOtherSessionsForUser(target.id);
            terminateSessions = true;
            if (patch.accountStatus === "\u0645\u0631\u0641\u0648\u0636" || patch.accountStatus === "\u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0648\u0635\u0648\u0644") {
              for (const inv of this.state.employeeInvitations || []) {
                if (inv.userId === target.id && inv.status === "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0641\u0639\u064A\u0644") {
                  this.sqlite.cancelInviteSecret(inv.id);
                  inv.status = "\u0645\u0644\u063A\u0627\u0629";
                  inv.canceledAt = (/* @__PURE__ */ new Date()).toISOString();
                }
              }
            }
          }
        }
      }
      this.addAudit(
        actor,
        "\u062A\u062D\u062F\u064A\u062B \u0645\u0644\u0641 \u0648\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0645\u0648\u0638\u0641",
        "StaffUser",
        target.id,
        `\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641 ${target.nameAr} (${target.roleLabelAr})${patch.accountStatus && patch.accountStatus !== prevStatus ? ` \xB7 \u0627\u0644\u062D\u0627\u0644\u0629: ${prevStatus} \u2190 ${patch.accountStatus}` : ""}`,
        { oldValue: prevStatus, newValue: target.accountStatus, reason: patch.terminationReason, deviceName }
      );
      this.persist();
      return { user: target, terminateSessions };
    });
  }
  createCustomRole(actorUserId, input, deviceName) {
    const actor = this.assertTeamManager(actorUserId);
    if (!input.nameAr?.trim()) throw new Error("\u0627\u0633\u0645 \u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0648\u0638\u064A\u0641\u064A \u0627\u0644\u0645\u062E\u0635\u0635 \u0645\u0637\u0644\u0648\u0628");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const baseRoleKey = input.baseRole && input.baseRole !== "sys_owner" ? input.baseRole : "leasing";
    const modulePermissions = input.modulePermissions || getDefaultModulePermissionsForRole(baseRoleKey);
    const roleDef = {
      id: uid("crole"),
      companyId: this.getWorkspaceCompanyId(),
      nameAr: input.nameAr.trim(),
      nameEn: (input.nameEn || input.nameAr).trim(),
      descriptionAr: input.descriptionAr?.trim() || "",
      baseRoleKey,
      legacyPermissions: deriveLegacyPermissionsFromModules(modulePermissions),
      modulePermissions,
      createdBy: actor.nameAr,
      createdAt: now,
      updatedAt: now
    };
    if (!Array.isArray(this.state.customRoles)) this.state.customRoles = [];
    this.state.customRoles.push(roleDef);
    this.addAudit(
      actor,
      "\u0625\u0646\u0634\u0627\u0621 \u062F\u0648\u0631 \u0648\u0638\u064A\u0641\u064A \u0645\u062E\u0635\u0635",
      "CustomRole",
      roleDef.id,
      `\u0625\u0646\u0634\u0627\u0621 \u062F\u0648\u0631 \u0645\u062E\u0635\u0635 (${roleDef.nameAr}) \u0628\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u062A\u0641\u0635\u064A\u0644\u064A\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0633\u0627\u0645`,
      { deviceName }
    );
    this.persist();
    return roleDef;
  }
  updateCustomRole(actorUserId, roleId, patch, deviceName) {
    const actor = this.assertTeamManager(actorUserId);
    const list = this.state.customRoles || [];
    const roleDef = list.find((r) => r.id === roleId);
    if (!roleDef) throw new Error("\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0645\u062E\u0635\u0635 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    if (patch.nameAr?.trim()) roleDef.nameAr = patch.nameAr.trim();
    if (patch.nameEn?.trim()) roleDef.nameEn = patch.nameEn.trim();
    if (patch.descriptionAr !== void 0) roleDef.descriptionAr = patch.descriptionAr.trim();
    if (patch.modulePermissions !== void 0) {
      roleDef.modulePermissions = patch.modulePermissions;
      roleDef.legacyPermissions = deriveLegacyPermissionsFromModules(patch.modulePermissions);
    }
    roleDef.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    for (const u of this.state.users) {
      if (u.customRoleId === roleId) {
        u.roleLabelAr = roleDef.nameAr;
        u.roleLabelEn = roleDef.nameEn;
      }
    }
    this.addAudit(
      actor,
      "\u062A\u0639\u062F\u064A\u0644 \u062F\u0648\u0631 \u0648\u0638\u064A\u0641\u064A \u0645\u062E\u0635\u0635",
      "CustomRole",
      roleId,
      `\u062A\u062D\u062F\u064A\u062B \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0623\u0648 \u0645\u0633\u0645\u0649 \u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0645\u062E\u0635\u0635 (${roleDef.nameAr})`,
      { deviceName }
    );
    this.persist();
    return roleDef;
  }
  deleteCustomRole(actorUserId, roleId, deviceName) {
    const actor = this.assertTeamManager(actorUserId);
    const list = this.state.customRoles || [];
    const roleDef = list.find((r) => r.id === roleId);
    if (!roleDef) throw new Error("\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0645\u062E\u0635\u0635 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    const assigned = this.state.users.filter((u) => u.customRoleId === roleId);
    if (assigned.length > 0) {
      throw new Error(`\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0627\u0644\u062F\u0648\u0631 \u0644\u0623\u0646\u0647 \u0645\u0633\u0646\u062F \u062D\u0627\u0644\u064A\u0627\u064B \u0625\u0644\u0649 ${assigned.length} \u0645\u0648\u0638\u0641\u064A\u0646 \u2014 \u063A\u064A\u0651\u0631 \u0623\u062F\u0648\u0627\u0631\u0647\u0645 \u0623\u0648\u0644\u0627\u064B`);
    }
    this.state.customRoles = list.filter((r) => r.id !== roleId);
    this.addAudit(
      actor,
      "\u062D\u0630\u0641 \u062F\u0648\u0631 \u0648\u0638\u064A\u0641\u064A \u0645\u062E\u0635\u0635",
      "CustomRole",
      roleId,
      `\u062D\u0630\u0641 \u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0645\u062E\u0635\u0635 (${roleDef.nameAr})`,
      { deviceName }
    );
    this.persist();
    return { deletedId: roleId };
  }
  updateRoleModuleMatrix(actorUserId, role, modulePermissions, deviceName) {
    const actor = this.assertTeamManager(actorUserId);
    if (actor.role === role) {
      throw new PermissionDeniedError("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0644\u0623\u064A \u0645\u0633\u062A\u062E\u062F\u0645 \u062A\u0639\u062F\u064A\u0644 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u062F\u0648\u0631\u0647 \u0627\u0644\u062D\u0627\u0644\u064A");
    }
    if (actor.role === "gm" && (role === "sys_owner" || role === "gm")) {
      throw new PermissionDeniedError("\u062A\u0639\u062F\u064A\u0644 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645 \u0623\u0648 \u0645\u062F\u064A\u0631 \u0627\u0644\u0634\u0631\u0643\u0629 \u062D\u0635\u0631\u064A \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645");
    }
    if (role === "sys_owner") {
      const teamPerms = modulePermissions.team || [];
      if (!teamPerms.includes("manage") || !teamPerms.includes("view")) {
        throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0633\u062D\u0628 \u0635\u0644\u0627\u062D\u064A\u0629 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0641\u0631\u064A\u0642 \u0645\u0646 \u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645");
      }
    }
    if (!this.state.roleModulePermissions) {
      this.state.roleModulePermissions = buildAllDefaultRoleModulePermissions();
    }
    this.state.roleModulePermissions[role] = modulePermissions;
    this.state.rolePermissions[role] = deriveLegacyPermissionsFromModules(modulePermissions);
    this.addAudit(
      actor,
      "\u062A\u062D\u062F\u064A\u062B \u0645\u0635\u0641\u0648\u0641\u0629 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u0623\u0642\u0633\u0627\u0645",
      "RoleModuleMatrix",
      role,
      `\u062A\u062D\u062F\u064A\u062B \u0645\u0635\u0641\u0648\u0641\u0629 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u062A\u0641\u0635\u064A\u0644\u064A\u0629 \u0644\u0644\u062F\u0648\u0631 (${role})`,
      { deviceName }
    );
    this.persist();
    return {
      roleModulePermissions: this.state.roleModulePermissions,
      rolePermissions: this.state.rolePermissions
    };
  }
  updateOwnProfile(userId, patch, deviceName) {
    const user = this.getActingUser(userId);
    const forbiddenFields = [
      "role",
      "roleLabelAr",
      "roleLabelEn",
      "customRoleId",
      "customModulePermissions",
      "allowedPropertyIds",
      "accountStatus",
      "active",
      "approvalLimitSar",
      "companyId",
      "permissions"
    ];
    for (const key of forbiddenFields) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        throw new PermissionDeniedError("\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0648\u0638\u064A\u0641\u064A \u0623\u0648 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0645\u0646 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062E\u0635\u064A");
      }
    }
    if (typeof patch.nameAr === "string" && patch.nameAr.trim()) {
      user.nameAr = patch.nameAr.trim();
    }
    if (typeof patch.nameEn === "string") {
      user.nameEn = patch.nameEn.trim() || user.nameAr;
    }
    if (typeof patch.secondaryPhone === "string") {
      user.secondaryPhone = patch.secondaryPhone.trim() || void 0;
    }
    if (typeof patch.username === "string") {
      const normUsername = patch.username.trim().toLowerCase();
      if (normUsername && this.state.users.some((u) => u.id !== user.id && u.username?.toLowerCase() === normUsername)) {
        throw new Error("\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644 \u0645\u0646 \u0642\u0650\u0628\u0644 \u0645\u0648\u0638\u0641 \u0622\u062E\u0631");
      }
      user.username = normUsername || void 0;
    }
    if (typeof patch.avatarDataUrl === "string" || patch.avatarDataUrl === null) {
      user.avatarDataUrl = typeof patch.avatarDataUrl === "string" && patch.avatarDataUrl ? patch.avatarDataUrl : void 0;
    }
    if (patch.notificationPrefs && typeof patch.notificationPrefs === "object") {
      user.notificationPrefs = {
        ...user.notificationPrefs || {
          dndEnabled: false,
          taskAssigned: true,
          taskReminder: true,
          taskApproved: true,
          taskComment: true,
          urgentTicket: true
        },
        ...patch.notificationPrefs
      };
    }
    this.addAudit(
      user,
      "\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062E\u0635\u064A",
      "StaffUserProfile",
      user.id,
      `\u062D\u062F\u0651\u062B ${user.nameAr} \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0644\u0641\u0647 \u0627\u0644\u0634\u062E\u0635\u064A`,
      { deviceName }
    );
    this.persist();
    return user;
  }
  requestContactVerification(userId, type, newValue, deviceName) {
    const user = this.getActingUser(userId);
    const trimmed = (newValue || "").trim();
    if (!trimmed) {
      throw new Error(type === "email" ? "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0627\u0644\u062C\u062F\u064A\u062F" : "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644 \u0627\u0644\u062C\u062F\u064A\u062F");
    }
    const normalized = type === "email" ? trimmed.toLowerCase() : trimmed;
    if (type === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        throw new Error("\u0635\u064A\u063A\u0629 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
      }
      if (this.state.users.some((u) => u.id !== user.id && u.email.toLowerCase() === normalized)) {
        throw new Error("\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u062D\u0633\u0627\u0628 \u0622\u062E\u0631");
      }
    } else {
      if (this.state.users.some((u) => u.id !== user.id && u.phone === normalized)) {
        throw new Error("\u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644 \u0645\u0633\u062C\u0644 \u0644\u0645\u0648\u0638\u0641 \u0622\u062E\u0631");
      }
    }
    const code = String(crypto3.randomInt(1e5, 1e6));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
    const purpose = type === "email" ? "verify_email" : "verify_phone";
    this.sqlite.createRecoveryToken({
      id: uid("vrf"),
      userId: user.id,
      purpose,
      targetValue: normalized,
      code,
      expiresAt
    });
    if (type === "email") {
      user.pendingEmailVerification = { targetValue: normalized, requestedAt: (/* @__PURE__ */ new Date()).toISOString(), expiresAt };
    } else {
      user.pendingPhoneVerification = { targetValue: normalized, requestedAt: (/* @__PURE__ */ new Date()).toISOString(), expiresAt };
    }
    this.addAudit(
      user,
      type === "email" ? "\u0637\u0644\u0628 \u062A\u062D\u0642\u0642 \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A" : "\u0637\u0644\u0628 \u062A\u062D\u0642\u0642 \u062A\u063A\u064A\u064A\u0631 \u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644",
      "ContactVerification",
      user.id,
      `\u0637\u0644\u0628 \u0631\u0645\u0632 \u062A\u062D\u0642\u0642 \u0644\u062A\u062D\u062F\u064A\u062B ${type === "email" ? "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A" : "\u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644"}`,
      { deviceName }
    );
    this.persist();
    const integrations = this.state.settings?.integrationsConfig;
    const externalConfigured = type === "email" ? Boolean(integrations?.smtpEnabled) : Boolean(integrations?.smsGatewayEnabled);
    const showLocalPreview = !externalConfigured && this.isLocalSimulationAllowed();
    return {
      ok: true,
      pendingValue: normalized,
      expiresAt,
      externalGatewayConfigured: externalConfigured,
      deliveryNotice: externalConfigured ? "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0639\u0628\u0631 \u0627\u0644\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0631\u0628\u0648\u0637\u0629." : "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u062D\u0644\u064A\u0627\u064B \u0644\u0639\u062F\u0645 \u062A\u0641\u0639\u064A\u0644 \u0628\u0648\u0627\u0628\u0629 \u0628\u0631\u064A\u062F/SMS \u062E\u0627\u0631\u062C\u064A\u0629 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0628\u064A\u0626\u0629.",
      ...showLocalPreview ? { localSimulationCode: code } : {}
    };
  }
  confirmContactVerification(userId, type, code, deviceName) {
    return this.runTransaction(() => {
      const user = this.getActingUser(userId);
      const purpose = type === "email" ? "verify_email" : "verify_phone";
      const verified = this.sqlite.verifyAndConsumeRecoveryToken(user.id, purpose, code || "");
      if (!verified.ok) {
        throw new Error(verified.reason);
      }
      const nextVal = verified.record.targetValue;
      if (!nextVal) {
        throw new Error("\u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641\u0629 \u0644\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
      }
      const oldVal = type === "email" ? user.email : user.phone;
      if (type === "email") {
        user.email = nextVal;
        user.pendingEmailVerification = void 0;
      } else {
        user.phone = nextVal;
        user.pendingPhoneVerification = void 0;
      }
      this.addAudit(
        user,
        type === "email" ? "\u062A\u0623\u0643\u064A\u062F \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A" : "\u062A\u0623\u0643\u064A\u062F \u062A\u062D\u062F\u064A\u062B \u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644",
        "StaffUserProfile",
        user.id,
        `\u062A\u062D\u062F\u064A\u062B ${type === "email" ? "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A" : "\u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644"} \u0628\u0639\u062F \u0627\u0644\u062A\u062D\u0642\u0642 \u0628\u0627\u0644\u0631\u0645\u0632`,
        { oldValue: oldVal, newValue: nextVal, deviceName }
      );
      this.persist();
      return user;
    });
  }
  requestCredentialRecovery(emailOrIdentifier, purpose, deviceName) {
    const clean = (emailOrIdentifier || "").trim().toLowerCase();
    const integrations = this.state.settings?.integrationsConfig;
    const externalConfigured = Boolean(integrations?.smtpEnabled);
    const user = this.state.users.find(
      (u) => u.email.toLowerCase() === clean || u.username && u.username.toLowerCase() === clean || u.phone === (emailOrIdentifier || "").trim()
    );
    const uniformMessage = "\u0625\u0630\u0627 \u0643\u0627\u0646 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0633\u062C\u0644\u0627\u064B \u0648\u0646\u0634\u0637\u0627\u064B\u060C \u0641\u0633\u064A\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u062A\u062D\u0642\u0642 \u0644\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0635\u0627\u0644\u062D \u0644\u0645\u062F\u0629 15 \u062F\u0642\u064A\u0642\u0629.";
    if (!user || !user.active || user.accountStatus && user.accountStatus !== "\u0646\u0634\u0637") {
      return {
        ok: true,
        message: uniformMessage,
        externalGatewayConfigured: externalConfigured
      };
    }
    const code = String(crypto3.randomInt(1e5, 1e6));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
    this.sqlite.createRecoveryToken({
      id: uid("rec"),
      userId: user.id,
      purpose,
      targetValue: user.email,
      code,
      expiresAt
    });
    this.addAudit(
      user,
      purpose === "password_reset" ? "\u0637\u0644\u0628 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631" : "\u0637\u0644\u0628 \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0631\u0645\u0632 PIN",
      "CredentialRecovery",
      user.id,
      `\u0637\u0644\u0628 \u0631\u0645\u0632 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 (${purpose})`,
      { deviceName }
    );
    this.persist();
    const showLocalPreview = !externalConfigured && this.isLocalSimulationAllowed();
    return {
      ok: true,
      message: uniformMessage,
      externalGatewayConfigured: externalConfigured,
      ...showLocalPreview ? { localSimulationCode: code } : {}
    };
  }
  completeCredentialRecovery(input, deviceName) {
    return this.runTransaction(() => {
      const clean = (input.emailOrIdentifier || "").trim().toLowerCase();
      const user = this.state.users.find(
        (u) => u.email.toLowerCase() === clean || u.username && u.username.toLowerCase() === clean || u.phone === (input.emailOrIdentifier || "").trim()
      );
      if (!user || !user.active || user.accountStatus && user.accountStatus !== "\u0646\u0634\u0637") {
        throw new Error("\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0623\u0648 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629");
      }
      if (!input.newSecret || input.newSecret !== input.confirmSecret) {
        throw new Error("\u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0648\u062A\u0623\u0643\u064A\u062F\u0647\u0627 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u062A\u064A\u0646");
      }
      if (input.purpose === "password_reset" && input.newSecret.length < 8) {
        throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u064A\u062C\u0628 \u0623\u0646 \u0644\u0627 \u062A\u0642\u0644 \u0639\u0646 8 \u0623\u062D\u0631\u0641");
      }
      if (input.purpose === "pin_reset" && !/^\d{4,6}$/.test(input.newSecret)) {
        throw new Error("\u0631\u0645\u0632 PIN \u0627\u0644\u062C\u062F\u064A\u062F \u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0643\u0648\u0646 \u0645\u0646 4 \u0625\u0644\u0649 6 \u0623\u0631\u0642\u0627\u0645");
      }
      const verified = this.sqlite.verifyAndConsumeRecoveryToken(user.id, input.purpose, input.code || "");
      if (!verified.ok) {
        throw new Error(verified.reason);
      }
      if (input.purpose === "password_reset") {
        this.sqlite.updateUserCredentials(user.id, { password: input.newSecret });
      } else {
        this.sqlite.updateUserCredentials(user.id, { pin: input.newSecret });
      }
      if (!user.security) user.security = {};
      user.security.failedAttempts = 0;
      user.security.lockedUntil = void 0;
      user.security.lastPasswordChangedAt = (/* @__PURE__ */ new Date()).toISOString();
      if (input.purpose === "pin_reset") {
        user.security.hasPin = true;
      }
      let terminateSessions = false;
      if (input.purpose === "password_reset") {
        this.sqlite.revokeOtherSessionsForUser(user.id);
        terminateSessions = true;
      }
      this.addAudit(
        user,
        input.purpose === "password_reset" ? "\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0628\u0646\u062C\u0627\u062D" : "\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0631\u0645\u0632 PIN \u0628\u0646\u062C\u0627\u062D",
        "CredentialRecovery",
        user.id,
        `\u062A\u0645\u062A \u0627\u0633\u062A\u0639\u0627\u062F\u0629 ${input.purpose === "password_reset" ? "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0648\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062C\u0644\u0633\u0627\u062A \u0627\u0644\u0633\u0627\u0628\u0642\u0629" : "\u0631\u0645\u0632 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0633\u0631\u064A\u0639 PIN"}`,
        { deviceName }
      );
      if (input.purpose === "pin_reset") {
        user.security.pinEnabled = true;
        user.security.pinFailedAttempts = 0;
        user.security.pinLockedUntil = void 0;
        user.security.requirePasswordAfterPinLock = false;
      }
      this.persist();
      return { ok: true, userId: user.id, terminateSessions };
    });
  }
  togglePinEnabled(userId, enabled, currentPassword, newPin, deviceName) {
    return this.runTransaction(() => {
      const user = this.getActingUser(userId);
      if (!currentPassword || !this.sqlite.verifyUserPassword(user.id, currentPassword)) {
        throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0645\u0637\u0644\u0648\u0628\u0629 \u0648\u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629 \u0644\u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629 \u0631\u0645\u0632 PIN");
      }
      if (!user.security) user.security = {};
      if (!enabled) {
        this.sqlite.disableUserPin(user.id);
        user.security.pinEnabled = false;
        user.security.hasPin = false;
        user.security.pinFailedAttempts = 0;
        user.security.pinLockedUntil = void 0;
        user.security.requirePasswordAfterPinLock = false;
      } else {
        const cleanPin = (newPin || "").trim();
        if (cleanPin) {
          if (!/^\d{4,6}$/.test(cleanPin)) {
            throw new Error("\u0631\u0645\u0632 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0633\u0631\u064A\u0639 (PIN) \u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0643\u0648\u0646 \u0645\u0646 4 \u0625\u0644\u0649 6 \u0623\u0631\u0642\u0627\u0645");
          }
          this.sqlite.updateUserCredentials(user.id, { pin: cleanPin });
          user.security.hasPin = true;
        } else if (!this.sqlite.getCredentialStatus(user.id).hasPin) {
          throw new Error("\u0623\u062F\u062E\u0644 \u0631\u0645\u0632 PIN \u062C\u062F\u064A\u062F \u0645\u0646 4 \u0625\u0644\u0649 6 \u0623\u0631\u0642\u0627\u0645 \u0644\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0633\u0631\u064A\u0639");
        }
        user.security.pinEnabled = true;
        user.security.pinFailedAttempts = 0;
        user.security.pinLockedUntil = void 0;
        user.security.requirePasswordAfterPinLock = false;
      }
      this.addAudit(
        user,
        enabled ? "\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0631\u0645\u0632 PIN" : "\u062A\u0639\u0637\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0631\u0645\u0632 PIN",
        "StaffSecurity",
        user.id,
        enabled ? "\u062A\u0641\u0639\u064A\u0644 \u0631\u0645\u0632 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0633\u0631\u064A\u0639 PIN \u0628\u0639\u062F \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631" : "\u062A\u0639\u0637\u064A\u0644 \u0631\u0645\u0632 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0633\u0631\u064A\u0639 PIN \u0648\u062D\u0630\u0641\u0647 \u0628\u0623\u0645\u0627\u0646",
        { deviceName }
      );
      this.persist();
      return user;
    });
  }
  toggleTwoFactor(userId, enabled, currentPassword, deviceName) {
    return this.runTransaction(() => {
      const user = this.getActingUser(userId);
      if (!currentPassword || !this.sqlite.verifyUserPassword(user.id, currentPassword)) {
        throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
      }
      if (!user.security) user.security = {};
      user.security.twoFactorEnabled = Boolean(enabled);
      this.addAudit(
        user,
        enabled ? "\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0625\u0636\u0627\u0641\u064A \u0644\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u062C\u062F\u064A\u062F\u0629" : "\u062A\u0639\u0637\u064A\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0625\u0636\u0627\u0641\u064A \u0644\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u062C\u062F\u064A\u062F\u0629",
        "StaffSecurity",
        user.id,
        enabled ? "\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u062B\u0646\u0627\u0626\u064A \u0627\u0644\u062E\u0637\u0648\u0629 \u0639\u0628\u0631 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0645\u0648\u062B\u0642 \u0644\u0644\u0623\u062C\u0647\u0632\u0629 \u063A\u064A\u0631 \u0627\u0644\u0645\u0639\u0631\u0648\u0641\u0629" : "\u062A\u0639\u0637\u064A\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0625\u0636\u0627\u0641\u064A \u0639\u0646\u062F \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644",
        { deviceName }
      );
      this.persist();
      return user;
    });
  }
  evaluateMfaRequirement(user, deviceId, options) {
    const policyRequires = Boolean(this.state.securityPolicy?.requireMfaOnNewDevice);
    const userRequires = Boolean(user.security?.twoFactorEnabled);
    if (!policyRequires && !userRequires && !options?.suspiciousAttempt) {
      return null;
    }
    if (deviceId && this.sqlite.isTrustedDevice(user.id, deviceId) && !options?.suspiciousAttempt) {
      return null;
    }
    if (!deviceId && !userRequires && !policyRequires && !options?.suspiciousAttempt) {
      return null;
    }
    if (options?.suspiciousAttempt) return "unusual_activity";
    if ((policyRequires || userRequires) && deviceId && !this.sqlite.isTrustedDevice(user.id, deviceId)) {
      return "new_device";
    }
    if (userRequires && !deviceId) {
      return "new_device";
    }
    return null;
  }
  maskEmailAddress(email) {
    const parts = (email || "").split("@");
    if (parts.length !== 2) return "***";
    const [local, domain] = parts;
    const head = local.slice(0, Math.min(2, local.length));
    return `${head}***@${domain}`;
  }
  createMfaChallenge(user, reason, deviceName) {
    const code = String(crypto3.randomInt(1e5, 1e6));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1e3).toISOString();
    this.sqlite.createRecoveryToken({
      id: uid("mfa"),
      userId: user.id,
      purpose: "mfa_challenge",
      targetValue: user.email,
      code,
      expiresAt
    });
    const integrations = this.state.settings?.integrationsConfig;
    const externalConfigured = Boolean(integrations?.smtpEnabled);
    const showLocalPreview = !externalConfigured && this.isLocalSimulationAllowed();
    this.addAudit(
      user,
      "\u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u062A\u062D\u0642\u0642 \u0625\u0636\u0627\u0641\u064A \u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644",
      "MfaChallenge",
      user.id,
      `\u0637\u0644\u0628 \u062A\u062D\u0642\u0642 \u0625\u0636\u0627\u0641\u064A (${reason === "unusual_activity" ? "\u0646\u0634\u0627\u0637 \u063A\u064A\u0631 \u0645\u0639\u062A\u0627\u062F" : "\u062C\u0647\u0627\u0632 \u062C\u062F\u064A\u062F"})`,
      { deviceName }
    );
    this.persist();
    return {
      maskedEmail: this.maskEmailAddress(user.email),
      expiresAt,
      externalGatewayConfigured: externalConfigured,
      deliveryNotice: externalConfigured ? `\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0645\u0624\u0642\u062A \u0625\u0644\u0649 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0645\u0648\u062B\u0642 ${this.maskEmailAddress(user.email)}.` : `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0631\u0645\u0632 \u062A\u062D\u0642\u0642 \u0625\u0636\u0627\u0641\u064A \u0644\u0644\u0628\u0631\u064A\u062F ${this.maskEmailAddress(user.email)} (\u0628\u064A\u0626\u0629 \u0645\u062D\u0644\u064A\u0629 \u0628\u062F\u0648\u0646 SMTP).`,
      ...showLocalPreview ? { localSimulationCode: code } : {}
    };
  }
  verifyMfaChallenge(userId, code, opts) {
    return this.runTransaction(() => {
      const user = this.getActingUser(userId);
      this.assertAccountLoginAllowed(user);
      const verified = this.sqlite.verifyAndConsumeRecoveryToken(user.id, "mfa_challenge", code || "");
      if (!verified.ok) {
        this.recordLoginEvent({
          userId: user.id,
          deviceName: opts?.deviceName || user.deviceName,
          method: "\u0645\u0635\u0627\u062F\u0642\u0629 \u062B\u0646\u0627\u0626\u064A\u0629 (2FA)",
          success: false
        });
        this.persist();
        throw new Error(verified.reason);
      }
      if (opts?.trustDevice && opts?.deviceId) {
        this.sqlite.registerOrTouchTrustedDevice(
          user.id,
          opts.deviceId,
          opts.deviceName || user.deviceName,
          opts.appType === "desktop" ? "desktop" : "web"
        );
      }
      this.recordLoginEvent({
        userId: user.id,
        deviceName: opts?.deviceName || user.deviceName,
        method: "\u0645\u0635\u0627\u062F\u0642\u0629 \u062B\u0646\u0627\u0626\u064A\u0629 (2FA)",
        success: true
      });
      this.addAudit(
        user,
        "\u0627\u062C\u062A\u064A\u0627\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0625\u0636\u0627\u0641\u064A \u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644",
        "MfaChallenge",
        user.id,
        opts?.trustDevice ? "\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0648\u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u062C\u0647\u0627\u0632 \u0643\u062C\u0647\u0627\u0632 \u0645\u0648\u062B\u0648\u0642" : "\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u062C\u0644\u0633\u0629 \u0628\u0646\u062C\u0627\u062D",
        { deviceName: opts?.deviceName }
      );
      this.persist();
      return user;
    });
  }
  getAuthMePayload(userId) {
    const user = this.getActingUser(userId);
    const effectiveModulePermissions = getEffectiveModulePermissions(this.state, user);
    const rolePermissions = this.state.rolePermissions?.[user.role] || [];
    const company = this.state.companies?.[0];
    return {
      user: this.sanitizeUsersForActor(user).find((u) => u.id === user.id) || user,
      workspaceId: this.workspaceId,
      company: {
        id: company?.id || `comp-${this.workspaceId}`,
        nameAr: this.state.settings?.nameAr || company?.nameAr || "AqarPlus",
        nameEn: this.state.settings?.nameEn || company?.nameEn || "AqarPlus",
        logoDataUrl: this.state.settings?.logoDataUrl
      },
      rolePermissions,
      modulePermissions: effectiveModulePermissions
    };
  }
};

// server/ocr.ts
import { GoogleGenAI, Type } from "@google/genai";
function parseBase64DataUrl(dataUrl, fallbackMime) {
  const match = /^data:([^;]+);base64,(.+)$/is.exec(dataUrl.trim());
  if (match) {
    return {
      mimeType: match[1].trim(),
      data: match[2].replace(/\s+/g, "")
    };
  }
  return {
    mimeType: fallbackMime || "image/jpeg",
    data: dataUrl.trim()
  };
}
function normalizeGeminiError(err) {
  const msg = err?.message || String(err);
  if (msg.includes("PERMISSION_DENIED") || msg.includes("API_KEY_INVALID") || msg.includes("403") || msg.includes("401")) {
    return new Error("\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0645\u0641\u062A\u0627\u062D Gemini API. \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 GEMINI_API_KEY \u0641\u064A \u0644\u0648\u062D\u0629 Secrets.");
  }
  if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
    return new Error("\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u062D\u062F \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0624\u0642\u062A \u0644\u062E\u062F\u0645\u0629 Gemini. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0628\u0639\u062F \u0642\u0644\u064A\u0644.");
  }
  if (msg.includes("NOT_FOUND") || msg.includes("404")) {
    return new Error("\u0646\u0645\u0648\u0630\u062C Gemini \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u062D\u0627\u0644\u064A\u0627\u064B (gemini-4-hydrogen).");
  }
  return new Error(msg || "\u0641\u0634\u0644 \u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u062E\u062F\u0645\u0629 Gemini OCR");
}
async function generateWithRetry(fn, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err?.message || "";
      const isTransient = msg.includes("429") || msg.includes("503") || msg.includes("500") || msg.includes("ECONNRESET");
      if (!isTransient || attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt - 1)));
    }
  }
  throw normalizeGeminiError(lastError);
}
async function extractDocumentDataWithGemini(input) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error(
      "\u0645\u0641\u062A\u0627\u062D GEMINI_API_KEY \u063A\u064A\u0631 \u0645\u0636\u0628\u0648\u0637 \u0641\u064A \u0628\u064A\u0626\u0629 \u0627\u0644\u062E\u0627\u062F\u0645. \u064A\u0631\u062C\u0649 \u0625\u0636\u0627\u0641\u062A\u0647 \u0641\u064A \u0644\u0648\u062D\u0629 Secrets \u0644\u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u062A\u0639\u0631\u0641 \u0627\u0644\u0636\u0648\u0626\u064A (OCR)."
    );
  }
  if (!input.dataUrl || !input.dataUrl.trim()) {
    throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0645\u0644\u0641 \u0623\u0648 \u0635\u0648\u0631\u0629 \u0635\u0627\u0644\u062D\u0629 \u0644\u062A\u062D\u0644\u064A\u0644\u0647\u0627");
  }
  const { mimeType, data } = parseBase64DataUrl(input.dataUrl, input.mimeType);
  const supportedMimes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "application/pdf"
  ];
  const normalizedMime = mimeType === "image/jpg" ? "image/jpeg" : mimeType.toLowerCase();
  if (!supportedMimes.includes(normalizedMime)) {
    throw new Error(`\u0646\u0648\u0639 \u0627\u0644\u0645\u0644\u0641 (${mimeType}) \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645 \u0641\u064A OCR. \u0627\u0644\u0635\u064A\u063A \u0627\u0644\u0645\u062F\u0639\u0648\u0645\u0629: PNG, JPG, WEBP, PDF.`);
  }
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } }
  });
  const prompt = [
    "\u0623\u0646\u062A \u0646\u0638\u0627\u0645 \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0646\u0635\u0648\u0635 \u0648\u0628\u064A\u0627\u0646\u0627\u062A \u0639\u0642\u0627\u0631\u064A\u0629 \u0639\u0631\u0628\u064A/\u0625\u0646\u062C\u0644\u064A\u0632\u064A \u0639\u0627\u0644\u064A \u0627\u0644\u062F\u0642\u0629 \u0644\u0645\u0646\u0635\u0629 AqarPlus \u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0623\u0645\u0644\u0627\u0643 \u0641\u064A \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629 \u0648\u0627\u0644\u062E\u0644\u064A\u062C.",
    input.categoryHint ? `\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0627\u0644\u0645\u062A\u0648\u0642\u0639 \u0645\u0646 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645: ${input.categoryHint}.` : "",
    input.fileName ? `\u0627\u0633\u0645 \u0627\u0644\u0645\u0644\u0641: ${input.fileName}.` : "",
    "\u062D\u0644\u0651\u0644 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0627\u0644\u0645\u0631\u0641\u0642 (\u0635\u0648\u0631\u0629 \u0647\u0648\u064A\u0629 \u0648\u0637\u0646\u064A\u0629\u060C \u0625\u0642\u0627\u0645\u0629\u060C \u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A / \u0648\u0631\u0642\u064A\u060C \u0635\u0643 \u0645\u0644\u0643\u064A\u0629 \u0639\u0642\u0627\u0631\u064A\u0629\u060C \u0623\u0648 \u0641\u0627\u062A\u0648\u0631\u0629) \u0628\u062F\u0642\u0629\u060C \u0648\u0627\u0633\u062A\u062E\u0631\u062C \u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u0638\u0627\u0647\u0631\u0629 \u0628\u0635\u064A\u063A\u0629 JSON \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0644\u0645\u062E\u0637\u0637.",
    "\u0627\u0644\u062A\u0632\u0645 \u0628\u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u062A\u0627\u0644\u064A\u0629:",
    "- \u0641\u064A \u0627\u0644\u0647\u0648\u064A\u0627\u062A \u0648\u0627\u0644\u0625\u0642\u0627\u0645\u0627\u062A: \u0627\u0633\u062A\u062E\u0631\u062C \u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0648\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629\u060C \u0631\u0642\u0645 \u0627\u0644\u0647\u0648\u064A\u0629/\u0627\u0644\u0625\u0642\u0627\u0645\u0629 (10 \u0623\u0631\u0642\u0627\u0645)\u060C \u0627\u0644\u062C\u0646\u0633\u064A\u0629\u060C \u062C\u0647\u0629 \u0627\u0644\u0639\u0645\u0644/\u0627\u0644\u0643\u0641\u064A\u0644 \u0625\u0646 \u0648\u062C\u062F\u062A\u060C \u0648\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621 \u0628\u0635\u064A\u063A\u0629 YYYY-MM-DD.",
    "- \u0641\u064A \u0639\u0642\u0648\u062F \u0627\u0644\u0625\u064A\u062C\u0627\u0631: \u0627\u0633\u062A\u062E\u0631\u062C \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631\u060C \u0631\u0642\u0645 \u0647\u0648\u064A\u062A\u0647\u060C \u062C\u0648\u0627\u0644\u0647\u060C \u0627\u0633\u0645 \u0627\u0644\u0639\u0642\u0627\u0631/\u0627\u0644\u0645\u0628\u0646\u0649\u060C \u0627\u0644\u0645\u062F\u064A\u0646\u0629\u060C \u0627\u0644\u062D\u064A\u060C \u0627\u0644\u0634\u0627\u0631\u0639\u060C \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0648\u0637\u0646\u064A\u060C \u0631\u0642\u0645 \u0627\u0644\u0635\u0643\u060C \u0631\u0642\u0645 \u0627\u0644\u0639\u0642\u062F\u060C \u0631\u0642\u0645 \u062A\u0648\u062B\u064A\u0642 \u0625\u064A\u062C\u0627\u0631\u060C \u0631\u0642\u0645 \u0627\u0644\u0648\u062D\u062F\u0629 \u0648\u0646\u0648\u0639\u0647\u0627\u060C \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0628\u062F\u0627\u064A\u0629 \u0648\u0627\u0644\u0646\u0647\u0627\u064A\u0629\u060C \u0642\u064A\u0645\u0629 \u0627\u0644\u0625\u064A\u062C\u0627\u0631 \u0627\u0644\u0633\u0646\u0648\u064A\u060C \u0627\u0644\u062A\u0623\u0645\u064A\u0646\u060C \u062F\u0648\u0631\u064A\u0629 \u0627\u0644\u0633\u062F\u0627\u062F\u060C \u0648\u0627\u0633\u0645 \u0627\u0644\u0645\u0624\u062C\u0631/\u0627\u0644\u0645\u0627\u0644\u0643.",
    "- \u0627\u0643\u062A\u0628 \u0627\u0644\u062A\u0648\u0627\u0631\u064A\u062E \u0628\u0635\u064A\u063A\u0629 YYYY-MM-DD \u0625\u0646 \u0623\u0645\u0643\u0646 (\u0648\u062D\u0648\u0651\u0644 \u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0647\u0646\u062F\u064A\u0629 \u0625\u0644\u0649 \u0623\u0631\u0642\u0627\u0645 \u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 0-9 \u0641\u064A \u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0648\u0627\u0644\u062A\u0648\u0627\u0631\u064A\u062E).",
    "- \u0636\u0639 \u0627\u0644\u0646\u0635 \u0627\u0644\u0643\u0627\u0645\u0644 \u0627\u0644\u0645\u0642\u0631\u0648\u0621 \u0645\u0646 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0641\u064A \u062D\u0642\u0644 rawText.",
    "- \u0644\u0627 \u062A\u062E\u0645\u0651\u0646 \u0642\u064A\u0645\u0627\u064B \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0641\u064A \u0627\u0644\u0645\u0633\u062A\u0646\u062F."
  ].filter(Boolean).join("\n");
  const response = await generateWithRetry(
    () => ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: normalizedMime,
              data
            }
          },
          { text: prompt }
        ]
      },
      config: {
        systemInstruction: "\u0623\u0646\u062A \u0645\u062D\u0631\u0643 OCR \u0639\u0642\u0627\u0631\u064A \u062F\u0642\u064A\u0642. \u0623\u0639\u062F \u0628\u064A\u0627\u0646\u0627\u062A JSON \u0646\u0638\u064A\u0641\u0629 \u062A\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u062E\u0637\u0637 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0641\u0642\u0637 \u062F\u0648\u0646 \u0646\u0635\u0648\u0635 \u0625\u0636\u0627\u0641\u064A\u0629 \u062E\u0627\u0631\u062C JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            docType: {
              type: Type.STRING,
              enum: ["\u0639\u0642\u062F \u0625\u064A\u062C\u0627\u0631", "\u0635\u0643 \u0645\u0644\u0643\u064A\u0629", "\u0647\u0648\u064A\u0629 / \u0625\u0642\u0627\u0645\u0629", "\u0641\u0627\u062A\u0648\u0631\u0629 / \u0645\u0633\u062A\u0646\u062F \u0645\u0627\u0644\u064A", "\u0623\u062E\u0631\u0649"]
            },
            tenantNameAr: { type: Type.STRING },
            tenantNameEn: { type: Type.STRING },
            nationalIdOrIqama: { type: Type.STRING },
            nationality: { type: Type.STRING },
            phone: { type: Type.STRING },
            email: { type: Type.STRING },
            employer: { type: Type.STRING },
            propertyNameAr: { type: Type.STRING },
            deedNumber: { type: Type.STRING },
            city: { type: Type.STRING },
            district: { type: Type.STRING },
            street: { type: Type.STRING },
            nationalAddress: { type: Type.STRING },
            buildingName: { type: Type.STRING },
            contractNumber: { type: Type.STRING },
            ejarNumber: { type: Type.STRING },
            unitNumber: { type: Type.STRING },
            unitType: { type: Type.STRING },
            startDate: { type: Type.STRING },
            endDate: { type: Type.STRING },
            annualRent: { type: Type.NUMBER },
            securityDeposit: { type: Type.NUMBER },
            paymentFrequency: { type: Type.STRING, enum: ["\u0634\u0647\u0631\u064A", "\u0631\u0628\u0639 \u0633\u0646\u0648\u064A", "\u0646\u0635\u0641 \u0633\u0646\u0648\u064A", "\u0633\u0646\u0648\u064A"] },
            landlordNameAr: { type: Type.STRING },
            currency: { type: Type.STRING, enum: ["SAR", "AED", "USD", "EGP", "KWD"] },
            expiryDate: { type: Type.STRING },
            rawText: { type: Type.STRING },
            confidenceNote: { type: Type.STRING }
          },
          required: ["docType", "rawText"]
        }
      }
    })
  );
  const text = (response.text || "").trim();
  if (!text) {
    throw new Error("\u0644\u0645 \u064A\u064F\u0631\u062C\u0639 \u0645\u062D\u0631\u0643 \u0627\u0644\u062A\u0639\u0631\u0641 \u0627\u0644\u0636\u0648\u0626\u064A \u0623\u064A \u0646\u0635\u0648\u0635 \u0645\u0646 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0627\u0644\u0645\u0631\u0641\u0642");
  }
  const parsed = JSON.parse(text);
  return {
    extracted: parsed,
    rawText: parsed.rawText || text
  };
}

// server/syncDispatcher.ts
function dispatchSyncOperation(store2, input) {
  const { method, userId, deviceName } = input;
  const body = input.body && typeof input.body === "object" ? input.body : {};
  const endpoint = input.endpoint.split("?")[0].trim();
  try {
    if (method === "POST" && endpoint === "/api/properties") {
      const property = store2.createProperty(userId, body, deviceName);
      return { ok: true, status: 201, data: { property }, entityType: "properties", entityId: property.id };
    }
    if (method === "POST" && endpoint === "/api/units") {
      const unit = store2.createUnit(userId, body, deviceName);
      return { ok: true, status: 201, data: { unit }, entityType: "units", entityId: unit.id };
    }
    let m;
    if (method === "PATCH" && (m = /^\/api\/units\/([^/]+)\/status$/.exec(endpoint))) {
      const unit = store2.updateUnitStatus(userId, m[1], body.status, body.reason, deviceName);
      return { ok: true, status: 200, data: { unit }, entityType: "units", entityId: unit.id };
    }
    if (method === "POST" && (m = /^\/api\/units\/([^/]+)\/link-tenant$/.exec(endpoint))) {
      const unit = store2.linkTenantToUnit(userId, m[1], body.tenantId, deviceName);
      return { ok: true, status: 200, data: { unit }, entityType: "units", entityId: unit.id };
    }
    if (method === "POST" && endpoint === "/api/tenants") {
      const tenant = store2.createTenant(userId, body, deviceName);
      return { ok: true, status: 201, data: { tenant }, entityType: "tenants", entityId: tenant.id };
    }
    if (method === "PATCH" && (m = /^\/api\/tenants\/([^/]+)$/.exec(endpoint))) {
      const tenant = store2.updateTenant(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { tenant }, entityType: "tenants", entityId: tenant.id };
    }
    if (method === "DELETE" && (m = /^\/api\/tenants\/([^/]+)$/.exec(endpoint))) {
      store2.deleteTenant(userId, m[1], deviceName);
      return { ok: true, status: 200, data: { ok: true }, entityType: "tenants", entityId: m[1] };
    }
    if (method === "PATCH" && (m = /^\/api\/tenants\/([^/]+)\/checklist$/.exec(endpoint))) {
      const tenant = store2.updateTenantChecklist(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { tenant }, entityType: "tenants", entityId: tenant.id };
    }
    if (method === "POST" && (m = /^\/api\/tenants\/([^/]+)\/notes$/.exec(endpoint))) {
      const note = store2.addTenantViolationNote(userId, m[1], body, deviceName);
      return { ok: true, status: 201, data: { note }, entityType: "tenants", entityId: m[1] };
    }
    if (method === "POST" && (m = /^\/api\/tenants\/([^/]+)\/appointments$/.exec(endpoint))) {
      const log = store2.scheduleTenantAppointment(userId, m[1], body, deviceName);
      return { ok: true, status: 201, data: { log }, entityType: "tenants", entityId: m[1] };
    }
    if (method === "POST" && endpoint === "/api/leads") {
      const lead = store2.createLead(userId, body, deviceName);
      return { ok: true, status: 201, data: { lead }, entityType: "leads", entityId: lead.id };
    }
    if (method === "PATCH" && (m = /^\/api\/leads\/([^/]+)$/.exec(endpoint))) {
      const lead = store2.updateLead(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { lead }, entityType: "leads", entityId: lead.id };
    }
    if (method === "POST" && (m = /^\/api\/leads\/([^/]+)\/escalate$/.exec(endpoint))) {
      const escalation = store2.escalateLead(userId, m[1], body, deviceName);
      return { ok: true, status: 201, data: { escalation }, entityType: "leads", entityId: m[1] };
    }
    if (method === "POST" && (m = /^\/api\/leads\/([^/]+)\/convert$/.exec(endpoint))) {
      const result = store2.convertLeadToTenant(userId, m[1], deviceName);
      return { ok: true, status: 201, data: { ...result }, entityType: "leads", entityId: m[1] };
    }
    if (method === "POST" && (m = /^\/api\/lead-escalations\/([^/]+)\/decision$/.exec(endpoint))) {
      const escalation = store2.decideLeadEscalation(
        userId,
        m[1],
        { decision: body.decision, decisionNotes: body.decisionNotes, isToken: false },
        deviceName
      );
      return { ok: true, status: 200, data: { escalation }, entityType: "leadEscalations", entityId: escalation.id };
    }
    if (method === "POST" && endpoint === "/api/contracts") {
      const result = store2.createContract(userId, body, deviceName);
      return { ok: true, status: 201, data: { ...result }, entityType: "contracts", entityId: result.contract.id };
    }
    if (method === "PATCH" && (m = /^\/api\/contracts\/([^/]+)$/.exec(endpoint))) {
      const contract = store2.updateContractDetails(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { contract }, entityType: "contracts", entityId: contract.id };
    }
    if (method === "PATCH" && (m = /^\/api\/contracts\/([^/]+)\/ejar$/.exec(endpoint))) {
      const contract = store2.updateContractEjarStatus(
        userId,
        m[1],
        body.ejarNumber,
        body.ejarStatus,
        body.lifecycleStatus,
        deviceName
      );
      return { ok: true, status: 200, data: { contract }, entityType: "contracts", entityId: contract.id };
    }
    if (method === "POST" && (m = /^\/api\/contracts\/([^/]+)\/renew$/.exec(endpoint))) {
      const result = store2.renewContract(userId, m[1], body, deviceName);
      return { ok: true, status: 201, data: { ...result }, entityType: "contracts", entityId: result.contract.id };
    }
    if (method === "POST" && endpoint === "/api/handovers") {
      const handover = store2.createHandoverInspection(userId, body, deviceName);
      return { ok: true, status: 201, data: { handover }, entityType: "handovers", entityId: handover.id };
    }
    if (method === "POST" && (m = /^\/api\/handovers\/([^/]+)\/approve$/.exec(endpoint))) {
      const handover = store2.approveHandover(userId, m[1], body.nextUnitStatus, deviceName);
      return { ok: true, status: 200, data: { handover }, entityType: "handovers", entityId: handover.id };
    }
    if (method === "POST" && endpoint === "/api/payments") {
      const idempotencyKey = input.idempotencyKey || String(body.idempotencyKey || input.operationId || `sync-${Date.now()}`);
      const payment = store2.recordPayment(userId, { ...body, idempotencyKey }, deviceName);
      return { ok: true, status: 201, data: { payment }, entityType: "payments", entityId: payment.id };
    }
    if (method === "POST" && (m = /^\/api\/payments\/([^/]+)\/reverse$/.exec(endpoint))) {
      const payment = store2.reverseReceipt(userId, m[1], body.reason, deviceName);
      return { ok: true, status: 200, data: { payment }, entityType: "payments", entityId: payment.id };
    }
    if (method === "POST" && endpoint === "/api/expenses") {
      const expense = store2.createExpense(userId, body, deviceName);
      return { ok: true, status: 201, data: { expense }, entityType: "expenses", entityId: expense.id };
    }
    if (method === "PATCH" && (m = /^\/api\/expenses\/([^/]+)$/.exec(endpoint))) {
      const expense = store2.updateOrCancelExpense(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { expense }, entityType: "expenses", entityId: expense.id };
    }
    if (method === "POST" && (m = /^\/api\/expenses\/([^/]+)\/decision$/.exec(endpoint))) {
      const expense = store2.decideExpense(userId, m[1], body.decision, body.reason, deviceName);
      return { ok: true, status: 200, data: { expense }, entityType: "expenses", entityId: expense.id };
    }
    if (method === "POST" && endpoint === "/api/tickets") {
      const ticket = store2.createTicket(userId, body, deviceName);
      return { ok: true, status: 201, data: { ticket }, entityType: "tickets", entityId: ticket.id };
    }
    if (method === "PATCH" && (m = /^\/api\/tickets\/([^/]+)$/.exec(endpoint))) {
      const ticket = store2.updateTicket(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { ticket }, entityType: "tickets", entityId: ticket.id };
    }
    if (method === "POST" && endpoint === "/api/tasks") {
      const task = store2.createTask(userId, body, deviceName);
      return { ok: true, status: 201, data: { task }, entityType: "tasks", entityId: task.id };
    }
    if (method === "PATCH" && (m = /^\/api\/tasks\/([^/]+)$/.exec(endpoint))) {
      const task = store2.updateTask(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { task }, entityType: "tasks", entityId: task.id };
    }
    if (method === "POST" && (m = /^\/api\/tasks\/([^/]+)\/reassign$/.exec(endpoint))) {
      const task = store2.reassignTask(userId, m[1], String(body.assignedTo || ""), body.reason, deviceName);
      return { ok: true, status: 200, data: { task }, entityType: "tasks", entityId: task.id };
    }
    if (method === "POST" && (m = /^\/api\/tasks\/([^/]+)\/review$/.exec(endpoint))) {
      const task = store2.reviewTask(
        userId,
        m[1],
        body.decision === "reject" ? "reject" : "approve",
        body.reason,
        deviceName
      );
      return { ok: true, status: 200, data: { task }, entityType: "tasks", entityId: task.id };
    }
    if (method === "POST" && endpoint === "/api/communications") {
      const log = store2.addCommunication(userId, body, deviceName);
      return { ok: true, status: 201, data: { log }, entityType: "communications", entityId: log.id };
    }
    if (method === "POST" && endpoint === "/api/documents") {
      const doc = store2.addDocument(userId, body, deviceName);
      return { ok: true, status: 201, data: { doc }, entityType: "documents", entityId: doc.id };
    }
    if (method === "POST" && (m = /^\/api\/documents\/([^/]+)\/access$/.exec(endpoint))) {
      const doc = store2.recordDocumentAccess(userId, m[1], body.action || "\u0645\u0639\u0627\u064A\u0646\u0629", deviceName);
      return { ok: true, status: 200, data: { doc }, entityType: "documents", entityId: doc.id };
    }
    if (method === "POST" && endpoint === "/api/vendors") {
      const vendor = store2.createVendor(userId, body, deviceName);
      return { ok: true, status: 201, data: { vendor }, entityType: "vendors", entityId: vendor.id };
    }
    if (method === "PATCH" && (m = /^\/api\/vendors\/([^/]+)$/.exec(endpoint))) {
      const vendor = store2.updateVendor(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { vendor }, entityType: "vendors", entityId: vendor.id };
    }
    if (method === "POST" && endpoint === "/api/permissions/toggle") {
      const rolePermissions = store2.toggleRolePermission(userId, body.role, body.permission, deviceName);
      return { ok: true, status: 200, data: { rolePermissions }, entityType: "rolePermissions", entityId: String(body.role) };
    }
    if (method === "POST" && endpoint === "/api/notifications/read") {
      store2.markNotificationsRead(userId);
      return { ok: true, status: 200, data: { ok: true } };
    }
    if (method === "POST" && endpoint === "/api/companies") {
      const company = store2.createCompany(userId, body, deviceName);
      return { ok: true, status: 201, data: { company }, entityType: "companies", entityId: company.id };
    }
    if (method === "PATCH" && endpoint === "/api/settings") {
      const settings = store2.updateSettings(userId, body, deviceName);
      return { ok: true, status: 200, data: { settings }, entityType: "settings", entityId: "company" };
    }
    if (method === "POST" && endpoint === "/api/reminders/rules") {
      const rule = store2.createReminderRule(userId, body, deviceName);
      return { ok: true, status: 201, data: { rule }, entityType: "reminderRules", entityId: rule.id };
    }
    if (method === "PATCH" && (m = /^\/api\/reminders\/rules\/([^/]+)$/.exec(endpoint))) {
      const rule = store2.toggleReminderRule(userId, m[1], Boolean(body.enabled), deviceName);
      return { ok: true, status: 200, data: { rule }, entityType: "reminderRules", entityId: rule.id };
    }
    if (method === "DELETE" && (m = /^\/api\/reminders\/rules\/([^/]+)$/.exec(endpoint))) {
      store2.deleteReminderRule(userId, m[1], deviceName);
      return { ok: true, status: 200, data: { ok: true }, entityType: "reminderRules", entityId: m[1] };
    }
    if (method === "POST" && endpoint === "/api/reminders/run") {
      const result = store2.runReminderScheduler(userId, body);
      return { ok: true, status: 200, data: { ...result } };
    }
    if (method === "POST" && (m = /^\/api\/owners\/([^/]+)\/transfer$/.exec(endpoint))) {
      const result = store2.recordOwnerTransfer(userId, m[1], body, deviceName);
      return { ok: true, status: 201, data: { ...result }, entityType: "owners", entityId: m[1] };
    }
    if (method === "POST" && endpoint === "/api/purchase-orders") {
      const po = store2.createPurchaseOrder(userId, body, deviceName);
      return { ok: true, status: 201, data: { po }, entityType: "purchaseOrders", entityId: po.id };
    }
    if (method === "PATCH" && (m = /^\/api\/purchase-orders\/([^/]+)$/.exec(endpoint))) {
      const po = store2.updatePurchaseOrder(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { po }, entityType: "purchaseOrders", entityId: po.id };
    }
    if (method === "POST" && endpoint === "/api/decisions") {
      const decision = store2.createDecision(userId, body, deviceName);
      return { ok: true, status: 201, data: { decision }, entityType: "decisions", entityId: decision.id };
    }
    if (method === "POST" && endpoint === "/api/archive/move") {
      const result = store2.archiveEntity(userId, body, deviceName);
      return { ok: true, status: 200, data: { ...result }, entityType: String(body.category || "archive"), entityId: String(body.id || "") };
    }
    if (method === "POST" && endpoint === "/api/archive/restore") {
      const result = store2.restoreArchivedEntity(userId, body, deviceName);
      return { ok: true, status: 200, data: { ...result }, entityType: String(body.category || "archive"), entityId: String(body.id || "") };
    }
    if (method === "POST" && endpoint === "/api/archive/filters") {
      const filter = store2.saveArchiveFilter(userId, body, deviceName);
      return { ok: true, status: 201, data: { filter }, entityType: "savedArchiveFilters", entityId: filter.id };
    }
    if (method === "DELETE" && (m = /^\/api\/archive\/filters\/([^/]+)$/.exec(endpoint))) {
      store2.deleteArchiveFilter(userId, m[1]);
      return { ok: true, status: 200, data: { ok: true }, entityType: "savedArchiveFilters", entityId: m[1] };
    }
    if (method === "POST" && endpoint === "/api/team/users") {
      const user = store2.createStaffUser(userId, body, deviceName);
      return { ok: true, status: 201, data: { user }, entityType: "users", entityId: user.id };
    }
    if (method === "PATCH" && (m = /^\/api\/team\/users\/([^/]+)$/.exec(endpoint))) {
      const user = store2.updateStaffUser(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { user }, entityType: "users", entityId: user.id };
    }
    if (method === "DELETE" && (m = /^\/api\/team\/users\/([^/]+)$/.exec(endpoint))) {
      const result = store2.deleteStaffUser(userId, m[1], deviceName);
      return { ok: true, status: 200, data: { ...result }, entityType: "users", entityId: m[1] };
    }
    if (method === "PATCH" && endpoint === "/api/team/security-policy") {
      const securityPolicy = store2.updateSecurityPolicy(userId, body, deviceName);
      return { ok: true, status: 200, data: { securityPolicy }, entityType: "securityPolicy", entityId: "policy" };
    }
    if (method === "POST" && endpoint === "/api/templates") {
      const template = store2.createTemplate(userId, body, deviceName);
      return { ok: true, status: 201, data: { template }, entityType: "communicationTemplates", entityId: template.id };
    }
    if (method === "PATCH" && (m = /^\/api\/templates\/([^/]+)$/.exec(endpoint))) {
      const template = store2.updateTemplate(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { template }, entityType: "communicationTemplates", entityId: template.id };
    }
    if (method === "DELETE" && (m = /^\/api\/templates\/([^/]+)$/.exec(endpoint))) {
      store2.deleteTemplate(userId, m[1], deviceName);
      return { ok: true, status: 200, data: { ok: true }, entityType: "communicationTemplates", entityId: m[1] };
    }
    if (method === "POST" && (m = /^\/api\/templates\/([^/]+)\/use$/.exec(endpoint))) {
      const result = store2.useTemplate(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { ...result }, entityType: "communicationTemplates", entityId: m[1] };
    }
    if (method === "POST" && endpoint === "/api/supplier-invoices") {
      const invoice = store2.createSupplierInvoice(userId, body, deviceName);
      return { ok: true, status: 201, data: { invoice }, entityType: "supplierInvoices", entityId: invoice.id };
    }
    if (method === "PATCH" && (m = /^\/api\/supplier-invoices\/([^/]+)$/.exec(endpoint))) {
      const invoice = store2.updateSupplierInvoice(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { invoice }, entityType: "supplierInvoices", entityId: invoice.id };
    }
    if (method === "POST" && endpoint === "/api/recurring-expenses") {
      const rule = store2.createRecurringExpense(userId, body, deviceName);
      return { ok: true, status: 201, data: { rule }, entityType: "recurringExpenses", entityId: rule.id };
    }
    if (method === "PATCH" && (m = /^\/api\/recurring-expenses\/([^/]+)$/.exec(endpoint))) {
      const rule = store2.toggleRecurringExpense(userId, m[1], Boolean(body.enabled), deviceName);
      return { ok: true, status: 200, data: { rule }, entityType: "recurringExpenses", entityId: rule.id };
    }
    if (method === "POST" && endpoint === "/api/property-budgets") {
      const budget = store2.upsertPropertyBudget(userId, body, deviceName);
      return { ok: true, status: 201, data: { budget }, entityType: "propertyBudgets", entityId: budget.id };
    }
    if (method === "POST" && endpoint === "/api/meters/readings") {
      const reading = store2.createMeterReading(userId, body, deviceName);
      return { ok: true, status: 201, data: { reading }, entityType: "meterReadings", entityId: reading.id };
    }
    if (method === "POST" && endpoint === "/api/zatca/invoices") {
      const invoice = store2.createZatcaInvoice(userId, body, deviceName);
      return { ok: true, status: 201, data: { invoice }, entityType: "zatcaInvoices", entityId: invoice.id };
    }
    if (method === "POST" && endpoint === "/api/reports/schedules") {
      const schedule = store2.createScheduledReport(userId, body, deviceName);
      return { ok: true, status: 201, data: { schedule }, entityType: "scheduledReports", entityId: schedule.id };
    }
    if (method === "DELETE" && (m = /^\/api\/reports\/schedules\/([^/]+)$/.exec(endpoint))) {
      const result = store2.deleteScheduledReport(userId, m[1], deviceName);
      return { ok: true, status: 200, data: { ...result }, entityType: "scheduledReports", entityId: m[1] };
    }
    if (method === "POST" && endpoint === "/api/reports/favorites") {
      const preset = store2.saveFavoriteReport(userId, body, deviceName);
      return { ok: true, status: 201, data: { preset }, entityType: "favoriteReports", entityId: preset.id };
    }
    if (method === "DELETE" && (m = /^\/api\/reports\/favorites\/([^/]+)$/.exec(endpoint))) {
      const result = store2.deleteFavoriteReport(userId, m[1]);
      return { ok: true, status: 200, data: { ...result }, entityType: "favoriteReports", entityId: m[1] };
    }
    if (method === "POST" && endpoint === "/api/search/filters") {
      const filter = store2.saveSharedSearchFilter(userId, body, deviceName);
      return { ok: true, status: 201, data: { filter }, entityType: "sharedSearchFilters", entityId: filter.id };
    }
    if (method === "DELETE" && (m = /^\/api\/search\/filters\/([^/]+)$/.exec(endpoint))) {
      const result = store2.deleteSharedSearchFilter(userId, m[1]);
      return { ok: true, status: 200, data: { ...result }, entityType: "sharedSearchFilters", entityId: m[1] };
    }
    return {
      ok: false,
      status: 404,
      data: { error: `\u0646\u0642\u0637\u0629 \u0627\u0644\u0646\u0647\u0627\u064A\u0629 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629 \u0644\u0644\u0645\u0632\u0627\u0645\u0646\u0629 (${method} ${endpoint})` }
    };
  } catch (err) {
    return {
      ok: false,
      status: 400,
      data: { error: err.message }
    };
  }
}

// server.ts
dotenv.config();
var SESSION_COOKIE_NAME = "aqar_session";
var REFRESH_COOKIE_NAME = "aqar_refresh";
var SESSION_TTL_MS = 1e3 * 60 * 60 * 24 * 7;
var ACCESS_TOKEN_TTL_MS = 1e3 * 60 * 60 * 4;
var SESSION_SHORT_TTL_MS = 1e3 * 60 * 60 * 8;
function resolvePort() {
  const portFlagIdx = process.argv.findIndex((a) => a === "--port" || a === "-p");
  if (portFlagIdx !== -1 && process.argv[portFlagIdx + 1]) {
    const parsed = Number(process.argv[portFlagIdx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const eqFlag = process.argv.find((a) => a.startsWith("--port="));
  if (eqFlag) {
    const parsed = Number(eqFlag.split("=")[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const envPort = Number(process.env.PORT);
  if (Number.isFinite(envPort) && envPort > 0 && envPort !== 8080) return envPort;
  return 3e3;
}
var PORT = resolvePort();
function normalizeWorkspaceId(raw) {
  const clean = (raw || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return clean.length >= 3 && clean.length <= 40 ? clean : "default";
}
function resolveRequestWorkspaceId(req) {
  const headerWs = req.headers["x-workspace-id"];
  if (typeof headerWs === "string" && headerWs.trim()) {
    return normalizeWorkspaceId(headerWs);
  }
  const rawUrl = req.url || "/";
  const qIdx = rawUrl.indexOf("?");
  if (qIdx >= 0) {
    const params = new URLSearchParams(rawUrl.slice(qIdx + 1));
    const qWs = params.get("workspace");
    if (qWs) return normalizeWorkspaceId(qWs);
  }
  return "default";
}
var workspaceStores = /* @__PURE__ */ new Map();
var workspaceAls = new AsyncLocalStorage();
function getExistingWorkspaceStore(workspaceId = "default") {
  const clean = normalizeWorkspaceId(workspaceId);
  const cached = workspaceStores.get(clean);
  if (cached) return cached;
  if (clean !== "default" && !AqarStore.workspaceExists(clean)) {
    return null;
  }
  const created = new AqarStore(clean);
  workspaceStores.set(clean, created);
  return created;
}
function provisionNewWorkspaceStore(workspaceId, opts) {
  const clean = normalizeWorkspaceId(workspaceId);
  if (clean === "default" || workspaceStores.has(clean) || AqarStore.workspaceExists(clean)) {
    throw new Error("\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0639\u0645\u0644 \u0647\u0630\u0647 \u0645\u0641\u0639\u0651\u0644\u0629 \u0645\u0633\u0628\u0642\u0627\u064B \u2014 \u0627\u062E\u062A\u0631 \u0645\u0639\u0631\u0651\u0641 \u0634\u0631\u0643\u0629 \u0645\u062E\u062A\u0644\u0641\u0627\u064B \u0623\u0648 \u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644");
  }
  const created = new AqarStore(clean, opts);
  workspaceStores.set(clean, created);
  return created;
}
function getBaseDataDir2() {
  return process.env.AQARPLUS_USER_DATA_DIR ? path3.resolve(process.env.AQARPLUS_USER_DATA_DIR) : path3.resolve(process.cwd(), "data");
}
function listAllWorkspaceIds() {
  const found = /* @__PURE__ */ new Set(["default"]);
  for (const key of workspaceStores.keys()) {
    found.add(key);
  }
  const wsRoot = path3.join(getBaseDataDir2(), "workspaces");
  if (fs3.existsSync(wsRoot)) {
    try {
      for (const entry of fs3.readdirSync(wsRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const clean = normalizeWorkspaceId(entry.name);
        if (clean !== "default" && fs3.existsSync(path3.join(wsRoot, entry.name, "aqarplus.sqlite"))) {
          found.add(clean);
        }
      }
    } catch {
    }
  }
  return Array.from(found);
}
function getServerMasterSecret() {
  if (process.env.AQAR_SESSION_SECRET && process.env.AQAR_SESSION_SECRET.length >= 16) {
    return process.env.AQAR_SESSION_SECRET;
  }
  return getExistingWorkspaceStore("default").getSessionSecret();
}
var authRateBuckets = /* @__PURE__ */ new Map();
function checkAuthRateLimit(bucketKey, maxRequests, windowMs = 6e4) {
  const now = Date.now();
  const prev = authRateBuckets.get(bucketKey) || [];
  const recent = prev.filter((ts) => now - ts < windowMs);
  if (recent.length >= maxRequests) {
    const oldest = recent[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1e3));
    authRateBuckets.set(bucketKey, recent);
    return retryAfterSec;
  }
  recent.push(now);
  authRateBuckets.set(bucketKey, recent);
  return null;
}
function isSecureRequest(req) {
  if (req.secure) return true;
  const fwdProto = req.headers["x-forwarded-proto"];
  if (typeof fwdProto === "string") {
    return fwdProto.split(",")[0].trim().toLowerCase() === "https";
  }
  return false;
}
var store = new Proxy({}, {
  get(_target, prop) {
    const alsStore = workspaceAls.getStore()?.store;
    const active = (alsStore && alsStore !== store ? alsStore : null) || getExistingWorkspaceStore("default");
    const value = active[prop];
    return typeof value === "function" ? value.bind(active) : value;
  }
});
var activeSessions = /* @__PURE__ */ new Map();
function extractClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) {
    return fwd.split(",")[0].trim();
  }
  const remote = req.socket?.remoteAddress || "127.0.0.1";
  return remote.replace(/^::ffff:/, "");
}
function parseCookies(cookieHeader) {
  const result = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}
function extractSessionToken(req) {
  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers["cookie"]);
  return cookies[SESSION_COOKIE_NAME] || null;
}
function resolveSessionActor(req, overrideToken) {
  const workspaceId = resolveRequestWorkspaceId(req);
  const wsStore = getExistingWorkspaceStore(workspaceId);
  if (!wsStore) return null;
  const rawToken = overrideToken || extractSessionToken(req);
  if (!rawToken) return null;
  const payload = verifySessionToken(rawToken, wsStore.getSessionSecret());
  if (!payload) return null;
  if (payload.wid && payload.wid !== workspaceId) return null;
  const dbSession = wsStore.getPersistence().isSessionActive(rawToken);
  if (!dbSession || dbSession.userId !== payload.uid) return null;
  const user = wsStore.getState().users.find(
    (u) => u.id === payload.uid && u.active && (!u.accountStatus || u.accountStatus === "\u0646\u0634\u0637")
  );
  if (!user) return null;
  wsStore.getPersistence().updateSessionLastSeen(rawToken);
  const rawDevice = req.headers["x-device-name"];
  let deviceName = payload.deviceName;
  if (rawDevice) {
    try {
      deviceName = decodeURIComponent(String(rawDevice));
    } catch {
      deviceName = String(rawDevice);
    }
  }
  return {
    userId: user.id,
    workspaceId,
    role: user.role,
    sessionId: payload.sid,
    rawToken,
    deviceName,
    ipAddress: extractClientIp(req)
  };
}
function sendApiError(res, err, defaultStatus = 400) {
  if (err instanceof PermissionDeniedError) {
    return res.status(403).json({ error: err.message, code: "FORBIDDEN" });
  }
  const msg = err?.message || "\u062A\u0639\u0630\u0631 \u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0637\u0644\u0628";
  return res.status(defaultStatus).json({ error: msg });
}
function disconnectUserWebSockets(userId, workspaceId, reason, targetSessionId, excludeSessionId) {
  let closed = 0;
  for (const [client, session] of Array.from(activeSessions.entries())) {
    if (session.workspaceId !== workspaceId || session.userId !== userId) continue;
    if (targetSessionId && session.sessionId !== targetSessionId) continue;
    if (excludeSessionId && session.sessionId === excludeSessionId) continue;
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(
          JSON.stringify({
            type: "session:terminated",
            userId: session.userId,
            sessionId: session.sessionId,
            reason
          })
        );
      } catch {
      }
    }
    try {
      client.close();
    } catch {
    }
    activeSessions.delete(client);
    closed += 1;
  }
  if (closed > 0) {
    broadcastPresence(workspaceId);
  }
  return closed;
}
function issueUserSession(res, userId, role, deviceName = "Web Terminal", workspaceId = workspaceAls.getStore()?.workspaceId || "default", rememberMe = true, ipAddress, opts) {
  const wsStore = getExistingWorkspaceStore(workspaceId);
  const now = Date.now();
  const accessTtlMs = rememberMe ? ACCESS_TOKEN_TTL_MS : SESSION_SHORT_TTL_MS;
  const exp = now + accessTtlMs;
  const expiresAt = new Date(exp).toISOString();
  const refreshTtlMs = rememberMe ? SESSION_TTL_MS : SESSION_SHORT_TTL_MS;
  const refreshExpiresAt = rememberMe ? new Date(now + refreshTtlMs).toISOString() : void 0;
  const rawRefreshToken = rememberMe ? crypto4.randomBytes(32).toString("hex") : void 0;
  const sid = `ses-${crypto4.randomBytes(8).toString("hex")}`;
  const token = signSessionToken(
    { sid, uid: userId, wid: workspaceId, role, deviceName, iat: now, exp },
    wsStore.getSessionSecret()
  );
  wsStore.getPersistence().createSession(token, userId, deviceName, expiresAt, {
    sessionId: sid,
    rememberMe,
    ipAddress,
    appType: opts?.appType === "desktop" ? "desktop" : "web",
    deviceId: opts?.deviceId,
    rawRefreshToken,
    refreshExpiresAt
  });
  const secureFlag = Boolean(opts?.secureCookie);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureFlag,
    path: "/",
    ...rememberMe ? { maxAge: accessTtlMs } : {}
  });
  if (rememberMe && rawRefreshToken) {
    res.cookie(REFRESH_COOKIE_NAME, rawRefreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureFlag,
      path: "/",
      maxAge: refreshTtlMs
    });
  } else {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });
  }
  return { token, refreshToken: rawRefreshToken, expiresAt, refreshExpiresAt, sessionId: sid, rememberMe };
}
function getPresenceList(workspaceId = workspaceAls.getStore()?.workspaceId || "default") {
  const wsStore = getExistingWorkspaceStore(workspaceId);
  if (!wsStore) return [];
  const state = wsStore.getState();
  const seen = /* @__PURE__ */ new Map();
  for (const s of activeSessions.values()) {
    if (!s.authenticated || s.workspaceId !== workspaceId) continue;
    const user = state.users.find((u) => u.id === s.userId);
    if (user) {
      seen.set(s.sessionId, {
        sessionId: s.sessionId,
        userId: user.id,
        nameAr: user.nameAr,
        roleLabelAr: user.roleLabelAr,
        deviceName: s.deviceName || user.deviceName,
        ipAddress: s.ipAddress,
        connectedAt: s.connectedAt
      });
    }
  }
  return Array.from(seen.values());
}
function broadcastPresence(workspaceId = workspaceAls.getStore()?.workspaceId || "default") {
  const payload = JSON.stringify({ type: "presence:update", sessions: getPresenceList(workspaceId) });
  for (const [client, session] of activeSessions.entries()) {
    if (session.authenticated && session.workspaceId === workspaceId && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}
function broadcastStateChange(actorUserId, eventSummary, workspaceId = workspaceAls.getStore()?.workspaceId || "default") {
  const wsStore = getExistingWorkspaceStore(workspaceId);
  if (!wsStore) return;
  for (const [client, session] of activeSessions.entries()) {
    if (session.authenticated && session.workspaceId === workspaceId && client.readyState === WebSocket.OPEN) {
      try {
        client.send(
          JSON.stringify({
            type: "state:updated",
            actorUserId,
            summary: eventSummary,
            state: wsStore.getStateForUser(session.userId)
          })
        );
      } catch {
      }
    }
  }
}
function getActor(req) {
  const actor = req.authActor;
  if (!actor) {
    throw new Error("\u062C\u0644\u0633\u0629 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0647\u0627 \u2014 \u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644");
  }
  return actor;
}
var PUBLIC_API_EXACT = /* @__PURE__ */ new Set([
  "/api/health",
  "/api/workspaces/provision",
  "/api/auth/session",
  "/api/auth/login",
  "/api/auth/login-pin",
  "/api/auth/select-company",
  "/api/auth/mfa/verify",
  "/api/auth/mfa/resend",
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/auth/recovery/request",
  "/api/auth/recovery/reset",
  "/api/public/prospect-context",
  "/api/public/leads"
]);
function isPublicApiPath(fullPath) {
  return PUBLIC_API_EXACT.has(fullPath) || fullPath.startsWith("/api/public/lead-decision/") || fullPath.startsWith("/api/public/invitations/");
}
function handleApi(app) {
  app.use(express.json({ limit: "15mb" }));
  app.use("/api", (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    const workspaceId = resolveRequestWorkspaceId(req);
    const fullPath = `/api${req.path}`;
    if (fullPath === "/api/workspaces/provision" || fullPath === "/api/auth/select-company" || fullPath === "/api/auth/mfa/verify" || fullPath === "/api/auth/mfa/resend") {
      return next();
    }
    const wsStore = getExistingWorkspaceStore(workspaceId);
    if (!wsStore) {
      if (fullPath === "/api/auth/session") {
        return res.json({
          authenticated: false,
          workspaceId,
          workspaceExists: false,
          demoLoginEnabled: process.env.AQAR_DEMO_LOGIN === "true",
          loginProfiles: [],
          companyBranding: {
            nameAr: "\u0645\u0633\u0627\u062D\u0629 \u0639\u0645\u0644 \u062C\u062F\u064A\u062F\u0629",
            nameEn: "New Workspace"
          }
        });
      }
      if (fullPath === "/api/auth/login" || fullPath === "/api/auth/login-pin") {
        return res.status(401).json({
          error: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0634\u0631\u0643\u0629 \u063A\u064A\u0631 \u0645\u0633\u062C\u0644 \u0628\u0639\u062F \u2014 \u0627\u0636\u063A\u0637 \xAB\u0634\u0631\u0643\u0629 \u062C\u062F\u064A\u062F\u0629\xBB \u0644\u062A\u0623\u0633\u064A\u0633\u0647\u0627 \u0623\u0648 \u062A\u0623\u0643\u062F \u0645\u0646 Workspace ID"
        });
      }
      if (fullPath.startsWith("/api/public/invitations/")) {
        return res.status(404).json({
          valid: false,
          reason: "\u0627\u0644\u0634\u0631\u0643\u0629 \u0623\u0648 \u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629",
          workspaceExists: false
        });
      }
      if (fullPath === "/api/auth/recovery/request") {
        return res.json({
          ok: true,
          message: "\u0625\u0630\u0627 \u0643\u0627\u0646 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0633\u062C\u0644\u0627\u064B \u0648\u0646\u0634\u0637\u0627\u064B\u060C \u0641\u0633\u064A\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u062A\u062D\u0642\u0642 \u0644\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0635\u0627\u0644\u062D \u0644\u0645\u062F\u0629 15 \u062F\u0642\u064A\u0642\u0629."
        });
      }
      if (fullPath === "/api/auth/recovery/reset") {
        return res.status(400).json({ error: "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0623\u0648 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629" });
      }
      return res.status(401).json({
        error: "\u0627\u0646\u062A\u0647\u062A \u0627\u0644\u062C\u0644\u0633\u0629 \u0623\u0648 \u0644\u0645 \u064A\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u2014 \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0644\u0644\u0645\u062A\u0627\u0628\u0639\u0629",
        code: "AUTH_REQUIRED"
      });
    }
    workspaceAls.run({ workspaceId, store: wsStore }, () => next());
  });
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      workspaceId: workspaceAls.getStore()?.workspaceId || "default",
      lastUpdatedAt: store.getState().lastUpdatedAt,
      sqlite: store.getPersistence().getDiagnostics()
    });
  });
  app.post("/api/workspaces/provision", (req, res) => {
    try {
      const requestedSlug = String(req.body?.workspaceSlug || "");
      const headerWs = req.headers["x-workspace-id"];
      const workspaceId = normalizeWorkspaceId(
        requestedSlug || (typeof headerWs === "string" ? headerWs : "")
      );
      if (workspaceId === "default") {
        return res.status(400).json({
          error: "\u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0645\u0639\u0631\u0651\u0641 \u0634\u0631\u0643\u0629 \u0645\u062E\u0635\u0635 \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 (3 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644)"
        });
      }
      const companyNameAr = String(req.body?.companyNameAr || "").trim();
      const companyNameEn = String(req.body?.companyNameEn || companyNameAr || "AqarPlus Workspace").trim();
      const adminNameAr = String(req.body?.adminNameAr || "").trim();
      const adminEmail = String(req.body?.adminEmail || "").trim().toLowerCase();
      const adminPhone = String(req.body?.adminPhone || "").trim();
      const password = String(req.body?.password || "");
      const pin = String(req.body?.pin || "").trim();
      if (!companyNameAr || !adminNameAr || !adminEmail || password.length < 8) {
        return res.status(400).json({
          error: "\u064A\u0644\u0632\u0645 \u0625\u062F\u062E\u0627\u0644 \u0627\u0633\u0645 \u0627\u0644\u0634\u0631\u0643\u0629\u060C \u0648\u0627\u0633\u0645 \u0627\u0644\u0645\u062F\u064A\u0631\u060C \u0648\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u060C \u0648\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0644\u0627 \u062A\u0642\u0644 \u0639\u0646 8 \u0623\u062D\u0631\u0641"
        });
      }
      if (pin && !/^\d{4,6}$/.test(pin)) {
        return res.status(400).json({ error: "\u0631\u0645\u0632 PIN \u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0643\u0648\u0646 \u0645\u0646 4 \u0625\u0644\u0649 6 \u0623\u0631\u0642\u0627\u0645 \u0641\u0642\u0637" });
      }
      const deviceName = String(req.body?.deviceName || "Web Terminal");
      const provisionedStore = provisionNewWorkspaceStore(workspaceId, {
        companyNameAr,
        companyNameEn,
        adminNameAr,
        adminEmail,
        adminPhone,
        password,
        pin: pin || void 0,
        deviceName
      });
      return workspaceAls.run({ workspaceId, store: provisionedStore }, () => {
        const adminUser = provisionedStore.getState().users[0];
        const { token, expiresAt } = issueUserSession(
          res,
          adminUser.id,
          adminUser.role,
          deviceName,
          workspaceId
        );
        res.status(201).json({
          ok: true,
          workspaceId,
          authenticated: true,
          user: adminUser,
          token,
          expiresAt,
          state: provisionedStore.getStateForUser(adminUser.id)
        });
      });
    } catch (e) {
      const msg = e.message || "\u062A\u0639\u0630\u0631 \u062A\u0623\u0633\u064A\u0633 \u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0639\u0645\u0644";
      res.status(msg.includes("\u0645\u0641\u0639\u0651\u0644\u0629 \u0645\u0633\u0628\u0642\u0627\u064B") ? 409 : 400).json({ error: msg });
    }
  });
  const finalizeAuthenticatedLogin = (req, res, wsStore, wsId, user, opts) => {
    const mfaReason = wsStore.evaluateMfaRequirement(user, opts.deviceId, {
      suspiciousAttempt: opts.suspiciousAttempt
    });
    const settings = wsStore.getState().settings;
    const companyBranding = {
      nameAr: settings.nameAr,
      nameEn: settings.nameEn,
      logoDataUrl: settings.logoDataUrl
    };
    if (mfaReason) {
      const challenge = wsStore.createMfaChallenge(user, mfaReason, opts.deviceName);
      const challengeToken = signEphemeralToken(
        {
          kind: "mfa",
          wid: wsId,
          uid: user.id,
          rememberMe: opts.rememberMe,
          deviceId: opts.deviceId || "",
          deviceName: opts.deviceName,
          appType: opts.appType,
          reason: mfaReason,
          exp: Date.now() + 10 * 60 * 1e3
        },
        getServerMasterSecret()
      );
      return res.json({
        authenticated: false,
        requiresMfa: true,
        reason: mfaReason,
        workspaceId: wsId,
        companyBranding,
        challengeToken,
        ...challenge
      });
    }
    const session = issueUserSession(
      res,
      user.id,
      user.role,
      opts.deviceName,
      wsId,
      opts.rememberMe,
      extractClientIp(req),
      {
        appType: opts.appType,
        deviceId: opts.deviceId,
        secureCookie: isSecureRequest(req)
      }
    );
    const userState = wsStore.getStateForUser(user.id);
    const landingNav = getRecommendedLandingNav(userState, user);
    const allowedNavs = getAllowedNavsForUser(userState, user);
    broadcastPresence(wsId);
    return res.json({
      authenticated: true,
      workspaceId: wsId,
      companyBranding,
      user,
      token: session.token,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      refreshExpiresAt: session.refreshExpiresAt,
      sessionId: session.sessionId,
      rememberMe: session.rememberMe,
      landingNav,
      allowedNavs,
      state: userState
    });
  };
  app.get("/api/auth/session", (req, res) => {
    const settings = store.getState().settings;
    const demoLoginEnabled = process.env.AQAR_DEMO_LOGIN === "true";
    const workspaceId = workspaceAls.getStore()?.workspaceId || "default";
    const companyBranding = {
      nameAr: settings.nameAr,
      nameEn: settings.nameEn,
      logoDataUrl: settings.logoDataUrl
    };
    const actor = resolveSessionActor(req);
    if (!actor) {
      return res.json({
        authenticated: false,
        workspaceId,
        workspaceExists: true,
        demoLoginEnabled,
        loginProfiles: demoLoginEnabled ? store.getLoginProfiles() : [],
        companyBranding
      });
    }
    const user = store.getState().users.find((u) => u.id === actor.userId);
    const userState = store.getStateForUser(actor.userId);
    res.json({
      authenticated: true,
      workspaceId,
      workspaceExists: true,
      user,
      token: actor.rawToken,
      sessionId: actor.sessionId,
      landingNav: getRecommendedLandingNav(userState, user),
      allowedNavs: getAllowedNavsForUser(userState, user),
      demoLoginEnabled,
      loginProfiles: demoLoginEnabled ? store.getLoginProfiles() : [],
      companyBranding
    });
  });
  app.post("/api/auth/login", (req, res) => {
    const ip = extractClientIp(req);
    const maxPerMin = Number(process.env.AQAR_AUTH_RATE_LIMIT_MAX || 45);
    const retrySec = checkAuthRateLimit(`login:${ip}`, maxPerMin, 6e4);
    if (retrySec) {
      return res.status(429).json({
        error: `\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u062D\u062F \u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u0624\u0642\u062A\u0627\u064B \u2014 \u062D\u0627\u0648\u0644 \u0628\u0639\u062F ${retrySec} \u062B\u0627\u0646\u064A\u0629`,
        retryAfterSec: retrySec
      });
    }
    const identifier = String(req.body?.identifier || req.body?.email || req.body?.userId || "");
    const password = String(req.body?.password || "");
    const rememberMe = req.body?.rememberMe !== false;
    const appType = req.body?.appType === "desktop" ? "desktop" : "web";
    const deviceId = req.body?.deviceId ? String(req.body.deviceId) : void 0;
    const deviceName = req.body?.deviceName ? String(req.body.deviceName) : req.headers["x-device-name"] ? decodeURIComponent(String(req.headers["x-device-name"])) : "Web Terminal";
    const autoDiscover = Boolean(req.body?.autoDiscover);
    const selectedWorkspaceId = req.body?.selectedWorkspaceId ? normalizeWorkspaceId(String(req.body.selectedWorkspaceId)) : void 0;
    if (!autoDiscover || selectedWorkspaceId) {
      const targetWsId = selectedWorkspaceId || (workspaceAls.getStore()?.workspaceId || "default");
      const targetStore = getExistingWorkspaceStore(targetWsId);
      if (!targetStore) {
        return res.status(401).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
      }
      return workspaceAls.run({ workspaceId: targetWsId, store: targetStore }, () => {
        try {
          const { user, hadSuspiciousFailures } = targetStore.authenticatePasswordDetailed(
            identifier,
            password,
            deviceName
          );
          return finalizeAuthenticatedLogin(req, res, targetStore, targetWsId, user, {
            rememberMe,
            deviceName,
            appType,
            deviceId,
            suspiciousAttempt: hadSuspiciousFailures
          });
        } catch (e) {
          const msg = e.message;
          return res.status(msg.includes("\u0642\u0641\u0644 \u0627\u0644\u062D\u0633\u0627\u0628") ? 429 : 401).json({ error: msg });
        }
      });
    }
    const workspaceIds = listAllWorkspaceIds();
    const verifiedMatches = [];
    let lastStatusError = null;
    for (const wsId of workspaceIds) {
      const wsStore = getExistingWorkspaceStore(wsId);
      if (!wsStore || !wsStore.hasUserWithIdentifier(identifier)) continue;
      try {
        const result = wsStore.authenticatePasswordDetailed(identifier, password, deviceName);
        verifiedMatches.push({
          workspaceId: wsId,
          wsStore,
          user: result.user,
          hadSuspiciousFailures: result.hadSuspiciousFailures
        });
      } catch (e) {
        const msg = e.message;
        if (msg.includes("\u0642\u0641\u0644 \u0627\u0644\u062D\u0633\u0627\u0628")) {
          lastStatusError = { status: 429, error: msg };
        } else if (msg.includes("\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0641\u0639\u064A\u0644") || msg.includes("\u0645\u0648\u0642\u0648\u0641") || msg.includes("\u0631\u0641\u0636") || msg.includes("\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629")) {
          lastStatusError = { status: 401, error: msg };
        }
      }
    }
    if (verifiedMatches.length === 0) {
      if (lastStatusError) {
        return res.status(lastStatusError.status).json({ error: lastStatusError.error });
      }
      return res.status(401).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
    }
    if (verifiedMatches.length === 1) {
      const m = verifiedMatches[0];
      return workspaceAls.run(
        { workspaceId: m.workspaceId, store: m.wsStore },
        () => finalizeAuthenticatedLogin(req, res, m.wsStore, m.workspaceId, m.user, {
          rememberMe,
          deviceName,
          appType,
          deviceId,
          suspiciousAttempt: m.hadSuspiciousFailures
        })
      );
    }
    const selectionToken = signEphemeralToken(
      {
        kind: "company_select",
        matches: verifiedMatches.map((m) => ({
          wid: m.workspaceId,
          uid: m.user.id,
          suspicious: m.hadSuspiciousFailures
        })),
        rememberMe,
        deviceId: deviceId || "",
        deviceName,
        appType,
        exp: Date.now() + 5 * 60 * 1e3
      },
      getServerMasterSecret()
    );
    return res.json({
      authenticated: false,
      requiresCompanySelection: true,
      selectionToken,
      companies: verifiedMatches.map((m) => {
        const s = m.wsStore.getState().settings;
        return {
          workspaceId: m.workspaceId,
          companyNameAr: s.nameAr,
          companyNameEn: s.nameEn,
          logoDataUrl: s.logoDataUrl,
          userNameAr: m.user.nameAr,
          roleLabelAr: m.user.roleLabelAr,
          roleLabelEn: m.user.roleLabelEn
        };
      })
    });
  });
  app.post("/api/auth/login-pin", (req, res) => {
    const ip = extractClientIp(req);
    const maxPerMin = Number(process.env.AQAR_AUTH_RATE_LIMIT_MAX || 45);
    const retrySec = checkAuthRateLimit(`pin:${ip}`, maxPerMin, 6e4);
    if (retrySec) {
      return res.status(429).json({
        error: `\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u062D\u062F \u0645\u062D\u0627\u0648\u0644\u0627\u062A PIN \u0645\u0624\u0642\u062A\u0627\u064B \u2014 \u062D\u0627\u0648\u0644 \u0628\u0639\u062F ${retrySec} \u062B\u0627\u0646\u064A\u0629`,
        retryAfterSec: retrySec
      });
    }
    const userIdOrIdentifier = String(req.body?.userId || req.body?.identifier || "");
    const pin = String(req.body?.pin || "");
    const rememberMe = req.body?.rememberMe !== false;
    const appType = req.body?.appType === "desktop" ? "desktop" : "web";
    const deviceId = req.body?.deviceId ? String(req.body.deviceId) : void 0;
    const deviceName = req.body?.deviceName ? String(req.body.deviceName) : "Web Terminal";
    const autoDiscover = Boolean(req.body?.autoDiscover);
    const selectedWorkspaceId = req.body?.selectedWorkspaceId ? normalizeWorkspaceId(String(req.body.selectedWorkspaceId)) : void 0;
    if (!autoDiscover || selectedWorkspaceId) {
      const targetWsId = selectedWorkspaceId || (workspaceAls.getStore()?.workspaceId || "default");
      const targetStore = getExistingWorkspaceStore(targetWsId);
      if (!targetStore) {
        return res.status(401).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648 \u0631\u0645\u0632 PIN \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
      }
      return workspaceAls.run({ workspaceId: targetWsId, store: targetStore }, () => {
        try {
          const user = targetStore.authenticatePin(userIdOrIdentifier, pin, deviceName);
          return finalizeAuthenticatedLogin(req, res, targetStore, targetWsId, user, {
            rememberMe,
            deviceName,
            appType,
            deviceId
          });
        } catch (e) {
          const msg = e.message;
          const isLockout = msg.includes("\u0642\u0641\u0644") || msg.includes("\u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631") || msg.includes("\u062A\u062C\u0627\u0648\u0632 \u0645\u062D\u0627\u0648\u0644\u0627\u062A");
          return res.status(isLockout ? 429 : 401).json({ error: msg });
        }
      });
    }
    const workspaceIds = listAllWorkspaceIds();
    const verifiedMatches = [];
    let lastStatusError = null;
    for (const wsId of workspaceIds) {
      const wsStore = getExistingWorkspaceStore(wsId);
      if (!wsStore || !wsStore.hasUserWithIdentifier(userIdOrIdentifier)) continue;
      try {
        const user = wsStore.authenticatePin(userIdOrIdentifier, pin, deviceName);
        verifiedMatches.push({ workspaceId: wsId, wsStore, user });
      } catch (e) {
        const msg = e.message;
        if (msg.includes("\u0642\u0641\u0644") || msg.includes("\u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631") || msg.includes("\u062A\u062C\u0627\u0648\u0632 \u0645\u062D\u0627\u0648\u0644\u0627\u062A")) {
          lastStatusError = { status: 429, error: msg };
        } else if (msg.includes("\u0645\u0639\u0637\u0651\u0644") || msg.includes("\u0645\u0624\u0642\u062A\u0627\u064B") || msg.includes("\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u0641\u0639\u064A\u0644") || msg.includes("\u0645\u0648\u0642\u0648\u0641")) {
          lastStatusError = { status: 401, error: msg };
        }
      }
    }
    if (verifiedMatches.length === 0) {
      if (lastStatusError) {
        return res.status(lastStatusError.status).json({ error: lastStatusError.error });
      }
      return res.status(401).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648 \u0631\u0645\u0632 PIN \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
    }
    if (verifiedMatches.length === 1) {
      const m = verifiedMatches[0];
      return workspaceAls.run(
        { workspaceId: m.workspaceId, store: m.wsStore },
        () => finalizeAuthenticatedLogin(req, res, m.wsStore, m.workspaceId, m.user, {
          rememberMe,
          deviceName,
          appType,
          deviceId
        })
      );
    }
    const selectionToken = signEphemeralToken(
      {
        kind: "company_select",
        matches: verifiedMatches.map((m) => ({ wid: m.workspaceId, uid: m.user.id, suspicious: false })),
        rememberMe,
        deviceId: deviceId || "",
        deviceName,
        appType,
        exp: Date.now() + 5 * 60 * 1e3
      },
      getServerMasterSecret()
    );
    return res.json({
      authenticated: false,
      requiresCompanySelection: true,
      selectionToken,
      companies: verifiedMatches.map((m) => {
        const s = m.wsStore.getState().settings;
        return {
          workspaceId: m.workspaceId,
          companyNameAr: s.nameAr,
          companyNameEn: s.nameEn,
          logoDataUrl: s.logoDataUrl,
          userNameAr: m.user.nameAr,
          roleLabelAr: m.user.roleLabelAr,
          roleLabelEn: m.user.roleLabelEn
        };
      })
    });
  });
  app.post("/api/auth/select-company", (req, res) => {
    try {
      const token = String(req.body?.selectionToken || "");
      const selectedWs = normalizeWorkspaceId(String(req.body?.workspaceId || ""));
      const payload = verifyEphemeralToken(token, getServerMasterSecret());
      if (!payload || payload.kind !== "company_select") {
        return res.status(401).json({ error: "\u0627\u0646\u062A\u0647\u062A \u0645\u0647\u0644\u0629 \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0634\u0631\u0643\u0629 \u2014 \u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B" });
      }
      const match = payload.matches.find((m) => m.wid === selectedWs);
      if (!match) {
        return res.status(403).json({ error: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0639\u0636\u0648\u064A\u0629 \u0645\u0635\u0631\u062D \u0628\u0647\u0627 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0634\u0631\u0643\u0629" });
      }
      const wsStore = getExistingWorkspaceStore(selectedWs);
      if (!wsStore) {
        return res.status(404).json({ error: "\u0645\u0633\u0627\u062D\u0629 \u0639\u0645\u0644 \u0627\u0644\u0634\u0631\u0643\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
      }
      return workspaceAls.run({ workspaceId: selectedWs, store: wsStore }, () => {
        const user = wsStore.getState().users.find(
          (u) => u.id === match.uid && u.active && (!u.accountStatus || u.accountStatus === "\u0646\u0634\u0637")
        );
        if (!user) {
          return res.status(403).json({ error: "\u0639\u0636\u0648\u064A\u062A\u0643 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0634\u0631\u0643\u0629 \u063A\u064A\u0631 \u0646\u0634\u0637\u0629 \u0623\u0648 \u062A\u0645 \u0625\u064A\u0642\u0627\u0641\u0647\u0627" });
        }
        return finalizeAuthenticatedLogin(req, res, wsStore, selectedWs, user, {
          rememberMe: req.body?.rememberMe !== void 0 ? Boolean(req.body.rememberMe) : payload.rememberMe,
          deviceName: String(req.body?.deviceName || payload.deviceName || "Web Terminal"),
          appType: payload.appType === "desktop" ? "desktop" : "web",
          deviceId: req.body?.deviceId ? String(req.body.deviceId) : payload.deviceId || void 0,
          suspiciousAttempt: Boolean(match.suspicious)
        });
      });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/auth/mfa/verify", (req, res) => {
    const ip = extractClientIp(req);
    const retrySec = checkAuthRateLimit(`mfa:${ip}`, 25, 6e4);
    if (retrySec) {
      return res.status(429).json({
        error: `\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u062D\u062F \u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u062A\u062D\u0642\u0642 \u2014 \u062D\u0627\u0648\u0644 \u0628\u0639\u062F ${retrySec} \u062B\u0627\u0646\u064A\u0629`,
        retryAfterSec: retrySec
      });
    }
    try {
      const challengeToken = String(req.body?.challengeToken || "");
      const code = String(req.body?.code || "");
      const trustDevice = Boolean(req.body?.trustDevice);
      const payload = verifyEphemeralToken(challengeToken, getServerMasterSecret());
      if (!payload || payload.kind !== "mfa") {
        return res.status(401).json({ error: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u062C\u0644\u0633\u0629 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0625\u0636\u0627\u0641\u064A \u2014 \u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B" });
      }
      const wsStore = getExistingWorkspaceStore(payload.wid);
      if (!wsStore) {
        return res.status(404).json({ error: "\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0639\u0645\u0644 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629" });
      }
      return workspaceAls.run({ workspaceId: payload.wid, store: wsStore }, () => {
        const deviceId = req.body?.deviceId ? String(req.body.deviceId) : payload.deviceId;
        const deviceName = String(req.body?.deviceName || payload.deviceName || "Web Terminal");
        const appType = payload.appType === "desktop" ? "desktop" : "web";
        const user = wsStore.verifyMfaChallenge(payload.uid, code, {
          trustDevice,
          deviceId,
          deviceName,
          appType
        });
        const session = issueUserSession(
          res,
          user.id,
          user.role,
          deviceName,
          payload.wid,
          payload.rememberMe,
          extractClientIp(req),
          {
            appType,
            deviceId,
            secureCookie: isSecureRequest(req)
          }
        );
        const settings = wsStore.getState().settings;
        const userState = wsStore.getStateForUser(user.id);
        broadcastPresence(payload.wid);
        return res.json({
          authenticated: true,
          workspaceId: payload.wid,
          companyBranding: {
            nameAr: settings.nameAr,
            nameEn: settings.nameEn,
            logoDataUrl: settings.logoDataUrl
          },
          user,
          token: session.token,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
          refreshExpiresAt: session.refreshExpiresAt,
          sessionId: session.sessionId,
          rememberMe: session.rememberMe,
          landingNav: getRecommendedLandingNav(userState, user),
          allowedNavs: getAllowedNavsForUser(userState, user),
          state: userState
        });
      });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/auth/mfa/resend", (req, res) => {
    try {
      const challengeToken = String(req.body?.challengeToken || "");
      const payload = verifyEphemeralToken(challengeToken, getServerMasterSecret());
      if (!payload || payload.kind !== "mfa") {
        return res.status(401).json({ error: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u062C\u0644\u0633\u0629 \u0627\u0644\u062A\u062D\u0642\u0642 \u2014 \u0623\u0639\u062F \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644" });
      }
      const wsStore = getExistingWorkspaceStore(payload.wid);
      if (!wsStore) {
        return res.status(404).json({ error: "\u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0639\u0645\u0644 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629" });
      }
      return workspaceAls.run({ workspaceId: payload.wid, store: wsStore }, () => {
        const user = wsStore.getState().users.find((u) => u.id === payload.uid && u.active);
        if (!user) return res.status(401).json({ error: "\u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D" });
        const challenge = wsStore.createMfaChallenge(user, payload.reason || "new_device", payload.deviceName);
        return res.json({ ok: true, ...challenge });
      });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/auth/refresh", (req, res) => {
    try {
      const workspaceId = workspaceAls.getStore()?.workspaceId || "default";
      const cookies = parseCookies(req.headers["cookie"]);
      const rawRefreshToken = String(req.body?.refreshToken || cookies[REFRESH_COOKIE_NAME] || "").trim();
      if (!rawRefreshToken) {
        return res.status(401).json({ error: "\u0631\u0645\u0632 \u062A\u062C\u062F\u064A\u062F \u0627\u0644\u062C\u0644\u0633\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", code: "AUTH_REQUIRED" });
      }
      const dbSession = store.getPersistence().findSessionByRefreshToken(rawRefreshToken);
      if (!dbSession) {
        res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
        res.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });
        return res.status(401).json({ error: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u062C\u0644\u0633\u0629 \u2014 \u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B", code: "AUTH_REQUIRED" });
      }
      const user = store.getState().users.find(
        (u) => u.id === dbSession.userId && u.active && (!u.accountStatus || u.accountStatus === "\u0646\u0634\u0637")
      );
      if (!user) {
        store.getPersistence().revokeOtherSessionsForUser(dbSession.userId);
        return res.status(401).json({ error: "\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u0623\u0648 \u0627\u0646\u062A\u0647\u062A \u0639\u0636\u0648\u064A\u062A\u0647", code: "AUTH_REQUIRED" });
      }
      const now = Date.now();
      const accessTtlMs = dbSession.rememberMe !== false ? ACCESS_TOKEN_TTL_MS : SESSION_SHORT_TTL_MS;
      const exp = now + accessTtlMs;
      const newExpiresAt = new Date(exp).toISOString();
      const newRefreshExpiresAt = new Date(now + SESSION_TTL_MS).toISOString();
      const newRefreshToken = crypto4.randomBytes(32).toString("hex");
      const sid = dbSession.sessionId || `ses-${crypto4.randomBytes(8).toString("hex")}`;
      const newAccessToken = signSessionToken(
        { sid, uid: user.id, wid: workspaceId, role: user.role, deviceName: dbSession.deviceName, iat: now, exp },
        store.getSessionSecret()
      );
      const rotated = store.getPersistence().rotateSessionTokens(rawRefreshToken, newAccessToken, newRefreshToken, newExpiresAt, newRefreshExpiresAt);
      if (!rotated) {
        return res.status(401).json({ error: "\u062A\u0639\u0630\u0631 \u062A\u062C\u062F\u064A\u062F \u0627\u0644\u062C\u0644\u0633\u0629 \u2014 \u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B", code: "AUTH_REQUIRED" });
      }
      const secureFlag = isSecureRequest(req);
      res.cookie(SESSION_COOKIE_NAME, newAccessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: secureFlag,
        path: "/",
        ...dbSession.rememberMe !== false ? { maxAge: accessTtlMs } : {}
      });
      if (dbSession.rememberMe !== false) {
        res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, {
          httpOnly: true,
          sameSite: "lax",
          secure: secureFlag,
          path: "/",
          maxAge: SESSION_TTL_MS
        });
      }
      const userState = store.getStateForUser(user.id);
      return res.json({
        ok: true,
        authenticated: true,
        workspaceId,
        token: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
        refreshExpiresAt: newRefreshExpiresAt,
        rememberMe: dbSession.rememberMe !== false,
        user,
        landingNav: getRecommendedLandingNav(userState, user),
        allowedNavs: getAllowedNavsForUser(userState, user),
        state: userState
      });
    } catch (e) {
      return res.status(401).json({ error: e.message, code: "AUTH_REQUIRED" });
    }
  });
  app.post("/api/auth/logout", (req, res) => {
    const rawToken = extractSessionToken(req);
    if (rawToken) {
      store.getPersistence().revokeSession(rawToken);
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });
    res.json({ ok: true });
  });
  app.post("/api/auth/recovery/request", (req, res) => {
    const ip = extractClientIp(req);
    const retrySec = checkAuthRateLimit(`rec:${ip}`, 15, 6e4);
    if (retrySec) {
      return res.status(429).json({
        error: `\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 ${retrySec} \u062B\u0627\u0646\u064A\u0629 \u0642\u0628\u0644 \u0637\u0644\u0628 \u0631\u0645\u0632 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u062C\u062F\u064A\u062F`,
        retryAfterSec: retrySec
      });
    }
    try {
      const identifier = String(req.body?.email || req.body?.identifier || "");
      const purpose = req.body?.purpose === "pin_reset" ? "pin_reset" : "password_reset";
      const deviceName = req.body?.deviceName ? String(req.body.deviceName) : "Web Recovery";
      const autoDiscover = Boolean(req.body?.autoDiscover);
      if (autoDiscover) {
        for (const wsId of listAllWorkspaceIds()) {
          const wsStore = getExistingWorkspaceStore(wsId);
          if (wsStore && wsStore.hasUserWithIdentifier(identifier)) {
            const result2 = wsStore.requestCredentialRecovery(identifier, purpose, deviceName);
            return res.json({ ...result2, workspaceId: wsId });
          }
        }
      }
      const result = store.requestCredentialRecovery(identifier, purpose, deviceName);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/auth/recovery/reset", (req, res) => {
    const ip = extractClientIp(req);
    const retrySec = checkAuthRateLimit(`rec-reset:${ip}`, 20, 6e4);
    if (retrySec) {
      return res.status(429).json({
        error: `\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 ${retrySec} \u062B\u0627\u0646\u064A\u0629 \u0642\u0628\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u0627\u064B`,
        retryAfterSec: retrySec
      });
    }
    try {
      const emailOrIdentifier = String(req.body?.email || req.body?.identifier || "");
      const purpose = req.body?.purpose === "pin_reset" ? "pin_reset" : "password_reset";
      const code = String(req.body?.code || "");
      const newSecret = String(req.body?.newSecret || req.body?.newPassword || req.body?.newPin || "");
      const confirmSecret = String(req.body?.confirmSecret || req.body?.confirmPassword || req.body?.confirmPin || "");
      const deviceName = req.body?.deviceName ? String(req.body.deviceName) : "Web Recovery";
      const autoDiscover = Boolean(req.body?.autoDiscover);
      const targetWsId = req.body?.workspaceId ? normalizeWorkspaceId(String(req.body.workspaceId)) : void 0;
      let targetStore = store;
      let resolvedWsId = workspaceAls.getStore()?.workspaceId || "default";
      if (targetWsId) {
        const specific = getExistingWorkspaceStore(targetWsId);
        if (specific) {
          targetStore = specific;
          resolvedWsId = targetWsId;
        }
      } else if (autoDiscover) {
        for (const wsId of listAllWorkspaceIds()) {
          const wsStore = getExistingWorkspaceStore(wsId);
          if (wsStore && wsStore.hasUserWithIdentifier(emailOrIdentifier)) {
            targetStore = wsStore;
            resolvedWsId = wsId;
            break;
          }
        }
      }
      const result = workspaceAls.run(
        { workspaceId: resolvedWsId, store: targetStore },
        () => targetStore.completeCredentialRecovery(
          { emailOrIdentifier, purpose, code, newSecret, confirmSecret },
          deviceName
        )
      );
      if (result.terminateSessions) {
        disconnectUserWebSockets(result.userId, resolvedWsId, "\u062A\u0645\u062A \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u2014 \u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B");
      }
      res.json({ ok: true, purpose, workspaceId: resolvedWsId });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.get("/api/public/invitations/:token", (req, res) => {
    try {
      const data = store.getPublicInvitationByToken(String(req.params.token));
      res.status(data.valid ? 200 : 400).json(data);
    } catch (e) {
      res.status(400).json({ valid: false, reason: e.message });
    }
  });
  app.post("/api/public/invitations/:token/accept", (req, res) => {
    try {
      const result = store.acceptEmployeeInvitation(String(req.params.token), {
        verificationCode: String(req.body?.verificationCode || ""),
        password: String(req.body?.password || ""),
        confirmPassword: String(req.body?.confirmPassword || ""),
        pin: req.body?.pin ? String(req.body.pin) : void 0,
        acceptedTerms: Boolean(req.body?.acceptedTerms),
        deviceName: req.body?.deviceName ? String(req.body.deviceName) : "Web Invite Portal"
      });
      broadcastStateChange(result.user.id, `\u062A\u0641\u0639\u064A\u0644 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0648\u0638\u0641 ${result.user.nameAr} \u0639\u0628\u0631 \u0627\u0644\u062F\u0639\u0648\u0629`);
      res.json({
        ok: true,
        user: {
          id: result.user.id,
          nameAr: result.user.nameAr,
          nameEn: result.user.nameEn,
          email: result.user.email,
          username: result.user.username,
          roleLabelAr: result.user.roleLabelAr,
          accountStatus: result.user.accountStatus
        },
        company: result.company
      });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.use("/api", (req, res, next) => {
    const fullPath = `/api${req.path}`;
    if (isPublicApiPath(fullPath)) {
      return next();
    }
    const actor = resolveSessionActor(req);
    if (!actor) {
      return res.status(401).json({
        error: "\u0627\u0646\u062A\u0647\u062A \u0627\u0644\u062C\u0644\u0633\u0629 \u0623\u0648 \u0644\u0645 \u064A\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u2014 \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u0644\u0644\u0645\u062A\u0627\u0628\u0639\u0629",
        code: "AUTH_REQUIRED"
      });
    }
    req.authActor = actor;
    next();
  });
  app.post("/api/auth/logout-all", (req, res) => {
    try {
      const actor = getActor(req);
      const revokedCount = store.getPersistence().revokeOtherSessionsForUser(actor.userId);
      disconnectUserWebSockets(
        actor.userId,
        actor.workspaceId,
        "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C \u0645\u0646 \u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0628\u0646\u0627\u0621\u064B \u0639\u0644\u0649 \u0637\u0644\u0628\u0643"
      );
      res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
      res.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });
      res.json({ ok: true, revokedCount });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.get("/api/auth/me", (req, res) => {
    try {
      const actor = getActor(req);
      const me = store.getAuthMePayload(actor.userId);
      const userState = store.getStateForUser(actor.userId);
      res.json({
        authenticated: true,
        ...me,
        sessionId: actor.sessionId,
        allowedNavs: getAllowedNavsForUser(userState, me.user),
        landingNav: getRecommendedLandingNav(userState, me.user)
      });
    } catch (e) {
      sendApiError(res, e, 401);
    }
  });
  app.post("/api/auth/credentials", (req, res) => {
    try {
      const actor = getActor(req);
      const targetUserId = String(req.body?.targetUserId || actor.userId);
      store.updateUserCredentials(
        actor.userId,
        targetUserId,
        {
          currentPassword: req.body?.currentPassword,
          newPassword: req.body?.newPassword,
          newPin: req.body?.newPin
        },
        actor.deviceName
      );
      res.json({ ok: true, state: store.getStateForUser(actor.userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.get("/api/state", (req, res) => {
    try {
      const { userId } = getActor(req);
      res.json({
        state: store.getStateForUser(userId),
        presence: getPresenceList()
      });
    } catch (e) {
      res.status(401).json({ error: e.message });
    }
  });
  app.post("/api/properties", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const property = store.createProperty(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0639\u0642\u0627\u0631 ${property.nameAr}`);
      res.status(201).json({ property, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/units", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const unit = store.createUnit(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0648\u062D\u062F\u0629 ${unit.unitNumber}`);
      res.status(201).json({ unit, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.patch("/api/units/:id/status", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const unit = store.updateUnitStatus(userId, String(req.params.id), req.body.status, req.body.reason, deviceName);
      broadcastStateChange(userId, `\u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629 \u0627\u0644\u0648\u062D\u062F\u0629 ${unit.unitNumber} \u0625\u0644\u0649 ${unit.status}`);
      res.json({ unit, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/units/:id/link-tenant", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const unit = store.linkTenantToUnit(userId, String(req.params.id), req.body.tenantId, deviceName);
      broadcastStateChange(userId, `\u0631\u0628\u0637 \u0625\u062F\u0627\u0631\u064A \u0644\u0644\u0648\u062D\u062F\u0629 ${unit.unitNumber}`);
      res.json({ unit, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/tenants", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const tenant = store.createTenant(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${tenant.nameAr}`);
      res.status(201).json({ tenant, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.delete("/api/tenants/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      store.deleteTenant(userId, String(req.params.id), deviceName);
      broadcastStateChange(userId, `\u062D\u0630\u0641 \u0645\u0644\u0641 \u0645\u0633\u062A\u0623\u062C\u0631`);
      res.json({ ok: true, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/leads", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const lead = store.createLead(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u0633\u062C\u064A\u0644 \u0639\u0645\u064A\u0644 \u0645\u062D\u062A\u0645\u0644 ${lead.nameAr}`);
      res.status(201).json({ lead, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/contracts", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.createContract(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0639\u0642\u062F ${result.contract.internalNumber}`);
      res.status(201).json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.patch("/api/contracts/:id/ejar", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const contract = store.updateContractEjarStatus(
        userId,
        String(req.params.id),
        req.body.ejarNumber,
        req.body.ejarStatus,
        req.body.lifecycleStatus,
        deviceName
      );
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0639\u0642\u062F ${contract.internalNumber}`);
      res.json({ contract, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/handovers", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const handover = store.createHandoverInspection(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u0625\u0646\u0634\u0627\u0621 \u0645\u062D\u0636\u0631 ${handover.type}`);
      res.status(201).json({ handover, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/handovers/:id/approve", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const handover = store.approveHandover(userId, String(req.params.id), req.body.nextUnitStatus, deviceName);
      broadcastStateChange(userId, `\u0627\u0639\u062A\u0645\u0627\u062F \u0645\u062D\u0636\u0631 \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645 \u0648\u0627\u0644\u0625\u062E\u0644\u0627\u0621`);
      res.json({ handover, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/payments", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const idempotencyKey = String(req.headers["x-idempotency-key"] || req.body.idempotencyKey || "") || `srv-${Date.now()}-${Math.random()}`;
      const payment = store.recordPayment(userId, { ...req.body, idempotencyKey }, deviceName);
      broadcastStateChange(userId, `\u0625\u0635\u062F\u0627\u0631 \u0633\u0646\u062F \u0642\u0628\u0636 ${payment.receiptNumber} (${payment.amount.toLocaleString()} \u0631.\u0633)`);
      res.status(201).json({ payment, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/payments/:id/reverse", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const payment = store.reverseReceipt(userId, String(req.params.id), req.body.reason, deviceName);
      broadcastStateChange(userId, `\u0639\u0643\u0633 \u0627\u0644\u0633\u0646\u062F ${payment.receiptNumber}`);
      res.json({ payment, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/expenses", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const expense = store.createExpense(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u0633\u062C\u064A\u0644 \u0645\u0635\u0631\u0648\u0641 ${expense.expenseNumber}`);
      res.status(201).json({ expense, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/expenses/:id/decision", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const expense = store.decideExpense(userId, String(req.params.id), req.body.decision, req.body.reason, deviceName);
      broadcastStateChange(userId, `\u0642\u0631\u0627\u0631 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0645\u0635\u0631\u0648\u0641 ${expense.expenseNumber}: ${expense.approvalStatus}`);
      res.json({ expense, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/tickets", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const ticket = store.createTicket(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u0641\u062A\u062D \u0628\u0644\u0627\u063A \u0635\u064A\u0627\u0646\u0629 ${ticket.ticketNumber}`);
      res.status(201).json({ ticket, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.patch("/api/tickets/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const ticket = store.updateTicket(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0628\u0644\u0627\u063A \u0627\u0644\u0635\u064A\u0627\u0646\u0629 ${ticket.ticketNumber}`);
      res.json({ ticket, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/tasks", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const task = store.createTask(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u0625\u0636\u0627\u0641\u0629 \u0645\u0647\u0645\u0629: ${task.title}`);
      res.status(201).json({ task, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.patch("/api/tasks/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const task = store.updateTask(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0645\u0647\u0645\u0629: ${task.title}`);
      res.json({ task, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/tasks/:id/reassign", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const task = store.reassignTask(
        userId,
        String(req.params.id),
        String(req.body.assignedTo || ""),
        req.body.reason ? String(req.body.reason) : void 0,
        deviceName
      );
      broadcastStateChange(userId, `\u062A\u062D\u0648\u064A\u0644 \u0645\u0647\u0645\u0629: ${task.title}`);
      res.json({ task, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/tasks/:id/review", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const task = store.reviewTask(
        userId,
        String(req.params.id),
        req.body.decision === "reject" ? "reject" : "approve",
        req.body.reason ? String(req.body.reason) : void 0,
        deviceName
      );
      broadcastStateChange(userId, `\u0645\u0631\u0627\u062C\u0639\u0629 \u0648\u0627\u0639\u062A\u0645\u0627\u062F \u0645\u0647\u0645\u0629: ${task.title}`);
      res.json({ task, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/communications", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const log = store.addCommunication(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u0633\u062C\u064A\u0644 \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 ${log.targetName}`);
      res.status(201).json({ log, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/documents", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const doc = store.addDocument(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u0623\u0631\u0634\u0641\u0629 \u0645\u0633\u062A\u0646\u062F ${doc.title}`);
      res.status(201).json({ doc, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/vendors", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const vendor = store.createVendor(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0648\u0631\u062F ${vendor.nameAr}`);
      res.status(201).json({ vendor, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/permissions/toggle", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const rolePermissions = store.toggleRolePermission(userId, req.body.role, req.body.permission, deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u062F\u0648\u0631 ${req.body.role}`);
      res.json({ rolePermissions, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/notifications/read", (req, res) => {
    try {
      const { userId } = getActor(req);
      store.markNotificationsRead(userId);
      res.json({ ok: true, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/backups", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const backup = store.createBackup(
        userId,
        req.body.label,
        deviceName,
        req.body?.encryptPassword ? String(req.body.encryptPassword) : void 0
      );
      broadcastStateChange(userId, `\u0625\u0646\u0634\u0627\u0621 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629`);
      res.status(201).json({ backup, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/backups/:id/restore", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const mode = req.body?.mode === "merge" ? "merge" : "replace";
      const password = req.body?.password ? String(req.body.password) : void 0;
      store.restoreBackup(userId, String(req.params.id), deviceName, mode, password);
      broadcastStateChange(userId, `\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629 (${mode === "merge" ? "\u062F\u0645\u062C \u0630\u0643\u064A" : "\u0627\u0633\u062A\u0628\u062F\u0627\u0644 \u0643\u0627\u0645\u0644"})`);
      res.json({ ok: true, mode, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/reminders/rules", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const rule = store.createReminderRule(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u0625\u0636\u0627\u0641\u0629 \u0642\u0627\u0639\u062F\u0629 \u062C\u062F\u0648\u0644\u0629 \u062A\u0646\u0628\u064A\u0647 \u0625\u064A\u062C\u0627\u0631: ${rule.nameAr}`);
      res.status(201).json({ rule, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.patch("/api/reminders/rules/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const rule = store.toggleReminderRule(userId, String(req.params.id), Boolean(req.body.enabled), deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u062C\u062F\u0648\u0644\u0629 \u0627\u0644\u062A\u0646\u0628\u064A\u0647 ${rule.nameAr}`);
      res.json({ rule, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.delete("/api/reminders/rules/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      store.deleteReminderRule(userId, String(req.params.id), deviceName);
      broadcastStateChange(userId, `\u062D\u0630\u0641 \u0642\u0627\u0639\u062F\u0629 \u062A\u0646\u0628\u064A\u0647 \u0625\u064A\u062C\u0627\u0631`);
      res.json({ ok: true, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/reminders/run", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const logs = store.runReminderScheduler(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u0634\u063A\u064A\u0644 \u062A\u0646\u0628\u064A\u0647\u0627\u062A \u0627\u0644\u0625\u064A\u062C\u0627\u0631 (${logs.length} \u0625\u0634\u0639\u0627\u0631 \u0645\u0631\u0633\u0644)`);
      res.json({ logs, count: logs.length, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/companies", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const company = store.createCompany(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0634\u0631\u0643\u0629 ${company.nameAr}`);
      res.status(201).json({ company, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.patch("/api/settings", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const settings = store.updateSettings(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u0648\u0627\u0644\u0639\u0645\u0644\u0627\u062A`);
      res.json({ settings, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/documents/ocr", async (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = await extractDocumentDataWithGemini({
        dataUrl: String(req.body?.dataUrl || ""),
        mimeType: req.body?.mimeType ? String(req.body.mimeType) : void 0,
        fileName: req.body?.fileName ? String(req.body.fileName) : void 0,
        categoryHint: req.body?.categoryHint ? String(req.body.categoryHint) : void 0
      });
      const matches = store.findOcrEntityMatches(result.extracted);
      if (req.body?.autoSync) {
        const synced = store.syncOcrToEntities(
          userId,
          {
            extracted: result.extracted,
            targetTenantId: req.body?.targetTenantId ? String(req.body.targetTenantId) : void 0,
            targetPropertyId: req.body?.targetPropertyId ? String(req.body.targetPropertyId) : void 0,
            applyTenant: req.body?.applyTenant,
            applyProperty: req.body?.applyProperty,
            createMissing: req.body?.createMissing
          },
          deviceName
        );
        broadcastStateChange(userId, `\u0627\u0633\u062A\u062E\u0631\u0627\u062C OCR \u0648\u0631\u0628\u0637 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0622\u0644\u064A\u0627\u064B \u0628\u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631\u064A\u0646 \u0648\u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A`);
        return res.json({
          ...result,
          matches,
          syncSummary: synced.summary,
          state: store.getStateForUser(userId)
        });
      }
      res.json({ ...result, matches });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/documents/sync-ocr", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      if (!req.body?.extracted) {
        throw new Error("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0627\u0644\u0636\u0648\u0626\u064A (extracted) \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u0639\u0645\u0644\u064A\u0629 \u0627\u0644\u0631\u0628\u0637");
      }
      const synced = store.syncOcrToEntities(
        userId,
        {
          extracted: req.body.extracted,
          docId: req.body?.docId ? String(req.body.docId) : void 0,
          targetTenantId: req.body?.targetTenantId ? String(req.body.targetTenantId) : void 0,
          targetPropertyId: req.body?.targetPropertyId ? String(req.body.targetPropertyId) : void 0,
          applyTenant: req.body?.applyTenant,
          applyProperty: req.body?.applyProperty,
          createMissing: req.body?.createMissing
        },
        deviceName
      );
      broadcastStateChange(userId, `\u0631\u0628\u0637 \u0646\u062A\u0627\u0626\u062C OCR \u0628\u062D\u0642\u0648\u0644 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631\u064A\u0646 \u0648\u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A`);
      res.json({ ...synced, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/documents/:id/access", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const doc = store.recordDocumentAccess(userId, String(req.params.id), req.body.action || "\u0645\u0639\u0627\u064A\u0646\u0629", deviceName);
      broadcastStateChange(userId, `\u0633\u062C\u0644 \u0648\u0635\u0648\u0644 \u0644\u0644\u0645\u0633\u062A\u0646\u062F ${doc.title}`);
      res.json({ doc, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/documents/:id/ocr", async (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const docExisting = store.getState().documents.find((d) => d.id === String(req.params.id));
      const dataUrl = String(req.body?.dataUrl || docExisting?.dataUrl || "");
      const result = await extractDocumentDataWithGemini({
        dataUrl,
        fileName: docExisting?.fileName,
        categoryHint: docExisting?.category
      });
      const doc = store.attachDocumentOcr(userId, String(req.params.id), result.extracted, result.rawText, deviceName);
      const matches = store.findOcrEntityMatches(result.extracted);
      let syncSummary;
      if (req.body?.autoSync !== false) {
        const synced = store.syncOcrToEntities(
          userId,
          {
            extracted: result.extracted,
            docId: doc.id,
            createMissing: false
          },
          deviceName
        );
        syncSummary = synced.summary;
      }
      broadcastStateChange(userId, `\u062A\u062D\u0644\u064A\u0644 OCR \u0644\u0644\u0645\u0633\u062A\u0646\u062F ${doc.title}`);
      res.json({
        doc,
        extracted: result.extracted,
        matches,
        syncSummary,
        state: store.getStateForUser(userId)
      });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/owners/:id/transfer", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.recordOwnerTransfer(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u0648\u064A\u0644 \u0645\u0633\u062A\u062D\u0642\u0627\u062A \u0644\u0644\u0645\u0627\u0644\u0643 ${result.owner.nameAr}`);
      res.status(201).json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/contracts/:id/renew", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.renewContract(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u062C\u062F\u064A\u062F \u0627\u0644\u0639\u0642\u062F ${result.contract.internalNumber}`);
      res.status(201).json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/purchase-orders", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const po = store.createPurchaseOrder(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u0625\u0646\u0634\u0627\u0621 \u0637\u0644\u0628 \u0634\u0631\u0627\u0621 ${po.poNumber}`);
      res.status(201).json({ po, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.patch("/api/purchase-orders/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const po = store.updatePurchaseOrder(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0637\u0644\u0628 \u0634\u0631\u0627\u0621 ${po.poNumber}`);
      res.json({ po, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/decisions", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const decision = store.createDecision(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u0625\u0635\u062F\u0627\u0631 \u0642\u0631\u0627\u0631 \u0625\u062F\u0627\u0631\u064A ${decision.decisionNumber}`);
      res.status(201).json({ decision, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.patch("/api/tenants/:id/checklist", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const tenant = store.updateTenantChecklist(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0642\u0627\u0626\u0645\u0629 \u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u062A\u0633\u0643\u064A\u0646 \u0644\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${tenant.nameAr}`);
      res.json({ tenant, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/import/bulk", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const summary = store.bulkImportRecords(userId, req.body.type, req.body.rows, deviceName);
      broadcastStateChange(userId, `\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u062C\u0645\u0627\u0639\u064A \u0645\u0646 Excel (${summary.inserted} \u0633\u062C\u0644)`);
      res.status(201).json({ ...summary, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/workspace/reset-fresh", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const fresh = store.resetToFreshWorkspace(userId, deviceName);
      broadcastStateChange(userId, "\u062A\u0647\u064A\u0626\u0629 \u0645\u0633\u0627\u062D\u0629 \u0639\u0645\u0644 \u0646\u0638\u064A\u0641\u0629 \u0639\u0628\u0631 \u0627\u0644\u0625\u0639\u062F\u0627\u062F \u0627\u0644\u0623\u0648\u0644\u064A");
      res.json({ ok: true, state: fresh });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/archive/move", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.archiveEntity(userId, req.body, deviceName);
      broadcastStateChange(userId, result.summary);
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/archive/restore", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.restoreArchivedEntity(userId, req.body, deviceName);
      broadcastStateChange(userId, result.restoredSummary);
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      const msg = e.message || "";
      const isConflict = msg.startsWith("CONFLICT_ACTIVE_CONTRACT:");
      res.status(isConflict ? 409 : 400).json({ error: msg, conflict: isConflict });
    }
  });
  app.post("/api/archive/run-scheduled", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.runScheduledArchival(userId, deviceName);
      broadcastStateChange(userId, result.summary);
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/archive/filters", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const filter = store.saveArchiveFilter(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u062D\u0641\u0638 \u0641\u0644\u062A\u0631 \u0627\u0644\u0623\u0631\u0634\u064A\u0641 "${filter.name}"`);
      res.status(201).json({ filter, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.delete("/api/archive/filters/:id", (req, res) => {
    try {
      const { userId } = getActor(req);
      store.deleteArchiveFilter(userId, String(req.params.id));
      res.json({ ok: true, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/team/users", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const user = store.createStaffUser(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u0625\u0636\u0627\u0641\u0629 \u0645\u0648\u0638\u0641 \u062C\u062F\u064A\u062F: ${user.nameAr}`);
      res.status(201).json({ user, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.patch("/api/team/users/:id", (req, res) => {
    try {
      const { userId, deviceName, workspaceId } = getActor(req);
      const user = store.updateStaffUser(userId, String(req.params.id), req.body, deviceName);
      if (req.body?.active === false) {
        store.getPersistence().revokeOtherSessionsForUser(user.id);
        disconnectUserWebSockets(user.id, workspaceId, "\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u0628\u0648\u0627\u0633\u0637\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629");
      }
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0645\u0644\u0641 \u0627\u0644\u0645\u0648\u0638\u0641: ${user.nameAr}`);
      res.json({ user, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.delete("/api/team/users/:id", (req, res) => {
    try {
      const { userId, deviceName, workspaceId } = getActor(req);
      const targetId = String(req.params.id);
      const result = store.deleteStaffUser(userId, targetId, deviceName);
      store.getPersistence().revokeOtherSessionsForUser(targetId);
      disconnectUserWebSockets(targetId, workspaceId, "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u0628\u0648\u0627\u0633\u0637\u0629 \u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0638\u0627\u0645");
      broadcastStateChange(userId, "\u062D\u0630\u0641 \u062D\u0633\u0627\u0628 \u0645\u0633\u062A\u062E\u062F\u0645");
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/team/employees", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const originHeader = req.headers.origin;
      const hostHeader = req.headers.host;
      const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
      const originUrl = typeof originHeader === "string" && originHeader.startsWith("http") ? originHeader : hostHeader ? `${proto}://${hostHeader}` : "http://localhost:3000";
      const result = store.createEmployeeWithInvite(userId, req.body, originUrl, deviceName);
      broadcastStateChange(userId, `\u0625\u0636\u0627\u0641\u0629 \u0645\u0648\u0638\u0641 \u0648\u062F\u0639\u0648\u0629 \u0627\u0646\u0636\u0645\u0627\u0645: ${result.user.nameAr}`);
      res.status(201).json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.patch("/api/team/employees/:id", (req, res) => {
    try {
      const { userId, deviceName, workspaceId } = getActor(req);
      const result = store.updateEmployeeAdmin(userId, String(req.params.id), req.body, deviceName);
      if (result.terminateSessions) {
        disconnectUserWebSockets(
          result.user.id,
          workspaceId,
          `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u0633\u0627\u0628 \u0625\u0644\u0649 (${result.user.accountStatus || "\u0645\u0648\u0642\u0648\u0641"})`
        );
      }
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0645\u0644\u0641 \u0627\u0644\u0645\u0648\u0638\u0641: ${result.user.nameAr}`);
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/team/invitations/:id/resend", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const originHeader = req.headers.origin;
      const hostHeader = req.headers.host;
      const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
      const originUrl = typeof originHeader === "string" && originHeader.startsWith("http") ? originHeader : hostHeader ? `${proto}://${hostHeader}` : "http://localhost:3000";
      const result = store.resendEmployeeInvitation(
        userId,
        String(req.params.id),
        req.body?.channel,
        originUrl,
        deviceName
      );
      broadcastStateChange(userId, `\u0625\u0639\u0627\u062F\u0629 \u0625\u0631\u0633\u0627\u0644 \u062F\u0639\u0648\u0629 ${result.invitation.fullName}`);
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/team/invitations/:id/cancel", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const invitation = store.cancelEmployeeInvitation(userId, String(req.params.id), deviceName);
      broadcastStateChange(userId, `\u0625\u0644\u063A\u0627\u0621 \u062F\u0639\u0648\u0629 ${invitation.fullName}`);
      res.json({ invitation, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/roles", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const role = store.createCustomRole(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u0625\u0646\u0634\u0627\u0621 \u062F\u0648\u0631 \u0645\u062E\u0635\u0635: ${role.nameAr}`);
      res.status(201).json({ role, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.patch("/api/roles/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const role = store.updateCustomRole(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u0645\u062E\u0635\u0635: ${role.nameAr}`);
      res.json({ role, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.delete("/api/roles/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.deleteCustomRole(userId, String(req.params.id), deviceName);
      broadcastStateChange(userId, "\u062D\u0630\u0641 \u062F\u0648\u0631 \u0645\u062E\u0635\u0635");
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/roles/module-matrix", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.updateRoleModuleMatrix(
        userId,
        req.body?.role,
        req.body?.modulePermissions || {},
        deviceName
      );
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0645\u0635\u0641\u0648\u0641\u0629 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0644\u0644\u062F\u0648\u0631 ${req.body?.role}`);
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.get("/api/profile/sessions", (req, res) => {
    try {
      const actor = getActor(req);
      const sessions = store.getPersistence().listActiveSessionsForUser(actor.userId, actor.rawToken);
      res.json({ sessions });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.delete("/api/profile/sessions/:sessionId", (req, res) => {
    try {
      const actor = getActor(req);
      const sessionId = String(req.params.sessionId);
      const revoked = store.getPersistence().revokeSessionById(actor.userId, sessionId);
      disconnectUserWebSockets(
        actor.userId,
        actor.workspaceId,
        "\u062A\u0645 \u0625\u0646\u0647\u0627\u0621 \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629 \u0645\u0646 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062E\u0635\u064A",
        sessionId
      );
      const sessions = store.getPersistence().listActiveSessionsForUser(actor.userId, actor.rawToken);
      res.json({ ok: true, revoked, sessions });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.patch("/api/profile/me", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const user = store.updateOwnProfile(userId, req.body || {}, deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062E\u0635\u064A: ${user.nameAr}`);
      res.json({ user, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/profile/verify-contact/request", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const type = req.body?.type === "phone" ? "phone" : "email";
      const newValue = String(req.body?.newValue || "");
      const result = store.requestContactVerification(userId, type, newValue, deviceName);
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/profile/verify-contact/confirm", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const type = req.body?.type === "phone" ? "phone" : "email";
      const code = String(req.body?.code || "");
      const user = store.confirmContactVerification(userId, type, code, deviceName);
      broadcastStateChange(userId, `\u062A\u0623\u0643\u064A\u062F \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0644\u0644\u0645\u0648\u0638\u0641 ${user.nameAr}`);
      res.json({ ok: true, user, state: store.getStateForUser(userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/profile/change-credentials", (req, res) => {
    try {
      const actor = getActor(req);
      store.updateUserCredentials(
        actor.userId,
        actor.userId,
        {
          currentPassword: req.body?.currentPassword,
          currentPin: req.body?.currentPin,
          newPassword: req.body?.newPassword,
          newPin: req.body?.newPin
        },
        actor.deviceName
      );
      if (req.body?.newPassword) {
        store.getPersistence().revokeOtherSessionsForUser(actor.userId, actor.rawToken);
        disconnectUserWebSockets(
          actor.userId,
          actor.workspaceId,
          "\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u2014 \u062A\u0645 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062C\u0644\u0633\u0627\u062A \u0627\u0644\u0623\u062E\u0631\u0649 \u0644\u062F\u0648\u0627\u0639\u064A \u0627\u0644\u0623\u0645\u0627\u0646",
          void 0,
          actor.sessionId
        );
      }
      res.json({ ok: true, state: store.getStateForUser(actor.userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/profile/pin-toggle", (req, res) => {
    try {
      const actor = getActor(req);
      const enabled = Boolean(req.body?.enabled);
      const currentPassword = String(req.body?.currentPassword || "");
      const newPin = req.body?.newPin ? String(req.body.newPin) : void 0;
      const user = store.togglePinEnabled(actor.userId, enabled, currentPassword, newPin, actor.deviceName);
      res.json({ ok: true, user, state: store.getStateForUser(actor.userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.post("/api/profile/two-factor", (req, res) => {
    try {
      const actor = getActor(req);
      const enabled = Boolean(req.body?.enabled);
      const currentPassword = String(req.body?.currentPassword || "");
      const user = store.toggleTwoFactor(actor.userId, enabled, currentPassword, actor.deviceName);
      if (enabled && req.body?.deviceId) {
        store.getPersistence().registerOrTouchTrustedDevice(
          actor.userId,
          String(req.body.deviceId),
          String(req.body?.deviceName || actor.deviceName || "Web Terminal"),
          req.body?.appType === "desktop" ? "desktop" : "web"
        );
      }
      res.json({ ok: true, user, state: store.getStateForUser(actor.userId) });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.get("/api/profile/trusted-devices", (req, res) => {
    try {
      const actor = getActor(req);
      const currentDeviceId = typeof req.headers["x-device-id"] === "string" ? req.headers["x-device-id"] : void 0;
      const devices = store.getPersistence().listTrustedDevices(actor.userId, currentDeviceId);
      res.json({ devices });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.delete("/api/profile/trusted-devices/:id", (req, res) => {
    try {
      const actor = getActor(req);
      const revoked = store.getPersistence().revokeTrustedDevice(actor.userId, String(req.params.id));
      const currentDeviceId = typeof req.headers["x-device-id"] === "string" ? req.headers["x-device-id"] : void 0;
      const devices = store.getPersistence().listTrustedDevices(actor.userId, currentDeviceId);
      res.json({ ok: true, revoked, devices });
    } catch (e) {
      sendApiError(res, e, 400);
    }
  });
  app.patch("/api/team/security-policy", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const securityPolicy = store.updateSecurityPolicy(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u0623\u0645\u0627\u0646 \u0648\u0643\u0644\u0645\u0627\u062A \u0627\u0644\u0645\u0631\u0648\u0631`);
      res.json({ securityPolicy, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/team/conflicts/:id/resolve", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const resolution = req.body.resolution === "\u062A\u0645 \u0627\u0644\u0625\u0628\u0642\u0627\u0621 \u0639\u0644\u0649 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629" ? "\u062A\u0645 \u0627\u0644\u0625\u0628\u0642\u0627\u0621 \u0639\u0644\u0649 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629" : "\u062A\u0645 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0623\u062D\u062F\u062B";
      const conflict = store.resolveSyncConflict(userId, String(req.params.id), resolution, deviceName);
      broadcastStateChange(userId, `\u0645\u0639\u0627\u0644\u062C\u0629 \u062A\u0639\u0627\u0631\u0636 \u0645\u0632\u0627\u0645\u0646\u0629: ${conflict.entityLabel}`);
      res.json({ conflict, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/team/sessions/terminate", (req, res) => {
    try {
      const { userId, deviceName, ipAddress } = getActor(req);
      const state = store.getState();
      const actor = state.users.find((u) => u.id === userId);
      if (!actor || !(state.rolePermissions[actor.role] || []).includes("manage_users")) {
        throw new Error("\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062C\u0644\u0633\u0627\u062A \u0639\u0646 \u0628\u064F\u0639\u062F");
      }
      const targetUserId = req.body.userId ? String(req.body.userId) : void 0;
      const targetSessionId = req.body.sessionId ? String(req.body.sessionId) : void 0;
      const reason = String(req.body.reason || "\u0625\u0646\u0647\u0627\u0621 \u062C\u0644\u0633\u0629 \u0625\u062F\u0627\u0631\u064A \u0639\u0646 \u0628\u064F\u0639\u062F");
      let terminatedCount = 0;
      for (const [client, session] of Array.from(activeSessions.entries())) {
        const matchesSession = targetSessionId && session.sessionId === targetSessionId;
        const matchesUser = !targetSessionId && targetUserId && session.userId === targetUserId;
        if (matchesSession || matchesUser) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: "session:terminated",
                userId: session.userId,
                sessionId: session.sessionId,
                reason,
                terminatedBy: actor.nameAr
              })
            );
          }
          activeSessions.delete(client);
          try {
            client.close(4001, "Terminated by administrator");
          } catch {
          }
          terminatedCount += 1;
        }
      }
      if (targetUserId) {
        store.recordLoginEvent({
          userId: targetUserId,
          deviceName: deviceName || "\u0644\u0648\u062D\u0629 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0641\u0631\u064A\u0642",
          ipAddress,
          method: "\u062A\u0633\u062C\u064A\u0644 \u062E\u0631\u0648\u062C \u0639\u0646 \u0628\u064F\u0639\u062F",
          success: true
        });
      }
      broadcastPresence();
      broadcastStateChange(userId, `\u0625\u0646\u0647\u0627\u0621 ${terminatedCount} \u062C\u0644\u0633\u0629 \u0646\u0634\u0637\u0629 \u0639\u0646 \u0628\u064F\u0639\u062F`);
      res.json({
        ok: true,
        terminatedCount,
        presence: getPresenceList(),
        state: store.getStateForUser(userId)
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/security/logout-others", (req, res) => {
    try {
      const { userId, deviceName, ipAddress } = getActor(req);
      const keepSessionId = req.body?.keepSessionId ? String(req.body.keepSessionId) : void 0;
      let terminatedCount = 0;
      for (const [client, session] of Array.from(activeSessions.entries())) {
        if (session.userId === userId && (!keepSessionId || session.sessionId !== keepSessionId)) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: "session:terminated",
                userId: session.userId,
                sessionId: session.sessionId,
                reason: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C \u0645\u0646 \u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0623\u062E\u0631\u0649 \u0639\u0628\u0631 \u0645\u0631\u0643\u0632 \u0627\u0644\u0623\u0645\u0627\u0646"
              })
            );
          }
          activeSessions.delete(client);
          try {
            client.close(4001, "Logged out from security center");
          } catch {
          }
          terminatedCount += 1;
        }
      }
      store.recordLoginEvent({
        userId,
        deviceName: deviceName || "\u0645\u0631\u0643\u0632 \u0627\u0644\u0623\u0645\u0627\u0646",
        ipAddress,
        method: "\u062A\u0633\u062C\u064A\u0644 \u062E\u0631\u0648\u062C \u0639\u0646 \u0628\u064F\u0639\u062F",
        success: true
      });
      broadcastPresence();
      broadcastStateChange(userId, `\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C \u0645\u0646 \u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0623\u062E\u0631\u0649 (${terminatedCount} \u062C\u0644\u0633\u0629)`);
      res.json({ ok: true, terminatedCount, presence: getPresenceList(), state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.get("/api/backups/:id/preview", (req, res) => {
    try {
      const password = req.query.password ? String(req.query.password) : void 0;
      const preview = store.previewBackup(String(req.params.id), password);
      res.json(preview);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/backups/:id/preview", (req, res) => {
    try {
      const password = req.body?.password ? String(req.body.password) : void 0;
      const preview = store.previewBackup(String(req.params.id), password);
      res.json(preview);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/system/clear-temp", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const settings = store.clearTempCache(userId, deviceName);
      broadcastStateChange(userId, "\u062A\u0646\u0638\u064A\u0641 \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0645\u0624\u0642\u062A\u0629 \u0645\u0646 \u0645\u0631\u0643\u0632 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A");
      res.json({ settings, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/templates", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const template = store.createTemplate(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u0625\u0646\u0634\u0627\u0621 \u0642\u0627\u0644\u0628 \u062A\u0648\u0627\u0635\u0644: ${template.name}`);
      res.status(201).json({ template, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.patch("/api/templates/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const template = store.updateTemplate(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0642\u0627\u0644\u0628 \u0627\u0644\u062A\u0648\u0627\u0635\u0644: ${template.name}`);
      res.json({ template, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.delete("/api/templates/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      store.deleteTemplate(userId, String(req.params.id), deviceName);
      broadcastStateChange(userId, "\u062D\u0630\u0641 \u0642\u0627\u0644\u0628 \u062A\u0648\u0627\u0635\u0644");
      res.json({ ok: true, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/templates/:id/use", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.useTemplate(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u0625\u0631\u0633\u0627\u0644 \u0631\u0633\u0627\u0644\u0629 \u0644\u0642\u0627\u0644\u0628 ${result.template?.name || ""}`);
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/templates/import", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const templates = Array.isArray(req.body?.templates) ? req.body.templates : [];
      const count = store.importTemplates(userId, templates, deviceName);
      broadcastStateChange(userId, `\u0627\u0633\u062A\u064A\u0631\u0627\u062F ${count} \u0642\u0627\u0644\u0628 \u062A\u0648\u0627\u0635\u0644`);
      res.status(201).json({ count, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.patch("/api/tenants/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const tenant = store.updateTenant(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0645\u0644\u0641 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${tenant.nameAr}`);
      res.json({ tenant, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/tenants/:id/notes", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const note = store.addTenantViolationNote(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u0633\u062C\u064A\u0644 \u0645\u0644\u0627\u062D\u0638\u0629/\u0645\u062E\u0627\u0644\u0641\u0629 \u0644\u0645\u0644\u0641 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631`);
      res.status(201).json({ note, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/tenants/:id/appointments", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const log = store.scheduleTenantAppointment(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u062C\u062F\u0648\u0644\u0629 \u0645\u0648\u0639\u062F \u0645\u0639 \u0627\u0644\u0645\u0633\u062A\u0623\u062C\u0631 ${log.targetName}`);
      res.status(201).json({ log, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.patch("/api/contracts/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const contract = store.updateContractDetails(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u0642\u062F ${contract.internalNumber}`);
      res.json({ contract, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.patch("/api/expenses/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const expense = store.updateOrCancelExpense(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0635\u0631\u0648\u0641 ${expense.expenseNumber}`);
      res.json({ expense, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.patch("/api/vendors/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const vendor = store.updateVendor(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0645\u0644\u0641 \u0648\u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u0645\u0648\u0631\u062F ${vendor.nameAr}`);
      res.json({ vendor, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/supplier-invoices", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const invoice = store.createSupplierInvoice(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u0633\u062C\u064A\u0644 \u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0648\u0631\u062F ${invoice.invoiceCode}`);
      res.status(201).json({ invoice, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.patch("/api/supplier-invoices/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const invoice = store.updateSupplierInvoice(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0645\u0648\u0631\u062F ${invoice.invoiceCode}`);
      res.json({ invoice, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/recurring-expenses", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const rule = store.createRecurringExpense(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u0625\u0636\u0627\u0641\u0629 \u0645\u0635\u0631\u0648\u0641 \u062F\u0648\u0631\u064A: ${rule.title}`);
      res.status(201).json({ rule, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.patch("/api/recurring-expenses/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const rule = store.toggleRecurringExpense(userId, String(req.params.id), Boolean(req.body.enabled), deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0627\u0644\u062F\u0648\u0631\u064A: ${rule.title}`);
      res.json({ rule, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/recurring-expenses/generate", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const created = store.generateDueRecurringExpenses(userId, req.body?.month, deviceName);
      broadcastStateChange(userId, `\u062A\u0648\u0644\u064A\u062F ${created.length} \u0645\u0633\u0648\u062F\u0629 \u0645\u0635\u0631\u0648\u0641 \u062F\u0648\u0631\u064A`);
      res.status(201).json({ created, count: created.length, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/property-budgets", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const budget = store.upsertPropertyBudget(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0645\u064A\u0632\u0627\u0646\u064A\u0629 \u0627\u0644\u0639\u0642\u0627\u0631 \u0644\u0634\u0647\u0631 ${budget.month}`);
      res.status(201).json({ budget, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.patch("/api/leads/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const lead = store.updateLead(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0647\u062A\u0645 ${lead.nameAr}`);
      res.json({ lead, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/leads/:id/escalate", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const escalation = store.escalateLead(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `\u0625\u0631\u0633\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0647\u062A\u0645 ${escalation.snapshot.leadName} \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629`);
      res.status(201).json({ escalation, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/lead-escalations/:id/decision", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const escalation = store.decideLeadEscalation(
        userId,
        String(req.params.id),
        { decision: req.body.decision, decisionNotes: req.body.decisionNotes, isToken: false },
        deviceName
      );
      broadcastStateChange(userId, `\u0642\u0631\u0627\u0631 \u0637\u0644\u0628 \u0627\u0644\u0645\u0647\u062A\u0645 ${escalation.requestCode}: ${escalation.status}`);
      res.json({ escalation, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/leads/:id/convert", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.convertLeadToTenant(userId, String(req.params.id), deviceName);
      broadcastStateChange(userId, `\u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u0645\u0647\u062A\u0645 ${result.lead.nameAr} \u0625\u0644\u0649 \u0645\u0633\u062A\u0623\u062C\u0631`);
      res.status(201).json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/meters/readings", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const reading = store.createMeterReading(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u062A\u0633\u062C\u064A\u0644 \u0642\u0631\u0627\u0621\u0629 \u0639\u062F\u0627\u062F ${reading.meterType} (${reading.meterNumber})`);
      res.status(201).json({ reading, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.get("/api/public/prospect-context", (_req, res) => {
    const full = store.getState();
    res.json({
      companyName: full.settings.nameAr,
      companyPhone: full.settings.phone,
      properties: full.properties.filter((p) => p.status === "\u0646\u0634\u0637").map((p) => ({
        id: p.id,
        nameAr: p.nameAr,
        city: p.city,
        district: p.district,
        units: full.units.filter((u) => u.propertyId === p.id && u.status === "\u0634\u0627\u063A\u0631\u0629").map((u) => ({
          id: u.id,
          unitNumber: u.unitNumber,
          unitType: u.unitType,
          rooms: u.rooms,
          suggestedMonthlyRent: u.suggestedMonthlyRent
        }))
      }))
    });
  });
  app.post("/api/public/leads", (req, res) => {
    try {
      const result = store.createPublicLead(req.body);
      broadcastStateChange("public-portal", `\u062A\u0633\u062C\u064A\u0644 \u0645\u0647\u062A\u0645 \u062C\u062F\u064A\u062F \u0639\u0628\u0631 \u0627\u0644\u0631\u0627\u0628\u0637 \u0627\u0644\u0639\u0627\u0645: ${result.lead.nameAr}`);
      res.status(201).json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.get("/api/public/lead-decision/:token", (req, res) => {
    try {
      const data = store.getLeadEscalationByToken(String(req.params.token));
      res.json(data);
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  });
  app.post("/api/public/lead-decision/:token", (req, res) => {
    try {
      const escalation = store.decideLeadEscalation(
        null,
        String(req.params.token),
        { decision: req.body.decision, decisionNotes: req.body.decisionNotes, isToken: true },
        "External Owner Link"
      );
      broadcastStateChange(escalation.recipientId, `\u0642\u0631\u0627\u0631 \u0627\u0644\u0645\u0627\u0644\u0643 (${escalation.requestCode}): ${escalation.status}`);
      res.json({ escalation });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.get("/api/sync/delta", (req, res) => {
    try {
      const { userId } = getActor(req);
      const since = req.query.since ? String(req.query.since) : void 0;
      res.json(store.getSyncDelta(userId, since));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/sync/batch", async (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const operations = Array.isArray(req.body?.operations) ? req.body.operations : [];
      const clientLastUpdatedAt = req.body?.clientLastUpdatedAt ? String(req.body.clientLastUpdatedAt) : void 0;
      const beforeRevision = store.getState().syncRevision || 1;
      let uploaded = 0;
      let skippedDuplicates = 0;
      const newConflicts = [];
      const errors = [];
      for (const op of operations) {
        if (!op || typeof op.endpoint !== "string" || !op.endpoint.startsWith("/api/")) continue;
        const operationId = String(op.operationId || op.idempotencyKey || "");
        const opMethod = op.method === "PATCH" ? "PATCH" : op.method === "DELETE" ? "DELETE" : "POST";
        const evalRes = store.evaluateSyncOperationConflict(
          userId,
          {
            operationId,
            idempotencyKey: String(op.idempotencyKey || operationId),
            method: opMethod,
            endpoint: op.endpoint,
            entityType: op.entityType ? String(op.entityType) : void 0,
            entityId: op.entityId ? String(op.entityId) : void 0,
            baseRevision: typeof op.baseRevision === "number" ? op.baseRevision : void 0,
            descriptionAr: String(op.descriptionAr || ""),
            queuedAt: String(op.queuedAt || (/* @__PURE__ */ new Date()).toISOString()),
            deviceName: op.deviceName || deviceName
          },
          clientLastUpdatedAt
        );
        if (evalRes.skipDuplicate) {
          skippedDuplicates += 1;
          continue;
        }
        if (evalRes.conflict) {
          newConflicts.push(evalRes.conflict);
        }
        const dispatchRes = dispatchSyncOperation(store, {
          method: opMethod,
          endpoint: op.endpoint,
          body: op.body && typeof op.body === "object" ? op.body : {},
          userId,
          deviceName: op.deviceName || deviceName,
          idempotencyKey: String(op.idempotencyKey || operationId),
          operationId
        });
        if (!dispatchRes.ok) {
          errors.push(`${op.descriptionAr || op.endpoint}: ${String(dispatchRes.data?.error || dispatchRes.status)}`);
        } else {
          if (operationId) {
            store.recordSyncOperationResult(
              operationId,
              userId,
              opMethod,
              op.endpoint,
              dispatchRes.data,
              dispatchRes.entityType,
              dispatchRes.entityId
            );
          }
          uploaded += 1;
        }
      }
      if (uploaded > 0 || newConflicts.length > 0) {
        broadcastStateChange(userId, `\u0645\u0632\u0627\u0645\u0646\u0629 \u062F\u0641\u0639\u064A\u0629 (${uploaded} \u0639\u0645\u0644\u064A\u0629${newConflicts.length ? ` \xB7 ${newConflicts.length} \u062A\u0639\u0627\u0631\u0636` : ""})`);
      }
      res.json({
        uploaded,
        skippedDuplicates,
        conflictsDetected: newConflicts.length,
        newConflicts,
        errors,
        previousRevision: beforeRevision,
        syncedAt: (/* @__PURE__ */ new Date()).toISOString(),
        state: store.getStateForUser(userId)
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/reports/schedules", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const schedule = store.createScheduledReport(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u062C\u062F\u0648\u0644\u0629 \u062A\u0642\u0631\u064A\u0631 \u062A\u0644\u0642\u0627\u0626\u064A: ${schedule.title}`);
      res.status(201).json({ schedule, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.delete("/api/reports/schedules/:id", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.deleteScheduledReport(userId, String(req.params.id), deviceName);
      broadcastStateChange(userId, "\u0625\u0632\u0627\u0644\u0629 \u062C\u062F\u0648\u0644\u0629 \u062A\u0642\u0631\u064A\u0631");
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/reports/schedules/:id/run", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const schedule = store.runScheduledReportNow(userId, String(req.params.id), deviceName);
      broadcastStateChange(userId, `\u062A\u0634\u063A\u064A\u0644 \u062A\u0642\u0631\u064A\u0631 \u0645\u062C\u062F\u0648\u0644: ${schedule.title}`);
      res.json({ schedule, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/zatca/invoices", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const invoice = store.createZatcaInvoice(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u0625\u0635\u062F\u0627\u0631 \u0641\u0627\u062A\u0648\u0631\u0629 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0629 ZATCA (${invoice.invoiceNumber})`);
      res.status(201).json({ invoice, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/reports/favorites", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const preset = store.saveFavoriteReport(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u062D\u0641\u0638 \u062A\u0642\u0631\u064A\u0631 \u0645\u0641\u0636\u0644: ${preset.title}`);
      res.status(201).json({ preset, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.delete("/api/reports/favorites/:id", (req, res) => {
    try {
      const { userId } = getActor(req);
      const result = store.deleteFavoriteReport(userId, String(req.params.id));
      broadcastStateChange(userId, "\u0625\u0632\u0627\u0644\u0629 \u062A\u0642\u0631\u064A\u0631 \u0645\u0641\u0636\u0644");
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/search/filters", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const filter = store.saveSharedSearchFilter(userId, req.body, deviceName);
      broadcastStateChange(userId, `\u062D\u0641\u0638 \u0641\u0644\u062A\u0631 \u0628\u062D\u062B: ${filter.name}`);
      res.status(201).json({ filter, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.delete("/api/search/filters/:id", (req, res) => {
    try {
      const { userId } = getActor(req);
      const result = store.deleteSharedSearchFilter(userId, String(req.params.id));
      broadcastStateChange(userId, "\u062D\u0630\u0641 \u0641\u0644\u062A\u0631 \u0628\u062D\u062B");
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.get("/api/storage/status", (_req, res) => {
    try {
      res.json(store.getStorageStatus());
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.post("/api/storage/validate-path", (req, res) => {
    try {
      const result = store.validateStorageFolder(String(req.body?.path || ""));
      res.json(result);
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });
  app.post("/api/storage/sync-folders", (req, res) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.syncFoldersToDisk(userId, deviceName);
      broadcastStateChange(userId, "\u0645\u0632\u0627\u0645\u0646\u0629 \u0648\u062A\u0647\u064A\u0626\u0629 \u0645\u062C\u0644\u062F\u0627\u062A \u0627\u0644\u062A\u062E\u0632\u064A\u0646 \u0627\u0644\u0645\u062D\u0644\u064A\u0629 \u0639\u0644\u0649 \u0627\u0644\u0642\u0631\u0635");
      res.json({ ...result, status: store.getStorageStatus(), state: store.getStateForUser(userId) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
}
async function startServer(customPort) {
  const listenPort = customPort && Number.isFinite(customPort) ? customPort : PORT;
  const app = express();
  handleApi(app);
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("error", (err) => {
    console.error("WebSocketServer error:", err.message);
  });
  wss.on("connection", (ws, req) => {
    const fallbackSessionId = `ses-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const ipAddress = extractClientIp(req);
    const workspaceId = resolveRequestWorkspaceId(req);
    const wsStore = getExistingWorkspaceStore(workspaceId);
    const upgradeActor = wsStore ? resolveSessionActor(req) : null;
    activeSessions.set(ws, {
      ws,
      workspaceId,
      sessionId: upgradeActor?.sessionId || fallbackSessionId,
      userId: upgradeActor?.userId || "",
      authenticated: Boolean(upgradeActor),
      deviceName: upgradeActor?.deviceName || "Web Browser",
      ipAddress,
      connectedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (upgradeActor && wsStore) {
      ws.send(
        JSON.stringify({
          type: "state:init",
          state: wsStore.getStateForUser(upgradeActor.userId),
          presence: getPresenceList(workspaceId)
        })
      );
      broadcastPresence(workspaceId);
    }
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === "session:identify") {
          const prev = activeSessions.get(ws);
          const msgWsId = prev?.workspaceId || workspaceId;
          const activeWsStore = getExistingWorkspaceStore(msgWsId);
          const verifiedActor = activeWsStore ? resolveSessionActor(req, typeof msg.token === "string" ? msg.token : void 0) : null;
          if (!verifiedActor || !activeWsStore) {
            ws.send(JSON.stringify({ type: "auth:required", error: "\u062C\u0644\u0633\u0629 WebSocket \u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0647\u0627" }));
            return;
          }
          const nextDevice = String(msg.deviceName || verifiedActor.deviceName || "Web Browser");
          activeSessions.set(ws, {
            ws,
            workspaceId: msgWsId,
            sessionId: verifiedActor.sessionId || prev?.sessionId || fallbackSessionId,
            userId: verifiedActor.userId,
            authenticated: true,
            deviceName: nextDevice,
            ipAddress,
            connectedAt: prev?.connectedAt || (/* @__PURE__ */ new Date()).toISOString()
          });
          ws.send(
            JSON.stringify({
              type: "state:init",
              state: activeWsStore.getStateForUser(verifiedActor.userId),
              presence: getPresenceList(msgWsId)
            })
          );
          broadcastPresence(msgWsId);
        }
      } catch {
      }
    });
    ws.on("close", () => {
      const closed = activeSessions.get(ws);
      activeSessions.delete(ws);
      broadcastPresence(closed?.workspaceId || workspaceId);
    });
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distDir = process.env.AQARPLUS_DIST_DIR ? path3.resolve(process.env.AQARPLUS_DIST_DIR) : path3.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path3.join(distDir, "index.html"));
    });
  }
  server.on("error", (err) => {
    console.error("HTTP Server error:", err);
  });
  server.on("close", () => {
    for (const st of workspaceStores.values()) {
      st.getPersistence().close();
    }
    workspaceStores.clear();
  });
  await new Promise((resolve) => {
    server.listen(listenPort, "0.0.0.0", () => {
      console.log(`AqarPlus centralized server running on http://0.0.0.0:${listenPort}`);
      resolve();
    });
  });
  return { server, port: listenPort };
}
if (process.env.AQARPLUS_NO_AUTO_START !== "1") {
  startServer();
}
export {
  startServer
};
