/**
 * @fileoverview Server-side cryptography functions for license signing.
 * THIS IS A NEW FILE.
 */
"use server";

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const KEYS_DIR = path.join(process.cwd(), 'dbs', 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private_key.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public_key.pem');

/**
 * Ensures the directory for storing cryptographic keys exists.
 */
async function ensureKeysDirectory(): Promise<void> {
    try {
        await fs.mkdir(KEYS_DIR, { recursive: true });
    } catch (err: unknown) {
        console.error("Failed to create keys directory:", err);
        throw new Error("Could not create directory for cryptographic keys.");
    }
}

/**
 * Generates a new RSA key pair and saves them to the disk.
 * @returns {Promise<{success: boolean, message: string}>} Result of the operation.
 */
export async function generateKeys(): Promise<{ success: boolean; message: string }> {
    await ensureKeysDirectory();
    return new Promise((resolve, reject) => {
        crypto.generateKeyPair('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        }, async (err, publicKey, privateKey) => {
            if (err) {
                console.error("Key generation failed:", err);
                return reject({ success: false, message: "Error al generar las claves." });
            }
            try {
                await fs.writeFile(PUBLIC_KEY_PATH, publicKey);
                await fs.writeFile(PRIVATE_KEY_PATH, privateKey);
                resolve({ success: true, message: "Nuevo par de claves generado y guardado." });
            } catch (writeErr) {
                 console.error("Failed to write keys to disk:", writeErr);
                 reject({ success: false, message: "Error al guardar las claves en el disco." });
            }
        });
    });
}

/**
 * Reads the private key from the filesystem.
 * @returns {Promise<string>} The private key in PEM format.
 * @throws {Error} If the private key file does not exist.
 */
async function getPrivateKey(): Promise<string> {
    try {
        return await fs.readFile(PRIVATE_KEY_PATH, 'utf-8');
    } catch (err: unknown) {
        console.error("Private key not found. Please generate a new key pair.", err);
        throw new Error("La clave privada no se encuentra. Genere un nuevo par de claves en la configuración.");
    }
}

/**
 * Reads the public key from the filesystem.
 * @returns {Promise<string | null>} The public key in PEM format, or null if not found.
 */
export async function getPublicKey(): Promise<string | null> {
    try {
        return await fs.readFile(PUBLIC_KEY_PATH, 'utf-8');
    } catch (_: unknown) {
        return null; // It's okay if it doesn't exist, the UI will prompt to create it.
    }
}


/**
 * Signs license data using the private key.
 * @param {object} licenseInfo - The license data to be signed.
 * @returns {Promise<string>} A JSON string containing the license info and its signature.
 */
export async function signLicenseData(licenseInfo: object): Promise<string> {
    const privateKey = await getPrivateKey();
    
    // The message to be signed must be a consistent string.
    // Sorting keys ensures the JSON string is always the same for the same data.
    const message = JSON.stringify(licenseInfo, Object.keys(licenseInfo).sort());
    
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(message);
    const signature = signer.sign(privateKey, 'hex');

    const licenseFileContent = {
        license_info: licenseInfo,
        signature: signature
    };

    return JSON.stringify(licenseFileContent, null, 2);
}
