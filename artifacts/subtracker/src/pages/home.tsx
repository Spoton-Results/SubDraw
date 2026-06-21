import * as React from "react";
import { Link } from "wouter";
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { Menu, X, ArrowRight, Check, ChevronRight, AlertTriangle, CheckCircle, Clock, FileText, Shield, TrendingUp, DollarSign, Zap } from "lucide-react";

/* ── BRAND TOKENS ─────────────────────────────────────────────────────────── */
const T = {
  teal:    "#00d4a8",
  tealD:   "#00b891",
  tealDim: "rgba(0,212,168,.08)",
  tealBrd: "rgba(0,212,168,.18)",
  navy:    "#080e1c",
  card:    "#0d1525",
  card2:   "#111d30",
  border:  "#182135",
  border2: "#1f2d47",
  text:    "#e8ecf4",
  muted:   "#8899b4",
  hint:    "#5c7090",
  green:   "#00c87a",
  amber:   "#f5a623",
  red:     "#ff3b5c",
};

/* ── ANIMATED COUNTER ─────────────────────────────────────────────────────── */
function Counter({ value, prefix = "", suffix = "", decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => `${prefix}${decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString()}${suffix}`);

  React.useEffect(() => {
    if (isInView) animate(mv, value, { duration: 1.4, ease: "easeOut" });
  }, [isInView, value]);

  return <motion.span ref={ref} style={{ display: "inline" }}>{display}</motion.span>;
}

/* ── FADE-UP WRAPPER ──────────────────────────────────────────────────────── */
function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── PRODUCT UI MOCKUP — HERO ─────────────────────────────────────────────── */
function HeroMockup() {
  const invoices = [
    { sub: "Pacific Electric", trade: "Electrical", amount: "$56,000", budget: 108, status: "flagged", flag: "Overbilled $5,450" },
    { sub: "Summit HVAC", trade: "Mechanical", amount: "$74,200", budget: 95, status: "review", flag: "Work incomplete" },
    { sub: "Ironclad Steel", trade: "Structural", amount: "$98,500", budget: 82, status: "approved", flag: "" },
    { sub: "Concrete Plus", trade: "Concrete", amount: "$56,800", budget: 61, status: "approved", flag: "" },
  ];

  const statusColor = { flagged: T.red, review: T.amber, approved: T.green };
  const statusLabel = { flagged: "FLAGGED", review: "REVIEW", approved: "APPROVED" };
  const barColor = { flagged: T.red, review: T.amber, approved: T.green };

  return (
    <div style={{ background: T.card, borderRadius: 16, overflow: "hidden", boxShadow: `0 32px 80px rgba(0,0,0,.6), 0 0 0 1px ${T.border}`, fontFamily: "'Inter', sans-serif" }}>
      {/* Browser chrome */}
      <div style={{ background: "#060b14", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["#ff3b5c","#f5a623","#00c87a"].map((c,i) => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
        </div>
        <div style={{ flex: 1, background: T.border, borderRadius: 5, padding: "4px 12px", fontSize: 11, color: T.muted, fontFamily: "monospace", marginLeft: 8 }}>
          app.subdraw.com/projects/highland-tower
        </div>
      </div>
      {/* App layout */}
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", minHeight: 420 }}>
        {/* Sidebar */}
        <div style={{ background: "#090f1d", borderRight: `1px solid ${T.border}`, padding: "16px 0" }}>
          <div style={{ padding: "0 14px 14px", borderBottom: `1px solid ${T.border}`, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, background: T.teal, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#000" }}>SD</div>
              <span style={{ fontWeight: 800, fontSize: 13, color: T.text, letterSpacing: "-.02em" }}>Sub<span style={{ color: T.teal }}>Draw</span></span>
            </div>
          </div>
          {[["📊", "Highland Tower", true],["🏢", "Elm Street Plaza", false],["🏗️", "Riverside HQ", false]].map(([icon, name, active], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", margin: "1px 6px", borderRadius: 6, background: active ? T.tealDim : "transparent", fontSize: 11, color: active ? T.teal : T.muted, fontWeight: active ? 600 : 400, cursor: "default" }}>
              <span style={{ fontSize: 12 }}>{icon}</span>{name as string}
            </div>
          ))}
          <div style={{ padding: "8px 14px 3px", fontSize: 9, fontWeight: 700, color: T.hint, textTransform: "uppercase", letterSpacing: ".1em", marginTop: 8 }}>Review</div>
          {[["🧾", "Invoices", "3"],["📋", "Change Orders", ""],["🔒", "Retainage", ""],["📄", "Lien Waivers", "2"]].map(([icon, label, badge], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", margin: "1px 6px", borderRadius: 6, fontSize: 11, color: T.muted, cursor: "default" }}>
              <span style={{ fontSize: 11 }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {badge && <span style={{ background: T.red, color: "#fff", fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 100 }}>{badge}</span>}
            </div>
          ))}
        </div>
        {/* Main */}
        <div style={{ padding: 20, background: "#0b1322" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Highland Tower — Draw Review</div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>Updated 2 min ago · 14 active subs · <span style={{ color: T.red }}>3 flagged for review</span></div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ padding: "5px 10px", borderRadius: 5, border: `1px solid ${T.border2}`, fontSize: 10, fontWeight: 600, color: T.muted, cursor: "default" }}>Export</div>
              <div style={{ padding: "5px 10px", borderRadius: 5, background: T.teal, fontSize: 10, fontWeight: 700, color: "#000", cursor: "default" }}>Approve Clean →</div>
            </div>
          </div>
          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Draw Total", val: "$387K", sub: "⚠ 3 flagged", subColor: T.red },
              { label: "Errors Caught", val: "$22.4K", sub: "before payment", subColor: T.green },
              { label: "Lien Waivers", val: "8/11", sub: "3 pending", subColor: T.amber },
              { label: "Clean to Pay", val: "$364K", sub: "10 approved", subColor: T.green },
            ].map((k, i) => (
              <div key={i} style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.text, fontFamily: "monospace", letterSpacing: "-.02em" }}>{k.val}</div>
                <div style={{ fontSize: 9, color: k.subColor, marginTop: 3 }}>{k.sub}</div>
              </div>
            ))}
          </div>
          {/* Invoice table */}
          <div style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "9px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.text }}>Pending Invoice Approvals</div>
              <div style={{ background: "rgba(255,59,92,.1)", border: "1px solid rgba(255,59,92,.2)", color: T.red, fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 3, textTransform: "uppercase", letterSpacing: ".06em" }}>3 Errors Found</div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead>
                <tr style={{ background: "#070d1a" }}>
                  {["Subcontractor","Trade","Amount","Budget Used","Flag","Status"].map(h => (
                    <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".07em", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => {
                  const sc = statusColor[inv.status as keyof typeof statusColor];
                  const sl = statusLabel[inv.status as keyof typeof statusLabel];
                  const bc = barColor[inv.status as keyof typeof barColor];
                  return (
                    <tr key={i} style={{ borderBottom: i < invoices.length - 1 ? `1px solid ${T.border}` : "none" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: T.text }}>{inv.sub}</td>
                      <td style={{ padding: "8px 12px", color: T.muted }}>{inv.trade}</td>
                      <td style={{ padding: "8px 12px", fontFamily: "monospace", color: T.text }}>{inv.amount}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ width: 60, height: 4, background: T.border, borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(inv.budget, 100)}%`, height: "100%", background: bc, borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 9, fontFamily: "monospace", color: inv.budget > 100 ? T.red : inv.budget > 90 ? T.amber : T.muted, fontWeight: inv.budget > 90 ? 700 : 400 }}>{inv.budget}%</span>
                        </div>
                      </td>
                      <td style={{ padding: "8px 12px", fontSize: 9, color: inv.flag ? sc : T.muted }}>{inv.flag || "—"}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ background: `${sc}18`, border: `1px solid ${sc}40`, color: sc, fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 3, textTransform: "uppercase", letterSpacing: ".07em" }}>{sl}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── SCOREBOARD MOCKUP ────────────────────────────────────────────────────── */
function ScoreboardMockup() {
  const subs = [
    { name: "Pacific Electric", trade: "Electrical", contract: 45000, co: 5550, invoiced: 56000, remaining: 150, ins: "valid" },
    { name: "ProDrywall Solutions", trade: "Drywall", contract: 32000, co: 5350, invoiced: 17000, remaining: 20350, ins: "expired" },
    { name: "Summit HVAC", trade: "Mechanical", contract: 28000, co: 5900, invoiced: 15000, remaining: 18900, ins: "valid" },
  ];

  return (
    <div style={{ background: T.card, borderRadius: 14, overflow: "hidden", boxShadow: `0 24px 60px rgba(0,0,0,.5), 0 0 0 1px ${T.border}` }}>
      <div style={{ background: "#060b14", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["#ff3b5c","#f5a623","#00c87a"].map((c,i) => <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />)}
        </div>
        <div style={{ flex: 1, background: T.border, borderRadius: 4, padding: "3px 10px", fontSize: 10, color: T.muted, fontFamily: "monospace", marginLeft: 6 }}>
          app.subdraw.com/projects/harbor-view
        </div>
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>Live Financial Scoreboard</div>
        <div style={{ fontSize: 10, color: T.muted, marginBottom: 14 }}>Harbor View Office Renovation · 3 active subcontracts</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {subs.map((sub, i) => (
            <div key={i} style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{sub.name}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, background: "rgba(61,139,255,.1)", border: "1px solid rgba(61,139,255,.2)", color: "#3d8bff", padding: "1px 7px", borderRadius: 100 }}>{sub.trade}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, background: sub.ins === "valid" ? "rgba(0,200,122,.1)" : "rgba(255,59,92,.1)", border: `1px solid ${sub.ins === "valid" ? "rgba(0,200,122,.2)" : "rgba(255,59,92,.2)"}`, color: sub.ins === "valid" ? T.green : T.red, padding: "1px 7px", borderRadius: 100 }}>
                      Ins: {sub.ins === "valid" ? "Valid" : "Expired"}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: ".07em" }}>Remaining</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: sub.remaining < 500 ? T.amber : T.green, fontFamily: "monospace", letterSpacing: "-.02em" }}>${sub.remaining.toLocaleString()}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, fontSize: 10 }}>
                {[
                  { l: "Base Contract", v: `$${sub.contract.toLocaleString()}` },
                  { l: "Change Orders", v: `+$${sub.co.toLocaleString()}` },
                  { l: "Approved Total", v: `$${(sub.contract + sub.co).toLocaleString()}` },
                  { l: "Total Invoiced", v: `$${sub.invoiced.toLocaleString()}` },
                ].map(({ l, v }, j) => (
                  <div key={j}>
                    <div style={{ fontSize: 9, color: T.muted, marginBottom: 2 }}>{l}</div>
                    <div style={{ fontWeight: 700, color: T.text, fontFamily: "monospace" }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, height: 3, background: T.border, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${Math.min((sub.invoiced / (sub.contract + sub.co)) * 100, 100)}%`, height: "100%", background: sub.invoiced > (sub.contract + sub.co) ? T.red : T.teal, borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 9, color: T.muted, marginTop: 3 }}>{Math.round((sub.invoiced / (sub.contract + sub.co)) * 100)}% invoiced of approved total</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: "12px 14px", background: T.hint, border: `1px solid ${T.border2}`, borderRadius: 8, fontSize: 10 }}>
          <div style={{ fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".07em", fontSize: 9, marginBottom: 6 }}>Totals — 3 Subcontracts</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {[["Base Contracts","$105,000"],["Change Orders","$16,800"],["Approved Total","$121,800"],["Total Invoiced","$88,000"]].map(([l,v],i) => (
              <div key={i}>
                <div style={{ fontSize: 9, color: T.muted, marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: T.text, fontFamily: "monospace" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ACTION REQUIRED MOCKUP ──────────────────────────────────────────────── */
function ActionMockup() {
  return (
    <div style={{ background: T.card, borderRadius: 14, overflow: "hidden", boxShadow: `0 24px 60px rgba(0,0,0,.5), 0 0 0 1px ${T.border}` }}>
      <div style={{ background: "#060b14", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["#ff3b5c","#f5a623","#00c87a"].map((c,i) => <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />)}
        </div>
        <div style={{ flex: 1, background: T.border, borderRadius: 4, padding: "3px 10px", fontSize: 10, color: T.muted, fontFamily: "monospace", marginLeft: 6 }}>
          app.subdraw.com/action-required
        </div>
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Action Required</div>
          <div style={{ background: T.red, color: "#fff", fontSize: 10, fontWeight: 800, width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>1</div>
        </div>
        {/* Urgent item */}
        <div style={{ background: "rgba(255,59,92,.06)", border: "1px solid rgba(255,59,92,.2)", borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: T.red, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>⚡ Urgent — 1 Item</div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 3 }}>Pacific Electric overbilled by $5,450</div>
              <div style={{ fontSize: 10, color: T.muted }}>Invoice #E-003 exceeds approved contract by 10.8%. Review required before payment.</div>
              <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                <div style={{ padding: "5px 12px", background: T.red, borderRadius: 5, fontSize: 10, fontWeight: 700, color: "#fff", cursor: "default" }}>Review Invoice</div>
                <div style={{ padding: "5px 12px", border: `1px solid ${T.border2}`, borderRadius: 5, fontSize: 10, fontWeight: 600, color: T.muted, cursor: "default" }}>Override (reason required)</div>
              </div>
            </div>
            <div style={{ background: "rgba(255,59,92,.1)", border: "1px solid rgba(255,59,92,.2)", borderRadius: 8, padding: "8px 12px", textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: T.red, marginBottom: 2 }}>Overbilled</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.red, fontFamily: "monospace" }}>$5,450</div>
            </div>
          </div>
        </div>
        {/* Pending items */}
        <div style={{ fontSize: 9, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>Pending — 2 Items</div>
        {[
          { label: "Summit HVAC lien waiver overdue", sub: "Payment approved · waiver not returned · 8 days", color: T.amber },
          { label: "ProDrywall insurance certificate expired", sub: "Cannot process payment until renewed", color: T.amber },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, marginTop: 3, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{item.label}</div>
              <div style={{ fontSize: 9, color: T.muted, marginTop: 2 }}>{item.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── PLANS ────────────────────────────────────────────────────────────────── */
const PLANS = [
  { name: "Starter", monthly: 149, annual: 1639, limit: "Up to 10 active subcontracts", desc: "For remodelers and small GCs getting started.", roi: "If SubDraw catches one invoice overrun this year, it paid for itself completely.", popular: false },
  { name: "Professional", monthly: 299, annual: 3289, limit: "Up to 30 active subcontracts", desc: "For GCs running two to four active jobs simultaneously.", roi: "One caught overrun on a single job covers your entire year of SubDraw.", popular: true },
  { name: "Scale", monthly: 599, annual: 6589, limit: "Unlimited active subcontracts", desc: "For serious GCs running multiple crews with no limits.", roi: "Unlimited protection across every job, every sub, every invoice, all year.", popular: false },
];

/* ── HOME PAGE ─────────────────────────────────────────────────────────────── */
export default function Home() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [pastHero, setPastHero] = React.useState(false);
  const [billing, setBilling] = React.useState<"monthly"|"annual">("monthly");

  React.useEffect(() => {
    const fn = () => { setScrolled(window.scrollY > 40); setPastHero(window.scrollY > 600); };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const goto = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const navStyle: React.CSSProperties = {
    position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
    transition: "all .3s",
    background: scrolled ? "rgba(8,14,28,.96)" : T.navy,
    borderBottom: scrolled ? `1px solid ${T.border}` : "none",
    backdropFilter: scrolled ? "blur(20px)" : "none",
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: T.navy, color: T.text, overflowX: "hidden" }}>

      {/* ═══ NAV ═══════════════════════════════════════════════════════════ */}
      <nav style={navStyle}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <a href="#hero" onClick={goto("hero")} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, background: T.teal, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11, color: "#000", letterSpacing: "-.02em" }}>SD</div>
            <span style={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-.04em", color: T.text }}>Sub<span style={{ color: T.teal }}>Draw</span></span>
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }} className="hidden md:flex">
            {[["Features","features"],["How It Works","how"],["Proof","proof"],["Pricing","pricing"]].map(([l,id]) => (
              <a key={id} href={`#${id}`} onClick={goto(id)} style={{ color: T.muted, fontSize: ".875rem", fontWeight: 500, textDecoration: "none", transition: "color .15s", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>{l}</a>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }} className="hidden md:flex">
            <Link href="/login" style={{ color: T.muted, fontSize: ".875rem", fontWeight: 500, textDecoration: "none", padding: "7px 14px", border: `1px solid ${T.border2}`, borderRadius: 7, transition: "all .15s" }}>Log In</Link>
            <Link href="/login" style={{ background: T.teal, color: "#000", fontSize: ".875rem", fontWeight: 800, textDecoration: "none", padding: "9px 20px", borderRadius: 8, boxShadow: `0 4px 16px rgba(0,212,168,.3)`, transition: "all .2s" }}>
              Try It Free →
            </Link>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: T.text, padding: 6 }} className="md:hidden">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <div style={{ background: T.card, borderTop: `1px solid ${T.border}` }}>
            <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              {[["Features","features"],["Proof","proof"],["Pricing","pricing"]].map(([l,id]) => (
                <a key={id} href={`#${id}`} onClick={goto(id)} style={{ color: T.muted, fontWeight: 500, textDecoration: "none", padding: "8px 0" }}>{l}</a>
              ))}
              <Link href="/login" style={{ border: `1px solid ${T.border2}`, borderRadius: 9, padding: "12px", textAlign: "center", fontWeight: 600, color: T.text, textDecoration: "none" }}>Log In</Link>
              <Link href="/login" style={{ background: T.teal, borderRadius: 9, padding: "14px", textAlign: "center", fontWeight: 800, color: "#000", textDecoration: "none" }}>Try It Free →</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ═══ HERO ═══════════════════════════════════════════════════════════ */}
      <section id="hero" style={{ paddingTop: 60, background: `radial-gradient(ellipse 100% 60% at 50% -10%, rgba(0,212,168,.1) 0%, transparent 65%), ${T.navy}`, overflow: "hidden" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px 0" }}>
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }} style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: T.tealDim, border: `1px solid ${T.tealBrd}`, borderRadius: 100, padding: "6px 16px" }}>
              <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2 }} style={{ width: 6, height: 6, borderRadius: "50%", background: T.teal }} />
              <span style={{ fontSize: ".72rem", fontWeight: 700, color: T.teal, textTransform: "uppercase", letterSpacing: ".1em" }}>Invoice Protection for General Contractors</span>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay: .1 }}
            style={{ fontSize: "clamp(2.4rem,5.5vw,4rem)", fontWeight: 800, lineHeight: 1.06, letterSpacing: "-.05em", textAlign: "center", color: "#fff", marginBottom: 20 }}>
            Your sub just invoiced $8,500<br />
            <span style={{ color: T.muted }}>over their contract.</span>
          </motion.h1>
          <motion.h2 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay: .18 }}
            style={{ fontSize: "clamp(1.6rem,3vw,2.4rem)", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-.04em", textAlign: "center", color: T.teal, marginBottom: 28 }}>
            Do you catch it — or pay it?
          </motion.h2>

          {/* Sub */}
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, delay: .26 }}
            style={{ fontSize: "1.1rem", color: T.muted, textAlign: "center", maxWidth: 620, margin: "0 auto 40px", lineHeight: 1.7 }}>
            SubDraw sits between you and your subs — flagging every over-invoice the second it's submitted, before anyone clicks approve. Most GCs catch $8–15K per job.
          </motion.p>

          {/* Testimonial */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, delay: .32 }}
            style={{ maxWidth: 540, margin: "0 auto 40px", borderLeft: `3px solid ${T.teal}`, paddingLeft: 20 }}>
            <p style={{ color: "#c0cce0", fontSize: ".95rem", fontStyle: "italic", lineHeight: 1.65 }}>
              "SubDraw caught a $12,000 overrun in week one. That paid for years of subscription in a single click."
            </p>
            <p style={{ color: T.muted, fontSize: ".78rem", marginTop: 8 }}>— GC Owner, St. George, Utah</p>
          </motion.div>

          {/* CTAs */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, delay: .38 }}
            style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
            <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: T.teal, color: "#000", fontWeight: 800, fontSize: "1rem", borderRadius: 10, padding: "16px 32px", textDecoration: "none", boxShadow: `0 8px 32px rgba(0,212,168,.35)` }}>
              Watch It Flag a Bad Invoice
              <ArrowRight size={18} strokeWidth={2.5} />
            </Link>
            <a href="#proof" onClick={goto("proof")} style={{ display: "inline-flex", alignItems: "center", gap: 8, color: T.muted, fontWeight: 600, fontSize: ".95rem", borderRadius: 10, padding: "16px 24px", border: `1px solid ${T.border2}`, textDecoration: "none" }}>
              See a real catch <ChevronRight size={16} />
            </a>
          </motion.div>

          {/* Trust */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .5, delay: .45 }}
            style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", marginBottom: 64 }}>
            {["No credit card required","2-minute setup","Used by GCs in CA & UT"].map(t => (
              <span key={t} style={{ display: "flex", alignItems: "center", gap: 6, color: T.muted, fontSize: ".8rem" }}>
                <Check size={13} style={{ color: T.green }} strokeWidth={2.5} />{t}
              </span>
            ))}
          </motion.div>

          {/* Hero mockup */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, delay: .5, ease: [0.4, 0, 0.2, 1] }}
            style={{ maxWidth: 960, margin: "0 auto", position: "relative" }}>
            <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 700, height: 300, background: "radial-gradient(ellipse at center, rgba(0,212,168,.1) 0%, transparent 70%)", pointerEvents: "none" }} />
            <HeroMockup />
          </motion.div>
        </div>
      </section>

      {/* ═══ STATS BAR ══════════════════════════════════════════════════════ */}
      <section style={{ background: T.card, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: "48px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 32, textAlign: "center" }}>
          {[
            { num: 8000, prefix: "$", suffix: "+", label: "Avg caught per draw" },
            { num: 73, suffix: "%", label: "Fewer invoice disputes" },
            { num: 4, suffix: "×", label: "Faster draw approvals" },
            { num: 2, suffix: " min", label: "To your first review" },
          ].map((s, i) => (
            <FadeUp key={i} delay={i * .08}>
              <div style={{ fontSize: "2.4rem", fontWeight: 800, color: T.teal, fontFamily: "monospace", letterSpacing: "-.04em", lineHeight: 1 }}>
                <Counter value={s.num} prefix={s.prefix || ""} suffix={s.suffix || ""} />
              </div>
              <div style={{ fontSize: ".82rem", color: T.muted, marginTop: 6 }}>{s.label}</div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ═══ PAIN ══════════════════════════════════════════════════════════ */}
      <section style={{ background: T.navy, padding: "96px 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <FadeUp>
            <div style={{ marginBottom: 56 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.04)", border: `1px solid ${T.border2}`, borderRadius: 100, padding: "4px 14px", marginBottom: 16 }}>
                <span style={{ fontSize: ".68rem", fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em" }}>The Problem</span>
              </div>
              <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.6rem)", fontWeight: 800, letterSpacing: "-.04em", color: "#fff", lineHeight: 1.2, maxWidth: 600 }}>
                Four places GCs quietly<br />lose money on subs
              </h2>
            </div>
          </FadeUp>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 14 }}>
            {[
              { icon: <AlertTriangle size={18} />, title: "Over-invoices you miss", desc: "Invoice hits the same day the draw is due. You're reviewing 12 subs across 3 jobs. You approve it. Find out later they billed for work that wasn't done.", stat: "$6,200 avg per incident" },
              { icon: <FileText size={18} />, title: "Duplicate charges", desc: "Same line item submitted twice under different framing. Easy to miss when you're moving fast. Impossible to claw back once paid.", stat: "$3,800 avg per duplicate" },
              { icon: <TrendingUp size={18} />, title: "Overruns approved by accident", desc: "By the time you notice a sub is over budget, you've already signed off on three invoices you shouldn't have.", stat: "$11K avg by discovery" },
              { icon: <Shield size={18} />, title: "Lender draw rejections", desc: "One missing lien waiver, one number that doesn't match. Draw rejected. On an $800K monthly draw, a 5-day delay is real money sitting idle.", stat: "3–5 days avg delay" },
              { icon: <Clock size={18} />, title: "Compliance blindspots", desc: "Subs with expired insurance or no license on file. You pay them. Then you find out when something goes wrong on site.", stat: "Unlimited liability" },
              { icon: <DollarSign size={18} />, title: "\"Where's my check?\"", desc: "Subs call your office weekly chasing payment status because there's no visibility. You lose good subs when you can't answer fast.", stat: "Good subs walk" },
            ].map((p, i) => (
              <FadeUp key={i} delay={i * .06}>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, height: "100%", transition: "border-color .2s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = T.border2)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}>
                  <div style={{ color: T.teal, marginBottom: 14 }}>{p.icon}</div>
                  <div style={{ fontSize: ".95rem", fontWeight: 700, color: T.text, marginBottom: 8 }}>{p.title}</div>
                  <div style={{ fontSize: ".85rem", color: T.muted, lineHeight: 1.65, marginBottom: 12 }}>{p.desc}</div>
                  <div style={{ fontSize: ".75rem", fontWeight: 700, color: T.teal, fontFamily: "monospace" }}>{p.stat}</div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══════════════════════════════════════════════════════ */}
      <section id="features" style={{ background: T.card, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: "96px 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <FadeUp>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.04)", border: `1px solid ${T.border2}`, borderRadius: 100, padding: "4px 14px", marginBottom: 16 }}>
                <span style={{ fontSize: ".68rem", fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em" }}>What SubDraw Does</span>
              </div>
              <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.6rem)", fontWeight: 800, letterSpacing: "-.04em", color: "#fff", lineHeight: 1.2 }}>
                Exactly what it does.<br /><span style={{ color: T.teal }}>No feature soup.</span>
              </h2>
            </div>
          </FadeUp>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }} className="grid-cols-1 md:grid-cols-3">
            {[
              { num: "01", icon: <AlertTriangle size={20} />, title: "Flags over-invoices before you pay", desc: "Every invoice is checked against the approved total the moment it's submitted. Anything over gets flagged before your PM ever clicks approve — with a written override reason required." },
              { num: "02", icon: <FileText size={20} />, title: "Locks change orders in writing", desc: "Every CO is approved by the sub first, then you. No more 'I thought that was included' at closeout. Every change has a timestamp and a signature you can point to." },
              { num: "03", icon: <Shield size={20} />, title: "Makes compliance automatic", desc: "Payments are tied to signed lien waivers and valid insurance. Green, yellow, and red badges show who is safe to pay — and who isn't — at a glance." },
            ].map((f, i) => (
              <FadeUp key={i} delay={i * .1}>
                <div style={{ background: "#0d1525", border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, height: "100%", position: "relative", overflow: "hidden", transition: "border-color .2s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = T.tealBrd)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}>
                  <div style={{ position: "absolute", top: 20, right: 20, fontSize: "3rem", fontWeight: 800, color: "rgba(0,212,168,.06)", fontFamily: "monospace", lineHeight: 1 }}>{f.num}</div>
                  <div style={{ color: T.teal, marginBottom: 16 }}>{f.icon}</div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, color: T.text, marginBottom: 10, lineHeight: 1.4 }}>{f.title}</div>
                  <div style={{ fontSize: ".875rem", color: T.muted, lineHeight: 1.7 }}>{f.desc}</div>
                </div>
              </FadeUp>
            ))}
          </div>
          {/* Feature checklist */}
          <FadeUp delay={.3}>
            <div style={{ marginTop: 20, background: T.tealDim, border: `1px solid ${T.tealBrd}`, borderRadius: 12, padding: "24px 32px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
                {["Invoice flagging on every draw","Lender-ready draw packages","Digital lien waivers","Retainage tracking & schedules","Change order audit trail","Subcontractor portal","Insurance & license tracking","Real-time budget vs actual","Bulk payment approvals","Multi-project dashboard"].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Check size={13} style={{ color: T.teal, flexShrink: 0 }} strokeWidth={2.5} />
                    <span style={{ fontSize: ".85rem", color: "#9cb0cc" }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══════════════════════════════════════════════════ */}
      <section id="how" style={{ background: T.navy, padding: "96px 0" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
          <FadeUp>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.04)", border: `1px solid ${T.border2}`, borderRadius: 100, padding: "4px 14px", marginBottom: 16 }}>
                <span style={{ fontSize: ".68rem", fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em" }}>How It Works</span>
              </div>
              <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.6rem)", fontWeight: 800, letterSpacing: "-.04em", color: "#fff", lineHeight: 1.2 }}>
                Up and running on<br /><span style={{ color: T.teal }}>your first draw</span>
              </h2>
              <p style={{ color: T.muted, fontSize: "1rem", marginTop: 12 }}>No implementation consultant. No training sessions. Most GCs are reviewing their first draw in 2 minutes.</p>
            </div>
          </FadeUp>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 32, position: "relative" }}>
            <div style={{ position: "absolute", top: 28, left: "8%", right: "8%", height: 1, background: `linear-gradient(90deg, ${T.teal}, transparent)`, opacity: .2 }} />
            {[
              { num: "1", title: "Upload your draw", desc: "Upload any pay app or connect your lender portal. SubDraw maps every line item automatically." },
              { num: "2", title: "SubDraw reviews everything", desc: "Every invoice checked against approved budget and contract terms. Flags appear before you review." },
              { num: "3", title: "Approve what's clean", desc: "See exactly what was flagged and why. Push back on what's wrong. Approve clean invoices in one click." },
              { num: "4", title: "Lender package ready", desc: "Trigger payments, collect lien waivers, generate clean draw package. Lender approves first time." },
            ].map((s, i) => (
              <FadeUp key={i} delay={i * .1} className="text-center">
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 52, height: 52, background: T.tealDim, border: `2px solid ${T.tealBrd}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", fontSize: "1.1rem", fontWeight: 800, color: T.teal, fontFamily: "monospace", position: "relative", zIndex: 1 }}>{s.num}</div>
                  <div style={{ fontSize: ".95rem", fontWeight: 700, color: T.text, marginBottom: 8 }}>{s.title}</div>
                  <div style={{ fontSize: ".85rem", color: T.muted, lineHeight: 1.65 }}>{s.desc}</div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PROOF ═══════════════════════════════════════════════════════════ */}
      <section id="proof" style={{ background: T.card, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: "96px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <FadeUp>
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,59,92,.08)", border: "1px solid rgba(255,59,92,.2)", borderRadius: 100, padding: "4px 14px", marginBottom: 16 }}>
                <span style={{ fontSize: ".68rem", fontWeight: 700, color: T.red, textTransform: "uppercase", letterSpacing: ".1em" }}>Real Product · Real Catches</span>
              </div>
              <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.6rem)", fontWeight: 800, letterSpacing: "-.04em", color: "#fff", lineHeight: 1.2 }}>
                Three things SubDraw does<br /><span style={{ color: T.teal }}>every time a draw comes in</span>
              </h2>
            </div>
          </FadeUp>

          {/* Tab 1: Action Required */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center", marginBottom: 80 }}>
            <FadeUp>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,59,92,.08)", border: "1px solid rgba(255,59,92,.2)", borderRadius: 6, padding: "4px 12px", marginBottom: 20 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.red }}>01 — Catches overbilling instantly</span>
                </div>
                <h3 style={{ fontSize: "clamp(1.4rem,2.5vw,2rem)", fontWeight: 800, letterSpacing: "-.04em", color: "#fff", lineHeight: 1.2, marginBottom: 16 }}>
                  Pacific Electric invoiced $5,450 over their contract.<br /><span style={{ color: T.teal }}>SubDraw caught it before payment.</span>
                </h3>
                <p style={{ color: T.muted, fontSize: ".95rem", lineHeight: 1.7, marginBottom: 28 }}>
                  Invoice #E-003 came in at $56,000 against an approved contract of $50,550.
                  SubDraw flagged the 10.8% overrun automatically. The GC sent it back.
                  Pacific Electric revised it. $5,450 stayed in the GC's pocket.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {[["$5,450","caught before payment on this single invoice"],["0 clicks","required — SubDraw flagged it automatically"],["1 message","sent to Pacific Electric with the override requirement"]].map(([n,l],i) => (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: T.teal, fontFamily: "monospace", letterSpacing: "-.03em", minWidth: 72 }}>{n}</div>
                      <div style={{ fontSize: ".85rem", color: T.muted }}>{l}</div>
                    </div>
                  ))}
                </div>
                <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: T.teal, color: "#000", fontWeight: 800, fontSize: ".9rem", borderRadius: 9, padding: "13px 22px", textDecoration: "none", marginTop: 28, boxShadow: `0 6px 20px rgba(0,212,168,.25)` }}>
                  See It on Your Own Draw →
                </Link>
              </div>
            </FadeUp>
            <FadeUp delay={.15}>
              <ActionMockup />
            </FadeUp>
          </div>

          {/* Tab 2: Scoreboard */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
            <FadeUp delay={.1}>
              <ScoreboardMockup />
            </FadeUp>
            <FadeUp>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: T.tealDim, border: `1px solid ${T.tealBrd}`, borderRadius: 6, padding: "4px 12px", marginBottom: 20 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.teal }}>02 — Live financial scoreboard</span>
                </div>
                <h3 style={{ fontSize: "clamp(1.4rem,2.5vw,2rem)", fontWeight: 800, letterSpacing: "-.04em", color: "#fff", lineHeight: 1.2, marginBottom: 16 }}>
                  Every sub. Every dollar.<br /><span style={{ color: T.teal }}>Updated the moment they invoice.</span>
                </h3>
                <p style={{ color: T.muted, fontSize: ".95rem", lineHeight: 1.7, marginBottom: 24 }}>
                  No more spreadsheet reconciliation. No more calling your PM to ask where a payment stands.
                  SubDraw shows base contract, change orders, approved total, invoiced to date, and remaining balance — live.
                </p>
                {[
                  { icon: <Check size={14} />, text: "Remaining balance in green when under budget, red when over" },
                  { icon: <Check size={14} />, text: "Insurance status visible before every payment — expired = blocked" },
                  { icon: <Check size={14} />, text: "Project totals roll up automatically across all active subs" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                    <div style={{ color: T.teal, marginTop: 2, flexShrink: 0 }}>{item.icon}</div>
                    <span style={{ color: T.muted, fontSize: ".875rem", lineHeight: 1.5 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ═══ DEMO CTA ════════════════════════════════════════════════════════ */}
      <section style={{ background: T.navy, padding: "80px 0", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 24px" }}>
          <FadeUp>
            <Zap size={28} style={{ color: T.teal, margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "clamp(1.6rem,3vw,2.4rem)", fontWeight: 800, letterSpacing: "-.04em", color: "#fff", lineHeight: 1.2, marginBottom: 16 }}>
              See it catch a bad invoice<br />on a real project — in 60 seconds
            </h2>
            <p style={{ color: T.muted, fontSize: ".95rem", lineHeight: 1.7, marginBottom: 32 }}>
              We set up a live GC project with real numbers. No signup. No email. Click the button and see exactly what SubDraw would flag on your next draw.
            </p>
            <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: T.teal, color: "#000", fontWeight: 800, fontSize: "1.05rem", borderRadius: 10, padding: "18px 36px", textDecoration: "none", boxShadow: `0 10px 40px rgba(0,212,168,.35)` }}>
              Open the Live GC Demo
              <ArrowRight size={18} strokeWidth={2.5} />
            </Link>
            <p style={{ color: T.muted, fontSize: ".78rem", marginTop: 12 }}>No account. No email. Click and see it work.</p>
          </FadeUp>
        </div>
      </section>

      {/* ═══ PRICING ════════════════════════════════════════════════════════ */}
      <section id="pricing" style={{ background: T.card, borderTop: `1px solid ${T.border}`, padding: "96px 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <FadeUp>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.04)", border: `1px solid ${T.border2}`, borderRadius: 100, padding: "4px 14px", marginBottom: 16 }}>
                <span style={{ fontSize: ".68rem", fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em" }}>Pricing</span>
              </div>
              <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.6rem)", fontWeight: 800, letterSpacing: "-.04em", color: "#fff" }}>Know Before You Pay</h2>
              <p style={{ color: T.muted, marginTop: 8, fontSize: ".95rem" }}>Priced by active subcontracts — not seats, not projects. Subcontractors always free.</p>
            </div>
          </FadeUp>

          {/* Toggle */}
          <FadeUp delay={.1}>
            <div style={{ display: "flex", justifyContent: "center", margin: "32px 0" }}>
              <div style={{ display: "inline-flex", background: "rgba(255,255,255,.04)", borderRadius: 10, padding: 4, border: `1px solid ${T.border}` }}>
                {(["monthly","annual"] as const).map(b => (
                  <button key={b} onClick={() => setBilling(b)}
                    style={{ padding: "8px 20px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: ".875rem", fontWeight: 600, transition: "all .15s", background: billing === b ? "#fff" : "transparent", color: billing === b ? T.navy : T.muted, display: "flex", alignItems: "center", gap: 8 }}>
                    {b === "monthly" ? "Monthly" : "Annual"}
                    {b === "annual" && <span style={{ fontSize: ".6rem", fontWeight: 800, color: T.green, background: "rgba(0,200,122,.1)", border: "1px solid rgba(0,200,122,.2)", padding: "2px 6px", borderRadius: 100 }}>Save 1 mo</span>}
                  </button>
                ))}
              </div>
            </div>
          </FadeUp>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, alignItems: "start" }}>
            {PLANS.map((plan, i) => (
              <FadeUp key={plan.name} delay={i * .1}>
                <div style={{ background: plan.popular ? "rgba(0,212,168,.04)" : "#0d1525", border: plan.popular ? `2px solid ${T.teal}` : `1px solid ${T.border}`, borderRadius: 14, padding: plan.popular ? "36px 28px 28px" : "28px", position: "relative", transform: plan.popular ? "scale(1.02)" : "none" }}>
                  {plan.popular && <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: T.teal, color: "#000", fontSize: ".62rem", fontWeight: 800, padding: "4px 14px", borderRadius: 100, letterSpacing: ".08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Most Popular</div>}
                  <div style={{ fontWeight: 800, fontSize: "1.05rem", color: T.text, marginBottom: 3 }}>{plan.name}</div>
                  <div style={{ fontSize: ".78rem", color: T.muted, marginBottom: 5 }}>{plan.limit}</div>
                  <div style={{ fontSize: ".85rem", color: T.muted, marginBottom: 5 }}>{plan.desc}</div>
                  <div style={{ fontSize: ".78rem", color: "#4a5568", fontStyle: "italic", marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.border}` }}>{plan.roi}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 3 }}>
                    <span style={{ fontSize: "2.6rem", fontWeight: 800, color: T.text, fontFamily: "monospace", letterSpacing: "-.04em" }}>
                      ${billing === "annual" ? plan.annual.toLocaleString() : plan.monthly}
                    </span>
                    <span style={{ color: T.muted, fontSize: ".85rem" }}>{billing === "annual" ? "/yr" : "/mo"}</span>
                  </div>
                  {billing === "annual"
                    ? <div style={{ fontSize: ".72rem", color: T.muted, marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>${plan.monthly}/mo equivalent <span style={{ color: T.green, background: "rgba(0,200,122,.1)", border: "1px solid rgba(0,200,122,.2)", padding: "1px 6px", borderRadius: 100, fontSize: ".6rem", fontWeight: 800 }}>Save 1 month</span></div>
                    : <div style={{ fontSize: ".72rem", color: T.hint, marginBottom: 20 }}>${plan.annual.toLocaleString()}/yr billed annually</div>
                  }
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 9, marginBottom: 24 }}>
                    {["Unlimited team members","All features included","Subcontractors always free","Cancel anytime"].map(item => (
                      <li key={item} style={{ display: "flex", gap: 9, fontSize: ".85rem", color: T.muted }}>
                        <Check size={14} style={{ color: T.teal, flexShrink: 0, marginTop: 1 }} strokeWidth={2.5} />{item}
                      </li>
                    ))}
                  </ul>
                  <Link href="/login" style={{ display: "block", textAlign: "center", borderRadius: 9, padding: "12px", fontSize: ".9rem", fontWeight: 700, textDecoration: "none", background: plan.popular ? T.teal : "transparent", color: plan.popular ? "#000" : T.muted, border: plan.popular ? "none" : `1px solid ${T.border2}`, transition: "all .15s" }}>
                    Start Free →
                  </Link>
                </div>
              </FadeUp>
            ))}
          </div>
          <p style={{ textAlign: "center", color: T.hint, fontSize: ".78rem", marginTop: 20 }}>All plans include a free first draw review. No credit card required to start.</p>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══════════════════════════════════════════════════════ */}
      <section style={{ background: `radial-gradient(ellipse 120% 100% at 50% 100%, rgba(0,212,168,.12) 0%, transparent 65%), ${T.navy}`, borderTop: `1px solid ${T.border}`, padding: "100px 0", textAlign: "center" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px" }}>
          <FadeUp>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.tealDim, border: `1px solid ${T.tealBrd}`, borderRadius: 100, padding: "4px 14px", marginBottom: 20 }}>
              <span style={{ fontSize: ".68rem", fontWeight: 700, color: T.teal, textTransform: "uppercase", letterSpacing: ".1em" }}>Free to Try</span>
            </div>
            <h2 style={{ fontSize: "clamp(2rem,4vw,3.2rem)", fontWeight: 800, letterSpacing: "-.05em", color: "#fff", lineHeight: 1.08, marginBottom: 16 }}>
              Stop guessing.<br /><span style={{ color: T.teal }}>Start knowing.</span>
            </h2>
            <p style={{ color: T.muted, fontSize: "1.05rem", lineHeight: 1.7, maxWidth: 480, margin: "0 auto 40px" }}>
              Upload your next draw and see what SubDraw catches before you pay it. 2 minutes. No credit card. No commitment.
            </p>
            <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: T.teal, color: "#000", fontWeight: 800, fontSize: "1.1rem", borderRadius: 12, padding: "18px 40px", textDecoration: "none", boxShadow: `0 12px 48px rgba(0,212,168,.4)` }}>
              Check My First Draw Free →
            </Link>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 20, marginTop: 20 }}>
              {["No credit card","2-min setup","Free first draw","GCs in CA & UT"].map(t => (
                <span key={t} style={{ display: "flex", alignItems: "center", gap: 6, color: T.hint, fontSize: ".78rem" }}>
                  <Check size={12} style={{ color: T.green }} />{t}
                </span>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══ FOOTER ══════════════════════════════════════════════════════════ */}
      <footer style={{ background: T.card, borderTop: `1px solid ${T.border}`, padding: "52px 0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48, marginBottom: 40 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, background: T.teal, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11, color: "#000" }}>SD</div>
                <span style={{ fontWeight: 800, fontSize: "1.1rem", color: T.text, letterSpacing: "-.04em" }}>Sub<span style={{ color: T.teal }}>Draw</span></span>
              </div>
              <p style={{ color: T.hint, fontSize: ".875rem", lineHeight: 1.7, maxWidth: 260 }}>Invoice protection and draw management for general contractors. Know before you pay.</p>
            </div>
            {[
              { title: "Product", links: [["Features","#features",goto("features")],["Pricing","#pricing",goto("pricing")],["See Demo","/login",undefined],["Log In","/login",undefined]] },
              { title: "Company", links: [["About","#",undefined],["Contact","mailto:hello@subdraw.com",undefined]] },
              { title: "Legal", links: [["Privacy Policy","#",undefined],["Terms of Service","#",undefined]] },
            ].map(col => (
              <div key={col.title}>
                <h4 style={{ fontSize: ".68rem", fontWeight: 700, color: T.text, textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 14 }}>{col.title}</h4>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
                  {col.links.map(([label, href, onClick]) => (
                    <li key={label}>
                      {onClick
                        ? <a href={href as string} onClick={onClick as React.MouseEventHandler} style={{ color: T.hint, fontSize: ".875rem", textDecoration: "none" }}>{label}</a>
                        : href.startsWith("/") || href.startsWith("mailto")
                          ? <a href={href as string} style={{ color: T.hint, fontSize: ".875rem", textDecoration: "none" }}>{label}</a>
                          : <a href={href as string} style={{ color: T.hint, fontSize: ".875rem", textDecoration: "none" }}>{label}</a>
                      }
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, fontSize: ".75rem", color: T.hint }}>
            <span>© {new Date().getFullYear()} SubDraw. All rights reserved.</span>
            <span>Built for General Contractors · Subs always free</span>
          </div>
        </div>
      </footer>

      {/* ═══ MOBILE STICKY CTA ═══════════════════════════════════════════════ */}
      <motion.div
        initial={false}
        animate={{ y: pastHero ? 0 : 80, opacity: pastHero ? 1 : 0 }}
        transition={{ duration: .25 }}
        style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40, background: "linear-gradient(to top, rgba(8,14,28,.98) 70%, transparent)", paddingBottom: "env(safe-area-inset-bottom)" }}
        className="md:hidden"
      >
        <div style={{ padding: "12px 16px" }}>
          <Link href="/login" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: T.teal, color: "#000", fontWeight: 800, fontSize: ".9rem", borderRadius: 10, padding: "14px", textDecoration: "none" }}>
            Watch It Flag a Bad Invoice <ArrowRight size={16} />
          </Link>
        </div>
      </motion.div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
        @media (max-width: 768px) {
          [style*="grid-template-columns: repeat(3"] { grid-template-columns: 1fr !important; }
          [style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
          [style*="grid-template-columns: 2fr 1fr 1fr 1fr"] { grid-template-columns: 1fr 1fr !important; }
          [style*="grid-template-columns: repeat(4"] { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>
    </div>
  );
}
