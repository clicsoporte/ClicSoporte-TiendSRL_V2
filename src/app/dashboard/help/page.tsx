/**
 * @fileoverview Help Center page with search highlighting.
 */
"use client";

import { useEffect, useState, useMemo } from "react";
import { usePageTitle } from "@/modules/core/hooks/usePageTitle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search, LifeBuoy, Rocket, MessageSquare, DollarSign, FileScan, CalendarCheck, Ticket, KeyRound, AreaChart, Briefcase, Wrench, ListChecks, History, CreditCard, ShieldQuestion, BadgeInfo, Save, Download, Lock, Radio, Zap, Network, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
        title: "Introducción al Sistema",
        icon: <Rocket className="mr-4 h-6 w-6 text-blue-500" />,
        content: (
            <div className="space-y-4">
                <p>¡Bienvenido a <strong>{companyData?.systemName || "Clic-Soporte"}</strong>! Esta plataforma centraliza todas las herramientas operativas de la empresa.</p>
                <p>El sistema está optimizado para la velocidad y la precisión, permitiendo gestionar tickets, proyectos, cotizaciones y licencias desde una interfaz unificada.</p>
            </div>
        )
    },
    {
        title: "Tutorial: Buzón de Sugerencias",
        icon: <MessageSquare className="mr-4 h-6 w-6 text-green-600" />,
        content: (
            <div className="space-y-4">
                <p>Herramienta de comunicación directa para mejorar la aplicación. Todos los usuarios pueden participar.</p>
                <ul className="list-disc space-y-2 pl-6">
                    <li><strong>Enviar una Sugerencia:</strong> Haz clic en el botón verde "Sugerencias" en la parte superior derecha de cualquier página.</li>
                    <li><strong>Gestión para Administradores:</strong> Accede a Administración &gt; Buzón de Sugerencias para revisar y marcar como leídas las ideas del equipo.</li>
                </ul>
            </div>
        )
    },
    {
        title: "Guía Maestra: Módulo Cotizador",
        icon: <DollarSign className="mr-4 h-6 w-6 text-emerald-500" />,
        content: (
            <div className="space-y-4">
                <p>Optimizado para generar proformas profesionales en segundos.</p>
                <ol className="list-decimal space-y-2 pl-6">
                    <li><strong>Paso 1: Seleccionar Cliente.</strong> El sistema verificará automáticamente el límite de crédito y exoneraciones en Hacienda.</li>
                    <li><strong>Paso 2: Agregar Productos.</strong> Busca por descripción o código. El stock del ERP se muestra en tiempo real.</li>
                    <li><strong>Paso 3: Generar PDF.</strong> El sistema asigna el consecutivo y aplica los impuestos según la ley.</li>
                </ol>
            </div>
        )
    },
    {
        title: "Módulo Gestor de Proyectos TI",
        icon: <CalendarCheck className="mr-4 h-6 w-6 text-purple-500" />,
        content: (
            <div className="space-y-4">
                <p>Organiza proyectos integrales (CCTV, Alarmas, Redes) bajo la modalidad "Llave en Mano".</p>
                <ul className="list-disc space-y-2 pl-6">
                    <li><strong>Bitácora:</strong> Registro histórico de cada avance técnico por usuario.</li>
                    <li><strong>Materiales:</strong> Listado de equipos instalados para el acta de entrega.</li>
                    <li><strong>Acta de Entrega:</strong> Generación de documento formal para el cliente al finalizar la ejecución.</li>
                </ul>
            </div>
        )
    },
    {
        title: "Tutorial: Soporte Técnico (Tickets)",
        icon: <Ticket className="mr-4 h-6 w-6 text-blue-500" />,
        content: (
            <div className="space-y-4">
                <p>Centro de mando para la Mesa de Ayuda.</p>
                <ul className="list-disc space-y-2 pl-6">
                    <li><strong>Validación de Cobertura:</strong> Al abrir un ticket, el sistema te avisa si el servicio está cubierto por el contrato del cliente o si es facturable extra.</li>
                    <li><strong>Cronómetro:</strong> Registra el tiempo exacto invertido en cada caso para reportes de productividad.</li>
                    <li><strong>Escalación:</strong> Cambia el técnico asignado en el panel lateral para pasar el caso a otro departamento.</li>
                </ul>
            </div>
        )
    },
    {
        title: "Guía Técnica: Actualizaciones",
        icon: <Wrench className="mr-4 h-6 w-6 text-slate-600" />,
        content: (
            <div className="space-y-4">
                <p>El sistema utiliza migraciones automáticas para mantener la integridad de los datos.</p>
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>¡Importante!</AlertTitle>
                    <AlertDescription>Nunca borres la carpeta "dbs" del servidor, ya que contiene toda la información viva del sistema.</AlertDescription>
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
                placeholder="Escribe para buscar en la ayuda (ej: 'contraseña', 'hacienda', 'ticket')..."
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
