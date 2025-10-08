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

  const hasDot = str.includes('.');
  const hasComma = str.includes(',');

  // Handle cases like "1.000" (one thousand) or "2.000" (two from your example file)
  // If a dot exists and it's followed by exactly 3 digits at the end, it's likely a thousands separator.
  if (hasDot && !hasComma) {
    const parts = str.split('.');
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      // It's likely a thousands separator, like "1.000" or "1.234.567"
      const numberString = parts.join('');
      return parseFloat(numberString) || 0;
    }
  }

  // Standard case: "1,234.56" or "1234.56"
  // Or European style: "1.234,56"
  const cleanedStr = str.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanedStr) || 0;
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
