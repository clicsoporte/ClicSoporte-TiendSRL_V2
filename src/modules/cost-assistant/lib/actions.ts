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

    // Case: "1,234.56" (US/UK style) or integers with comma thousands separators
    if (hasPoint && hasComma) {
        return parseFloat(cleanStr.replace(/\./g, '').replace(',', '.')) || 0;
    }
    
    // Case: "1.234,56" (EU style)
    if (hasComma) {
        return parseFloat(cleanStr.replace(/\./g, '').replace(',', '.')) || 0;
    }

    // Handles cases like "2.000" which should be 2, not 2000.
    // This happens when a point is used as a thousands separator for integers.
    // We check if the part after the last dot is exactly 3 digits long, which is a common pattern for this.
    if (hasPoint && cleanStr.split('.').pop()?.length === 3) {
        // Check if there are other points, suggesting it's a thousands separator
        if (cleanStr.split('.').length - 1 > 1 || parseFloat(cleanStr) > 1000) {
             return parseFloat(cleanStr.replace(/\./g, '')) || 0;
        }
    }

    // Default case for numbers like "1234.56" or "1000"
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
        // --- THIS IS THE CRITICAL FIX ---
        // It tells xml2js to ignore namespaces, so <FacturaElectronica xmlns="..."> becomes just 'FacturaElectronica'
        ignoreAttrs: true, 
        tagNameProcessors: [(name) => name.split(':').pop() || name],
    });

    const rootKey = Object.keys(json)[0];
    const rootNode = json[rootKey];
    
    const numeroConsecutivo = getValue(rootNode, ['NumeroConsecutivo', '0'], 'N/A');
    const fechaEmision = getValue(rootNode, ['FechaEmision', '0'], new Date().toISOString());
    const emisorNombre = getValue(rootNode, ['Emisor', '0', 'Nombre', '0']);

    const defaultErrorDetails = {
        supplierName: emisorNombre || "Desconocido",
        invoiceNumber: numeroConsecutivo,
        invoiceDate: fechaEmision,
    };
    
    if (rootKey !== 'FacturaElectronica' && rootKey !== 'MensajeHacienda') {
        return { error: 'No es un archivo de factura válido.', details: defaultErrorDetails };
    }
    if (rootKey === 'MensajeHacienda') {
        return { error: 'XML es una respuesta de Hacienda, no una factura.', details: defaultErrorDetails };
    }
    
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
