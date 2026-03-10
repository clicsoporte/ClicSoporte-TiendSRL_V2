/**
 * @fileoverview Server Component for the Customers page.
 * Secured with server-side authorization.
 */
import { authorizePage } from "@/modules/core/lib/auth-guard";
import CustomersClient from "./customers-client";

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
    await authorizePage('customers:read');
    return <CustomersClient />;
}
