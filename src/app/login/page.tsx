'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { AuthShell } from '@/components/auth/auth-shell';

function RegistrationBanner() {
  const searchParams = useSearchParams();
  if (!searchParams.get('registered')) return null;
  return (
    <div className="border-status-success-border bg-status-success-bg text-status-success-text flex items-start gap-3 rounded-lg border p-4 text-sm">
      <CheckCircle2 className="text-status-success-text mt-0.5 h-5 w-5 flex-shrink-0" />
      <div>
        <p className="font-semibold">Registration submitted!</p>
        <p className="text-status-success-text mt-0.5">
          Your account is pending admin approval. You will be able to sign in once verified.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Signed in successfully!');
        // Middleware will evaluate role + kyc_status and redirect correctly
        router.refresh();
        router.replace('/client/dashboard');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      backHref="/"
      backLabel="Back to Home"
      eyebrow="Client access portal"
      title="Welcome back"
      description="Sign in to manage orders, inventory, and account updates in one place."
      highlights={[
        {
          label: 'Active orders',
          value: 'Real-time',
          description: 'Track requests and approvals without losing context.',
        },
        {
          label: 'Secure access',
          value: 'Verified',
          description: 'Keep client sessions consistent across the portal.',
        },
      ]}
    >
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="border-primary/20 bg-primary/5 text-primary inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.28em] uppercase">
            Sign in
          </div>
          <div className="space-y-2">
            <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance">
              Access your dashboard
            </h1>
            <p className="text-muted-foreground text-sm leading-6">
              Use your registered email and password to continue.
            </p>
          </div>
        </div>

        <Suspense fallback={null}>
          <RegistrationBanner />
        </Suspense>

        <div className="sr-only" aria-live="polite" role="status"></div>
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11"
            />
          </div>
          <p id="email-error" className="sr-only" role="alert"></p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Password</Label>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 pr-10"
              />
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <p id="password-error" className="sr-only" role="alert"></p>
          <Button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 w-full font-semibold"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <p className="text-muted-foreground text-center text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-primary font-semibold hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
