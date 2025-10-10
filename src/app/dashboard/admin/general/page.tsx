
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Textarea } from "../../../../components/ui/textarea";
import { useToast } from "../../../../modules/core/hooks/use-toast";
import type { Company, Service, SupportPackage } from "../../../../modules/core/types";
import { Skeleton } from "../../../../components/ui/skeleton";
import { logInfo } from "../../../../modules/core/lib/logger";
import { getCompanySettings, saveCompanySettings } from "../../../../modules/core/lib/settings-db";
import { usePageTitle } from "../../../../modules/core/hooks/usePageTitle";
import { useAuthorization } from "../../../../modules/core/hooks/useAuthorization";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDropzone } from "react-dropzone";
import { Camera, PlusCircle, Trash2 } from "lucide-react";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

const getInitials = (name: string) => {
    if (!name) return "CL";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
};


export default function GeneralSettingsPage() {
  const { isAuthorized } = useAuthorization(['admin:settings:general']);
  const { toast } = useToast();
  const { setCompanyData: setAuthCompanyData } = useAuth();
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setTitle } = usePageTitle();

  const [newService, setNewService] = useState({ id: "", name: "" });
  const [newPackage, setNewPackage] = useState<Omit<SupportPackage, 'includedServices' | 'excludedServices'>>({ id: "", name: "", defaultHours: 0 });

  useEffect(() => {
    setTitle("Configuración General");
    const loadData = async () => {
        setIsLoading(true);
        const data = await getCompanySettings();
        if (data && !Array.isArray(data.supportPackages)) data.supportPackages = [];
        if (data && !Array.isArray(data.servicesCatalog)) data.servicesCatalog = [];
        setCompanyData(data);
        setIsLoading(false);
    }
    if (isAuthorized) {
        loadData();
    }
  }, [setTitle, isAuthorized]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0 && companyData) {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setCompanyData(prev => prev ? ({...prev, logoUrl: base64String}) : null);
      };
      reader.readAsDataURL(file);
    }
  }, [companyData]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/webp': [],
    },
    maxFiles: 1,
    multiple: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!companyData) return;
    const { id, value, type } = e.target;
    const isNumber = type === 'number';
    setCompanyData(prev => prev ? ({...prev, [id]: isNumber ? parseInt(value, 10) : value}) : null);
  }

  const handleAddService = () => {
    if (!companyData || !newService.id || !newService.name) return;
    const updatedCatalog = [...(companyData.servicesCatalog || []), newService];
    setCompanyData({ ...companyData, servicesCatalog: updatedCatalog });
    setNewService({ id: "", name: "" });
  };

  const handleDeleteService = (serviceId: string) => {
    if (!companyData) return;
    const updatedCatalog = (companyData.servicesCatalog || []).filter(s => s.id !== serviceId);
    const updatedPackages = (companyData.supportPackages || []).map(p => ({
        ...p,
        includedServices: p.includedServices.filter(sId => sId !== serviceId),
        excludedServices: p.excludedServices.filter(sId => sId !== serviceId),
    }));
    setCompanyData({ ...companyData, servicesCatalog: updatedCatalog, supportPackages: updatedPackages });
  };
  
  const handleAddPackage = () => {
    if (!companyData || !newPackage.id || !newPackage.name) return;
    const newPkg: SupportPackage = { ...newPackage, defaultHours: newPackage.defaultHours || 0, includedServices: [], excludedServices: [] };
    const updatedPackages = [...(companyData.supportPackages || []), newPkg];
    setCompanyData({ ...companyData, supportPackages: updatedPackages });
    setNewPackage({ id: "", name: "", defaultHours: 0 });
  };

  const handleDeletePackage = (packageId: string) => {
    if (!companyData) return;
    const updatedPackages = (companyData.supportPackages || []).filter(p => p.id !== packageId);
    setCompanyData({ ...companyData, supportPackages: updatedPackages });
  };
  
  const handlePackageServiceToggle = (packageId: string, serviceId: string, type: 'included' | 'excluded', checked: boolean) => {
    if (!companyData) return;
    const updatedPackages = (companyData.supportPackages || []).map(pkg => {
        if (pkg.id === packageId) {
            const listKey = type === 'included' ? 'includedServices' : 'excludedServices';
            const otherListKey = type === 'included' ? 'excludedServices' : 'includedServices';
            
            let newList = [...pkg[listKey]];
            let otherList = [...pkg[otherListKey]];

            if (checked) {
                if (!newList.includes(serviceId)) newList.push(serviceId);
                otherList = otherList.filter(sId => sId !== serviceId); // Ensure it's not in the other list
            } else {
                newList = newList.filter(sId => sId !== serviceId);
            }
            return { ...pkg, [listKey]: newList, [otherListKey]: otherList };
        }
        return pkg;
    });
    setCompanyData({ ...companyData, supportPackages: updatedPackages });
  };

  const handleSubmit = async () => {
    if (!companyData) return;
    await saveCompanySettings(companyData);
    toast({
      title: "Configuración Guardada",
      description: "Los datos de la empresa han sido actualizados.",
    });
    // Update auth context directly to avoid flicker, instead of full refreshAuth()
    setAuthCompanyData(companyData);
    await logInfo("Configuración general guardada", { companyName: companyData.name });
  };
  
  if (isAuthorized === null) {
    return null;
  }

  if (isLoading || !companyData) {
    return (
        <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
        </main>
    )
  }

  return (
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-6">
                    <div {...getRootProps()} className="relative group cursor-pointer">
                        <input {...getInputProps()} />
                        <Avatar className="h-24 w-24 text-4xl">
                            <AvatarImage src={companyData.logoUrl} alt={companyData.name} />
                            <AvatarFallback>{getInitials(companyData.name)}</AvatarFallback>
                        </Avatar>
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="h-8 w-8 text-white" />
                        </div>
                    </div>
                    <div>
                        <CardTitle>Datos de la Empresa</CardTitle>
                        <CardDescription>
                        Esta información se usará en los encabezados de los documentos. Haz clic en el logo para cambiarlo.
                        </CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="systemName">Nombre del Sistema</Label>
                    <Input 
                      id="systemName" 
                      value={companyData.systemName || ''}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre de la Empresa</Label>
                    <Input 
                      id="name" 
                      value={companyData.name}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxId">ID de Contribuyente / Cédula Jurídica</Label>
                    <Input 
                      id="taxId" 
                      value={companyData.taxId}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Dirección</Label>
                    <Textarea 
                      id="address" 
                      rows={3}
                      value={companyData.address}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input 
                          id="phone" 
                          value={companyData.phone}
                          onChange={handleChange}
                      />
                      </div>
                      <div className="space-y-2">
                      <Label htmlFor="email">Correo Electrónico</Label>
                      <Input 
                          id="email" 
                          type="email"
                          value={companyData.email}
                          onChange={handleChange}
                      />
                      </div>
                  </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Ajustes de Interfaz y Rendimiento</CardTitle>
                    <CardDescription>Configuración global para la experiencia de usuario.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label htmlFor="searchDebounceTime">Retraso de Búsqueda (ms)</Label>
                      <Input 
                          id="searchDebounceTime"
                          type="number"
                          value={companyData.searchDebounceTime ?? 500}
                          onChange={handleChange}
                      />
                       <p className="text-xs text-muted-foreground pt-1">
                          Tiempo en milisegundos que el sistema espera antes de buscar (ej: 500 = 0.5s).
                       </p>
                  </div>
                   <div className="space-y-2">
                      <Label htmlFor="syncWarningHours">Horas para Alerta de Sinc.</Label>
                      <Input 
                          id="syncWarningHours"
                          type="number"
                          value={companyData.syncWarningHours ?? 12}
                          onChange={handleChange}
                      />
                       <p className="text-xs text-muted-foreground pt-1">
                          Después de cuántas horas sin sincronizar se mostrará la alerta en rojo.
                       </p>
                  </div>
                </CardContent>
            </Card>
            
            <Accordion type="multiple" className="w-full space-y-6 mt-6">
              <Card>
                <AccordionItem value="services-catalog">
                  <AccordionTrigger className="p-6 text-lg font-semibold">Catálogo de Servicios</AccordionTrigger>
                  <AccordionContent className="p-6 pt-0">
                    <CardDescription className="mb-4">Defina la lista maestra de todos los servicios de soporte que su empresa ofrece.</CardDescription>
                    <div className="space-y-2">
                      {(companyData.servicesCatalog || []).map(service => (
                        <div key={service.id} className="flex items-center justify-between rounded-lg border p-3">
                          <p className="font-medium">{service.name} <span className="font-mono text-xs text-muted-foreground">({service.id})</span></p>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteService(service.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                        </div>
                      ))}
                    </div>
                    <Separator className="my-4"/>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1.5"><Label htmlFor="service-id">ID Servicio</Label><Input id="service-id" value={newService.id} onChange={e => setNewService({...newService, id: e.target.value})} placeholder="Ej: soporte-pc"/></div>
                      <div className="flex-1 space-y-1.5"><Label htmlFor="service-name">Nombre Servicio</Label><Input id="service-name" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} placeholder="Ej: Soporte a PC"/></div>
                      <Button size="icon" onClick={handleAddService}><PlusCircle className="h-4 w-4"/></Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Card>

              <Card>
                 <AccordionItem value="support-packages">
                  <AccordionTrigger className="p-6 text-lg font-semibold">Paquetes de Soporte</AccordionTrigger>
                  <AccordionContent className="p-6 pt-0">
                    <CardDescription className="mb-4">Cree paquetes de soporte, defina las horas incluidas, y asigne los servicios de su catálogo.</CardDescription>
                     <div className="space-y-4">
                      {(companyData.supportPackages || []).map(pkg => (
                        <Card key={pkg.id}>
                          <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>{pkg.name} <span className="font-mono text-sm text-muted-foreground">({pkg.id})</span></CardTitle>
                                <CardDescription>Horas Incluidas: {pkg.defaultHours || 0}</CardDescription>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleDeletePackage(pkg.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <h4 className="font-medium mb-2">Servicios Incluidos</h4>
                                <div className="space-y-2">
                                  {(companyData.servicesCatalog || []).map(service => (
                                    <div key={`${pkg.id}-inc-${service.id}`} className="flex items-center space-x-2">
                                      <Checkbox id={`${pkg.id}-inc-${service.id}`} checked={(pkg.includedServices || []).includes(service.id)} onCheckedChange={(checked) => handlePackageServiceToggle(pkg.id, service.id, 'included', !!checked)} />
                                      <Label htmlFor={`${pkg.id}-inc-${service.id}`}>{service.name}</Label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <h4 className="font-medium mb-2">Servicios Excluidos</h4>
                                 <div className="space-y-2">
                                  {(companyData.servicesCatalog || []).map(service => (
                                    <div key={`${pkg.id}-exc-${service.id}`} className="flex items-center space-x-2">
                                      <Checkbox id={`${pkg.id}-exc-${service.id}`} checked={(pkg.excludedServices || []).includes(service.id)} onCheckedChange={(checked) => handlePackageServiceToggle(pkg.id, service.id, 'excluded', !!checked)} />
                                      <Label htmlFor={`${pkg.id}-exc-${service.id}`}>{service.name}</Label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <Separator className="my-4"/>
                     <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-1.5"><Label htmlFor="package-id">ID Paquete</Label><Input id="package-id" value={newPackage.id} onChange={e => setNewPackage({...newPackage, id: e.target.value})} placeholder="Ej: alfa"/></div>
                        <div className="flex-1 space-y-1.5"><Label htmlFor="package-name">Nombre Paquete</Label><Input id="package-name" value={newPackage.name} onChange={e => setNewPackage({...newPackage, name: e.target.value})} placeholder="Ej: Paquete Alfa"/></div>
                        <div className="flex-1 space-y-1.5"><Label htmlFor="package-hours">Horas Incluidas</Label><Input id="package-hours" type="number" value={newPackage.defaultHours || ''} onChange={e => setNewPackage({...newPackage, defaultHours: Number(e.target.value)})} placeholder="Ej: 10"/></div>
                        <Button size="icon" onClick={handleAddPackage}><PlusCircle className="h-4 w-4"/></Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Card>
            </Accordion>


            <Card className="mt-6">
                <CardFooter className="border-t px-6 py-4">
                  <Button>Guardar Todos los Cambios</Button>
                </CardFooter>
            </Card>
          </form>
        </div>
      </main>
  );
}
