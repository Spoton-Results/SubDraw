import * as React from "react";
import { Link } from "wouter";
import {
  Menu, X, XCircle, Shield, CheckSquare, FileText,
  BarChart2, ListChecks, Clock, HardHat, AlertTriangle,
  ArrowRight, Check,
} from "lucide-react";

const PLANS = [
  { name: "Starter", monthly: 199, annual: 2189, limit: "Up to 10 active subcontracts", popular: false },
  { name: "Growth", monthly: 299, annual: 3289, limit: "Up to 20 active subcontracts", popular: false },
  { name: "Scale", monthly: 399, annual: 4389, limit: "Up to 40 active subcontracts", popular: true },
  { name: "Enterprise", monthly: 699, annual: 7689, limit: "Unlimited active subcontracts", popular: false },
];

const FEATURES = [
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Magic Link Login",
    desc: "Subs log in with one click from their email. No password. No forgotten credentials. No abandoned portal. Subs actually use it.",
  },
  {
    icon: <CheckSquare className="h-6 w-6" />,
    title: "Two-Step Change Order Approval",
    desc: "Sub approves first. GC gives final approval. Nothing added to the contract until both sides sign off. No accidental financial commitments.",
  },
  {
    icon: <FileText className="h-6 w-6" />,
    title: "Automatic Lien Waivers",
    desc: "Sub confirms payment. Lien waiver generates automatically. Sub signs digitally. Stored permanently. Never chase a lien waiver again.",
  },
  {
    icon: <BarChart2 className="h-6 w-6" />,
    title: "AI Bid Benchmarks",
    desc: "Upload your plans. Get AI-estimated bid ranges per trade based on your location and scope. Know immediately if a bid is reasonable before you accept it.",
  },
  {
    icon: <ListChecks className="h-6 w-6" />,
    title: "Compliance Blocking",
    desc: "Create a required compliance checklist per project. Subs cannot submit invoices until all required documents are approved. Insurance, W9, bonds, safety orientation.",
  },
  {
    icon: <Clock className="h-6 w-6" />,
    title: "Complete Audit Trail",
    desc: "Every action logged with user name and timestamp permanently. Signed contracts, lien waivers, plan download proof, and payment confirmations all in one place.",
  },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <div className="font-sans antialiased text-slate-900" style={{ scrollBehavior: "smooth" }}>

      {/* ── FIXED NAV ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-slate-900/95 backdrop-blur-sm shadow-lg" : "bg-slate-900"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="#hero" onClick={scrollTo("hero")} className="flex items-center gap-2 text-white font-bold text-xl tracking-tight">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                <HardHat className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
              </div>
              SubTracker
            </a>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" onClick={scrollTo("features")} className="text-slate-300 hover:text-white text-sm font-medium transition-colors cursor-pointer">
                Features
              </a>
              <a href="#pricing" onClick={scrollTo("pricing")} className="text-slate-300 hover:text-white text-sm font-medium transition-colors cursor-pointer">
                Pricing
              </a>
              <Link href="/login" className="text-sm font-semibold text-white border border-white/40 rounded-lg px-4 py-2 hover:bg-white/10 transition-colors">
                Log In
              </Link>
              <Link href="/signup" className="text-sm font-semibold text-white rounded-lg px-4 py-2 transition-colors" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                Sign Up Free
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden text-white p-2"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-slate-900 border-t border-white/10">
            <div className="px-4 py-4 flex flex-col gap-4">
              <a href="#features" onClick={scrollTo("features")} className="text-slate-300 hover:text-white font-medium py-2">Features</a>
              <a href="#pricing" onClick={scrollTo("pricing")} className="text-slate-300 hover:text-white font-medium py-2">Pricing</a>
              <Link href="/login" className="text-white border border-white/40 rounded-xl px-4 py-3 text-center font-semibold hover:bg-white/10 transition-colors">Log In</Link>
              <Link href="/signup" className="text-white rounded-xl px-4 py-3 text-center font-semibold" style={{ backgroundColor: "hsl(221 83% 53%)" }}>Sign Up Free</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── SECTION 1: HERO ── */}
      <section id="hero" className="bg-slate-900 pt-16 min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/15 border border-blue-400/30 px-4 py-1.5 mb-8">
            <span className="text-blue-400 text-xs font-semibold tracking-wide uppercase">Construction Financial Control</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight max-w-4xl mx-auto">
            Stop Approving Subcontractor Invoices That Go Over Budget
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            SubTracker automatically flags every invoice before you approve it — and gives you and your sub the exact same financial scoreboard in real time.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-bold text-white shadow-lg transition-all hover:opacity-90 hover:scale-105"
              style={{ backgroundColor: "hsl(221 83% 53%)" }}
            >
              Start Free 14-Day Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-bold text-white border border-white/40 hover:bg-white/10 transition-colors"
            >
              Watch Demo
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">No credit card required · 14-day free trial · Subcontractors always free</p>

          {/* Hero stats */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
              { value: "100%", label: "Of invoices automatically checked" },
              { value: "0", label: "Overruns approved without your sign-off" },
              { value: "1-click", label: "Sub login via magic link" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-extrabold text-white">{stat.value}</div>
                <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 2: THE PROBLEM ── */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Sound Familiar?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Invoices Approved Over Budget",
                desc: "No automatic check exists. Your PM reviews manually and approves. The overrun goes undetected until the job is closed and the numbers do not add up.",
              },
              {
                title: "Verbal Change Orders Cause Disputes",
                desc: "GC tells sub to do extra work. Sub does it. Invoices for it. GC disputes it six months later. No written record. Relationship damaged.",
              },
              {
                title: "Subs Never Log Into the Portal",
                desc: "Subs forget their password and stop using the system. Back to texting PDFs and calling. Your financial data is never accurate.",
              },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-8">
                <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center mb-4">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">{card.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 3: THE SOLUTION ── */}
      <section className="bg-slate-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Text */}
            <div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
                Every Invoice Automatically Checked Before You Approve It
              </h2>
              <p className="mt-6 text-slate-600 leading-relaxed">
                The moment a sub submits an invoice, SubTracker compares it against their approved contract amount. If it goes over — it stops. You see the exact dollar amount over. You decide what to do — with a written reason stored permanently.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Instant flag with exact overage amount",
                  "Override requires a written reason — stored permanently",
                  "Rejection notifies the sub immediately",
                  "Full audit trail of every decision",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    </div>
                    <span className="text-slate-700 text-sm">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Invoice flagged mockup */}
            <div className="flex justify-center">
              <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
                {/* Red header */}
                <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-white shrink-0" />
                  <span className="text-white font-bold text-sm tracking-wide uppercase">Invoice Flagged</span>
                </div>
                {/* Card content */}
                <div className="px-6 py-5">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Empire Electric</p>
                  <p className="text-xs text-slate-400 mb-5">Invoice #INV-0047</p>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Invoice Amount</span>
                      <span className="font-semibold text-slate-900">$52,000.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Approved Total</span>
                      <span className="font-semibold text-slate-900">$45,500.00</span>
                    </div>
                    <div className="border-t border-slate-100 pt-3 flex justify-between">
                      <span className="text-slate-500 font-medium">Over by</span>
                      <span className="font-extrabold text-red-600 text-base">$6,500.00</span>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                      Override with Reason
                    </button>
                    <button className="flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors">
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: THE SCOREBOARD ── */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Scoreboard mockup — LEFT */}
            <div className="flex justify-center order-2 lg:order-1">
              <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "hsl(221 83% 15%)" }}>
                    <BarChart2 className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Financial Scoreboard</p>
                    <p className="text-xs text-slate-400">Riverside Medical Campus</p>
                  </div>
                </div>
                {/* Content */}
                <div className="px-6 py-5 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Base Contract</span>
                    <span className="font-semibold text-slate-700">$85,000.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Approved Change Orders</span>
                    <span className="font-semibold text-green-600">+$10,610.00</span>
                  </div>
                  <div className="border-t border-slate-100 pt-3 flex justify-between">
                    <span className="font-bold text-slate-900">Approved Total</span>
                    <span className="font-extrabold text-slate-900">$95,610.00</span>
                  </div>
                  <div className="pt-2 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Invoiced</span>
                      <span className="font-semibold text-slate-700">$56,100.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Retention Held</span>
                      <span className="font-semibold text-slate-700">$5,610.00</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-3 flex justify-between">
                    <span className="font-bold text-slate-900">Remaining Balance</span>
                    <span className="font-extrabold text-base" style={{ color: "hsl(221 83% 53%)" }}>$33,900.00</span>
                  </div>
                  {/* Progress bar */}
                  <div className="pt-2">
                    <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                      <span>58.7% billed</span>
                      <span>$56,100 of $95,610</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: "58.7%", backgroundColor: "hsl(221 83% 53%)" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Text — RIGHT */}
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
                One Shared Scoreboard — Same Numbers for GC and Sub
              </h2>
              <p className="mt-6 text-slate-600 leading-relaxed">
                No more disputes about what was approved or what has been paid. Both sides see the exact same financial position in real time on any device.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "GC and sub see identical numbers, always",
                  "Base contract, change orders, and retention all tracked",
                  "Live remaining balance updated on every payment",
                  "Works on any device — phone, tablet, or desktop",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    </div>
                    <span className="text-slate-700 text-sm">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: KEY FEATURES ── */}
      <section id="features" className="bg-slate-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Everything You Need. Nothing You Do Not.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((feat) => (
              <div key={feat.title} className="bg-white rounded-2xl border border-slate-200 p-7 hover:shadow-md transition-shadow">
                <div className="h-11 w-11 rounded-xl flex items-center justify-center mb-5 text-white" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                  {feat.icon}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{feat.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 6: HOW IT WORKS ── */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Simple for GCs. Even Simpler for Subs.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting arrows (desktop only) */}
            <div className="hidden md:flex absolute top-8 left-1/3 right-1/3 items-center justify-between px-8 pointer-events-none">
              <ArrowRight className="h-6 w-6 text-slate-300" />
              <ArrowRight className="h-6 w-6 text-slate-300" />
            </div>
            {[
              {
                num: "1",
                title: "GC Creates Project and Invites Subs",
                desc: "GC uploads plans and scope. Subs receive a magic link invitation. One click and they are in. No password required.",
              },
              {
                num: "2",
                title: "Subs Bid. GC Accepts. Contract Created.",
                desc: "Subs view plans and submit their own bid amount. GC compares bids and accepts the winner. Subcontract created from the sub's own number.",
              },
              {
                num: "3",
                title: "Construction Managed Automatically.",
                desc: "Change orders, invoices, payments, and lien waivers all flow through SubTracker. Overruns flagged before approval. Paper trail created automatically.",
              },
            ].map((step) => (
              <div key={step.num} className="flex flex-col items-center text-center p-8 rounded-2xl bg-slate-50 border border-slate-200">
                <div
                  className="h-14 w-14 rounded-full flex items-center justify-center text-white font-extrabold text-xl mb-5 shrink-0"
                  style={{ backgroundColor: "hsl(221 83% 53%)" }}
                >
                  {step.num}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-3">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 7: PRICING ── */}
      <section id="pricing" className="bg-slate-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Simple Pricing. No Surprises.</h2>
          </div>
          <p className="text-center text-slate-500 mb-14 text-base">
            Based on active subcontracts — not projects or seats. Subcontractors always free.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl bg-white border p-7 flex flex-col ${
                  plan.popular
                    ? "border-blue-500 shadow-xl scale-[1.03] z-10 ring-2 ring-blue-500/20"
                    : "border-slate-200 shadow-sm"
                }`}
              >
                {plan.popular && (
                  <div
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white shadow"
                    style={{ backgroundColor: "hsl(221 83% 53%)" }}
                  >
                    Most Popular
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{plan.limit}</p>
                </div>

                {/* Monthly price */}
                <div className="mb-1">
                  <span className="text-4xl font-extrabold text-slate-900">${plan.monthly}</span>
                  <span className="text-slate-500 text-sm">/mo</span>
                </div>

                {/* Annual price */}
                <div className="flex items-center gap-2 mb-7">
                  <span className="text-sm text-slate-500">${plan.annual.toLocaleString()}/yr</span>
                  <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">1 Month Free</span>
                </div>

                <Link
                  href="/signup"
                  className={`w-full rounded-xl py-3 text-sm font-bold text-center block transition-colors ${
                    plan.popular
                      ? "text-white hover:opacity-90"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                  style={plan.popular ? { backgroundColor: "hsl(221 83% 53%)" } : {}}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-slate-500 text-sm mt-10">
            Pay annually and get one month completely free — same as getting SubTracker free every December.
          </p>
        </div>
      </section>

      {/* ── SECTION 8: FINAL CTA ── */}
      <section className="bg-slate-900 py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Built for GCs Doing Real Work
          </h2>
          <p className="mt-5 text-lg text-slate-300">
            If SubTracker catches one invoice overrun this month, it pays for itself.
          </p>
          <div className="mt-10">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl px-10 py-4 text-base font-bold text-white shadow-lg hover:opacity-90 hover:scale-105 transition-all"
              style={{ backgroundColor: "hsl(221 83% 53%)" }}
            >
              Start Free 14-Day Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-5 text-sm text-slate-500">
            No credit card required · 14-day free trial · Subcontractors always free · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 text-white font-bold text-lg mb-3">
                <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                  <HardHat className="h-4 w-4 text-white" strokeWidth={2.5} />
                </div>
                SubTracker
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                The financial control layer between GCs and their subcontractors.
              </p>
            </div>

            {/* Product links */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wide">Product</h4>
              <ul className="space-y-3">
                {[
                  { label: "Features", onClick: scrollTo("features"), href: "#features" },
                  { label: "Pricing", onClick: scrollTo("pricing"), href: "#pricing" },
                  { label: "Demo", onClick: undefined, href: "/login" },
                  { label: "Login", onClick: undefined, href: "/login" },
                ].map((link) => (
                  <li key={link.label}>
                    {link.onClick ? (
                      <a href={link.href} onClick={link.onClick} className="text-slate-400 hover:text-white text-sm transition-colors cursor-pointer">
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="text-slate-400 hover:text-white text-sm transition-colors">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Company links */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wide">Company</h4>
              <ul className="space-y-3">
                {["About", "Contact", "Privacy Policy", "Terms"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 text-center text-slate-500 text-sm">
            © 2026 SubTracker by SpotOn Results. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
