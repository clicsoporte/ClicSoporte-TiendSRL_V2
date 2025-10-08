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
import { FileScan, UploadCloud, Loader2, Percent, Calculator, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="grid gap-8 lg:grid-cols-3">
                {/* Main Content: Table and Upload */}
                <div className="lg:col-span-2 space-y-6">
                     <Card>
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-600 text-white">
                                    <FileScan className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl">Asistente de Costos y Precios</CardTitle>
                                    <CardDescription>Carga facturas de compra en formato XML para extraer artículos y calcular precios de venta.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <div {...getRootProps()} className={cn("flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors", isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50', state.isProcessing && 'cursor-not-allowed opacity-50')}>
                                <input {...getInputProps()} disabled={state.isProcessing}/>
                                {state.isProcessing ? (
                                    <>
                                        <Loader2 className="h-12 w-12 text-primary animate-spin" />
                                        <p className="mt-4 text-center text-primary">Procesando facturas...</p>
                                    </>
                                ) : (
                                    <>
                                        <UploadCloud className="w-12 h-12 text-muted-foreground" />
                                        <p className="mt-4 text-center text-muted-foreground">
                                            {isDragActive ? "Suelta los archivos XML aquí..." : "Arrastra los archivos XML aquí o haz clic para seleccionar"}
                                        </p>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle>Artículos Extraídos</CardTitle>
                            <CardDescription>Ajusta los márgenes de ganancia para calcular el precio de venta final.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-lg border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="min-w-[150px]">Cód. Artículo</TableHead>
                                            <TableHead>Descripción</TableHead>
                                            <TableHead className="text-right">Cant.</TableHead>
                                            <TableHead className="text-right min-w-[150px]">Costo Unit. (c/IVA)</TableHead>
                                            <TableHead className="w-[100px] text-right">Margen</TableHead>
                                            <TableHead className="text-right min-w-[150px]">P.V.P Sugerido</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {state.lines.length > 0 ? state.lines.map((line, index) => (
                                            <TableRow key={line.id}>
                                                <TableCell className="font-mono text-xs">{line.supplierCode}</TableCell>
                                                <TableCell>{line.description}</TableCell>
                                                <TableCell className="text-right font-medium">{line.quantity}</TableCell>
                                                <TableCell className="text-right font-mono">{actions.formatCurrency(line.unitCostWithTax)}</TableCell>
                                                <TableCell>
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
                                                <TableCell className="text-right font-bold text-lg text-primary">{actions.formatCurrency(line.finalSellPrice)}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => actions.removeLine(line.id)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-24 text-center">
                                                    Carga un archivo XML para ver los artículos.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Side Panel: Costs and Totals */}
                <div className="lg:col-span-1 space-y-6">
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
            </div>
        </main>
    );
}
