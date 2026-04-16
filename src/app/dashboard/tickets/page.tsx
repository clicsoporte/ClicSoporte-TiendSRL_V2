/**
 * @fileoverview Tickets entry page with server-side authorization.
 */
import { authorizePage } from "@/modules/core/lib/auth-guard";
import TicketsClient from "./tickets-client";

export const dynamic = 'force-dynamic';

export default async function TicketsPage() {
    await authorizePage('tickets:read:all');
    return <TicketsClient />;
}