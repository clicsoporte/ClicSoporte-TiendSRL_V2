
/**
 * @fileoverview This file defines the core TypeScript types used throughout the application.
 */

import type { LucideIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import type { Database } from "better-sqlite3";

/**
 * Represents a user account in the system.
 */
export type User = {
  id: number;
  name: string;
  email: string;
  password?: string;
  phone: string;
  whatsapp: string;
  avatar: string;
  role: string;
  recentActivity: string;
  securityQuestion?: string;
  securityAnswer?: string;
  forcePasswordChange?: boolean;
};

/**
 * Represents the company's general information.
 */
export type Company = {
    name: string;
    taxId: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string;
    systemName?: string;
    systemVersion?: string;
    publicUrl?: string;
    quotePrefix: string;
    nextQuoteNumber: number;
    decimalPlaces: number;
    quoterShowTaxId?: boolean;
    searchDebounceTime?: number;
    syncWarningHours?: number;
    internalHourCost?: number; // Cost to the company for 1 hour of internal labor
    importMode: 'file' | 'sql';
    lastSyncTimestamp?: string | null;
    customerFilePath?: string;
    productFilePath?: string;
    exemptionFilePath?: string;
    stockFilePath?: string;
    cabysFilePath?: string;
    supportPackages: SupportPackage[];
    servicesCatalog: Service[];
};

export type SupportPackage = {
  id: string;
  name: string;
  includedServices: string[];
  excludedServices: string[];
  defaultHours?: number;
  roundingMultiple: number; // In minutes (e.g., 15, 30, 60)
  graceMinutes: number; // In minutes
  basePrice?: number; // Base commercial price for reference
};

export type Service = {
  id: string;
  name: string;
  price?: number; // Base price
  billingType: 'hour' | 'task';
};

/**
 * Represents a tool or module accessible from a dashboard.
 */
export type Tool = {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  bgColor: string;
  textColor: string;
  adminOnly?: boolean;
  permission?: string;
};

/**
 * Defines a user role and its associated permissions.
 */
export type Role = {
  id: string;
  name: string;
  permissions: string[];
};

/**
 * Represents a contact person within a customer or provider company.
 */
export type CustomerContact = {
    id: string;
    name: string;
    email: string;
    department: string;
    position: string;
    officePhone: string;
    whatsapp: string;
    phone: string; // Generic phone field
    branch: string;
};

/**
 * Represents a customer. Can be imported or created manually.
 */
export type Customer = {
    id: string;
    name: string;
    commercialName?: string; // Manual alias/commercial name
    address: string;
    phone: string;
    taxId: string;
    currency: string;
    creditLimit: number;
    paymentCondition: string;
    salesperson: string;
    active: 'S' | 'N';
    email: string;
    electronicDocEmail: string;
    isManual?: boolean;
    contacts: CustomerContact[];
    supportPackageId?: string | null;
    // Real-time enrichment
    consumedHours?: number;
    availableHours?: number;
    // Hacienda data
    taxRegime?: string;
    taxStatus?: string;
    isTaxMoroso?: boolean;
    isTaxOmiso?: boolean;
    taxAdministration?: string;
    taxActivities?: string; // JSON array of activities
    // Geographic data
    provinceId?: number | null;
    cantonId?: number | null;
    districtId?: number | null;
    telegramChatId?: string | null;
    // Administrative Status
    isBlocked?: boolean;
    blockedReason?: string | null;
};

/**
 * Represents a support contract for a client.
 */
export type Contract = {
    id: number;
    consecutive: string;
    name: string;
    customerId: string;
    startDate: string;
    endDate: string;
    status: 'active' | 'inactive' | 'expired';
    includedServices: string[]; 
    excludedServices: string[]; 
    monthlyHours: number;
    price: number;
    currency: string;
    notes?: string;
    autoRenew: boolean;
    createdAt: string;
};

/**
 * Represents an external service provider.
 */
export type ThirdPartyProvider = {
    id: number;
    name: string;
    email: string;
    phone: string;
    specialty: string;
    notes?: string;
    createdAt: string;
    services?: ProviderService[];
    geoRates?: ProviderGeoRate[];
    contacts?: CustomerContact[];
};

export type ProviderService = {
    id: number;
    providerId: number;
    serviceId: string;
    buyPriceRemote: number;
    marginRemote: number;
    taxRate: number;
    sellPriceRemote: number;
    buyPriceOnSite: number;
    marginOnSite: number;
    sellPriceOnSite: number;
};

export type ProviderGeoRate = {
    id: number;
    providerId: number;
    provinceId: number;
    cantonId?: number;
    districtId?: number;
    buyTravelPrice: number;
    marginTravel: number;
    taxRate: number;
    sellTravelPrice: number;
    locationName: string; // Flattened name for UI
};

export type Province = { id: number; name: string; };
export type Canton = { id: number; provinceId: number; name: string; };
export type District = { id: number; cantonId: number; name: string; };

/**
 * Represents a product or article, typically imported from an ERP system.
 */
export type Product = {
    id: string;
    description: string;
    classification: string;
    lastEntry: string;
    active: 'S' | 'N';
    notes: string;
    unit: string;
    isBasicGood: 'S' | 'N';
    cabys: string;
};

/**
 * Represents a single line item within a quote.
 */
export type QuoteLine = {
    id: string;
    product: Product;
    quantity: number;
    price: number;
    tax: number;
    displayQuantity: string;
    displayPrice: string;
};

export type ExchangeRateApiResponse = {
    compra?: { fecha: string; valor: number; };
    venta: { fecha: string; valor: number; };
}

/**
 * Represents a saved quote draft.
 */
export type QuoteDraft = {
    id: string;
    createdAt: string;
    userId: number;
    customerId: string | null;
    customer?: Customer | null;
    lines: Omit<QuoteLine, 'displayQuantity' | 'displayPrice'>[];
    totals: {
        subtotal: number;
        totalTaxes: number;
        total: number;
    };
    notes: string;
    currency: string;
    exchangeRate: number | null;
    purchaseOrderNumber?: string;
    customerDetails?: string;
    deliveryAddress?: string;
    deliveryDate?: string;
    sellerName?: string;
    sellerType?: string;
    quoteDate?: string;
    validUntilDate?: string;
    paymentTerms?: string;
    creditDays?: number;
}

/**
* Represents a system log entry.
*/
export type LogEntry = {
    id: number;
    timestamp: string;
    type: "INFO" | "WARN" | "ERROR";
    message: string;
    details?: Record<string, unknown>;
};

export type ApiSettings = {
    exchangeRateApi: string;
    haciendaExemptionApi: string;
    haciendaTributariaApi: string;
};

export type EmailSettings = {
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPass: string;
    recoveryEmailSubject?: string;
    recoveryEmailBody?: string;
};

export type DatabaseModule = {
    id: string;
    name: string;
    dbFile: string;
    initFn?: (db: Database) => Promise<void> | void;
    migrationFn?: (db: Database) => Promise<void> | void;
};

export type Exemption = {
    code: string;
    description: string;
    customer: string;
    authNumber: string;
    startDate: string;
    endDate: string;
    percentage: number;
    docType: string;
    institutionName: string;
    institutionCode: string;
};

export type ExemptionLaw = {
  docType: string;
  institutionName: string;
  authNumber: string | null;
};

// --- Dashboard & Analytics Types ---

export type DashboardStats = {
    activeTickets: number;
    activeProjects: number;
    expiringContracts: number;
    urgentTickets: number;
};

export type TimeEntry = {
    id: number;
    ticketId: number;
    userId: number;
    startTime: string;
    endTime?: string | null;
    duration: number | null; // actual milliseconds
    billableDuration: number | null; // rounded milliseconds according to package
    billingStatus: 'pending' | 'invoiced' | 'void';
    externalInvoiceNumber?: string | null;
    notes?: string | null;
    isBillable: boolean;
    createdAt: string;
};

export type Kpi = { total: number; [key: string]: number; };

export type VolumeKpi = {
    label: string;
    value: number;
};

export type AnalyticsData = {
    tickets: Kpi;
    projects: Kpi;
    timeTracking: {
        totalHours: number;
        totalBillable: number;
        totalNonBillable: number;
        totalAmountInvoiced: number;
        totalAmountPending: number;
        byUser: { userId: number; userName: string; billable: number; nonBillable: number; amount: number }[];
    };
    byCustomer: VolumeKpi[];
    byTopic: VolumeKpi[];
    byService: VolumeKpi[];
    byBillingType: VolumeKpi[];
};

// --- TI Project Management Types ---

export type ProjectStatus = 'planning' | 'execution' | 'testing' | 'completed' | 'canceled';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectCategory = 'cctv' | 'alarms' | 'wireless' | 'pos' | 'fencing' | 'server' | 'networking' | 'telephony' | 'other';

export type TIProject = {
  id: number;
  consecutive: string;
  name: string;
  customerId: string;
  customerName: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  category: ProjectCategory;
  startDate: string;
  endDate: string;
  coordinatorId: number; // Internal support agent
  subcontractorId?: number | null; // Legacy field (single)
  subcontractorIds: number[]; // New field (multiple)
  description: string;
  notes?: string;
  estimatedBudget: number; // Total amount billed to client
  billingStatus: 'pending' | 'invoiced';
  createdAt: string;
  updatedAt: string;
};

export type ProjectAdvance = {
    id: number;
    projectId: number;
    timestamp: string;
    content: string;
    userId: number;
    userName: string;
};

export type ProjectAttachment = {
    id: number;
    projectId: number;
    name: string;
    fileName: string;
    fileType: string;
    data: string; // Base64
    uploadedBy: string;
    createdAt: string;
};

export type ProjectItem = {
    id: number;
    projectId: number;
    description: string;
    quantity: number;
    unitPrice: number;
    type: 'material' | 'service';
};

export type PlannerSettings = {
    projectPrefix?: string;
    nextProjectNumber?: number;
    pdfTopLegend?: string;
    assignmentLabel: string;
    pdfPaperSize: 'letter' | 'legal';
    showCustomerTaxId: boolean;
    assignments: { id: string; name: string }[];
    requireAssignmentForStart: boolean;
};

export type { DateRange };

// --- Stock Management Types ---
export type StockInfo = {
    itemId: string;
    stockByWarehouse: { [key: string]: number };
    totalStock: number;
};

export type Warehouse = {
    id: string;
    name: string;
    isDefault: boolean;
    isVisible: boolean;
};

export type StockSettings = {
    warehouses: Warehouse[];
};

// --- Hacienda Query Types ---
export type HaciendaContributorInfo = {
    nombre: string;
    tipoIdentificacion: string;
    regimen: {
        codigo: string;
        descripcion: string;
    };
    situacion: {
        moroso: "SI" | "NO";
        omiso: "SI" | "NO";
        estado: string;
    };
    administracionTributaria: string;
    actividades: {
        estado: string;
        tipo: string;
        codigo: string;
        descripcion: string;
    }[];
};

export type HaciendaExemptionApiResponse = {
    numeroDocumento: string;
    identificacion: string;
    porcentajeExoneracion: number;
    fechaEmision: string;
    fechaVencimiento: string;
    ano: number;
    cabys: string[];
    tipoAutorizacion: string;
    tipoDocumento: {
        codigo: string;
        descripcion: string;
        };
    CodigoInstitucion: string;
    nombreInstitucion: string;
    poseeCabys: boolean;
};

export type EnrichedCabysItem = {
    code: string;
    description: string;
    taxRate: number;
};

export type EnrichedExemptionInfo = HaciendaExemptionApiResponse & {
    enrichedCabys: EnrichedCabysItem[];
};

// --- SQL Import Types ---
export type SqlConfig = {
    user?: string;
    password?: string;
    host?: string;
    database?: string;
    port?: string;
}

export type ImportQuery = {
    type: 'customers' | 'products' | 'exemptions' | 'stock' | 'cabys';
    query: string;
}

// --- Maintenance Types ---
export type UpdateBackupInfo = {
    moduleId: string;
    moduleName: string;
    fileName: string;
    date: string;
};

// --- Suggestion Box Types ---
export type Suggestion = {
  id: number;
  content: string;
  userId: number;
  userName: string;
  isRead: 0 | 1;
  timestamp: string;
};

// --- Cost Assistant Types ---
export type CostAssistantLine = {
    id: string;
    invoiceKey: string;
    lineNumber: number;
    supplierName: string;
    cabysCode: string;
    supplierCode: string;
    supplierCodeType: string;
    description: string;
    quantity: number;
    discountAmount: number;
    xmlUnitCost: number;
    unitCostWithTax: number;
    unitCostWithoutTax: number;
    taxRate: number;
    taxCode: string;
    margin: number;
    finalSellPrice: number;
    sellPriceWithoutTax: number;
    profitPerLine: number;
    displayMargin: string;
    displayTaxRate: string;
    displayUnitCost: string;
    isCostEdited: boolean;
};

export type CostAnalysisDraft = {
    id: string;
    createdAt: string;
    userId: number;
    name: string;
    lines: CostAssistantLine[];
    globalCosts: {
        transportCost: number;
        otherCosts: number;
    };
    processedInvoices: ProcessedInvoiceInfo[];
    discountHandling: 'customer' | 'company';
};

export type ProcessedInvoiceInfo = {
    supplierName: string;
    invoiceNumber: string;
    invoiceDate: string;
    status: 'success' | 'error';
    errorMessage?: string;
};

export type CostAssistantSettings = {
    draftPrefix?: string;
    nextDraftNumber?: number;
    columnVisibility: {
        cabysCode: boolean;
        supplierCode: boolean;
        description: boolean;
        quantity: boolean;
        discountAmount: boolean;
        unitCostWithoutTax: boolean;
        unitCostWithTax: boolean;
        taxRate: boolean;
        margin: boolean;
        sellPriceWithoutTax: boolean;
        finalSellPrice: boolean;
        profitPerLine: boolean;
    },
    discountHandling: 'customer' | 'company';
};

// --- Tickets Module Types ---
export type TicketStatus = 'open' | 'in_progress' | 'on_hold' | 'completed' | 'canceled';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type HelpTopic = {
    id: number;
    name: string;
    defaultPriority?: TicketPriority;
    defaultAssigneeId?: number | null;
    defaultServiceId?: string | null;
};

export type ClientCompany = {
    id: number;
    name: string;
    taxId: string;
    address: string;
    phone: string;
    email: string;
    telegramChatId?: string | null;
    createdAt: string;
};

export type Ticket = {
    id: number;
    consecutive: string;
    subject: string;
    status: TicketStatus;
    priority: TicketPriority;
    createdAt: string;
    updatedAt: string;
    dueDate?: string;
    companyId: number | null;
    customerName: string; 
    customerEmail: string;
    companyName?: string;
    assigneeId?: number | null;
    helpTopicId?: number | null;
    serviceId?: string | null;
    contractId?: number | null;
    isBillable: boolean;
    providerId?: number | null;
    totalDuration?: number;
    hasActiveTimer?: boolean;
};

export type TicketThread = {
    id: number;
    ticketId: number;
    userId?: number;
    userName: string;
    type: 'message' | 'note' | 'status_change';
    content: string;
    createdAt: string;
};

export type NewTicketPayload = {
    subject: string;
    content: string;
    status: TicketStatus;
    priority: TicketPriority;
    companyId: number | null;
    serviceId: string | null;
    customerName: string; 
    customerEmail: string;
    customerPhone?: string;
    companyName?: string;
    helpTopicId?: number;
    assigneeId?: number | null;
    dueDate?: string;
    contractId?: number | null;
    isBillable: boolean;
    providerId?: number | null;
};

export type License = {
    id: number;
    licenseKey: string;
    softwareId: number;
    customerId: string | null;
    hardwareId?: string | null;
    isPerpetual: boolean;
    expirationDate: string;
    status: 'active' | 'expired' | 'revoked';
    createdAt: string;
};

export type SoftwareProduct = {
    id: number;
    name: string;
    isInternal: boolean;
};

export type ExpectedSchema = {
    [tableName: string]: string[];
};

/**
 * Notifications Engine Types
 */
export type NotificationRule = {
    id: number;
    name: string;
    event: string; // e.g., 'onTicketCreated'
    action: 'sendEmail' | 'sendTelegram';
    recipients: string[]; // List of emails or Telegram chat IDs
    subject?: string;
    enabled: boolean;
};

export type ScheduledTask = {
    id: number;
    name: string;
    schedule: string; // Cron expression
    taskId: string; // e.g., 'erp-sync'
    enabled: boolean;
};

export type NotificationServiceConfig = {
    telegram?: {
        botToken: string;
        chatId: string;
    };
};

export type NotificationEventId = 
    | 'onTicketCreated' 
    | 'onTicketStatusChanged'
    | 'onTicketCompleted'
    | 'onTicketCanceled'
    | 'onTicketReplyAdded'
    | 'onTicketPriorityUrgent' 
    | 'onProjectCompleted' 
    | 'onProjectAdvanceAdded'
    | 'onBackupCompleted'
    | 'onNewSuggestion'
    | 'onContractExpiring'
    | 'onLicenseExpiring'
    | 'onContractAutoRenewed';

export type Notification = {
    id: number | string;
    userId: number;
    message: string;
    href: string;
    isRead: 0 | 1;
    timestamp: string;
    entityId?: number;
    entityType?: string;
    entityStatus?: string;
    taskType?: string;
    isSuggestion?: boolean;
    suggestionId?: number;
};
