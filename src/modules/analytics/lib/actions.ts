/**
 * @fileoverview Server-side functions for aggregating analytics data.
 */
'use server';

import { connectDb } from "@/modules/core/lib/db";
import type { Ticket, TIProject, TimeEntry, User } from "@/modules/core/types";
import { DateRange } from 'react-day-picker';

type Kpi = {
    total: number;
    [key: string]: number;
};

type TimeTrackingKpi = {
    totalHours: number;
    totalBillable: number;
    totalNonBillable: number;
    byUser: { userId: number; userName: string; billable: number; nonBillable: number }[];
};

export type AnalyticsData = {
    tickets: Kpi;
    projects: Kpi;
    timeTracking: TimeTrackingKpi;
};

function applyDateFilter(query: string, range?: DateRange, dateColumn: string = 'createdAt'): { filteredQuery: string, params: string[] } {
    const whereClauses = [];
    const params = [];

    if (range?.from) {
        whereClauses.push(`${dateColumn} >= ?`);
        params.push(range.from.toISOString());
    }
    if (range?.to) {
        whereClauses.push(`${dateColumn} <= ?`);
        params.push(range.to.toISOString());
    }
    
    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    return {
        filteredQuery: query.replace('{{WHERE}}', whereString),
        params
    };
}


async function getTicketKpis(range?: DateRange): Promise<Kpi> {
    const db = await connectDb('tickets.db');
    const { filteredQuery, params } = applyDateFilter('SELECT status FROM tickets {{WHERE}}', range, 'createdAt');
    const tickets = db.prepare(filteredQuery).all(...params) as Pick<Ticket, 'status'>[];
    
    const result = tickets.reduce((acc, ticket) => {
        acc.total++;
        acc[ticket.status] = (acc[ticket.status] || 0) + 1;
        return acc;
    }, { total: 0 } as Kpi);

    return JSON.parse(JSON.stringify(result));
}

async function getProjectKpis(range?: DateRange): Promise<Kpi> {
    const db = await connectDb('planner.db');
    const { filteredQuery, params } = applyDateFilter('SELECT status FROM projects {{WHERE}}', range, 'createdAt');
    const projects = db.prepare(filteredQuery).all(...params) as Pick<TIProject, 'status'>[];

    const result = projects.reduce((acc, project) => {
        acc.total++;
        acc[project.status] = (acc[project.status] || 0) + 1;
        return acc;
    }, { total: 0 } as Kpi);
    return JSON.parse(JSON.stringify(result));
}

async function getTimeTrackingKpis(range?: DateRange): Promise<TimeTrackingKpi> {
    const timesheetDb = await connectDb('timesheet.db');
    const mainDb = await connectDb('intratool.db');

    const { filteredQuery, params } = applyDateFilter('SELECT * FROM time_entries {{WHERE}}', range, 'startTime');
    const timeEntries = timesheetDb.prepare(filteredQuery).all(...params) as TimeEntry[];
    
    const users = mainDb.prepare('SELECT id, name FROM users').all() as Pick<User, 'id' | 'name'>[];
    const userMap = new Map(users.map(u => [u.id, u.name]));

    const result: TimeTrackingKpi = {
        totalHours: 0,
        totalBillable: 0,
        totalNonBillable: 0,
        byUser: [],
    };

    const byUserMap = new Map<number, { userId: number; userName: string; billable: number; nonBillable: number }>();

    timeEntries.forEach(entry => {
        // Safe check for duration. Timers currently running have duration = null.
        const durationMs = entry.duration || 0;
        const durationHours = durationMs / 3600000; // ms to hours
        result.totalHours += durationHours;

        if (!byUserMap.has(entry.userId)) {
            byUserMap.set(entry.userId, {
                userId: entry.userId,
                userName: userMap.get(entry.userId) || 'Desconocido',
                billable: 0,
                nonBillable: 0,
            });
        }
        const userEntry = byUserMap.get(entry.userId)!;

        if (entry.isBillable) {
            result.totalBillable += durationHours;
            userEntry.billable += durationHours;
        } else {
            result.totalNonBillable += durationHours;
            userEntry.nonBillable += durationHours;
        }
    });

    result.byUser = Array.from(byUserMap.values()).map(u => ({
        ...u,
        billable: parseFloat(u.billable.toFixed(2)),
        nonBillable: parseFloat(u.nonBillable.toFixed(2)),
    })).sort((a,b) => (b.billable + b.nonBillable) - (a.billable + a.nonBillable));

    return JSON.parse(JSON.stringify(result));
}

export async function getAnalyticsData(range?: DateRange): Promise<AnalyticsData> {
    const [tickets, projects, timeTracking] = await Promise.all([
        getTicketKpis(range),
        getProjectKpis(range),
        getTimeTrackingKpis(range)
    ]);

    return {
        tickets,
        projects,
        timeTracking,
    };
}
