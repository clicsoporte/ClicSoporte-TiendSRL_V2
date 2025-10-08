/**
 * @fileoverview Client-side functions for the Cost Assistant module.
 */
'use server';

import { XMLParser } from 'fast-xml-parser';
import type { CostAssistantLine, ProcessedInvoiceInfo, CostAnalysisDraft } from '@/modules/core/types';
import { getCostAssistantSettings as getCostAssistantSettingsServer, saveCostAssistantSettings as saveCostAssistantSettingsServer, type CostAssistantSettings, getAllDrafts as getAllDraftsServer, saveDraft as saveDraftServer, deleteDraft as deleteDraftServer } from './db';
import { logError, logInfo } from '@/modules/core/lib/logger';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

// Helper to get a value from a potentially nested object
const getValue = (obj: any, path: string[], defaultValue: any = '') => {
    return path.reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : defaultValue, obj);
};

const parseDecimal = (str: any): number => {
    if (str === null || str === undefined || str === '') return 0;
    let cleanStr = String(str).trim();

    // Check if comma is used as decimal separator
    if (cleanStr.includes(',')) {
        // Remove thousand separators (dots) and replace decimal comma with a dot
        cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
    } else {
        // No comma found, treat dot as decimal separator (standard US/CR format)
        // We don't need to do anything special here as parseFloat handles it.
    }
    
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
};


interface InvoiceParseResult {
    lines: CostAssistantLine[];
    invoiceInfo: Omit<ProcessedInvoiceInfo, 'status' | 'errorMessage'>;
}

async function parseInvoice(xmlContent: string, fileIndex: number): Promise<InvoiceParseResult | { error: string, details: Partial<ProcessedInvoiceInfo> }> {
    
    const parser = new XMLParser({
        ignoreAttributes: true,
        removeNSPrefix: true, 
        parseTagValue: false, 
        isArray: (tagName) => {
            const alwaysArray = ['LineaDetalle', 'CodigoComercial'];
            return alwaysArray.includes(tagName);
        },
    });

    let json;
    try {
        json = parser.parse(xmlContent);
    } catch (e: any) {
        logError('XML parsing failed', { error: e.message, content: xmlContent.substring(0, 500) });
        return { error: 'XML malformado o ilegible.', details: {} };
    }
    
    if (json.MensajeHacienda) {
        // This is a response from Hacienda, not an invoice. We should ignore it.
        return { error: 'El archivo es una respuesta de Hacienda, no una factura.', details: {} };
    }
    
    const rootNode = json.FacturaElectronica;
    
    if (!rootNode) {
        const detectedRoot = Object.keys(json)[0] || 'N/A';
        logError('Invalid XML structure for invoice', { detectedRoot });
        if (detectedRoot === 'html' || detectedRoot.startsWith('?xml')) {
            return { error: 'El archivo es un documento HTML o XML inválido, no una factura.', details: {} };
        }
        return { error: `No es un archivo de factura válido. Nodo raíz no encontrado: ${detectedRoot}`, details: {} };
    }
    
    const clave = getValue(rootNode, ['Clave'], `unknown-key-${fileIndex}`);
    const numeroConsecutivo = getValue(rootNode, ['NumeroConsecutivo'], clave.substring(21, 41));
    const fechaEmision = getValue(rootNode, ['FechaEmision'], new Date().toISOString());
    const emisorNombre = getValue(rootNode, ['Emisor', 'Nombre'], 'Desconocido');

    const invoiceInfo = {
        supplierName: emisorNombre,
        invoiceNumber: numeroConsecutivo,
        invoiceDate: fechaEmision,
    };

    const detalleServicio = getValue(rootNode, ['DetalleServicio']);
    if (!detalleServicio || !detalleServicio.LineaDetalle) {
        return { lines: [], invoiceInfo };
    }

    const lineasDetalle = Array.isArray(detalleServicio.LineaDetalle) ? detalleServicio.LineaDetalle : [detalleServicio.LineaDetalle];

    const moneda = getValue(rootNode, ['ResumenFactura', 'CodigoTipoMoneda', 'CodigoMoneda'], 'CRC');
    const tipoCambioStr = getValue(rootNode, ['ResumenFactura', 'CodigoTipoMoneda', 'TipoCambio'], '1');
    const tipoCambio = parseDecimal(tipoCambioStr) || 1.0;


    const lines: CostAssistantLine[] = [];
    for (const [index, linea] of lineasDetalle.entries()) {
        const cantidad = parseDecimal(getValue(linea, ['Cantidad'], '0'));
        if (cantidad === 0) continue;
        
        let supplierCode = 'N/A';
        const codigosComercialesRaw = linea.CodigoComercial || [];
        const codigosComerciales = Array.isArray(codigosComercialesRaw) ? codigosComercialesRaw : [codigosComercialesRaw];
        
        if (codigosComerciales.length > 0) {
            const preferredCodeNode = codigosComerciales.find((c: any) => c.Tipo === '01' || c.Tipo === '04');
            if (preferredCodeNode && preferredCodeNode.Codigo) {
                supplierCode = preferredCodeNode.Codigo;
            } else if (codigosComerciales.length > 0 && codigosComerciales[0].Codigo) {
                supplierCode = codigosComerciales[0].Codigo;
            }
        }
        
        const cabysV43 = getValue(linea, ['Codigo']);
        const cabysV44 = getValue(linea, ['CodigoCABYS']);
        const cabysCode = cabysV44 || cabysV43 || 'N/A';
        
        const montoTotalLinea = parseDecimal(getValue(linea, ['MontoTotalLinea'], '0'));
        
        const descuentoNode = getValue(linea, ['Descuento']);
        const descuentoTotal = descuentoNode ? parseDecimal(getValue(descuentoNode, ['MontoDescuento'], '0')) : 0;
        
        const subTotal = parseDecimal(getValue(linea, ['SubTotal'], '0'));
        
        const subTotalWithDiscount = subTotal - descuentoTotal;
        
        const unitCostWithTax = cantidad > 0 ? montoTotalLinea / cantidad : 0;
        const unitCostWithoutTax = cantidad > 0 ? subTotalWithDiscount / cantidad : 0;

        const impuestoNode = getValue(linea, ['Impuesto']);
        let taxRate = 0.13; // Default
        if (impuestoNode) {
            const tarifaStr = getValue(impuestoNode, ['Tarifa'], '13');
            taxRate = parseDecimal(tarifaStr) / 100;
        }
        
        const unitCostWithTaxInColones = moneda === 'USD' ? unitCostWithTax * tipoCambio : unitCostWithTax;
        const unitCostWithoutTaxInColones = moneda === 'USD' ? unitCostWithoutTax * tipoCambio : unitCostWithoutTax;
        
        const numeroLinea = getValue(linea, ['NumeroLinea'], index + 1);

        lines.push({
            id: `${numeroConsecutivo}-${numeroLinea}-${supplierCode}-${index}`,
            invoiceKey: numeroConsecutivo,
            lineNumber: numeroLinea,
            cabysCode: cabysCode,
            supplierCode: supplierCode,
            description: getValue(linea, ['Detalle']),
            quantity: cantidad,
            unitCostWithTax: unitCostWithTaxInColones,
            unitCostWithoutTax: unitCostWithoutTaxInColones,
            taxRate: taxRate,
            displayMargin: "20",
            margin: 0.20,
            finalSellPrice: 0, // Calculated in the frontend
            profitPerLine: 0, // Calculated in the frontend
            sellPriceWithoutTax: 0, // Calculated in the frontend
            supplierName: emisorNombre,
        });
    }

    return { lines, invoiceInfo };
}

export async function processInvoiceXmls(xmlContents: string[]): Promise<{ lines: CostAssistantLine[], processedInvoices: ProcessedInvoiceInfo[] }> {
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
            } else if (result && 'error' in result && result.details.supplierName) {
                 processedInvoices.push({
                    supplierName: result.details.supplierName || 'Desconocido',
                    invoiceNumber: result.details.invoiceNumber || 'N/A',
                    invoiceDate: result.details.invoiceDate || new Date().toISOString(),
                    status: 'error',
                    errorMessage: result.error
                });
            }
        } catch (error: any) {
            console.error("Error parsing one of the XMLs:", error.message);
            processedInvoices.push({
                supplierName: 'Desconocido',
                invoiceNumber: 'N/A',
                invoiceDate: new Date().toISOString(),
                status: 'error',
                errorMessage: 'XML malformado o ilegible'
            });
        }
    }
    
    return { lines: allLines, processedInvoices };
}

export async function getCostAssistantSettings(): Promise<CostAssistantSettings> {
    return getCostAssistantSettingsServer();
}

export async function saveCostAssistantSettings(settings: CostAssistantSettings): Promise<void> {
    return saveCostAssistantSettingsServer(settings);
}

export async function getAllDrafts(userId: number): Promise<CostAnalysisDraft[]> {
    return getAllDraftsServer(userId);
}

export async function saveDraft(draft: CostAnalysisDraft): Promise<void> {
    await logInfo('Cost analysis draft saved', { name: draft.name, userId: draft.userId });
    return saveDraftServer(draft);
}

export async function deleteDraft(id: string): Promise<void> {
    await logInfo('Cost analysis draft deleted', { draftId: id });
    return deleteDraftServer(id);
}

export async function exportForERP(lines: CostAssistantLine[]): Promise<string> {
    const dataForExport = lines.map(line => ({
        'COD_ARTICULO': line.supplierCode,
        'PRECIO_BASE_LOCAL': line.sellPriceWithoutTax,
        'IMPUESTO': line.taxRate * 100,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Articulos');
    
    const exportDir = path.join(process.cwd(), 'dbs', 'temp_exports');
    if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const fileName = `export_erp_${Date.now()}.xlsx`;
    const filePath = path.join(exportDir, fileName);

    try {
        // Generate the file content in memory as a buffer
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
        
        // Use fs.writeFileSync to save the buffer to the file system
        fs.writeFileSync(filePath, buffer);
    } catch (error: any) {
        logError("Failed to save Excel file to disk", { error: error.message, path: filePath });
        throw new Error(`cannot save file\n${filePath}`);
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
        } catch (error: any) {
            logError("Failed to delete temporary export file", { error: error.message, file: fileName });
            throw new Error("Error del servidor al limpiar el archivo temporal.");
        }
    }
}
