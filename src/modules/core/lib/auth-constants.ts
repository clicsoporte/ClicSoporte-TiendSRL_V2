/**
 * @fileoverview Shared authentication constants.
 * Separated to avoid "Only async functions are allowed to be exported" error in "use server" files.
 */

export const SESSION_COOKIE = 'clic_tools_session';
export const SALT_ROUNDS = 10;
export const SESSION_DURATION = 60 * 60 * 8; // 8 hours in seconds
