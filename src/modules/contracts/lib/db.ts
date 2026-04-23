/**
 * @fileoverview Server-side functions for the contracts module.
 * Unified into intratool.db.
 */
"use server";

import type { Database } from 'better-sqlite3';
import { connectDb } from '@/modules/core/lib/db';
import { authorizeAction } from '@/modules/core/lib/auth-guard';
import type { Contract } from '@/modules/core/types';
import { addDays, parseISO, differenceInCalendarDays, format } from 'date-fns';

export async function connectContractsDb(): Promise<Database> {
    return connectDb();
}

export async function getContracts(customerId?: string): Promise<Contract[]> {
    const db = await connectContractsDb();
    let query = 'SELECT * FROM contracts';
    const params: (string | number)[] = [];
    if (customerId) {
        query += ' WHERE customerId = ?';
        params.push(customerId);
    }
    query += ' ORDER BY createdAt DESC';
    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
    return rows.map(row => ({
        ...row,
        autoRenew: row.autoRenew === 1,
        includedServices: JSON.parse((row.includedServices as string) || '[]'),
        excludedServices: JSON.parse((row.excludedServices as string) || '[]')
    })) as unknown as Contract[];
}

export async function addContract(contractData: Omit<Contract, 'id' | 'consecutive' | 'createdAt'>): Promise<Contract> {
    await authorizeAction('contracts:create');
    const db = await connectContractsDb();
    const prefixRow = db.prepare("SELECT value FROM contract_settings WHERE key = 'contractPrefix'").get() as { value: string } | undefined;
    const numberRow = db.prepare("SELECT value FROM contract_settings WHERE key = 'nextContractNumber'").get() as { value: string } | undefined;
    
    const prefix = prefixRow?.value || 'CON-';
    const nextNumber = parseInt(numberRow?.value || '1', 10);
    const consecutive = `${prefix}${nextNumber.toString().padStart(5, '0')}`;
    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
        const info = db.prepare(`
            INSERT INTO contracts (
                consecutive, name, customerId, startDate, endDate, status, 
                includedServices, excludedServices, monthlyHours, price, currency, notes, autoRenew, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            consecutive, contractData.name, contractData.customerId, contractData.startDate, 
            contractData.endDate, contractData.status, JSON.stringify(contractData.includedServices), 
            JSON.stringify(contractData.excludedServices), contractData.monthlyHours, 
            contractData.price, contractData.currency, contractData.notes, contractData.autoRenew ? 1 : 0, now
        );

        db.prepare("UPDATE contract_settings SET value = ? WHERE key = 'nextContractNumber'").run(String(nextNumber + 1));
        
        return db.prepare('SELECT * FROM contracts WHERE id = ?').get(info.lastInsertRowid);
    });

    const result = transaction() as Record<string, unknown>;
    return {
        ...result,
        autoRenew: result.autoRenew === 1,
        includedServices: JSON.parse((result.includedServices as string) || '[]'),
        excludedServices: JSON.parse((result.excludedServices as string) || '[]')
    } as unknown as Contract;
}

export async function updateContract(contract: Contract): Promise<Contract> {
    await authorizeAction('contracts:update');
    const db = await connectContractsDb();
    db.prepare(`
        UPDATE contracts SET
            name = ?, customerId = ?, startDate = ?, endDate = ?, status = ?,
            includedServices = ?, excludedServices = ?, monthlyHours = ?, 
            price = ?, currency = ?, notes = ?, autoRenew = ?
        WHERE id = ?
    `).run(
        contract.name, contract.customerId, contract.startDate, contract.endDate, contract.status,
        JSON.stringify(contract.includedServices), JSON.stringify(contract.excludedServices),
        contract.monthlyHours, contract.price, contract.currency, contract.notes, contract.autoRenew ? 1 : 0, contract.id
    );
    return contract;
}

export async function deleteContract(id: number): Promise<void> {
    await authorizeAction('contracts:delete');
    const db = await connectContractsDb();
    db.prepare('DELETE FROM contracts WHERE id = ?').run(id);
}

/**
 * Retrieves the active contract for a customer. 
 * If the customer has no contract but has a parent company, it recursively checks the parent.
 */
export async function getActiveContractForCustomer(customerId: string): Promise<Contract | null> {
    const db = await connectContractsDb();
    const now = new Date().toISOString().split('T')[0];
    
    // 1. Try to find a direct contract first
    let row = db.prepare(`
        SELECT * FROM contracts 
        WHERE customerId = ? AND status = 'active' AND startDate <= ? AND endDate >= ?
        LIMIT 1
    `).get(customerId, now, now) as Record<string, unknown> | undefined;
    
    // 2. If not found, check if it's a child company and get the parent's contract
    if (!row) {
        const customer = db.prepare('SELECT parentCustomerId FROM customers WHERE id = ?').get(customerId) as { parentCustomerId: string | null } | undefined;
        if (customer?.parentCustomerId) {
            return getActiveContractForCustomer(customer.parentCustomerId);
        }
    }

    if (!row) return null;
    
    return {
        ...row,
        autoRenew: row.autoRenew === 1,
        includedServices: JSON.parse((row.includedServices as string) || '[]'),
        excludedServices: JSON.parse((row.excludedServices as string) || '[]')
    } as unknown as Contract;
}

export async function autoRenewContract(contractId: number): Promise<Contract> {
    const db = await connectContractsDb();
    const old = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId) as {
        name: string; customerId: string; startDate: string; endDate: string;
        includedServices: string; excludedServices: string; monthlyHours: number;
        price: number; currency: string; consecutive: string;
    } | undefined;
    
    if (!old) throw new Error("Contract not found");

    const start = parseISO(old.startDate);
    const end = parseISO(old.endDate);
    const durationDays = differenceInCalendarDays(end, start);

    const nextStart = addDays(end, 1);
    const nextEnd = addDays(nextStart, durationDays);

    const renewalData: Omit<Contract, 'id' | 'consecutive' | 'createdAt'> = {
        name: `${old.name} (Renovación)`,
        customerId: old.customerId,
        startDate: format(nextStart, 'yyyy-MM-dd'),
        endDate: format(nextEnd, 'yyyy-MM-dd'),
        status: 'active',
        includedServices: JSON.parse(old.includedServices),
        excludedServices: JSON.parse(old.excludedServices),
        monthlyHours: old.monthlyHours,
        price: old.price,
        currency: old.currency,
        notes: `Renovación automática del contrato ${old.consecutive}`,
        autoRenew: true
    };

    db.prepare("UPDATE contracts SET status = 'expired', autoRenew = 0 WHERE id = ?").run(contractId);
    return await addContract(renewalData);
}
