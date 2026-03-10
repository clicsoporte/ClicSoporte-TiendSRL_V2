/**
 * @fileoverview Client-side functions for interacting with the TI project manager server-side DB functions.
 */
'use client';

import type { TIProject, ProjectAdvance, ProjectAttachment, ProjectItem, PlannerSettings } from '../../core/types';
import { logInfo, logError } from '@/modules/core/lib/logger';
import { 
    getProjects as getProjectsDb, 
    getProjectById as getProjectByIdDb,
    addProject as addProjectDb, 
    updateProject as updateProjectDb,
    getProjectAdvances as getProjectAdvancesDb,
    addProjectAdvance as addProjectAdvanceDb,
    getProjectAttachments as getProjectAttachmentsDb,
    addProjectAttachment as addProjectAttachmentDb,
    getProjectItems as getProjectItemsDb,
    saveProjectItem as saveProjectItemDb,
    deleteProjectItem as deleteProjectItemDb,
    getSettings as getSettingsDb,
    saveSettings as saveSettingsDb
} from './db';

export async function getProjects(): Promise<TIProject[]> {
    const results = await getProjectsDb();
    return JSON.parse(JSON.stringify(results));
}

export async function getProjectById(id: number): Promise<TIProject | null> {
    const result = await getProjectByIdDb(id);
    return result ? JSON.parse(JSON.stringify(result)) : null;
}

export async function createProject(project: Omit<TIProject, 'id' | 'consecutive' | 'createdAt' | 'updatedAt' | 'billingStatus'>): Promise<TIProject> {
    try {
        const result = await addProjectDb(project);
        await logInfo(`Proyecto TI ${result.consecutive} creado: ${result.name}`);
        return JSON.parse(JSON.stringify(result));
    } catch (error: unknown) {
        const err = error as Error;
        logError('Error creando proyecto', { error: err.message });
        throw err;
    }
}

export async function updateProject(project: TIProject): Promise<TIProject> {
    const result = await updateProjectDb(project);
    await logInfo(`Proyecto TI ${result.consecutive} actualizado`);
    return JSON.parse(JSON.stringify(result));
}

export async function getProjectAdvances(projectId: number): Promise<ProjectAdvance[]> {
    const results = await getProjectAdvancesDb(projectId);
    return JSON.parse(JSON.stringify(results));
}

export async function addProjectAdvance(advance: Omit<ProjectAdvance, 'id' | 'timestamp'>): Promise<ProjectAdvance> {
    const result = await addProjectAdvanceDb(advance);
    return JSON.parse(JSON.stringify(result));
}

export async function getProjectAttachments(projectId: number): Promise<ProjectAttachment[]> {
    const results = await getProjectAttachmentsDb(projectId);
    return JSON.parse(JSON.stringify(results));
}

export async function addProjectAttachment(attachment: Omit<ProjectAttachment, 'id' | 'createdAt'>): Promise<ProjectAttachment> {
    const result = await addProjectAttachmentDb(attachment);
    return JSON.parse(JSON.stringify(result));
}

export async function getProjectItems(projectId: number): Promise<ProjectItem[]> {
    const results = await getProjectItemsDb(projectId);
    return JSON.parse(JSON.stringify(results));
}

export async function saveProjectItem(item: Omit<ProjectItem, 'id'>): Promise<ProjectItem> {
    return JSON.parse(JSON.stringify(await saveProjectItemDb(item)));
}

export async function deleteProjectItem(id: number): Promise<void> {
    return deleteProjectItemDb(id);
}

export async function getPlannerSettings(): Promise<PlannerSettings> {
    return JSON.parse(JSON.stringify(await getSettingsDb()));
}

export async function savePlannerSettings(settings: Partial<PlannerSettings>): Promise<void> {
    return saveSettingsDb(settings);
}