import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Package, ShieldCheck, Sparkles } from "lucide-react";

type AuthShellProps = {
  backHref: string;
  backLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  highlights: Array<{
    label: string;
    value: string;
    description: string;
  }>;
  children: ReactNode;
};

export function AuthShell({
  backHref,
  backLabel,
  eyebrow,
  title,
  description,
  highlights,
  children,
}: AuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#f6f3ec_0%,#eef2f7_55%,#faf7f1_100%)] text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.45] bg-[radial-gradient(circle_at_1px_1px,_rgba(30,58,95,0.10)_1px,_transparent_0)] [background-size:28px_28px]"
      />

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative flex min-h-[18rem] flex-col justify-between overflow-hidden bg-[linear-gradient(160deg,#203c63_0%,#17263d_55%,#0d1420_100%)] px-6 py-8 text-white shadow-[0_28px_80px_rgba(13,20,32,0.28)] sm:px-8 lg:min-h-screen lg:px-12 lg:py-10">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-90 bg-[linear-gradient(rgba(245,158,11,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,0.10)_1px,transparent_1px)] [background-size:100%_100%,120px_120px] [background-position:0_0,0_0]"
          />
          <div
            aria-hidden="true"
            className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-[var(--color-industrial-yellow)]/12 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-20 left-0 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl"
          />

          <div className="relative z-10 space-y-8">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-industrial-yellow)] text-[var(--color-industrial-blue)] shadow-lg shadow-black/10">
                <Package className="size-6" />
              </div>
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.35em] text-white/65">
                  OBBO iManage
                </p>
                <p className="text-sm text-white/70">Cement distribution portal</p>
              </div>
            </div>

            <div className="max-w-xl space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-white/75 backdrop-blur">
                <Sparkles className="size-3.5 text-[var(--color-industrial-yellow)]" />
                {eyebrow}
              </span>
              <h1 className="max-w-lg text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
                {title}
              </h1>
              <p className="max-w-lg text-base leading-7 text-white/72 sm:text-lg">
                {description}
              </p>
            </div>
          </div>

          <div className="relative z-10 grid gap-3 pt-10 sm:grid-cols-2">
            {highlights.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/12 bg-white/6 p-4 backdrop-blur"
              >
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-white/55">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  {item.value}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <div className="relative z-10 mt-8 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm text-white/75 backdrop-blur">
            <ShieldCheck className="size-4 text-[var(--color-industrial-yellow)]" />
            Secure access with a consistent industrial workflow
          </div>
        </section>

        <section className="relative flex items-center justify-center px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="absolute left-4 top-4 z-20 lg:left-6 lg:top-6">
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white/85 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:border-[var(--color-industrial-blue)]/30 hover:text-[var(--color-industrial-blue)]"
            >
              <ArrowLeft className="size-4" />
              {backLabel}
            </Link>
          </div>

          <div className="w-full max-w-2xl rounded-[2rem] border border-border/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-8 lg:p-10">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}