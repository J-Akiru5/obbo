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

    // Use metadata for faster checks if available
    const metadata = user?.user_metadata;
    let role = metadata?.role;
    let kycStatus = metadata?.kyc_status;

    // Helper to fetch profile if metadata is missing
    const getProfile = async () => {
        if (!user) return null;
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, kyc_status')
            .eq('id', user.id)
            .single();
        return profile;
    };

    // ── Protect admin routes ────────────────────────────────
    if (pathname.startsWith('/admin')) {
        if (!user) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        
        if (!role) {
            const profile = await getProfile();
            role = profile?.role;
        }

        if (role !== 'admin' && role !== 'warehouse_manager') {
            return NextResponse.redirect(new URL('/client/dashboard', request.url));
        }
    }

    // ── Protect client routes ───────────────────────────────
    if (pathname.startsWith('/client')) {
        if (!user) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        if (!role || !kycStatus) {
            const profile = await getProfile();
            role = profile?.role;
            kycStatus = profile?.kyc_status;
        }

        // Redirect admins away from client portal
        if (role === 'admin' || role === 'warehouse_manager') {
            return NextResponse.redirect(new URL('/admin/dashboard', request.url));
        }

        const isUnverified = kycStatus !== 'verified';
        const RESTRICTED_PATHS = ['/client/orders/new', '/client/ledger'];
        const isRestricted = RESTRICTED_PATHS.some(p => pathname.startsWith(p));

        if (isUnverified && isRestricted) {
            return NextResponse.redirect(new URL('/client/pending-kyc', request.url));
        }
    }

    // ── Block /pending for verified users ──────────────────
    if (pathname === '/pending') {
        if (user) {
            if (!role) {
                const profile = await getProfile();
                role = profile?.role;
            }
            if (role === 'admin' || role === 'warehouse_manager') {
                return NextResponse.redirect(new URL('/admin/dashboard', request.url));
            }
            return NextResponse.redirect(new URL('/client/dashboard', request.url));
        }
    }

    // ── Redirect logged-in users away from /login and /register
    if ((pathname === '/login' || pathname === '/register') && user) {
        if (!role || !kycStatus) {
            const profile = await getProfile();
            role = profile?.role;
            kycStatus = profile?.kyc_status;
        }
        if (role === 'admin' || role === 'warehouse_manager') {
            return NextResponse.redirect(new URL('/admin/dashboard', request.url));
        }
        if (kycStatus === 'verified') {
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
