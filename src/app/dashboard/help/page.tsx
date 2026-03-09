
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
import { Code, FileTerminal, Network, ShieldCheck, Users, FileDown, UserCog, DatabaseZap, Keyboard, DollarSign, ShieldQuestion, LifeBuoy, Rocket, CalendarCheck, ShoppingCart, Truck, PackageCheck, Factory, CheckCircle, XCircle, Search, Wrench, Save, Copy, Folder, AlertTriangle, ToggleRight, FilePlusIcon, Loader2, Play, Pause, History, Undo2, BadgeInfo, CreditCard, MessageSquare, Trash2, Download, Briefcase, Store, ListChecks, Hourglass, Ticket, KeyRound, AreaChart, FileScan, UploadCloud } from "lucide-react";
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
                    El objetivo es simple: tener todas las herramientas importantes (como hacer cotizaciones, solicitudes de compra o gestionar proyectos) en un solo lugar, con la flexibilidad de obtener datos tanto de archivos de texto como directamente desde el ERP.
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
                                <strong>Enviar una Sugerencia:</strong> En el panel principal, haz clic en el botón verde <strong>"Sugerencias y Mejoras"</strong> (<MessageSquare className="inline h-4 w-4" />). Se abrirá una ventana donde podrás escribir tu idea, reportar un problema o proponer una mejora. Al enviarla, los administradores serán notificados.
                            </li>
                            <li>
                                <strong>Gestión para Administradores:</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>Los administradores verán un contador de sugerencias no leídas en el botón de "Configuración" del menú lateral.</li>
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
                                    <li>Empieza a escribir el nombre, código o cédula del cliente en el campo "Buscar Cliente". El sistema te mostrará una lista de sugerencias. Haz clic o presiona `Enter` para seleccionarlo.</li>
                                    <li>Al seleccionar, aparecerá una tarjeta con los <strong>datos críticos del ERP</strong> (<CreditCard className="inline h-4 w-4"/>): cédula, límite de crédito, condición de pago y vendedor asignado. Esto te da una visión instantánea del estado del cliente.</li>
                                    <li><strong>Verificar Exoneración (<ShieldQuestion className="inline h-4 w-4" />):</strong> Si el cliente tiene una exoneración en el ERP, aparecerá una segunda tarjeta. El sistema consultará a Hacienda **en tiempo real** y te mostrará dos estados para que los compares: el del ERP y el de Hacienda. Esto te permite confirmar si la exoneración sigue vigente antes de aplicarla.</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Paso 2: Agregar Productos y Consultar Detalles.</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>En el campo "Agregar Producto", busca por código o descripción. El sistema te sugerirá productos y te mostrará el **inventario actual del ERP** entre paréntesis.</li>
                                    <li>Presiona `Enter` o haz clic para añadir el producto a la cotización. El sistema aplicará el impuesto automáticamente (13% por defecto, 1% para canasta básica, o 0% si el cliente tiene una exoneración válida).</li>
                                    <li><strong>Consultar Info del Producto (<BadgeInfo className="inline h-4 w-4"/>):</strong> Haz clic en cualquier parte de la fila de un producto ya agregado. Aparecerá una tarjeta con información detallada del ERP: su **clasificación**, la **fecha del último ingreso** y notas importantes.</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Paso 3: Ajustar Cantidades y Precios.</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>Modifica directamente los campos de cantidad y precio.</li>
                                    <li><strong>Atajos de Teclado (<Keyboard className="inline h-4 w-4" />):</strong> Usa la tecla `Enter` en los campos "Cantidad" y "Precio". El sistema te moverá eficientemente: de Cantidad a Precio, y de Precio de vuelta al buscador de productos para que puedas seguir añadiendo artículos sin usar el mouse.</li>
                                    <li><strong>Uso en Móviles:</strong> En pantallas pequeñas, los campos de Cantidad y Precio ahora tienen más espacio. Si necesitas ver otras columnas como "Cabys" o "Unidad", puedes activarlas desde los checkboxes que aparecen encima de la tabla.</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Paso 4: Finalizar y Generar.</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>Ajusta las condiciones de pago, la validez de la oferta y añade cualquier nota adicional.</li>
                                    <li><strong>Borradores (<Folder className="inline h-4 w-4" />):</strong> Si no terminaste, guarda la cotización como borrador. Puedes cargarla más tarde desde el botón "Ver Borradores".</li>
                                    <li><strong>Generar PDF (<FileDown className="inline h-4 w-4" />):</strong> Cuando todo esté listo, genera el PDF. El número de cotización se actualizará automáticamente para la próxima vez.</li>
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
                                <strong>Paso 2: Añadir Costos Adicionales.</strong> En la tarjeta "Costos Adicionales", ingresa el costo total del transporte, aduanas u otros gastos asociados a la importación o compra. El sistema prorrateará estos costos de manera inteligente entre todos los artículos cargados, dándote un costo unitario real.
                            </li>
                            <li>
                                <strong>Paso 3: Ajustar Márgenes de Ganancia.</strong> Por defecto, cada artículo tiene un margen del 20%. Puedes ajustar este porcentaje individualmente en la columna "Margen". El "P.V.P Unitario Sugerido" se recalculará automáticamente.
                            </li>
                            <li>
                                <strong>Paso 4: Guardar y Exportar.</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>Si necesitas continuar más tarde, usa el botón <strong>"Guardar Borrador"</strong> (<Save className="inline h-4 w-4"/>).</li>
                                    <li>Cuando estés listo, haz clic en <strong>"Exportar para ERP"</strong> (<FileDown className="inline h-4 w-4"/>). Esto generará un archivo Excel con el formato exacto que tu ERP necesita para una importación masiva de precios, ahorrándote horas de trabajo manual.</li>
                                </ul>
                            </li>
                        </ol>
                    </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-requests">
                <AccordionTrigger className="text-lg font-semibold">
                    <ShoppingCart className="mr-4 h-6 w-6 text-yellow-500" />
                    Tutorial: Módulo Solicitud de Compra
                </AccordionTrigger>
                <AccordionContent className="prose max-w-none text-base space-y-4">
                    <p>
                    Esta herramienta te permite crear, gestionar y dar seguimiento a las solicitudes de compra internas de manera centralizada.
                    </p>
                    <ul className="list-disc space-y-3 pl-6">
                    <li>
                        <strong>Paso 1: Crear Solicitud (<FilePlusIcon className="inline h-4 w-4" />):</strong> Haz clic en "Nueva Solicitud" para abrir el formulario. Busca al cliente y el artículo de la misma forma que en el cotizador. Completa los campos como la cantidad requerida y la fecha en que lo necesitas.
                    </li>
                     <li>
                        <strong>Paso 2: Integración con Gestor de Proyectos.</strong> Antes de guardar, fíjate en la casilla **"Generar Proyecto al Recibir"**. Si marcas esta opción, en cuanto la solicitud sea marcada como "Recibida", el sistema creará automáticamente un **Proyecto** en el Gestor de Proyectos con los datos de esta compra.
                    </li>
                    <li>
                        <strong>Paso 3: Entender el Flujo de Estados.</strong> Las solicitudes pasan por varios estados para un seguimiento claro:
                        <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                            <li><strong>Pendiente:</strong> La solicitud ha sido creada y está esperando aprobación.</li>
                            <li><strong>Aprobada (<CheckCircle className="inline h-4 w-4 text-green-600"/>):</strong> Un usuario con permisos ha aprobado la compra.</li>
                            <li><strong>Ordenada (<Truck className="inline h-4 w-4 text-blue-600"/>):</strong> Ya se realizó el pedido al proveedor.</li>
                            <li><strong>Recibida (<PackageCheck className="inline h-4 w-4 text-teal-600"/>):</strong> El producto ha llegado. Aquí puedes registrar la cantidad real que se recibió.</li>
                            <li><strong>Cancelada (<XCircle className="inline h-4 w-4 text-red-600"/>):</strong> La solicitud ha sido cancelada.</li>
                        </ul>
                    </li>
                    <li>
                        <strong>Aviso de "Modificado" (<AlertTriangle className="inline h-4 w-4 text-red-600" />):</strong> Si una solicitud es editada (cambiando cantidad, fecha, etc.) *después* de haber sido Aprobada u Ordenada, aparecerá una alerta visual "Modificado". Esto sirve como una advertencia para que todos los involucrados estén al tanto del cambio.
                    </li>
                    <li>
                        <strong>Solicitar Cancelación:</strong> Si una solicitud ya está Aprobada u Ordenada, no se puede cancelar directamente. En su lugar, un usuario con permisos puede "Solicitar Cancelación". Esto pone la solicitud en un estado de espera y notifica a un administrador, quien debe aprobar o rechazar la cancelación, dejando un registro del motivo.
                    </li>
                    <li>
                        <strong>Paso 5: Navegar en el Historial.</strong> Para mantener la velocidad, la vista de "Archivadas" carga los datos por páginas. Puedes elegir ver 50, 100 o 200 registros por página y navegar entre ellas. Los filtros de búsqueda se aplicarán a todo el historial, no solo a la página actual.
                    </li>
                    </ul>
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
                                <li><strong>En Cola (<Hourglass className="inline h-4 w-4 text-cyan-600"/>):</strong> El proyecto está listo, esperando que se libere un recurso (ej: una máquina) para poder iniciar.</li>
                                <li><strong>En Progreso (<Play className="inline h-4 w-4 text-blue-600"/>):</strong> El proyecto se está produciendo activamente.</li>
                                <li><strong>En Espera / Mantenimiento (<Pause className="inline h-4 w-4 text-gray-600"/>):</strong> La producción se detuvo temporalmente.</li>
                                <li><strong>Completado (<PackageCheck className="inline h-4 w-4 text-teal-600"/>):</strong> La producción ha finalizado.</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Paso 3: Alertas y Solicitudes de Cambio.</strong>
                            <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                <li><strong>Aviso de "Modificado" (<AlertTriangle className="inline h-4 w-4 text-red-600" />):</strong> Si un proyecto se edita después de ser aprobado, aparecerá esta alerta para notificar a todos sobre el cambio.</li>
                                <li><strong>Solicitar Desaprobación (<Undo2 className="inline h-4 w-4 text-orange-600"/>):</strong> Si un proyecto ya aprobado necesita un cambio mayor (ej: cambiar de producto), un usuario puede "Solicitar Desaprobación". Esto bloquea el proyecto y requiere que un administrador la apruebe o rechace para devolverlo al estado "Pendiente".</li>
                                <li><strong>Solicitar Cancelación (<XCircle className="inline h-4 w-4 text-red-600"/>):</strong> Similar a la desaprobación, permite pedir la cancelación de un proyecto que ya está en el flujo, requiriendo aprobación administrativa.</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Paso 4: Programación y Prioridades.</strong>
                            <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                <li><strong>Programación por Rango:</strong> Haz clic en el área de "Fecha Programada" para abrir un calendario y seleccionar un rango de fechas de inicio y fin.</li>
                                <li><strong>Asignación:</strong> Asigna cada proyecto a una máquina, proceso u operario específico desde el menú desplegable. Estas opciones se configuran en Administración.</li>
                                <li><strong>Prioridades y Cuenta Regresiva:</strong> Usa el selector de prioridad y fíjate en el indicador de días restantes (basado en la fecha de entrega) para organizar el trabajo.</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Historial (<History className="inline h-4 w-4"/>):</strong> Haz clic en el icono de historial en cualquier proyecto para ver un registro detallado de cada cambio de estado, quién lo hizo y cuándo.
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
                                    <li>Haz clic en <strong>"Nuevo Ticket"</strong>. En el formulario, busca al cliente y selecciona el <strong>"Servicio Requerido"</strong> del catálogo.</li>
                                    <li>Al seleccionar un cliente, el sistema mostrará automáticamente su <strong>Paquete de Soporte</strong> y las horas disponibles. Al seleccionar un servicio, una alerta te dirá si está <strong>cubierto por el paquete</strong>.</li>
                                    <li>Completa el asunto, la descripción del problema y asigna el ticket a un técnico o déjalo sin asignar para que el sistema lo haga automáticamente según el tema.</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Paso 2: Registrar Tiempo.</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>Dentro de un ticket, verás una sección de <strong>"Control de Tiempo"</strong>.</li>
                                    <li>Haz clic en <strong>"Iniciar Cronómetro"</strong> para empezar a contar el tiempo en tiempo real. Cuando termines, haz clic en <strong>"Detener Cronómetro"</strong>. El sistema te pedirá una nota y te preguntará si el tiempo es facturable.</li>
                                    <li>Si olvidaste iniciar el cronómetro, puedes usar <strong>"Añadir Entrada Manual"</strong> para registrar el tiempo a posteriori.</li>
                                    <li>El historial de tiempo se irá acumulando en una tabla dentro del ticket.</li>
                                </ul>
                            </li>
                             <li>
                                <strong>Paso 3: Comunicarse y Resolver.</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>Usa el cuadro de respuesta para comunicarte. Cada mensaje queda registrado en la conversación del ticket.</li>
                                    <li>Actualiza los detalles del ticket (estado, prioridad, asignado) en el panel lateral derecho para mantener a todos informados.</li>
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
                                    <li>En la página principal del módulo, haz clic en <strong>"Gestionar Software"</strong>.</li>
                                    <li>Aquí puedes añadir todos los productos que licencias (ej: "Antivirus Anual", "Microsoft 365 Business", "Suscripción Clic-Soporte"). Marca la casilla "Es Software Propio" si es un producto desarrollado por ti.</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Paso 2: Crear y Asignar Licencias.</strong>
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>Haz clic en <strong>"Nueva Licencia"</strong>.</li>
                                    <li>Selecciona el cliente, el producto de software que le corresponde, pega la clave de licencia y establece la fecha de vencimiento. Si la licencia no vence, marca la casilla "Licencia Perpetua".</li>
                                    <li>La tabla principal te mostrará todas las licencias, con insignias de colores que te alertan sobre las que están activas, vencidas o por vencer.</li>
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
                                <strong>Filtro por Fechas:</strong> Utiliza el selector de rango de fechas en la parte superior para analizar el rendimiento en periodos específicos (ej: este mes, el último trimestre).
                            </li>
                            <li>
                                <strong>KPIs Generales:</strong> Las tarjetas superiores te dan un resumen instantáneo de la carga de trabajo actual: cuántos tickets están abiertos o en progreso, cuántos proyectos están activos y cuántas solicitudes de compra están pendientes.
                            </li>
                            <li>
                                <strong>Análisis de Tiempo:</strong> El gráfico de barras te muestra cuántas horas ha registrado cada técnico, separadas por "Facturables" y "No Facturables". Esto te ayuda a entender la productividad del equipo y la rentabilidad de los servicios.
                            </li>
                        </ul>
                    </AccordionContent>
                </AccordionItem>

                 <AccordionItem value="item-hacienda">
                    <AccordionTrigger className="text-lg font-semibold">
                        <Search className="mr-4 h-6 w-6 text-indigo-500" />
                        Tutorial: Consultas a Hacienda
                    </AccordionTrigger>
                    <AccordionContent className="prose max-w-none text-base space-y-4">
                        <p>
                        Esta herramienta te permite consultar información directamente de las APIs del Ministerio de Hacienda de Costa Rica de forma centralizada.
                        </p>
                        <ul className="list-disc space-y-3 pl-6">
                            <li>
                                <strong>Búsqueda Unificada:</strong> Es la forma más potente de usar el módulo. Busca un cliente del ERP y el sistema hará todo el trabajo:
                                <ul className="list-[circle] space-y-2 pl-5 mt-2 text-sm">
                                    <li>Consultará la <strong>Situación Tributaria</strong> del cliente usando su cédula.</li>
                                    <li>Buscará si tiene una <strong>exoneración asociada en el ERP</strong>.</li>
                                    <li>Si la encuentra, consultará esa exoneración en Hacienda para ver su <strong>estado y los códigos CABYS</strong> que cubre.</li>
                                    <li>Te presentará toda la información consolidada en una sola pantalla.</li>
                                </ul>
                            </li>
                             <li>
                                <strong>Búsquedas Individuales:</strong> También puedes usar las pistas "Situación Tributaria" y "Exoneraciones" para hacer consultas directas a Hacienda ingresando una cédula o un número de autorización, respectivamente.
                            </li>
                        </ul>
                    </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-user-profile">
                <AccordionTrigger className="text-lg font-semibold">
                    <UserCog className="mr-4 h-6 w-6 text-blue-500" />
                    Tutorial: Mi Perfil
                </AccordionTrigger>
                <AccordionContent className="prose max-w-none text-base">
                    <div className="flex items-start gap-4">
                        <UserCog className="mt-1 h-6 w-6 text-blue-500 shrink-0" />
                        <div>
                            <p>
                            Aquí puedes personalizar tu propia cuenta de usuario.
                            </p>
                            <ul className="list-disc space-y-2 pl-6">
                                <li>Actualiza tu nombre, teléfono y WhatsApp.</li>
                                <li>Cambia tu foto de perfil haciendo clic sobre el círculo con tus iniciales.</li>
                                <li>Cambia tu contraseña.</li>
                                <li>Configura una pregunta de seguridad para poder recuperar tu cuenta si olvidas la contraseña.</li>
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
                        Esta es la sala de máquinas del sistema, accesible solo para administradores. Aquí se configura todo el comportamiento de la aplicación, módulo por módulo.
                        </p>
                        <div className="space-y-4">
                            <div className="flex items-start gap-4">
                                <Users className="mt-1 h-6 w-6 text-blue-500 shrink-0" />
                                <div><h4 className="font-semibold">Gestión de Usuarios</h4><p>Permite crear, editar, eliminar y asignar roles a las cuentas de usuario que pueden acceder al sistema.</p></div>
                            </div>
                            <div className="flex items-start gap-4">
                                <ShieldCheck className="mt-1 h-6 w-6 text-green-500 shrink-0" />
                                <div><h4 className="font-semibold">Gestión de Roles</h4><p>Define qué puede hacer cada usuario. Puedes crear roles personalizados (ej: "Supervisor") y asignar permisos específicos para cada módulo.</p></div>
                            </div>
                            <div className="flex items-start gap-4">
                                <Briefcase className="mt-1 h-6 w-6 text-orange-500 shrink-0" />
                                <div><h4 className="font-semibold">Configuración General</h4><p>Establece la identidad de tu empresa (nombre, logo, cédula jurídica), ajusta parámetros globales de la interfaz y gestiona los paquetes de soporte y el catálogo de servicios.</p></div>
                            </div>
                             <div className="flex items-start gap-4">
                                <MessageSquare className="mt-1 h-6 w-6 text-green-600 shrink-0" />
                                <div><h4 className="font-semibold">Buzón de Sugerencias</h4><p>Lee y gestiona el feedback enviado por los usuarios a través del botón "Sugerencias y Mejoras". Es el canal de comunicación directo para mejorar la aplicación.</p></div>
                            </div>
                            <div className="flex items-start gap-4">
                                <DollarSign className="mt-1 h-6 w-6 text-emerald-600 shrink-0" />
                                <div><h4 className="font-semibold">Config. Cotizador</h4><p>Ajusta el comportamiento del Cotizador, definiendo el prefijo (ej. "COT-") y el número con el que iniciará la siguiente cotización.</p></div>
                            </div>
                             <div className="flex items-start gap-4">
                                <Factory className="mt-1 h-6 w-6 text-purple-700 shrink-0" />
                                <div><h4 className="font-semibold">Config. Gestor de Proyectos</h4><p>Personaliza el Gestor de Proyectos. Aquí puedes crear y nombrar las opciones de asignación (ej: "Técnicos", "Máquinas") que se usarán en los proyectos.</p></div>
                            </div>
                             <div className="flex items-start gap-4">
                                <Store className="mt-1 h-6 w-6 text-amber-700 shrink-0" />
                                <div><h4 className="font-semibold">Config. Compras</h4><p>Define las opciones que aparecerán en el módulo de Solicitudes de Compra, como las diferentes rutas de entrega o los métodos de envío disponibles.</p></div>
                            </div>
                             <div className="flex items-start gap-4">
                                <Hourglass className="mt-1 h-6 w-6 text-green-700 shrink-0" />
                                <div><h4 className="font-semibold">Config. Inventario</h4><p>Gestiona las bodegas del sistema. Puedes añadir nuevas bodegas, marcar una como predeterminada o decidir si una bodega debe ser visible en los desgloses de inventario.</p></div>
                            </div>
                             <div className="flex items-start gap-4">
                                <Ticket className="mt-1 h-6 w-6 text-blue-700 shrink-0" />
                                <div><h4 className="font-semibold">Config. Soporte Técnico</h4><p>Define los "Temas de Ayuda" para clasificar los tickets y permite pre-asignarles una prioridad, un técnico o un servicio por defecto para automatizar el flujo de trabajo.</p></div>
                            </div>
                            <div className="flex items-start gap-4">
                                <DatabaseZap className="mt-1 h-6 w-6 text-red-500 shrink-0" />
                                <div><h4 className="font-semibold">Importar Datos</h4>
                                    <p>Sincroniza los datos maestros (clientes, productos, etc.) desde tu ERP. Tienes dos modos: por <strong>Archivos</strong> (cargando .txt o .csv) o por <strong>SQL Server</strong> (conectando directamente a la base de datos de tu ERP).</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <DatabaseZap className="mt-1 h-6 w-6 text-red-500 shrink-0" />
                                <div><h4 className="font-semibold">Mantenimiento</h4>
                                    <p>Herramientas críticas. Aquí puedes:</p>
                                    <ul className="list-disc pl-5 text-sm space-y-1 mt-2">
                                        <li><strong>Crear un Punto de Restauración (<Save className="inline h-4 w-4"/>):</strong> Genera una copia de seguridad completa de todas las bases de datos del sistema. Es vital hacer esto antes de una actualización.</li>
                                        <li><strong>Restaurar desde un Backup:</strong> Selecciona una fecha de la lista de puntos de restauración disponibles. Cada punto tiene un ícono de descarga (<Download className="inline h-4 w-4"/>) para que puedas guardar una copia local. Usa el checkbox para ver todos los puntos guardados.</li>
                                        <li><strong>Limpiar Backups Antiguos (<Trash2 className="inline h-4 w-4"/>):</strong> Para ahorrar espacio, esta opción elimina todos los puntos de restauración excepto el más reciente, garantizando que siempre tengas un respaldo.</li>
                                        <li><strong>Zona de Peligro (<AlertTriangle className="inline h-4 w-4"/>):</strong> Permite resetear los datos de un módulo específico (ej: borrar todos los proyectos) sin afectar al resto del sistema, o hacer un reseteo de fábrica total que borra todo.</li>
                                    </ul>
                                </div>
                            </div>
                             <div className="flex items-start gap-4">
                                <Network className="mt-1 h-6 w-6 text-indigo-500 shrink-0" />
                                <div><h4 className="font-semibold">Configuración de API</h4><p>Define las URLs de los servicios externos que utiliza la aplicación, como las APIs de Hacienda para consultar el tipo de cambio, la situación tributaria y el estado de las exoneraciones.</p></div>
                            </div>
                             <div className="flex items-start gap-4">
                                <FileTerminal className="mt-1 h-6 w-6 text-slate-500 shrink-0" />
                                <div><h4 className="font-semibold">Visor de Eventos</h4>
                                    <p>Un registro (log) de todo lo que sucede en el sistema. Es una herramienta invaluable para diagnosticar problemas. Permite filtrar y limpiar los registros de forma granular (Operativos vs. Sistema) y conserva por defecto los últimos 30 días, a menos que se indique lo contrario.</p>
                                </div>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-import">
                    <AccordionTrigger className="text-lg font-semibold">
                    <DatabaseZap className="mr-4 h-6 w-6 text-red-500" />
                    Guía Técnica: Importación de Datos (Archivos y SQL)
                    </AccordionTrigger>
                    <AccordionContent className="prose max-w-none text-base space-y-4">
                        <p>La importación se gestiona desde <strong>Administración &gt; Importar Datos</strong>. Aquí puedes elegir el método que mejor se adapte a tus necesidades.</p>
                        
                        <h4 className="font-semibold">Modo 1: Desde Archivos (.txt / .csv)</h4>
                        <ol className="list-decimal space-y-2 pl-6">
                            <li>Activa el interruptor en "Importar desde Archivos".</li>
                            <li>Asegúrate de que tus archivos de texto (`.txt` separados por tabulador o `.csv` para CABYS) estén en una carpeta en el servidor.</li>
                            <li>En cada tarjeta, introduce la <strong>ruta completa</strong> al archivo correspondiente (ej: `C:\\import_data\\clientes.txt`).</li>
                            <li>Haz clic en el botón "Procesar Archivo" de cada tarjeta para cargar los datos.</li>
                        </ol>

                        <h4 className="font-semibold">Modo 2: Desde SQL Server (Recomendado)</h4>
                        <p>Este método es el más robusto y eficiente. Sincroniza los datos directamente desde tu ERP a la base de datos local de la aplicación.</p>
                        <ol className="list-decimal space-y-2 pl-6">
                            <li>Activa el interruptor en "Importar desde SQL Server".</li>
                            <li>Despliega la sección <strong>"Configuración de Conexión a SQL Server"</strong>.</li>
                            <li>Rellena los datos de tu servidor ERP. <strong>Importante:</strong> Por seguridad, se recomienda crear un usuario de SQL que solo tenga permisos de <strong>lectura (`SELECT`)</strong> sobre las tablas o vistas necesarias.</li>
                            <li>Guarda la configuración. Estos datos se almacenarán de forma segura en un archivo `.env` en el servidor.</li>
                            <li>Despliega la sección <strong>"Gestión de Consultas SQL"</strong>.</li>
                            <li>Para cada tipo de dato (Clientes, Artículos, etc.), pega la consulta `SELECT` completa que extrae la información de tu ERP. Asegúrate de que los nombres de las columnas en tu `SELECT` coincidan con los esperados por el sistema (ej. `SELECT ID_Cliente AS CLIENTE, NombreCliente AS NOMBRE, ... FROM VistaClientes`).</li>
                            <li>Guarda las consultas.</li>
                            <li>Una vez configurado, solo tienes que hacer clic en el botón grande <strong>"Importar Todos los Datos desde ERP"</strong> para ejecutar todas las consultas y actualizar la base de datos local.</li>
                        </ol>
                        <Alert>
                            <ToggleRight className="h-4 w-4" />
                            <AlertTitle>Botón de Sincronización Rápida</AlertTitle>
                            <AlertDescription>
                                Puedes dar permiso (`admin:import:run`) a ciertos roles para que vean un botón de "Sincronizar Datos del ERP" en el panel principal. Esto les permite actualizar los datos sin necesidad de acceder a la pantalla de configuración.
                            </AlertDescription>
                        </Alert>
                    </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-update">
                    <AccordionTrigger className="text-lg font-semibold">
                    <Wrench className="mr-4 h-6 w-6 text-slate-600" />
                    Guía Técnica: ¿Cómo se actualiza la aplicación?
                    </AccordionTrigger>
                    <AccordionContent className="prose max-w-none text-base space-y-4">
                        <p>Actualizar la aplicación a una nueva versión sin perder tus datos es un proceso crítico. El sistema está diseñado para manejar esto de forma segura gracias a las **migraciones automáticas**.</p>
                        
                        <h4 className="font-semibold">Proceso de Actualización Seguro:</h4>
                        <ol className="list-decimal space-y-3 pl-6">
                            <li>
                                <strong>Paso 1: Realizar una Copia de Seguridad (<Copy className="inline h-4 w-4"/>).</strong> Este es el paso más importante. Antes de tocar nada, ve al directorio de la aplicación en tu servidor y haz una copia de seguridad completa de la carpeta `dbs/`. Esta carpeta contiene todas tus bases de datos (usuarios, proyectos, solicitudes, etc.).
                            </li>
                            <li>
                                <strong>Paso 2: Reemplazar Archivos.</strong> Detén la aplicación (por ejemplo, usando `pm2 stop clic-tools`). Luego, borra todos los archivos y carpetas de la versión anterior **excepto** la carpeta `dbs/` y, si existe, el archivo `.env.local`. Después, copia todos los archivos de la nueva versión en su lugar.
                            </li>
                            <li>
                                <strong>Paso 3: Actualizar y Reconstruir.</strong> Abre una terminal en la carpeta del proyecto, ejecuta `npm install --omit=dev` para instalar cualquier nueva dependencia y luego `npm run build` para compilar la nueva versión.
                            </li>
                            <li>
                                <strong>Paso 4: Reiniciar.</strong> Vuelve a iniciar la aplicación (ej: `pm2 start clic-tools`). Al arrancar, el sistema detectará que las bases de datos en la carpeta `dbs/` no tienen las últimas columnas o tablas y las añadirá automáticamente sin borrar los datos existentes.
                            </li>
                        </ol>
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>¡Atención!</AlertTitle>
                            <AlertDescription>
                                Nunca reemplaces la carpeta `dbs/` del servidor con la de la nueva versión, ya que esto borraría todos tus datos de producción.
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
                           <li>
                                <strong>NUEVO MÓDULO: Soporte Técnico.</strong> Se introduce un sistema completo de gestión de tickets.
                            </li>
                             <li>
                                <strong>NUEVO MÓDULO: Gestión de Licencias.</strong> Herramienta para administrar licencias de software de clientes.
                            </li>
                            <li>
                                <strong>NUEVO MÓDULO: Asistente de Costos.</strong> Herramienta para procesar facturas XML de compra y calcular precios de venta.
                            </li>
                             <li>
                                <strong>NUEVO MÓDULO: Analíticas y Reportes.</strong> Un panel central con KPIs de todos los módulos.
                            </li>
                            <li>
                                <strong>NUEVA FUNCIONALIDAD: Control de Tiempo.</strong> Se añade un cronómetro y registro de horas en el módulo de Tickets.
                            </li>
                             <li>
                                <strong>NUEVA FUNCIONALIDAD: Paquetes de Soporte.</strong> Se permite configurar paquetes de servicios y asignarlos a clientes para validar la cobertura en los tickets.
                            </li>
                             <li>
                                <strong>Integración Compras-Proyectos:</strong> Se añade la opción en Solicitudes de Compra para generar automáticamente un Proyecto al recibir el material.
                            </li>
                        </ul>
                        <h4 className="font-semibold text-lg">Versión 1.5.2</h4>
                        <p className="text-sm text-muted-foreground">Lanzamiento: Octubre 2024</p>
                        <ul className="list-disc space-y-3 pl-6">
                           <li>
                                <strong>Mejora de UX en Cotizador:</strong> Se ha mejorado la interfaz del Cotizador en dispositivos móviles. Ahora, en pantallas pequeñas, los campos de Cantidad y Precio tienen más espacio, y se ha añadido una opción para mostrar u ocultar columnas secundarias, mejorando la usabilidad.
                            </li>
                             <li>
                                <strong>Implementación de Logging Completo:</strong> Se añadió registro de eventos (auditoría) para acciones críticas en todos los módulos.
                            </li>
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
