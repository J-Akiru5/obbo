import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session (do NOT remove — required for Supabase SSR)
    const { data: { user } } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    // ── Protect admin routes ────────────────────────────────
    if (pathname.startsWith('/admin')) {
        if (!user) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        if (profile?.role !== 'admin' && profile?.role !== 'warehouse_manager') {
            // Non-admin users get rerouted to client dashboard
            return NextResponse.redirect(new URL('/client/dashboard', request.url));
        }
    }

    // ── Protect client routes ───────────────────────────────
    if (pathname.startsWith('/client')) {
        if (!user) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        const { data: profile } = await supabase
            .from('profiles')
            .select('kyc_status, role')
            .eq('id', user.id)
            .single();

        // Redirect admins away from client portal
        if (profile?.role === 'admin' || profile?.role === 'warehouse_manager') {
            return NextResponse.redirect(new URL('/admin/dashboard', request.url));
        }
        // Gate unverified clients to /pending
        if (profile?.kyc_status !== 'verified') {
            return NextResponse.redirect(new URL('/pending', request.url));
        }
    }

    // ── Block /pending for verified users ──────────────────
    if (pathname === '/pending') {
        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('kyc_status, role')
                .eq('id', user.id)
                .single();
            if (profile?.role === 'admin' || profile?.role === 'warehouse_manager') {
                return NextResponse.redirect(new URL('/admin/dashboard', request.url));
            }
            if (profile?.kyc_status === 'verified') {
                return NextResponse.redirect(new URL('/client/dashboard', request.url));
            }
        }
    }

    // ── Redirect logged-in users away from /login and /register
    if ((pathname === '/login' || pathname === '/register') && user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, kyc_status')
            .eq('id', user.id)
            .single();
        if (profile?.role === 'admin' || profile?.role === 'warehouse_manager') {
            return NextResponse.redirect(new URL('/admin/dashboard', request.url));
        }
        if (profile?.kyc_status === 'verified') {
            return NextResponse.redirect(new URL('/client/dashboard', request.url));
        }
        return NextResponse.redirect(new URL('/pending', request.url));
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all paths except:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico
         * - public assets
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
