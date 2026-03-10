/**
 * @fileoverview Server Component for API Settings.
 */
import { authorizePage } from "@/modules/core/lib/auth-guard";
import ApiSettingsClient from "./api-client";

export const dynamic = 'force-dynamic';

export default async function ApiSettingsPage() {
    await authorizePage('admin:settings:api');
    return <ApiSettingsClient />;
}
