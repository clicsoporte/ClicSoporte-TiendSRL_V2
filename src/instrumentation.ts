/**
 * @fileoverview Instrumentation hook for Next.js.
 * This file runs on server startup and is used to initialize the background scheduler.
 * Enhanced: Only initializes the scheduler during runtime, skipping the build phase.
 */

export async function register() {
  // Only run on the Node.js runtime and skip during the production build phase
  // Next.js sets NEXT_PHASE to 'phase-production-build' during next build.
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    try {
      const { initScheduler } = await import('@/modules/notifications/lib/scheduler');
      await initScheduler();
      console.log('✅ Background Scheduler initialized successfully.');
    } catch (error) {
      console.error('❌ Failed to initialize scheduler during startup:', error);
    }
  }
}
