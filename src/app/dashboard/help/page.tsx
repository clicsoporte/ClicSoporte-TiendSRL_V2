/**
 * @fileoverview Help Center page with advanced mini-tutorials for MSP operations.
 * Enhanced with practical examples and business logic explanations.
 * Refactored to include real-time server telemetry.
 */
"use client";

import { useEffect, useState, useMemo } from "react";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, LifeBuoy, Rocket, Wrench, AlertTriangle, ShieldCheck, MapPin, Zap, Wallet, BellRing, GitFork, KeyRound, Server, Activity, HardDrive, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getServerStats, type SystemStats } from "@/modules/core/lib/maintenance-actions";
import { Progress } from "@/components/ui/progress";

// --- Helper Functions ---
const normalizeText = (text: string | null | undefined): string => {
  if (!text) return "";
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const HighlightedText = ({
  text,
  highlight,
}: {
  text: string;
  highlight: string;
}) => {
  if (!highlight.trim()) {
    return <>{text}</>;
  }
  const normalizedHighlight = normalizeText(highlight);
  const parts = text.split(
    new RegExp(
      `(${normalizedHighlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    )
  );

  return (
    <>
      {parts.map((part, i) =>
        normalizeText(part).toLowerCase() === normalizedHighlight ? (
          <mark key={i} className="bg-yellow-300 p-0 m-0 rounded-sm">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

const HelpSection = ({
  title,
  icon,
  content,
  searchTerm,
}: {
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  searchTerm: string;
}) => {
  const isVisible = useMemo(() => {
    const searchTerms = normalizeText(searchTerm).split(" ").filter(Boolean);
    if (searchTerms.length === 0) return true;
    
    // Simple way to get text content from React nodes for searching
    const targetText = normalizeText(title);
    return searchTerms.every((term) => targetText.includes(term));
  }, [searchTerm, title]);

  if (!isVisible) return null;

  return (
    <AccordionItem value={title} className="border rounded-lg mb-4 overflow-hidden shadow-sm bg-card">
      <AccordionTrigger className="text-lg font-bold px-6 hover:bg-muted/50 transition-colors">
        <div className="flex items-center text-left">
          {icon}
          <HighlightedText text={title} highlight={searchTerm} />
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-6 py-4 text-base leading-relaxed border-t bg-white">
        {content}
      </AccordionContent>
    </AccordionItem>
  );
};

export default function HelpPage() {
  const { setTitle } = usePageTitle();
  const { companyData } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    setTitle("Centro de Ayuda");
    const fetchStats = async () => {
        try {
            const data = await getServerStats();
            setStats(data);
        } finally {
            setLoadingStats(false);
        }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [setTitle]);

  const helpSections = [
    {
        title: "Primeros Pasos y Filosofía",
        icon: <Rocket className="mr-4 h-6 w-6 text-blue-500" />,
        content: (
            <div className="space-y-4">
                <p>¡Bienvenido a <strong>{companyData?.systemName || "Clic-Tools"}</strong>! Esta plataforma es el cerebro operativo de nuestra empresa de servicios gestionados (MSP).</p>
                <p>Nuestra filosofía se basa en tres pilares:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li><span className="font-bold">Agilidad Operativa:</span> Tickets y proyectos que se gestionan en segundos.</li>
                    <li><span className="font-bold">Control Financiero:</span> Ningún servicio se realiza sin validar primero su rentabilidad o cobertura.</li>
                    <li><span className="font-bold">Comunicación Omnicanal:</span> Notificaciones instantáneas por Email y Telegram para que nada se pase por alto.</li>
                </ul>
            </div>
        )
    },
    {
        title: "Tutorial: Bolsa de Horas Compartida (Jerarquía de Clientes)",
        icon: <GitFork className="mr-4 h-6 w-6 text-blue-700" />,
        content: (
            <div className="space-y-4">
                <p>Esta funcionalidad permite que un grupo corporativo (varias empresas con distinta cédula jurídica) compartan una misma bolsa de horas de soporte.</p>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-sm font-bold text-blue-800 uppercase mb-2">Configuración Paso a Paso:</p>
                    <ol className="list-decimal pl-6 text-sm space-y-2">
                        <li><b>Identificar al Padre:</b> Selecciona o crea la empresa &quot;Principal&quot; (la que firma el contrato). Asígnala con su plan de 10h, por ejemplo.</li>
                        <li><b>Vincular a los Hijos:</b> Edita las otras empresas del grupo y en la sección <b>Jerarquía Corporativa</b>, selecciona a la empresa principal como &quot;Empresa Principal (Pagadora)&quot;.</li>
                        <li><b>Operación:</b> Al abrir un ticket para una empresa hija, el sistema detectará automáticamente que debe descontar tiempo del contrato de la empresa principal.</li>
                    </ol>
                </div>
                <Alert className="bg-amber-50 border-amber-200">
                    <ShieldCheck className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800 text-xs">Visibilidad del Consumo</AlertTitle>
                    <AlertDescription className="text-amber-700 text-[10px]">
                        En el listado de clientes, la columna &quot;Consumido&quot; muestra las horas que esa empresa específica ha usado, pero el &quot;Saldo&quot; y la barra de progreso reflejan el estado de la <b>bolsa compartida</b> de todo el grupo.
                    </AlertDescription>
                </Alert>
            </div>
        )
    },
    {
        title: "Tutorial: Escudo de Rentabilidad en Proyectos",
        icon: <Wallet className="mr-4 h-6 w-6 text-emerald-600" />,
        content: (
            <div className="space-y-4">
                <p>El sistema protege el margen de ganancia de cada proyecto TI llave en mano.</p>
                <div className="bg-muted/30 p-4 rounded-lg border border-primary/20">
                    <p className="text-sm font-bold text-primary uppercase mb-2">Ejemplo Práctico:</p>
                    <p className="text-sm italic">&quot;Vendes un sistema de CCTV por ¢1,000,000. Al crear el proyecto, digitalizas este monto en el campo <b>Presupuesto Venta</b>.&quot;</p>
                </div>
                <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Monitor de Burn-Rate:</strong> Conforme agregas materiales o subcontratos, el sistema calcula el costo real.</li>
                    <li><strong>Alerta 80%:</strong> El sistema te avisará cuando te quede solo el 20% del presupuesto para gastos.</li>
                    <li><strong>Costo de Mano de Obra:</strong> El sistema utiliza el <i>Costo por Hora Interno</i> definido en Administración para valorar el tiempo que tus técnicos dedican a la bitácora.</li>
                </ul>
                <Alert className="bg-amber-50 border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">Zona de Pérdida</AlertTitle>
                    <AlertDescription className="text-amber-700 text-xs">
                        Si los costos igualan la venta, el sistema mostrará una alerta de <b>Pérdida Crítica</b> y bloqueará el registro de más materiales.
                    </AlertDescription>
                </Alert>
            </div>
        )
    },
    {
        title: "Guía: Mensajería Híbrida y Preferencias del Cliente",
        icon: <BellRing className="mr-4 h-6 w-6 text-indigo-500" />,
        content: (
            <div className="space-y-4">
                <p>Puedes personalizar cómo y qué recibe cada cliente de forma individual.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="p-3 bg-muted/20">
                        <h4 className="font-bold text-xs uppercase mb-2 flex items-center gap-2"><Zap className="h-3 w-3" /> Canales Dinámicos</h4>
                        <p className="text-xs">Usa <b>[CORREO_CLIENTE]</b> o <b>[TELEGRAM_CLIENTE]</b> en tus reglas de notificación para que el motor resuelva los datos de contacto automáticamente.</p>
                    </Card>
                    <Card className="p-3 bg-muted/20">
                        <h4 className="font-bold text-xs uppercase mb-2 flex items-center gap-2"><ShieldCheck className="h-3 w-3" /> Control de Privacidad</h4>
                        <p className="text-xs">En la ficha de cada cliente, puedes activar o desactivar las notificaciones de <b>Tickets</b> o <b>Licencias</b> independientemente.</p>
                    </Card>
                </div>
                <p className="text-sm">Si un cliente tiene desactivada la opción de licencias, el sistema <b>no le enviará</b> correos ni mensajes de Telegram sobre ese tema, incluso si las reglas globales están activas.</p>
            </div>
        )
    },
    {
        title: "Tutorial: Vigilante de Vencimientos Automático",
        icon: <KeyRound className="mr-4 h-6 w-6 text-orange-500" />,
        content: (
            <div className="space-y-4">
                <p>No vuelvas a perder una renovación de contrato o licencia por olvido manual.</p>
                <ol className="list-decimal pl-6 space-y-2">
                    <li><strong>Registro:</strong> Al asignar una licencia de Antivirus u Office 365, define la fecha de vencimiento.</li>
                    <li><strong>Escaneo Diario:</strong> Cada madrugada, el sistema revisa todas las licencias y contratos activos.</li>
                    <li><strong>Alertas Graduales:</strong> El sistema dispara notificaciones automáticas a los <b>30, 15, 7 y 1 días</b> antes de la fecha final.</li>
                    <li><strong>Renovación:</strong> Al llegar al día final, si el contrato tiene el check de <b>Auto-Renovación</b>, el sistema creará la prórroga y enviará el informe.</li>
                </ol>
            </div>
        )
    },
    {
        title: "Inteligencia de Negocio (KPIs)",
        icon: <LifeBuoy className="mr-4 h-6 w-6 text-rose-600" />,
        content: (
            <div className="space-y-4">
                <p>El panel de Analíticas está diseñado para que la Gerencia General tome decisiones basadas en datos reales de la operación.</p>
                <div className="space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                        <p className="text-sm"><strong>Tickets por Tema:</strong> Identifica si hay fallas recurrentes. Si el 50% de los casos son &quot;Redes&quot;, podrías vender un proyecto de cableado nuevo.</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                        <p className="text-sm"><strong>Rentabilidad por Modalidad:</strong> Compara cuántas ganancias dejan los servicios &quot;Por Hora&quot; vs los servicios &quot;Por Tarea&quot; (Fijos).</p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                        <p className="text-sm"><strong>Top 10 Clientes:</strong> Detecta qué clientes consumen más recursos técnicos para ajustar el precio de sus contratos.</p>
                    </div>
                </div>
            </div>
        )
    },
    {
        title: "Tutorial: Tarifas de Proveedores",
        icon: <MapPin className="mr-4 h-6 w-6 text-amber-600" />,
        content: (
            <div className="space-y-4">
                <p>Al utilizar especialistas externos, el sistema asegura que siempre cubras tus costos e impuestos.</p>
                <div className="p-4 bg-muted/30 rounded-lg font-mono text-xs space-y-1">
                    <p className="text-blue-700 font-bold">{`// Formula Interna:`}</p>
                    <p>Subtotal = (Costo Compra * (1 + Margen / 100))</p>
                    <p>Venta Sugerida = Subtotal * (1 + IVA / 100)</p>
                </div>
                <p>Al configurar un proveedor en <b>Administración &gt; Proveedores Terceros</b>, puedes digitalizar manualmente el impuesto (13%, 4%, 2%, 1% o 0% si es exento). El sistema te sugerirá el precio de venta exacto a cobrar al cliente.</p>
            </div>
        )
    }
  ];

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="p-0 mb-8">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
                <LifeBuoy className="h-8 w-8" />
              </div>
              <div>
                {companyData ? (
                  <CardTitle className="text-3xl font-black tracking-tight">
                    Centro de Soporte <HighlightedText text={companyData.systemName || "la Aplicación"} highlight={searchTerm}/>
                  </CardTitle>
                ) : (
                  <Skeleton className="h-8 w-96" />
                )}
                <CardDescription className="text-base">
                  Guía técnica, tutoriales operativos y mejores prácticas para el equipo de {companyData?.name || "la empresa"}.
                </CardDescription>
              </div>
            </div>
            <div className="relative mt-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="¿Qué necesitas hacer hoy? (ej: 'jerarquia', 'bolsa', 'vencimientos')..."
                className="w-full pl-12 h-14 text-lg bg-white border-2 focus-visible:ring-primary shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Accordion type="multiple" className="w-full">
              {helpSections.map((section, index) => (
                <HelpSection
                  key={index}
                  title={section.title}
                  icon={section.icon}
                  content={section.content}
                  searchTerm={searchTerm}
                />
              ))}
            </Accordion>
          </CardContent>
        </Card>

        <section className="pt-8 border-t space-y-6">
            <div className="flex items-center gap-2 text-muted-foreground">
                <Activity className="h-4 w-4" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Telemetría del Servidor (Real-time)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-card/50">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-primary" /> Fecha y Hora VPS
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        {loadingStats ? <Skeleton className="h-6 w-full" /> : (
                            <>
                                <p className="text-sm font-black">{stats?.serverTime}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{stats?.timezone}</p>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-card/50">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                            <Activity className="h-3 w-3 text-primary" /> Uso de Memoria RAM
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-2">
                        {loadingStats ? <Skeleton className="h-6 w-full" /> : (
                            <>
                                <div className="flex justify-between items-end">
                                    <p className="text-sm font-black">{stats?.memory.usedPercent}%</p>
                                    <p className="text-[9px] font-bold text-muted-foreground">Total: {stats?.memory.total}</p>
                                </div>
                                <Progress value={stats?.memory.usedPercent} className="h-1.5" />
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-card/50">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                            <HardDrive className="h-3 w-3 text-primary" /> Almacenamiento
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-2">
                        {loadingStats ? <Skeleton className="h-6 w-full" /> : (
                            <>
                                <div className="flex justify-between items-end">
                                    <p className="text-sm font-black">{stats?.disk.usedPercent}</p>
                                    <p className="text-[9px] font-bold text-muted-foreground">Libre: {stats?.disk.available}</p>
                                </div>
                                <Progress value={parseInt(stats?.disk.usedPercent || '0')} className="h-1.5" />
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-card/50">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                            <Server className="h-3 w-3 text-primary" /> Tiempo de Actividad
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        {loadingStats ? <Skeleton className="h-6 w-full" /> : (
                            <>
                                <p className="text-sm font-black">{stats?.uptime}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{stats?.os}</p>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </section>

        <section className="pt-8 border-t">
            <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                <Wrench className="h-4 w-4" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Información del Sistema</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-xl border bg-white">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Versión del Software</p>
                    <p className="text-lg font-black">{companyData?.systemVersion || "2.5.0"}</p>
                </div>
                <div className="p-4 rounded-xl border bg-white">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Motor de BD</p>
                    <p className="text-lg font-black">SQLite 3 (Unificada)</p>
                </div>
                <div className="p-4 rounded-xl border bg-white">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Estado de Sincronización</p>
                    <p className="text-lg font-black text-green-600">En Línea</p>
                </div>
            </div>
        </section>
      </div>
    </main>
  );
}
