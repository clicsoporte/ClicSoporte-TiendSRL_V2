/**
 * @fileoverview Custom hook for managing the state and logic of the CostAssistantPage component.
 */
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useToast } from '@/modules/core/hooks/use-toast';
import { usePageTitle } from '@/modules/core/hooks/usePageTitle';
import { useAuthorization } from '@/modules/core/hooks/useAuthorization';
import type { CostAssistantLine } from '@/modules/core/types';
import { processInvoiceXmls } from '../lib/actions';
import { logError } from '@/modules/core/lib/logger';

const normalizeNumber = (value: string): number => {
    if (typeof value !== 'string' || !value.trim()) return 0;
    const standardizedValue = value.replace(/,/g, '.');
    const validNumberString = standardizedValue.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    const parsed = parseFloat(validNumberString);
    return isNaN(parsed) ? 0 : parsed;
};

const initialColumnVisibility = {
    supplierCode: true,
    description: true,
    quantity: true,
    unitCostWithoutTax: true,
    unitCostWithTax: false,
    taxRate: true,
    margin: true,
    sellPriceWithoutTax: true,
    finalSellPrice: true,
    profitPerLine: true,
};

export const useCostAssistant = () => {
    useAuthorization(['dashboard:access']); // Basic access permission
    const { setTitle } = usePageTitle();
    const { toast } = useToast();

    const [state, setState] = useState({
        isProcessing: false,
        lines: [] as CostAssistantLine[],
        transportCost: 0,
        otherCosts: 0,
        columnVisibility: initialColumnVisibility
    });

    useEffect(() => {
        setTitle("Asistente de Costos");
    }, [setTitle]);

    const updateLine = (id: string, updatedFields: Partial<CostAssistantLine>) => {
        setState(prevState => ({
            ...prevState,
            lines: prevState.lines.map(line => 
                line.id === id ? { ...line, ...updatedFields } : line
            ),
        }));
    };
    
    const handleFilesDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;
        
        setState(prevState => ({ ...prevState, isProcessing: true }));
        
        try {
            const fileContents = await Promise.all(
                acceptedFiles.map(file => 
                    new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsText(file);
                    })
                )
            );
            
            const processedLines = await processInvoiceXmls(fileContents);

            const newLines = processedLines.map(line => ({
                ...line,
                id: `${line.invoiceKey}-${line.lineNumber}`,
                displayMargin: "20",
                margin: 0.20,
                finalSellPrice: 0, // Will be calculated by useMemo
                profitPerLine: 0, // Will be calculated by useMemo
            }));
            
            setState(prevState => ({ ...prevState, lines: [...prevState.lines, ...newLines] }));
            toast({ title: "Facturas Procesadas", description: `Se agregaron ${newLines.length} artículos nuevos.` });

        } catch (error: any) {
            logError("Error processing invoice XMLs", { error: error.message });
            toast({ title: "Error al Procesar Archivos", description: error.message, variant: "destructive" });
        } finally {
            setState(prevState => ({ ...prevState, isProcessing: false }));
        }
    }, [toast]);
    
    const removeLine = (id: string) => {
        setState(prevState => ({
            ...prevState,
            lines: prevState.lines.filter(line => line.id !== id)
        }));
    };

    const handleMarginBlur = (lineId: string, displayValue: string) => {
        const numericValue = normalizeNumber(displayValue);
        updateLine(lineId, {
            margin: numericValue / 100,
            displayMargin: String(numericValue)
        });
    };

    const formatCurrency = (amount: number) => {
        return `¢${amount.toLocaleString("es-CR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
    };

    const setColumnVisibility = (column: keyof typeof state.columnVisibility, isVisible: boolean) => {
        setState(prevState => ({
            ...prevState,
            columnVisibility: {
                ...prevState.columnVisibility,
                [column]: isVisible,
            }
        }));
    };

    const totals = useMemo(() => {
        const totalItems = state.lines.reduce((sum, line) => sum + line.quantity, 0);
        const totalPurchaseCost = state.lines.reduce((sum, line) => sum + (line.unitCostWithTax * line.quantity), 0);
        const totalAdditionalCosts = state.transportCost + state.otherCosts;

        const linesWithCosts = state.lines.map(line => {
            const proportionalAdditionalCost = totalItems > 0 ? (totalAdditionalCosts / totalItems) * line.quantity : 0;
            const finalUnitCost = line.unitCostWithoutTax + (proportionalAdditionalCost / line.quantity);
            const sellPriceWithoutTax = finalUnitCost * (1 + line.margin);
            const finalSellPrice = sellPriceWithoutTax * (1 + line.taxRate);
            const profitPerLine = (sellPriceWithoutTax - finalUnitCost) * line.quantity;

            return { ...line, finalSellPrice, sellPriceWithoutTax, profitPerLine };
        });

        // Update state in a stable way if needed, avoiding infinite loops
        Promise.resolve().then(() => {
            const needsUpdate = state.lines.some((line, index) => 
                line.finalSellPrice !== linesWithCosts[index].finalSellPrice || 
                line.profitPerLine !== linesWithCosts[index].profitPerLine
            );
            if (needsUpdate) {
                 setState(prevState => ({...prevState, lines: linesWithCosts}));
            }
        });

        const totalSellValue = linesWithCosts.reduce((sum, line) => sum + (line.finalSellPrice * line.quantity), 0);
        const totalFinalCost = totalPurchaseCost + totalAdditionalCosts;
        const estimatedGrossProfit = totalSellValue - totalFinalCost;

        return { totalPurchaseCost, totalAdditionalCosts, totalFinalCost, totalSellValue, estimatedGrossProfit };
    }, [state.lines, state.transportCost, state.otherCosts]);


    const actions = {
        handleFilesDrop,
        removeLine,
        updateLine,
        handleMarginBlur,
        formatCurrency,
        setTransportCost: (cost: number) => setState(prevState => ({ ...prevState, transportCost: cost })),
        setOtherCosts: (cost: number) => setState(prevState => ({ ...prevState, otherCosts: cost })),
        setColumnVisibility,
    };

    return {
        state: { ...state, totals },
        actions,
    };
};
