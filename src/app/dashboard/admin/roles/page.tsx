/**
 * @fileoverview Server Component for the Roles Management page.
 * Enforces server-side authorization before rendering the client-side logic.
 */
import { authorizePage } from "@/modules/core/lib/auth-guard";
import RolesClient from "./roles-client";

export const dynamic = 'force-dynamic';

export default async function RolesPage() {
    // Phase 5: Secure the page at the server level
    await authorizePage('roles:read');
    
    return <RolesClient />;
}
