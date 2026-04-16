/**
 * @fileoverview Pure utility functions for the Inventory module.
 * Separated from server actions to allow synchronous usage in client components.
 */

import type { WarrantyStatus } from "@/modules/core/types";

/**
 * Computes the real-time warranty status without storing it in the DB.
 * Logic:
 * - 'claimed' or 'void' are manual overrides.
 * - 'expired' if the date has passed.
 * - 'expiring' if there are 30 days or less remaining.
 * - 'active' otherwise.
 */
export function getWarrantyStatus(expiryDateStr: string, currentStatus: string): WarrantyStatus {
    if (currentStatus === 'claimed') return 'claimed';
    if (currentStatus === 'void') return 'void';

    const expiryDate = new Date(expiryDateStr);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= 30) return 'expiring';
    return 'active';
}
