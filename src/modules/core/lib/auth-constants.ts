/**
 * @fileoverview Shared authentication constants.
 * Separated to avoid "Only async functions are allowed to be exported" error in "use server" files.
 */

export const SESSION_COOKIE = 'clic_tools_session';
export const SALT_ROUNDS = 10;
export const SESSION_DURATION = 60 * 60 * 8; // 8 hours in seconds
export const DEFAULT_SESSION_SECRET = 'e7b4a2f9c8d1e03b5a6c8d7e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a';

