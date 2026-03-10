/**
 * @fileoverview Help Center page.
 */
"use client";

import { useEffect } from "react";
import { usePageTitle } from "../../../modules/core/hooks/usePageTitle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion";
import { DollarSign, ShieldQuestion, LifeBuoy, Rocket, CalendarCheck, CheckCircle, Wrench, Save, Copy, AlertTriangle, Play, Pause, History, Undo2, BadgeInfo, CreditCard, MessageSquare, Trash2, Download, Briefcase, ListChecks, Hourglass, Ticket, KeyRound, AreaChart, FileScan, UploadCloud, Network } from "lucide-react";
import { Skeleton } from "../../../components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/modules/core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

export default function HelpPage() {
  const { setTitle } = usePageTitle();
  const { companyData } = useAuth();
  
  useEffect(() => {
    setTitle("Centro de Ayuda");
  }, [setTitle]);

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
                    <CardTitle className="text-2xl">Manual de Usuario de {companyData.systemName || "la Aplicación"}</CardTitle>
                    ) : (
                        <Skeleton className="h-8 w-96" />
                    )}
                    <CardDescription>
                    Guía completa sobre cómo utilizar las herramientas y funcionalidades del
                    sistema.
                    </CardDescription>
                </div>
            </div>
            </CardHeader>
            <CardContent className="space-y-6">
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                <AccordionTrigger className="text-lg font-semibold">
                    <Rocket className="mr-4 h-6 w-6 text-blue-500" />
                    Introducción al Sistema
                </AccordionTrigger>
                <AccordionContent className="prose max-w-none text-base">
                    <p>
                    ¡Bienvenido a <strong>{companyData?.systemName || "la Aplicación"}</strong>! Piensa en este sistema como tu navaja suiza digital para las tareas diarias de la empresa. Ha sido diseñado para ser súper rápido y fácil de usar desde cualquier computadora en la oficina.
                    </p>
                    <p>
                    El objetivo es simple: tener todas las herramientas importantes (como hacer cotizaciones o gestionar proyectos) en un solo lugar, con la flexibilidad de obtener datos tanto de archivos de texto como directamente desde el ERP.
                    </p>
                </AccordionContent>
                </AccordionItem>

                 <AccordionItem value="item-suggestions">
                    <AccordionTrigger className="text-lg font-semibold">
                        <MessageSquare className="mr-4 h-6 w-6 text-green-600" />
                        Tutorial: Buzón de Sugerencias
                    </AccordionTrigger>
                    <AccordionContent className="prose max-w-none text-base space-y-4">
                        <p>
                        Esta es una herramienta de comunicación directa para mejorar la aplicación. Todos los usuarios pueden participar.
                        </p>
                        <ul className="list-disc space-y-3 pl-6">
                            <li>
                                <strong>Enviar una Sugerencia:</strong> En el panel principal, haz clic en el botón verde <strong>&quot;Sugerencias y Mejoras&quot;</strong> (<MessageSquare className="inline h-4 w-4" />). Se abrirá una ventana donde podrás escribir tu idea, reportar un problema o proponer una mejora. Al enviarla, los administradores serán notificados.
                            </li>
                            <li>
                                <strong>Gestión para Administradores:</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>Los administradores verán un contador de sugerencias no leídas en el botón de &quot;Configuración&quot; del menú lateral.</li>
                                    <li>Dentro de <strong>Administración &gt; Buzón de Sugerencias</strong>, podrán ver todas las sugerencias enviadas, quién las envió y cuándo.</li>
                                    <li>Las sugerencias nuevas aparecen resaltadas. Pueden marcarlas como leídas (<CheckCircle className="inline h-4 w-4 text-green-600"/>) o eliminarlas (<Trash2 className="inline h-4 w-4 text-red-600"/>).</li>
                                </ul>
                            </li>
                        </ul>
                    </AccordionContent>
                </AccordionItem>


                <AccordionItem value="item-quoter">
                    <AccordionTrigger className="text-lg font-semibold">
                        <DollarSign className="mr-4 h-6 w-6 text-green-500" />
                        Guía Maestra: Módulo Cotizador
                    </AccordionTrigger>
                    <AccordionContent className="prose max-w-none text-base space-y-4">
                        <p>Esta es tu herramienta principal para crear y enviar cotizaciones profesionales a los clientes. Su diseño está optimizado para la velocidad y la precisión.</p>
                        
                        <h4 className="font-semibold text-lg pt-2 border-t">Flujo de Trabajo Recomendado</h4>
                        <ol className="list-decimal space-y-4 pl-6">
                            <li>
                                <strong>Paso 1: Seleccionar al Cliente y Verificar su Información.</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>Empieza a escribir el nombre, código o cédula del cliente en el campo &quot;Buscar Cliente&quot;. El sistema te mostrará una lista de sugerencias. Haz clic o presiona `Enter` para seleccionarlo.</li>
                                    <li>Al seleccionar, aparecerá una tarjeta con los <strong>datos críticos del ERP</strong> (<CreditCard className="inline h-4 w-4"/>): cédula, límite de crédito, condición de pago y vendedor asignado. Esto te da una visión instantánea del estado del cliente.</li>
                                    <li><strong>Verificar Exoneración (<ShieldQuestion className="inline h-4 w-4" />):</strong> Si el cliente tiene una exoneración en el ERP, aparecerá una segunda tarjeta. El sistema consultará a Hacienda **en tiempo real** y te mostrará dos estados para que los compares: el del ERP y el de Hacienda. Esto te permite confirmar si la exoneración sigue vigente antes de aplicarla.</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Paso 2: Agregar Productos y Consultar Detalles.</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>En el campo &quot;Agregar Producto&quot;, busca por código o descripción. El sistema te sugerirá productos y te mostrará el **inventario actual del ERP** entre paréntesis.</li>
                                    <li>Presiona `Enter` o haz clic para añadir el producto a la cotización. El sistema aplicará el impuesto automáticamente (13% por defecto, 1% para canasta básica, o 0% si el cliente tiene una exoneración válida).</li>
                                    <li><strong>Consultar Info del Producto (<BadgeInfo className="inline h-4 w-4"/>):</strong> Haz clic en cualquier parte de la fila de un producto ya agregado. Aparecerá una tarjeta con información detallada del ERP: su **clasificación**, la **fecha del último ingreso** y notas importantes.</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Paso 3: Ajustar Cantidades y Precios.</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>Modifica directamente los campos de cantidad y precio.</li>
                                    <li>Usa la tecla `Enter` en los campos &quot;Cantidad&quot; y &quot;Precio&quot;. El sistema te moverá eficientemente: de Cantidad a Precio, y de Precio de vuelta al buscador de productos para que puedas seguir añadiendo artículos sin usar el mouse.</li>
                                    <li><strong>Uso en Móviles:</strong> En pantallas pequeñas, los campos de Cantidad y Precio ahora tienen más espacio. Si necesitas ver otras columnas como &quot;Cabys&quot; o &quot;Unidad&quot;, puedes activarlas desde los checkboxes que aparecen encima de la tabla.</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Paso 4: Finalizar y Generar.</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>Ajusta las condiciones de pago, la validez de la oferta y añade cualquier nota adicional.</li>
                                    <li><strong>Borradores (<Save className="inline h-4 w-4" />):</strong> Si no terminaste, guarda la cotización como borrador. Puedes cargarla más tarde desde el botón &quot;Ver Borradores&quot;.</li>
                                    <li><strong>Generar PDF (<Download className="inline h-4 w-4" />):</strong> Cuando todo esté listo, genera el PDF. El número de cotización se actualizará automáticamente para la próxima vez.</li>
                                </ul>
                            </li>
                        </ol>
                    </AccordionContent>
                </AccordionItem>

                 <AccordionItem value="item-cost-assistant">
                    <AccordionTrigger className="text-lg font-semibold">
                        <FileScan className="mr-4 h-6 w-6 text-orange-600" />
                        Tutorial: Asistente de Costos
                    </AccordionTrigger>
                    <AccordionContent className="prose max-w-none text-base space-y-4">
                        <p>Esta herramienta automatiza el tedioso proceso de calcular los precios de venta a partir de las facturas de compra.</p>
                        <ol className="list-decimal space-y-4 pl-6">
                            <li>
                                <strong>Paso 1: Cargar Facturas.</strong> Arrastra y suelta uno o varios archivos XML de facturas electrónicas de tus proveedores en el área designada (<UploadCloud className="inline h-4 w-4"/>). El sistema leerá automáticamente cada factura y extraerá todos los productos con sus costos y cantidades.
                            </li>
                            <li>
                                <strong>Paso 2: Añadir Costos Adicionales.</strong> En la tarjeta &quot;Costos Adicionales&quot;, ingresa el costo total del transporte, aduanas u otros gastos asociados a la importación o compra. El sistema prorrateará estos costos de manera inteligente entre todos los artículos cargados, dándote un costo unitario real.
                            </li>
                            <li>
                                <strong>Paso 3: Ajustar Márgenes de Ganancia.</strong> Por defecto, cada artículo tiene un margen del 20%. Puedes ajustar este porcentaje individualmente en la columna &quot;Margen&quot;. El &quot;P.V.P Unitario Sugerido&quot; se recalculará automáticamente.
                            </li>
                            <li>
                                <strong>Paso 4: Guardar y Exportar.</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>Si necesitas continuar más tarde, usa el botón <strong>&quot;Guardar Borrador&quot;</strong> (<Save className="inline h-4 w-4"/>).</li>
                                    <li>Cuando estés listo, haz clic en <strong>&quot;Exportar para ERP&quot;</strong> (<Download className="inline h-4 w-4"/>). Esto generará un archivo Excel con el formato exacto que tu ERP necesita para una importación masiva de precios, ahorrándote horas de trabajo manual.</li>
                                </ul>
                            </li>
                        </ol>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-planner">
                <AccordionTrigger className="text-lg font-semibold">
                    <CalendarCheck className="mr-4 h-6 w-6 text-purple-500" />
                    Tutorial: Módulo Gestor de Proyectos
                </AccordionTrigger>
                <AccordionContent className="prose max-w-none text-base space-y-4">
                    <p>
                    Organiza y visualiza la carga de trabajo del taller o la producción. Permite un seguimiento detallado de cada proyecto.
                    </p>
                    <ul className="list-disc space-y-3 pl-6">
                        <li>
                            <strong>Paso 1: Crear Proyectos.</strong> Similar a los otros módulos, crea un nuevo proyecto buscando al cliente y el producto. Establece la cantidad, la fecha de entrega y la prioridad.
                        </li>
                        <li>
                            <strong>Paso 2: Flujo de Estados y Trazabilidad.</strong>
                            <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                <li><strong>Pendiente:</strong> El proyecto ha sido creado y espera aprobación.</li>
                                <li><strong>Aprobado (<CheckCircle className="inline h-4 w-4 text-green-600"/>):</strong> El proyecto está autorizado para producción.</li>
                                <li><strong>En Cola (<Hourglass className="inline h-4 w-4 text-cyan-600"/>):</strong> El proyecto está listo, esperando que se libere un recurso para poder iniciar.</li>
                                <li><strong>En Progreso (<Play className="inline h-4 w-4 text-blue-600"/>):</strong> El proyecto se está produciendo activamente.</li>
                                <li><strong>En Espera / Mantenimiento (<Pause className="inline h-4 w-4 text-gray-600"/>):</strong> La producción se detuvo temporalmente.</li>
                                <li><strong>Completado:</strong> El proyecto ha finalizado satisfactoriamente.</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Paso 3: Alertas y Solicitudes de Cambio.</strong>
                            <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                <li><strong>Aviso de &quot;Modificado&quot; (<AlertTriangle className="inline h-4 w-4 text-red-600" />):</strong> Si un proyecto se edita después de ser aprobado, aparecerá esta alerta para notificar a todos sobre el cambio.</li>
                                <li><strong>Solicitar Desaprobación (<Undo2 className="inline h-4 w-4 text-orange-600"/>):</strong> Si un proyecto ya aprobado necesita un cambio mayor, un usuario puede &quot;Solicitar Desaprobación&quot;. Esto bloquea el proyecto y requiere que un administrador la apruebe o rechace.</li>
                                <li><strong>Solicitar Cancelación:</strong> Permite pedir la cancelación de un proyecto que ya está en el flujo, requiriendo aprobación administrativa.</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Paso 4: Programación y Prioridades.</strong>
                            <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                <li><strong>Programación por Rango:</strong> Haz clic en el área de &quot;Fecha Programada&quot; para abrir un calendario y seleccionar un rango de fechas.</li>
                                <li><strong>Asignación:</strong> Asigna cada proyecto a un recurso u operario específico.</li>
                                <li><strong>Prioridades y Cuenta Regresiva:</strong> Usa el selector de prioridad para organizar el trabajo.</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Historial (<History className="inline h-4 w-4"/>):</strong> Haz clic en el icono de historial en cualquier proyecto para ver un registro detallado de cada cambio.
                        </li>
                    </ul>
                </AccordionContent>
                </AccordionItem>
                
                 <AccordionItem value="item-tickets">
                    <AccordionTrigger className="text-lg font-semibold">
                        <Ticket className="mr-4 h-6 w-6 text-blue-500" />
                        Tutorial: Módulo de Soporte Técnico (Tickets)
                    </AccordionTrigger>
                    <AccordionContent className="prose max-w-none text-base space-y-4">
                        <p>Esta herramienta es el centro de operaciones para gestionar las solicitudes de soporte de los clientes.</p>
                        <ol className="list-decimal space-y-4 pl-6">
                            <li>
                                <strong>Paso 1: Crear un Nuevo Ticket.</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>Haz clic en <strong>&quot;Nuevo Ticket&quot;</strong>. En el formulario, busca al cliente y selecciona el <strong>&quot;Servicio Requerido&quot;</strong>.</li>
                                    <li>Al seleccionar un cliente, el sistema mostrará su <strong>Paquete de Soporte</strong> y las horas disponibles.</li>
                                    <li>Completa el asunto y la descripción. El sistema puede asignar un técnico automáticamente según el tema.</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Paso 2: Registrar Tiempo.</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>Haz clic en <strong>&quot;Iniciar Cronómetro&quot;</strong> para contar el tiempo en tiempo real.</li>
                                    <li>Si lo prefieres, usa <strong>&quot;Añadir Entrada Manual&quot;</strong> para registrar el tiempo a posteriori.</li>
                                </ul>
                            </li>
                             <li>
                                <strong>Paso 3: Comunicarse y Resolver.</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>Usa el cuadro de respuesta para comunicarte. Cada mensaje queda registrado en la conversación.</li>
                                    <li>Actualiza los detalles del ticket (estado, prioridad, asignado) en el panel lateral.</li>
                                </ul>
                            </li>
                        </ol>
                    </AccordionContent>
                </AccordionItem>

                 <AccordionItem value="item-licenses">
                    <AccordionTrigger className="text-lg font-semibold">
                        <KeyRound className="mr-4 h-6 w-6 text-indigo-500" />
                        Tutorial: Módulo de Gestión de Licencias
                    </AccordionTrigger>
                    <AccordionContent className="prose max-w-none text-base space-y-4">
                        <p>Centraliza y controla todas las licencias de software, tanto las tuyas como las de tus clientes.</p>
                        <ol className="list-decimal space-y-4 pl-6">
                            <li>
                                <strong>Paso 1: Gestionar Catálogo de Software.</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>En la página principal, haz clic en <strong>&quot;Gestionar Software&quot;</strong>.</li>
                                    <li>Añade los productos que licencias. Marca &quot;Es Software Propio&quot; si es un desarrollo de la empresa.</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Paso 2: Crear y Asignar Licencias.</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>Haz clic en <strong>&quot;Nueva Licencia&quot;</strong>.</li>
                                    <li>Selecciona el cliente, el producto, pega la clave manual y establece el vencimiento o márcala como perpetua.</li>
                                </ul>
                            </li>
                        </ol>
                    </AccordionContent>
                </AccordionItem>

                 <AccordionItem value="item-analytics">
                    <AccordionTrigger className="text-lg font-semibold">
                        <AreaChart className="mr-4 h-6 w-6 text-rose-600" />
                        Tutorial: Módulo de Analíticas
                    </AccordionTrigger>
                    <AccordionContent className="prose max-w-none text-base space-y-4">
                        <p>Este es tu centro de inteligencia de negocio. Ofrece una vista de alto nivel sobre el rendimiento de tus operaciones.</p>
                        <ul className="list-disc space-y-3 pl-6">
                             <li>
                                <strong>Filtro por Fechas:</strong> Utiliza el selector de rango de fechas para analizar el rendimiento en periodos específicos.
                            </li>
                            <li>
                                <strong>KPIs Generales:</strong> Las tarjetas superiores dan un resumen instantáneo de la carga de trabajo actual.
                            </li>
                            <li>
                                <strong>Análisis de Tiempo:</strong> El gráfico de barras muestra cuántas horas ha registrado cada técnico, separadas por &quot;Facturables&quot; y &quot;No Facturables&quot;.
                            </li>
                        </ul>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-user-profile">
                <AccordionTrigger className="text-lg font-semibold">
                    <Briefcase className="mr-4 h-6 w-6 text-blue-500" />
                    Tutorial: Mi Perfil
                </AccordionTrigger>
                <AccordionContent className="prose max-w-none text-base">
                    <div className="flex items-start gap-4">
                        <Briefcase className="mt-1 h-6 w-6 text-blue-500 shrink-0" />
                        <div>
                            <p>
                            Aquí puedes personalizar tu propia cuenta de usuario.
                            </p>
                            <ul className="list-disc space-y-2 pl-6">
                                <li>Actualiza tu nombre, teléfono y WhatsApp.</li>
                                <li>Cambia tu foto de perfil haciendo clic sobre el círculo con tus iniciales.</li>
                                <li>Cambia tu contraseña y configura una pregunta de seguridad.</li>
                            </ul>
                        </div>
                    </div>
                </AccordionContent>
                </AccordionItem>
                
                 <AccordionItem value="item-admin">
                    <AccordionTrigger className="text-lg font-semibold">
                        <Wrench className="mr-4 h-6 w-6 text-slate-600" />
                        Guía Técnica: Panel de Administración (Configuración)
                    </AccordionTrigger>
                    <AccordionContent className="prose max-w-none text-base space-y-4">
                        <p>
                        Esta es la sala de máquinas del sistema, accesible solo para administradores.
                        </p>
                        <div className="space-y-4">
                            <div className="flex items-start gap-4">
                                <Rocket className="mt-1 h-6 w-6 text-blue-500 shrink-0" />
                                <div><h4 className="font-semibold">Gestión de Usuarios</h4><p>Permite crear, editar, eliminar y asignar roles a las cuentas de usuario.</p></div>
                            </div>
                            <div className="flex items-start gap-4">
                                <CheckCircle className="mt-1 h-6 w-6 text-green-500 shrink-0" />
                                <div><h4 className="font-semibold">Gestión de Roles</h4><p>Define qué puede hacer cada usuario asignando permisos específicos.</p></div>
                            </div>
                            <div className="flex items-start gap-4">
                                <Briefcase className="mt-1 h-6 w-6 text-orange-500 shrink-0" />
                                <div><h4 className="font-semibold">Configuración General</h4><p>Establece la identidad de tu empresa, ajusta parámetros globales y gestiona paquetes de soporte.</p></div>
                            </div>
                             <div className="flex items-start gap-4">
                                <MessageSquare className="mt-1 h-6 w-6 text-green-600 shrink-0" />
                                <div><h4 className="font-semibold">Buzón de Sugerencias</h4><p>Lee y gestiona el feedback enviado por los usuarios.</p></div>
                            </div>
                            <div className="flex items-start gap-4">
                                <DollarSign className="mt-1 h-6 w-6 text-emerald-600 shrink-0" />
                                <div><h4 className="font-semibold">Config. Cotizador</h4><p>Ajusta el prefijo y el número inicial del cotizador.</p></div>
                            </div>
                             <div className="flex items-start gap-4">
                                <Briefcase className="mt-1 h-6 w-6 text-purple-700 shrink-0" />
                                <div><h4 className="font-semibold">Config. Gestor de Proyectos</h4><p>Crea las opciones de asignación que se usarán en los proyectos.</p></div>
                            </div>
                            <div className="flex items-start gap-4">
                                <Save className="mt-1 h-6 w-6 text-red-500 shrink-0" />
                                <div><h4 className="font-semibold">Importar Datos</h4>
                                    <p>Sincroniza los datos maestros desde tu ERP mediante archivos o conexión directa SQL Server.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <Save className="mt-1 h-6 w-6 text-red-500 shrink-0" />
                                <div><h4 className="font-semibold">Mantenimiento</h4>
                                    <p>Herramientas para crear puntos de restauración, restaurar el sistema o resetear módulos específicos.</p>
                                </div>
                            </div>
                             <div className="flex items-start gap-4">
                                <Network className="mt-1 h-6 w-6 text-indigo-500 shrink-0" />
                                <div><h4 className="font-semibold">Configuración de API</h4><p>Define las URLs de los servicios externos que utiliza la aplicación.</p></div>
                            </div>
                             <div className="flex items-start gap-4">
                                <History className="mt-1 h-6 w-6 text-slate-500 shrink-0" />
                                <div><h4 className="font-semibold">Visor de Eventos</h4>
                                    <p>Registro de todo lo que sucede en el sistema para diagnóstico.</p>
                                </div>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-update">
                    <AccordionTrigger className="text-lg font-semibold">
                    <Wrench className="mr-4 h-6 w-6 text-slate-600" />
                    Guía Técnica: ¿Cómo se actualiza la aplicación?
                    </AccordionTrigger>
                    <AccordionContent className="prose max-w-none text-base space-y-4">
                        <p>Actualizar la aplicación es un proceso seguro gracias a las **migraciones automáticas**.</p>
                        
                        <h4 className="font-semibold">Proceso Seguro:</h4>
                        <ol className="list-decimal space-y-3 pl-6">
                            <li><strong>Paso 1: Backup (<Copy className="inline h-4 w-4"/>).</strong> Copia la carpeta `dbs/` a un lugar seguro.</li>
                            <li><strong>Paso 2: Reemplazar Archivos.</strong> Detén la aplicación, borra los archivos viejos (excepto `dbs/` y `.env.local`) y pon los nuevos.</li>
                            <li><strong>Paso 3: Reconstruir.</strong> Ejecuta `npm install` y `npm run build`.</li>
                            <li><strong>Paso 4: Reiniciar.</strong> El sistema aplicará las migraciones necesarias al arrancar.</li>
                        </ol>
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>¡Atención!</AlertTitle>
                            <AlertDescription>
                                Nunca reemplaces la carpeta `dbs/` del servidor con la de una nueva versión.
                            </AlertDescription>
                        </Alert>
                    </AccordionContent>
                </AccordionItem>

                 <AccordionItem value="item-changelog">
                    <AccordionTrigger className="text-lg font-semibold">
                        <ListChecks className="mr-4 h-6 w-6 text-fuchsia-600" />
                        Control de Cambios (Changelog)
                    </AccordionTrigger>
                    <AccordionContent className="prose max-w-none text-base space-y-4">
                         <h4 className="font-semibold text-lg">Versión 2.0.0 <Badge variant="secondary">Actual</Badge></h4>
                        <p className="text-sm text-muted-foreground">Lanzamiento: Noviembre 2024</p>
                        <ul className="list-disc space-y-3 pl-6">
                           <li><strong>NUEVO MÓDULO: Soporte Técnico.</strong> Sistema completo de tickets.</li>
                           <li><strong>NUEVO MÓDULO: Gestión de Licencias.</strong> Administra claves offline.</li>
                           <li><strong>NUEVO MÓDULO: Asistente de Costos.</strong> Procesa XML de compra.</li>
                           <li><strong>NUEVA FUNCIONALIDAD: Control de Tiempo.</strong> Cronómetro en tickets.</li>
                        </ul>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
            </CardContent>
        </Card>
      </div>
    </main>
  );
}
