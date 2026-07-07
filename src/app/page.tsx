import Link from 'next/link';
import Image from 'next/image';
import {
  ShieldCheck,
  Truck,
  Package,
  BarChart3,
  ArrowRight,
  Building2,
  ClipboardCheck,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/scroll-reveal';
import { Navbar } from '@/components/landing/navbar';
import { Stats } from '@/components/landing/stats';

// ─── Hero ──────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(160deg,#0f1b29_0%,#17263d_55%,#0d1420_100%)] pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Background pattern */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="bg-accent/10 animate-glow-pulse absolute top-20 right-10 h-72 w-72 rounded-full blur-3xl" />
        <div className="animate-glow-pulse absolute bottom-10 left-10 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl delay-500" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left text content */}
          <div>
            <div className="animate-fade-in-up mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
              <div className="bg-accent h-2 w-2 animate-pulse rounded-full" />
              <span className="text-sm font-medium text-white">
                Cloud-Based Distribution Platform
              </span>
            </div>
            <h1 className="animate-fade-in-up text-4xl leading-tight font-extrabold tracking-tight text-white delay-100 sm:text-5xl lg:text-6xl">
              Digitizing{' '}
              <span className="from-accent to-accent/80 bg-gradient-to-r bg-clip-text text-transparent">
                Cement
              </span>{' '}
              Distribution
            </h1>
            <p className="animate-fade-in-up mt-6 max-w-2xl text-lg leading-relaxed text-white/90 delay-200 sm:text-xl">
              Streamline your ordering, inventory management, and delivery tracking with OBBO
              iManage. Built for cement distributors who demand precision and speed.
            </p>
            <div className="animate-fade-in-up mt-8 flex flex-col gap-4 delay-300 sm:flex-row">
              <Link href="/register">
                <Button
                  size="lg"
                  className="bg-accent hover:bg-accent/90 text-accent-foreground hover:shadow-accent/25 w-full gap-2 px-8 text-base font-bold transition-all duration-300 hover:scale-105 hover:shadow-lg sm:w-auto"
                >
                  Start Free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-white/60 bg-transparent px-8 text-base font-semibold text-white transition-all duration-300 hover:scale-105 hover:bg-white/10 hover:text-white sm:w-auto"
                >
                  Sign In
                </Button>
              </Link>
            </div>
            <div className="animate-fade-in-up mt-10 flex items-center gap-8 text-sm text-white/80 delay-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span>Secure Platform</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Real-Time Data</span>
              </div>
            </div>
          </div>

          {/* Right hero image */}
          <div className="animate-fade-in hidden delay-300 lg:block">
            <div className="animate-float relative">
              <div className="from-accent/20 absolute -inset-4 rounded-2xl bg-gradient-to-r to-blue-500/20 blur-2xl" />
              <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/30">
                <Image
                  src="/hero-cement.png"
                  alt="Modern cement distribution warehouse with organized bags and delivery trucks"
                  width={640}
                  height={400}
                  className="h-auto w-full object-cover"
                  priority
                />
                {/* Overlay gradient */}
                <div className="from-primary/40 absolute inset-0 bg-gradient-to-t to-transparent" />
              </div>
              {/* Mascot Overlay */}
              <div className="drop-shadow-3xl absolute -right-20 -bottom-24 z-30 h-[576px] w-[576px]">
                <Image
                  src="/obbo.gif"
                  alt="OBBO Mascot"
                  width={576}
                  height={576}
                  className="h-full w-full object-contain"
                  unoptimized
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Features ──────────────────────────────────────────────
const features = [
  {
    icon: BarChart3,
    title: 'Real-Time Inventory',
    description:
      'Track stock levels across multiple shipment batches. Know exactly how many Jumbo Bags and Sling Bags are available at any moment.',
    color: 'bg-blue-500/10 text-blue-600',
  },
  {
    icon: ShieldCheck,
    title: 'Secure Digital Ordering',
    description:
      'Place and manage orders with full audit trails. Support for cash and check payment methods with KYC verification.',
    color: 'bg-emerald-500/10 text-emerald-600',
  },
  {
    icon: Truck,
    title: 'Delivery Management',
    description:
      'Track partial deliveries and customer balances automatically. Every bag dispatched is accounted for in the system.',
    color: 'bg-amber-500/10 text-amber-600',
  },
];

function Features() {
  return (
    <section id="features" className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal className="mx-auto mb-16 max-w-2xl text-center">
          <span className="text-accent text-sm font-bold tracking-widest uppercase">
            Why Choose OBBO
          </span>
          <h2 className="text-foreground mt-3 text-3xl font-bold sm:text-4xl">
            Everything You Need to Manage Cement Distribution
          </h2>
          <p className="text-muted-foreground mt-4 text-lg">
            Purpose-built tools for the construction supply chain.
          </p>
        </ScrollReveal>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {features.map((f, i) => (
            <ScrollReveal key={f.title} delay={i * 150}>
              <div className="group border-border bg-card hover:shadow-primary/5 relative rounded-2xl border p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl">
                <div
                  className={`h-14 w-14 rounded-xl ${f.color} mb-6 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                >
                  <f.icon className="h-7 w-7" />
                </div>
                <h3 className="mb-3 text-xl font-bold">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.description}</p>
                {/* Hover accent bar */}
                <div className="from-accent to-primary absolute right-0 bottom-0 left-0 h-1 origin-left scale-x-0 rounded-b-2xl bg-gradient-to-r transition-transform duration-500 group-hover:scale-x-100" />
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ──────────────────────────────────────────
const steps = [
  {
    icon: Building2,
    title: 'Register',
    description: 'Create your account and submit your business verification documents.',
  },
  {
    icon: ClipboardCheck,
    title: 'Get Verified',
    description: 'Our admin team reviews your KYC documents and activates your account.',
  },
  {
    icon: Package,
    title: 'Place Orders',
    description: 'Browse the cement catalog, select quantities, and submit your order.',
  },
  {
    icon: Truck,
    title: 'Track Delivery',
    description: 'Monitor order status from approval to dispatch, with real-time updates.',
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-muted/20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal className="mx-auto mb-16 max-w-2xl text-center">
          <span className="text-accent text-sm font-bold tracking-widest uppercase">Process</span>
          <h2 className="text-foreground mt-3 text-3xl font-bold sm:text-4xl">How It Works</h2>
          <p className="text-muted-foreground mt-4 text-lg">
            From registration to delivery in four simple steps.
          </p>
        </ScrollReveal>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <ScrollReveal key={s.title} delay={i * 120}>
              <div className="relative">
                <div className="group bg-card border-border flex flex-col items-center rounded-2xl border p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <div className="bg-primary mb-4 flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white transition-transform duration-300 group-hover:scale-110">
                    {i + 1}
                  </div>
                  <s.icon className="text-primary mb-3 h-8 w-8 transition-transform duration-300 group-hover:scale-110" />
                  <h3 className="mb-2 text-lg font-bold">{s.title}</h3>
                  <p className="text-muted-foreground text-sm">{s.description}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="absolute top-1/2 -right-3 z-10 hidden -translate-y-1/2 transform lg:flex">
                    <ChevronRight className="text-muted-foreground/30 h-6 w-6" />
                  </div>
                )}
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────
const faqs = [
  {
    question: 'How long does the KYC verification process take?',
    answer:
      'Typically, our admin team reviews and approves KYC documents within 24-48 business hours. You will receive an email notification once your account is activated.',
  },
  {
    question: 'What payment methods are supported?',
    answer:
      'We support both Cash and Check payment methods. You can select your preferred method during the checkout process. For check payments, additional verification might be required.',
  },
  {
    question: 'Can I track my delivery in real-time?',
    answer:
      'Yes, once your order is dispatched from our warehouse, you can track the status of your delivery directly from your dashboard.',
  },
  {
    question: 'What happens if a partial delivery is made?',
    answer:
      'Our system automatically tracks partial deliveries. Any remaining balance will be recorded and scheduled for a subsequent dispatch.',
  },
];

function FAQ() {
  return (
    <section id="faq" className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal className="mb-16 text-center">
          <span className="text-accent text-sm font-bold tracking-widest uppercase">FAQ</span>
          <h2 className="text-foreground mt-3 text-3xl font-bold sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground mt-4 text-lg">
            Got questions? We&apos;ve got answers.
          </p>
        </ScrollReveal>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <ScrollReveal key={i} delay={i * 100}>
              <details className="group bg-card border-border rounded-xl border [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between p-6 text-lg font-bold">
                  {faq.question}
                  <span className="text-primary transition-transform duration-300 group-open:-rotate-180">
                    <svg
                      fill="none"
                      height="24"
                      shapeRendering="geometricPrecision"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      width="24"
                    >
                      <path d="M6 9l6 6 6-6"></path>
                    </svg>
                  </span>
                </summary>
                <div className="text-muted-foreground px-6 pb-6 leading-relaxed">{faq.answer}</div>
              </details>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────
function CTA() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div className="from-primary absolute inset-0 bg-gradient-to-r to-[#142d4d]" />
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />
      {/* Animated accent orbs */}
      <div className="bg-accent/10 animate-glow-pulse absolute top-10 left-20 h-40 w-40 rounded-full blur-3xl" />
      <div className="animate-glow-pulse absolute right-20 bottom-10 h-60 w-60 rounded-full bg-blue-400/10 blur-3xl delay-300" />

      <ScrollReveal className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="mb-6 text-3xl font-bold text-white sm:text-4xl">
          Ready to Modernize Your Distribution?
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-white/90">
          Join the growing number of cement distributors who trust OBBO iManage for their daily
          operations.
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Link href="/register">
            <Button
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground hover:shadow-accent/25 w-full gap-2 px-10 text-base font-bold transition-all duration-300 hover:scale-105 hover:shadow-lg sm:w-auto"
            >
              Create Account <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button
              size="lg"
              variant="outline"
              className="w-full border-white/60 bg-transparent px-10 text-base font-semibold text-white transition-all duration-300 hover:scale-105 hover:bg-white/10 hover:text-white sm:w-auto"
            >
              Sign In
            </Button>
          </Link>
        </div>
      </ScrollReveal>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-[#0c1a2b] py-12 text-white/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="group flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
              <Image
                src="/logo.png"
                alt="OBBO iManage Logo"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <span className="text-lg font-bold text-white/80">OBBO iManage</span>
          </div>
          <p className="text-sm">
            &copy; {new Date().getFullYear()} OBBO Cement Distribution. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ──────────────────────────────────────────────
export default function LandingPage() {
  return (
    <main className="bg-background text-foreground min-h-screen">
      <Navbar />
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
