
/**
 * @fileoverview Server Actions for the Hacienda module.
 * These server-only functions are responsible for securely interacting
 * with external Hacienda APIs to fetch contributor and exemption information.
 */
'use server';

import { logError } from '@/modules/core/lib/logger';
import { getApiSettings } from '@/modules/core/lib/settings-db';
import { getCabysCatalog } from '@/modules/core/lib/data-access-db';
import type { HaciendaContributorInfo, HaciendaExemptionApiResponse, EnrichedExemptionInfo, EnrichedCabysItem } from '../../core/types';

let cabysCache: Map<string, { description: string, taxRate: number }> | null = null;

/**
 * Loads the CABYS data from the database into an in-memory cache.
 * @returns {Promise<Map<string, string>>} A Map where keys are CABYS codes and values are their descriptions.
 */
async function loadCabysData(): Promise<Map<string, { description: string, taxRate: number }>> {
    if (cabysCache) {
        return cabysCache;
    }

    console.log('Loading CABYS catalog from database...');
    try {
        const cabysItems = await getCabysCatalog();
        const newCache = new Map<string, { description: string, taxRate: number }>();
        for (const item of cabysItems) {
            newCache.set(item.code, { description: item.description, taxRate: item.taxRate });
        }
        cabysCache = newCache;
        console.log(`CABYS catalog loaded with ${cabysCache.size} entries.`);
    } catch (error) {
        console.error('Failed to load CABYS data from DB:', error);
        cabysCache = new Map<string, { description: string, taxRate: number }>(); // Initialize empty cache on error
    }
    return cabysCache;
}

/**
 * Retrieves the description for a given CABYS code from the cached data.
 * @param {string} code - The CABYS code to look up.
 * @returns {Promise<string | null>} The description string or null if not found.
 */
export async function getCabysDescription(code: string): Promise<string | null> {
    const cabysMap = await loadCabysData();
    return cabysMap.get(code)?.description || null;
}

// Pre-load data on server start to make subsequent lookups faster.
loadCabysData().catch(console.error);


/**
 * Fetches contributor (taxpayer) information from the Hacienda API.
 * @param {string} taxpayerId - The taxpayer's identification number.
 * @returns {Promise<HaciendaContributorInfo | { error: boolean; message: string }>} The contributor data or an error object.
 */
// In-memory cache for contributor lookups (1 hour TTL) to prevent repeated outgoing calls
const contributorCache = new Map<string, { data: HaciendaContributorInfo; expiresAt: number }>();

export async function getContributorInfo(taxpayerId: string): Promise<HaciendaContributorInfo | { error: boolean; message: string }> {
    if (!taxpayerId || typeof taxpayerId !== 'string') {
        return { error: true, message: "El número de identificación es requerido." };
    }

    const cleanTaxId = taxpayerId.trim();
    // Validar que solo contenga caracteres válidos de identificación tributaria (números, letras y guiones)
    if (!/^[a-zA-Z0-9-]{8,25}$/.test(cleanTaxId)) {
        return { error: true, message: "Formato de número de identificación no válido." };
    }

    // Check Cache
    const now = Date.now();
    const cached = contributorCache.get(cleanTaxId);
    if (cached && cached.expiresAt > now) {
        return cached.data;
    }

    try {
        const apiSettings = await getApiSettings();
        if (!apiSettings?.haciendaTributariaApi) { 
            throw new Error("La URL de la API de situación tributaria no está configurada.");
        }
        
        const baseUrl = apiSettings.haciendaTributariaApi.endsWith('/') 
            ? apiSettings.haciendaTributariaApi 
            : `${apiSettings.haciendaTributariaApi}/`;

        const apiUrl = `${baseUrl}${encodeURIComponent(cleanTaxId)}`;
        
        const response = await fetch(apiUrl, { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(`Error de la API de Hacienda: ${response.status} ${response.statusText}`);
        }
        
        const data = (await response.json()) as HaciendaContributorInfo;
        
        // Cache for 1 hour (3600 seconds)
        contributorCache.set(cleanTaxId, { data, expiresAt: now + 60 * 60 * 1000 });
        
        return data;
    } catch (error: unknown) {
        logError("Error al obtener información del contribuyente", { error: (error as Error).message, taxpayerId: cleanTaxId });
        return { error: true, message: (error as Error).message };
    }
}

/**
 * Fetches the status of a specific tax exemption from the Hacienda API.
 * @param {string} authNumber - The exemption authorization number.
 * @returns {Promise<HaciendaExemptionApiResponse | { error: boolean; message: string; status?: number }>} The exemption data or an error object.
 */
export async function getExemptionStatus(authNumber: string): Promise<HaciendaExemptionApiResponse | { error: boolean; message: string; status?: number }> {
    if (!authNumber || typeof authNumber !== 'string') {
        return { error: true, message: "El número de autorización es requerido." };
    }

    const cleanAuthNumber = authNumber.trim();
    if (!/^[a-zA-Z0-9-]{5,35}$/.test(cleanAuthNumber)) {
        return { error: true, message: "Formato de número de autorización no válido." };
    }

    try {
        const apiSettings = await getApiSettings();
        if (!apiSettings?.haciendaExemptionApi) {
            throw new Error("La URL de la API de exoneraciones no está configurada.");
        }

        const baseUrl = apiSettings.haciendaExemptionApi.endsWith('/') 
            ? apiSettings.haciendaExemptionApi 
            : `${apiSettings.haciendaExemptionApi}/`;

        const fullApiUrl = `${baseUrl}${encodeURIComponent(cleanAuthNumber)}`;
        const response = await fetch(fullApiUrl, { cache: 'no-store' });

        if (!response.ok) {
            if (response.status === 404) {
                 return { error: true, message: "Exoneración no encontrada en Hacienda.", status: 404 };
            }
            throw new Error(`Error de la API de Hacienda: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data as HaciendaExemptionApiResponse;
    } catch (error: unknown) {
        logError("Error al obtener estado de exoneración", { error: (error as Error).message, authNumber });
        return { error: true, message: (error as Error).message };
    }
}

/**
 * Fetches exemption status and enriches it with CABYS descriptions.
 * This provides a more user-friendly output by converting CABYS codes into human-readable text.
 * @param {string} authNumber - The exemption authorization number.
 * @returns {Promise<EnrichedExemptionInfo | { error: boolean; message: string; status?: number }>} The enriched exemption data or an error object.
 */
export async function getEnrichedExemptionStatus(authNumber: string): Promise<EnrichedExemptionInfo | { error: boolean; message: string; status?: number }> {
    const exemptionResult = await getExemptionStatus(authNumber);

    if ('error' in exemptionResult) {
        return exemptionResult;
    }

    const cabysMap = await loadCabysData();

    const enrichedCabys: EnrichedCabysItem[] = exemptionResult.cabys.map((code) => {
        const cabysEntry = cabysMap.get(code);
        return {
            code,
            description: cabysEntry?.description || 'Descripción no encontrada',
            taxRate: cabysEntry?.taxRate ?? 0,
        };
    });

    return {
        ...exemptionResult,
        enrichedCabys,
    };
}
