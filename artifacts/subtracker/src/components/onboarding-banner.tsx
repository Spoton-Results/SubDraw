import * as React from "react";
import { CheckCircle2, ChevronRight, X } from "lucide-react";

interface OnboardingBannerProps {
  role: "GC" | "SUB";
  onDismiss: () => void;
}

const GC_STEPS = [
  { number: 1, title: "Create a project", desc: "Set up your first job site with name, address, and start date." },
  { number: 2, title: "Invite subcontractors", desc: "Add subs by email — they get credentials automatically." },
  { number: 3, title: "Accept a bid", desc: "Review bids from subs and award the one that fits your budget." },
  { number: 4, title: "Manage construction", desc: "Approve change orders, review invoices, and track payments." },
];

const SUB_STEPS = [
  { number: 1, title: "View site plans", desc: "Download the plans your GC has uploaded for the project." },
  { number: 2, title: "Submit your bid", desc: "Enter your price and any notes for the GC to review." },
  { number: 3, title: "Manage invoices", desc: "Submit invoices, track approvals, and confirm payments." },
];

export function OnboardingBanner({ role, onDismiss }: OnboardingBannerProps) {
  const steps = role === "GC" ? GC_STEPS : SUB_STEPS;
  const title = role === "GC"
    ? "Welcome to SubTracker — here's how to get started"
    : "Welcome to SubTracker — here's how it works";

  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 mb-6 relative">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <h3 className="font-bold text-base text-foreground mb-4 pr-8">{title}</h3>

      <div className={`grid gap-3 ${role === "GC" ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
        {steps.map((step, i) => (
          <div key={step.number} className="flex items-start gap-3">
            <div className="flex items-center shrink-0">
              <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                {step.number}
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-primary/40 hidden lg:block ml-2" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">{step.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
