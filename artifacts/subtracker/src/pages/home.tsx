import * as React from "react";
import { Link } from "wouter";
import { Menu, X, HardHat, ArrowRight, Check, ChevronRight } from "lucide-react";

const TEAL = "#00d4a8";
const TEAL_DARK = "#00b891";
const NAVY = "#0b1120";
const CHARCOAL = "#111827";

const PLANS = [
  {
    name: "Starter",
    monthly: 149,
    annual: 1639,
    limit: "Up to 10 active subcontracts",
    description: "For remodelers and small GCs getting started.",
    roi: "If SubDraw catches one invoice overrun this year, it paid for itself completely.",
    popular: false,
  },
  {
    name: "Professional",
    monthly: 299,
    annual: 3289,
    limit: "Up to 30 active subcontracts",
    description: "For GCs running two to four active jobs simultaneously.",
    roi: "One caught overrun on a single job covers your entire year of SubDraw.",
    popular: true,
  },
  {
    name: "Scale",
    monthly: 599,
    annual: 6589,
    limit: "Unlimited active subcontracts",
    description: "For serious GCs running multiple crews with no limits.",
    roi: "Unlimited protection across every job, every sub, every invoice, all year.",
    popular: false,
  },
];

const FEATURES = [
  {
    num: "01",
    title: "Flags over-invoices before you pay",
    body: "Every invoice is checked against the approved total the moment it's submitted. Anything over gets a red flag before your PM ever clicks approve — with a written override reason required if you still want to pay it.",
  },
  {
    num: "02",
    title: "Locks change orders in writing",
    body: "Every change order is approved by the sub first, then you. No more 'I thought that was included' arguments three months later. Every CO has a timestamp and a signature.",
  },
  {
    num: "03",
    title: "Makes compliance automatic",
    body: "Payments are tied to signed lien waivers and valid insurance certificates. Green, yellow, and red badges show at a glance who is safe to pay — and who isn't.",
  },
];

const PAIN_POINTS = [
  "Over-invoices that slip past tired eyes at 5:30pm.",
  "Change orders agreed in the hallway and never added to the contract.",
  "Payments released before lien waivers are actually in hand.",
  "Spreadsheets only one person understands — until they quit.",
];

const PROOF_STATS = [
  { num: "$5,450", label: "caught on one Pacific Electric invoice before payment" },
  { num: "$5,600", label: "in retainage tracked automatically, zero manual work" },
  { num: "100%", label: "invoiced visibility — GC knew exactly where they stood" },
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
    <div
      className="antialiased"
      style={{ fontFamily: "'Inter', system-ui, sans-serif", scrollBehavior: "smooth", color: "#e8ecf4" }}
    >
      {/* ── NAV ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(11,17,32,.97)" : NAVY,
          borderBottom: scrolled ? "1px solid rgba(255,255,255,.08)" : "none",
          backdropFilter: scrolled ? "blur(16px)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="#hero" onClick={scrollTo("hero")} className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
              <div className="h-8 w-8 rounded-lg flex items-center justify-center font-black text-sm" style={{ background: TEAL, color: "#000" }}>
                SD
              </div>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-.03em" }}>
                Sub<span style={{ color: TEAL }}>Draw</span>
              </span>
            </a>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" onClick={scrollTo("features")} style={{ color: "#6b7a96", fontSize: ".9rem", fontWeight: 500, textDecoration: "none", transition: "color .15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#e8ecf4")}
                onMouseLeave={e => (e.currentTarget.style.color = "#6b7a96")}>Features</a>
              <a href="#proof" onClick={scrollTo("proof")} style={{ color: "#6b7a96", fontSize: ".9rem", fontWeight: 500, textDecoration: "none", transition: "color .15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#e8ecf4")}
                onMouseLeave={e => (e.currentTarget.style.color = "#6b7a96")}>See It Work</a>
              <a href="#pricing" onClick={scrollTo("pricing")} style={{ color: "#6b7a96", fontSize: ".9rem", fontWeight: 500, textDecoration: "none", transition: "color .15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#e8ecf4")}
                onMouseLeave={e => (e.currentTarget.style.color = "#6b7a96")}>Pricing</a>
              <Link href="/login" style={{ color: "#e8ecf4", fontSize: ".85rem", fontWeight: 600, border: "1px solid rgba(255,255,255,.2)", borderRadius: 8, padding: "7px 16px", textDecoration: "none", transition: "all .15s" }}>Log In</Link>
              <Link
                href="/login"
                style={{ background: TEAL, color: "#000", fontWeight: 800, fontSize: ".9rem", borderRadius: 8, padding: "9px 20px", textDecoration: "none", transition: "all .15s", boxShadow: `0 4px 16px rgba(0,212,168,.3)` }}
              >
                Try It Free →
              </Link>
            </div>
            <button className="md:hidden p-2" style={{ background: "none", border: "none", cursor: "pointer", color: "#e8ecf4" }} onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div style={{ background: CHARCOAL, borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <div className="px-4 py-4 flex flex-col gap-3">
              <a href="#features" onClick={scrollTo("features")} style={{ color: "#6b7a96", fontWeight: 500, padding: "8px 0", textDecoration: "none" }}>Features</a>
              <a href="#proof" onClick={scrollTo("proof")} style={{ color: "#6b7a96", fontWeight: 500, padding: "8px 0", textDecoration: "none" }}>See It Work</a>
              <a href="#pricing" onClick={scrollTo("pricing")} style={{ color: "#6b7a96", fontWeight: 500, padding: "8px 0", textDecoration: "none" }}>Pricing</a>
              <Link href="/login" style={{ color: "#e8ecf4", border: "1px solid rgba(255,255,255,.2)", borderRadius: 10, padding: "12px 16px", textAlign: "center", fontWeight: 600, textDecoration: "none" }}>Log In</Link>
              <Link href="/login" style={{ background: TEAL, color: "#000", borderRadius: 10, padding: "14px 16px", textAlign: "center", fontWeight: 800, textDecoration: "none" }}>
                Try It Free — No Signup Required
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section id="hero" style={{ background: `radial-gradient(ellipse 80% 50% at 50% -5%, rgba(0,212,168,.12) 0%, transparent 70%), ${NAVY}`, paddingTop: 64 }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8" style={{ background: "rgba(0,212,168,.08)", border: "1px solid rgba(0,212,168,.2)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: TEAL, animation: "pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: ".75rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: TEAL }}>Invoice Protection for General Contractors</span>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: "clamp(2.4rem,6vw,4rem)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.04em", color: "#fff", marginBottom: 20, maxWidth: 820 }}>
            Your sub just invoiced $8,500 over their contract.<br />
            <span style={{ color: "#6b7a96" }}>Do you catch it — or pay it?</span>
          </h1>

          {/* Sub */}
          <p style={{ fontSize: "1.15rem", color: "#6b7a96", lineHeight: 1.7, maxWidth: 680, marginBottom: 32 }}>
            Most GCs only see overruns after the money is gone. SubDraw sits between you and your subs —
            flagging every over-invoice the second it's submitted, before anyone clicks approve.
          </p>

          {/* Testimonial */}
          <div style={{ borderLeft: `3px solid ${TEAL}`, paddingLeft: 20, marginBottom: 40, maxWidth: 580 }}>
            <p style={{ color: "#c8d0df", fontSize: ".95rem", fontStyle: "italic", lineHeight: 1.6 }}>
              "SubDraw caught a $12,000 overrun in week one. That paid for years of subscription in a single click."
            </p>
            <p style={{ color: "#4a5568", fontSize: ".8rem", marginTop: 8, fontStyle: "normal" }}>— GC Owner, St. George, Utah</p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <Link
              href="/login"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, background: TEAL, color: "#000", fontWeight: 800, fontSize: "1.05rem", borderRadius: 10, padding: "16px 32px", textDecoration: "none", boxShadow: `0 8px 24px rgba(0,212,168,.3)`, transition: "all .2s" }}
            >
              Watch It Flag a Bad Invoice
              <ArrowRight className="h-5 w-5 shrink-0" />
            </Link>
            <a
              href="#proof"
              onClick={scrollTo("proof")}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#6b7a96", fontWeight: 600, fontSize: ".95rem", borderRadius: 10, padding: "16px 24px", border: "1px solid rgba(255,255,255,.1)", textDecoration: "none", transition: "all .2s" }}
            >
              See a real catch →
            </a>
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap gap-6">
            {["No credit card required", "2-minute setup", "Used by GCs in CA & UT"].map((t) => (
              <span key={t} className="flex items-center gap-2" style={{ color: "#4a5568", fontSize: ".82rem" }}>
                <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "#00c87a" }} strokeWidth={2.5} />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── PAIN ── */}
      <section style={{ background: CHARCOAL, borderTop: "1px solid rgba(255,255,255,.06)", borderBottom: "1px solid rgba(255,255,255,.06)", padding: "80px 0" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 800, letterSpacing: "-.03em", color: "#fff", lineHeight: 1.2, marginBottom: 36 }}>
            The four places GCs quietly lose money on subs
          </h2>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 20, marginBottom: 40 }}>
            {PAIN_POINTS.map((item, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ minWidth: 28, height: 28, borderRadius: "50%", background: "rgba(0,212,168,.1)", border: "1px solid rgba(0,212,168,.2)", display: "flex", alignItems: "center", justifyContent: "center", color: TEAL, fontWeight: 800, fontSize: ".78rem", marginTop: 1 }}>
                  {i + 1}
                </div>
                <span style={{ color: "#9ca8bc", fontSize: "1.05rem", lineHeight: 1.6 }}>{item}</span>
              </li>
            ))}
          </ul>
          <p style={{ color: "#6b7a96", fontSize: "1rem", lineHeight: 1.7, marginBottom: 24 }}>
            SubDraw turns all of that into one live scoreboard per subcontract — so those mistakes have nowhere to hide.
          </p>
          <a href="#proof" onClick={scrollTo("proof")} style={{ display: "inline-flex", alignItems: "center", gap: 8, color: TEAL, fontWeight: 700, fontSize: ".9rem", textDecoration: "none" }}>
            See it catch a real error <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ background: NAVY, padding: "96px 0" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ marginBottom: 56 }}>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-4" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>
              <span style={{ fontSize: ".7rem", fontWeight: 700, color: "#6b7a96", textTransform: "uppercase", letterSpacing: ".1em" }}>What SubDraw Does</span>
            </div>
            <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 800, letterSpacing: "-.03em", color: "#fff", lineHeight: 1.2, maxWidth: 600 }}>
              Exactly what it does — no feature soup
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.num} style={{ background: "#161f30", border: "1px solid #1e2d45", borderRadius: 12, padding: "28px 24px", transition: "border-color .2s" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(0,212,168,.2)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e2d45")}>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: "rgba(0,212,168,.25)", fontFamily: "'JetBrains Mono', monospace", marginBottom: 16, letterSpacing: "-.04em" }}>{f.num}</div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#e8ecf4", marginBottom: 10, lineHeight: 1.4 }}>{f.title}</h3>
                <p style={{ color: "#6b7a96", fontSize: ".875rem", lineHeight: 1.7 }}>{f.body}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 48, padding: "28px 32px", background: "rgba(0,212,168,.05)", border: "1px solid rgba(0,212,168,.15)", borderRadius: 12 }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: "Invoice Flagging", desc: "Over-budget invoices flagged before approval" },
                { label: "Digital Lien Waivers", desc: "Collected automatically, tied to payment" },
                { label: "Retainage Tracking", desc: "Every dollar tracked, schedules generated in one click" },
                { label: "Change Order Audit Trail", desc: "Every CO logged with approval timestamps" },
                { label: "Lender-Ready Packages", desc: "Clean draw packages that get approved first time" },
                { label: "Sub Portal", desc: "Subs submit invoices, check payment status without calling you" },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <Check className="h-4 w-4 shrink-0 mt-0.5" style={{ color: TEAL }} strokeWidth={2.5} />
                  <div>
                    <div style={{ fontSize: ".875rem", fontWeight: 700, color: "#e8ecf4" }}>{item.label}</div>
                    <div style={{ fontSize: ".78rem", color: "#6b7a96", marginTop: 2 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PROOF ── */}
      <section id="proof" style={{ background: CHARCOAL, borderTop: "1px solid rgba(255,255,255,.06)", borderBottom: "1px solid rgba(255,255,255,.06)", padding: "96px 0" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left: copy */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-6" style={{ background: "rgba(255,59,92,.08)", border: "1px solid rgba(255,59,92,.2)" }}>
                <span style={{ fontSize: ".7rem", fontWeight: 700, color: "#ff3b5c", textTransform: "uppercase", letterSpacing: ".1em" }}>Real Product · Real Catch</span>
              </div>
              <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 800, letterSpacing: "-.03em", color: "#fff", lineHeight: 1.2, marginBottom: 16 }}>
                SubDraw caught this <span style={{ color: TEAL }}>before</span> Pacific Electric got paid
              </h2>
              <p style={{ color: "#6b7a96", fontSize: ".95rem", lineHeight: 1.7, marginBottom: 32 }}>
                Pacific Electric submitted $56,000 against an approved contract of $50,550.
                SubDraw flagged the overrun automatically — before anyone clicked approve.
                The GC sent it back. The invoice got corrected. $5,450 stayed in their pocket.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {PROOF_STATS.map((s) => (
                  <div key={s.num} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                    <div style={{ fontSize: "1.6rem", fontWeight: 800, color: TEAL, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-.03em", flexShrink: 0 }}>{s.num}</div>
                    <div style={{ fontSize: ".875rem", color: "#6b7a96" }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <Link
                href="/login"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: TEAL, color: "#000", fontWeight: 800, fontSize: ".9rem", borderRadius: 10, padding: "14px 24px", textDecoration: "none", marginTop: 32, boxShadow: `0 6px 20px rgba(0,212,168,.25)` }}
              >
                See It on Your Own Draw →
              </Link>
            </div>
            {/* Right: real screenshots */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: ".72rem", fontWeight: 700, color: "#ff3b5c", background: "rgba(255,59,92,.1)", border: "1px solid rgba(255,59,92,.2)", padding: "3px 10px", borderRadius: 100, textTransform: "uppercase", letterSpacing: ".06em" }}>
                    🚩 SubDraw flagged this automatically
                  </span>
                </div>
                <img
                  src="/screenshot-flagged.jpg"
                  alt="SubDraw Action Required dashboard — Pacific Electric invoice flagged before payment"
                  style={{ width: "100%", borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.06)", display: "block" }}
                  loading="lazy"
                />
              </div>
              <div>
                <img
                  src="/screenshot-financial.jpg"
                  alt="SubDraw Financial Scoreboard — Pacific Electric contract totals"
                  style={{ width: "100%", borderRadius: 10, boxShadow: "0 4px 24px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.06)", display: "block" }}
                  loading="lazy"
                />
                <p style={{ fontSize: ".72rem", color: "#4a5568", textAlign: "center", marginTop: 6 }}>
                  Financial Scoreboard — approved total vs invoiced, live
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DEMO CTA ── */}
      <section style={{ background: NAVY, padding: "80px 0" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 800, letterSpacing: "-.03em", color: "#fff", lineHeight: 1.2, marginBottom: 16 }}>
            Watch SubDraw catch a bad invoice on a real project
          </h2>
          <p style={{ color: "#6b7a96", fontSize: "1rem", lineHeight: 1.7, marginBottom: 28 }}>
            We set up a live GC project with real numbers. In 2 minutes you will see:
          </p>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, textAlign: "left", maxWidth: 440, margin: "0 auto 40px" }}>
            {["A sub invoice come in over the approved total.", "SubDraw flag it automatically before approval.", "The exact override note your PM would have to type to let it slide."].map((item, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ minWidth: 20, height: 20, borderRadius: "50%", background: TEAL, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0 }}>
                  <Check className="h-3 w-3" style={{ color: "#000" }} strokeWidth={3} />
                </div>
                <span style={{ color: "#9ca8bc", fontSize: ".95rem" }}>{item}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/login"
            style={{ display: "inline-flex", alignItems: "center", gap: 10, background: TEAL, color: "#000", fontWeight: 800, fontSize: "1.05rem", borderRadius: 10, padding: "18px 36px", textDecoration: "none", boxShadow: `0 8px 32px rgba(0,212,168,.3)` }}
          >
            Open the Live GC Demo
            <ArrowRight className="h-5 w-5 shrink-0" />
          </Link>
          <p style={{ marginTop: 12, color: "#4a5568", fontSize: ".82rem" }}>No account. No email. Click and see it work.</p>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ background: CHARCOAL, borderTop: "1px solid rgba(255,255,255,.06)", padding: "96px 0" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-4" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)" }}>
              <span style={{ fontSize: ".7rem", fontWeight: 700, color: "#6b7a96", textTransform: "uppercase", letterSpacing: ".1em" }}>Pricing</span>
            </div>
            <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.4rem)", fontWeight: 800, letterSpacing: "-.03em", color: "#fff" }}>
              Know Before You Pay
            </h2>
            <p style={{ color: "#6b7a96", fontSize: ".95rem", marginTop: 8, maxWidth: 480, margin: "8px auto 0" }}>
              Priced by active subcontracts — not seats, not projects. Subcontractors always free.
            </p>
          </div>

          {/* Toggle */}
          <div style={{ display: "flex", justifyContent: "center", margin: "32px 0" }}>
            <div style={{ display: "inline-flex", background: "rgba(255,255,255,.05)", borderRadius: 10, padding: 4 }}>
              {["Monthly", "Annual"].map((label) => {
                const isActive = label === "Annual" ? billingAnnual : !billingAnnual;
                return (
                  <button
                    key={label}
                    onClick={() => setBillingAnnual(label === "Annual")}
                    style={{ padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: ".875rem", fontWeight: 600, transition: "all .15s", background: isActive ? "#fff" : "transparent", color: isActive ? "#0b1120" : "#6b7a96", display: "flex", alignItems: "center", gap: 8 }}
                  >
                    {label}
                    {label === "Annual" && <span style={{ fontSize: ".65rem", fontWeight: 800, color: "#00c87a", background: "rgba(0,200,122,.1)", border: "1px solid rgba(0,200,122,.2)", padding: "2px 7px", borderRadius: 100 }}>Save 1 month</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                style={{
                  background: plan.popular ? "rgba(0,212,168,.04)" : "#161f30",
                  border: plan.popular ? `2px solid ${TEAL}` : "1px solid #1e2d45",
                  borderRadius: 14,
                  padding: plan.popular ? "36px 28px 28px" : "28px",
                  position: "relative",
                  transform: plan.popular ? "scale(1.02)" : "none",
                }}
              >
                {plan.popular && (
                  <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: TEAL, color: "#000", fontSize: ".65rem", fontWeight: 800, padding: "4px 14px", borderRadius: 100, letterSpacing: ".08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    Most Popular
                  </div>
                )}
                <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#e8ecf4", marginBottom: 4 }}>{plan.name}</div>
                <div style={{ fontSize: ".78rem", color: "#6b7a96", marginBottom: 6 }}>{plan.limit}</div>
                <div style={{ fontSize: ".85rem", color: "#6b7a96", marginBottom: 6 }}>{plan.description}</div>
                <div style={{ fontSize: ".8rem", color: "#4a5568", fontStyle: "italic", marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid rgba(255,255,255,.06)" }}>{plan.roi}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: "2.4rem", fontWeight: 800, color: "#e8ecf4", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-.04em" }}>
                    ${billingAnnual ? plan.annual.toLocaleString() : plan.monthly}
                  </span>
                  <span style={{ color: "#6b7a96", fontSize: ".85rem" }}>{billingAnnual ? "/yr" : "/mo"}</span>
                </div>
                {billingAnnual
                  ? <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}><span style={{ fontSize: ".72rem", color: "#4a5568" }}>${plan.monthly}/mo equivalent</span><span style={{ fontSize: ".65rem", fontWeight: 800, color: "#00c87a", background: "rgba(0,200,122,.1)", border: "1px solid rgba(0,200,122,.2)", padding: "2px 7px", borderRadius: 100 }}>Save 1 month free</span></div>
                  : <div style={{ fontSize: ".72rem", color: "#4a5568", marginBottom: 20 }}>${plan.annual.toLocaleString()}/yr billed annually</div>
                }
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 9, marginBottom: 24 }}>
                  {["Unlimited team members — no per seat fees ever", "All features included — nothing locked behind higher plans", "Subcontractors always free", "Cancel anytime"].map((item) => (
                    <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: ".85rem", color: "#6b7a96" }}>
                      <Check className="h-4 w-4 shrink-0 mt-0.5" style={{ color: TEAL }} strokeWidth={2.5} />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  style={{ display: "block", width: "100%", textAlign: "center", borderRadius: 9, padding: "12px", fontSize: ".9rem", fontWeight: 700, textDecoration: "none", background: plan.popular ? TEAL : "transparent", color: plan.popular ? "#000" : "#6b7a96", border: plan.popular ? "none" : "1px solid #263552", transition: "all .15s" }}
                >
                  Start Free →
                </Link>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", color: "#4a5568", fontSize: ".8rem", marginTop: 24 }}>
            All plans include a free first draw review. No credit card required to start.
          </p>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ background: `radial-gradient(ellipse 100% 100% at 50% 100%, rgba(0,212,168,.1) 0%, transparent 70%), ${NAVY}`, borderTop: "1px solid rgba(255,255,255,.06)", padding: "96px 0", textAlign: "center" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-7" style={{ background: "rgba(0,212,168,.08)", border: "1px solid rgba(0,212,168,.2)" }}>
            <span style={{ fontSize: ".7rem", fontWeight: 700, color: TEAL, textTransform: "uppercase", letterSpacing: ".1em" }}>Free to Try</span>
          </div>
          <h2 style={{ fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 800, letterSpacing: "-.04em", color: "#fff", lineHeight: 1.1, marginBottom: 16 }}>
            Stop guessing.<br />
            <span style={{ color: TEAL }}>Start knowing.</span>
          </h2>
          <p style={{ color: "#6b7a96", fontSize: "1.05rem", lineHeight: 1.7, maxWidth: 520, margin: "0 auto 40px" }}>
            See a real flagged invoice in 60 seconds. No signup. No credit card. No sales call.
          </p>
          <Link
            href="/login"
            style={{ display: "inline-flex", alignItems: "center", gap: 10, background: TEAL, color: "#000", fontWeight: 800, fontSize: "1.1rem", borderRadius: 12, padding: "18px 40px", textDecoration: "none", boxShadow: `0 10px 40px rgba(0,212,168,.35)` }}
          >
            Check My First Draw Free →
          </Link>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 24, marginTop: 20 }}>
            {["No credit card", "2-minute setup", "Free first draw review", "GCs in CA & UT"].map((t) => (
              <span key={t} style={{ fontSize: ".78rem", color: "#4a5568", display: "flex", alignItems: "center", gap: 6 }}>
                <Check className="h-3 w-3 shrink-0" style={{ color: "#00c87a" }} />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: CHARCOAL, borderTop: "1px solid rgba(255,255,255,.06)", padding: "48px 0 24px" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 7, background: TEAL, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: ".85rem", color: "#000" }}>SD</div>
                <span style={{ fontWeight: 800, color: "#fff", fontSize: "1.1rem", letterSpacing: "-.03em" }}>Sub<span style={{ color: TEAL }}>Draw</span></span>
              </div>
              <p style={{ color: "#4a5568", fontSize: ".875rem", lineHeight: 1.7, maxWidth: 260 }}>
                Invoice protection and draw management for general contractors. Built so you know before you pay.
              </p>
            </div>
            <div>
              <h4 style={{ color: "#fff", fontWeight: 700, fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 14 }}>Product</h4>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
                {[{ label: "Features", href: "#features", onClick: scrollTo("features") }, { label: "Pricing", href: "#pricing", onClick: scrollTo("pricing") }, { label: "See Demo", href: "/login", onClick: undefined }, { label: "Log In", href: "/login", onClick: undefined }].map((link) => (
                  <li key={link.label}>
                    {link.onClick
                      ? <a href={link.href} onClick={link.onClick} style={{ color: "#4a5568", fontSize: ".875rem", textDecoration: "none", transition: "color .15s" }}>{link.label}</a>
                      : <Link href={link.href} style={{ color: "#4a5568", fontSize: ".875rem", textDecoration: "none", transition: "color .15s" }}>{link.label}</Link>
                    }
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 style={{ color: "#fff", fontWeight: 700, fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 14 }}>Get Started</h4>
              <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: TEAL, color: "#000", fontWeight: 800, fontSize: ".875rem", borderRadius: 8, padding: "10px 18px", textDecoration: "none" }}>
                Try It Free <ArrowRight className="h-4 w-4" />
              </Link>
              <div style={{ marginTop: 12 }}>
                <a href="mailto:hello@subdraw.com" style={{ color: "#4a5568", fontSize: ".875rem", textDecoration: "none" }}>hello@subdraw.com</a>
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 20, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: ".75rem", color: "#4a5568" }}>
            <span>© {new Date().getFullYear()} SubDraw. All rights reserved.</span>
            <div style={{ display: "flex", gap: 20 }}>
              <a href="#" style={{ color: "#4a5568", textDecoration: "none" }}>Privacy</a>
              <a href="#" style={{ color: "#4a5568", textDecoration: "none" }}>Terms</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ── MOBILE STICKY CTA ── */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{ transition: "all .3s", transform: pastHero ? "translateY(0)" : "translateY(100%)", opacity: pastHero ? 1 : 0, background: "linear-gradient(to top, rgba(11,17,32,.98) 80%, transparent)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div style={{ padding: "12px 16px" }}>
          <Link
            href="/login"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: TEAL, color: "#000", fontWeight: 800, fontSize: ".9rem", borderRadius: 10, padding: "14px", textDecoration: "none" }}
          >
            Watch It Flag a Bad Invoice <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0,212,168,.5); }
          60% { opacity: .7; box-shadow: 0 0 0 5px rgba(0,212,168,0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: .01ms !important; transition-duration: .01ms !important; }
        }
      `}</style>
    </div>
  );
}
