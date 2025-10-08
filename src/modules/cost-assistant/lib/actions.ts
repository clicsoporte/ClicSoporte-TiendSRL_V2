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
        const parts = cleanStr.split('.');
        if (parts.length > 1) {
            const lastPart = parts[parts.length - 1];
            if (lastPart.length === 3) {
                 // It's likely a thousands separator if it's .000
                 if (lastPart === '000') {
                    cleanStr = cleanStr.replace(/\./g, '');
                 }
            }
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
        parseTagValue: false, 
        isArray: (tagName, jPath) => {
            return jPath.endsWith('LineaDetalle') || jPath.endsWith('CodigoComercial');
        },
    });

    let json;
    try {
        json = parser.parse(xmlContent);
    } catch (e: any) {
        return { error: 'XML malformado o ilegible.', details: {} };
    }
    
    // --- Check if it is a valid Invoice or a Response Message ---
    const rootNode = json.FacturaElectronica;
    
    if (json.MensajeHacienda) {
        return { 
            error: 'XML es una respuesta de Hacienda, no una factura.', 
            details: {
                supplierName: getValue(json, ['MensajeHacienda', 'NombreEmisor'], 'Respuesta Hacienda'),
                invoiceNumber: 'N/A',
                invoiceDate: new Date().toISOString(),
            } 
        };
    }
    
    if (!rootNode) {
        const detectedRoot = Object.keys(json)[0] || 'N/A';
        if (detectedRoot === 'html' || detectedRoot.startsWith('?xml')) {
            return { error: 'El archivo es un documento HTML o XML inválido, no una factura.', details: {} };
        }
        return { error: `No es un archivo de factura válido. Nodo raíz no encontrado: ${detectedRoot}`, details: {} };
    }
    
    const numeroConsecutivo = getValue(rootNode, ['NumeroConsecutivo'], 'N/A');
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
        const codigosComercialesRaw = linea.CodigoComercial;
        const codigosComerciales = Array.isArray(codigosComercialesRaw) ? codigosComercialesRaw : (codigosComercialesRaw ? [codigosComercialesRaw] : []);
        
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
            id: `${numeroConsecutivo}-${numeroLinea}-${index}`,
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
