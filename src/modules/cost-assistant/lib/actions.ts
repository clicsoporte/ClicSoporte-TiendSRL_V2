/**
 * @fileoverview Server Actions for the Cost Assistant module.
 * These functions handle server-side logic like processing XML files,
 * interacting with the database, and generating export files.
 */
'use server';

import { XMLParser } from 'fast-xml-parser';
import type { CostAssistantLine, ProcessedInvoiceInfo, CostAnalysisDraft, CostAssistantSettings } from '@/modules/core/types';
import { 
    getAllDrafts as getAllDraftsServer, 
    saveDraft as saveDraftServer, 
    deleteDraft as deleteDraftServer, 
    getCostAssistantDbSettings as getDbSettings,
    saveCostAssistantDbSettings as saveDbSettings,
} from './db';
import { logError, logInfo } from '@/modules/core/lib/logger';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { getUserPreferences, saveUserPreferences } from '@/modules/core/lib/db';
import { authorizeAction } from '@/modules/core/lib/auth-guard';

const getValue = <T>(obj: Record<string, unknown>, pathArray: string[], defaultValue: T): T => {
    const result = pathArray.reduce((acc: unknown, key) => {
        if (typeof acc === 'object' && acc !== null && key in acc) {
            return (acc as Record<string, unknown>)[key];
        }
        return undefined;
    }, obj);
    return result === undefined ? defaultValue : (result as T);
};


const parseDecimal = (str: unknown): number => {
    if (str === null || str === undefined || str === '') return 0;
    const s = String(str).trim();
    
    // Handle European style decimals (e.g., "1.234,56")
    if (s.includes(',')) {
        // Assume comma is decimal separator and dots are thousand separators
        return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    }
    
    // Handle standard US style decimals
    return parseFloat(s);
};


interface InvoiceParseResult {
    lines: CostAssistantLine[];
    invoiceInfo: Omit<ProcessedInvoiceInfo, 'status' | 'errorMessage'>;
}

async function parseInvoice(xmlContent: string, fileIndex: number): Promise<InvoiceParseResult | { error: string, details: Partial<ProcessedInvoiceInfo> }> {
    
    if (xmlContent.includes('MensajeHacienda')) {
        return { error: 'El archivo es una respuesta de Hacienda, no una factura.', details: {} };
    }

    const parser = new XMLParser({
        ignoreAttributes: true,
        removeNSPrefix: true, 
        parseTagValue: false, 
        isArray: (tagName) => {
            const alwaysArray = ['LineaDetalle', 'CodigoComercial'];
            return alwaysArray.includes(tagName);
        },
    });

    let json: Record<string, unknown>;
    try {
        json = parser.parse(xmlContent) as Record<string, unknown>;
    } catch (e: unknown) {
        logError('XML parsing failed', { error: (e as Error).message, content: xmlContent.substring(0, 500) });
        return { error: 'XML malformado o ilegible.', details: {} };
    }
    
    const rootNode = (json.FacturaElectronica || json.TiqueteElectronico) as Record<string, unknown>;
    
    if (!rootNode) {
        const detectedRoot = Object.keys(json)[0] || 'N/A';
        logError('Invalid XML structure for invoice', { detectedRoot });
        if (detectedRoot === 'html' || detectedRoot.startsWith('?xml')) {
            return { error: 'El archivo es un documento HTML o XML inválido, no una factura.', details: {} };
        }
        return { error: `No es un archivo de factura válido. Nodo raíz no encontrado: ${detectedRoot}`, details: {} };
    }
    
    const clave = getValue<string>(rootNode, ['Clave'], `unknown-key-${fileIndex}`);
    const numeroConsecutivo = getValue<string>(rootNode, ['NumeroConsecutivo'], clave.substring(21, 41));
    const fechaEmision = getValue<string>(rootNode, ['FechaEmision'], new Date().toISOString());
    const emisorNombre = getValue<string>(rootNode, ['Emisor', 'Nombre'], 'Desconocido');

    const invoiceInfo = {
        supplierName: emisorNombre,
        invoiceNumber: numeroConsecutivo,
        invoiceDate: fechaEmision,
    };

    const detalleServicio = getValue<Record<string, unknown>>(rootNode, ['DetalleServicio'], {});
    if (!detalleServicio || !detalleServicio.LineaDetalle) {
        return { lines: [], invoiceInfo };
    }
    
    const lineasDetalle: Record<string, unknown>[] = Array.isArray(detalleServicio.LineaDetalle) 
        ? detalleServicio.LineaDetalle as Record<string, unknown>[] 
        : [detalleServicio.LineaDetalle as Record<string, unknown>];


    const moneda = getValue<string>(rootNode, ['ResumenFactura', 'CodigoTipoMoneda', 'CodigoMoneda'], 'CRC');
    const tipoCambioStr = getValue<string>(rootNode, ['ResumenFactura', 'CodigoTipoMoneda', 'TipoCambio'], '1');
    const tipoCambio = parseDecimal(tipoCambioStr) || 1.0;


    const lines: CostAssistantLine[] = [];
    for (const [index, linea] of lineasDetalle.entries()) {
        const cantidad = parseDecimal(getValue(linea, ['Cantidad'], '0'));
        if (cantidad === 0) continue;
        
        let supplierCode = 'N/A';
        let supplierCodeType = '04'; // Default to 'Uso Interno'
        const codigosComerciales = getValue<Record<string, unknown>[]>(linea, ['CodigoComercial'], []);
        
        if (codigosComerciales.length > 0) {
            const preferredCodeNode = codigosComerciales.find((c) => c.Tipo === '01');
            if (preferredCodeNode && preferredCodeNode.Codigo) {
                supplierCode = preferredCodeNode.Codigo as string;
                supplierCodeType = preferredCodeNode.Tipo as string;
            } else if (codigosComerciales.length > 0 && codigosComerciales[0].Codigo) {
                supplierCode = codigosComerciales[0].Codigo as string;
                supplierCodeType = codigosComerciales[0].Tipo as string;
            }
        }
        
        const cabysV43 = getValue<string>(linea, ['Codigo'], '');
        const cabysV44 = getValue<string>(linea, ['CodigoCABYS'], '');
        const cabysCode = cabysV44 || cabysV43 || 'N/A';
        
        const montoTotalLinea = parseDecimal(getValue(linea, ['MontoTotalLinea'], '0'));
        
        const descuentoNode = getValue<Record<string, unknown>>(linea, ['Descuento'], {});
        const discountAmount = (descuentoNode && descuentoNode.MontoDescuento) ? parseDecimal(descuentoNode.MontoDescuento) : 0;
        
        const subTotal = parseDecimal(getValue(linea, ['SubTotal'], '0'));
        
        const subTotalWithDiscount = subTotal - discountAmount;
        
        const unitCostWithTax = cantidad > 0 ? montoTotalLinea / cantidad : 0;
        const unitCostWithoutTax = cantidad > 0 ? subTotalWithDiscount / cantidad : 0;

        const impuestoNode = getValue<Record<string, unknown>>(linea, ['Impuesto'], {});
        let taxRate = 0.13; // Default
        let taxCode = '08'; // Default
        if (impuestoNode && impuestoNode.Tarifa) {
            taxRate = parseDecimal(impuestoNode.Tarifa) / 100;
            taxCode = (impuestoNode.CodigoTarifaIVA as string) || '08';
        }
        
        const unitCostWithTaxInColones = moneda === 'USD' ? unitCostWithTax * tipoCambio : unitCostWithTax;
        const unitCostWithoutTaxInColones = moneda === 'USD' ? unitCostWithoutTax * tipoCambio : unitCostWithoutTax;
        
        const numeroLinea = getValue<number>(linea, ['NumeroLinea'], index + 1);

        lines.push({
            id: `${numeroConsecutivo}-${numeroLinea}-${supplierCode}-${index}`,
            invoiceKey: numeroConsecutivo,
            lineNumber: numeroLinea,
            cabysCode: cabysCode,
            supplierCode: supplierCode,
            supplierCodeType: supplierCodeType,
            description: getValue<string>(linea, ['Detalle'], ''),
            quantity: cantidad,
            discountAmount,
            unitCostWithTax: unitCostWithTaxInColones,
            unitCostWithoutTax: unitCostWithoutTaxInColones,
            xmlUnitCost: unitCostWithoutTaxInColones,
            taxRate: taxRate,
            taxCode: taxCode,
            displayMargin: "20",
            margin: 0.20,
            displayTaxRate: (taxRate * 100).toFixed(0),
            displayUnitCost: unitCostWithoutTaxInColones.toFixed(4),
            isCostEdited: false,
            finalSellPrice: 0,
            profitPerLine: 0,
            sellPriceWithoutTax: 0,
            supplierName: emisorNombre,
        });
    }

    return { lines, invoiceInfo };
}

export async function processInvoiceXmls(xmlContents: string[]): Promise<{ lines: CostAssistantLine[], processedInvoices: ProcessedInvoiceInfo[] }> {
    await authorizeAction('cost-assistant:process');
    let allLines: CostAssistantLine[] = [];
    const processedInvoices: ProcessedInvoiceInfo[] = [];

    for (const [index, xmlContent] of xmlContents.entries()) {
        try {
            const result = await parseInvoice(xmlContent, index);
            if (result && 'lines' in result) {
                allLines = [...allLines, ...result.lines];
                if (result.invoiceInfo.supplierName) { // Only add if it's a valid invoice
                    processedInvoices.push({
                        ...result.invoiceInfo,
                        status: 'success'
                    });
                }
            } else if (result && 'error' in result) {
                 processedInvoices.push({
                    supplierName: (result.details.supplierName || 'Desconocido') as string,
                    invoiceNumber: (result.details.invoiceNumber || `Archivo ${index + 1}`) as string,
                    invoiceDate: (result.details.invoiceDate || new Date().toISOString()) as string,
                    status: 'error',
                    errorMessage: result.error
                });
            }
        } catch (error: unknown) {
            console.error("Error parsing one of the XMLs:", (error as Error).message);
            processedInvoices.push({
                supplierName: 'Desconocido',
                invoiceNumber: `Archivo ${index + 1}`,
                invoiceDate: new Date().toISOString(),
                status: 'error',
                errorMessage: 'XML malformado o ilegible'
            });
        }
    }
    
    return JSON.parse(JSON.stringify({ lines: allLines, processedInvoices }));
}

const defaultSettings: CostAssistantSettings = {
    draftPrefix: 'AC-',
    nextDraftNumber: 1,
    columnVisibility: {
        cabysCode: true, supplierCode: true, description: true, quantity: true,
        discountAmount: false, unitCostWithoutTax: true, unitCostWithTax: false, taxRate: true,
        margin: true, sellPriceWithoutTax: true, finalSellPrice: true, profitPerLine: true
    },
    discountHandling: 'company',
};

export async function getCostAssistantSettings(userId: number): Promise<CostAssistantSettings> {
    const userPrefs = await getUserPreferences(userId, 'costAssistantSettings');
    const dbSettings = await getDbSettings();
    const settings = { ...defaultSettings, ...dbSettings, ...userPrefs } as CostAssistantSettings;
    return settings;
}

export async function saveCostAssistantSettings(userId: number, settings: Partial<CostAssistantSettings>): Promise<void> {
    const { draftPrefix, nextDraftNumber, ...userPrefs } = settings;
    await saveUserPreferences(userId, 'costAssistantSettings', userPrefs);
    
    const dbSettingsToSave: Partial<CostAssistantSettings> = {};
    if (draftPrefix !== undefined) dbSettingsToSave.draftPrefix = draftPrefix;
    if (nextDraftNumber !== undefined) dbSettingsToSave.nextDraftNumber = nextDraftNumber;
    
    if (Object.keys(dbSettingsToSave).length > 0) {
        await saveDbSettings(dbSettingsToSave);
    }
    await logInfo('Cost Assistant settings updated', { userId });
}

export async function getAllDrafts(userId: number): Promise<CostAnalysisDraft[]> {
    await authorizeAction('cost-assistant:access');
    const drafts = await getAllDraftsServer(userId);
    return JSON.parse(JSON.stringify(drafts));
}

export async function saveDraft(draft: Omit<CostAnalysisDraft, 'id' | 'createdAt'>): Promise<void> {
    await authorizeAction('cost-assistant:access');
    const settings = await getDbSettings();
    const draftPrefix = settings.draftPrefix || 'AC-';
    const nextDraftNumber = settings.nextDraftNumber || 1;
    await logInfo('Cost analysis draft saved', { name: draft.name, userId: draft.userId });
    await saveDraftServer(draft, draftPrefix, nextDraftNumber);
}

export async function deleteDraft(id: string): Promise<void> {
    await authorizeAction('cost-assistant:access');
    await logInfo('Cost analysis draft deleted', { draftId: id });
    return deleteDraftServer(id);
}

export async function getNextDraftNumber(): Promise<number> {
    const settings = await getDbSettings();
    return settings.nextDraftNumber || 1;
}

export async function exportForERP(lines: CostAssistantLine[]): Promise<string> {
    await authorizeAction('cost-assistant:export');
    const headers = [
        "Cabys", "Cód. Artículo", "Descripción", "Cant.", "Descuento", 
        "Costo Unit. (s/IVA)", "Costo Unit. (c/IVA)", "Imp. %", "Margen", 
        "P.V.P Unitario (s/IVA)", "P.V.P Unitario Sugerido", "Ganancia por Línea"
    ];
    
    const dataToExport = lines.map(line => [
        line.cabysCode,
        line.supplierCode,
        line.description,
        line.quantity,
        line.discountAmount,
        line.unitCostWithoutTax,
        line.unitCostWithTax,
        line.taxRate * 100,
        `${(line.margin * 100).toFixed(2)}%`,
        line.sellPriceWithoutTax,
        line.finalSellPrice,
        line.profitPerLine,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataToExport]);
    
    worksheet['!cols'] = [
        { wch: 15 }, // Cabys
        { wch: 15 }, // Cód. Artículo
        { wch: 40 }, // Descripción
        { wch: 10 }, // Cant.
        { wch: 12 }, // Descuento
        { wch: 20 }, // Costo Unit. (s/IVA)
        { wch: 20 }, // Costo Unit. (c/IVA)
        { wch: 10 }, // Imp. %
        { wch: 10 }, // Margen
        { wch: 22 }, // P.V.P Unitario (s/IVA)
        { wch: 22 }, // P.V.P Unitario Sugerido
        { wch: 20 }, // Ganancia por Línea
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'AnalisisDeCostos');
    
    const exportDir = path.join(process.cwd(), 'dbs', 'temp_exports');
    if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const fileName = `analisis_costos_${Date.now()}.xlsx`;
    const filePath = path.join(exportDir, fileName);

    try {
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
        fs.writeFileSync(filePath, buffer);
    } catch (error: unknown) {
        logError("Failed to save Excel file to disk", { error: (error as Error).message, path: filePath });
        throw new Error(`No se pudo guardar el archivo en la ruta del servidor: ${filePath}`);
    }
    
    return fileName;
}


export async function cleanupExportFile(fileName: string): Promise<void> {
    if (!fileName) {
        throw new Error("Filename is required");
    }
    const exportDir = path.join(process.cwd(), 'dbs', 'temp_exports');
    const filePath = path.join(exportDir, fileName);

    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (error: unknown) {
            logError("Failed to delete temporary export file", { error: (error as Error).message, file: fileName });
            throw new Error("Error del servidor al limpiar el archivo temporal.");
        }
    }
}
