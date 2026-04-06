
/**
 * @fileoverview Master schema definition for database auditing.
 * This defines the "ideal" state of the central intratool.db database.
 */

import type { ExpectedSchema } from '../types';

export const MASTER_SCHEMA: ExpectedSchema = {
    users: [
        'id', 'name', 'email', 'password', 'phone', 'whatsapp', 'avatar', 
        'role', 'recentActivity', 'securityQuestion', 'securityAnswer', 'forcePasswordChange'
    ],
    roles: ['id', 'name', 'permissions'],
    company_settings: [
        'id', 'name', 'taxId', 'address', 'phone', 'email', 'logoUrl', 'systemName', 
        'systemVersion', 'publicUrl', 'quotePrefix', 'nextQuoteNumber', 'decimalPlaces', 
        'quoterShowTaxId', 'searchDebounceTime', 'syncWarningHours', 'importMode', 
        'lastSyncTimestamp', 'customerFilePath', 'productFilePath', 'exemptionFilePath', 
        'stockFilePath', 'cabysFilePath', 'supportPackages', 'servicesCatalog', 'internalHourCost'
    ],
    api_settings: ['id', 'exchangeRateApi', 'haciendaExemptionApi', 'haciendaTributariaApi'],
    email_settings: ['key', 'value'],
    logs: ['id', 'timestamp', 'type', 'message', 'details'],
    suggestions: ['id', 'content', 'userId', 'userName', 'isRead', 'timestamp'],
    user_preferences: ['userId', 'key', 'value'],
    customers: [
        'id', 'name', 'address', 'phone', 'taxId', 'currency', 'creditLimit', 'paymentCondition', 
        'salesperson', 'active', 'email', 'electronicDocEmail', 'isManual', 'contacts', 
        'supportPackageId', 'taxRegime', 'taxStatus', 'isTaxMoroso', 'isTaxOmiso', 
        'taxAdministration', 'taxActivities', 'provinceId', 'cantonId', 'districtId', 'telegramChatId'
    ],
    products: ['id', 'description', 'classification', 'lastEntry', 'active', 'notes', 'unit', 'isBasicGood', 'cabys'],
    stock: ['itemId', 'stockByWarehouse', 'totalStock'],
    exemptions: ['code', 'description', 'customer', 'authNumber', 'startDate', 'endDate', 'percentage', 'docType', 'institutionName', 'institutionCode'],
    cabys_catalog: ['code', 'description', 'taxRate'],
    exchange_rates: ['date', 'rate'],
    quote_drafts: [
        'id', 'createdAt', 'userId', 'customerId', 'customerDetails', 'lines', 'totals', 
        'notes', 'currency', 'exchangeRate', 'purchaseOrderNumber', 'deliveryAddress', 
        'deliveryDate', 'sellerName', 'sellerType', 'quoteDate', 'validUntilDate', 'paymentTerms', 'creditDays'
    ],
    contracts: [
        'id', 'consecutive', 'name', 'customerId', 'startDate', 'endDate', 'status', 
        'includedServices', 'excludedServices', 'monthlyHours', 'price', 'currency', 
        'notes', 'autoRenew', 'createdAt'
    ],
    contract_settings: ['key', 'value'],
    client_companies: ['id', 'name', 'taxId', 'address', 'phone', 'email', 'telegramChatId', 'createdAt'],
    help_topics: ['id', 'name', 'defaultPriority', 'defaultAssigneeId', 'defaultServiceId'],
    tickets: [
        'id', 'consecutive', 'subject', 'status', 'priority', 'createdAt', 'updatedAt', 
        'dueDate', 'companyId', 'customerName', 'customerEmail', 'companyName', 
        'assigneeId', 'helpTopicId', 'serviceId', 'contractId', 'isBillable', 'providerId'
    ],
    ticket_threads: ['id', 'ticketId', 'userId', 'userName', 'type', 'content', 'createdAt'],
    ticket_settings: ['key', 'value'],
    third_party_providers: ['id', 'name', 'email', 'phone', 'specialty', 'notes', 'contacts', 'createdAt'],
    provinces: ['id', 'name'],
    cantons: ['id', 'provinceId', 'name'],
    districts: ['id', 'cantonId', 'name'],
    provider_services: [
        'id', 'providerId', 'serviceId', 'buyPriceRemote', 'marginRemote', 'taxRate', 
        'sellPriceRemote', 'buyPriceOnSite', 'marginOnSite', 'sellPriceOnSite'
    ],
    provider_geo_rates: [
        'id', 'providerId', 'provinceId', 'cantonId', 'districtId', 'buyTravelPrice', 
        'marginTravel', 'taxRate', 'sellTravelPrice', 'locationName'
    ],
    planner_settings: ['key', 'value'],
    projects: [
        'id', 'consecutive', 'name', 'customerId', 'customerName', 'category', 'status', 
        'priority', 'startDate', 'endDate', 'coordinatorId', 'subcontractorId', 
        'description', 'notes', 'estimatedBudget', 'billingStatus', 'createdAt', 'updatedAt'
    ],
    project_subcontractors: ['projectId', 'providerId'],
    project_advances: ['id', 'projectId', 'timestamp', 'content', 'userId', 'userName'],
    project_attachments: ['id', 'projectId', 'name', 'fileName', 'fileType', 'data', 'uploadedBy', 'createdAt'],
    project_items: ['id', 'projectId', 'description', 'quantity', 'unitPrice', 'type'],
    software_products: ['id', 'name', 'isInternal'],
    licenses: ['id', 'licenseKey', 'softwareId', 'clientCompanyId', 'hardwareId', 'isPerpetual', 'expirationDate', 'status', 'createdAt'],
    time_entries: [
        'id', 'ticketId', 'userId', 'startTime', 'endTime', 'duration', 'billableDuration', 
        'billingStatus', 'externalInvoiceNumber', 'notes', 'isBillable', 'createdAt'
    ],
    cost_drafts: ['id', 'userId', 'name', 'createdAt', 'data'],
    cost_assistant_settings: ['key', 'value'],
    notification_rules: ['id', 'name', 'event', 'action', 'recipients', 'subject', 'enabled'],
    notification_settings: ['service', 'config'],
    scheduled_tasks: ['id', 'name', 'schedule', 'taskId', 'enabled'],
    notifications: ['id', 'userId', 'message', 'href', 'isRead', 'timestamp', 'entityId', 'entityType'],
    notification_templates: ['eventId', 'subject', 'body', 'telegram', 'internal']
};
