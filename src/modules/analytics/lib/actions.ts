
/**
 * @fileoverview Server-side functions for aggregating analytics data.
 */
'use server';

import { connectDb } from "@/modules/core/lib/db";
import type { Ticket, TIProject, TimeEntry, User, Contract } from "@/modules/core/types";
import { DateRange } from 'react-day-picker';
import { differenceInDays, parseISO } from 'date-fns';

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

export type DashboardStats = {
    activeTickets: number;
    activeProjects: number;
    expiringContracts: number;
    urgentTickets: number;
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
        const durationMs = entry.duration || 0;
        const durationHours = durationMs / 3600000;
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

/**
 * Lightweight function for main dashboard stats.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
    try {
        const tDb = await connectDb('tickets.db');
        const pDb = await connectDb('planner.db');
        const cDb = await connectDb('contracts.db');

        const activeTickets = tDb.prepare("SELECT COUNT(*) as count FROM tickets WHERE status != 'closed'").get() as { count: number };
        const urgentTickets = tDb.prepare("SELECT COUNT(*) as count FROM tickets WHERE status != 'closed' AND priority = 'urgent'").get() as { count: number };
        const activeProjects = pDb.prepare("SELECT COUNT(*) as count FROM projects WHERE status NOT IN ('completed', 'canceled')").get() as { count: number };
        
        const now = new Date();
        const contracts = cDb.prepare("SELECT endDate FROM contracts WHERE status = 'active'").all() as { endDate: string }[];
        const expiringContracts = contracts.filter(c => differenceInDays(parseISO(c.endDate), now) <= 30).length;

        return {
            activeTickets: activeTickets.count,
            urgentTickets: urgentTickets.count,
            activeProjects: activeProjects.count,
            expiringContracts
        };
    } catch (e) {
        console.error("Dashboard stats failed", e);
        return { activeTickets: 0, urgentTickets: 0, activeProjects: 0, expiringContracts: 0 };
    }
}
