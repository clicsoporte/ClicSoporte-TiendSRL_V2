/**
 * @fileoverview Server-side functions for the contracts database.
 */
"use server";

import type { Database } from 'better-sqlite3';
import { connectDb as baseConnectDb } from '@/modules/core/lib/db-connection';
import type { Contract } from '@/modules/core/types';
import { addDays, parseISO, differenceInCalendarDays, format } from 'date-fns';

const CONTRACTS_DB_FILE = 'contracts.db';

export async function connectContractsDb(): Promise<Database> {
    return baseConnectDb(CONTRACTS_DB_FILE, initializeContractsDb, runContractsMigrations);
}

export async function initializeContractsDb(db: Database): Promise<void> {
    const schema = `
        CREATE TABLE IF NOT EXISTS contracts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            consecutive TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            customerId TEXT NOT NULL,
            startDate TEXT NOT NULL,
            endDate TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active', -- active, inactive, expired
            includedServices TEXT NOT NULL, -- JSON array
            excludedServices TEXT NOT NULL, -- JSON array
            monthlyHours REAL DEFAULT 0,
            price REAL DEFAULT 0,
            currency TEXT DEFAULT 'CRC',
            notes TEXT,
            autoRenew INTEGER DEFAULT 0,
            createdAt TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS contract_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `;
    db.exec(schema);
    db.prepare(`INSERT OR IGNORE INTO contract_settings (key, value) VALUES ('contractPrefix', 'CON-')`).run();
    db.prepare(`INSERT OR IGNORE INTO contract_settings (key, value) VALUES ('nextContractNumber', '1')`).run();
    console.log(`Database ${CONTRACTS_DB_FILE} initialized for Contract Management.`);
}

export async function runContractsMigrations(db: Database) {
    const tableInfo = db.prepare(`PRAGMA table_info(contracts)`).all() as { name: string }[];
    const columns = new Set(tableInfo.map(c => c.name));
    
    if (!columns.has('autoRenew')) {
        console.log("MIGRATION (contracts.db): Adding 'autoRenew' column to 'contracts' table.");
        db.exec(`ALTER TABLE contracts ADD COLUMN autoRenew INTEGER DEFAULT 0;`);
    }
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
    const db = await connectContractsDb();
    db.prepare('DELETE FROM contracts WHERE id = ?').run(id);
}

export async function getActiveContractForCustomer(customerId: string): Promise<Contract | null> {
    const db = await connectContractsDb();
    const now = new Date().toISOString().split('T')[0];
    const row = db.prepare(`
        SELECT * FROM contracts 
        WHERE customerId = ? AND status = 'active' AND startDate <= ? AND endDate >= ?
        LIMIT 1
    `).get(customerId, now, now) as Record<string, unknown> | undefined;
    
    if (!row) return null;
    
    return {
        ...row,
        autoRenew: row.autoRenew === 1,
        includedServices: JSON.parse((row.includedServices as string) || '[]'),
        excludedServices: JSON.parse((row.excludedServices as string) || '[]')
    } as unknown as Contract;
}

/**
 * Logic for automatically renewing a contract.
 * Creates a new contract period based on the previous one.
 */
export async function autoRenewContract(contractId: number): Promise<Contract> {
    const db = await connectContractsDb();
    const old = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId) as {
        name: string;
        customerId: string;
        startDate: string;
        endDate: string;
        includedServices: string;
        excludedServices: string;
        monthlyHours: number;
        price: number;
        currency: string;
        consecutive: string;
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

    // Mark old as expired if it hasn't already
    db.prepare("UPDATE contracts SET status = 'expired', autoRenew = 0 WHERE id = ?").run(contractId);

    return await addContract(renewalData);
}
