/**
 * @fileoverview Master schema definition for database auditing.
 * This defines the "ideal" state of the central intratool.db database.
 * Updated for M20 Expansion: Supports 20 logical modules.
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
        'id', 'name', 'commercialName', 'address', 'phone', 'taxId', 'currency', 'creditLimit', 'paymentCondition', 
        'salesperson', 'active', 'email', 'electronicDocEmail', 'isManual', 'contacts', 
        'supportPackageId', 'taxRegime', 'taxStatus', 'isTaxMoroso', 'isTaxOmiso', 
        'taxAdministration', 'taxAdministrationText', 'taxActivities', 'provinceId', 'cantonId', 'districtId', 'telegramChatId',
        'isBlocked', 'blockedReason', 'notifyTickets', 'notifyLicenses', 'parentCustomerId', 'isLead'
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
    help_topics: ['id', 'name', 'defaultPriority', 'defaultAssigneeId', 'defaultServiceId'],
    tickets: [
        'id', 'consecutive', 'subject', 'status', 'priority', 'createdAt', 'updatedAt', 
        'dueDate', 'companyId', 'customerName', 'customerEmail', 'customerPhone', 'companyName', 
        'assigneeId', 'helpTopicId', 'serviceId', 'contractId', 'licenseId', 'equipmentId', 'isBillable', 'providerId', 'providerContactId', 'scheduledVisit'
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
    it_notes: ['id', 'title', 'content', 'customerId', 'tags', 'createdBy', 'createdAt', 'updatedAt'],
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
    software_products: [
        'id', 'name', 'isInternal', 'currentVersion',
        'syncFrequencyFree', 'adRefreshFrequency', 'nagScreenTimer', 'allowOfflinePremium',
        'm01_name', 'm02_name', 'm03_name', 'm04_name', 'm05_name', 
        'm06_name', 'm07_name', 'm08_name', 'm09_name', 'm10_name',
        'm11_name', 'm12_name', 'm13_name', 'm14_name', 'm15_name', 
        'm16_name', 'm17_name', 'm18_name', 'm19_name', 'm20_name'
    ],
    licenses: [
        'id', 'licenseKey', 'activationToken', 'softwareId', 'customerId', 'hardwareId', 'isPerpetual', 'expirationDate', 'status', 'createdAt',
        'm01_val', 'm02_val', 'm03_val', 'm04_val', 'm05_val', 
        'm06_val', 'm07_val', 'm08_val', 'm09_val', 'm10_val',
        'm11_val', 'm12_val', 'm13_val', 'm14_val', 'm15_val', 
        'm16_val', 'm17_val', 'm18_val', 'm19_val', 'm20_val'
    ],
    time_entries: [
        'id', 'ticketId', 'userId', 'startTime', 'endTime', 'duration', 'billableDuration', 
        'billingStatus', 'externalInvoiceNumber', 'notes', 'isBillable', 'createdAt'
    ],
    marketing_ads: ['id', 'softwareId', 'imageUrl', 'description', 'price', 'targetUrl', 'isEnabled', 'targetType', 'expiresAt', 'createdAt'],
    notification_templates: ['eventId', 'subject', 'body', 'telegram', 'internal'],
    notification_rules: ['id', 'name', 'event', 'action', 'recipients', 'subject', 'enabled'],
    scheduled_tasks: ['id', 'name', 'schedule', 'taskId', 'enabled'],
    notifications: ['id', 'userId', 'message', 'href', 'isRead', 'timestamp', 'entityId', 'entityType'],
    otp_verifications: ['id', 'email', 'code', 'expiresAt', 'isUsed'],
    inventory_equipment: ['id', 'clientId', 'nickname', 'category', 'brand', 'model', 'serialNumber', 'location', 'assignedUser', 'status', 'notes', 'createdAt', 'updatedAt'],
    inventory_consumables: ['id', 'equipmentId', 'type', 'description', 'partNumber', 'brand', 'specs', 'isRecurring', 'lastReplaced', 'notes', 'createdAt'],
    inventory_sale_records: ['id', 'clientId', 'equipmentId', 'invoiceNumber', 'invoiceDate', 'productName', 'serialNumber', 'partNumber', 'warrantyMonths', 'warrantyExpiry', 'warrantyNotes', 'warrantyStatus', 'claimDate', 'claimNotes', 'createdAt', 'updatedAt']
};