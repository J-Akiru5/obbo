import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";

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
    <div className="relative min-h-screen w-full overflow-hidden bg-white text-foreground">
      <div className="relative grid min-h-screen w-full lg:grid-cols-2">
        <section className="relative flex min-h-[18rem] flex-col justify-between overflow-hidden bg-[linear-gradient(160deg,#0f1b29_0%,#17263d_55%,#0d1420_100%)] px-6 py-8 text-white sm:px-8 lg:min-h-screen lg:px-16 lg:py-12">
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
              <div className="flex size-12 items-center justify-center">
                <Image src="/obbo.gif" alt="OBBO Logo" width={48} height={48} className="object-contain" />
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

        <section className="relative flex flex-col justify-center px-6 py-12 sm:px-8 lg:px-20">
          <div className="absolute left-6 top-6 z-20 lg:left-8 lg:top-8">
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:border-[var(--color-industrial-blue)]/30 hover:bg-slate-50 hover:text-[var(--color-industrial-blue)] transition-colors"
            >
              <ArrowLeft className="size-4" />
              {backLabel}
            </Link>
          </div>

          <div className="mx-auto w-full max-w-md">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}