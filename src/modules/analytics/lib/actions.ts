/**
 * @fileoverview Server-side functions for aggregating analytics data.
 * Unified for single database architecture.
 */
'use server';

import { connectDb } from "@/modules/core/lib/db";
import type { Ticket, TIProject, TimeEntry, User } from "@/modules/core/types";
import { DateRange } from 'react-day-picker';
import { differenceInDays, parseISO } from 'date-fns';

export type Kpi = { total: number; [key: string]: number; };
export type TimeTrackingKpi = {
    totalHours: number; totalBillable: number; totalNonBillable: number;
    byUser: { userId: number; userName: string; billable: number; nonBillable: number }[];
};
export type AnalyticsData = { tickets: Kpi; projects: Kpi; timeTracking: TimeTrackingKpi; };
export type DashboardStats = { activeTickets: number; activeProjects: number; expiringContracts: number; urgentTickets: number; };

function applyDateFilter(query: string, range?: DateRange, dateColumn: string = 'createdAt'): { filteredQuery: string, params: string[] } {
    const whereClauses = [];
    const params = [];
    if (range?.from) { whereClauses.push(`${dateColumn} >= ?`); params.push(range.from.toISOString()); }
    if (range?.to) { whereClauses.push(`${dateColumn} <= ?`); params.push(range.to.toISOString()); }
    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    return { filteredQuery: query.replace('{{WHERE}}', whereString), params };
}

export async function getAnalyticsData(range?: DateRange): Promise<AnalyticsData> {
    const db = await connectDb();
    
    // Tickets
    const tF = applyDateFilter('SELECT status FROM tickets {{WHERE}}', range, 'createdAt');
    const tickets = db.prepare(tF.filteredQuery).all(...tF.params) as Pick<Ticket, 'status'>[];
    const ticketKpi = tickets.reduce((acc, t) => { acc.total++; acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, { total: 0 } as Kpi);

    // Projects
    const pF = applyDateFilter('SELECT status FROM projects {{WHERE}}', range, 'createdAt');
    const projects = db.prepare(pF.filteredQuery).all(...pF.params) as Pick<TIProject, 'status'>[];
    const projectKpi = projects.reduce((acc, p) => { acc.total++; acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, { total: 0 } as Kpi);

    // Time Tracking (Using billableDuration for financial reports)
    const tsF = applyDateFilter('SELECT * FROM time_entries {{WHERE}}', range, 'startTime');
    const timeEntries = db.prepare(tsF.filteredQuery).all(...tsF.params) as TimeEntry[];
    const users = db.prepare('SELECT id, name FROM users').all() as Pick<User, 'id' | 'name'>[];
    const userMap = new Map(users.map(u => [u.id, u.name]));

    const timeKpi: TimeTrackingKpi = { totalHours: 0, totalBillable: 0, totalNonBillable: 0, byUser: [] };
    const byUserMap = new Map<number, { userId: number; userName: string; billable: number; nonBillable: number }>();

    timeEntries.forEach(entry => {
        // Use billableDuration (rounded) for kpis, fallback to actual duration if null
        const effectiveDuration = entry.billableDuration !== null ? entry.billableDuration : (entry.duration || 0);
        const hours = effectiveDuration / 3600000;
        
        timeKpi.totalHours += hours;
        if (!byUserMap.has(entry.userId)) byUserMap.set(entry.userId, { userId: entry.userId, userName: userMap.get(entry.userId) || 'Desconocido', billable: 0, nonBillable: 0 });
        const userEntry = byUserMap.get(entry.userId)!;
        
        if (entry.isBillable) { timeKpi.totalBillable += hours; userEntry.billable += hours; }
        else { timeKpi.totalNonBillable += hours; userEntry.nonBillable += hours; }
    });

    timeKpi.byUser = Array.from(byUserMap.values()).map(u => ({ ...u, billable: parseFloat(u.billable.toFixed(2)), nonBillable: parseFloat(u.nonBillable.toFixed(2)) })).sort((a,b) => (b.billable + b.nonBillable) - (a.billable + a.nonBillable));

    return { tickets: ticketKpi, projects: projectKpi, timeTracking: timeKpi };
}

export async function getDashboardStats(): Promise<DashboardStats> {
    try {
        const db = await connectDb();
        const activeTickets = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status != 'closed'").get() as { count: number };
        const urgentTickets = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status != 'closed' AND priority = 'urgent'").get() as { count: number };
        const activeProjects = db.prepare("SELECT COUNT(*) as count FROM projects WHERE status NOT IN ('completed', 'canceled')").get() as { count: number };
        const now = new Date();
        const contracts = db.prepare("SELECT endDate FROM contracts WHERE status = 'active'").all() as { endDate: string }[];
        const expiringContracts = contracts.filter(c => differenceInDays(parseISO(c.endDate), now) <= 30).length;

        return { activeTickets: activeTickets.count, urgentTickets: urgentTickets.count, activeProjects: activeProjects.count, expiringContracts };
    } catch {
        return { activeTickets: 0, urgentTickets: 0, activeProjects: 0, expiringContracts: 0 };
    }
}
