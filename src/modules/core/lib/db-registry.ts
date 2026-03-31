/**
 * @fileoverview Registry of database modules.
 * Now reflecting the single database architecture.
 */

export interface DatabaseModuleMetadata {
    id: string;
    name: string;
    dbFile: string;
}

export const DB_MODULES_METADATA: DatabaseModuleMetadata[] = [
    { id: 'clic-tools-main', name: 'Clic-Tools (Base de Datos Unificada)', dbFile: 'intratool.db' },
];
