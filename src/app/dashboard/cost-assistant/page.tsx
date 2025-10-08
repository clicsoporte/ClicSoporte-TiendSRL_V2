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
import { FileScan, UploadCloud, Loader2, Percent, Calculator, Trash2, Settings2, FilePlus, Save, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

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
        { id: 'quantity', label: 'Cant.', defaultVisible: true, minWidth: 'min-w-[100px]', className: 'text-right' },
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
                <Card>
                    <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Asistente de Costos y Precios</CardTitle>
                            <CardDescription>Carga facturas XML para extraer artículos, añadir costos y calcular precios de venta.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline"><FilePlus className="mr-2 h-4 w-4"/>Nueva Operación</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Iniciar una nueva operación?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta acción limpiará todos los artículos, costos y proveedores cargados. ¿Deseas continuar?
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={actions.handleClear}>Sí, limpiar todo</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <Button disabled><Save className="mr-2 h-4 w-4"/>Guardar Borrador</Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                             <div className="lg:col-span-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6">
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
                            <div className="lg:col-span-2 space-y-4">
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                     <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" />Proveedores Cargados</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            {state.suppliers.length > 0 ? (
                                                <ul className="space-y-2 text-sm text-muted-foreground">
                                                    {state.suppliers.map((supplier, index) => (
                                                        <li key={index} className="border-b pb-1">{supplier}</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">Aún no se han cargado facturas.</p>
                                            )}
                                        </CardContent>
                                    </Card>
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
                                                    {isDragActive ? "Suelta los XML aquí..." : "Arrastra o haz clic para seleccionar los XML"}
                                                </p>
                                            </>
                                        )}
                                    </div>
                               </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Artículos Extraídos</CardTitle>
                        <CardDescription>Ajusta los datos y márgenes de ganancia para calcular el precio de venta final.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md p-4 mb-4">
                             <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-sm flex items-center gap-2"><Settings2 className="h-4 w-4"/> Opciones de Visualización</h4>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={actions.handleSaveColumnVisibility}>
                                    <Save className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
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

                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader className="hidden md:table-header-group">
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
                                        <TableRow key={line.id} className="flex flex-col md:table-row p-4 md:p-0 border-b last:border-b-0">
                                            {/* Mobile view as a grid, Desktop as table cells */}
                                            {state.columnVisibility.cabysCode && <TableCell className="md:table-cell px-0 md:px-4 py-1 md:py-4"><Label className="md:hidden text-muted-foreground text-xs">Cabys</Label><Input value={line.cabysCode} onChange={e => actions.updateLine(line.id, { cabysCode: e.target.value })} className="h-auto p-0 border-0 font-mono text-xs"/></TableCell>}
                                            {state.columnVisibility.supplierCode && <TableCell className="md:table-cell px-0 md:px-4 py-1 md:py-4"><Label className="md:hidden text-muted-foreground text-xs">Cód. Artículo</Label><Input value={line.supplierCode} onChange={e => actions.updateLine(line.id, { supplierCode: e.target.value })} className="h-auto p-0 border-0 font-mono text-xs"/></TableCell>}
                                            {state.columnVisibility.description && 
                                                <TableCell className="md:table-cell px-0 md:px-4 py-1 md:py-4 font-bold md:font-normal text-base md:text-sm">
                                                    <Label className="md:hidden text-muted-foreground text-xs">Descripción</Label>
                                                    <Input value={line.description} onChange={e => actions.updateLine(line.id, { description: e.target.value })} className="h-auto p-0 border-0"/>
                                                </TableCell>}
                                            
                                            <div className="grid grid-cols-2 md:contents gap-x-4 gap-y-2 mt-2 md:mt-0">
                                                {state.columnVisibility.quantity && <TableCell className={cn("md:table-cell px-0 md:px-4 py-1 md:py-4", columns.find(c=>c.id === 'quantity')?.minWidth)}><Label className="md:hidden text-muted-foreground text-xs">Cant.</Label><Input type="number" value={line.quantity} onChange={e => actions.updateLine(line.id, { quantity: Number(e.target.value) })} className="h-auto p-0 border-0 text-right font-medium" /></TableCell>}
                                                {state.columnVisibility.unitCostWithoutTax && <TableCell className="md:table-cell px-0 md:px-4 py-1 md:py-4"><Label className="md:hidden text-muted-foreground text-xs">Costo Unit. (s/IVA)</Label><Input type="number" value={line.unitCostWithoutTax} onChange={e => actions.updateLine(line.id, { unitCostWithoutTax: Number(e.target.value) })} className="h-auto p-0 border-0 text-right font-mono"/></TableCell>}
                                                {state.columnVisibility.unitCostWithTax && <TableCell className="md:table-cell px-0 md:px-4 py-1 md:py-4"><Label className="md:hidden text-muted-foreground text-xs">Costo Unit. (c/IVA)</Label><span className="block text-right font-mono">{actions.formatCurrency(line.unitCostWithTax)}</span></TableCell>}
                                                {state.columnVisibility.taxRate && <TableCell className="md:table-cell px-0 md:px-4 py-1 md:py-4 text-center"><Label className="md:hidden text-muted-foreground text-xs">Imp. %</Label><span className="block text-center font-mono text-xs">{`${(line.taxRate * 100).toFixed(0)}%`}</span></TableCell>}
                                                {state.columnVisibility.margin && 
                                                    <TableCell className={cn("md:table-cell px-0 md:px-4 py-1 md:py-4", columns.find(c=>c.id === 'margin')?.minWidth)}>
                                                        <Label className="md:hidden text-muted-foreground text-xs">Margen</Label>
                                                        <div className="relative">
                                                            <Input 
                                                                type="text" 
                                                                value={line.displayMargin}
                                                                onChange={(e) => actions.updateLine(line.id, { displayMargin: e.target.value })}
                                                                onBlur={(e) => actions.handleMarginBlur(line.id, e.target.value)}
                                                                className="h-auto p-0 border-0 text-right pr-6" 
                                                            />
                                                            <Percent className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                                                        </div>
                                                    </TableCell>
                                                }
                                                {state.columnVisibility.sellPriceWithoutTax && <TableCell className="md:table-cell px-0 md:px-4 py-1 md:py-4"><Label className="md:hidden text-muted-foreground text-xs">P.V.P (s/IVA)</Label><span className="block text-right font-mono">{actions.formatCurrency(line.sellPriceWithoutTax || 0)}</span></TableCell>}
                                                {state.columnVisibility.finalSellPrice && <TableCell className="md:table-cell px-0 md:px-4 py-1 md:py-4"><Label className="md:hidden text-muted-foreground text-xs">P.V.P Sugerido</Label><span className="block text-right font-bold text-base text-primary">{actions.formatCurrency(line.finalSellPrice)}</span></TableCell>}
                                                {state.columnVisibility.profitPerLine && <TableCell className="md:table-cell px-0 md:px-4 py-1 md:py-4"><Label className="md:hidden text-muted-foreground text-xs">Ganancia Bruta</Label><span className="block text-right font-bold text-base text-blue-600">{actions.formatCurrency(line.profitPerLine || 0)}</span></TableCell>}
                                            </div>
                                            <TableCell className="md:table-cell px-0 md:px-4 py-1 md:py-4 self-center justify-self-end">
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
