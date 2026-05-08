/**
 * @fileoverview Server Component for the Marketing Center page.
 */
import { authorizePage } from "@/modules/core/lib/auth-guard";
import MarketingClient from "./marketing-client";

export const dynamic = 'force-dynamic';

export default async function MarketingCenterPage() {
    await authorizePage('admin:marketing:manage');
    return <MarketingClient />;
}
