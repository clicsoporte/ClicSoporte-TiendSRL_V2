/**
 * @fileoverview Service for handling data imports from files and SQL Server.
 * This file contains the logic for reading data sources and upserting the data
 * into the local SQLite database.
 */
"use server";

import fs from 'fs';
import Papa from 'papaparse';
import { connectDb } from './db';
import type { Product, Customer, Exemption, Company } from '../types';
import { getCompanySettings } from './settings-db';
import { executeQuery } from './sql-service';

type ImportType = 'customers' | 'products' | 'exemptions' | 'stock' | 'cabys' | 'locations';

const importTypeFieldMapping: { [key in ImportType]: keyof Company } = {
    customers: 'customerFilePath',
    products: 'productFilePath',
    exemptions: 'exemptionFilePath',
    stock: 'stockFilePath',
    locations: 'locationFilePath',
    cabys: 'cabysFilePath',
};

async function parseCsv(filePath: string): Promise<Record<string, string>[]> {
    if (!fs.existsSync(filePath)) {
        throw new Error(`El archivo no existe en la ruta: ${filePath}`);
    }
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return new Promise((resolve, reject) => {
        Papa.parse(fileContent, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data as Record<string, string>[]),
            error: (error: Error) => reject(error),
        });
    });
}

async function processCustomers(data: Record<string, string>[]): Promise<number> {
    const db = await connectDb();
    const upsert = db.prepare(`
        INSERT INTO customers (id, name, address, phone, taxId, currency, creditLimit, paymentCondition, salesperson, active, email, electronicDocEmail)
        VALUES (@id, @name, @address, @phone, @taxId, @currency, @creditLimit, @paymentCondition, @salesperson, @active, @email, @electronicDocEmail)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name, address = excluded.address, phone = excluded.phone, taxId = excluded.taxId, currency = excluded.currency,
            creditLimit = excluded.creditLimit, paymentCondition = excluded.paymentCondition, salesperson = excluded.salesperson, active = excluded.active,
            email = excluded.email, electronicDocEmail = excluded.electronicDocEmail;
    `);
    const transaction = db.transaction((records: Customer[]) => {
        for (const record of records) {
            upsert.run({
                id: record.id,
                name: record.name,
                address: record.address,
                phone: record.phone,
                taxId: record.taxId,
                currency: record.currency,
                creditLimit: record.creditLimit,
                paymentCondition: record.paymentCondition,
                salesperson: record.salesperson,
                active: record.active,
                email: record.email,
                electronicDocEmail: record.electronicDocEmail,
            });
        }
    });

    const mappedData = data.map(d => ({
        id: d.CLIENTE,
        name: d.NOMBRE,
        address: d.DIRECCION,
        phone: d.TELEFONO1,
        taxId: d.CONTRIBUYENTE,
        currency: d.MONEDA,
        creditLimit: parseFloat(d.LIMITE_CREDITO),
        paymentCondition: d.CONDICION_PAGO,
        salesperson: d.VENDEDOR,
        active: d.ACTIVO as 'S' | 'N',
        email: d.E_MAIL,
        electronicDocEmail: d.EMAIL_DOC_ELECTRONICO,
    }));
    
    transaction(mappedData);
    return data.length;
}

async function processProducts(data: Record<string, string>[]): Promise<number> {
    const db = await connectDb();
    const upsert = db.prepare(`
        INSERT INTO products (id, description, classification, lastEntry, active, notes, unit, isBasicGood, cabys)
        VALUES (@id, @description, @classification, @lastEntry, @active, @notes, @unit, @isBasicGood, @cabys)
        ON CONFLICT(id) DO UPDATE SET
            description = excluded.description, classification = excluded.classification, lastEntry = excluded.lastEntry,
            active = excluded.active, notes = excluded.notes, unit = excluded.unit, isBasicGood = excluded.isBasicGood, cabys = excluded.cabys;
    `);
    const transaction = db.transaction((records: Product[]) => {
        for (const record of records) upsert.run(record);
    });

    const mappedData = data.map(d => ({
        id: d.ARTICULO,
        description: d.DESCRIPCION,
        classification: d.CLASIFICACION_2,
        lastEntry: d.ULTIMO_INGRESO,
        active: d.ACTIVO as 'S' | 'N',
        notes: d.NOTAS,
        unit: d.UNIDAD_VENTA,
        isBasicGood: d.CANASTA_BASICA as 'S' | 'N',
        cabys: d.CODIGO_HACIENDA,
    }));
    
    transaction(mappedData);
    return data.length;
}

async function processExemptions(data: Record<string, string>[]): Promise<number> {
    const db = await connectDb();
    const upsert = db.prepare(`
        INSERT INTO exemptions (code, description, customer, authNumber, startDate, endDate, percentage, docType, institutionName, institutionCode)
        VALUES (@code, @description, @customer, @authNumber, @startDate, @endDate, @percentage, @docType, @institutionName, @institutionCode)
        ON CONFLICT(code) DO UPDATE SET
            description=excluded.description, customer=excluded.customer, authNumber=excluded.authNumber, startDate=excluded.startDate,
            endDate=excluded.endDate, percentage=excluded.percentage, docType=excluded.docType, institutionName=excluded.institutionName,
            institutionCode=excluded.institutionCode;
    `);
    const transaction = db.transaction((records: Exemption[]) => {
        for (const record of records) upsert.run(record);
    });
    
    const mappedData = data.map(d => ({
        code: d.CODIGO,
        description: d.DESCRIPCION,
        customer: d.CLIENTE,
        authNumber: d.NUM_AUTOR,
        startDate: d.FECHA_RIGE,
        endDate: d.FECHA_VENCE,
        percentage: parseFloat(d.PORCENTAJE),
        docType: d.TIPO_DOC,
        institutionName: d.NOMBRE_INSTITUCION,
        institutionCode: d.CODIGO_INSTITUCION,
    }));
    
    transaction(mappedData);
    return data.length;
}

async function processStock(data: Record<string, string>[]): Promise<number> {
    const db = await connectDb();
    db.exec('DELETE FROM stock'); // Clear previous stock data
    const insert = db.prepare('INSERT INTO stock (itemId, stockByWarehouse, totalStock) VALUES (?, ?, ?)');
    
    const stockMap = new Map<string, { [key: string]: number }>();
    data.forEach(d => {
        const itemId = d.ARTICULO;
        const warehouse = d.BODEGA;
        const quantity = parseFloat(d.CANT_DISPONIBLE);
        
        if (!stockMap.has(itemId)) {
            stockMap.set(itemId, {});
        }
        stockMap.get(itemId)![warehouse] = quantity;
    });

    const transaction = db.transaction(() => {
        for (const [itemId, stockByWarehouse] of stockMap.entries()) {
            const totalStock = Object.values(stockByWarehouse).reduce((sum, qty) => sum + qty, 0);
            insert.run(itemId, JSON.stringify(stockByWarehouse), totalStock);
        }
    });

    transaction();
    return stockMap.size;
}

async function processCabys(data: Record<string, string>[]): Promise<number> {
    const db = await connectDb();
    db.exec('DELETE FROM cabys_catalog'); // Always replace with the newest catalog
    const insert = db.prepare('INSERT INTO cabys_catalog (code, description, taxRate) VALUES (?, ?, ?)');

    const transaction = db.transaction((records: Record<string, string>[]) => {
        for (const record of records) {
            insert.run(record.Codigo, record.Descripcion, record.Impuesto);
        }
    });

    transaction(data);
    return data.length;
}

async function fetchDataForType(type: ImportType): Promise<any[]> {
    const companySettings = await getCompanySettings();
    if (!companySettings) throw new Error("Company settings not found.");

    if (companySettings.importMode === 'sql') {
        const db = await connectDb();
        const queryRow = db.prepare('SELECT query FROM import_queries WHERE type = ?').get(type) as { query: string } | undefined;
        if (!queryRow || !queryRow.query) {
            throw new Error(`No SQL query configured for import type: ${type}`);
        }
        return executeQuery(queryRow.query);
    } else {
        const filePath = companySettings[importTypeFieldMapping[type]];
        if (typeof filePath !== 'string' || !filePath) {
            throw new Error(`File path not configured for import type: ${type}`);
        }
        return parseCsv(filePath);
    }
}

export async function importData(type: ImportType): Promise<{ count: number; source: string }> {
    const companySettings = await getCompanySettings();
    const source = companySettings?.importMode === 'sql' ? 'SQL Server' : 'Archivo';

    try {
        const data = await fetchDataForType(type);
        let count = 0;

        switch (type) {
            case 'customers':
                count = await processCustomers(data);
                break;
            case 'products':
                count = await processProducts(data);
                break;
            case 'exemptions':
                count = await processExemptions(data);
                break;
            case 'stock':
                count = await processStock(data);
                break;
            case 'cabys':
                // CABYS can only be from file
                const filePath = companySettings?.cabysFilePath;
                if (!filePath) throw new Error("File path for CABYS not configured.");
                const cabysData = await parseCsv(filePath);
                count = await processCabys(cabysData);
                break;
            case 'locations':
                // Implement location processing if needed
                break;
        }

        if (companySettings?.importMode === 'sql' && type !== 'cabys') {
            const db = await connectDb();
            db.prepare('UPDATE company_settings SET lastSyncTimestamp = ? WHERE id = 1').run(new Date().toISOString());
        }

        return { count, source };
    } catch (error) {
        console.error(`Error during ${type} import from ${source}:`, error);
        throw error;
    }
}

export async function importAllDataFromFiles(): Promise<{ type: string; count: number; source: string }[]> {
    const importTypes: ImportType[] = ['customers', 'products', 'exemptions', 'stock'];
    const results = [];

    for (const type of importTypes) {
        const result = await importData(type);
        results.push({ type, ...result });
    }

    const db = await connectDb();
    db.prepare('UPDATE company_settings SET lastSyncTimestamp = ? WHERE id = 1').run(new Date().toISOString());
    
    return results;
}
