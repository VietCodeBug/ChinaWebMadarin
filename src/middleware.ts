import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    // Check for Better Auth session token cookie
    const sessionCookie = request.cookies.get("better-auth.session_token") || request.cookies.get("__secure-better-auth.session_token");
    
    const { pathname } = request.nextUrl;
    
    // Protect routes (e.g., /dashboard, /practice, /notebook if split later)
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/practice") || pathname.startsWith("/notebook")) {
        if (!sessionCookie) {
            return NextResponse.redirect(new URL("/", request.url));
        }
    }
    
    return NextResponse.next();
}

export const config = {
    matcher: [
        "/dashboard/:path*",
        "/practice/:path*",
        "/notebook/:path*"
    ]
};
