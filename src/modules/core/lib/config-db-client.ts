/**
 * @fileoverview Client-side actions for database configuration.
 */
'use client';

import { saveSqlConfig as saveSqlConfigServer, testSqlConnection as testSqlConnectionServer, getImportQueries as getImportQueriesServer, saveImportQueries as saveImportQueriesServer } from './db';
import type { SqlConfig, ImportQuery } from '../types';

export async function saveSqlConfig(config: SqlConfig): Promise<void> {
    return saveSqlConfigServer(config);
}

export async function testSqlConnection(): Promise<void> {
    return testSqlConnectionServer();
}

export async function getImportQueries(): Promise<ImportQuery[]> {
    return getImportQueriesServer();
}

export async function saveImportQueries(queries: ImportQuery[]): Promise<void> {
    return saveImportQueriesServer(queries);
}
