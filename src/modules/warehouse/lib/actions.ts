/**
 * @fileoverview Client-side functions for interacting with the warehouse module's server-side DB functions.
 * This abstraction layer ensures components only call client-safe functions.
 */
'use client';

import {
    getLocations as getLocationsServer,
    addLocation as addLocationServer,
    updateLocation as updateLocationServer,
    deleteLocation as deleteLocationServer,
    getWarehouseSettings as getWarehouseSettingsServer,
    saveWarehouseSettings as saveWarehouseSettingsServer,
    getInventoryForItem as getInventoryForItemServer,
    logMovement as logMovementServer,
    updateInventory as updateInventoryServer,
    getItemLocations as getItemLocationsServer,
    assignItemToLocation as assignItemToLocationServer,
    unassignItemFromLocation as unassignItemFromLocationServer,
    getWarehouseData as getWarehouseDataServer,
    getMovements as getMovementsServer,
} from './db';
import type { WarehouseSettings, WarehouseLocation, WarehouseInventoryItem, MovementLog, ItemLocation } from '../../core/types';
import { logInfo } from '@/modules/core/lib/logger';

export async function getWarehouseSettings(): Promise<WarehouseSettings> {
    const settings = await getWarehouseSettingsServer();
    return JSON.parse(JSON.stringify(settings));
}
export async function saveWarehouseSettings(settings: WarehouseSettings): Promise<void> {
    await logInfo("Warehouse settings updated.");
    return saveWarehouseSettingsServer(settings);
}
export async function getLocations(): Promise<WarehouseLocation[]> {
    const locations = await getLocationsServer();
    return JSON.parse(JSON.stringify(locations));
}

export async function addLocation(location: Omit<WarehouseLocation, 'id'>): Promise<WarehouseLocation> {
    const newLocation = await addLocationServer(location);
    await logInfo(`New warehouse location created: ${newLocation.name} (${newLocation.code})`);
    return JSON.parse(JSON.stringify(newLocation));
}
export async function updateLocation(location: WarehouseLocation): Promise<WarehouseLocation> {
    const updatedLocation = await updateLocationServer(location);
    await logInfo(`Warehouse location updated: ${updatedLocation.name} (${updatedLocation.code})`);
    return JSON.parse(JSON.stringify(updatedLocation));
}
export async function deleteLocation(id: number): Promise<void> {
    await logInfo(`Warehouse location with ID ${id} deleted.`);
    return deleteLocationServer(id);
}
export async function getInventoryForItem(itemId: string): Promise<WarehouseInventoryItem[]> {
    const inventory = await getInventoryForItemServer(itemId);
    return JSON.parse(JSON.stringify(inventory));
}
export const logMovement = async (movement: Omit<MovementLog, 'id'|'timestamp'>): Promise<void> => logMovementServer(movement);
export const updateInventory = async(itemId: string, locationId: number, quantityChange: number): Promise<void> => updateInventoryServer(itemId, locationId, quantityChange);

// --- Simple Mode Actions ---
export async function getItemLocations(itemId: string): Promise<ItemLocation[]> {
    const locations = await getItemLocationsServer(itemId);
    return JSON.parse(JSON.stringify(locations));
}
export async function assignItemToLocation(itemId: string, locationId: number, clientId?: string | null): Promise<void> {
    await logInfo(`Item ${itemId} assigned to location ID ${locationId}.`);
    return assignItemToLocationServer(itemId, locationId, clientId);
}
export async function unassignItemFromLocation(itemLocationId: number): Promise<void> {
    await logInfo(`Item location mapping with ID ${itemLocationId} was removed.`);
    return unassignItemFromLocationServer(itemLocationId);
}

// --- Page-specific data loaders ---
export async function getWarehouseData() {
    const data = await getWarehouseDataServer();
    return JSON.parse(JSON.stringify(data));
}
export async function getMovements(itemId?: string): Promise<MovementLog[]> {
    const movements = await getMovementsServer(itemId);
    return JSON.parse(JSON.stringify(movements));
}
