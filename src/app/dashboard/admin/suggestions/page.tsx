/**
 * @fileoverview Server Component for the User Suggestions page.
 * Secured with server-side authorization to prevent infinite loading bugs.
 */
import { authorizePage } from "@/modules/core/lib/auth-guard";
import SuggestionsClient from "./suggestions-client";

export const dynamic = 'force-dynamic';

export default async function SuggestionsPage() {
    // Correct redirect if unauthorized
    await authorizePage('admin:suggestions:read');
    return <SuggestionsClient />;
}