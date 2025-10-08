/**
 * @fileoverview Client-side functions for the Cost Assistant module.
 */
'use server';

import { parseStringPromise } from 'xml2js';
import type { CostAssistantLine, ProcessedInvoiceInfo } from '@/modules/core/types';
import { getCostAssistantSettings as getCostAssistantSettingsServer, saveCostAssistantSettings as saveCostAssistantSettingsServer, type CostAssistantSettings } from './db';


// Helper to get a value from a potentially nested XML object
const getValue = (obj: any, path: string[], defaultValue: any = '') => {
    return path.reduce((acc, key) => (acc && acc[key] && acc[key][0]) ? acc[key][0] : defaultValue, obj);
};

const parseDecimal = (str: string): number => {
    if (typeof str !== 'string' || !str) return 0;
    
    const cleanStr = str.trim();
    const hasComma = cleanStr.includes(',');
    const hasPoint = cleanStr.includes('.');

    // Case: "1,234.56" (US/UK) or "1234.56"
    // Or, for CR invoices: "2.000" where the point is a thousands separator for an integer.
    if (hasPoint && !hasComma) {
        const parts = cleanStr.split('.');
        // If the last part has fewer than 3 digits, it's likely a decimal, e.g., "123.45"
        // If it has 3, it's ambiguous (e.g., "2.000" could be 2 or 2000). We assume integer if it's 3 digits.
        if (parts[parts.length - 1].length < 3) {
            return parseFloat(cleanStr.replace(/,/g, '')) || 0;
        }
        // It's likely a thousands separator, e.g., "2.000" should be 2.
        return parseFloat(parts.join('')) || 0;
    }
    
    // Case: "1.234,56" (EU)
    if (hasComma) {
        const europeanStyleStr = cleanStr.replace(/\./g, '').replace(',', '.');
        return parseFloat(europeanStyleStr) || 0;
    }
    
    // Default case (integer as string, e.g., "1000")
    return parseFloat(cleanStr) || 0;
};

interface InvoiceParseResult {
    lines: CostAssistantLine[];
    invoiceInfo: Omit<ProcessedInvoiceInfo, 'status' | 'errorMessage'>;
}

async function parseInvoice(xmlContent: string): Promise<InvoiceParseResult | { error: string, details: Partial<ProcessedInvoiceInfo> }> {
    const json = await parseStringPromise(xmlContent, {
        explicitArray: true,
        trim: true,
        charkey: '_',
        attrkey: '$',
    });

    const rootKey = Object.keys(json)[0];
    
    const numeroConsecutivo = getValue(json[rootKey], ['NumeroConsecutivo', '0'], 'N/A');
    const fechaEmision = getValue(json[rootKey], ['FechaEmision', '0'], new Date().toISOString());
    const emisorNombre = getValue(json[rootKey], ['Emisor', '0', 'Nombre', '0']);

    const defaultErrorDetails = {
        supplierName: emisorNombre || "Desconocido",
        invoiceNumber: numeroConsecutivo,
        invoiceDate: fechaEmision,
    };
    
    if (rootKey !== 'FacturaElectronica') {
        return { error: 'No es una Factura Electrónica', details: defaultErrorDetails };
    }

    const rootNode = json.FacturaElectronica;
    
    const moneda = getValue(rootNode, ['ResumenFactura', '0', 'CodigoTipoMoneda', '0', 'CodigoMoneda'], 'CRC');
    const tipoCambioStr = getValue(rootNode, ['ResumenFactura', '0', 'CodigoTipoMoneda', '0', 'TipoCambio'], '1');
    const tipoCambio = parseFloat(tipoCambioStr) || 1.0;
    
    const invoiceInfo = {
        supplierName: emisorNombre,
        invoiceNumber: numeroConsecutivo,
        invoiceDate: fechaEmision,
    };

    const detalleServicio = getValue(rootNode, ['DetalleServicio', '0']);
    if (!detalleServicio || !detalleServicio.LineaDetalle) {
        return { lines: [], invoiceInfo };
    }

    const lines: CostAssistantLine[] = [];
    for (const linea of detalleServicio.LineaDetalle) {
        
        const cantidadStr = getValue(linea, ['Cantidad'], '0');
        const cantidad = parseDecimal(cantidadStr);
        
        if (cantidad === 0) continue;

        let supplierCode = 'N/A';
        const codigosComerciales = linea.CodigoComercial;
        if (codigosComerciales && codigosComerciales.length > 0) {
            const codigoNode = codigosComerciales.find((c: any) => c.Tipo[0] === '01' || c.Tipo[0] === '04')?.Codigo[0];
            if (codigoNode) {
                supplierCode = codigoNode;
            }
        }
        
        const cabysV43 = getValue(linea, ['Codigo']);
        const cabysV44 = getValue(linea, ['CodigoCABYS']);
        const cabysCode = cabysV44 || cabysV43;
        
        const montoTotalLineaStr = getValue(linea, ['MontoTotalLinea'], '0');
        const montoTotalLinea = parseDecimal(montoTotalLineaStr);

        const subTotalStr = getValue(linea, ['SubTotal'], '0');
        const subTotal = parseDecimal(subTotalStr);
        
        const unitCostWithTax = montoTotalLinea / cantidad;
        const unitCostWithoutTax = subTotal / cantidad;

        const impuestoNode = getValue(linea, ['Impuesto', '0']);
        let taxRate = 0.13; // Default
        if (impuestoNode) {
            const tarifaStr = getValue(impuestoNode, ['Tarifa'], '13');
            taxRate = parseDecimal(tarifaStr) / 100;
        }
        
        const unitCostWithTaxInColones = moneda === 'USD' ? unitCostWithTax * tipoCambio : unitCostWithTax;
        const unitCostWithoutTaxInColones = moneda === 'USD' ? unitCostWithoutTax * tipoCambio : unitCostWithoutTax;
        
        lines.push({
            id: '', // Will be generated in the hook
            invoiceKey: numeroConsecutivo,
            lineNumber: parseInt(getValue(linea, ['NumeroLinea'], '0')),
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

    for (const xmlContent of xmlContents) {
        try {
            const result = await parseInvoice(xmlContent);
            if (result && 'lines' in result) {
                allLines = [...allLines, ...result.lines];
                processedInvoices.push({
                    ...result.invoiceInfo,
                    status: 'success'
                });
            } else if (result && 'error' in result) {
                 processedInvoices.push({
                    ...result.details,
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
