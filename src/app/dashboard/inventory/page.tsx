/**
 * @fileoverview Main inventory dashboard page.
 */
import { authorizePage } from "@/modules/core/lib/auth-guard";
import InventoryClient from "./inventory-client";

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
    await authorizePage('inventory:read');
    return <InventoryClient />;
}
