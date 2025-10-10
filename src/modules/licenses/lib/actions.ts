/**
 * @fileoverview Client-side functions for the License Management module.
 */
'use client';

import { logInfo, logError } from '@/modules/core/lib/logger';
import type { License, SoftwareProduct } from '@/modules/core/types';
import { 
    getLicenses as getLicensesServer, 
    addLicense as addLicenseServer,
    updateLicense as updateLicenseServer,
    deleteLicense as deleteLicenseServer,
    getSoftwareProducts as getSoftwareProductsServer, 
    addSoftwareProduct as addSoftwareProductServer, 
    deleteSoftwareProduct as deleteSoftwareProductServer
} from './db';
import { generateKeys, getPublicKey } from './crypto';

// --- Licenses ---
export const getLicenses = async (): Promise<License[]> => {
    const licenses = await getLicensesServer();
    return JSON.parse(JSON.stringify(licenses));
}

export async function addLicense(license: Omit<License, 'id' | 'createdAt' | 'licenseKey'>): Promise<License> {
    const newLicense = await addLicenseServer(license);
    await logInfo('New offline license created', { softwareId: newLicense.softwareId, clientCompanyId: newLicense.clientCompanyId });
    return JSON.parse(JSON.stringify(newLicense));
}

export async function updateLicense(license: License): Promise<License> {
    const updatedLicense = await updateLicenseServer(license);
    await logInfo('Offline license updated', { licenseId: updatedLicense.id });
    return JSON.parse(JSON.stringify(updatedLicense));
}

export async function deleteLicense(id: number): Promise<void> {
    await logInfo(`License with ID ${id} deleted.`);
    return deleteLicenseServer(id);
}

// --- Software Products ---
export const getSoftwareProducts = async (): Promise<SoftwareProduct[]> => {
    const products = await getSoftwareProductsServer();
    return JSON.parse(JSON.stringify(products));
}

export async function addSoftwareProduct(product: Omit<SoftwareProduct, 'id'>): Promise<SoftwareProduct> {
    const newProduct = await addSoftwareProductServer(product);
    await logInfo('New software product added', { name: newProduct.name, isInternal: newProduct.isInternal });
    return JSON.parse(JSON.stringify(newProduct));
}

export async function deleteSoftwareProduct(id: number): Promise<void> {
    await logInfo(`Software product with ID ${id} deleted.`);
    return deleteSoftwareProductServer(id);
}

// --- Crypto Key Management ---
export async function generateNewKeys(): Promise<{ success: boolean; message: string }> {
    return generateKeys();
}

export async function getPublicKeyData(): Promise<string | null> {
    return getPublicKey();
}
