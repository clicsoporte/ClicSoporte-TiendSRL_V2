'use server';

/**
 * @fileoverview Server actions for sending detailed ticket reports via email.
 */

import { sendEmail } from '@/modules/core/lib/email-service';
import type { Company, Ticket, TimeEntry, User } from '@/modules/core/types';
import { logInfo, logError } from '@/modules/core/lib/logger';
import { format, parseISO } from 'date-fns';

interface SendTicketReportParams {
    recipients: string[];
    ticket: Ticket;
    timeEntries: TimeEntry[];
    companyData: Company;
    notes?: string;
    sender: User;
}

export async function sendTicketReportByEmail(params: SendTicketReportParams) {
    const { recipients, ticket, timeEntries, companyData, notes, sender } = params;

    const formatDuration = (ms: number | null) => {
        if (!ms) return "00:00";
        const totalMinutes = Math.floor(ms / 60000);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const totalMs = timeEntries.reduce((acc, e) => acc + (e.duration || 0), 0);
    const billableMs = timeEntries.reduce((acc, e) => acc + (e.billableDuration || 0), 0);

    const rowsHtml = timeEntries.map(entry => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 12px;">${format(parseISO(entry.startTime), 'dd/MM/yy HH:mm')}</td>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 13px;">${entry.notes || 'Soporte técnico'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 13px; text-align: center;">${entry.isBillable ? '✅' : '❌'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 13px; text-align: right; font-family: monospace;">${formatDuration(entry.duration)}</td>
        </tr>
    `).join('');

    const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; color: #2d3748; line-height: 1.5;">
            <!-- Header -->
            <div style="border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <h1 style="margin: 0; color: #2563eb; font-size: 24px;">REPORTE DE SERVICIO</h1>
                    <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 18px; color: #4a5568;"># ${ticket.consecutive}</p>
                </div>
                <div style="text-align: right;">
                    <h2 style="margin: 0; font-size: 16px; color: #1a202c;">${companyData.name}</h2>
                    <p style="margin: 2px 0; font-size: 12px; color: #718096;">Cédula Jurídica: ${companyData.taxId}</p>
                </div>
            </div>

            <!-- Ticket Info -->
            <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
                <h3 style="margin-top: 0; font-size: 16px; border-bottom: 1px solid #cbd5e0; padding-bottom: 10px;">Detalles del Caso</h3>
                <table style="width: 100%; font-size: 14px;">
                    <tr>
                        <td style="padding: 4px 0; color: #718096; width: 120px;">Asunto:</td>
                        <td style="padding: 4px 0; font-weight: bold;">${ticket.subject}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; color: #718096;">Cliente:</td>
                        <td style="padding: 4px 0;">${ticket.customerName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; color: #718096;">Fecha Apertura:</td>
                        <td style="padding: 4px 0;">${format(parseISO(ticket.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; color: #718096;">Estado Final:</td>
                        <td style="padding: 4px 0; text-transform: uppercase; font-weight: bold; color: #16a34a;">${ticket.status === 'completed' ? 'RESUELTO' : ticket.status}</td>
                    </tr>
                </table>
            </div>

            <!-- Time breakdown Table -->
            <h4 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #4a5568;">Desglose de Tiempos</h4>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                    <tr style="background-color: #2d3748; color: #ffffff; text-align: left;">
                        <th style="padding: 10px; font-size: 12px;">Fecha/Hora</th>
                        <th style="padding: 10px; font-size: 12px;">Actividad</th>
                        <th style="padding: 10px; font-size: 12px; text-align: center;">Contrato</th>
                        <th style="padding: 10px; font-size: 12px; text-align: right;">Duración</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    <tr style="background-color: #f8fafc; font-weight: bold;">
                        <td colspan="3" style="padding: 10px; text-align: right; border-top: 2px solid #2d3748;">TIEMPO REAL TOTAL:</td>
                        <td style="padding: 10px; text-align: right; border-top: 2px solid #2d3748; font-family: monospace;">${formatDuration(totalMs)}</td>
                    </tr>
                    <tr style="background-color: #f8fafc; font-weight: bold; color: #2563eb;">
                        <td colspan="3" style="padding: 10px; text-align: right;">TIEMPO FACTURABLE (REDONDEADO):</td>
                        <td style="padding: 10px; text-align: right; font-family: monospace;">${formatDuration(billableMs)}</td>
                    </tr>
                </tfoot>
            </table>

            <!-- Coverage & Notes -->
            <div style="display: flex; gap: 40px; margin-bottom: 40px;">
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 10px 0; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Notas Adicionales</h4>
                    <p style="font-size: 12px; color: #4a5568; white-space: pre-wrap;">${notes || 'Reporte de servicio generado para efectos de control y facturación.'}</p>
                </div>
                <div style="width: 250px; background-color: ${ticket.isBillable ? '#fef2f2' : '#f0fdf4'}; border: 1px solid ${ticket.isBillable ? '#fecaca' : '#bbf7d0'}; padding: 15px; border-radius: 8px;">
                    <h4 style="margin: 0 0 5px 0; font-size: 12px; color: ${ticket.isBillable ? '#991b1b' : '#166534'};">COBERTURA</h4>
                    <p style="font-size: 14px; font-weight: bold; margin: 0;">${ticket.isBillable ? 'Servicio Adicional' : 'Bajo Contrato'}</p>
                    <p style="font-size: 10px; margin-top: 5px; color: ${ticket.isBillable ? '#b91c1c' : '#15803d'};">
                        ${ticket.isBillable ? 'Este servicio genera un cargo adicional fuera de los paquetes mensuales.' : 'Este servicio está cubierto por su plan de soporte actual.'}
                    </p>
                </div>
            </div>

            <!-- Signature -->
            <div style="border-top: 1px solid #edf2f7; padding-top: 20px; font-size: 12px; color: #718096;">
                <p style="margin: 0;">Reporte emitido por:</p>
                <p style="margin: 5px 0; font-weight: bold; color: #2d3748; font-size: 14px;">${sender.name}</p>
                <p style="margin: 0;">${sender.email}</p>
                <p style="margin: 20px 0 0 0; font-style: italic; font-size: 10px; text-align: center;">Este es un documento oficial generado por Clic-Soporte.</p>
            </div>
        </div>
    `;

    try {
        await sendEmail({
            to: recipients,
            subject: `REPORTE DE SERVICIO: ${ticket.consecutive} - ${ticket.subject}`,
            html
        });
        await logInfo(`Ticket report ${ticket.consecutive} sent to ${recipients.join(', ')}`);
        return { success: true };
    } catch (error: unknown) {
        const err = error as Error;
        await logError(`Failed to send ticket report ${ticket.consecutive}`, { error: err.message });
        throw err;
    }
}
