/**
 * @fileoverview Server-side functions for the timesheet database.
 */
"use server";

import { connectDb } from '../../core/lib/db';

const TIMESHEET_DB_FILE = 'timesheet.db';

export async function initializeTimesheetDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS time_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticketId INTEGER,
            userId INTEGER NOT NULL,
            startTime TEXT NOT NULL,
            endTime TEXT,
            duration INTEGER, -- in milliseconds
            notes TEXT,
            isBillable BOOLEAN NOT NULL DEFAULT TRUE,
            createdAt TEXT NOT NULL
        );
    `;
    db.exec(schema);
    
    console.log(`Database ${TIMESHEET_DB_FILE} initialized for Time Tracking.`);
}

export async function runTimesheetMigrations(db: import('better-sqlite3').Database) {
    // Future migrations for the timesheet module can be added here.
}
