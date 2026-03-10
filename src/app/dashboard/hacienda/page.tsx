/**
 * @fileoverview Server Component for the Hacienda Query page.
 * Secured with server-side authorization.
 */
import { authorizePage } from "@/modules/core/lib/auth-guard";
import HaciendaClient from "./hacienda-client";

export const dynamic = 'force-dynamic';

export default async function HaciendaPage() {
    await authorizePage('hacienda:query');
    return <HaciendaClient />;
}
