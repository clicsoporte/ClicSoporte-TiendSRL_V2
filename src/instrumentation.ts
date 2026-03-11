/**
 * @fileoverview Instrumentation hook for Next.js.
 * This file runs on server startup and is used to initialize the background scheduler.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { initScheduler } = await import('@/modules/notifications/lib/scheduler');
      await initScheduler();
      console.log('✅ Background Scheduler initialized during server startup.');
    } catch (error) {
      console.error('❌ Failed to initialize scheduler during startup:', error);
    }
  }
}
