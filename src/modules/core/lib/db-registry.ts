/**
 * @fileoverview Registry of database modules. 
 * This file contains metadata about the databases used in the system.
 * Logic for initialization/migration is handled separately to avoid circular dependencies.
 */

export interface DatabaseModuleMetadata {
    id: string;
    name: string;
    dbFile: string;
}

export const DB_MODULES_METADATA: DatabaseModuleMetadata[] = [
    { id: 'clic-tools-main', name: 'Clic-Tools (Sistema Principal)', dbFile: 'intratool.db' },
    { id: 'production-planner', name: 'Gestor de Proyectos', dbFile: 'planner.db' },
    { id: 'cost-assistant', name: 'Asistente de Costos', dbFile: 'cost-assistant.db' },
    { id: 'tickets', name: 'Soporte Técnico', dbFile: 'tickets.db' },
    { id: 'licenses', name: 'Gestión de Licencias', dbFile: 'licenses.db' },
    { id: 'timesheet', name: 'Hoja de Tiempos', dbFile: 'timesheet.db' },
    { id: 'contracts', name: 'Gestión de Contratos', dbFile: 'contracts.db' },
];
