'use server';

/**
 * @fileoverview Server actions for sending billing statements and activity reports via email.
 */

import { sendEmail } from '@/modules/core/lib/email-service';
import type { Company, User, TimeEntry } from '@/modules/core/types';
import { logInfo, logError } from '@/modules/core/lib/logger';
import { format, parseISO } from 'date-fns';

interface BillingEmailEntry extends TimeEntry {
    ticketConsecutive: string;
    serviceName: string;
    amount: number;
}

interface SendBillingEmailParams {
    recipients: string[];
    companyData: Company;
    customerName: string;
    entries: BillingEmailEntry[];
    totalAmount: number;
    sender: User;
}

export async function sendBillingStatementByEmail(params: SendBillingEmailParams) {
    const { recipients, companyData, customerName, entries, totalAmount, sender } = params;

    const formatCurrency = (val: number) => `¢${val.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;
    
    const rowsHtml = entries.map(entry => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 12px;">${format(parseISO(entry.startTime), 'dd/MM/yy')}</td>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 12px; font-family: monospace; font-weight: bold;">${entry.ticketConsecutive}</td>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 13px;">
                <div>${entry.serviceName}</div>
                <div style="font-size: 11px; color: #718096; font-style: italic;">${entry.notes || ''}</div>
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 13px; text-align: center;">${((entry.billableDuration || entry.duration || 0) / 3600000).toFixed(2)} h</td>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 13px; text-align: right; font-weight: bold;">${formatCurrency(entry.amount)}</td>
        </tr>
    `).join('');

    const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; color: #2d3748; line-height: 1.5;">
            <!-- Header -->
            <div style="border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <h1 style="margin: 0; color: #10b981; font-size: 24px;">ESTADO DE CUENTA</h1>
                    <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 14px; color: #4a5568;">SOPORTE TÉCNICO PENDIENTE</p>
                </div>
                <div style="text-align: right;">
                    <h2 style="margin: 0; font-size: 16px; color: #1a202c;">${companyData.name}</h2>
                    <p style="margin: 2px 0; font-size: 12px; color: #718096;">Cédula Jurídica: ${companyData.taxId}</p>
                </div>
            </div>

            <!-- Intro -->
            <div style="margin-bottom: 30px;">
                <p style="font-size: 14px;">Estimado(a) cliente <strong>${customerName}</strong>,</p>
                <p style="font-size: 14px;">Adjuntamos el detalle de las labores de soporte técnico realizadas que se encuentran pendientes de facturación hasta la fecha.</p>
            </div>

            <!-- Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                    <tr style="background-color: #f8fafc; color: #4a5568; text-align: left; border-bottom: 2px solid #e2e8f0;">
                        <th style="padding: 10px; font-size: 12px; text-transform: uppercase;">Fecha</th>
                        <th style="padding: 10px; font-size: 12px; text-transform: uppercase;">Ticket</th>
                        <th style="padding: 10px; font-size: 12px; text-transform: uppercase;">Labor Realizada</th>
                        <th style="padding: 10px; font-size: 12px; text-transform: uppercase; text-align: center;">Horas</th>
                        <th style="padding: 10px; font-size: 12px; text-transform: uppercase; text-align: right;">Monto</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    <tr style="font-weight: bold; font-size: 18px; color: #10b981;">
                        <td colspan="4" style="padding: 20px 10px; text-align: right;">TOTAL PENDIENTE:</td>
                        <td style="padding: 20px 10px; text-align: right;">${formatCurrency(totalAmount)}</td>
                    </tr>
                </tfoot>
            </table>

            <!-- Footer -->
            <div style="border-top: 1px solid #edf2f7; padding-top: 20px; font-size: 12px; color: #718096;">
                <p style="margin: 0;">Cualquier duda o consulta sobre este detalle, favor contactar a:</p>
                <p style="margin: 5px 0; font-weight: bold; color: #2d3748; font-size: 14px;">${sender.name}</p>
                <p style="margin: 0;">${sender.email}</p>
                <p style="margin: 20px 0 0 0; font-style: italic; font-size: 10px; text-align: center;">Este es un documento informativo generado por el sistema interno de Clic-Soporte.</p>
            </div>
        </div>
    `;

    try {
        await sendEmail({
            to: recipients,
            subject: `Estado de Cta. Soporte - ${customerName}`,
            html
        });
        await logInfo(`Billing statement sent to ${customerName} (${recipients.join(', ')})`);
        return { success: true };
    } catch (error: unknown) {
        const err = error as Error;
        await logError(`Failed to send billing statement email`, { error: err.message });
        throw err;
    }
}

interface SendActivityReportParams {
    recipients: string[];
    companyData: Company;
    customerName: string;
    entries: (TimeEntry & { ticketConsecutive: string, serviceName: string, userName: string })[];
    dateRange: { from: string, to: string };
    sender: User;
}

export async function sendServiceReportByEmail(params: SendActivityReportParams) {
    const { recipients, companyData, customerName, entries, dateRange, sender } = params;

    const rowsHtml = entries.map(entry => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 12px;">${format(parseISO(entry.startTime), 'dd/MM/yy HH:mm')}</td>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 12px; font-family: monospace;">${entry.ticketConsecutive}</td>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 13px;">
                <div style="font-weight: bold;">${entry.serviceName}</div>
                <div style="font-size: 11px; color: #718096; font-style: italic;">${entry.notes || ''}</div>
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 12px; text-align: center;">${entry.userName}</td>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 12px; text-align: center;">${entry.isBillable ? 'EXTRA' : 'CONTRATO'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 13px; text-align: right; font-family: monospace;">${((entry.duration || 0) / 3600000).toFixed(2)} h</td>
        </tr>
    `).join('');

    const totalHours = entries.reduce((acc, e) => acc + (e.duration || 0), 0) / 3600000;

    const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 850px; margin: 0 auto; color: #2d3748; line-height: 1.5;">
            <div style="border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <h1 style="margin: 0; color: #2563eb; font-size: 24px;">REPORTE DE ACTIVIDADES</h1>
                    <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 13px; color: #4a5568; text-transform: uppercase;">Periodo: ${dateRange.from} al ${dateRange.to}</p>
                </div>
                <div style="text-align: right;">
                    <h2 style="margin: 0; font-size: 16px; color: #1a202c;">${companyData.name}</h2>
                    <p style="margin: 2px 0; font-size: 11px; color: #718096;">Soporte Técnico Especializado</p>
                </div>
            </div>

            <div style="margin-bottom: 30px;">
                <p style="font-size: 14px;">Estimado(a) cliente <strong>${customerName}</strong>,</p>
                <p style="font-size: 14px;">Adjuntamos el desglose de las labores técnicas realizadas durante el periodo solicitado. Este reporte incluye tanto servicios bajo contrato como cargos adicionales.</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                    <tr style="background-color: #f1f5f9; color: #4a5568; text-align: left; border-bottom: 2px solid #cbd5e1;">
                        <th style="padding: 10px; font-size: 11px; text-transform: uppercase;">Fecha/Hora</th>
                        <th style="padding: 10px; font-size: 11px; text-transform: uppercase;">Ticket</th>
                        <th style="padding: 10px; font-size: 11px; text-transform: uppercase;">Labor</th>
                        <th style="padding: 10px; font-size: 11px; text-transform: uppercase; text-align: center;">Técnico</th>
                        <th style="padding: 10px; font-size: 11px; text-transform: uppercase; text-align: center;">Cobertura</th>
                        <th style="padding: 10px; font-size: 11px; text-transform: uppercase; text-align: right;">Duración</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    <tr style="font-weight: bold; font-size: 16px; color: #1e293b;">
                        <td colspan="5" style="padding: 20px 10px; text-align: right;">TOTAL HORAS INVERTIDAS:</td>
                        <td style="padding: 20px 10px; text-align: right; font-family: monospace;">${totalHours.toFixed(2)} h</td>
                    </tr>
                </tfoot>
            </table>

            <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #718096;">
                <p style="margin: 0;">Reporte generado por:</p>
                <p style="margin: 5px 0; font-weight: bold; color: #2d3748; font-size: 14px;">${sender.name}</p>
                <p style="margin: 0;">${sender.email}</p>
            </div>
        </div>
    `;

    try {
        await sendEmail({
            to: recipients,
            subject: `Resumen de Actividades - ${customerName}`,
            html
        });
        await logInfo(`Activity report sent to ${customerName} (${recipients.join(', ')})`);
        return { success: true };
    } catch (error: unknown) {
        const err = error as Error;
        await logError(`Failed to send activity report email`, { error: err.message });
        throw err;
    }
}
