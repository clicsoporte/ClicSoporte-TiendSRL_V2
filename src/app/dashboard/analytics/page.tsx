/**
 * @fileoverview Server Component for the Analytics page.
 * Secured with server-side authorization.
 */
import { authorizePage } from "@/modules/core/lib/auth-guard";
import AnalyticsClient from "./analytics-client";

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
    await authorizePage('analytics:read');
    return <AnalyticsClient />;
}
