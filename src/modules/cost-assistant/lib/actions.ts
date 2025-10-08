/**
 * @fileoverview Client-side functions for the Cost Assistant module.
 */
'use server';

import { parseStringPromise } from 'xml2js';
import type { CostAssistantLine } from '@/modules/core/types';

// Helper to get a value from a potentially nested XML object
const getValue = (obj: any, path: string[], defaultValue: any = '') => {
    return path.reduce((acc, key) => (acc && acc[key] && acc[key][0]) ? acc[key][0] : defaultValue, obj);
};

async function parseInvoice(xmlContent: string): Promise<CostAssistantLine[]> {
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
        return [];
    }

    const lines: CostAssistantLine[] = [];
    for (const linea of detalleServicio.LineaDetalle) {
        const cantidad = parseFloat(getValue(linea, ['Cantidad'], '0'));
        if (cantidad === 0) continue;

        let supplierCode = 'N/A';
        const codigosComerciales = linea.CodigoComercial;
        if (codigosComerciales && codigosComerciales.length > 0) {
            const codigoNode = codigosComerciales[0]?.Codigo;
            if (codigoNode && codigoNode[0]) {
                supplierCode = codigoNode[0];
            }
        }
        
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
            cabysCode: getValue(linea, ['Codigo']),
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

    return lines;
}

export async function processInvoiceXmls(xmlContents: string[]): Promise<CostAssistantLine[]> {
    let allLines: CostAssistantLine[] = [];

    for (const xmlContent of xmlContents) {
        try {
            const lines = await parseInvoice(xmlContent);
            allLines = [...allLines, ...lines];
        } catch (error: any) {
            console.error("Error parsing one of the XMLs:", error);
            // We can decide to throw or just skip the failed file. Let's skip.
        }
    }
    
    return allLines;
}
