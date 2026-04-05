import * as React from "react";
import { Link } from "wouter";
import {
  Menu, X, XCircle, Shield, CheckSquare, FileText,
  BarChart2, ListChecks, Clock, HardHat, AlertTriangle,
  ArrowRight, Check, Star, DollarSign, TrendingDown, Zap,
  Lock, RefreshCw, ChevronDown,
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
    title: "Magic Link Login — Subs Actually Use It",
    desc: "Subs click one link from their email and they're in. No password. No forgotten credentials. No abandoned portal. Adoption goes from 20% to 100% overnight.",
  },
  {
    icon: <CheckSquare className="h-6 w-6" />,
    title: "Two-Step Change Order Approval",
    desc: "Sub approves first. GC gives final approval. Nothing added to the contract until both sides sign off. No more 'I told him to do it' disputes six months later.",
  },
  {
    icon: <FileText className="h-6 w-6" />,
    title: "Automatic Lien Waivers",
    desc: "Sub confirms payment. Lien waiver generates and is signed digitally in 30 seconds. Stored permanently. Never chase a lien waiver again.",
  },
  {
    icon: <BarChart2 className="h-6 w-6" />,
    title: "AI Bid Benchmarks",
    desc: "Upload your plans. Get AI-estimated bid ranges per trade for your location and scope. Know immediately if a bid is 40% high — before you negotiate.",
  },
  {
    icon: <ListChecks className="h-6 w-6" />,
    title: "Compliance Blocking",
    desc: "Subs cannot submit invoices until all required documents are approved. Insurance, W9, bonds, safety orientation — enforced automatically, not by memory.",
  },
  {
    icon: <Clock className="h-6 w-6" />,
    title: "Permanent Audit Trail",
    desc: "Every action logged with name and timestamp forever. Signed contracts, lien waivers, plan downloads, and payment confirmations — all in one place, always.",
  },
];

const TESTIMONIALS = [
  {
    quote: "Finally — one screen that shows me and my subs the exact same numbers in real time. No more disputes about what was approved or what has been paid.",
    name: "General Contractor",
    location: "St George, Utah",
    stars: 5,
  },
  {
    quote: "SubTracker caught a $12,000 invoice overrun in the first week. That's 30 months of subscription right there. I wish I had found this two years ago.",
    name: "GC Owner",
    location: "Phoenix, Arizona",
    stars: 5,
  },
  {
    quote: "My subs actually use it because they don't need a password. I've tried three other portals. This is the only one where adoption wasn't a fight.",
    name: "Project Manager",
    location: "Salt Lake City, Utah",
    stars: 5,
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
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-slate-900/98 backdrop-blur-sm shadow-lg" : "bg-slate-900"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="#hero" onClick={scrollTo("hero")} className="flex items-center gap-2 text-white font-bold text-xl tracking-tight">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                <HardHat className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              SubTracker
            </a>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" onClick={scrollTo("features")} className="text-slate-300 hover:text-white text-sm font-medium transition-colors cursor-pointer">Features</a>
              <a href="#pricing" onClick={scrollTo("pricing")} className="text-slate-300 hover:text-white text-sm font-medium transition-colors cursor-pointer">Pricing</a>
              <Link href="/login" className="text-sm font-semibold text-white border border-white/40 rounded-lg px-4 py-2 hover:bg-white/10 transition-colors">Log In</Link>
              <Link href="/login" className="text-sm font-bold text-white rounded-lg px-4 py-2 transition-colors" style={{ backgroundColor: "#f97316" }}>
                See Demo
              </Link>
            </div>
            <button className="md:hidden text-white p-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-slate-900 border-t border-white/10">
            <div className="px-4 py-4 flex flex-col gap-4">
              <a href="#features" onClick={scrollTo("features")} className="text-slate-300 hover:text-white font-medium py-2">Features</a>
              <a href="#pricing" onClick={scrollTo("pricing")} className="text-slate-300 hover:text-white font-medium py-2">Pricing</a>
              <Link href="/login" className="text-white border border-white/40 rounded-xl px-4 py-3 text-center font-semibold hover:bg-white/10 transition-colors">Log In</Link>
              <Link href="/login" className="text-white rounded-xl px-4 py-3 text-center font-bold" style={{ backgroundColor: "#f97316" }}>See Demo — No Signup</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── SECTION 1: HERO ── */}
      <section id="hero" className="bg-slate-900 pt-16 min-h-screen flex items-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">

          <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/15 border border-orange-400/30 px-4 py-1.5 mb-8">
            <span className="text-orange-400 text-xs font-semibold tracking-wide uppercase">Subcontractor Invoice Control for GCs</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight">
            Your subcontractor just invoiced $8,500 over their contract.<br className="hidden sm:block" /> Did you catch it before you paid?
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            SubTracker automatically flags every invoice the moment it's submitted — and gives you and your sub the exact same financial scoreboard in real time. Most GCs are approving overruns every month and never know it.
          </p>

          {/* Social proof quote */}
          <div className="mt-8 max-w-2xl mx-auto text-left border-l-4 pl-5 py-1" style={{ borderColor: "#f97316" }}>
            <p className="text-slate-200 text-base sm:text-lg italic leading-relaxed">
              "SubTracker caught a $12,000 overrun in the first week. That's 30 months of subscription right there."
            </p>
            <p className="mt-2 text-slate-400 text-sm not-italic">— GC Owner, Phoenix Arizona</p>
          </div>

          {/* Primary CTA */}
          <div className="mt-10">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-3 rounded-xl text-white font-bold shadow-2xl transition-all hover:opacity-90 hover:scale-105 text-base sm:text-lg"
              style={{ backgroundColor: "#f97316", padding: "1.1rem 2.5rem" }}
            >
              See a Flagged Invoice in 60 Seconds — No Signup Required
              <ArrowRight className="h-5 w-5 shrink-0" />
            </Link>
          </div>

          {/* Secondary CTA */}
          <p className="mt-4 text-sm text-slate-400">
            Or{" "}
            <Link href="/signup" className="underline hover:text-white transition-colors" style={{ color: "hsl(221 83% 70%)" }}>
              start your free 14-day trial
            </Link>
            {" "}— no credit card required
          </p>

          {/* Trust badges */}
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
            {["No Credit Card Required", "Subcontractors Always Free", "Cancel Anytime"].map((badge) => (
              <div key={badge} className="flex items-center gap-1.5 text-slate-500 text-xs">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <span>{badge}</span>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="mt-16 grid grid-cols-3 gap-6 max-w-2xl mx-auto border-t border-white/10 pt-12">
            {[
              { value: "100%", label: "Of invoices auto-checked" },
              { value: "$0", label: "Overruns without your approval" },
              { value: "1-click", label: "Sub access via magic link" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-extrabold text-white">{stat.value}</div>
                <div className="mt-1 text-xs sm:text-sm text-slate-400 leading-snug">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Scroll cue */}
          <div className="mt-12 flex justify-center">
            <button onClick={scrollTo("problem")} className="text-slate-600 hover:text-slate-400 transition-colors animate-bounce">
              <ChevronDown className="h-6 w-6" />
            </button>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF STRIP ── */}
      <div className="bg-slate-800 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-10 text-sm text-slate-400 text-center">
            <span className="flex items-center gap-2"><Star className="h-4 w-4 text-yellow-400 fill-yellow-400" /> 5-star rated by GCs across the Mountain West</span>
            <span className="hidden sm:block text-slate-700">|</span>
            <span className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-400" /> Avg GC catches first overrun within 48 hrs</span>
            <span className="hidden sm:block text-slate-700">|</span>
            <span className="flex items-center gap-2"><Zap className="h-4 w-4 text-blue-400" /> Up and running in under 15 minutes</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: THE REAL COST OF DOING NOTHING ── */}
      <section id="problem" className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-red-100 border border-red-200 px-4 py-1.5 mb-6">
              <span className="text-red-600 text-xs font-semibold tracking-wide uppercase">What's Happening on Your Jobs Right Now</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 max-w-3xl mx-auto leading-tight">
              The average GC approves 3–5 overruns per month without realizing it
            </h2>
            <p className="mt-5 text-slate-500 max-w-2xl mx-auto text-base leading-relaxed">
              It's not negligence — it's a process problem. There's no system automatically checking each invoice against the approved contract. By the time you notice, the money is gone.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <TrendingDown className="h-5 w-5 text-red-500" />,
                title: "Invoices approved $6,500 over contract",
                desc: "No automatic check exists. Your PM reviews manually. The overrun goes undetected until the job closes and the numbers don't add up. Then it's too late.",
                stat: "$6,500 avg overrun per incident",
              },
              {
                icon: <XCircle className="h-5 w-5 text-red-500" />,
                title: "Verbal change orders turn into disputes",
                desc: "GC tells sub to do extra work. Sub does it. Invoices for it. GC disputes it six months later because nothing was in writing. Relationship damaged. Lawyer called.",
                stat: "68% of disputes involve verbal COs",
              },
              {
                icon: <Lock className="h-5 w-5 text-red-500" />,
                title: "Your sub portal has a 20% adoption rate",
                desc: "Subs forget their password once and never log back in. Back to texting PDFs and calling your cell. Your financial data is six weeks stale and completely unreliable.",
                stat: "80% of subs abandon password portals",
              },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl border border-red-100 bg-red-50/50 p-8">
                <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center mb-4">
                  {card.icon}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-3">{card.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-4">{card.desc}</p>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                  {card.stat}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 3: THE SOLUTION — FLAGGED INVOICE ── */}
      <section className="bg-slate-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 border border-blue-200 px-4 py-1.5 mb-6">
                <span className="text-blue-700 text-xs font-semibold tracking-wide uppercase">Automatic Invoice Protection</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
                Every invoice automatically checked before you ever see it
              </h2>
              <p className="mt-6 text-slate-600 leading-relaxed">
                The moment a sub submits an invoice, SubTracker compares it against their approved contract. If it's over — it stops. You see the exact dollar amount over. You decide with a written reason stored permanently.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Instant flag with the exact dollar overage — no math required",
                  "Override requires a written reason stored permanently",
                  "Rejection sends sub an immediate notification with your reason",
                  "Full audit trail of every approval and rejection — forever",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    </div>
                    <span className="text-slate-700 text-sm">{point}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-10">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl text-white font-bold shadow-lg transition-all hover:opacity-90 hover:scale-105"
                  style={{ backgroundColor: "#f97316", padding: "0.9rem 2rem" }}
                >
                  See It Live — No Signup Required
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Invoice flagged mockup */}
            <div className="flex justify-center">
              <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
                <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-white shrink-0" />
                  <span className="text-white font-bold text-sm tracking-wide uppercase">Invoice Flagged — Over Contract</span>
                </div>
                <div className="px-6 py-5">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Empire Electric</p>
                  <p className="text-xs text-slate-400 mb-5">Invoice #INV-0047 · Submitted 2 minutes ago</p>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Invoice Amount</span>
                      <span className="font-semibold text-slate-900">$52,000.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Approved Contract Total</span>
                      <span className="font-semibold text-slate-900">$45,500.00</span>
                    </div>
                    <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                      <span className="text-slate-700 font-semibold">Over by</span>
                      <span className="font-extrabold text-red-600 text-xl">$6,500.00</span>
                    </div>
                  </div>
                  <div className="mt-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                    <p className="text-xs text-red-700 font-medium">This invoice exceeds the approved contract by 14.3%. Approval is blocked until you take action.</p>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                      Override with Reason
                    </button>
                    <button className="flex-1 rounded-xl px-3 py-2.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors">
                      Reject Invoice
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: BEFORE vs AFTER ── */}
      <section className="bg-white py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Your job site. Before and after SubTracker.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Before */}
            <div className="rounded-2xl border border-red-200 bg-red-50/40 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Without SubTracker</h3>
              </div>
              <ul className="space-y-3">
                {[
                  "Manual invoice review — overruns slip through",
                  "Subs text PDFs to your cell phone",
                  "Change orders agreed to verbally, disputed later",
                  "Chase subs for insurance docs every project",
                  "Lien waivers collected on paper, often lost",
                  "No record of what was approved or when",
                  "Find out about overruns when the job is over",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* After */}
            <div className="rounded-2xl border-2 bg-white p-8 shadow-lg" style={{ borderColor: "hsl(221 83% 53%)" }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                  <Check className="h-5 w-5 text-white" strokeWidth={2.5} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">With SubTracker</h3>
              </div>
              <ul className="space-y-3">
                {[
                  "Every invoice auto-checked — overruns blocked instantly",
                  "Subs log in with one click, no password ever",
                  "Change orders signed digitally by both parties first",
                  "Compliance blocking — no invoice until docs approved",
                  "Lien waivers generated and signed in 30 seconds",
                  "Complete audit trail of every action, always",
                  "Real-time financial dashboard — GC and sub see the same numbers",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(221 83% 53%)" }} strokeWidth={2.5} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl text-white font-bold shadow-lg transition-all hover:opacity-90 hover:scale-105"
              style={{ backgroundColor: "#f97316", padding: "0.9rem 2.2rem" }}
            >
              See It in Action — No Signup
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: SHARED SCOREBOARD ── */}
      <section className="bg-slate-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Scoreboard mockup */}
            <div className="flex justify-center order-2 lg:order-1">
              <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "hsl(221 83% 15%)" }}>
                    <BarChart2 className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Financial Scoreboard</p>
                    <p className="text-xs text-slate-400">Riverside Medical Campus</p>
                  </div>
                  <div className="ml-auto">
                    <span className="text-xs font-semibold text-green-600 bg-green-100 rounded-full px-2 py-0.5">Live</span>
                  </div>
                </div>
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

            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 border border-blue-200 px-4 py-1.5 mb-6">
                <span className="text-blue-700 text-xs font-semibold tracking-wide uppercase">Shared Financial Visibility</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
                One scoreboard. Same numbers for GC and sub. Zero disputes.
              </h2>
              <p className="mt-6 text-slate-600 leading-relaxed">
                Every payment dispute starts the same way — each side is looking at different numbers. SubTracker ends that. Both sides see the exact same live dashboard: base contract, change orders, invoiced, retention, and remaining balance.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "GC and sub see identical numbers — always in sync",
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

      {/* ── SECTION 6: TESTIMONIALS ── */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">GCs who switched — what they said</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="rounded-2xl bg-slate-50 border border-slate-200 p-8 flex flex-col">
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed italic flex-1">"{t.quote}"</p>
                <div className="mt-6 border-t border-slate-200 pt-4">
                  <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 7: FEATURES ── */}
      <section id="features" className="bg-slate-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Built for how GCs actually work</h2>
            <p className="mt-4 text-slate-500 max-w-2xl mx-auto">Everything you need. Nothing you don't. Every feature exists because a real GC told us it was costing them money.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat) => (
              <div key={feat.title} className="bg-white rounded-2xl border border-slate-200 p-7 hover:shadow-md hover:border-blue-200 transition-all">
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

      {/* ── SECTION 8: HOW IT WORKS ── */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Up and running in 15 minutes</h2>
            <p className="mt-4 text-slate-500">No IT. No onboarding call. No training required for your subs.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:flex absolute top-7 left-1/3 right-1/3 items-center justify-between px-8 pointer-events-none">
              <ArrowRight className="h-6 w-6 text-slate-300" />
              <ArrowRight className="h-6 w-6 text-slate-300" />
            </div>
            {[
              {
                num: "1",
                title: "GC creates a project and invites subs",
                desc: "Upload your plans and scope. Subs receive a magic link. One click and they're in. No password. No training. No IT ticket.",
              },
              {
                num: "2",
                title: "Subs bid. GC accepts. Contract locked.",
                desc: "Subs submit their own bid amount. GC compares and accepts the winner. Subcontract created from the sub's own number — no disputes about what was agreed.",
              },
              {
                num: "3",
                title: "Everything else is automatic.",
                desc: "Change orders, invoices, payments, and lien waivers flow through SubTracker. Overruns blocked before approval. Paper trail built automatically.",
              },
            ].map((step) => (
              <div key={step.num} className="flex flex-col items-center text-center p-8 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="h-14 w-14 rounded-full flex items-center justify-center text-white font-extrabold text-xl mb-5 shrink-0" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                  {step.num}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-3">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 9: PRICING ── */}
      <section id="pricing" className="bg-slate-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">If it catches one overrun, it pays for itself</h2>
          </div>
          <p className="text-center text-slate-500 mb-3 text-base max-w-2xl mx-auto">
            The average overrun our customers catch is $6,500. Starter plan is $199/mo. Do the math.
          </p>
          <p className="text-center text-slate-500 mb-14 text-sm">
            Priced by active subcontracts — not seats or projects. Subcontractors always free.
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
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white shadow" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                    Most Popular
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{plan.limit}</p>
                </div>
                <div className="mb-1">
                  <span className="text-4xl font-extrabold text-slate-900">${plan.monthly}</span>
                  <span className="text-slate-500 text-sm">/mo</span>
                </div>
                <div className="flex items-center gap-2 mb-7">
                  <span className="text-sm text-slate-500">${plan.annual.toLocaleString()}/yr</span>
                  <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">1 Month Free</span>
                </div>
                <Link
                  href="/signup"
                  className={`w-full rounded-xl py-3 text-sm font-bold text-center block transition-colors ${
                    plan.popular ? "text-white hover:opacity-90" : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                  style={plan.popular ? { backgroundColor: "hsl(221 83% 53%)" } : {}}
                >
                  Start Free Trial
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8 text-sm text-slate-500">
            {["14-day free trial on all plans", "No credit card required to start", "Cancel anytime — no questions asked", "Subs are always 100% free"].map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-green-500" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 10: FINAL CTA ── */}
      <section className="bg-slate-900 py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/15 border border-orange-400/30 px-4 py-1.5 mb-8">
            <span className="text-orange-400 text-xs font-semibold tracking-wide uppercase">No Risk — See It First</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Stop guessing. Start knowing exactly what every sub owes and has been paid.
          </h2>
          <p className="mt-5 text-lg text-slate-300">
            See a real flagged invoice in 60 seconds — no signup, no credit card, no sales call.
          </p>
          <div className="mt-10">
            <Link
              href="/login"
              className="inline-flex items-center gap-3 rounded-xl text-white font-bold shadow-2xl transition-all hover:opacity-90 hover:scale-105 text-base sm:text-lg"
              style={{ backgroundColor: "#f97316", padding: "1.1rem 2.5rem" }}
            >
              See a Flagged Invoice in 60 Seconds
              <ArrowRight className="h-5 w-5 shrink-0" />
            </Link>
          </div>
          <p className="mt-5 text-sm text-slate-500">
            Or{" "}
            <Link href="/signup" className="underline hover:text-white transition-colors" style={{ color: "hsl(221 83% 70%)" }}>
              start your free 14-day trial
            </Link>
            {" "}— no credit card required
          </p>
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
            {["No Credit Card Required", "Subcontractors Always Free", "Cancel Anytime"].map((badge) => (
              <div key={badge} className="flex items-center gap-1.5 text-slate-600 text-xs">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <span>{badge}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2 text-white font-bold text-lg mb-3">
                <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                  <HardHat className="h-4 w-4 text-white" strokeWidth={2.5} />
                </div>
                SubTracker
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                The financial control layer between GCs and their subcontractors. Built by people who've been on job sites.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wide">Product</h4>
              <ul className="space-y-3">
                {[
                  { label: "Features", onClick: scrollTo("features"), href: "#features" },
                  { label: "Pricing", onClick: scrollTo("pricing"), href: "#pricing" },
                  { label: "See Demo", onClick: undefined, href: "/login" },
                  { label: "Log In", onClick: undefined, href: "/login" },
                ].map((link) => (
                  <li key={link.label}>
                    {link.onClick ? (
                      <a href={link.href} onClick={link.onClick} className="text-slate-400 hover:text-white text-sm transition-colors cursor-pointer">{link.label}</a>
                    ) : (
                      <Link href={link.href} className="text-slate-400 hover:text-white text-sm transition-colors">{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wide">Get Started</h4>
              <ul className="space-y-3">
                {[
                  { label: "Start Free Trial", href: "/signup" },
                  { label: "Sign Up Free", href: "/signup" },
                ].map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-slate-400 hover:text-white text-sm transition-colors">{link.label}</Link>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: "#f97316" }}
                >
                  See Demo
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} SubTracker. All rights reserved.</p>
            <p>Built for General Contractors. Subcontractors always free.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
