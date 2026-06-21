import * as React from "react";
import { Link } from "wouter";
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { Menu, X, ArrowRight, Check, ChevronRight, AlertTriangle, FileText, Shield, TrendingUp, DollarSign, Clock, Zap } from "lucide-react";

const T = {
  teal:    "#00d4a8", tealD: "#00b891",
  tealDim: "rgba(0,212,168,.08)", tealBrd: "rgba(0,212,168,.2)",
  navy:    "#080e1c", card:   "#0d1525", card2:  "#111d30",
  border:  "#182135", border2:"#1f2d47",
  text:    "#e8ecf4", muted:  "#8899b4", hint:   "#5c7090",
  green:   "#00c87a", amber:  "#f5a623", red:    "#ff3b5c",
};

function Counter({ value, prefix="", suffix="", decimals=0 }: { value:number; prefix?:string; suffix?:string; decimals?:number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const mv = useMotionValue(0);
  const display = useTransform(mv, v => `${prefix}${decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString()}${suffix}`);
  React.useEffect(() => { if (isInView) animate(mv, value, { duration: 1.4, ease: "easeOut" }); }, [isInView, value]);
  return <motion.span ref={ref} style={{ display:"inline" }}>{display}</motion.span>;
}

function FadeUp({ children, delay=0, style={} }: { children:React.ReactNode; delay?:number; style?:React.CSSProperties }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div ref={ref} initial={{ opacity:0, y:28 }} animate={isInView ? { opacity:1, y:0 } : {}}
      transition={{ duration:.5, delay, ease:[0.4,0,.2,1] }} style={style}>
      {children}
    </motion.div>
  );
}

/* ── HERO MOCKUP — desktop only ─────────────────────────────────────── */
function HeroMockup() {
  const rows = [
    { sub:"Pacific Electric", trade:"Electrical", amt:"$56,000", pct:108, status:"flagged", flag:"Overbilled $5,450" },
    { sub:"Summit HVAC",      trade:"Mechanical", amt:"$74,200", pct:95,  status:"review",  flag:"Work incomplete" },
    { sub:"Ironclad Steel",   trade:"Structural", amt:"$98,500", pct:82,  status:"ok",      flag:"" },
    { sub:"Concrete Plus",    trade:"Concrete",   amt:"$56,800", pct:61,  status:"ok",      flag:"" },
  ];
  const sc = { flagged:T.red, review:T.amber, ok:T.green };
  const sl = { flagged:"FLAGGED", review:"REVIEW", ok:"APPROVED" };

  return (
    <div style={{ background:T.card, borderRadius:14, overflow:"hidden", boxShadow:`0 32px 80px rgba(0,0,0,.6),0 0 0 1px ${T.border}`, fontSize:11 }}>
      {/* chrome */}
      <div style={{ background:"#060b14", padding:"10px 16px", display:"flex", alignItems:"center", gap:8, borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", gap:5 }}>
          {[T.red,T.amber,T.green].map((c,i)=><div key={i} style={{ width:10,height:10,borderRadius:"50%",background:c }}/>)}
        </div>
        <div style={{ flex:1, background:T.border, borderRadius:4, padding:"3px 10px", fontSize:10, color:T.muted, fontFamily:"monospace", marginLeft:8 }}>
          app.subdraw.com/projects/highland-tower
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"176px 1fr" }}>
        {/* sidebar */}
        <div style={{ background:"#090f1d", borderRight:`1px solid ${T.border}`, padding:"14px 0" }}>
          <div style={{ padding:"0 13px 13px", borderBottom:`1px solid ${T.border}`, marginBottom:8 }}>
            <span style={{ fontWeight:800, fontSize:12, color:T.text }}>Sub<span style={{ color:T.teal }}>Draw</span></span>
          </div>
          {[["📊","Highland Tower",true],["🏢","Elm Street Plaza",false],["🏗️","Riverside HQ",false]].map(([ic,nm,on],i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:7, padding:"6px 12px", margin:"1px 5px", borderRadius:5, background:on?T.tealDim:"transparent", color:on?T.teal:T.muted, fontWeight:on?600:400, fontSize:10 }}>
              {ic} {nm}
            </div>
          ))}
          <div style={{ padding:"7px 12px 2px", fontSize:8, fontWeight:700, color:T.hint, textTransform:"uppercase", letterSpacing:".1em", marginTop:6 }}>Review</div>
          {[["🧾","Invoices","3"],["📋","Change Orders",""],["🔒","Retainage",""],["📄","Lien Waivers","2"]].map(([ic,lb,bd],i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 12px", margin:"1px 5px", borderRadius:5, color:T.muted, fontSize:10 }}>
              {ic} <span style={{ flex:1 }}>{lb}</span>
              {bd && <span style={{ background:T.red, color:"#fff", fontSize:8, fontWeight:800, padding:"1px 4px", borderRadius:100 }}>{bd}</span>}
            </div>
          ))}
        </div>
        {/* main */}
        <div style={{ padding:16, background:"#0b1322" }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:T.text }}>Highland Tower — Draw Review</div>
              <div style={{ fontSize:9, color:T.muted, marginTop:2 }}>14 active subs · <span style={{ color:T.red }}>3 flagged</span></div>
            </div>
            <div style={{ display:"flex", gap:5 }}>
              <div style={{ padding:"4px 8px", borderRadius:4, border:`1px solid ${T.border2}`, fontSize:9, color:T.muted }}>Export</div>
              <div style={{ padding:"4px 8px", borderRadius:4, background:T.teal, fontSize:9, fontWeight:700, color:"#000" }}>Approve Clean →</div>
            </div>
          </div>
          {/* KPIs */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:7, marginBottom:12 }}>
            {[{l:"Draw Total",v:"$387K",s:"⚠ 3 flagged",sc:T.red},{l:"Caught",v:"$22.4K",s:"before payment",sc:T.green},{l:"Waivers",v:"8/11",s:"3 pending",sc:T.amber},{l:"Clean",v:"$364K",s:"10 approved",sc:T.green}].map((k,i)=>(
              <div key={i} style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:7, padding:"8px 10px" }}>
                <div style={{ fontSize:8, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:".07em", marginBottom:3 }}>{k.l}</div>
                <div style={{ fontSize:14, fontWeight:800, color:T.text, fontFamily:"monospace" }}>{k.v}</div>
                <div style={{ fontSize:8, color:k.sc, marginTop:2 }}>{k.s}</div>
              </div>
            ))}
          </div>
          {/* table */}
          <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:7, overflow:"hidden" }}>
            <div style={{ padding:"7px 12px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between" }}>
              <div style={{ fontSize:10, fontWeight:700, color:T.text }}>Pending Invoice Approvals</div>
              <div style={{ background:"rgba(255,59,92,.1)", border:"1px solid rgba(255,59,92,.2)", color:T.red, fontSize:8, fontWeight:700, padding:"1px 6px", borderRadius:3, textTransform:"uppercase" }}>3 Errors Found</div>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr style={{ background:"#070d1a" }}>
                {["Subcontractor","Trade","Amount","Budget","Flag","Status"].map(h=>(
                  <th key={h} style={{ padding:"5px 10px", textAlign:"left", fontSize:8, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:".06em", borderBottom:`1px solid ${T.border}` }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.map((r,i)=>{
                  const c=sc[r.status as keyof typeof sc], l=sl[r.status as keyof typeof sl];
                  return <tr key={i} style={{ borderBottom:i<rows.length-1?`1px solid ${T.border}`:"none" }}>
                    <td style={{ padding:"6px 10px", fontWeight:600, color:T.text }}>{r.sub}</td>
                    <td style={{ padding:"6px 10px", color:T.muted }}>{r.trade}</td>
                    <td style={{ padding:"6px 10px", fontFamily:"monospace", color:T.text }}>{r.amt}</td>
                    <td style={{ padding:"6px 10px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <div style={{ width:48, height:3, background:T.border, borderRadius:2, overflow:"hidden" }}>
                          <div style={{ width:`${Math.min(r.pct,100)}%`, height:"100%", background:c }}/>
                        </div>
                        <span style={{ fontSize:8, fontFamily:"monospace", color:r.pct>100?T.red:r.pct>90?T.amber:T.muted, fontWeight:r.pct>90?700:400 }}>{r.pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding:"6px 10px", fontSize:8, color:r.flag?c:T.muted }}>{r.flag||"—"}</td>
                    <td style={{ padding:"6px 10px" }}>
                      <span style={{ background:`${c}18`, border:`1px solid ${c}40`, color:c, fontSize:7, fontWeight:800, padding:"2px 5px", borderRadius:3, textTransform:"uppercase" }}>{l}</span>
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── MOBILE HERO CARD — simple, no overflow ──────────────────────────── */
function MobileHeroCard() {
  return (
    <div style={{ background:T.card, borderRadius:14, border:`1px solid ${T.border}`, overflow:"hidden" }}>
      {/* header */}
      <div style={{ background:T.card2, padding:"14px 16px", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:T.text }}>Highland Tower</div>
            <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>14 active subs</div>
          </div>
          <div style={{ background:"rgba(255,59,92,.1)", border:"1px solid rgba(255,59,92,.2)", borderRadius:6, padding:"6px 10px", textAlign:"center" }}>
            <div style={{ fontSize:9, color:T.red, fontWeight:700 }}>FLAGGED</div>
            <div style={{ fontSize:18, fontWeight:800, color:T.red, fontFamily:"monospace" }}>3</div>
          </div>
        </div>
      </div>
      {/* caught stat */}
      <div style={{ padding:"16px", background:"rgba(0,212,168,.04)", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ fontSize:10, color:T.teal, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em", marginBottom:4 }}>💰 Caught Before Payment</div>
        <div style={{ fontSize:28, fontWeight:800, color:T.teal, fontFamily:"monospace", letterSpacing:"-.03em" }}>$22,400</div>
        <div style={{ fontSize:11, color:T.muted, marginTop:3 }}>in overbilling flagged on this draw</div>
      </div>
      {/* invoices */}
      {[
        { sub:"Pacific Electric", amt:"$56,000", pct:108, status:"flagged", flag:"Overbilled $5,450" },
        { sub:"Summit HVAC",      amt:"$74,200", pct:95,  status:"review",  flag:"Work incomplete" },
        { sub:"Ironclad Steel",   amt:"$98,500", pct:82,  status:"ok",      flag:"" },
      ].map((r,i)=>{
        const c = r.status==="flagged"?T.red:r.status==="review"?T.amber:T.green;
        const l = r.status==="flagged"?"FLAGGED":r.status==="review"?"REVIEW":"APPROVED";
        return (
          <div key={i} style={{ padding:"12px 16px", borderBottom:i<2?`1px solid ${T.border}`:"none", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:T.text }}>{r.sub}</div>
              <div style={{ fontSize:10, color:T.muted, marginTop:1 }}>{r.flag||"Clean — ready to approve"}</div>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5 }}>
                <div style={{ flex:1, height:3, background:T.border, borderRadius:2, overflow:"hidden", maxWidth:80 }}>
                  <div style={{ width:`${Math.min(r.pct,100)}%`, height:"100%", background:c }}/>
                </div>
                <span style={{ fontSize:9, fontFamily:"monospace", color:r.pct>100?T.red:r.pct>90?T.amber:T.muted, fontWeight:700 }}>{r.pct}%</span>
              </div>
            </div>
            <div style={{ marginLeft:12, textAlign:"right", flexShrink:0 }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.text, fontFamily:"monospace" }}>{r.amt}</div>
              <div style={{ marginTop:4 }}>
                <span style={{ background:`${c}18`, border:`1px solid ${c}40`, color:c, fontSize:8, fontWeight:800, padding:"2px 6px", borderRadius:3, textTransform:"uppercase" }}>{l}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── SCOREBOARD MOCKUP ───────────────────────────────────────────────── */
function ScoreboardMockup() {
  const subs = [
    { name:"Pacific Electric", trade:"Electrical", contract:45000, co:5550, invoiced:56000, remaining:150,  ins:"valid" },
    { name:"ProDrywall Solutions", trade:"Drywall", contract:32000, co:5350, invoiced:17000, remaining:20350, ins:"expired" },
    { name:"Summit HVAC",      trade:"Mechanical", contract:28000, co:5900, invoiced:15000, remaining:18900, ins:"valid" },
  ];
  return (
    <div style={{ background:T.card, borderRadius:14, overflow:"hidden", boxShadow:`0 24px 60px rgba(0,0,0,.5),0 0 0 1px ${T.border}` }}>
      <div style={{ background:"#060b14", padding:"10px 16px", display:"flex", alignItems:"center", gap:8, borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", gap:5 }}>{[T.red,T.amber,T.green].map((c,i)=><div key={i} style={{ width:9,height:9,borderRadius:"50%",background:c }}/>)}</div>
        <div style={{ flex:1, background:T.border, borderRadius:4, padding:"3px 10px", fontSize:10, color:T.muted, fontFamily:"monospace", marginLeft:6 }}>app.subdraw.com/projects/harbor-view</div>
      </div>
      <div style={{ padding:16 }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:3 }}>Live Financial Scoreboard</div>
        <div style={{ fontSize:10, color:T.muted, marginBottom:14 }}>Harbor View Office Renovation · 3 subcontracts</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {subs.map((s,i)=>(
            <div key={i} style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:10, padding:14 }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:T.text }}>{s.name}</div>
                  <div style={{ display:"flex", gap:5, marginTop:4 }}>
                    <span style={{ fontSize:9, fontWeight:600, background:"rgba(61,139,255,.1)", border:"1px solid rgba(61,139,255,.2)", color:"#3d8bff", padding:"1px 6px", borderRadius:100 }}>{s.trade}</span>
                    <span style={{ fontSize:9, fontWeight:600, background:s.ins==="valid"?"rgba(0,200,122,.1)":"rgba(255,59,92,.1)", border:`1px solid ${s.ins==="valid"?"rgba(0,200,122,.2)":"rgba(255,59,92,.2)"}`, color:s.ins==="valid"?T.green:T.red, padding:"1px 6px", borderRadius:100 }}>Ins: {s.ins==="valid"?"Valid ✓":"Expired ⚠"}</span>
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:9, color:T.muted }}>Remaining</div>
                  <div style={{ fontSize:18, fontWeight:800, color:s.remaining<500?T.amber:T.green, fontFamily:"monospace" }}>${s.remaining.toLocaleString()}</div>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 16px", fontSize:10 }}>
                {[["Base Contract",`$${s.contract.toLocaleString()}`],["Change Orders",`+$${s.co.toLocaleString()}`],["Approved Total",`$${(s.contract+s.co).toLocaleString()}`],["Total Invoiced",`$${s.invoiced.toLocaleString()}`]].map(([l,v],j)=>(
                  <div key={j}><div style={{ fontSize:9, color:T.muted }}>{l}</div><div style={{ fontWeight:700, color:T.text, fontFamily:"monospace" }}>{v}</div></div>
                ))}
              </div>
              <div style={{ marginTop:10, height:3, background:T.border, borderRadius:2, overflow:"hidden" }}>
                <div style={{ width:`${Math.min((s.invoiced/(s.contract+s.co))*100,100)}%`, height:"100%", background:s.invoiced>(s.contract+s.co)?T.red:T.teal }}/>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, padding:"10px 14px", background:T.hint, border:`1px solid ${T.border2}`, borderRadius:8 }}>
          <div style={{ fontSize:9, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:".07em", marginBottom:6 }}>Totals — 3 Subcontracts</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 16px" }}>
            {[["Base","$105,000"],["Change Orders","$16,800"],["Approved","$121,800"],["Invoiced","$88,000"]].map(([l,v],i)=>(
              <div key={i}><div style={{ fontSize:9, color:T.muted }}>{l}</div><div style={{ fontSize:12, fontWeight:800, color:T.text, fontFamily:"monospace" }}>{v}</div></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ACTION MOCKUP ───────────────────────────────────────────────────── */
function ActionMockup() {
  return (
    <div style={{ background:T.card, borderRadius:14, overflow:"hidden", boxShadow:`0 24px 60px rgba(0,0,0,.5),0 0 0 1px ${T.border}` }}>
      <div style={{ background:"#060b14", padding:"10px 16px", display:"flex", alignItems:"center", gap:8, borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", gap:5 }}>{[T.red,T.amber,T.green].map((c,i)=><div key={i} style={{ width:9,height:9,borderRadius:"50%",background:c }}/>)}</div>
        <div style={{ flex:1, background:T.border, borderRadius:4, padding:"3px 10px", fontSize:10, color:T.muted, fontFamily:"monospace", marginLeft:6 }}>app.subdraw.com/action-required</div>
      </div>
      <div style={{ padding:16 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.text }}>Action Required</div>
          <div style={{ background:T.red, color:"#fff", fontSize:10, fontWeight:800, width:22, height:22, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>1</div>
        </div>
        <div style={{ background:"rgba(255,59,92,.06)", border:"1px solid rgba(255,59,92,.2)", borderRadius:10, padding:14, marginBottom:10 }}>
          <div style={{ fontSize:9, fontWeight:800, color:T.red, textTransform:"uppercase", letterSpacing:".1em", marginBottom:10 }}>⚡ Urgent — 1 Item</div>
          <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:4 }}>Pacific Electric overbilled by $5,450</div>
          <div style={{ fontSize:10, color:T.muted, lineHeight:1.5, marginBottom:12 }}>Invoice #E-003 exceeds approved contract by 10.8%. Review required before payment can be released.</div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <div style={{ background:"rgba(255,59,92,.1)", border:"1px solid rgba(255,59,92,.2)", borderRadius:7, padding:"8px 12px", flex:1, textAlign:"center" }}>
              <div style={{ fontSize:9, color:T.red }}>Overbilled</div>
              <div style={{ fontSize:20, fontWeight:800, color:T.red, fontFamily:"monospace" }}>$5,450</div>
            </div>
            <div style={{ background:"rgba(0,212,168,.08)", border:`1px solid ${T.tealBrd}`, borderRadius:7, padding:"8px 12px", flex:1, textAlign:"center" }}>
              <div style={{ fontSize:9, color:T.teal }}>Approved Total</div>
              <div style={{ fontSize:20, fontWeight:800, color:T.teal, fontFamily:"monospace" }}>$50,550</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:7 }}>
            <div style={{ flex:1, padding:"8px", background:T.red, borderRadius:6, fontSize:10, fontWeight:700, color:"#fff", textAlign:"center", cursor:"default" }}>Review Invoice</div>
            <div style={{ flex:1, padding:"8px", border:`1px solid ${T.border2}`, borderRadius:6, fontSize:10, fontWeight:600, color:T.muted, textAlign:"center", cursor:"default" }}>Override (reason req.)</div>
          </div>
        </div>
        {[
          { label:"Summit HVAC lien waiver overdue", sub:"Payment approved · waiver not returned · 8 days", color:T.amber },
          { label:"ProDrywall insurance expired", sub:"Cannot process payment until certificate renewed", color:T.amber },
        ].map((item,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 12px", background:T.card2, border:`1px solid ${T.border}`, borderRadius:8, marginBottom:6 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:item.color, marginTop:4, flexShrink:0 }}/>
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:T.text }}>{item.label}</div>
              <div style={{ fontSize:9, color:T.muted, marginTop:2 }}>{item.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PLANS = [
  { name:"Starter",      monthly:149, annual:1639, limit:"Up to 10 active subcontracts", desc:"For remodelers and small GCs getting started.", roi:"One caught overrun and it paid for itself.",        popular:false },
  { name:"Professional", monthly:299, annual:3289, limit:"Up to 30 active subcontracts", desc:"For GCs running two to four jobs simultaneously.",roi:"One job's overrun covers your entire year.",          popular:true  },
  { name:"Scale",        monthly:599, annual:6589, limit:"Unlimited active subcontracts", desc:"For serious GCs running multiple crews.",        roi:"Unlimited protection — every job, every sub.",     popular:false },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [pastHero, setPastHero] = React.useState(false);
  const [billing, setBilling] = React.useState<"monthly"|"annual">("monthly");

  React.useEffect(() => {
    const fn = () => { setScrolled(window.scrollY>40); setPastHero(window.scrollY>500); };
    window.addEventListener("scroll", fn, { passive:true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const goto = (id:string) => (e:React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior:"smooth" });
    setMenuOpen(false);
  };

  return (
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:T.navy, color:T.text, overflowX:"hidden" }}>

      {/* NAV */}
      <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:50, transition:"all .3s",
        background:scrolled?"rgba(8,14,28,.97)":T.navy,
        borderBottom:scrolled?`1px solid ${T.border}`:"none",
        backdropFilter:scrolled?"blur(20px)":"none" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 20px", display:"flex", alignItems:"center", justifyContent:"space-between", height:56 }}>
          <a href="#hero" onClick={goto("hero")} style={{ display:"flex", alignItems:"center", gap:9, textDecoration:"none" }}>
            <div style={{ width:30, height:30, background:T.teal, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:11, color:"#000" }}>SD</div>
            <span style={{ fontWeight:800, fontSize:"1.05rem", letterSpacing:"-.04em", color:T.text }}>Sub<span style={{ color:T.teal }}>Draw</span></span>
          </a>
          {/* desktop links */}
          <div style={{ display:"flex", alignItems:"center", gap:28 }} className="sd-desktop-only">
            {[["Features","features"],["How It Works","how"],["Proof","proof"],["Pricing","pricing"]].map(([l,id])=>(
              <a key={id} href={`#${id}`} onClick={goto(id)} style={{ color:T.muted, fontSize:".875rem", fontWeight:500, textDecoration:"none", transition:"color .15s" }}
                onMouseEnter={e=>(e.currentTarget.style.color=T.text)} onMouseLeave={e=>(e.currentTarget.style.color=T.muted)}>{l}</a>
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }} className="sd-desktop-only">
            <Link href="/login" style={{ color:T.muted, fontSize:".85rem", fontWeight:600, textDecoration:"none", padding:"7px 14px", border:`1px solid ${T.border2}`, borderRadius:7 }}>Log In</Link>
            <Link href="/login" style={{ background:T.teal, color:"#000", fontSize:".85rem", fontWeight:800, textDecoration:"none", padding:"9px 18px", borderRadius:8, boxShadow:`0 4px 14px rgba(0,212,168,.3)` }}>Try Free →</Link>
          </div>
          <button onClick={()=>setMenuOpen(!menuOpen)} style={{ background:"none", border:"none", cursor:"pointer", color:T.text, padding:6, display:"none" }} className="sd-mobile-only">
            {menuOpen?<X size={22}/>:<Menu size={22}/>}
          </button>
        </div>
        {menuOpen&&(
          <div style={{ background:T.card, borderTop:`1px solid ${T.border}` }}>
            <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:4 }}>
              {[["Features","features"],["How It Works","how"],["Proof","proof"],["Pricing","pricing"]].map(([l,id])=>(
                <a key={id} href={`#${id}`} onClick={goto(id)} style={{ color:T.muted, fontWeight:500, textDecoration:"none", padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>{l}</a>
              ))}
              <div style={{ display:"flex", gap:10, marginTop:8 }}>
                <Link href="/login" style={{ flex:1, border:`1px solid ${T.border2}`, borderRadius:9, padding:"12px", textAlign:"center", fontWeight:600, color:T.text, textDecoration:"none" }}>Log In</Link>
                <Link href="/login" style={{ flex:1, background:T.teal, borderRadius:9, padding:"12px", textAlign:"center", fontWeight:800, color:"#000", textDecoration:"none" }}>Try Free →</Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section id="hero" style={{ paddingTop:56, background:`radial-gradient(ellipse 100% 60% at 50% -10%,rgba(0,212,168,.1) 0%,transparent 65%),${T.navy}`, overflow:"hidden" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"64px 20px 0" }}>
          <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:.5 }} style={{ textAlign:"center", marginBottom:24 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:T.tealDim, border:`1px solid ${T.tealBrd}`, borderRadius:100, padding:"5px 14px" }}>
              <motion.div animate={{ scale:[1,1.3,1] }} transition={{ repeat:Infinity, duration:2 }} style={{ width:6, height:6, borderRadius:"50%", background:T.teal }}/>
              <span style={{ fontSize:".7rem", fontWeight:700, color:T.teal, textTransform:"uppercase", letterSpacing:".1em" }}>Invoice Protection for General Contractors</span>
            </div>
          </motion.div>

          <motion.h1 initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ duration:.6, delay:.1 }}
            style={{ fontSize:"clamp(2rem,5.5vw,3.8rem)", fontWeight:800, lineHeight:1.06, letterSpacing:"-.05em", textAlign:"center", color:"#fff", marginBottom:16 }}>
            Your sub just invoiced $8,500<br />
            <span style={{ color:T.muted }}>over their contract.</span>
          </motion.h1>
          <motion.h2 initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:.5, delay:.18 }}
            style={{ fontSize:"clamp(1.3rem,3vw,2.2rem)", fontWeight:700, letterSpacing:"-.04em", textAlign:"center", color:T.teal, marginBottom:24 }}>
            Do you catch it — or pay it?
          </motion.h2>

          <motion.p initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:.5, delay:.26 }}
            style={{ fontSize:"clamp(.95rem,2vw,1.1rem)", color:T.muted, textAlign:"center", maxWidth:580, margin:"0 auto 32px", lineHeight:1.7 }}>
            SubDraw flags every over-invoice the second it's submitted — before anyone clicks approve. Most GCs catch $8–15K per job.
          </motion.p>

          <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ duration:.5, delay:.32 }}
            style={{ maxWidth:520, margin:"0 auto 28px", borderLeft:`3px solid ${T.teal}`, paddingLeft:18 }}>
            <p style={{ color:"#c0cce0", fontSize:".9rem", fontStyle:"italic", lineHeight:1.65 }}>
              "SubDraw caught a $12,000 overrun in week one. Paid for years of subscription in a single click."
            </p>
            <p style={{ color:T.muted, fontSize:".75rem", marginTop:7 }}>— GC Owner, St. George, Utah</p>
          </motion.div>

          <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ duration:.5, delay:.38 }}
            style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, maxWidth:400, margin:"0 auto 24px" }}>
            <Link href="/login" style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, background:T.teal, color:"#000", fontWeight:800, fontSize:"1rem", borderRadius:10, padding:"15px 28px", textDecoration:"none", boxShadow:`0 8px 28px rgba(0,212,168,.35)`, width:"100%" }}>
              Watch It Flag a Bad Invoice <ArrowRight size={18} strokeWidth={2.5}/>
            </Link>
            <a href="#proof" onClick={goto("proof")} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, color:T.muted, fontWeight:600, fontSize:".9rem", border:`1px solid ${T.border2}`, borderRadius:10, padding:"12px 20px", textDecoration:"none", width:"100%" }}>
              See a real catch <ChevronRight size={15}/>
            </a>
          </motion.div>

          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:.5, delay:.44 }}
            style={{ display:"flex", flexWrap:"wrap", gap:16, justifyContent:"center", marginBottom:56 }}>
            {["No credit card","2-min setup","GCs in CA & UT"].map(t=>(
              <span key={t} style={{ display:"flex", alignItems:"center", gap:5, color:T.muted, fontSize:".78rem" }}>
                <Check size={12} style={{ color:T.green }} strokeWidth={2.5}/>{t}
              </span>
            ))}
          </motion.div>

          {/* Hero mockup: desktop shows full table, mobile shows card */}
          <motion.div initial={{ opacity:0, y:40 }} animate={{ opacity:1, y:0 }} transition={{ duration:.8, delay:.5, ease:[0.4,0,.2,1] }}
            style={{ maxWidth:960, margin:"0 auto", position:"relative" }}>
            <div style={{ position:"absolute", top:-60, left:"50%", transform:"translateX(-50%)", width:700, height:300, background:"radial-gradient(ellipse at center,rgba(0,212,168,.1) 0%,transparent 70%)", pointerEvents:"none" }}/>
            <div className="sd-desktop-only"><HeroMockup /></div>
            <div className="sd-mobile-only"><MobileHeroCard /></div>
          </motion.div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ background:T.card, borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}`, padding:"48px 20px" }}>
        <div style={{ maxWidth:1000, margin:"0 auto", display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"32px 24px", textAlign:"center" }} className="sd-stats-grid">
          {[{num:8000,prefix:"$",suffix:"+",label:"Avg caught per draw"},{num:73,suffix:"%",label:"Fewer invoice disputes"},{num:4,suffix:"×",label:"Faster approvals"},{num:2,suffix:" min",label:"To first review"}].map((s,i)=>(
            <FadeUp key={i} delay={i*.08}>
              <div style={{ fontSize:"2.2rem", fontWeight:800, color:T.teal, fontFamily:"monospace", letterSpacing:"-.04em", lineHeight:1 }}>
                <Counter value={s.num} prefix={s.prefix||""} suffix={s.suffix||""}/>
              </div>
              <div style={{ fontSize:".8rem", color:T.muted, marginTop:5 }}>{s.label}</div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* PAIN */}
      <section style={{ background:T.navy, padding:"80px 0" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 20px" }}>
          <FadeUp><div style={{ marginBottom:48 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(255,255,255,.04)", border:`1px solid ${T.border2}`, borderRadius:100, padding:"4px 12px", marginBottom:14 }}>
              <span style={{ fontSize:".65rem", fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:".1em" }}>The Problem</span>
            </div>
            <h2 style={{ fontSize:"clamp(1.7rem,3vw,2.4rem)", fontWeight:800, letterSpacing:"-.04em", color:"#fff", lineHeight:1.2, maxWidth:520 }}>
              Four places GCs quietly<br />lose money on subs
            </h2>
          </div></FadeUp>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:12 }}>
            {[
              { icon:<AlertTriangle size={18}/>, title:"Over-invoices you miss", desc:"Invoice hits the same day the draw is due. You're reviewing 12 subs. You approve it. Find out later they billed for work not done.", stat:"$6,200 avg per incident" },
              { icon:<FileText size={18}/>,      title:"Duplicate charges",       desc:"Same line item submitted twice under different framing. Easy to miss when you're moving fast. Impossible to claw back once paid.", stat:"$3,800 avg per duplicate" },
              { icon:<TrendingUp size={18}/>,    title:"Overruns approved by accident", desc:"By the time you notice a sub is over budget, you've already signed off on three invoices you shouldn't have.", stat:"$11K avg by discovery" },
              { icon:<Shield size={18}/>,        title:"Lender draw rejections",  desc:"One missing lien waiver, one number that doesn't match. Draw rejected. On an $800K draw, a 5-day delay is real money sitting idle.", stat:"3–5 days avg delay" },
              { icon:<Clock size={18}/>,         title:"Compliance blindspots",   desc:"Subs with expired insurance on file. You pay them. Then you find out when something goes wrong on site.", stat:"Unlimited liability" },
              { icon:<DollarSign size={18}/>,    title:"\"Where's my check?\"",   desc:"Subs call chasing payment status because there's no visibility. You lose good subs when you can't answer fast.", stat:"Good subs walk" },
            ].map((p,i)=>(
              <FadeUp key={i} delay={i*.05}>
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:22, height:"100%" }}>
                  <div style={{ color:T.teal, marginBottom:12 }}>{p.icon}</div>
                  <div style={{ fontSize:".95rem", fontWeight:700, color:T.text, marginBottom:7 }}>{p.title}</div>
                  <div style={{ fontSize:".85rem", color:T.muted, lineHeight:1.65, marginBottom:10 }}>{p.desc}</div>
                  <div style={{ fontSize:".72rem", fontWeight:700, color:T.teal, fontFamily:"monospace" }}>{p.stat}</div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ background:T.card, borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}`, padding:"80px 0" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 20px" }}>
          <FadeUp><div style={{ textAlign:"center", marginBottom:48 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(255,255,255,.04)", border:`1px solid ${T.border2}`, borderRadius:100, padding:"4px 12px", marginBottom:14 }}>
              <span style={{ fontSize:".65rem", fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:".1em" }}>What SubDraw Does</span>
            </div>
            <h2 style={{ fontSize:"clamp(1.7rem,3vw,2.4rem)", fontWeight:800, letterSpacing:"-.04em", color:"#fff", lineHeight:1.2 }}>
              Exactly what it does.<br /><span style={{ color:T.teal }}>No feature soup.</span>
            </h2>
          </div></FadeUp>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:12 }}>
            {[
              { num:"01", title:"Flags over-invoices before you pay", desc:"Every invoice checked against the approved total the moment it's submitted. Anything over gets flagged — override requires a written reason." },
              { num:"02", title:"Locks change orders in writing",       desc:"Every CO approved by the sub first, then you. No more 'I thought that was included' arguments. Every change has a timestamp and signature." },
              { num:"03", title:"Makes compliance automatic",           desc:"Payments tied to signed lien waivers and valid insurance. Green, yellow, red badges show who is safe to pay at a glance." },
            ].map((f,i)=>(
              <FadeUp key={i} delay={i*.1}>
                <div style={{ background:"#0d1525", border:`1px solid ${T.border}`, borderRadius:12, padding:26, height:"100%", position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", top:16, right:16, fontSize:"2.8rem", fontWeight:800, color:"rgba(0,212,168,.06)", fontFamily:"monospace", lineHeight:1 }}>{f.num}</div>
                  <div style={{ fontSize:".95rem", fontWeight:700, color:T.text, marginBottom:10, lineHeight:1.4 }}>{f.title}</div>
                  <div style={{ fontSize:".875rem", color:T.muted, lineHeight:1.7 }}>{f.desc}</div>
                </div>
              </FadeUp>
            ))}
          </div>
          <FadeUp delay={.3}>
            <div style={{ marginTop:14, background:T.tealDim, border:`1px solid ${T.tealBrd}`, borderRadius:12, padding:"22px 24px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12 }}>
                {["Invoice flagging on every draw","Lender-ready draw packages","Digital lien waivers","Retainage tracking","Change order audit trail","Sub portal","Insurance tracking","Budget vs actual live","Bulk payment approvals","Multi-project dashboard"].map(item=>(
                  <div key={item} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <Check size={12} style={{ color:T.teal, flexShrink:0 }} strokeWidth={2.5}/>
                    <span style={{ fontSize:".85rem", color:"#9cb0cc" }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ background:T.navy, padding:"80px 0" }}>
        <div style={{ maxWidth:900, margin:"0 auto", padding:"0 20px" }}>
          <FadeUp><div style={{ textAlign:"center", marginBottom:48 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(255,255,255,.04)", border:`1px solid ${T.border2}`, borderRadius:100, padding:"4px 12px", marginBottom:14 }}>
              <span style={{ fontSize:".65rem", fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:".1em" }}>How It Works</span>
            </div>
            <h2 style={{ fontSize:"clamp(1.7rem,3vw,2.4rem)", fontWeight:800, letterSpacing:"-.04em", color:"#fff", lineHeight:1.2 }}>
              Up and running on<br /><span style={{ color:T.teal }}>your first draw</span>
            </h2>
            <p style={{ color:T.muted, fontSize:".95rem", marginTop:10 }}>No training sessions. Most GCs review their first draw in 2 minutes.</p>
          </div></FadeUp>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:32 }}>
            {[
              { num:"1", title:"Upload your draw", desc:"Upload any pay app or connect your lender portal. SubDraw maps every line item automatically." },
              { num:"2", title:"SubDraw reviews everything", desc:"Every invoice checked against approved budget and contract terms. Flags appear before you review." },
              { num:"3", title:"Approve what's clean", desc:"See exactly what was flagged and why. Push back on what's wrong. Approve clean invoices in one click." },
              { num:"4", title:"Lender package ready", desc:"Trigger payments, collect lien waivers, generate clean draw package. Lender approves first time." },
            ].map((s,i)=>(
              <FadeUp key={i} delay={i*.1}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ width:50, height:50, background:T.tealDim, border:`2px solid ${T.tealBrd}`, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", fontSize:"1.1rem", fontWeight:800, color:T.teal, fontFamily:"monospace" }}>{s.num}</div>
                  <div style={{ fontSize:".95rem", fontWeight:700, color:T.text, marginBottom:7 }}>{s.title}</div>
                  <div style={{ fontSize:".85rem", color:T.muted, lineHeight:1.65 }}>{s.desc}</div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* PROOF */}
      <section id="proof" style={{ background:T.card, borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}`, padding:"80px 0" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 20px" }}>
          <FadeUp><div style={{ textAlign:"center", marginBottom:56 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(255,59,92,.08)", border:"1px solid rgba(255,59,92,.2)", borderRadius:100, padding:"4px 12px", marginBottom:14 }}>
              <span style={{ fontSize:".65rem", fontWeight:700, color:T.red, textTransform:"uppercase", letterSpacing:".1em" }}>Real Product · Real Catches</span>
            </div>
            <h2 style={{ fontSize:"clamp(1.7rem,3vw,2.4rem)", fontWeight:800, letterSpacing:"-.04em", color:"#fff", lineHeight:1.2 }}>
              Three things SubDraw does<br /><span style={{ color:T.teal }}>every time a draw comes in</span>
            </h2>
          </div></FadeUp>

          {/* Row 1: copy + action mockup */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:48, alignItems:"center", marginBottom:72 }} className="sd-proof-row">
            <FadeUp>
              <div>
                <div style={{ display:"inline-flex", alignItems:"center", gap:7, background:"rgba(255,59,92,.08)", border:"1px solid rgba(255,59,92,.2)", borderRadius:6, padding:"4px 10px", marginBottom:18 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:T.red }}>01 — Catches overbilling instantly</span>
                </div>
                <h3 style={{ fontSize:"clamp(1.3rem,2.5vw,1.9rem)", fontWeight:800, letterSpacing:"-.04em", color:"#fff", lineHeight:1.2, marginBottom:14 }}>
                  Pacific Electric invoiced $5,450 over their contract.<br /><span style={{ color:T.teal }}>SubDraw caught it before payment.</span>
                </h3>
                <p style={{ color:T.muted, fontSize:".9rem", lineHeight:1.7, marginBottom:24 }}>
                  Invoice #E-003 came in at $56,000 against an approved contract of $50,550. SubDraw flagged the overrun automatically. The GC sent it back. $5,450 stayed in their pocket.
                </p>
                {[["$5,450","caught before payment on this invoice"],["0 clicks","required — SubDraw flagged it automatically"],["1 message","sent with the override requirement"]].map(([n,l],i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"baseline", gap:12, padding:"11px 0", borderBottom:`1px solid ${T.border}` }}>
                    <div style={{ fontSize:"1.3rem", fontWeight:800, color:T.teal, fontFamily:"monospace", minWidth:70 }}>{n}</div>
                    <div style={{ fontSize:".85rem", color:T.muted }}>{l}</div>
                  </div>
                ))}
                <Link href="/login" style={{ display:"inline-flex", alignItems:"center", gap:8, background:T.teal, color:"#000", fontWeight:800, fontSize:".9rem", borderRadius:9, padding:"13px 22px", textDecoration:"none", marginTop:24, boxShadow:`0 6px 20px rgba(0,212,168,.25)` }}>
                  See It on Your Own Draw →
                </Link>
              </div>
            </FadeUp>
            <FadeUp delay={.15}><ActionMockup/></FadeUp>
          </div>

          {/* Row 2: scoreboard mockup + copy */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:48, alignItems:"center" }} className="sd-proof-row">
            <FadeUp delay={.1}><ScoreboardMockup/></FadeUp>
            <FadeUp>
              <div>
                <div style={{ display:"inline-flex", alignItems:"center", gap:7, background:T.tealDim, border:`1px solid ${T.tealBrd}`, borderRadius:6, padding:"4px 10px", marginBottom:18 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:T.teal }}>02 — Live financial scoreboard</span>
                </div>
                <h3 style={{ fontSize:"clamp(1.3rem,2.5vw,1.9rem)", fontWeight:800, letterSpacing:"-.04em", color:"#fff", lineHeight:1.2, marginBottom:14 }}>
                  Every sub. Every dollar.<br /><span style={{ color:T.teal }}>Updated the moment they invoice.</span>
                </h3>
                <p style={{ color:T.muted, fontSize:".9rem", lineHeight:1.7, marginBottom:20 }}>
                  No more spreadsheet reconciliation. SubDraw shows base contract, change orders, approved total, invoiced, and remaining balance — live across all your subs.
                </p>
                {[
                  "Remaining balance in green when under budget, red when over",
                  "Insurance status visible before every payment — expired = blocked",
                  "Project totals roll up automatically across all active subs",
                ].map((t,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:9, marginBottom:10 }}>
                    <Check size={13} style={{ color:T.teal, marginTop:2, flexShrink:0 }} strokeWidth={2.5}/>
                    <span style={{ color:T.muted, fontSize:".875rem", lineHeight:1.5 }}>{t}</span>
                  </div>
                ))}
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* DEMO CTA */}
      <section style={{ background:T.navy, padding:"72px 0", textAlign:"center" }}>
        <div style={{ maxWidth:560, margin:"0 auto", padding:"0 20px" }}>
          <FadeUp>
            <Zap size={26} style={{ color:T.teal, margin:"0 auto 14px" }}/>
            <h2 style={{ fontSize:"clamp(1.5rem,3vw,2.2rem)", fontWeight:800, letterSpacing:"-.04em", color:"#fff", lineHeight:1.2, marginBottom:14 }}>
              See it catch a bad invoice in 60 seconds
            </h2>
            <p style={{ color:T.muted, fontSize:".9rem", lineHeight:1.7, marginBottom:28 }}>
              Live GC project. Real numbers. No signup, no email — click and see exactly what SubDraw would flag on your next draw.
            </p>
            <Link href="/login" style={{ display:"inline-flex", alignItems:"center", gap:10, background:T.teal, color:"#000", fontWeight:800, fontSize:"1rem", borderRadius:10, padding:"16px 32px", textDecoration:"none", boxShadow:`0 10px 36px rgba(0,212,168,.35)` }}>
              Open the Live GC Demo <ArrowRight size={18} strokeWidth={2.5}/>
            </Link>
            <p style={{ color:T.muted, fontSize:".75rem", marginTop:10 }}>No account. No email. Click and see it work.</p>
          </FadeUp>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ background:T.card, borderTop:`1px solid ${T.border}`, padding:"80px 0" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 20px" }}>
          <FadeUp><div style={{ textAlign:"center", marginBottom:12 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(255,255,255,.04)", border:`1px solid ${T.border2}`, borderRadius:100, padding:"4px 12px", marginBottom:14 }}>
              <span style={{ fontSize:".65rem", fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:".1em" }}>Pricing</span>
            </div>
            <h2 style={{ fontSize:"clamp(1.7rem,3vw,2.4rem)", fontWeight:800, letterSpacing:"-.04em", color:"#fff" }}>Know Before You Pay</h2>
            <p style={{ color:T.muted, marginTop:8, fontSize:".9rem" }}>By active subcontracts — not seats, not projects. Subs always free.</p>
          </div></FadeUp>
          <FadeUp delay={.1}>
            <div style={{ display:"flex", justifyContent:"center", margin:"28px 0" }}>
              <div style={{ display:"inline-flex", background:"rgba(255,255,255,.04)", borderRadius:10, padding:4, border:`1px solid ${T.border}` }}>
                {(["monthly","annual"] as const).map(b=>(
                  <button key={b} onClick={()=>setBilling(b)} style={{ padding:"7px 18px", borderRadius:7, border:"none", cursor:"pointer", fontSize:".85rem", fontWeight:600, transition:"all .15s", background:billing===b?"#fff":"transparent", color:billing===b?T.navy:T.muted, display:"flex", alignItems:"center", gap:7 }}>
                    {b==="monthly"?"Monthly":"Annual"}
                    {b==="annual"&&<span style={{ fontSize:".58rem", fontWeight:800, color:T.green, background:"rgba(0,200,122,.1)", border:"1px solid rgba(0,200,122,.2)", padding:"2px 5px", borderRadius:100 }}>Save 1 mo</span>}
                  </button>
                ))}
              </div>
            </div>
          </FadeUp>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:14 }}>
            {PLANS.map((plan,i)=>(
              <FadeUp key={plan.name} delay={i*.08}>
                <div style={{ background:plan.popular?"rgba(0,212,168,.04)":"#0d1525", border:plan.popular?`2px solid ${T.teal}`:`1px solid ${T.border}`, borderRadius:14, padding:plan.popular?"34px 26px 26px":"26px", position:"relative" }}>
                  {plan.popular&&<div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:T.teal, color:"#000", fontSize:".62rem", fontWeight:800, padding:"3px 14px", borderRadius:100, textTransform:"uppercase", whiteSpace:"nowrap" }}>Most Popular</div>}
                  <div style={{ fontWeight:800, fontSize:"1rem", color:T.text, marginBottom:3 }}>{plan.name}</div>
                  <div style={{ fontSize:".75rem", color:T.muted, marginBottom:5 }}>{plan.limit}</div>
                  <div style={{ fontSize:".82rem", color:T.muted, marginBottom:5 }}>{plan.desc}</div>
                  <div style={{ fontSize:".75rem", color:T.hint, fontStyle:"italic", marginBottom:18, paddingBottom:14, borderBottom:`1px solid ${T.border}` }}>{plan.roi}</div>
                  <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:3 }}>
                    <span style={{ fontSize:"2.4rem", fontWeight:800, color:T.text, fontFamily:"monospace", letterSpacing:"-.04em" }}>${billing==="annual"?plan.annual.toLocaleString():plan.monthly}</span>
                    <span style={{ color:T.muted, fontSize:".82rem" }}>{billing==="annual"?"/yr":"/mo"}</span>
                  </div>
                  {billing==="annual"
                    ?<div style={{ fontSize:".7rem", color:T.muted, marginBottom:18, display:"flex", alignItems:"center", gap:6 }}>${plan.monthly}/mo equiv <span style={{ color:T.green, background:"rgba(0,200,122,.1)", border:"1px solid rgba(0,200,122,.2)", padding:"1px 5px", borderRadius:100, fontSize:".58rem", fontWeight:800 }}>Save 1 month</span></div>
                    :<div style={{ fontSize:".7rem", color:T.hint, marginBottom:18 }}>${plan.annual.toLocaleString()}/yr billed annually</div>
                  }
                  <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
                    {["Unlimited team members","All features included","Subcontractors always free","Cancel anytime"].map(item=>(
                      <li key={item} style={{ display:"flex", gap:8, fontSize:".83rem", color:T.muted }}>
                        <Check size={13} style={{ color:T.teal, flexShrink:0, marginTop:1 }} strokeWidth={2.5}/>{item}
                      </li>
                    ))}
                  </ul>
                  <Link href="/login" style={{ display:"block", textAlign:"center", borderRadius:9, padding:"11px", fontSize:".88rem", fontWeight:700, textDecoration:"none", background:plan.popular?T.teal:"transparent", color:plan.popular?"#000":T.muted, border:plan.popular?"none":`1px solid ${T.border2}` }}>
                    Start Free →
                  </Link>
                </div>
              </FadeUp>
            ))}
          </div>
          <p style={{ textAlign:"center", color:T.hint, fontSize:".75rem", marginTop:18 }}>All plans include a free first draw review. No credit card required to start.</p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ background:`radial-gradient(ellipse 120% 100% at 50% 100%,rgba(0,212,168,.12) 0%,transparent 65%),${T.navy}`, borderTop:`1px solid ${T.border}`, padding:"88px 0", textAlign:"center" }}>
        <div style={{ maxWidth:580, margin:"0 auto", padding:"0 20px" }}>
          <FadeUp>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:T.tealDim, border:`1px solid ${T.tealBrd}`, borderRadius:100, padding:"4px 12px", marginBottom:18 }}>
              <span style={{ fontSize:".65rem", fontWeight:700, color:T.teal, textTransform:"uppercase", letterSpacing:".1em" }}>Free to Try</span>
            </div>
            <h2 style={{ fontSize:"clamp(1.9rem,4vw,3rem)", fontWeight:800, letterSpacing:"-.05em", color:"#fff", lineHeight:1.08, marginBottom:14 }}>
              Stop guessing.<br /><span style={{ color:T.teal }}>Start knowing.</span>
            </h2>
            <p style={{ color:T.muted, fontSize:"1rem", lineHeight:1.7, marginBottom:36 }}>
              Upload your next draw and see what SubDraw catches before you pay. 2 minutes. No credit card. No commitment.
            </p>
            <Link href="/login" style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:10, background:T.teal, color:"#000", fontWeight:800, fontSize:"1rem", borderRadius:12, padding:"17px 36px", textDecoration:"none", boxShadow:`0 12px 48px rgba(0,212,168,.4)`, width:"100%", maxWidth:360 }}>
              Check My First Draw Free →
            </Link>
            <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:16, marginTop:18 }}>
              {["No credit card","2-min setup","Free first draw","GCs in CA & UT"].map(t=>(
                <span key={t} style={{ display:"flex", alignItems:"center", gap:5, color:T.hint, fontSize:".75rem" }}>
                  <Check size={11} style={{ color:T.green }}/>{t}
                </span>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background:T.card, borderTop:`1px solid ${T.border}`, padding:"48px 0 24px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 20px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"32px 48px", marginBottom:36 }} className="sd-footer-grid">
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:12 }}>
                <div style={{ width:30, height:30, background:T.teal, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:11, color:"#000" }}>SD</div>
                <span style={{ fontWeight:800, fontSize:"1.05rem", color:T.text, letterSpacing:"-.04em" }}>Sub<span style={{ color:T.teal }}>Draw</span></span>
              </div>
              <p style={{ color:T.hint, fontSize:".85rem", lineHeight:1.7, maxWidth:260 }}>Invoice protection for general contractors. Know before you pay.</p>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
              <div>
                <h4 style={{ fontSize:".68rem", fontWeight:700, color:T.text, textTransform:"uppercase", letterSpacing:".1em", marginBottom:12 }}>Product</h4>
                <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:8 }}>
                  {[["Features","#features",goto("features")],["Pricing","#pricing",goto("pricing")],["See Demo","/login",undefined],["Log In","/login",undefined]].map(([l,h,fn])=>(
                    <li key={l}><a href={h as string} onClick={fn as React.MouseEventHandler|undefined} style={{ color:T.hint, fontSize:".85rem", textDecoration:"none" }}>{l}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize:".68rem", fontWeight:700, color:T.text, textTransform:"uppercase", letterSpacing:".1em", marginBottom:12 }}>Company</h4>
                <ul style={{ listStyle:"none", display:"flex", flexDirection:"column", gap:8 }}>
                  {[["Contact","mailto:hello@subdraw.com"],["Privacy","#"],["Terms","#"]].map(([l,h])=>(
                    <li key={l}><a href={h} style={{ color:T.hint, fontSize:".85rem", textDecoration:"none" }}>{l}</a></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:18, display:"flex", flexWrap:"wrap", justifyContent:"space-between", gap:8, fontSize:".72rem", color:T.hint }}>
            <span>© {new Date().getFullYear()} SubDraw. All rights reserved.</span>
            <span>Built for General Contractors · Subs always free</span>
          </div>
        </div>
      </footer>

      {/* MOBILE STICKY CTA */}
      <motion.div initial={false} animate={{ y:pastHero?0:80, opacity:pastHero?1:0 }} transition={{ duration:.25 }}
        style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:40, background:"linear-gradient(to top,rgba(8,14,28,.98) 70%,transparent)", paddingBottom:"env(safe-area-inset-bottom)" }}
        className="sd-mobile-only">
        <div style={{ padding:"10px 16px" }}>
          <Link href="/login" style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, background:T.teal, color:"#000", fontWeight:800, fontSize:".9rem", borderRadius:10, padding:"14px", textDecoration:"none" }}>
            Watch It Flag a Bad Invoice <ArrowRight size={16}/>
          </Link>
        </div>
      </motion.div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; }

        /* Desktop vs mobile visibility */
        .sd-desktop-only { display: flex !important; }
        .sd-mobile-only  { display: none !important; }

        /* Stats: 4 col on desktop */
        .sd-stats-grid { grid-template-columns: repeat(4,1fr) !important; }

        /* Proof rows: 2-col on desktop */
        .sd-proof-row { grid-template-columns: 1fr 1fr !important; }

        /* Footer: 2 col on desktop */
        .sd-footer-grid { grid-template-columns: 1fr 1fr !important; }

        @media (max-width: 768px) {
          .sd-desktop-only { display: none !important; }
          .sd-mobile-only  { display: flex !important; }

          /* Stats: 2 col */
          .sd-stats-grid { grid-template-columns: repeat(2,1fr) !important; gap: 24px 16px !important; }

          /* Proof: stack vertically, copy first then mockup */
          .sd-proof-row { grid-template-columns: 1fr !important; gap: 28px !important; }

          /* Footer: stack */
          .sd-footer-grid { grid-template-columns: 1fr !important; gap: 24px !important; }

          /* Section padding */
          section { padding-top: 64px !important; padding-bottom: 64px !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
        }
      `}</style>
    </div>
  );
}
