import { NextResponse, type NextRequest } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const API_BASE = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
const AUTH_COOKIE_NAME = "jiraibrary_auth_token";

const buildLoginRedirect = (request: NextRequest) => {
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const loginUrl = new URL(`/login?next=${encodeURIComponent(nextPath)}`, request.url);
  return NextResponse.redirect(loginUrl);
};

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return buildLoginRedirect(request);
  }

  try {
    const response = await fetch(`${API_BASE}api/users/me/`, {
      headers: {
        Accept: "application/json",
        Authorization: `Token ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return buildLoginRedirect(request);
    }

    const user = (await response.json()) as {
      role?: { name?: string | null } | null;
      is_staff?: boolean;
      is_superuser?: boolean;
    };
    const roleName = user.role?.name?.toLowerCase?.() ?? "";
    const isAdmin = Boolean(user.is_superuser || roleName === "admin");

    if (!isAdmin) {
      return NextResponse.redirect(new URL("/403", request.url));
    }

    return NextResponse.next();
  } catch (error) {
    return buildLoginRedirect(request);
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
