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
    quotePrefix: string;
    nextQuoteNumber: number;
    decimalPlaces: number;
    quoterShowTaxId?: boolean;
    searchDebounceTime?: number;
    syncWarningHours?: number;
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
};

export type Service = {
  id: string;
  name: string;
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
 * Represents a contact person within a customer company.
 */
export type CustomerContact = {
    id: string;
    name: string;
    email: string;
    department: string;
    position: string;
    officePhone: string;
    whatsapp: string;
    branch: string;
};

/**
 * Represents a customer. Can be imported or created manually.
 */
export type Customer = {
    id: string;
    name: string;
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
    supportPackageId?: string;
    monthlyHoursBalance?: number;
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
};

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

// --- Production Planner Types ---

export type ProductionOrderStatus = 'pending' | 'approved' | 'in-queue' | 'in-progress' | 'on-hold' | 'in-maintenance' | 'completed' | 'canceled' | 'custom-1' | 'custom-2' | 'custom-3' | 'custom-4';
export type AdministrativeAction = 'unapproval-request' | 'cancellation-request' | 'none';
export type ProductionOrderPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ProductionOrder = {
  id: number;
  consecutive: string;
  purchaseOrder?: string;
  requestDate: string;
  deliveryDate: string;
  scheduledStartDate?: string | null;
  scheduledEndDate?: string | null;
  customerId: string;
  customerName: string;
  customerTaxId: string;
  productId: string;
  productDescription: string;
  quantity: number;
  inventory?: number;
  inventoryErp?: number;
  priority: ProductionOrderPriority;
  status: ProductionOrderStatus;
  pendingAction: AdministrativeAction;
  notes?: string;
  requestedBy: string;
  approvedBy?: string;
  lastStatusUpdateBy?: string;
  lastStatusUpdateNotes?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  hasBeenModified?: boolean;
  deliveredQuantity?: number;
  erpPackageNumber?: string;
  erpTicketNumber?: string;
  reopened?: boolean;
  assignmentId?: string | null;
  previousStatus?: ProductionOrderStatus | null;
};

export type UpdateProductionOrderPayload = Partial<Omit<ProductionOrder, 'id' | 'consecutive' | 'requestDate' | 'status' | 'reopened' | 'assignmentId' | 'previousStatus' | 'lastStatusUpdateBy' | 'lastStatusUpdateNotes' | 'approvedBy' | 'lastModifiedBy' | 'lastModifiedAt' | 'hasBeenModified' | 'pendingAction'>> & {
    orderId: number;
    updatedBy: string;
};

export type ProductionOrderHistoryEntry = {
    id: number;
    orderId: number;
    timestamp: string;
    status: ProductionOrderStatus;
    notes?: string;
    updatedBy: string;
};

export type PlannerAssignment = {
  id: string;
  name: string;
};

export type CustomStatus = {
    id: 'custom-1' | 'custom-2' | 'custom-3' | 'custom-4';
    label: string;
    color: string;
    isActive: boolean;
};

export type PlannerSettings = {
    orderPrefix?: string;
    nextOrderNumber?: number;
    showCustomerTaxId: boolean;
    assignments: PlannerAssignment[];
    requireAssignmentForStart: boolean;
    assignmentLabel: string;
    customStatuses: CustomStatus[];
    pdfPaperSize: 'letter' | 'legal';
    pdfOrientation: 'portrait' | 'landscape';
    pdfExportColumns: string[];
    pdfTopLegend?: string;
    fieldsToTrackChanges: string[];
};

export type UpdateStatusPayload = {
    orderId: number;
    status: ProductionOrderStatus;
    notes: string;
    updatedBy: string;
    deliveredQuantity?: number;
    erpPackageNumber?: string;
    erpTicketNumber?: string;
    reopen: boolean;
};

export type UpdateOrderDetailsPayload = {
  orderId: number;
  priority?: ProductionOrderPriority;
  assignmentId?: string | null;
  scheduledDateRange?: DateRange;
  updatedBy: string;
};

export type AdministrativeActionPayload = {
    entityId: number;
    action: AdministrativeAction;
    notes: string;
    updatedBy: string;
};

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

export type { DateRange };

export type NotePayload = {
    orderId: number;
    notes: string;
    updatedBy: string;
};

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
export type TicketStatus = 'open' | 'in_progress' | 'on_hold' | 'closed';
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
    companyName?: string;
    assigneeId?: number | null;
    helpTopicId?: number | null;
    serviceId?: string | null;
    contractId?: number | null;
    isBillable: boolean;
    providerId?: number | null;
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
    clientCompanyId: number | null;
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

export type TimeEntry = {
    id: number;
    ticketId: number;
    userId: number;
    startTime: string;
    endTime: string | null;
    duration: number;
    notes: string | null;
    isBillable: boolean;
    createdAt: string;
};

export type ExpectedSchema = {
    [tableName: string]: string[];
};
