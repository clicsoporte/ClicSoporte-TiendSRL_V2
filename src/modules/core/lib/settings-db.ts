
/**
 * @fileoverview Server-side functions for managing system-wide settings.
 * Separated to avoid circular dependencies.
 */
"use server";

import { connectDb } from './db';
import type { Company, ApiSettings, ExemptionLaw, ExchangeRateApiResponse } from '../types';
import { initialCompany } from './data';
import { getExchangeRate as fetchExchangeRateFromApi } from './api-actions';

/**
 * Retrieves the main company settings from the database.
 * @returns {Promise<Company | null>} The company settings object.
 */
export async function getCompanySettings(): Promise<Company | null> {
    const db = await connectDb();
    try {
        const row = db.prepare('SELECT * FROM company_settings WHERE id = 1').get() as Company | undefined;
        if (row) {
            const settings = {
                ...row,
                supportPackages: JSON.parse(row.supportPackages as unknown as string || '[]'),
                servicesCatalog: JSON.parse(row.servicesCatalog as unknown as string || '[]')
            };
            // Ensure the returned object is a plain JavaScript object
            return JSON.parse(JSON.stringify(settings));
        }
        // If no settings exist, insert the initial ones.
        db.prepare(`INSERT OR IGNORE INTO company_settings (id, name, taxId, address, phone, email, systemName, quotePrefix, nextQuoteNumber, decimalPlaces, quoterShowTaxId, searchDebounceTime, syncWarningHours, importMode, supportPackages, servicesCatalog) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            initialCompany.name, initialCompany.taxId, initialCompany.address, initialCompany.phone, initialCompany.email, initialCompany.systemName,
            initialCompany.quotePrefix, initialCompany.nextQuoteNumber, initialCompany.decimalPlaces, true, initialCompany.searchDebounceTime, initialCompany.syncWarningHours, initialCompany.importMode, 
            JSON.stringify(initialCompany.supportPackages), JSON.stringify(initialCompany.servicesCatalog)
        );
        return JSON.parse(JSON.stringify(initialCompany));

    } catch (error) {
        console.error("Failed to get company settings:", error);
        return JSON.parse(JSON.stringify(initialCompany));
    }
}

/**
 * Saves the main company settings to the database.
 * @param {Company} data - The company settings object to save.
 */
export async function saveCompanySettings(data: Company): Promise<void> {
    const db = await connectDb();
    const stmt = db.prepare(`
        UPDATE company_settings SET
            name = @name, taxId = @taxId, address = @address, phone = @phone, email = @email, logoUrl = @logoUrl,
            systemName = @systemName, quotePrefix = @quotePrefix, nextQuoteNumber = @nextQuoteNumber,
            decimalPlaces = @decimalPlaces, quoterShowTaxId = @quoterShowTaxId, searchDebounceTime = @searchDebounceTime,
            syncWarningHours = @syncWarningHours, importMode = @importMode, lastSyncTimestamp = @lastSyncTimestamp,
            customerFilePath = @customerFilePath, productFilePath = @productFilePath,
            exemptionFilePath = @exemptionFilePath, stockFilePath = @stockFilePath,
            locationFilePath = @locationFilePath, cabysFilePath = @cabysFilePath,
            supportPackages = @supportPackages, servicesCatalog = @servicesCatalog
        WHERE id = 1
    `);
    
    stmt.run({
        ...data,
        quoterShowTaxId: data.quoterShowTaxId ? 1 : 0,
        supportPackages: JSON.stringify(data.supportPackages),
        servicesCatalog: JSON.stringify(data.servicesCatalog)
    });
}

/**
 * Retrieves API settings from the database.
 * @returns {Promise<ApiSettings | null>}
 */
export async function getApiSettings(): Promise<ApiSettings | null> {
    const db = await connectDb();
    try {
        const row = db.prepare('SELECT * FROM api_settings WHERE id = 1').get();
        return JSON.parse(JSON.stringify(row)) as ApiSettings | null;
    } catch (error) {
        console.error("Failed to get API settings:", error);
        return null;
    }
}

/**
 * Saves API settings to the database.
 * @param {ApiSettings} settings - The API settings to save.
 */
export async function saveApiSettings(settings: ApiSettings): Promise<void> {
    const db = await connectDb();
    const stmt = db.prepare('INSERT OR REPLACE INTO api_settings (id, exchangeRateApi, haciendaExemptionApi, haciendaTributariaApi) VALUES (1, ?, ?, ?)');
    stmt.run(settings.exchangeRateApi, settings.haciendaExemptionApi, settings.haciendaTributariaApi);
}

/**
 * Retrieves the list of exemption laws from the database.
 * @returns {Promise<ExemptionLaw[]>}
 */
export async function getExemptionLaws(): Promise<ExemptionLaw[]> {
    const db = await connectDb();
    try {
        const results = db.prepare('SELECT * FROM exemption_laws').all() as ExemptionLaw[];
        return JSON.parse(JSON.stringify(results));
    } catch (error) {
        console.error("Failed to get exemption laws:", error);
        return [];
    }
}

/**
 * Saves the entire list of exemption laws, replacing the existing ones.
 * @param {ExemptionLaw[]} laws - The array of laws to save.
 */
export async function saveExemptionLaws(laws: ExemptionLaw[]): Promise<void> {
    const db = await connectDb();
    const transaction = db.transaction((lawsToSave) => {
        db.exec('DELETE FROM exemption_laws');
        const stmt = db.prepare('INSERT INTO exemption_laws (docType, institutionName, authNumber) VALUES (?, ?, ?)');
        for (const law of lawsToSave) {
            stmt.run(law.docType, law.institutionName, law.authNumber);
        }
    });
    transaction(laws);
}

/**
 * Gets the exchange rate, trying the cache first, then fetching from the API if needed.
 * @param {boolean} forceRefresh - If true, bypasses the cache and fetches from the API.
 * @returns {Promise<{ rate: number | null, date: string | null }>} The exchange rate and its date.
 */
export async function getAndCacheExchangeRate(forceRefresh: boolean = false): Promise<{ rate: number | null, date: string | null }> {
    const db = await connectDb();
    const todayStr = new Date().toISOString().split('T')[0];

    if (!forceRefresh) {
        try {
            const cachedRate = db.prepare('SELECT rate FROM exchange_rates WHERE date = ?').get(todayStr) as { rate: number } | undefined;
            if (cachedRate) {
                return { rate: cachedRate.rate, date: todayStr };
            }
        } catch (error) {
            console.error("Error fetching cached exchange rate:", error);
        }
    }

    try {
        const data = await fetchExchangeRateFromApi();
        if (data && 'venta' in data && data.venta && data.venta.valor) {
            const rate = data.venta.valor;
            db.prepare('INSERT OR REPLACE INTO exchange_rates (date, rate) VALUES (?, ?)').run(todayStr, rate);
            return { rate, date: todayStr };
        }
    } catch (error) {
        console.error("Failed to fetch and cache exchange rate from API:", error);
    }
    
    // Fallback to the most recent rate in the DB if API fails
    try {
        const lastRate = db.prepare('SELECT rate, date FROM exchange_rates ORDER BY date DESC LIMIT 1').get() as { rate: number, date: string } | undefined;
        if (lastRate) {
            return { rate: lastRate.rate, date: lastRate.date };
        }
    } catch (error) {
        console.error("Error fetching last known exchange rate from cache:", error);
    }
    
    return { rate: null, date: null };
}
