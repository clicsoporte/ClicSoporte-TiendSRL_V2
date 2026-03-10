/**
 * @fileoverview Client Component for managing data imports from external sources.
 * Extracted from the main page to support server-side guarding.
 */
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../../../components/ui/card";
import { useToast } from "../../../../modules/core/hooks/use-toast";
import { logError, logInfo } from "../../../../modules/core/lib/logger";
import { Loader2, FileUp, Database, Save } from "lucide-react";
import type { Company, SqlConfig, ImportQuery } from '../../../../modules/core/types';
import { usePageTitle } from "../../../../modules/core/hooks/usePageTitle";
import { getCompanySettings, saveCompanySettings } from '../../../../modules/core/lib/settings-db';
import { importData, importAllDataFromFiles } from '../../../../modules/core/lib/import-service';
import { testSqlConnection, saveSqlConfig, saveImportQueries, getImportQueries } from '../../../../modules/core/lib/config-db-client';
import { getSqlConfig as getSqlConfigServer } from '../../../../modules/core/lib/config-db';
import { useAuthorization } from '../../../../modules/core/hooks/useAuthorization';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Switch } from '../../../../components/ui/switch';
import { Textarea } from '../../../../components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type ImportType = 'customers' | 'products' | 'exemptions' | 'stock' | 'cabys';
const importTypes: ImportType[] = ['customers', 'products', 'exemptions', 'stock', 'cabys'];

const importTypeTranslations: { [key in ImportType]: string } = {
    customers: 'Clientes',
    products: 'Artículos',
    exemptions: 'Exoneraciones',
    stock: 'Existencias',
    cabys: 'Catálogo CABYS'
};

const importTypeFieldMapping: { [key in ImportType]: keyof Company } = {
    customers: 'customerFilePath',
    products: 'productFilePath',
    exemptions: 'exemptionFilePath',
    stock: 'stockFilePath',
    cabys: 'cabysFilePath',
};

export default function ImportClient() {
    const { hasPermission } = useAuthorization(['admin:import:files', 'admin:import:sql', 'admin:import:sql-config']);
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingType, setProcessingType] = useState<string | null>(null);
    const [companyData, setCompanyData] = useState<Company | null>(null);
    const [sqlConfig, setSqlConfig] = useState<SqlConfig>({});
    const [importQueries, setImportQueries] = useState<ImportQuery[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const { setTitle } = usePageTitle();

    useEffect(() => {
        setTitle("Importar Datos");
        const loadConfig = async () => {
            const [company, sql, queries] = await Promise.all([
                getCompanySettings(),
                getSqlConfigServer(),
                getImportQueries()
            ]);
            setCompanyData(company);
            setSqlConfig(sql || {});
            setImportQueries(queries || []);
        };
        loadConfig();
    }, [setTitle]);

    const handleImport = useCallback(async (type: ImportType) => {
        setProcessingType(type);
        setIsProcessing(true);
        try {
            const result = await importData(type);
            toast({
                title: `Importación Exitosa`,
                description: `Se han procesado registros desde ${result.source}.`,
            });
        } catch (error: unknown) {
            toast({
                title: "Error de Importación",
                description: (error as Error).message,
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
            setProcessingType(null);
        }
    }, [toast]);
    
    const handleFullSqlImport = async () => {
        setIsProcessing(true);
        setProcessingType('full-sql-import');
        try {
            await importAllDataFromFiles(); 
            toast({ title: "Sincronización Exitosa", description: `Datos actualizados desde el ERP.` });
        } catch (error: unknown) {
             toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
            setProcessingType(null);
        }
    }
    
    const handleSaveAllConfigs = async () => {
        setIsSaving(true);
        try {
            if (companyData) await saveCompanySettings(companyData);
            if (hasPermission('admin:import:sql-config')) {
                await saveSqlConfig(sqlConfig);
                await saveImportQueries(importQueries);
            }
            toast({ title: "Configuración Guardada" });
        } catch (error: unknown) {
            toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setIsSaving(true);
        try {
            await testSqlConnection();
            toast({ title: "Conexión Exitosa" });
        } catch (error: unknown) {
            toast({ title: "Error de Conexión", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const renderFileImportCard = (type: ImportType) => {
        const fieldName = importTypeFieldMapping[type];
        return (
            <Card key={type}>
                <CardHeader>
                    <Label>{importTypeTranslations[type]}</Label>
                    <Input 
                        placeholder={`Ruta archivo...`}
                        value={companyData?.[fieldName] as string || ''}
                        onChange={(e) => setCompanyData(prev => prev ? ({ ...prev, [fieldName]: e.target.value } as Company) : null)} 
                    />
                </CardHeader>
                <CardFooter>
                    <Button onClick={() => handleImport(type)} disabled={isProcessing}><FileUp className="mr-2 h-4 w-4" /> Procesar</Button>
                </CardFooter>
            </Card>
        );
    };
    
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-8">
             <Card>
                <CardHeader>
                    <CardTitle>Modo de Importación</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center space-x-4">
                        <Label>Archivos</Label>
                        <Switch
                          checked={companyData?.importMode === 'sql'}
                          onCheckedChange={(checked) => setCompanyData(prev => prev ? ({ ...prev, importMode: checked ? 'sql' : 'file' } as Company) : null)}
                        />
                        <Label>SQL Server</Label>
                    </div>
                </CardContent>
             </Card>
            
            {hasPermission('admin:import:files') && (
                <Card>
                    <CardHeader><CardTitle>Archivos Locales</CardTitle></CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-3">
                        {importTypes.map(renderFileImportCard)}
                    </CardContent>
                </Card>
            )}

            {companyData?.importMode === 'sql' && hasPermission('admin:import:sql') && (
                 <Card>
                    <CardHeader><CardTitle>ERP SQL Server</CardTitle></CardHeader>
                     <CardContent>
                        <Button onClick={handleFullSqlImport} disabled={isProcessing} size="lg">
                             {isProcessing ? <Loader2 className="mr-2 animate-spin" /> : <Database className="mr-2" />}
                            Sincronizar Todo
                        </Button>
                     </CardContent>
                </Card>
            )}

            <Card>
                <CardFooter>
                    <Button onClick={handleSaveAllConfigs} disabled={isSaving}><Save className="mr-2 h-4 w-4" /> Guardar Todo</Button>
                </CardFooter>
            </Card>
        </main>
    );
}
