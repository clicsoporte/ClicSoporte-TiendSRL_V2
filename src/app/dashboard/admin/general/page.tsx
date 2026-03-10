/**
 * @fileoverview Server Component for General Settings.
 */
import { authorizePage } from "@/modules/core/lib/auth-guard";
import GeneralSettingsClient from "./general-client";

export const dynamic = 'force-dynamic';

export default async function GeneralSettingsPage() {
    await authorizePage('admin:settings:general');
    return <GeneralSettingsClient />;
}
