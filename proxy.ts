import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const expectedEmail = process.env.JOB_HUNT_AUTH_EMAIL;
  const expectedPassword = process.env.JOB_HUNT_AUTH_PASSWORD;

  if (!expectedEmail || !expectedPassword) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    const credentials = atob(authorization.slice("Basic ".length));
    const separatorIndex = credentials.indexOf(":");
    const email = credentials.slice(0, separatorIndex);
    const password = credentials.slice(separatorIndex + 1);

    if (email === expectedEmail && password === expectedPassword) {
      return NextResponse.next();
    }
  }

  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Job Hunt OS", charset="UTF-8"'
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)).*)"]
};
