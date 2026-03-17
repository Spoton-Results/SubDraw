import * as React from "react";
import { Link } from "wouter";
import { Clock, AlertTriangle } from "lucide-react";

interface TrialBannerProps {
  daysLeft: number;
  trialEndsAt: string | null;
}

export function TrialBanner({ daysLeft, trialEndsAt }: TrialBannerProps) {
  const isUrgent = daysLeft <= 4;
  const isCritical = daysLeft <= 1;

  const bgColor = isCritical
    ? "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-700"
    : isUrgent
    ? "bg-orange-50 border-orange-300 dark:bg-orange-950/30 dark:border-orange-700"
    : "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-700";

  const textColor = isCritical
    ? "text-red-800 dark:text-red-300"
    : isUrgent
    ? "text-orange-800 dark:text-orange-300"
    : "text-blue-800 dark:text-blue-200";

  const iconColor = isCritical ? "text-red-500" : isUrgent ? "text-orange-500" : "text-blue-500";

  const Icon = isUrgent ? AlertTriangle : Clock;

  const message =
    daysLeft === 0
      ? "Your free trial expires today"
      : daysLeft === 1
      ? "1 day left in your free trial"
      : `${daysLeft} days left in your free trial`;

  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 flex items-center gap-3 ${bgColor}`}>
      <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-semibold ${textColor}`}>{message}</span>
        {isUrgent && (
          <span className={`text-xs ml-2 ${textColor} opacity-80`}>
            — Choose a plan to keep your data and continue without interruption.
          </span>
        )}
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
