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

    // Case 1: Standard US format or integer (e.g., "1234.56" or "1234")
    // Or CR format where '.' is the decimal separator (e.g., "2.000" for 2, not two thousand)
    if (cleanStr.includes('.') && !cleanStr.includes(',')) {
        // It could be "1000.00" (one thousand) or "2.000" (two, with 3 decimal places)
        // A common pattern in CR XMLs is using '.' as a decimal separator with many trailing zeros.
        return parseFloat(cleanStr) || 0;
    }

    // Case 2: European style with comma as decimal (e.g., "1.234,56")
    if (cleanStr.includes(',')) {
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

async function parseInvoice(xmlContent: string): Promise<InvoiceParseResult> {
    const json = await parseStringPromise(xmlContent, {
        explicitArray: true,
        trim: true,
        charkey: '_',
        attrkey: '$',
    });

    const rootNode = Object.values(json)[0] as any; // FacturaElectronica or other root
    
    const clave = getValue(rootNode, ['Clave'], 'N/A');
    const emisorNombre = getValue(rootNode, ['Emisor', 'Nombre']);
    const moneda = getValue(rootNode, ['ResumenFactura', 'CodigoTipoMoneda', 'CodigoMoneda'], 'CRC');
    const tipoCambioStr = getValue(rootNode, ['ResumenFactura', 'CodigoTipoMoneda', 'TipoCambio'], '1');
    const tipoCambio = parseFloat(tipoCambioStr) || 1.0;

    const detalleServicio = getValue(rootNode, ['DetalleServicio']);
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
            const codigoNode = codigosComerciales.find((c: any) => c.Tipo[0] === '01')?.Codigo[0];
            if (codigoNode) {
                supplierCode = codigoNode;
            }
        }
        
        // Handle different CABYS tags
        const cabysV43 = getValue(linea, ['Codigo']);
        const cabysV44 = getValue(linea, ['CodigoCABYS']);
        const cabysCode = cabysV44 || cabysV43;
        
        const montoTotalLinea = parseFloat(getValue(linea, ['MontoTotalLinea'], '0'));
        const subTotal = parseFloat(getValue(linea, ['SubTotal'], '0'));
        
        const unitCostWithTax = montoTotalLinea / cantidad;
        const unitCostWithoutTax = subTotal / cantidad;

        const impuestoNode = getValue(linea, ['Impuesto']);
        const taxRate = impuestoNode ? parseFloat(getValue(impuestoNode, ['Tarifa'], '0')) / 100 : 0.13;
        
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
            const { lines, supplierName } = await parseInvoice(xmlContent);
            allLines = [...allLines, ...lines];
            if (supplierName) {
                supplierNames.add(supplierName);
            }
        } catch (error: any) {
            console.error("Error parsing one of the XMLs:", error);
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
