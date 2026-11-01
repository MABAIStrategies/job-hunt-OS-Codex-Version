import { NextRequest, NextResponse } from "next/server";

const encoder = new TextEncoder();

/**
 * Constant-time string comparison. Both inputs are hashed to fixed-length
 * SHA-256 digests first, so neither the length nor the position of the first
 * mismatch leaks through timing. Uses Web Crypto, which works in both the
 * Node.js and Edge runtimes.
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b))
  ]);
  const bytesA = new Uint8Array(digestA);
  const bytesB = new Uint8Array(digestB);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}

function decodeBasicCredentials(authorization: string | null): { email: string; password: string } | null {
  if (!authorization?.startsWith("Basic ")) {
    return null;
  }
  try {
    const bytes = Uint8Array.from(atob(authorization.slice("Basic ".length).trim()), (c) => c.charCodeAt(0));
    const credentials = new TextDecoder().decode(bytes);
    const separatorIndex = credentials.indexOf(":");
    if (separatorIndex < 0) {
      return null;
    }
    return {
      email: credentials.slice(0, separatorIndex),
      password: credentials.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const expectedEmail = process.env.JOB_HUNT_AUTH_EMAIL;
  const expectedPassword = process.env.JOB_HUNT_AUTH_PASSWORD;

  if (!expectedEmail || !expectedPassword) {
    // Fail closed in production: a missing or partial auth config must never
    // expose the app. Local development (next dev) stays open by design.
    if (process.env.NODE_ENV === "production") {
      return new Response("Service unavailable: authentication is not configured.", {
        status: 503,
        headers: { "Cache-Control": "no-store" }
      });
    }
    return NextResponse.next();
  }

  const credentials = decodeBasicCredentials(request.headers.get("authorization"));
  if (credentials) {
    // Compare both fields every time so timing doesn't reveal which one failed.
    const [emailMatches, passwordMatches] = await Promise.all([
      timingSafeEqual(credentials.email, expectedEmail),
      timingSafeEqual(credentials.password, expectedPassword)
    ]);
    if (emailMatches && passwordMatches) {
      return NextResponse.next();
    }
  }

  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Job Hunt OS", charset="UTF-8"',
      "Cache-Control": "no-store"
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)).*)"]
};
