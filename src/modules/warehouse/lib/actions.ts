/**
 * @fileOverview Placeholder for the removed warehouse actions.
 */
'use client';

export async function getWarehouseSettings() { return {}; }
export async function saveWarehouseSettings() {}
export async function getLocations() { return []; }
export async function addLocation() { throw new Error('Module removed'); }
export async function updateLocation() { throw new Error('Module removed'); }
export async function deleteLocation() { throw new Error('Module removed'); }
export async function getInventoryForItem() { return []; }
export async function logMovement() {}
export async function updateInventory() {}
export async function getItemLocations() { return []; }
export async function assignItemToLocation() {}
export async function unassignItemFromLocation() {}
export async function getWarehouseData() { return { locations: [], inventory: [], stock: [], itemLocations: [], warehouseSettings: {}, stockSettings: {} }; }
export async function getMovements() { return []; }
