
'use server';

/**
 * @fileoverview Global Server Actions for page data pre-fetching.
 */

import { getUserCount } from "@/modules/core/lib/db";

/**
 * Fetches initial data needed by the login page, such as user count for the setup wizard.
 */
export async function getInitialPageData() {
    const userCount = await getUserCount();
    return {
        hasUsers: userCount > 0
    };
}
