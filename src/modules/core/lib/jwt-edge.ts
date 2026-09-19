/**
 * @fileoverview Web Crypto (SubtleCrypto) JWT verification helper for Next.js Middleware (Edge runtime).
 * This allows cryptographic verification of HMAC-SHA256 signatures in environments where Node.js 'crypto' or 'better-sqlite3' is not available.
 */

export interface EdgeSessionPayload {
  userId: number;
  email: string;
  role: string;
  name?: string;
  iat: number;
  exp: number;
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const len = binary.length;
  const buffer = new ArrayBuffer(len);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlDecode(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

/**
 * Verifies an HMAC-SHA256 JWT using Web Crypto API.
 */
export async function verifySessionJwtWebCrypto(
  token: string,
  secretKey: string
): Promise<EdgeSessionPayload | null> {
  try {
    if (!token || typeof token !== 'string' || !secretKey) return null;
    const parts = token.trim().split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Strict algorithm enforcement (prevent alg=none or algorithm confusion)
    const headerJson = base64UrlDecode(headerB64);
    const header = JSON.parse(headerJson);
    if (!header || header.alg !== 'HS256' || header.typ !== 'JWT') {
      return null;
    }

    const dataToSign = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const keyData = new TextEncoder().encode(secretKey);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = base64UrlToUint8Array(signatureB64);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signatureBytes.buffer as ArrayBuffer,
      dataToSign
    );

    if (!isValid) {
      return null;
    }

    const payloadJson = base64UrlDecode(payloadB64);
    const payload: EdgeSessionPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (!payload.userId || (payload.exp && payload.exp < now)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
