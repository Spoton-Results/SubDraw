import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const GATE_STORAGE_KEY = "subtracker_demo_gate_passed";
const GATE_SESSION_KEY = "subtracker_demo_gate_seen";

export function isDemoGatePassed(): boolean {
  try {
    if (localStorage.getItem(GATE_STORAGE_KEY) === "true") return true;
    if (sessionStorage.getItem(GATE_SESSION_KEY) === "true") return true;
  } catch {}
  return false;
}

export function markDemoGateSeen() {
  try {
    sessionStorage.setItem(GATE_SESSION_KEY, "true");
  } catch {}
}

interface DemoGateModalProps {
  onComplete: () => void;
  onSkip: () => void;
}

const BENEFITS = [
  "The live financial scoreboard both you and your sub see simultaneously",
  "Insurance certificates tracked with automatic expiry alerts",
  "Change orders locked in writing before any money moves",
  "Complete payment history with signed lien waivers",
];

export function DemoGateModal({ onComplete, onSkip }: DemoGateModalProps) {
  const [firstName, setFirstName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"GC" | "SUB" | "">("");
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<{ firstName?: string; email?: string; role?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!firstName.trim()) e.firstName = "Please enter your first name";
    if (!email.trim()) {
      e.email = "Please enter your work email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.email = "Please enter a valid email address";
    }
    if (!role) e.role = "Please select your role";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);

    try {
      let sessionId = "";
      try { sessionId = sessionStorage.getItem("subtracker_session_id") ?? ""; } catch {}
      if (!sessionId) {
        sessionId = Math.random().toString(36).slice(2);
        try { sessionStorage.setItem("subtracker_session_id", sessionId); } catch {}
      }

      const res = await fetch(`${BASE}/api/demo-leads`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          email: email.trim(),
          role,
          sessionId,
          referrer: document.referrer || window.location.href,
        }),
      });

      if (!res.ok) throw new Error("Demo gate submission failed");

      // Mark gate passed forever on this device
      try {
        localStorage.setItem(GATE_STORAGE_KEY, "true");
        sessionStorage.setItem(GATE_SESSION_KEY, "true");
      } catch {}

      onComplete();
    } catch {
      setErrors(prev => ({ ...prev, email: "We could not open the demo. Please try again." }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    markDemoGateSeen();
    onSkip();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Top accent */}
        <div className="h-1 w-full bg-gradient-to-r from-orange-400 to-orange-600" />

        <div className="p-7">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-bold uppercase tracking-wider mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            You just saw it work
          </div>

          {/* Heading */}
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white leading-snug mb-2">
            SubDraw just caught a $6,500 overrun before anyone approved it.
          </h2>

          {/* Body */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 leading-relaxed">
            On your real jobs this check runs automatically on every invoice the moment your sub submits it. Enter your email to see the full demo — the live scoreboard, insurance tracking, and the complete payment trail.
          </p>

          {/* Benefits */}
          <ul className="space-y-2 mb-6">
            {BENEFITS.map(b => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle2 className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                {b}
              </li>
            ))}
          </ul>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            {/* First name */}
            <div>
              <input
                type="text"
                value={firstName}
                onChange={e => { setFirstName(e.target.value); setErrors(prev => ({ ...prev, firstName: undefined })); }}
                placeholder="Your first name"
                className={`w-full px-4 py-3 rounded-xl border text-sm bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors ${errors.firstName ? "border-red-400 focus:ring-red-300" : "border-gray-200 dark:border-zinc-700 focus:ring-orange-300 focus:border-orange-400"}`}
              />
              {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
            </div>

            {/* Email */}
            <div>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })); }}
                placeholder="Your work email"
                className={`w-full px-4 py-3 rounded-xl border text-sm bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors ${errors.email ? "border-red-400 focus:ring-red-300" : "border-gray-200 dark:border-zinc-700 focus:ring-orange-300 focus:border-orange-400"}`}
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>

            {/* Role toggle */}
            <div>
              <div className="flex gap-2">
                {(["GC", "SUB"] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { setRole(r); setErrors(prev => ({ ...prev, role: undefined })); }}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                      role === r
                        ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                        : "border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:border-orange-300"
                    }`}
                  >
                    {r === "GC" ? "I'm a GC" : "I'm a Sub"}
                  </button>
                ))}
              </div>
              {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-70 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm mt-1"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              See the Full Demo →
            </button>
          </form>

          {/* Skip */}
          <div className="text-center mt-4">
            <button
              onClick={handleSkip}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors underline underline-offset-2"
            >
              Skip for now — I just want to look around
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
