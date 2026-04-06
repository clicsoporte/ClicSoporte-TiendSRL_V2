/**
 * @fileoverview Help Center page with structured mini-tutorials for MSP operations.
 */
"use client";

import { useEffect, useState, useMemo } from "react";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, LifeBuoy, Rocket, DollarSign, Wrench, AlertTriangle, ShieldCheck, MapPin, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  const contentString = useMemo(() => {
    const getText = (node: React.ReactNode): string => {
      if (typeof node === "string") return node;
      if (Array.isArray(node)) return node.map(getText).join(" ");
      if (typeof node === "object" && node !== null && "props" in node && node.props.children) {
        return getText(node.props.children);
      }
      return "";
    };
    return getText(content);
  }, [content]);

  const isVisible = useMemo(() => {
    const searchTerms = normalizeText(searchTerm).split(" ").filter(Boolean);
    if (searchTerms.length === 0) return true;
    const targetText = normalizeText(title + " " + contentString);
    return searchTerms.every((term) => targetText.includes(term));
  }, [searchTerm, title, contentString]);

  if (!isVisible) return null;

  return (
    <AccordionItem value={title}>
      <AccordionTrigger className="text-lg font-semibold">
        <div className="flex items-center">
          {icon}
          <HighlightedText text={title} highlight={searchTerm} />
        </div>
      </AccordionTrigger>
      <AccordionContent className="prose max-w-none text-base">
        {content}
      </AccordionContent>
    </AccordionItem>
  );
};

export default function HelpPage() {
  const { setTitle } = usePageTitle();
  const { companyData } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setTitle("Centro de Ayuda");
  }, [setTitle]);

  const helpSections = [
    {
        title: "Primeros Pasos",
        icon: <Rocket className="mr-4 h-6 w-6 text-blue-500" />,
        content: (
            <div className="space-y-4">
                <p>¡Bienvenido a <strong>{companyData?.systemName || "Clic-Soporte"}</strong>! Esta plataforma centraliza todas las herramientas operativas de la empresa.</p>
                <p>El sistema está optimizado para gestionar tickets, proyectos, cotizaciones y licencias desde una interfaz unificada y rápida.</p>
            </div>
        )
    },
    {
        title: "Tutorial: Validación Automática de Cobertura",
        icon: <ShieldCheck className="mr-4 h-6 w-6 text-green-600" />,
        content: (
            <div className="space-y-4">
                <p>El sistema verifica automáticamente si un cliente debe pagar por un servicio o si está incluido en su plan mensual.</p>
                <ul className="list-disc space-y-2 pl-6">
                    <li><strong>Por Contrato:</strong> Si el cliente tiene un contrato vigente, el sistema revisa la lista de servicios incluidos en dicho documento.</li>
                    <li><strong>Por Paquete:</strong> Si no hay contrato pero el cliente tiene un plan asignado (Oro, Plata, etc.), se aplican las reglas del paquete.</li>
                    <li><strong>Fuera de Cobertura:</strong> Si el servicio no se encuentra en ninguna de las listas anteriores, el ticket se marca como <span className="text-destructive font-bold">FACTURABLE</span> automáticamente.</li>
                </ul>
            </div>
        )
    },
    {
        title: "Guía: Lógica de Redondeo y Gracia",
        icon: <Clock className="mr-4 h-6 w-6 text-blue-400" />,
        content: (
            <div className="space-y-4">
                <p>Para asegurar una facturación justa, el sistema aplica reglas de tiempo basadas en el paquete del cliente:</p>
                <ul className="list-disc space-y-2 pl-6">
                    <li><strong>Periodo de Gracia:</strong> Si un técnico dura menos de los minutos de gracia (ej: 5 min), el tiempo facturable será 0.</li>
                    <li><strong>Múltiplos de Redondeo:</strong> El tiempo se redondea hacia arriba según el paquete (ej: cada 15 min). Una sesión de 17 minutos se facturará como 30 minutos si el múltiplo es 15.</li>
                </ul>
            </div>
        )
    },
    {
        title: "Tutorial: Módulo Geográfico y Viáticos",
        icon: <MapPin className="mr-4 h-6 w-6 text-orange-500" />,
        content: (
            <div className="space-y-4">
                <p>Gestiona los costos de transporte de técnicos externos de forma precisa:</p>
                <ol className="list-decimal space-y-2 pl-6">
                    <li><strong>Configuración:</strong> Define Provincias, Cantones y Distritos en <i>Administración &gt; Soporte Técnico</i>.</li>
                    <li><strong>Tarifario:</strong> En el perfil del <i>Proveedor Externo</i>, asigna un monto de viático a zonas específicas.</li>
                    <li><strong>Uso:</strong> Al abrir un ticket, selecciona el servicio &quot;En Sitio&quot; y el sistema te sugerirá el viático basado en la dirección del cliente.</li>
                </ol>
            </div>
        )
    },
    {
        title: "Gestión de Cotizaciones e Historial",
        icon: <DollarSign className="mr-4 h-6 w-6 text-emerald-500" />,
        content: (
            <div className="space-y-4">
                <p>El Cotizador permite generar proformas profesionales en segundos.</p>
                <ul className="list-disc space-y-2 pl-6">
                    <li><strong>Borradores:</strong> Puedes guardar avances para retomarlos luego.</li>
                    <li><strong>Hacienda:</strong> El sistema consulta el estado tributario del cliente en tiempo real al seleccionarlo.</li>
                    <li><strong>Moneda:</strong> El tipo de cambio se actualiza diariamente desde el BCCR para conversiones automáticas.</li>
                </ul>
            </div>
        )
    },
    {
        title: "Nota de Seguridad: Actualizaciones",
        icon: <Wrench className="mr-4 h-6 w-6 text-slate-600" />,
        content: (
            <div className="space-y-4">
                <p>El sistema utiliza migraciones automáticas para mantener la integridad de los datos.</p>
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>¡Importante!</AlertTitle>
                    <AlertDescription>Nunca borres la carpeta &quot;dbs&quot; del servidor, ya que contiene toda la base de datos viva del sistema.</AlertDescription>
                </Alert>
            </div>
        )
    }
  ];

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-white">
                <LifeBuoy className="h-6 w-6" />
              </div>
              <div>
                {companyData ? (
                  <CardTitle className="text-2xl">
                    Manual de Usuario de <HighlightedText text={companyData.systemName || "la Aplicación"} highlight={searchTerm}/>
                  </CardTitle>
                ) : (
                  <Skeleton className="h-8 w-96" />
                )}
                <CardDescription>
                  Guía completa sobre cómo utilizar las herramientas y funcionalidades del sistema.
                </CardDescription>
              </div>
            </div>
            <div className="relative mt-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Escribe para buscar en la ayuda (ej: 'cobertura', 'viáticos', 'redondeo')..."
                className="w-full pl-10 h-12 text-base"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
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
      </div>
    </main>
  );
}
