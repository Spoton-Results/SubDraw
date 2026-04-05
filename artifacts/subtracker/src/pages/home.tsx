import * as React from "react";
import { Link } from "wouter";
import {
  Menu, X, XCircle, Shield, CheckSquare, FileText,
  BarChart2, ListChecks, Clock, HardHat, AlertTriangle,
  ArrowRight, Check, Star, DollarSign, TrendingDown, Zap,
  Lock, ChevronDown, ChevronRight, BadgeCheck,
} from "lucide-react";

const PLANS = [
  { name: "Starter", monthly: 199, annual: 2189, limit: "Up to 10 subcontracts", popular: false },
  { name: "Growth", monthly: 299, annual: 3289, limit: "Up to 20 subcontracts", popular: false },
  { name: "Scale", monthly: 399, annual: 4389, limit: "Up to 40 subcontracts", popular: true },
  { name: "Enterprise", monthly: 699, annual: 7689, limit: "Unlimited subcontracts", popular: false },
];

const FEATURES = [
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Magic Link Login",
    sub: "Subs actually use it",
    desc: "One click from their email — no password, no forgotten credentials. Sub adoption jumps from 20% to 100% overnight.",
  },
  {
    icon: <CheckSquare className="h-6 w-6" />,
    title: "Two-Step Change Orders",
    sub: "Both parties sign before it's real",
    desc: "Sub approves first, GC gives final sign-off. Nothing added to the contract until both sides commit in writing.",
  },
  {
    icon: <FileText className="h-6 w-6" />,
    title: "Automatic Lien Waivers",
    sub: "Never chase one again",
    desc: "Sub confirms payment. Lien waiver generates and is signed digitally in 30 seconds. Stored permanently.",
  },
  {
    icon: <BarChart2 className="h-6 w-6" />,
    title: "AI Bid Benchmarks",
    sub: "Know if a bid is fair before you accept",
    desc: "Upload your plans, get AI-estimated bid ranges by trade and location. Catch a 40% high bid before you negotiate.",
  },
  {
    icon: <ListChecks className="h-6 w-6" />,
    title: "Compliance Blocking",
    sub: "No invoice until docs are approved",
    desc: "Insurance, W9, bonds, safety orientation — enforced automatically. Subs can't bill until they're compliant.",
  },
  {
    icon: <Clock className="h-6 w-6" />,
    title: "Permanent Audit Trail",
    sub: "Every action logged with name + timestamp",
    desc: "Signed contracts, lien waivers, plan downloads, payment confirmations — everything in one place, forever.",
  },
];

const TESTIMONIALS = [
  {
    quote: "SubTracker caught a $12,000 invoice overrun in the first week. That's 30 months of subscription right there. I wish I found this two years ago.",
    name: "GC Owner",
    location: "Phoenix, AZ",
    initials: "JM",
    stars: 5,
  },
  {
    quote: "Finally — one screen that shows me and my subs the exact same numbers. No more disputes about what was approved or what's been paid.",
    name: "General Contractor",
    location: "St George, UT",
    initials: "RB",
    stars: 5,
  },
  {
    quote: "My subs actually use it because there's no password. I've tried three other portals. This is the only one where adoption wasn't a constant fight.",
    name: "Project Manager",
    location: "Salt Lake City, UT",
    initials: "TK",
    stars: 5,
  },
];

function FlaggedInvoiceMockup() {
  return (
    <div className="w-full max-w-xs rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
      <div className="bg-red-600 px-5 py-3.5 flex items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 text-white shrink-0" />
        <span className="text-white font-bold text-xs tracking-wide uppercase">Invoice Flagged — Over Contract</span>
      </div>
      <div className="px-5 py-4">
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-0.5">Empire Electric</p>
        <p className="text-xs text-slate-400 mb-4">Invoice #INV-0047 · Just submitted</p>
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500 text-xs">Invoice Amount</span>
            <span className="font-semibold text-slate-900 text-xs">$52,000.00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 text-xs">Approved Contract</span>
            <span className="font-semibold text-slate-900 text-xs">$45,500.00</span>
          </div>
          <div className="border-t border-slate-100 pt-2.5 flex justify-between items-center">
            <span className="text-slate-700 font-semibold text-xs">Over by</span>
            <span className="font-extrabold text-red-600 text-lg leading-none">$6,500.00</span>
          </div>
        </div>
        <div className="mt-3.5 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <p className="text-xs text-red-700 font-medium">14.3% over contract. Approval blocked until you act.</p>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="flex-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-600">Override</button>
          <button className="flex-1 rounded-lg px-2 py-2 text-xs font-semibold text-white bg-red-600">Reject</button>
        </div>
      </div>
    </div>
  );
}

function ScoreboardMockup() {
  return (
    <div className="w-full max-w-xs rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
          <BarChart2 className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-900 truncate">Financial Scoreboard</p>
          <p className="text-xs text-slate-400 truncate">Riverside Medical Campus</p>
        </div>
        <span className="text-xs font-semibold text-green-600 bg-green-100 rounded-full px-2 py-0.5 shrink-0">Live</span>
      </div>
      <div className="px-5 py-4 space-y-2.5 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">Base Contract</span>
          <span className="font-semibold text-slate-700">$85,000</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Approved Change Orders</span>
          <span className="font-semibold text-green-600">+$10,610</span>
        </div>
        <div className="border-t border-slate-100 pt-2.5 flex justify-between">
          <span className="font-bold text-slate-900">Approved Total</span>
          <span className="font-extrabold text-slate-900">$95,610</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Total Invoiced</span>
          <span className="font-semibold">$56,100</span>
        </div>
        <div className="border-t border-slate-100 pt-2.5 flex justify-between">
          <span className="font-bold text-slate-900">Remaining Balance</span>
          <span className="font-extrabold text-base" style={{ color: "hsl(221 83% 53%)" }}>$33,900</span>
        </div>
        <div className="pt-1">
          <div className="flex justify-between text-slate-400 mb-1">
            <span>58.7% billed</span>
            <span>$56,100 / $95,610</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: "58.7%", backgroundColor: "hsl(221 83% 53%)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [pastHero, setPastHero] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      setPastHero(window.scrollY > 500);
    };
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
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-slate-900/98 backdrop-blur-md shadow-lg" : "bg-slate-900"}`}>
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
              <Link href="/login" className="text-sm font-semibold text-white border border-white/30 rounded-lg px-4 py-2 hover:bg-white/10 transition-colors">Log In</Link>
              <Link
                href="/login"
                className="text-sm font-bold text-white rounded-lg px-5 py-2.5 transition-all hover:opacity-90 hover:scale-105 shadow-lg"
                style={{ backgroundColor: "#f97316" }}
              >
                See Live Demo →
              </Link>
            </div>
            <button className="md:hidden text-white p-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-slate-900 border-t border-white/10">
            <div className="px-4 py-4 flex flex-col gap-3">
              <a href="#features" onClick={scrollTo("features")} className="text-slate-300 hover:text-white font-medium py-2">Features</a>
              <a href="#pricing" onClick={scrollTo("pricing")} className="text-slate-300 hover:text-white font-medium py-2">Pricing</a>
              <Link href="/login" className="text-white border border-white/30 rounded-xl px-4 py-3 text-center font-semibold">Log In</Link>
              <Link href="/login" className="text-white rounded-xl px-4 py-3.5 text-center font-bold text-sm" style={{ backgroundColor: "#f97316" }}>
                See Live Demo — No Signup Required
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO: 2-column on desktop, stacked on mobile ── */}
      <section id="hero" className="bg-slate-900 pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left: copy + CTAs */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 mb-6" style={{ backgroundColor: "rgba(249,115,22,0.12)", borderColor: "rgba(249,115,22,0.3)" }}>
                <span className="text-xs font-bold tracking-wider uppercase" style={{ color: "#fb923c" }}>
                  Subcontractor Invoice Control for GCs
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
                Your sub just invoiced{" "}
                <span style={{ color: "#fb923c" }}>$8,500 over</span>{" "}
                their contract. Did you catch it?
              </h1>

              <p className="mt-5 text-lg text-slate-300 leading-relaxed">
                SubTracker automatically flags every invoice the moment it's submitted. Most GCs are approving overruns every month without knowing it.
              </p>

              {/* Social proof quote */}
              <div className="mt-6 border-l-4 pl-4 py-0.5" style={{ borderColor: "#f97316" }}>
                <p className="text-slate-200 text-sm italic leading-relaxed">
                  "Caught a $12,000 overrun in week one. That's 30 months of subscription right there."
                </p>
                <p className="mt-1 text-slate-500 text-xs">— GC Owner, Phoenix AZ</p>
              </div>

              {/* Primary CTA */}
              <div className="mt-8">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-3 rounded-xl text-white font-bold shadow-2xl transition-all hover:opacity-90 hover:scale-105"
                  style={{ backgroundColor: "#f97316", padding: "1rem 2rem", fontSize: "1rem" }}
                >
                  See a Flagged Invoice in 60 Seconds
                  <ArrowRight className="h-5 w-5 shrink-0" />
                </Link>
                <p className="mt-2 text-xs text-slate-500">No signup required · See the real product instantly</p>
              </div>

              {/* Secondary CTA */}
              <p className="mt-4 text-sm text-slate-400">
                Ready to start?{" "}
                <Link href="/signup" className="font-semibold underline underline-offset-2 hover:text-white transition-colors" style={{ color: "hsl(221 83% 70%)" }}>
                  Free 14-day trial
                </Link>
                {" "}— no credit card
              </p>

              {/* Trust row */}
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                {["No credit card", "Subs always free", "Cancel anytime"].map((b) => (
                  <span key={b} className="flex items-center gap-1.5 text-slate-500 text-xs">
                    <Check className="h-3 w-3 text-green-500" strokeWidth={3} /> {b}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: stacked product mockups */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative w-full max-w-sm">
                {/* Glow */}
                <div className="absolute inset-0 rounded-3xl blur-3xl opacity-20" style={{ background: "radial-gradient(circle, #f97316, transparent 70%)" }} />
                {/* Flagged invoice — front */}
                <div className="relative z-10">
                  <FlaggedInvoiceMockup />
                </div>
                {/* Scoreboard — behind + offset */}
                <div className="absolute -bottom-6 -right-6 z-0 opacity-80 hidden sm:block">
                  <div className="w-52 rounded-2xl bg-white shadow-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                      <div className="h-5 w-5 rounded flex items-center justify-center" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                        <BarChart2 className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-xs font-bold text-slate-900">Financial Scoreboard</span>
                    </div>
                    <div className="px-4 py-3 space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-slate-500">Approved Total</span><span className="font-bold">$95,610</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Total Invoiced</span><span className="font-semibold">$56,100</span></div>
                      <div className="border-t border-slate-100 pt-1.5 flex justify-between"><span className="font-bold">Remaining</span><span className="font-extrabold" style={{ color: "hsl(221 83% 53%)" }}>$33,900</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Stats bar */}
          <div className="mt-16 lg:mt-20 border-t border-white/10 pt-10 grid grid-cols-3 gap-4 max-w-2xl">
            {[
              { value: "100%", label: "Of invoices auto-checked" },
              { value: "$0", label: "Overruns pass without approval" },
              { value: "1-click", label: "Sub access — no password" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">{s.value}</div>
                <div className="mt-1 text-xs text-slate-400 leading-snug">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF STRIP ── */}
      <div className="bg-slate-800 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-10 text-xs sm:text-sm text-slate-400 text-center">
            <span className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400 shrink-0" /> 5-star rated · Mountain West GCs</span>
            <span className="hidden sm:block text-slate-700">·</span>
            <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-green-400 shrink-0" /> First overrun caught within 48 hours on average</span>
            <span className="hidden sm:block text-slate-700">·</span>
            <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-blue-400 shrink-0" /> Running in under 15 minutes</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: THE PROBLEM ── */}
      <section id="problem" className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-red-100 border border-red-200 px-3.5 py-1.5 mb-5">
              <span className="text-red-600 text-xs font-bold tracking-wider uppercase">What's Happening on Your Jobs Right Now</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 max-w-3xl mx-auto leading-tight">
              The average GC approves 3–5 overruns per month without realizing it
            </h2>
            <p className="mt-4 text-slate-500 max-w-2xl mx-auto text-base leading-relaxed">
              It's not negligence — it's a process problem. No system automatically checks each invoice against the approved contract. By the time you notice, the money is gone.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: <TrendingDown className="h-5 w-5 text-red-500" />,
                title: "Invoices slip through over contract",
                desc: "Manual review means overruns go undetected until the job closes. Then it's too late to recover the money.",
                stat: "$6,500 avg overrun per incident",
              },
              {
                icon: <XCircle className="h-5 w-5 text-red-500" />,
                title: "Verbal change orders become disputes",
                desc: "GC tells sub to do extra work. Sub invoices for it. GC disputes it six months later. Nothing was written down. Lawyer called.",
                stat: "68% of disputes start with verbal COs",
              },
              {
                icon: <Lock className="h-5 w-5 text-red-500" />,
                title: "Subs abandon your portal",
                desc: "They forget their password once and stop logging in. Back to texting PDFs. Your financial data is six weeks stale.",
                stat: "80% of subs abandon password portals",
              },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl border border-red-100 bg-red-50/60 p-7">
                <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center mb-4">
                  {card.icon}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{card.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-4">{card.desc}</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                  {card.stat}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 3: FLAGGED INVOICE (Solution) ── */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 border border-blue-200 px-3.5 py-1.5 mb-5">
                <span className="text-blue-700 text-xs font-bold tracking-wider uppercase">Automatic Invoice Protection</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
                Every invoice checked before you ever see it
              </h2>
              <p className="mt-5 text-slate-600 leading-relaxed">
                The moment a sub submits an invoice, SubTracker compares it against their approved contract total. If it's over — it stops. You see the exact dollar amount over. You decide, with a written reason stored permanently.
              </p>
              <ul className="mt-7 space-y-3.5">
                {[
                  "Instant flag showing exact dollar overage — no math on your end",
                  "Override requires a written reason, stored forever",
                  "Rejection sends the sub an immediate notification",
                  "Full audit trail of every approval and rejection",
                ].map((p) => (
                  <li key={p} className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    </div>
                    <span className="text-slate-700 text-sm">{p}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-9">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl text-white font-bold shadow-lg transition-all hover:opacity-90 hover:scale-105"
                  style={{ backgroundColor: "#f97316", padding: "0.85rem 1.75rem" }}
                >
                  See It Live — No Signup
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="flex justify-center">
              <FlaggedInvoiceMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: BEFORE vs AFTER ── */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Your job site. Before and after.</h2>
            <p className="mt-3 text-slate-500">Same crew. Same projects. Completely different outcome.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-7">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-8 w-8 rounded-xl bg-red-100 flex items-center justify-center">
                  <XCircle className="h-4 w-4 text-red-500" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Without SubTracker</h3>
              </div>
              <ul className="space-y-2.5">
                {[
                  "Manual invoice review — overruns slip through",
                  "Subs text PDFs to your cell phone",
                  "Change orders agreed verbally, disputed later",
                  "Chase subs for insurance docs every project",
                  "Lien waivers on paper, regularly lost",
                  "No record of what was approved or when",
                  "Find out about overruns when the job is done",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                    <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border-2 bg-white p-7 shadow-lg" style={{ borderColor: "hsl(221 83% 53%)" }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                  <Check className="h-4 w-4 text-white" strokeWidth={3} />
                </div>
                <h3 className="text-base font-bold text-slate-900">With SubTracker</h3>
              </div>
              <ul className="space-y-2.5">
                {[
                  "Every invoice auto-checked — overruns blocked instantly",
                  "Subs log in with one click, no password ever",
                  "Change orders signed digitally by both parties first",
                  "Compliance blocking — no invoice until docs approved",
                  "Lien waivers generated and signed in 30 seconds",
                  "Complete audit trail of every action, always",
                  "Real-time scoreboard — GC and sub see the same numbers",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(221 83% 53%)" }} strokeWidth={2.5} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-9 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl text-white font-bold shadow-lg transition-all hover:opacity-90 hover:scale-105"
              style={{ backgroundColor: "#f97316", padding: "0.85rem 2rem" }}
            >
              See It in Action — No Signup
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: SHARED SCOREBOARD ── */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div className="flex justify-center order-2 lg:order-1">
              <ScoreboardMockup />
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 border border-blue-200 px-3.5 py-1.5 mb-5">
                <span className="text-blue-700 text-xs font-bold tracking-wider uppercase">Shared Financial Visibility</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
                One scoreboard. GC and sub see identical numbers — always.
              </h2>
              <p className="mt-5 text-slate-600 leading-relaxed">
                Every payment dispute starts the same way: each side is looking at different numbers. SubTracker ends that. Both sides see the exact same live dashboard — base contract, change orders, invoiced, retention, remaining balance.
              </p>
              <ul className="mt-7 space-y-3.5">
                {[
                  "GC and sub see identical numbers in real time",
                  "Base contract, change orders, retention all tracked",
                  "Live remaining balance updated on every payment",
                  "Works on any device — phone, tablet, desktop",
                ].map((p) => (
                  <li key={p} className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    </div>
                    <span className="text-slate-700 text-sm">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: TESTIMONIALS ── */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">GCs who switched — what they said</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="rounded-2xl bg-slate-50 border border-slate-200 p-7 flex flex-col">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed italic flex-1">"{t.quote}"</p>
                <div className="mt-5 pt-4 border-t border-slate-200 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 7: FEATURES ── */}
      <section id="features" className="bg-slate-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Built for how GCs actually work</h2>
            <p className="mt-3 text-slate-500 max-w-xl mx-auto text-sm">Every feature exists because a real GC told us it was costing them money.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feat) => (
              <div key={feat.title} className="bg-white rounded-2xl border border-slate-200 p-7 hover:shadow-md hover:border-blue-200 transition-all group">
                <div className="h-11 w-11 rounded-xl flex items-center justify-center mb-4 text-white transition-transform group-hover:scale-110" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                  {feat.icon}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-0.5">{feat.title}</h3>
                <p className="text-xs font-semibold text-blue-600 mb-2">{feat.sub}</p>
                <p className="text-sm text-slate-600 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 8: HOW IT WORKS ── */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Up and running in 15 minutes</h2>
            <p className="mt-3 text-slate-500 text-sm">No IT. No onboarding call. No training required for subs.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            <div className="hidden md:flex absolute top-7 left-1/3 right-1/3 items-center justify-between px-6 pointer-events-none">
              <ChevronRight className="h-5 w-5 text-slate-300" />
              <ChevronRight className="h-5 w-5 text-slate-300" />
            </div>
            {[
              {
                num: "1",
                title: "Create project. Invite subs.",
                desc: "Upload your plans. Subs get a magic link. One click — they're in. No password, no training, no IT.",
              },
              {
                num: "2",
                title: "Subs bid. GC accepts. Contract locked.",
                desc: "Subs submit their own number. You compare and accept the winner. Subcontract built from the sub's own bid — no disputes.",
              },
              {
                num: "3",
                title: "Everything else is automatic.",
                desc: "Change orders, invoices, payments, lien waivers — all flow through SubTracker. Overruns blocked. Paper trail built.",
              },
            ].map((step) => (
              <div key={step.num} className="flex flex-col items-center text-center p-7 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="h-12 w-12 rounded-full flex items-center justify-center text-white font-extrabold text-lg mb-4 shrink-0" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                  {step.num}
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 9: PRICING ── */}
      <section id="pricing" className="bg-slate-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">If it catches one overrun, it pays for itself</h2>
          </div>
          <p className="text-center text-slate-500 mb-2 text-sm max-w-xl mx-auto">
            Average overrun our customers catch: <strong className="text-slate-700">$6,500</strong>. Starter plan: <strong className="text-slate-700">$199/mo</strong>. Do the math.
          </p>
          <p className="text-center text-slate-400 mb-12 text-xs">Priced by active subcontracts — not seats or projects. Subs always free.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl bg-white border p-6 flex flex-col ${
                  plan.popular ? "border-blue-500 shadow-xl scale-[1.02] z-10 ring-2 ring-blue-500/20" : "border-slate-200 shadow-sm"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white shadow" style={{ backgroundColor: "hsl(221 83% 53%)" }}>
                    Most Popular
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{plan.limit}</p>
                </div>
                <div className="mb-1">
                  <span className="text-3xl font-extrabold text-slate-900">${plan.monthly}</span>
                  <span className="text-slate-400 text-sm">/mo</span>
                </div>
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-xs text-slate-400">${plan.annual.toLocaleString()}/yr</span>
                  <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">1 Month Free</span>
                </div>
                <Link
                  href="/signup"
                  className={`w-full rounded-xl py-2.5 text-sm font-bold text-center block transition-colors ${
                    plan.popular ? "text-white hover:opacity-90" : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                  style={plan.popular ? { backgroundColor: "hsl(221 83% 53%)" } : {}}
                >
                  Start Free Trial
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-slate-400">
            {["14-day free trial · all plans", "No credit card to start", "Cancel anytime", "Subs always free"].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-green-500" /> {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="bg-slate-900 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 mb-7" style={{ backgroundColor: "rgba(249,115,22,0.12)", borderColor: "rgba(249,115,22,0.3)" }}>
            <span className="text-xs font-bold tracking-wider uppercase" style={{ color: "#fb923c" }}>Zero Risk — See the Product First</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Stop guessing. Start knowing exactly what every sub owes and has been paid.
          </h2>
          <p className="mt-4 text-lg text-slate-300">
            See a real flagged invoice in 60 seconds — no signup, no credit card, no sales call.
          </p>
          <div className="mt-9">
            <Link
              href="/login"
              className="inline-flex items-center gap-3 rounded-xl text-white font-bold shadow-2xl transition-all hover:opacity-90 hover:scale-105 text-base sm:text-lg"
              style={{ backgroundColor: "#f97316", padding: "1.1rem 2.5rem" }}
            >
              See a Flagged Invoice in 60 Seconds
              <ArrowRight className="h-5 w-5 shrink-0" />
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Or{" "}
            <Link href="/signup" className="underline hover:text-white transition-colors" style={{ color: "hsl(221 83% 70%)" }}>
              start your free 14-day trial
            </Link>
            {" "}— no credit card required
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {["No Credit Card", "Subs Always Free", "Cancel Anytime"].map((b) => (
              <span key={b} className="flex items-center gap-1.5 text-slate-600 text-xs">
                <Check className="h-3 w-3 shrink-0" /> {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 text-white font-bold text-base mb-3">
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
              <h4 className="text-white font-semibold text-xs mb-4 uppercase tracking-wider">Product</h4>
              <ul className="space-y-2.5">
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
              <h4 className="text-white font-semibold text-xs mb-4 uppercase tracking-wider">Get Started</h4>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: "#f97316" }}
              >
                See Live Demo <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <div className="mt-3">
                <Link href="/signup" className="text-slate-400 hover:text-white text-sm transition-colors">Start Free Trial →</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-7 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} SubTracker. All rights reserved.</p>
            <p>Built for General Contractors · Subs always free</p>
          </div>
        </div>
      </footer>

      {/* ── STICKY MOBILE CTA BAR ── */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 md:hidden transition-all duration-300 ${
          pastHero ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        }`}
        style={{ background: "linear-gradient(to top, rgba(15,23,42,0.98) 80%, transparent)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="px-4 py-3">
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 w-full rounded-xl text-white font-bold text-sm py-3.5 shadow-2xl"
            style={{ backgroundColor: "#f97316" }}
          >
            See a Flagged Invoice — No Signup <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

    </div>
  );
}
