'use server';

/**
 * @fileoverview Server actions for sending quotes via email with a rich HTML template.
 */

import { sendEmail } from '@/modules/core/lib/email-service';
import type { Company, QuoteLine, User } from '@/modules/core/types';
import { logInfo, logError } from '@/modules/core/lib/logger';

interface SendQuoteEmailParams {
    recipients: string[];
    quoteNumber: string;
    companyData: Company;
    customerName: string;
    customerDetails: string;
    lines: QuoteLine[];
    totals: {
        subtotal: number;
        totalTaxes: number;
        total: number;
    };
    currency: string;
    notes: string;
    sender: User;
}

export async function sendQuoteByEmail(params: SendQuoteEmailParams) {
    const { recipients, quoteNumber, companyData, customerName, lines, totals, currency, notes, sender } = params;

    const currencySymbol = currency === 'CRC' ? '¢' : '$';
    const formatPrice = (amount: number) => `${currencySymbol}${amount.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;

    const rowsHtml = lines.map(line => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 12px; font-family: monospace;">${line.product.id}</td>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 13px;">${line.product.description}</td>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 13px; text-align: center;">${line.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 13px; text-align: right;">${formatPrice(line.price)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #edf2f7; font-size: 13px; text-align: right; font-weight: bold;">${formatPrice(line.quantity * line.price * (1 + line.tax))}</td>
        </tr>
    `).join('');

    const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; color: #2d3748; line-height: 1.5;">
            <!-- Header -->
            <div style="border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <h1 style="margin: 0; color: #2563eb; font-size: 24px;">COTIZACIÓN</h1>
                    <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 18px; color: #4a5568;"># ${quoteNumber}</p>
                </div>
                <div style="text-align: right;">
                    <h2 style="margin: 0; font-size: 16px; color: #1a202c;">${companyData.name}</h2>
                    <p style="margin: 2px 0; font-size: 12px; color: #718096;">Cédula Jurídica: ${companyData.taxId}</p>
                    <p style="margin: 2px 0; font-size: 12px; color: #718096;">Tel: ${companyData.phone}</p>
                </div>
            </div>

            <!-- Intro -->
            <div style="margin-bottom: 30px;">
                <p style="font-size: 14px;">Estimado(a) <strong>${customerName}</strong>,</p>
                <p style="font-size: 14px;">Es un gusto para nosotros presentarle la siguiente propuesta comercial para su revisión.</p>
            </div>

            <!-- Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <thead>
                    <tr style="background-color: #2563eb; color: #ffffff; text-align: left;">
                        <th style="padding: 10px; font-size: 12px; text-transform: uppercase;">Código</th>
                        <th style="padding: 10px; font-size: 12px; text-transform: uppercase;">Descripción</th>
                        <th style="padding: 10px; font-size: 12px; text-transform: uppercase; text-align: center;">Cant.</th>
                        <th style="padding: 10px; font-size: 12px; text-transform: uppercase; text-align: right;">Precio</th>
                        <th style="padding: 10px; font-size: 12px; text-transform: uppercase; text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <!-- Footer Section -->
            <div style="display: flex; gap: 40px; margin-bottom: 40px;">
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 10px 0; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Notas y Condiciones</h4>
                    <p style="font-size: 12px; color: #4a5568; white-space: pre-wrap;">${notes}</p>
                </div>
                <div style="width: 250px;">
                    <table style="width: 100%; font-size: 14px;">
                        <tr>
                            <td style="padding: 5px 0; color: #718096;">Subtotal:</td>
                            <td style="padding: 5px 0; text-align: right;">${formatPrice(totals.subtotal)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0; color: #718096;">Impuestos:</td>
                            <td style="padding: 5px 0; text-align: right;">${formatPrice(totals.totalTaxes)}</td>
                        </tr>
                        <tr style="font-weight: bold; font-size: 18px; color: #2563eb;">
                            <td style="padding: 10px 0; border-top: 2px solid #2563eb;">TOTAL ${currency}:</td>
                            <td style="padding: 10px 0; text-align: right; border-top: 2px solid #2563eb;">${formatPrice(totals.total)}</td>
                        </tr>
                    </table>
                </div>
            </div>

            <!-- Signature -->
            <div style="border-top: 1px solid #edf2f7; padding-top: 20px; font-size: 12px; color: #718096;">
                <p style="margin: 0;">Atentamente,</p>
                <p style="margin: 5px 0; font-weight: bold; color: #2d3748; font-size: 14px;">${sender.name}</p>
                <p style="margin: 0;">${sender.email} | WhatsApp: ${sender.whatsapp || sender.phone}</p>
                <p style="margin: 20px 0 0 0; font-style: italic; font-size: 10px; text-align: center;">Este es un documento comercial generado por el sistema interno de Clic-Soporte.</p>
            </div>
        </div>
    `;

    try {
        await sendEmail({
            to: recipients,
            subject: `Propuesta Comercial - ${quoteNumber} - ${companyData.name}`,
            html
        });
        await logInfo(`Quote ${quoteNumber} sent by email to ${recipients.join(', ')}`);
        return { success: true };
    } catch (error: unknown) {
        const err = error as Error;
        await logError(`Failed to send quote ${quoteNumber} via email`, { error: err.message });
        throw err;
    }
}
