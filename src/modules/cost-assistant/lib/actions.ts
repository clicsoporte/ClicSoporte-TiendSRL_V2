/**
 * @fileoverview Client-side functions for the Cost Assistant module.
 */
'use server';

import { XMLParser } from 'fast-xml-parser';
import type { CostAssistantLine, ProcessedInvoiceInfo } from '@/modules/core/types';
import { getCostAssistantSettings as getCostAssistantSettingsServer, saveCostAssistantSettings as saveCostAssistantSettingsServer, type CostAssistantSettings } from './db';

// Helper to get a value from a potentially nested object
const getValue = (obj: any, path: string[], defaultValue: any = '') => {
    return path.reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : defaultValue, obj);
};

const parseDecimal = (str: any): number => {
    if (typeof str !== 'string' && typeof str !== 'number') return 0;
    const cleanStr = String(str).trim();

    // If it's a simple number string, parse it directly
    if (!isNaN(Number(cleanStr))) {
        return Number(cleanStr);
    }

    const hasComma = cleanStr.includes(',');
    const hasPoint = cleanStr.includes('.');

    // Handle formats like "1,234.56" (USA)
    if (hasPoint && hasComma) {
        return parseFloat(cleanStr.replace(/,/g, '')) || 0;
    }
    
    // Handle formats like "1.234,56" (Europe)
    if (hasPoint && hasComma) {
         return parseFloat(cleanStr.replace(/\./g, '').replace(',', '.')) || 0;
    }

    // Handle "2.000" which can mean 2 or 2000 depending on context.
    // In CR XMLs, a '.' is usually a thousands separator for integers if there are 3 digits after it.
    if (hasPoint && !hasComma) {
        const parts = cleanStr.split('.');
        if (parts.length === 2 && parts[1].length === 3) {
            // Likely a thousands separator for an integer, e.g., "2.000" should be 2, not 2000.
            // Or "10.000" for 10. Let's treat as a decimal for consistency and let parseFloat handle it.
            return parseFloat(parts.join('')) || 0;
        }
         return parseFloat(cleanStr) || 0;
    }

    if (hasComma && !hasPoint) {
        return parseFloat(cleanStr.replace(',', '.')) || 0;
    }

    return parseFloat(cleanStr) || 0;
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

    const json = parser.parse(xmlContent);

    const rootNode = json.FacturaElectronica;
    const responseNode = json.MensajeHacienda;

    if (!rootNode && !responseNode) {
        const detectedRoot = Object.keys(json)[0] || 'N/A';
        if (detectedRoot === 'html' || detectedRoot.startsWith('?')) {
            return { error: 'El archivo es un documento HTML o XML inválido, no una factura.', details: {} };
        }
        return { error: `No es un archivo de factura válido. Nodo raíz no encontrado.`, details: {} };
    }
    
    const isResponseMessage = !!responseNode;
    const invoiceDataNode = isResponseMessage ? responseNode : rootNode;
    
    const numeroConsecutivo = getValue(invoiceDataNode, ['NumeroConsecutivo'], getValue(invoiceDataNode, ['Clave'], 'N/A').substring(21, 41));
    const fechaEmision = getValue(invoiceDataNode, ['FechaEmision'], new Date().toISOString());
    const emisorNombre = getValue(invoiceDataNode, ['Emisor', 'Nombre'], getValue(invoiceDataNode, ['NombreEmisor'], 'Desconocido'));
    
    const defaultErrorDetails = {
        supplierName: emisorNombre,
        invoiceNumber: numeroConsecutivo,
        invoiceDate: fechaEmision,
    };
    
    if (isResponseMessage) {
        return { error: 'XML es una respuesta de Hacienda, no una factura.', details: defaultErrorDetails };
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

    const lineasDetalle = Array.isArray(detalleServicio.LineaDetalle) 
        ? detalleServicio.LineaDetalle 
        : [detalleServicio.LineaDetalle];

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
        const subTotal = parseDecimal(getValue(linea, ['SubTotal'], '0'));
        
        const unitCostWithTax = montoTotalLinea / cantidad;
        const unitCostWithoutTax = subTotal / cantidad;

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
