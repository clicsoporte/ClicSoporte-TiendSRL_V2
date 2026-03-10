/**
 * @fileoverview Quoter page with server-side authorization.
 */
import { authorizePage } from "@/modules/core/lib/auth-guard";
import QuoterClient from "./quoter-client";

export default async function QuoterPage() {
    await authorizePage('quotes:create');
    return <QuoterClient />;
}
