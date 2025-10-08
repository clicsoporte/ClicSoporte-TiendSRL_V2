/**
 * @fileoverview Page for the Cost Assistant module.
 * Allows users to upload purchase invoice XMLs and calculate selling prices.
 */
'use client';

import { useCostAssistant } from '@/modules/cost-assistant/hooks/useCostAssistant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDropzone } from 'react-dropzone';
import { FileScan, UploadCloud, Loader2, Percent, Calculator, Trash2, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';

export default function CostAssistantPage() {
    const {
        state,
        actions,
    } = useCostAssistant();

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: actions.handleFilesDrop,
        accept: { 'text/xml': ['.xml'] },
        multiple: true,
    });
    
    const columns = [
        { id: 'cabysCode', label: 'Cabys', defaultVisible: true, minWidth: 'min-w-[150px]' },
        { id: 'supplierCode', label: 'Cód. Artículo', defaultVisible: true, minWidth: 'min-w-[150px]' },
        { id: 'description', label: 'Descripción', defaultVisible: true },
        { id: 'quantity', label: 'Cant.', defaultVisible: true, className: 'text-right' },
        { id: 'unitCostWithoutTax', label: 'Costo Unit. (s/IVA)', defaultVisible: true, minWidth: 'min-w-[150px]', className: 'text-right' },
        { id: 'unitCostWithTax', label: 'Costo Unit. (c/IVA)', defaultVisible: false, minWidth: 'min-w-[150px]', className: 'text-right' },
        { id: 'taxRate', label: 'Imp. %', defaultVisible: true, className: 'text-center' },
        { id: 'margin', label: 'Margen', defaultVisible: true, className: 'w-[120px] text-right', minWidth: 'min-w-[120px]' },
        { id: 'sellPriceWithoutTax', label: 'P.V.P (s/IVA)', defaultVisible: true, minWidth: 'min-w-[150px]', className: 'text-right', tooltip: 'Precio de Venta al Público sin Impuestos' },
        { id: 'finalSellPrice', label: 'P.V.P Sugerido', defaultVisible: true, minWidth: 'min-w-[150px]', className: 'text-right', tooltip: 'Precio de Venta al Público final (con IVA incluido)' },
        { id: 'profitPerLine', label: 'Ganancia Bruta', defaultVisible: true, minWidth: 'min-w-[150px]', className: 'text-right' },
    ];

    return (
        <TooltipProvider>
            <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                     <div className="lg:col-span-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Costos Adicionales</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="transport-cost">Costo de Transporte (Total)</Label>
                                    <Input 
                                        id="transport-cost" 
                                        type="number" 
                                        value={state.transportCost || ''}
                                        onChange={(e) => actions.setTransportCost(Number(e.target.value))}
                                        placeholder="Ej: 5000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="other-costs">Otros Costos (Total)</Label>
                                    <Input 
                                        id="other-costs" 
                                        type="number" 
                                        value={state.otherCosts || ''}
                                        onChange={(e) => actions.setOtherCosts(Number(e.target.value))}
                                        placeholder="Ej: 10000"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5"/>Resumen General</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Costo Total de Compra:</span>
                                    <span className="font-medium">{actions.formatCurrency(state.totals.totalPurchaseCost)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Costos Adicionales Totales:</span>
                                    <span className="font-medium">{actions.formatCurrency(state.totals.totalAdditionalCosts)}</span>
                                </div>
                                <div className="flex justify-between font-bold border-t pt-2">
                                    <span>Costo Total Final:</span>
                                    <span>{actions.formatCurrency(state.totals.totalFinalCost)}</span>
                                </div>
                                <div className="flex justify-between text-green-600 font-bold">
                                    <span>Ingreso Total Estimado (Venta):</span>
                                    <span>{actions.formatCurrency(state.totals.totalSellValue)}</span>
                                </div>
                                <div className="flex justify-between text-blue-700 font-bold text-lg border-t pt-2">
                                    <span>Ganancia Bruta Estimada:</span>
                                    <span>{actions.formatCurrency(state.totals.estimatedGrossProfit)}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-2">
                        <Card>
                             <CardHeader>
                                <CardTitle className="flex items-center gap-2"><FileScan className="h-5 w-5"/>Cargar Facturas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div {...getRootProps()} className={cn("flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors h-full", isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50', state.isProcessing && 'cursor-not-allowed opacity-50')}>
                                    <input {...getInputProps()} disabled={state.isProcessing}/>
                                    {state.isProcessing ? (
                                        <>
                                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                            <p className="mt-2 text-center text-primary text-sm">Procesando...</p>
                                        </>
                                    ) : (
                                        <>
                                            <UploadCloud className="w-8 h-8 text-muted-foreground" />
                                            <p className="mt-2 text-center text-muted-foreground text-sm">
                                                {isDragActive ? "Suelta los XML aquí..." : "Arrastra o haz clic para seleccionar"}
                                            </p>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Artículos Extraídos</CardTitle>
                        <CardDescription>Ajusta los datos y márgenes de ganancia para calcular el precio de venta final.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md p-4 mb-4">
                            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Settings2 className="h-4 w-4"/> Opciones de Visualización</h4>
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                                {columns.map(col => (
                                    <div key={col.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`vis-${col.id}`}
                                            checked={state.columnVisibility[col.id as keyof typeof state.columnVisibility]}
                                            onCheckedChange={(checked) => actions.setColumnVisibility(col.id as keyof typeof state.columnVisibility, !!checked)}
                                        />
                                        <Label htmlFor={`vis-${col.id}`} className="font-normal text-sm">{col.label}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-lg border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {columns.map(col => state.columnVisibility[col.id as keyof typeof state.columnVisibility] && (
                                            <TableHead key={col.id} className={cn(col.minWidth, col.className)}>
                                                {col.tooltip ? (
                                                    <Tooltip>
                                                        <TooltipTrigger className="cursor-help underline decoration-dotted">{col.label}</TooltipTrigger>
                                                        <TooltipContent><p>{col.tooltip}</p></TooltipContent>
                                                    </Tooltip>
                                                ) : col.label}
                                            </TableHead>
                                        ))}
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {state.lines.length > 0 ? state.lines.map((line) => (
                                        <TableRow key={line.id}>
                                            {state.columnVisibility.cabysCode && <TableCell><Input value={line.cabysCode} onChange={e => actions.updateLine(line.id, { cabysCode: e.target.value })} className="font-mono text-xs"/></TableCell>}
                                            {state.columnVisibility.supplierCode && <TableCell><Input value={line.supplierCode} onChange={e => actions.updateLine(line.id, { supplierCode: e.target.value })} className="font-mono text-xs"/></TableCell>}
                                            {state.columnVisibility.description && <TableCell><Input value={line.description} onChange={e => actions.updateLine(line.id, { description: e.target.value })} /></TableCell>}
                                            {state.columnVisibility.quantity && <TableCell><Input type="number" value={line.quantity} onChange={e => actions.updateLine(line.id, { quantity: Number(e.target.value) })} className="text-right font-medium" /></TableCell>}
                                            {state.columnVisibility.unitCostWithoutTax && <TableCell><Input type="number" value={line.unitCostWithoutTax} onChange={e => actions.updateLine(line.id, { unitCostWithoutTax: Number(e.target.value) })} className="text-right font-mono"/></TableCell>}
                                            {state.columnVisibility.unitCostWithTax && <TableCell className="text-right font-mono">{actions.formatCurrency(line.unitCostWithTax)}</TableCell>}
                                            {state.columnVisibility.taxRate && <TableCell className="text-center font-mono text-xs">{`${(line.taxRate * 100).toFixed(0)}%`}</TableCell>}
                                            {state.columnVisibility.margin && 
                                                <TableCell className={cn(columns.find(c=>c.id === 'margin')?.minWidth)}>
                                                    <div className="relative">
                                                        <Input 
                                                            type="text" 
                                                            value={line.displayMargin}
                                                            onChange={(e) => actions.updateLine(line.id, { displayMargin: e.target.value })}
                                                            onBlur={(e) => actions.handleMarginBlur(line.id, e.target.value)}
                                                            className="text-right pr-6" 
                                                        />
                                                        <Percent className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                                                    </div>
                                                </TableCell>
                                            }
                                            {state.columnVisibility.sellPriceWithoutTax && <TableCell className="text-right font-mono">{actions.formatCurrency(line.sellPriceWithoutTax || 0)}</TableCell>}
                                            {state.columnVisibility.finalSellPrice && <TableCell className="text-right font-bold text-base text-primary">{actions.formatCurrency(line.finalSellPrice)}</TableCell>}
                                            {state.columnVisibility.profitPerLine && <TableCell className="text-right font-bold text-base text-blue-600">{actions.formatCurrency(line.profitPerLine || 0)}</TableCell>}
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={() => actions.removeLine(line.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                                                Carga un archivo XML para ver los artículos.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </TooltipProvider>
    );
}
