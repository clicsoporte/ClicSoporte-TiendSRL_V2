/**
 * @fileoverview Client-side functions for the Cost Assistant module.
 */
'use server';

import { parseStringPromise } from 'xml2js';
import type { CostAssistantLine } from '@/modules/core/types';
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
    if (hasPoint && !hasComma) {
        // If it has more than one point, it's likely a thousands separator e.g. 1.234.567
        // But in CR, "2.000" can mean 2, not two thousand. Let's handle this carefully.
        const parts = cleanStr.split('.');
        if (parts.length > 2) { // e.g. 1.234.567 -> treat as integer
            return parseFloat(parts.join(''));
        }
        // "2.000" is ambiguous. It could be 2 or 2000.
        // A common CR format is that if a '.' is present and the part after it is 3 digits long, it's a thousands separator.
        if (parts.length === 2 && parts[1].length === 3) {
             // Heuristic: If it looks like thousands (e.g. 1.000), treat it as such.
             // This assumes we won't get prices like 2.5 dollars written as "2.500".
             return parseFloat(parts.join(''));
        }
        return parseFloat(cleanStr) || 0;
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
    supplierName: string;
}

async function parseInvoice(xmlContent: string): Promise<InvoiceParseResult | null> {
    const json = await parseStringPromise(xmlContent, {
        explicitArray: true,
        trim: true,
        charkey: '_',
        attrkey: '$',
    });

    const rootKey = Object.keys(json)[0];
    if (rootKey !== 'FacturaElectronica') {
        return null; // This is not an invoice, likely a response from Hacienda
    }

    const rootNode = json.FacturaElectronica;
    
    const clave = getValue(rootNode, ['Clave'], 'N/A');
    const emisorNombre = getValue(rootNode, ['Emisor', 'Nombre']);
    const moneda = getValue(rootNode, ['ResumenFactura', '0', 'CodigoTipoMoneda', '0', 'CodigoMoneda'], 'CRC');
    const tipoCambioStr = getValue(rootNode, ['ResumenFactura', '0', 'CodigoTipoMoneda', '0', 'TipoCambio'], '1');
    const tipoCambio = parseFloat(tipoCambioStr) || 1.0;

    const detalleServicio = getValue(rootNode, ['DetalleServicio', '0']);
    if (!detalleServicio || !detalleServicio.LineaDetalle) {
        return { lines: [], supplierName: emisorNombre };
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
            invoiceKey: clave,
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

    return { lines, supplierName: emisorNombre };
}

export async function processInvoiceXmls(xmlContents: string[]): Promise<{ lines: CostAssistantLine[], supplierNames: string[] }> {
    let allLines: CostAssistantLine[] = [];
    const supplierNames = new Set<string>();

    for (const xmlContent of xmlContents) {
        try {
            const result = await parseInvoice(xmlContent);
            if (result) {
                allLines = [...allLines, ...result.lines];
                if (result.supplierName) {
                    supplierNames.add(result.supplierName);
                }
            }
        } catch (error: any) {
            console.error("Error parsing one of the XMLs:", error.message);
            // We can decide to throw or just skip the failed file. Let's skip.
        }
    }
    
    return { lines: allLines, supplierNames: Array.from(supplierNames) };
}

export async function getCostAssistantSettings(): Promise<CostAssistantSettings> {
    return getCostAssistantSettingsServer();
}

export async function saveCostAssistantSettings(settings: CostAssistantSettings): Promise<void> {
    return saveCostAssistantSettingsServer(settings);
}
