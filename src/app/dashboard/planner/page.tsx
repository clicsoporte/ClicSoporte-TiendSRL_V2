/**
 * @fileoverview Projects entry page with server-side authorization.
 */
import { authorizePage } from "@/modules/core/lib/auth-guard";
import PlannerClient from "./planner-client";

export default async function PlannerPage() {
    await authorizePage('planner:read');
    return <PlannerClient />;
}
