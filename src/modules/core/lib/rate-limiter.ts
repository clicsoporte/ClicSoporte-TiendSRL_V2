/**
 * @fileoverview Control de frecuencia (Rate Limiting) en memoria para proteger endpoints sensibles.
 */

interface RateLimitRecord {
  attempts: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

/**
 * Limpieza periódica cada 10 minutos para evitar fugas de memoria
 */
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
      if (now > record.resetAt) {
        memoryStore.delete(key);
      }
    }
  }, 10 * 60 * 1000).unref?.();
}

/**
 * Verifica si una clave (IP, email, acción) puede proceder.
 * @param key Identificador (e.g. `login:admin@correo.com` o `otp:user@correo.com`)
 * @param maxAttempts Intentos máximos permitidos antes del bloqueo (default: 5)
 * @param windowMs Ventana de tiempo en milisegundos (default: 15 minutos)
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || now > record.resetAt) {
    return {
      allowed: true,
      remaining: maxAttempts,
      retryAfterSec: 0,
    };
  }

  if (record.attempts >= maxAttempts) {
    const retryAfterSec = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
    };
  }

  if (record.resetAt - now > windowMs) {
    record.resetAt = now + windowMs;
  }

  return {
    allowed: true,
    remaining: maxAttempts - record.attempts,
    retryAfterSec: 0,
  };
}


/**
 * Registra un intento fallido para la clave dada.
 */
export function recordRateLimitFailure(
  key: string,
  windowMs: number = 15 * 60 * 1000
): void {
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || now > record.resetAt) {
    memoryStore.set(key, {
      attempts: 1,
      resetAt: now + windowMs,
    });
  } else {
    record.attempts += 1;
  }
}

/**
 * Restablece el límite tras una acción exitosa.
 */
export function resetRateLimit(key: string): void {
  memoryStore.delete(key);
}
