/**
 * @fileoverview Server Component for the Contracts page.
 * Secured with server-side authorization.
 */
import { authorizePage } from "@/modules/core/lib/auth-guard";
import ContractsClient from "./contracts-client";

export const dynamic = 'force-dynamic';

export default async function ContractsPage() {
    await authorizePage('contracts:read');
    return <ContractsClient />;
}
