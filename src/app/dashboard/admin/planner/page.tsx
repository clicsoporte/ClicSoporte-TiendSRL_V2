/**
 * @fileoverview Configuration page for TI Project Manager.
 */
'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/modules/core/hooks/use-toast";
import { logError, logInfo } from "@/modules/core/lib/logger";
import type { PlannerSettings } from "@/modules/core/types";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import { useAuthorization } from "@/modules/core/hooks/useAuthorization";
import { getPlannerSettings, savePlannerSettings } from "@/modules/planner/lib/actions";
import { PlusCircle, Trash2, Save, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function PlannerSettingsPage() {
    const { isAuthorized } = useAuthorization(['admin:settings:planner']);
    const { setTitle } = usePageTitle();
    const { toast } = useToast();
    const [settings, setSettings] = useState<PlannerSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [newAssignment, setNewAssignment] = useState({ id: "", name: "" });

    useEffect(() => {
        setTitle("Configuración del Gestor de Proyectos");
        const loadSettings = async () => {
            setIsLoading(true);
            try {
                const currentSettings = await getPlannerSettings();
                setSettings(currentSettings);
            } catch (error) {
                console.error("Failed to load settings:", error);
            } finally {
                setIsLoading(false);
            }
        };
        if (isAuthorized) {
            loadSettings();
        }
    }, [setTitle, isAuthorized]);

    const handleAddAssignment = () => {
        if (!settings || !newAssignment.id || !newAssignment.name) {
            toast({ title: "Datos incompletos", description: "El ID y el Nombre de la asignación son requeridos.", variant: "destructive" });
            return;
        }
        if (settings.assignments.some(m => m.id === newAssignment.id)) {
            toast({ title: "ID Duplicado", description: "Ya existe una asignación con ese ID.", variant: "destructive" });
            return;
        }
        setSettings(prev => prev ? { ...prev, assignments: [...prev.assignments, newAssignment] } : null);
        setNewAssignment({ id: "", name: "" });
    };

    const handleDeleteAssignment = (id: string) => {
        if (!settings) return;
        setSettings(prev => prev ? { ...prev, assignments: prev.assignments.filter(m => m.id !== id) } : null);
        toast({ title: "Asignación Eliminada", description: "La asignación ha sido eliminada. Guarda los cambios para confirmar.", variant: "destructive"});
    };

    const handleSave = async () => {
        if (!settings) return;
        setIsSaving(true);
        try {
            await savePlannerSettings(settings);
            toast({ title: "Configuración Guardada", description: "Los ajustes del gestor de proyectos han sido guardados." });
            await logInfo("Planner settings updated", { settings });
        } catch (error: unknown) {
            logError("Failed to save planner settings", { error: (error as Error).message });
            toast({ title: "Error", description: "No se pudieron guardar los ajustes.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    if (!isAuthorized) {
        return null;
    }
    
    if (isLoading || !settings) {
        return (
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                <div className="mx-auto max-w-4xl space-y-6">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </main>
        );
    }

    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-4xl space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Configuración del Gestor de Proyectos</CardTitle>
                        <CardDescription>Ajustes generales para el módulo de gestión de proyectos y tareas.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-2">
                                <Label htmlFor="projectPrefix">Prefijo de Proyecto</Label>
                                <Input
                                    id="projectPrefix"
                                    value={settings.projectPrefix || ''}
                                    onChange={(e) => setSettings(prev => prev ? { ...prev, projectPrefix: e.target.value } : null)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="nextProjectNumber">Próximo Número de Proyecto</Label>
                                <Input
                                    id="nextProjectNumber"
                                    type="number"
                                    value={settings.nextProjectNumber || 1}
                                    onChange={(e) => setSettings(prev => prev ? { ...prev, nextProjectNumber: Number(e.target.value) } : null)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="assignment-label">Etiqueta para Asignación</Label>
                                <Input
                                    id="assignment-label"
                                    value={settings.assignmentLabel}
                                    onChange={(e) => setSettings(prev => prev ? { ...prev, assignmentLabel: e.target.value } : null)}
                                />
                                <p className="text-sm text-muted-foreground">
                                    Cambia el texto que se muestra para la asignación (ej: &quot;Técnico&quot;, &quot;Recurso&quot;, &quot;Encargado&quot;).
                                </p>
                            </div>
                        </div>
                        <Separator />
                        <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="show-customer-tax-id"
                                    checked={settings.showCustomerTaxId}
                                    onCheckedChange={(checked) => setSettings(prev => prev ? { ...prev, showCustomerTaxId: checked } : null)}
                                />
                                <Label htmlFor="show-customer-tax-id">Mostrar cédula junto al nombre del cliente</Label>
                            </div>
                             <div className="flex items-center space-x-2">
                                <Switch
                                    id="require-assignment"
                                    checked={settings.requireAssignmentForStart}
                                    onCheckedChange={(checked) => setSettings(prev => prev ? { ...prev, requireAssignmentForStart: checked } : null)}
                                />
                                <Label htmlFor="require-assignment">Requerir asignación para iniciar el proyecto</Label>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Accordion type="multiple" defaultValue={['assignments']} className="w-full space-y-6">
                    <Card>
                        <AccordionItem value="assignments">
                            <AccordionTrigger className="p-6">
                                <CardTitle>Gestión de Asignaciones</CardTitle>
                            </AccordionTrigger>
                            <AccordionContent className="p-6 pt-0">
                                <CardDescription className="mb-4">Añade o elimina las opciones de asignación disponibles.</CardDescription>
                                <div className="space-y-4">
                                    <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                                        {settings.assignments && settings.assignments.map(assignment => (
                                            <div key={assignment.id} className="flex items-center justify-between rounded-lg border p-3">
                                                <div>
                                                    <p className="font-medium">{assignment.name}</p>
                                                    <p className="text-sm text-muted-foreground">ID: <span className="font-mono">{assignment.id}</span></p>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteAssignment(assignment.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                    <Separator />
                                    <div className="flex items-end gap-2 pt-2">
                                        <div className="grid flex-1 gap-2">
                                            <Label htmlFor="assignment-id">ID de Asignación</Label>
                                            <Input id="assignment-id" value={newAssignment.id} onChange={(e) => setNewAssignment(prev => ({ ...prev, id: e.target.value }))} placeholder="Ej: JUG" />
                                        </div>
                                        <div className="grid flex-1 gap-2">
                                            <Label htmlFor="assignment-name">Nombre de Asignación</Label>
                                            <Input id="assignment-name" value={newAssignment.name} onChange={(e) => setNewAssignment(prev => ({ ...prev, name: e.target.value }))} placeholder="Ej: Jonathan Ugalde" />
                                        </div>
                                        <Button size="icon" onClick={handleAddAssignment}>
                                            <PlusCircle className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Card>

                    <Card>
                        <AccordionItem value="pdf-export">
                            <AccordionTrigger className="p-6">
                                <CardTitle>Configuración de Reportes</CardTitle>
                            </AccordionTrigger>
                            <AccordionContent className="p-6 pt-0">
                                <div className="space-y-6">
                                     <div className="space-y-2">
                                        <Label htmlFor="pdf-top-legend">Leyenda Superior del PDF</Label>
                                        <Input
                                            id="pdf-top-legend"
                                            value={settings.pdfTopLegend || ''}
                                            onChange={(e) => setSettings(prev => prev ? { ...prev, pdfTopLegend: e.target.value } : null)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label>Tamaño del Papel</Label>
                                            <RadioGroup
                                                value={settings.pdfPaperSize}
                                                onValueChange={(value) => setSettings(prev => prev ? { ...prev, pdfPaperSize: value as 'letter' | 'legal' } : null)}
                                                className="flex items-center gap-4"
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="letter" id="r-letter" />
                                                    <Label htmlFor="r-letter">Carta</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="legal" id="r-legal" />
                                                    <Label htmlFor="r-legal">Oficio</Label>
                                                </div>
                                            </RadioGroup>
                                        </div>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Card>
                </Accordion>

                <Card>
                    <CardFooter className="border-t px-6 py-4">
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                            Guardar Todos los Cambios
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </main>
    );
}
