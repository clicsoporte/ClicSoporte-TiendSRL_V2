/**
 * @fileoverview Server component for the Warranty Hub.
 */
import { authorizePage } from "@/modules/core/lib/auth-guard";
import WarrantyHubClient from "./warranty-hub-client";

export const dynamic = 'force-dynamic';

export default async function WarrantyHubPage() {
    await authorizePage('inventory:warranty:hub');
    return <WarrantyHubClient />;
}
