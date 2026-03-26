import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const updateSession = async (request: NextRequest) => {
  try {
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const user = await supabase.auth.getUser();

    // Only protect subscribe routes (except public ones: scanner, photo-scorer, photo-enhancer)
    if (
      request.nextUrl.pathname.startsWith("/subscribe") &&
      !request.nextUrl.pathname.startsWith("/subscribe/scanner") &&
      !request.nextUrl.pathname.startsWith("/subscribe/photo-scorer") &&
      !request.nextUrl.pathname.startsWith("/subscribe/photo-enhancer") &&
      user.error
    ) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    // Legacy /dashboard redirects → /subscribe
    if (request.nextUrl.pathname.startsWith("/dashboard")) {
      const newPath = request.nextUrl.pathname.replace("/dashboard", "/subscribe");
      return NextResponse.redirect(new URL(newPath + request.nextUrl.search, request.url), 301);
    }

    // Legacy /pricing redirect → /subscribe
    if (request.nextUrl.pathname === "/pricing") {
      return NextResponse.redirect(new URL("/subscribe", request.url), 301);
    }

    return response;
  } catch (e) {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
};