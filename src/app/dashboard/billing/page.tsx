/**
 * @fileoverview Server Component for the Billing Management page.
 */
import { authorizePage } from "@/modules/core/lib/auth-guard";
import BillingClient from "./billing-client";

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
    await authorizePage('billing:manage');
    return <BillingClient />;
}
