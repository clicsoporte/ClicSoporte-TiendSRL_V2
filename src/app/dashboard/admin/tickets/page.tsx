/**
 * @fileoverview Server Component for Ticket Settings.
 */
import { authorizePage } from "@/modules/core/lib/auth-guard";
import TicketSettingsPageContent from "./ticket-settings-content";

export const dynamic = 'force-dynamic';

export default async function TicketSettingsPage() {
    await authorizePage('tickets:admin:settings');
    return <TicketSettingsPageContent />;
}
