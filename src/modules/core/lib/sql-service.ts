/**
 * @fileoverview Service for securely connecting to and querying an MSSQL database.
 * This file handles the connection pooling and ensures that only read-only
 * SELECT queries can be executed, providing a safeguard against accidental data
 * modification or malicious attacks.
 */
'use server';

import * as sql from 'mssql';
import { logError } from './logger';
import { getSqlConfig } from './config-db';
import { authorizeActionAny } from './auth-guard';

let pool: sql.ConnectionPool | null = null;
let isConnecting = false;
let connectionPromise: Promise<sql.ConnectionPool> | null = null;


/**
 * Retrieves and validates the database configuration.
 * @returns {Promise<sql.config>} A configuration object for the `mssql` library.
 * @throws {Error} If the configuration is incomplete.
 */
async function getDbConfig(): Promise<sql.config> {
    const dbConfig = await getSqlConfig();

    if (!dbConfig || !dbConfig.user || !dbConfig.host || !dbConfig.database) {
        throw new Error("Las credenciales de SQL Server no están configuradas. Por favor, verifica el usuario, servidor y base de datos en la pantalla de administración.");
    }
    
    return {
        user: dbConfig.user,
        password: dbConfig.password,
        server: dbConfig.host,
        database: dbConfig.database,
        port: Number(dbConfig.port) || 1433,
        options: {
            encrypt: dbConfig.host.toLowerCase().includes('azure') ? true : false, // Recommended for Azure
            trustServerCertificate: true, // For local development; set to false in production with a proper certificate
            connectTimeout: 30000,
            requestTimeout: 30000,
            enableArithAbort: true,
            useUTC: false // CRITICAL: This prevents the driver from converting dates to the server's local timezone.
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    };
}

/**
 * Validates a SQL query string to ensure it is a read-only SELECT statement.
 * @param {string} query - The SQL query to validate.
 * @throws {Error} If the query is not a valid, read-only SELECT statement.
 */
function validateSelectOnly(query: string): void {
    if (!query || typeof query !== 'string') {
        throw new Error("Consulta SQL no válida.");
    }

    // Normalizar eliminando comentarios de bloque /* ... */ y de línea -- ...
    const strippedQuery = query
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/--.*$/gm, ' ')
        .trim();

    const normalized = strippedQuery.toLowerCase().replace(/\s+/g, ' ');

    if (!normalized.startsWith('select ')) {
        throw new Error("Solo se permiten consultas SELECT.");
    }

    // Bloquear palabras reservadas peligrosas y cláusulas de modificación
    const forbiddenPatterns = [
        /\binto\b/i,          // SELECT ... INTO ... (crea tablas)
        /\binsert\b/i,
        /\bupdate\b/i,
        /\bdelete\b/i,
        /\bdrop\b/i,
        /\balter\b/i,
        /\bcreate\b/i,
        /\btruncate\b/i,
        /\bexecute\b/i,
        /\bexec\b/i,
        /\bgrant\b/i,
        /\brevoke\b/i,
        /\bwaitfor\b/i,       // time-based injection attacks
        /\bopenrowset\b/i,    // external server queries
        /\bopendatasource\b/i,
        /\bopenquery\b/i,
        /\bxp_\w+/i,          // extended stored procedures
        /\bsp_\w+/i           // system stored procedures
    ];

    for (const pattern of forbiddenPatterns) {
        if (pattern.test(strippedQuery)) {
            throw new Error(`La consulta contiene una cláusula o comando no permitido (${pattern.source}).`);
        }
    }

    // Bloquear múltiples sentencias (; o GO)
    const cleanedForSemicolons = strippedQuery.replace(/;+\s*$/, ''); // Permitir un único ; al final
    if (cleanedForSemicolons.includes(';') || /\bgo\b/i.test(strippedQuery)) {
        throw new Error("No se permiten múltiples sentencias SQL.");
    }
}

/**
 * Gets a connection from the connection pool, creating the pool if it doesn't exist.
 * This function is designed to be robust, handling concurrent requests and reconnections.
 * @returns {Promise<sql.ConnectionPool>} A promise that resolves to the connection pool.
 */
async function getConnectionPool(): Promise<sql.ConnectionPool> {
    if (pool && pool.connected) {
        return pool;
    }

    if (isConnecting && connectionPromise) {
        return connectionPromise;
    }

    isConnecting = true;
    connectionPromise = (async () => {
        try {
            const config = await getDbConfig();
            
            console.log("Attempting to connect to SQL Server...");
            const newPool = new sql.ConnectionPool(config);
            
            newPool.on('error', err => {
                logError('Error en el pool de SQL Server', { error: String(err) });
                pool = null; // Reset pool on error
            });

            await newPool.connect();
            console.log('✅ Conexión a SQL Server establecida.');
            pool = newPool;
            return pool;

        } catch (err: unknown) {
            pool = null;
            const error = err as { message: string; code?: string };
            logError("Error al conectar con SQL Server", { error: { message: error.message, code: error.code }});
            throw new Error(`No se pudo establecer la conexión con la base de datos de SQL Server.`);
        } finally {
            isConnecting = false;
            connectionPromise = null;
        }
    })();

    return connectionPromise;
}

/**
 * Executes a read-only SQL query against the configured database.
 * @param {string} query - The SELECT query to execute.
 * @returns {Promise<any[]>} A promise that resolves to an array of records.
 * @throws {Error} If the query is invalid or if the database connection fails.
 */
export async function executeQuery(query: string): Promise<Record<string, unknown>[]> {
    await authorizeActionAny(['admin:sql', 'admin:general', 'admin:import']);
    validateSelectOnly(query);
    
    try {
        const connection = await getConnectionPool();
        const result = await connection.request().query(query);
        return result.recordset as Record<string, unknown>[];
        
    } catch (err: unknown) {
        const error = err as { message: string; code?: string };
        logError("Error al ejecutar consulta SELECT", { 
            error: error.message,
            code: error.code,
            query: query.substring(0, 500)
        });
        
        if (error.code === 'ESOCKET' || error.code === 'ECONNCLOSED') {
            pool = null; // Reset pool for reconnection on next attempt
        }
        
        throw new Error(`Error en la consulta SQL: ${error.message}`);
    }
}


/**
 * Tests the connection to the SQL server.
 * Throws an error if the connection fails.
 */
export async function testSqlConnection(): Promise<void> {
    await authorizeActionAny(['admin:sql', 'admin:general', 'admin:import']);
    try {
        const connection = await getConnectionPool();
        // A simple query to confirm the connection is live.
        await connection.request().query('SELECT 1');
    } catch (err: unknown) {
        const error = err as { message: string };
        logError('SQL Server connection test failed', { error: error.message });
        throw new Error(`La prueba de conexión falló: ${error.message}`);
    }
}

