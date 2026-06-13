import * as React from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { HardHat, ArrowRight, X, CheckCircle2, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

const SS_KEY = "st_demo_wt_v1";
const SIGNUP_PATH = "/register";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WtState {
  step: number; // 0=not started, 1=s1 tooltip, 2=s2a tooltip, 3=s2b tooltip, 4=s3 tooltip, 5=final CTA, 6=done
  skipped: boolean;
}

function loadWtState(): WtState {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.step === "number") return p;
    }
  } catch {}
  return { step: 0, skipped: false };
}

function saveWtState(s: WtState) {
  try { sessionStorage.setItem(SS_KEY, JSON.stringify(s)); } catch {}
}

// ── Context ──────────────────────────────────────────────────────────────────

interface DemoCtxValue {
  wt: WtState;
  setStep: (n: number) => void;
  skipTour: () => void;
  isDemoGC: boolean;
}

const DemoCtx = React.createContext<DemoCtxValue | null>(null);

export function DemoWalkthroughProvider({
  children,
  isDemoGC,
}: {
  children: React.ReactNode;
  isDemoGC: boolean;
}) {
  const [wt, _setWt] = React.useState<WtState>(loadWtState);

  function setStep(n: number) {
    const s: WtState = { ...wt, step: n };
    _setWt(s);
    saveWtState(s);
  }

  function skipTour() {
    const s: WtState = { ...wt, skipped: true };
    _setWt(s);
    saveWtState(s);
  }

  return (
    <DemoCtx.Provider value={{ wt, setStep, skipTour, isDemoGC }}>
      {children}
    </DemoCtx.Provider>
  );
}

function useDemo() {
  return React.useContext(DemoCtx);
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressDot({ state }: { state: "inactive" | "active" | "done" }) {
  return (
    <div
      className={cn(
        "h-2.5 w-2.5 rounded-full transition-all duration-500",
        state === "inactive" && "bg-white/25",
        state === "done" && "bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]",
        state === "active" && "bg-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.9)]"
      )}
    />
  );
}

export function DemoProgressBar() {
  const ctx = useDemo();
  if (!ctx || !ctx.isDemoGC) return null;
  const { wt } = ctx;
  const step = wt.step;
  const allDone = step >= 5;

  const dot1: "inactive" | "active" | "done" =
    step >= 2 ? "done" : step === 1 ? "active" : "inactive";
  const dot2: "inactive" | "active" | "done" =
    step >= 4 ? "done" : step === 2 || step === 3 ? "active" : "inactive";
  const dot3: "inactive" | "active" | "done" =
    step >= 5 ? "done" : step === 4 ? "active" : "inactive";

  const centerText =
    step >= 5
      ? "You've seen all 3 core workflows. Lock this in for your own jobs."
      : step >= 4
      ? "You saw the live financial scoreboard both sides trust."
      : step >= 2
      ? "You saw how SubDraw catches over-invoices automatically."
      : step === 1
      ? "Step 1 of 3 — See a Flagged Invoice"
      : step === 3
      ? "Step 2 of 3 — See the Live Scoreboard"
      : "Try the guided walkthrough";

  const mobileStepLabel =
    step <= 1 ? "1/3" : step <= 3 ? "2/3" : "3/3";

  return (
    <div
      className={cn(
        "flex items-center px-3 sm:px-5 gap-3 shrink-0 text-white transition-all duration-500",
        allDone
          ? "bg-gradient-to-r from-blue-700 to-blue-600 py-2.5"
          : "bg-blue-700 py-2"
      )}
    >
      {/* Left: Logo */}
      <div className="flex items-center gap-1.5 shrink-0">
        <HardHat className="h-4 w-4 text-white/80" />
        <span className="hidden sm:inline text-white/90 font-bold text-xs tracking-tight">
          SubDraw Demo
        </span>
      </div>

      {/* Center */}
      <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
        {!allDone && (
          <div className="flex items-center gap-2">
            <ProgressDot state={dot1} />
            <div className="w-5 h-px bg-white/25" />
            <ProgressDot state={dot2} />
            <div className="w-5 h-px bg-white/25" />
            <ProgressDot state={dot3} />
          </div>
        )}
        <span className="hidden sm:block text-[11px] text-white/85 text-center leading-tight truncate max-w-xs">
          {centerText}
        </span>
        {!allDone && (
          <span className="sm:hidden text-[10px] text-white/70">{mobileStepLabel}</span>
        )}
      </div>

      {/* Right: Sign Up */}
      <a
        href={SIGNUP_PATH}
        className={cn(
          "shrink-0 flex items-center gap-1.5 font-bold rounded-lg transition-all whitespace-nowrap",
          allDone
            ? "bg-orange-500 hover:bg-orange-400 text-white text-sm px-4 py-2 animate-pulse"
            : "bg-white text-blue-700 hover:bg-blue-50 text-xs px-3 py-1.5"
        )}
      >
        Sign Up Free
        {allDone && <ArrowRight className="h-3.5 w-3.5" />}
      </a>
    </div>
  );
}

// ── Spotlight & Tooltip utilities ─────────────────────────────────────────────

function useElementRect(selector: string | null, active: boolean) {
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  React.useEffect(() => {
    if (!selector || !active) { setRect(null); return; }
    let mounted = true;

    function update() {
      if (!mounted) return;
      const el = document.querySelector(selector!);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
          setTimeout(() => {
            if (mounted) {
              const r2 = el.getBoundingClientRect();
              setRect(r2);
            }
          }, 400);
        } else {
          setRect(r);
        }
      } else {
        setRect(null);
      }
    }

    update();
    const interval = setInterval(update, 250);
    const stop = setTimeout(() => clearInterval(interval), 4000);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      mounted = false;
      clearInterval(interval);
      clearTimeout(stop);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [selector, active]);

  return rect;
}

const OVERLAY_Z = 9000;
const GLOW_Z = 9001;
const TOOLTIP_Z = 9002;
const PAD = 10;

function SpotlightOverlay({
  selector,
  onBackdropClick,
}: {
  selector: string | null;
  onBackdropClick?: () => void;
}) {
  const rect = useElementRect(selector, !!selector);

  const bg: React.CSSProperties = {
    position: "fixed",
    backgroundColor: "rgba(0,0,0,0.62)",
    zIndex: OVERLAY_Z,
    pointerEvents: "auto",
  };

  if (!selector) {
    return <div style={{ ...bg, inset: 0 }} onClick={onBackdropClick} />;
  }

  if (!rect) {
    return <div style={{ ...bg, inset: 0 }} onClick={onBackdropClick} />;
  }

  const top = Math.max(0, rect.top - PAD);
  const left = Math.max(0, rect.left - PAD);
  const right = rect.right + PAD;
  const bottom = rect.bottom + PAD;
  const w = right - left;
  const h = bottom - top;

  return (
    <>
      {top > 0 && (
        <div
          style={{ ...bg, top: 0, left: 0, right: 0, height: top }}
          onClick={onBackdropClick}
        />
      )}
      <div
        style={{ ...bg, top: bottom, left: 0, right: 0, bottom: 0 }}
        onClick={onBackdropClick}
      />
      {left > 0 && (
        <div
          style={{ ...bg, top, left: 0, width: left, height: h }}
          onClick={onBackdropClick}
        />
      )}
      <div
        style={{ ...bg, top, left: right, right: 0, height: h }}
        onClick={onBackdropClick}
      />
      {/* Animated glow ring */}
      <div
        style={{
          position: "fixed",
          zIndex: GLOW_Z,
          pointerEvents: "none",
          top,
          left,
          width: w,
          height: h,
          borderRadius: 14,
          boxShadow:
            "0 0 0 3px hsl(221, 83%, 60%), 0 0 28px rgba(59,130,246,0.45)",
          animation: "demo_ring_pulse 2s ease-in-out infinite",
        }}
      />
    </>
  );
}

// ── Tooltip step configs ──────────────────────────────────────────────────────

interface StepCfg {
  selector: string | null;
  title: string;
  body: string;
  nextLabel: string;
  stepNum: number;
  isFinal?: boolean;
}

function getStepCfg(step: number, location: string): StepCfg | null {
  if (step === 1 && location === "/dashboard") {
    return {
      selector: '[data-demo-target="action-required"]',
      title: "Your Action Required Dashboard",
      body: "Right now there is a flagged invoice — your electrical sub invoiced $6,500 over their approved contract amount. SubDraw caught it automatically before anyone approved it. Tap the item or click below to see it.",
      nextLabel: "View Flagged Invoice →",
      stepNum: 1,
    };
  }
  if (step === 2 && location.startsWith("/subcontracts/")) {
    return {
      selector: '[data-demo-target="back-to-project"]',
      title: "One Project, Many Moving Parts",
      body: "This invoice is on the Mountain View Medical Office project. Every subcontractor on this job has a live financial scoreboard — the same numbers the GC and sub both see in real time. Tap to see the full project.",
      nextLabel: "See the Full Project →",
      stepNum: 2,
    };
  }
  if (step === 3 && location.startsWith("/projects/")) {
    return {
      selector: '[data-demo-target="subcontract-cards"]',
      title: "Live Financial Scoreboard",
      body: "These are your subcontracts. Each card shows the base contract, approved change orders, total invoiced, and remaining balance updated in real time. Tap any card to see the full scoreboard.",
      nextLabel: "Open a Subcontract →",
      stepNum: 2,
    };
  }
  if (step === 4 && location.startsWith("/subcontracts/")) {
    return {
      selector: '[data-demo-target="insurance-badges"]',
      title: "Insurance & License Tracking",
      body: 'SubDraw tracks insurance and license certificates for every sub. Red means expired — this sub cannot be paid until their certificate is updated. Green means valid. You get alerts 30 days before anything expires so you\'re never caught off guard.',
      nextLabel: "See the Full Summary →",
      stepNum: 3,
    };
  }
  if (step === 5) {
    return {
      selector: null,
      title: "You Just Saw What Protects GCs",
      body: "Flagged invoices caught before approval. Live scoreboards both sides trust. Insurance tracked automatically. This is SubDraw on a real project. Ready to use it on your own jobs?",
      nextLabel: "Sign Up Free — No Credit Card Required",
      stepNum: 3,
      isFinal: true,
    };
  }
  return null;
}

// ── Desktop Tooltip ───────────────────────────────────────────────────────────

function computeTooltipPos(
  rect: DOMRect | null
): React.CSSProperties {
  const W = 340;
  const H_EST = 230;
  const GAP = 14;
  const EDGE = 12;

  if (!rect) {
    return { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: W, zIndex: TOOLTIP_Z };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = rect.left + rect.width / 2 - W / 2;
  left = Math.max(EDGE, Math.min(left, vw - W - EDGE));

  if (rect.bottom + GAP + H_EST < vh) {
    return { position: "fixed", top: rect.bottom + GAP, left, width: W, zIndex: TOOLTIP_Z };
  } else if (rect.top - GAP - H_EST > 0) {
    return { position: "fixed", top: rect.top - GAP - H_EST, left, width: W, zIndex: TOOLTIP_Z };
  } else {
    return { position: "fixed", top: EDGE, left, width: W, zIndex: TOOLTIP_Z };
  }
}

function TooltipInner({
  cfg,
  onNext,
  onSkip,
}: {
  cfg: StepCfg;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-primary uppercase tracking-widest">
          Step {cfg.stepNum} of 3
        </span>
        <button onClick={onSkip} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <h3 className="text-base font-bold text-foreground leading-tight">{cfg.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{cfg.body}</p>
      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
      >
        {cfg.nextLabel}
      </button>
      <div className="flex justify-center">
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          Skip Tour
        </button>
      </div>
    </div>
  );
}

function FinalCTAContent({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="h-14 w-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <CheckCircle2 className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold font-display text-foreground leading-tight">
          You Just Saw What Protects GCs
        </h2>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">
        {[
          "Flagged invoices caught before approval",
          "Live scoreboards both sides trust",
          "Insurance tracked automatically",
        ].map((item) => (
          <div key={item} className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <span>{item}</span>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground text-center">
        This is SubDraw on a real project. Ready to use it on your own jobs?
      </p>
      <a
        href={SIGNUP_PATH}
        className="block w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl text-base text-center transition-colors"
      >
        Sign Up Free — No Credit Card Required
      </a>
      <button
        onClick={onSkip}
        className="block w-full text-sm text-muted-foreground hover:text-foreground text-center py-1 transition-colors"
      >
        Keep Exploring the Demo
      </button>
    </div>
  );
}

// ── Main Overlay Component ────────────────────────────────────────────────────

export function DemoWalkthroughOverlay() {
  const ctx = useDemo();
  const [location, setLocation] = useLocation();
  const [isMobile, setIsMobile] = React.useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  const [sheetVisible, setSheetVisible] = React.useState(false);

  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Animate bottom sheet in on mount
  React.useEffect(() => {
    const t = requestAnimationFrame(() => setSheetVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  if (!ctx || !ctx.isDemoGC) return null;

  const { wt, setStep, skipTour } = ctx;

  // ── Navigation detection ───────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useEffect(() => {
    if (!ctx.isDemoGC) return;

    const step = wt.step;

    // Auto-start on dashboard
    if (step === 0 && location === "/dashboard") {
      const t = setTimeout(() => setStep(1), 1500);
      return () => clearTimeout(t);
    }

    // Step 1 → 3: user navigated to a project page
    if (step === 1 && location.startsWith("/projects/")) {
      setStep(3);
    }

    // Step 2 → 3: user navigated to a project page (clicked Back to Project)
    if (step === 2 && location.startsWith("/projects/")) {
      setStep(3);
    }

    // Step 3 → 4: user opened a subcontract from project
    if (step === 3 && location.startsWith("/subcontracts/")) {
      setStep(4);
    }

    // Billing redirect
    if (location === "/billing" || location === "/pricing") {
      setLocation(SIGNUP_PATH);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // ── Contacts toast ─────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useEffect(() => {
    if (!ctx.isDemoGC || location !== "/contacts") return;
    const id = toast(
      (t) => (
        <div className="flex items-start gap-3 max-w-xs">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Contact book is empty in the demo.</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              On your real account, every sub you invite is saved here automatically. Sign up to start building yours.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            <a href={SIGNUP_PATH} className="text-xs font-bold text-primary hover:underline whitespace-nowrap">
              Sign Up
            </a>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ),
      { duration: 8000, id: "demo-contacts-toast" }
    );
    return () => toast.dismiss(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // ── Highlight first flagged invoice when on step 1 ─────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useEffect(() => {
    if (wt.step !== 1 || location !== "/dashboard") return;
    const el = document.querySelector('[data-demo-target="action-required"] a[href]');
    if (el) {
      el.classList.add("demo-item-pulse");
      return () => el.classList.remove("demo-item-pulse");
    }
  }, [wt.step, location]);

  // ── Compute what to show ───────────────────────────────────────────────────
  if (wt.skipped || wt.step >= 6) return null;

  const cfg = getStepCfg(wt.step, location);
  if (!cfg) return null;

  // Resolve the "Next" action for each step
  function handleNext() {
    if (!cfg) return;

    if (wt.step === 1) {
      const projectLink = document.querySelector(
        'a[href^="/projects/"]'
      ) as HTMLAnchorElement | null;
      if (projectLink) {
        projectLink.click();
      }
      return; // Step advances via navigation detection
    }

    if (wt.step === 2) {
      const link = document.querySelector(
        '[data-demo-target="back-to-project"]'
      ) as HTMLAnchorElement | null;
      if (link) link.click();
      return;
    }

    if (wt.step === 3) {
      const link = document.querySelector(
        '[data-demo-target="subcontract-cards"] a[href*="subcontracts"]'
      ) as HTMLAnchorElement | null;
      if (link) link.click();
      return;
    }

    if (wt.step === 4) {
      setStep(5);
      return;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const isFullDimCTA = cfg.isFinal;
  const isMobileSheet = isMobile && !isFullDimCTA;
  const rect = cfg.selector
    ? document.querySelector(cfg.selector)?.getBoundingClientRect() ?? null
    : null;
  const tooltipStyle = computeTooltipPos(rect);

  return (
    <>
      {/* Injected keyframes */}
      <style>{`
        @keyframes demo_ring_pulse {
          0%, 100% { box-shadow: 0 0 0 3px hsl(221,83%,60%), 0 0 16px rgba(59,130,246,0.35); }
          50% { box-shadow: 0 0 0 5px hsl(221,83%,60%), 0 0 32px rgba(59,130,246,0.65); }
        }
        @keyframes demo_sheet_up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes demo_item_pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
          50% { box-shadow: 0 0 0 6px rgba(239,68,68,0.35); }
        }
        .demo-item-pulse {
          animation: demo_item_pulse 1.4s ease-in-out infinite !important;
          border-radius: 10px;
        }
      `}</style>

      {/* Spotlight overlay */}
      <SpotlightOverlay selector={cfg.selector} />

      {/* Final CTA — centered modal */}
      {isFullDimCTA && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: TOOLTIP_Z,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            pointerEvents: "none",
          }}
        >
          <div
            className="bg-card rounded-2xl shadow-2xl border w-full max-w-md p-6 pointer-events-auto"
            style={{ position: "relative" }}
          >
            <button
              onClick={skipTour}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <FinalCTAContent onSkip={() => setStep(6)} />
          </div>
        </div>
      )}

      {/* Mobile bottom sheet */}
      {!isFullDimCTA && isMobileSheet && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: TOOLTIP_Z,
            animation: "demo_sheet_up 0.35s cubic-bezier(0.32,0.72,0,1) both",
          }}
        >
          <div className="bg-card rounded-t-2xl border-t border-x shadow-2xl p-5 pb-7">
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
            <TooltipInner cfg={cfg} onNext={handleNext} onSkip={skipTour} />
          </div>
        </div>
      )}

      {/* Desktop floating tooltip */}
      {!isFullDimCTA && !isMobileSheet && (
        <div style={tooltipStyle}>
          <div className="bg-card rounded-2xl shadow-2xl border p-5">
            <TooltipInner cfg={cfg} onNext={handleNext} onSkip={skipTour} />
          </div>
        </div>
      )}
    </>
  );
}
