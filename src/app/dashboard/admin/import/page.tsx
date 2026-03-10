/**
 * @fileoverview Server Component for the Data Import page.
 * Secured with server-side authorization.
 */
import { authorizePage } from "@/modules/core/lib/auth-guard";
import ImportClient from "./import-client";

export const dynamic = 'force-dynamic';

export default async function ImportDataPage() {
    await authorizePage('admin:import:run');
    return <ImportClient />;
}
