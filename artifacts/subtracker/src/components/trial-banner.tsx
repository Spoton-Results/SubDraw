import * as React from "react";
import { Link } from "wouter";
import { Clock, AlertTriangle } from "lucide-react";

interface TrialBannerProps {
  daysLeft: number;
  trialEndsAt: string | null;
}

export function TrialBanner({ daysLeft, trialEndsAt }: TrialBannerProps) {
  const isRed = daysLeft < 3;
  const isYellow = !isRed && daysLeft < 7;

  const bgColor = isRed
    ? "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-700"
    : isYellow
    ? "bg-yellow-50 border-yellow-300 dark:bg-yellow-950/30 dark:border-yellow-700"
    : "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-700";

  const textColor = isRed
    ? "text-red-800 dark:text-red-300"
    : isYellow
    ? "text-yellow-800 dark:text-yellow-300"
    : "text-blue-800 dark:text-blue-200";

  const iconColor = isRed ? "text-red-500" : isYellow ? "text-yellow-500" : "text-blue-500";

  const Icon = isRed || isYellow ? AlertTriangle : Clock;

  const message =
    daysLeft === 0
      ? "Your free trial expires today — choose a plan to keep access"
      : daysLeft === 1
      ? "Your free trial ends in 1 day — choose a plan to keep access"
      : `Your free trial ends in ${daysLeft} days — choose a plan to keep access`;

  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 flex items-center gap-3 ${bgColor}`}>
      <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-semibold ${textColor}`}>{message}</span>
      </div>
      <Link
        href="/billing"
        className={`text-xs font-bold shrink-0 underline underline-offset-2 ${textColor}`}
      >
        Choose a plan →
      </Link>
    </div>
  );
}
