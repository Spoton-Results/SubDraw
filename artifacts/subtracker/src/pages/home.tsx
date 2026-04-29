import * as React from "react";
import { Link } from "wouter";
import {
  Menu, X, HardHat, ArrowRight, Check,
} from "lucide-react";

const PLANS = [
  {
    name: "Starter",
    monthly: 149,
    annual: 1639,
    limit: "Up to 10 active subcontracts",
    description: "Perfect for remodelers and small GCs getting started",
    roi: "If SubTracker catches one invoice overrun this year it paid for itself completely.",
    popular: false,
  },
  {
    name: "Professional",
    monthly: 299,
    annual: 3289,
    limit: "Up to 30 active subcontracts",
    description: "For GCs running two to four active jobs simultaneously",
    roi: "One caught overrun on a single job covers your entire year of SubTracker.",
    popular: true,
  },
  {
    name: "Scale",
    monthly: 599,
    annual: 6589,
    limit: "Unlimited active subcontracts",
    description: "For serious GCs running multiple crews with no limits",
    roi: "Unlimited protection across every job every sub every invoice all year.",
    popular: false,
  },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [pastHero, setPastHero] = React.useState(false);
  const [billingAnnual, setBillingAnnual] = React.useState(false);

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
              SubDraw
            </a>
            <div className="hidden md:flex items-center gap-8">
              <a href="#what-it-does" onClick={scrollTo("what-it-does")} className="text-slate-300 hover:text-white text-sm font-medium transition-colors cursor-pointer">Features</a>
              <a href="#pricing" onClick={scrollTo("pricing")} className="text-slate-300 hover:text-white text-sm font-medium transition-colors cursor-pointer">Pricing</a>
              <Link href="/login" className="text-sm font-semibold text-white border border-white/30 rounded-lg px-4 py-2 hover:bg-white/10 transition-colors">Log In</Link>
              <Link
                href="/login"
                className="text-sm font-bold text-white rounded-lg px-5 py-2.5 transition-all hover:opacity-90 hover:scale-105 shadow-lg"
                style={{ backgroundColor: "#F97316" }}
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
              <a href="#what-it-does" onClick={scrollTo("what-it-does")} className="text-slate-300 hover:text-white font-medium py-2">Features</a>
              <a href="#pricing" onClick={scrollTo("pricing")} className="text-slate-300 hover:text-white font-medium py-2">Pricing</a>
              <Link href="/login" className="text-white border border-white/30 rounded-xl px-4 py-3 text-center font-semibold">Log In</Link>
              <Link href="/login" className="text-white rounded-xl px-4 py-3.5 text-center font-bold text-sm" style={{ backgroundColor: "#F97316" }}>
                See Live Demo — No Signup Required
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ══════════════════════════════════════════
          SECTION 1 — HERO
      ══════════════════════════════════════════ */}
      <section id="hero" className="bg-slate-900 pt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">

          {/* Badge */}
          <div className="inline-flex items-center rounded-full border px-3.5 py-1.5 mb-8" style={{ backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.15)" }}>
            <span className="text-xs font-bold tracking-widest uppercase text-slate-400">
              Subcontractor Invoice Control for GCs
            </span>
          </div>

          {/* Headline — exact two-line break as specified */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] tracking-tight max-w-4xl">
            Your sub just invoiced $8,500 over their contract.<br />
            <span className="text-slate-200">Do you catch it — or pay it?</span>
          </h1>

          {/* Subheadline */}
          <p className="mt-7 text-lg sm:text-xl text-slate-300 leading-relaxed max-w-3xl">
            Most GCs only see overruns after the money is gone. SubDraw sits between you and your subs and flags every over-invoice the second it's submitted, with a written override reason required if you still want to approve it.
          </p>

          {/* Social proof quote */}
          <div className="mt-8 max-w-2xl border-l-4 pl-5 py-1" style={{ borderColor: "hsl(221 83% 53%)" }}>
            <p className="text-slate-200 text-base italic leading-relaxed">
              "SubDraw caught a $12,000 overrun in week one. That paid for years of subscription in a single click."
            </p>
            <p className="mt-2 text-slate-500 text-sm not-italic">— GC Owner, St George Utah</p>
          </div>

          {/* Primary CTA */}
          <div className="mt-10">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-3 rounded-xl text-white font-bold shadow-2xl transition-all hover:opacity-90 hover:scale-105"
              style={{ backgroundColor: "#F97316", padding: "1rem 2.25rem", fontSize: "1.05rem" }}
            >
              Watch It Flag a Bad Invoice
              <ArrowRight className="h-5 w-5 shrink-0" />
            </Link>
            <p className="mt-3 text-sm text-slate-500">No login. Real GC project. 60-second walkthrough.</p>
          </div>

          {/* Trust badges */}
          <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-8">
            {[
              "No Credit Card Required",
              "Subcontractors Always Free",
              "Cancel Anytime",
            ].map((badge) => (
              <span key={badge} className="flex items-center gap-2 text-slate-500 text-sm">
                <Check className="h-4 w-4 text-green-500 shrink-0" strokeWidth={2.5} />
                {badge}
              </span>
            ))}
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 2 — WHERE YOUR MONEY LEAKS
      ══════════════════════════════════════════ */}
      <section className="bg-white py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
            The four places GCs quietly lose money on subs
          </h2>

          <ul className="mt-8 space-y-5">
            {[
              "Over-invoices that slip past tired eyes at 5:30pm.",
              "Change orders agreed in the hallway and never fully added to the contract.",
              "Payments released before lien waivers and certificates are actually in hand.",
              "Spreadsheets that only one person understands — until they're on vacation.",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-4">
                <div
                  className="mt-0.5 h-6 w-6 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                  style={{ backgroundColor: "hsl(221 83% 53%)" }}
                >
                  {i + 1}
                </div>
                <span className="text-slate-700 text-lg leading-snug">{item}</span>
              </li>
            ))}
          </ul>

          <p className="mt-10 text-slate-600 text-lg leading-relaxed">
            SubDraw turns all of that into one live scoreboard per subcontract so those mistakes have nowhere to hide.
          </p>

          <div className="mt-8">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl font-bold text-sm transition-all hover:bg-slate-100"
              style={{
                color: "hsl(221 83% 53%)",
                border: "2px solid hsl(221 83% 53%)",
                padding: "0.75rem 1.75rem",
              }}
            >
              See the Live Scoreboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 3 — WHAT SUBDRAW DOES
      ══════════════════════════════════════════ */}
      <section id="what-it-does" className="bg-slate-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight mb-14 max-w-2xl">
            Exactly what SubDraw does — no feature soup
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                num: "01",
                title: "Stops over-billing before it happens",
                body: "Every invoice is checked against the approved total. Anything over gets a red flag before your PM ever clicks approve, and any override requires a written reason you can see later.",
              },
              {
                num: "02",
                title: "Locks in change orders in writing",
                body: "Every change order is approved by the sub first and you second before it touches the contract. No more \"I thought that was included\" arguments three months later.",
              },
              {
                num: "03",
                title: "Makes lien waivers and compliance automatic",
                body: "Payments are tied to signed lien waivers and valid insurance and licenses. Green, yellow, and red badges tell you at a glance who is safe to pay.",
              },
            ].map((block) => (
              <div key={block.num} className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                <div className="text-3xl font-extrabold mb-4" style={{ color: "hsl(221 83% 80%)" }}>
                  {block.num}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-4 leading-snug">{block.title}</h3>
                <p className="text-slate-600 leading-relaxed">{block.body}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 4 — SEE IT ON A REAL JOB
      ══════════════════════════════════════════ */}
      <section className="bg-white py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
            Watch SubDraw catch a bad invoice on a real project
          </h2>

          <p className="mt-6 text-lg text-slate-600 leading-relaxed">
            We set up a live GC project with real numbers. In 2 minutes you will see:
          </p>

          <ul className="mt-6 space-y-4 text-left max-w-md mx-auto">
            {[
              "A sub invoice come in over the approved total.",
              "SubDraw flag it automatically before approval.",
              "The exact override note your PM would have to type to let it slide.",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <div
                  className="mt-0.5 h-5 w-5 rounded-full flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: "hsl(221 83% 53%)" }}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </div>
                <span className="text-slate-700 text-base">{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-3 rounded-xl text-white font-bold shadow-2xl transition-all hover:opacity-90 hover:scale-105"
              style={{ backgroundColor: "#F97316", padding: "1rem 2.25rem", fontSize: "1.05rem" }}
            >
              Open the Live GC Demo
              <ArrowRight className="h-5 w-5 shrink-0" />
            </Link>
            <p className="mt-3 text-sm text-slate-500">No account. No email. Click and see it work.</p>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 5 — PRICING
      ══════════════════════════════════════════ */}
      <section id="pricing" className="bg-slate-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Heading */}
          <div className="text-center mb-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">If it catches one overrun, it pays for itself</h2>
          </div>
          <p className="text-center text-slate-500 mb-10 text-sm max-w-xl mx-auto">
            Priced by active subcontracts — not seats, not projects. Subcontractors always free.
          </p>

          {/* Monthly / Annual toggle */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center gap-1 rounded-xl p-1" style={{ backgroundColor: "rgba(15,23,42,0.07)" }}>
              <button
                onClick={() => setBillingAnnual(false)}
                className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${!billingAnnual ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingAnnual(true)}
                className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${billingAnnual ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
              >
                Annual
                <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Save one month free</span>
              </button>
            </div>
          </div>

          {/* Plan cards — Professional first on mobile via CSS order */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
            {PLANS.map((plan) => {
              const orderClass = plan.name === "Professional"
                ? "order-first md:order-none"
                : plan.name === "Starter"
                ? "order-2 md:order-none"
                : "order-3 md:order-none";

              return (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl bg-white flex flex-col ${orderClass} ${
                    plan.popular
                      ? "border-2 shadow-2xl z-10 scale-[1.03] ring-4 ring-blue-500/15"
                      : "border border-slate-200 shadow-sm opacity-95"
                  }`}
                  style={plan.popular ? { borderColor: "hsl(221 83% 53%)" } : {}}
                >
                  {/* Most Popular badge */}
                  {plan.popular && (
                    <div
                      className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-xs font-bold text-white shadow-lg"
                      style={{ backgroundColor: "hsl(221 83% 53%)" }}
                    >
                      MOST POPULAR
                    </div>
                  )}

                  <div className={`p-7 flex flex-col flex-1 ${plan.popular ? "pt-9" : ""}`}>
                    {/* Plan name + description */}
                    <h3 className={`font-extrabold text-slate-900 mb-1 ${plan.popular ? "text-xl" : "text-base"}`}>{plan.name}</h3>
                    <p className="text-xs text-slate-500 mb-1">{plan.limit}</p>
                    <p className="text-sm text-slate-600 mb-1">{plan.description}</p>
                    <p className="text-xs text-slate-400 italic mb-5">{plan.roi}</p>

                    {/* Price */}
                    <div className="mb-1">
                      <span className={`font-extrabold text-slate-900 ${plan.popular ? "text-5xl" : "text-4xl"}`}>
                        ${billingAnnual ? plan.annual.toLocaleString() : plan.monthly}
                      </span>
                      <span className="text-slate-400 text-sm ml-1">{billingAnnual ? "/yr" : "/mo"}</span>
                    </div>
                    {billingAnnual ? (
                      <div className="flex items-center gap-2 mb-6">
                        <span className="text-xs text-slate-400">${plan.monthly}/mo equivalent</span>
                        <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Save one month free</span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mb-6">${plan.annual.toLocaleString()}/yr if billed annually</p>
                    )}

                    {/* Inclusions */}
                    <ul className="space-y-2 mb-7">
                      {[
                        "Unlimited team members — no per seat fees ever",
                        "All features included — nothing locked behind higher plans",
                        "Subcontractors always free",
                        "Cancel anytime",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                          <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" strokeWidth={2.5} />
                          {item}
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <Link
                      href="/signup"
                      className={`mt-auto w-full rounded-xl py-3 text-sm font-bold text-center block transition-all hover:opacity-90 hover:scale-[1.02] ${
                        plan.popular ? "text-white shadow-lg" : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                      style={plan.popular ? { backgroundColor: "hsl(221 83% 53%)" } : {}}
                    >
                      Start 14-Day Free Trial
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trust badges */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-slate-400">
            {["14-day free trial · all plans", "No credit card to start", "Cancel anytime", "Subs always free"].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-green-500" /> {item}
              </span>
            ))}
          </div>

          {/* Processing fee disclosure */}
          <p className="mt-6 text-center text-slate-400 text-xs">
            Payments processed through SubTracker include a 1% payment processing fee — less than half the cost of a credit card terminal. Subcontractors are always free on every plan.
          </p>

        </div>
      </section>

      {/* ══════════════════════════════════════════
          SECTION 6 — FINAL CTA (unchanged)
      ══════════════════════════════════════════ */}
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
              style={{ backgroundColor: "#F97316", padding: "1.1rem 2.5rem" }}
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
                SubDraw
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                The financial control layer between GCs and their subcontractors. Built by people who've been on job sites.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold text-xs mb-4 uppercase tracking-wider">Product</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Features", onClick: scrollTo("what-it-does"), href: "#what-it-does" },
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
                style={{ backgroundColor: "#F97316" }}
              >
                See Live Demo <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <div className="mt-3">
                <Link href="/signup" className="text-slate-400 hover:text-white text-sm transition-colors">Start Free Trial →</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-7 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} SubDraw. All rights reserved.</p>
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
            style={{ backgroundColor: "#F97316" }}
          >
            Watch It Flag a Bad Invoice <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

    </div>
  );
}
