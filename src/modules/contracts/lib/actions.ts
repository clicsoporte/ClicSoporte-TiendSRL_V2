/**
 * @fileoverview Server Actions for the Contracts module.
 */
'use server';

import { 
    getContracts as getContractsDb, 
    addContract as addContractDb,
    updateContract as updateContractDb,
    deleteContract as deleteContractDb,
    getActiveContractForCustomer as getActiveContractForCustomerDb
} from './db';
import type { Contract } from '@/modules/core/types';
import { logInfo, logError } from '@/modules/core/lib/logger';
import { revalidatePath } from 'next/cache';

export async function getContracts(customerId?: string): Promise<Contract[]> {
    try {
        const results = await getContractsDb(customerId);
        return JSON.parse(JSON.stringify(results));
    } catch (error) {
        console.error("Error fetching contracts:", error);
        return [];
    }
}

export async function saveContract(contractData: Omit<Contract, 'id' | 'consecutive' | 'createdAt'>): Promise<Contract> {
    try {
        const result = await addContractDb(contractData);
        await logInfo(`Nuevo contrato creado: ${result.consecutive} para cliente ${result.customerId}`);
        revalidatePath('/dashboard/contracts');
        return JSON.parse(JSON.stringify(result));
    } catch (error: unknown) {
        logError("Failed to save contract", { error: (error as Error).message });
        throw error;
    }
}

export async function updateContract(contract: Contract): Promise<Contract> {
    try {
        const result = await updateContractDb(contract);
        await logInfo(`Contrato actualizado: ${contract.consecutive}`);
        revalidatePath('/dashboard/contracts');
        return JSON.parse(JSON.stringify(result));
    } catch (error: unknown) {
        logError("Failed to update contract", { error: (error as Error).message });
        throw error;
    }
}

export async function deleteContract(id: number): Promise<void> {
    try {
        await deleteContractDb(id);
        await logInfo(`Contrato eliminado ID: ${id}`);
        revalidatePath('/dashboard/contracts');
    } catch (error: unknown) {
        logError("Failed to delete contract", { error: (error as Error).message });
        throw error;
    }
}

export async function getActiveContractForCustomer(customerId: string): Promise<Contract | null> {
    try {
        const result = await getActiveContractForCustomerDb(customerId);
        return result ? JSON.parse(JSON.stringify(result)) : null;
    } catch (error) {
        console.error("Error fetching active contract:", error);
        return null;
    }
}
