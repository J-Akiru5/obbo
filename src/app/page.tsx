"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Package,
  ShieldCheck,
  Truck,
  BarChart3,
  ArrowRight,
  Menu,
  X,
  Building2,
  ClipboardCheck,
  Clock,
  ChevronRight,
  Users,
  TrendingUp,
  Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ScrollReveal } from "@/components/scroll-reveal";
import { CountUp } from "@/components/count-up";
import { ThemeToggle } from "@/components/theme-toggle";

// ─── Navbar ──────────────────────────────────────────────
function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
            <Image src="/logo.png" alt="OBBO iManage Logo" width={36} height={36} className="object-contain" />
          </div>
          <span className="text-xl font-bold tracking-tight text-primary">
            OBBO <span className="font-light">iManage</span>
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-accent after:transition-all after:duration-300 hover:after:w-full">Features</a>
          <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-accent after:transition-all after:duration-300 hover:after:w-full">How It Works</a>
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost" className="font-semibold">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button className="bg-primary hover:bg-primary/90 font-semibold transition-transform duration-200 hover:scale-105">
              Get Started
            </Button>
          </Link>
        </div>
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <button className="p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden bg-background border-b border-border px-4 py-4 space-y-3 animate-in slide-in-from-top-2">
          <a href="#features" onClick={() => setMobileOpen(false)} className="block text-sm font-medium py-2">Features</a>
          <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="block text-sm font-medium py-2">How It Works</a>
          <Link href="/login" onClick={() => setMobileOpen(false)}>
            <Button variant="ghost" className="w-full justify-start font-semibold">Sign In</Button>
          </Link>
          <Link href="/register" onClick={() => setMobileOpen(false)}>
            <Button className="w-full bg-primary hover:bg-primary/90 font-semibold">
              Get Started
            </Button>
          </Link>
        </div>
      )}
    </nav>
  );
}

// ─── Hero ──────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden bg-[linear-gradient(160deg,#0f1b29_0%,#17263d_55%,#0d1420_100%)]">
      {/* Background pattern */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-20 right-10 w-72 h-72 bg-accent/10 rounded-full blur-3xl animate-glow-pulse" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-glow-pulse delay-500" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left text content */}
          <div>
            <div className="animate-fade-in-up inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-sm font-medium text-white">Cloud-Based Distribution Platform</span>
            </div>
            <h1 className="animate-fade-in-up delay-100 text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight">
              Digitizing{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-accent/80">
                Cement
              </span>{" "}
              Distribution
            </h1>
            <p className="animate-fade-in-up delay-200 mt-6 text-lg sm:text-xl text-white/90 max-w-2xl leading-relaxed">
              Streamline your ordering, inventory management, and delivery tracking with OBBO iManage.
              Built for cement distributors who demand precision and speed.
            </p>
            <div className="animate-fade-in-up delay-300 mt-8 flex flex-col sm:flex-row gap-4">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base px-8 gap-2 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-accent/25">
                  Start Free <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent border-white/60 text-white hover:bg-white/10 hover:text-white font-semibold text-base px-8 transition-all duration-300 hover:scale-105">
                  Sign In
                </Button>
              </Link>
            </div>
            <div className="animate-fade-in-up delay-400 mt-10 flex items-center gap-8 text-white/80 text-sm">
              <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /><span>Secure Platform</span></div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4" /><span>Real-Time Data</span></div>
            </div>
          </div>

          {/* Right hero image */}
          <div className="animate-fade-in delay-300 hidden lg:block">
            <div className="relative animate-float">
              <div className="absolute -inset-4 bg-gradient-to-r from-accent/20 to-blue-500/20 rounded-2xl blur-2xl" />
              <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/30">
                <Image
                  src="/hero-cement.png"
                  alt="Modern cement distribution warehouse with organized bags and delivery trucks"
                  width={640}
                  height={400}
                  className="w-full h-auto object-cover"
                  priority
                />
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent" />
              </div>
              {/* Mascot Overlay */}
              <div className="absolute -bottom-24 -right-20 z-30 w-[576px] h-[576px] drop-shadow-3xl">
                <Image
                  src="/obbo.gif"
                  alt="OBBO Mascot"
                  width={576}
                  height={576}
                  className="w-full h-full object-contain"
                  unoptimized
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Stats ──────────────────────────────────────────────
const stats = [
  { icon: Users, value: 150, suffix: "+", label: "Active Distributors" },
  { icon: Boxes, value: 50000, suffix: "+", label: "Bags Tracked Monthly" },
  { icon: Truck, value: 1200, suffix: "+", label: "Deliveries Completed" },
  { icon: TrendingUp, value: 99, suffix: "%", label: "Order Accuracy" },
];

function Stats() {
  return (
    <section className="relative -mt-10 z-10 pb-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className="group bg-card rounded-xl border border-border p-6 text-center shadow-lg shadow-black/5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <s.icon className="w-6 h-6 mx-auto mb-3 text-primary group-hover:scale-110 transition-transform duration-300" />
                <div className="text-2xl sm:text-3xl font-bold text-primary">
                  <CountUp end={s.value} suffix={s.suffix} />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

// ─── Features ──────────────────────────────────────────────
const features = [
  {
    icon: BarChart3,
    title: "Real-Time Inventory",
    description: "Track stock levels across multiple shipment batches. Know exactly how many Jumbo Bags and Sling Bags are available at any moment.",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    icon: ShieldCheck,
    title: "Secure Digital Ordering",
    description: "Place and manage orders with full audit trails. Support for cash and check payment methods with KYC verification.",
    color: "bg-emerald-500/10 text-emerald-600",
  },
  {
    icon: Truck,
    title: "Delivery Management",
    description: "Track partial deliveries and customer balances automatically. Every bag dispatched is accounted for in the system.",
    color: "bg-amber-500/10 text-amber-600",
  },
];

function Features() {
  return (
    <section id="features" className="py-20 sm:py-28 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-sm font-bold uppercase tracking-widest text-accent">Why Choose OBBO</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-foreground">
            Everything You Need to Manage Cement Distribution
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Purpose-built tools for the construction supply chain.
          </p>
        </ScrollReveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <ScrollReveal key={f.title} delay={i * 150}>
              <div className="group relative p-8 rounded-2xl border border-border bg-card hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-2">
                <div className={`w-14 h-14 rounded-xl ${f.color} flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                  <f.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.description}</p>
                {/* Hover accent bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-accent to-primary rounded-b-2xl scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
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
  { icon: Building2, title: "Register", description: "Create your account and submit your business verification documents." },
  { icon: ClipboardCheck, title: "Get Verified", description: "Our admin team reviews your KYC documents and activates your account." },
  { icon: Package, title: "Place Orders", description: "Browse the cement catalog, select quantities, and submit your order." },
  { icon: Truck, title: "Track Delivery", description: "Monitor order status from approval to dispatch, with real-time updates." },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-sm font-bold uppercase tracking-widest text-accent">Process</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-foreground">How It Works</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            From registration to delivery in four simple steps.
          </p>
        </ScrollReveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <ScrollReveal key={s.title} delay={i * 120}>
              <div className="relative">
                <div className="group flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-lg font-bold mb-4 transition-transform duration-300 group-hover:scale-110">
                    {i + 1}
                  </div>
                  <s.icon className="w-8 h-8 text-primary mb-3 transition-transform duration-300 group-hover:scale-110" />
                  <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden lg:flex absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                    <ChevronRight className="w-6 h-6 text-muted-foreground/30" />
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
    question: "How long does the KYC verification process take?",
    answer: "Typically, our admin team reviews and approves KYC documents within 24-48 business hours. You will receive an email notification once your account is activated."
  },
  {
    question: "What payment methods are supported?",
    answer: "We support both Cash and Check payment methods. You can select your preferred method during the checkout process. For check payments, additional verification might be required."
  },
  {
    question: "Can I track my delivery in real-time?",
    answer: "Yes, once your order is dispatched from our warehouse, you can track the status of your delivery directly from your dashboard."
  },
  {
    question: "What happens if a partial delivery is made?",
    answer: "Our system automatically tracks partial deliveries. Any remaining balance will be recorded and scheduled for a subsequent dispatch."
  }
];

function FAQ() {
  return (
    <section id="faq" className="py-20 sm:py-28 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal className="text-center mb-16">
          <span className="text-sm font-bold uppercase tracking-widest text-accent">FAQ</span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-foreground">Frequently Asked Questions</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Got questions? We've got answers.
          </p>
        </ScrollReveal>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <ScrollReveal key={i} delay={i * 100}>
              <details className="group bg-card border border-border rounded-xl [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center justify-between p-6 cursor-pointer font-bold text-lg">
                  {faq.question}
                  <span className="transition-transform duration-300 group-open:-rotate-180 text-primary">
                    <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                  </span>
                </summary>
                <div className="px-6 pb-6 text-muted-foreground leading-relaxed">
                  {faq.answer}
                </div>
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
    <section className="py-20 sm:py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#142d4d]" />
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      {/* Animated accent orbs */}
      <div className="absolute top-10 left-20 w-40 h-40 bg-accent/10 rounded-full blur-3xl animate-glow-pulse" />
      <div className="absolute bottom-10 right-20 w-60 h-60 bg-blue-400/10 rounded-full blur-3xl animate-glow-pulse delay-300" />

      <ScrollReveal className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
          Ready to Modernize Your Distribution?
        </h2>
        <p className="text-lg text-white/90 max-w-2xl mx-auto mb-10">
          Join the growing number of cement distributors who trust OBBO iManage for their daily operations.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/register">
            <Button size="lg" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base px-10 gap-2 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-accent/25">
              Create Account <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent border-white/60 text-white hover:bg-white/10 hover:text-white font-semibold text-base px-10 transition-all duration-300 hover:scale-105">
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
    <footer className="bg-[#0c1a2b] text-white/50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 group">
            <div className="w-8 h-8 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
              <Image src="/logo.png" alt="OBBO iManage Logo" width={32} height={32} className="object-contain" />
            </div>
            <span className="text-lg font-bold text-white/80">OBBO iManage</span>
          </div>
          <p className="text-sm">&copy; {new Date().getFullYear()} OBBO Cement Distribution. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ──────────────────────────────────────────────
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
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
