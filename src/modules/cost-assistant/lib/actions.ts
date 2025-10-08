/**
 * @fileoverview Client-side functions for the Cost Assistant module.
 */
'use server';

import { XMLParser } from 'fast-xml-parser';
import type { CostAssistantLine, ProcessedInvoiceInfo } from '@/modules/core/types';
import { getCostAssistantSettings as getCostAssistantSettingsServer, saveCostAssistantSettings as saveCostAssistantSettingsServer, type CostAssistantSettings } from './db';
import { logError } from '@/modules/core/lib/logger';

// Helper to get a value from a potentially nested object
const getValue = (obj: any, path: string[], defaultValue: any = '') => {
    return path.reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : defaultValue, obj);
};

const parseDecimal = (str: any): number => {
    if (str === null || str === undefined || str === '') return 0;
    let cleanStr = String(str).trim();

    const hasComma = cleanStr.includes(',');
    const hasDot = cleanStr.includes('.');

    if (hasComma) {
        // European format: 1.234,56 -> 1234.56
        cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
    } else if (hasDot) {
        // Could be 1.000 (one thousand) or 1.000 (one) or 1.5 (one and a half)
        const parts = cleanStr.split('.');
        if (parts.length > 1) {
            const lastPart = parts[parts.length - 1];
            // If the last part has 3 digits and there are other parts, it's likely a thousands separator.
            // Example: 1.000 -> 1000. But what about 1.000 meaning 1?
            // The key is that `1.000` is a valid representation for `1` in some XMLs.
            if (lastPart.length === 3) {
                 // It's ambiguous. `1.000` could be 1 or 1000.
                 // A common convention for single units is `1.000`.
                 // Let's treat a single dot with three trailing zeros as an integer.
                 if (parts.length === 2 && lastPart === '000') {
                     cleanStr = parts[0];
                 } else {
                    // It could be 1.234.567, treat all as thousands separators
                    cleanStr = cleanStr.replace(/\./g, '');
                 }
            }
            // If the last part is not 3 digits, it's a decimal separator.
            // Example: '1.5', '12.34'
        }
    }
    
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
};


interface InvoiceParseResult {
    lines: CostAssistantLine[];
    invoiceInfo: Omit<ProcessedInvoiceInfo, 'status' | 'errorMessage'>;
}

async function parseInvoice(xmlContent: string): Promise<InvoiceParseResult | { error: string, details: Partial<ProcessedInvoiceInfo> }> {
    
    const parser = new XMLParser({
        ignoreAttributes: true,
        removeNSPrefix: true, 
        parseTagValue: false, // Keep values as strings for manual parsing
    });

    let json;
    try {
        json = parser.parse(xmlContent);
    } catch (e: any) {
        return { error: 'XML malformado o ilegible.', details: {} };
    }

    const rootNode = json.FacturaElectronica;
    const responseNode = json.MensajeHacienda;
    
    if (!rootNode && !responseNode) {
        const detectedRoot = Object.keys(json)[0] || 'N/A';
        if (detectedRoot === 'html' || detectedRoot.startsWith('?')) {
            return { error: 'El archivo es un documento HTML o XML inválido, no una factura.', details: {} };
        }
        return { error: `No es un archivo de factura válido. Nodo raíz no encontrado: ${detectedRoot}`, details: {} };
    }
    
    const isResponseMessage = !!responseNode;
    
    const numeroConsecutivo = getValue(json, ['FacturaElectronica', 'NumeroConsecutivo'], getValue(json, ['MensajeHacienda', 'Clave'], 'N/A').substring(21, 41));
    const fechaEmision = getValue(json, ['FacturaElectronica', 'FechaEmision'], new Date().toISOString());
    const emisorNombre = getValue(json, ['FacturaElectronica', 'Emisor', 'Nombre'], getValue(json, ['MensajeHacienda', 'NombreEmisor'], 'Desconocido'));
    
    const defaultErrorDetails = {
        supplierName: emisorNombre,
        invoiceNumber: numeroConsecutivo,
        invoiceDate: fechaEmision,
    };
    
    if (isResponseMessage) {
        return { error: 'XML es una respuesta de Hacienda, no una factura.', details: defaultErrorDetails };
    }
    
    if (!rootNode) {
        return { error: 'El nodo <FacturaElectronica> no fue encontrado.', details: defaultErrorDetails };
    }
    
    const invoiceInfo = {
        supplierName: emisorNombre,
        invoiceNumber: numeroConsecutivo,
        invoiceDate: fechaEmision,
    };

    const detalleServicio = getValue(rootNode, ['DetalleServicio']);
    if (!detalleServicio || !detalleServicio.LineaDetalle) {
        return { lines: [], invoiceInfo };
    }

    const lineasDetalleRaw = detalleServicio.LineaDetalle;
    const lineasDetalle = Array.isArray(lineasDetalleRaw) ? lineasDetalleRaw : [lineasDetalleRaw];


    const moneda = getValue(rootNode, ['ResumenFactura', 'CodigoTipoMoneda', 'CodigoMoneda'], 'CRC');
    const tipoCambioStr = getValue(rootNode, ['ResumenFactura', 'CodigoTipoMoneda', 'TipoCambio'], '1');
    const tipoCambio = parseDecimal(tipoCambioStr) || 1.0;


    const lines: CostAssistantLine[] = [];
    for (const linea of lineasDetalle) {
        
        const cantidad = parseDecimal(getValue(linea, ['Cantidad'], '0'));
        if (cantidad === 0) continue;

        let supplierCode = 'N/A';
        const codigosComercialesNode = linea.CodigoComercial;
        if (codigosComercialesNode) {
            const codigosComerciales = Array.isArray(codigosComercialesNode) ? codigosComercialesNode : [codigosComercialesNode];
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
        
        const subTotal = parseDecimal(getValue(linea, ['SubTotal'], '0')) - descuentoTotal;
        
        const unitCostWithTax = cantidad > 0 ? montoTotalLinea / cantidad : 0;
        const unitCostWithoutTax = cantidad > 0 ? subTotal / cantidad : 0;

        const impuestoNode = getValue(linea, ['Impuesto']);
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
