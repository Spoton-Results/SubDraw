import * as React from "react";
import { HardHat, PauseCircle, LogOut } from "lucide-react";

interface PausedScreenProps {
  companyName: string;
  onLogout: () => void;
}

export function PausedScreen({ companyName, onLogout }: PausedScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="flex items-center gap-2 text-2xl font-bold font-display text-primary mb-12">
        <HardHat className="h-7 w-7" />
        SubDraw
      </div>
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-lg text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-900/30 mb-6">
          <PauseCircle className="h-8 w-8 text-orange-600" />
        </div>
        <h1 className="text-xl font-bold mb-3">Account Paused</h1>
        <p className="text-muted-foreground text-sm mb-2">
          <span className="font-semibold text-foreground">{companyName}</span>'s account has been temporarily paused by our team.
        </p>
        <p className="text-muted-foreground text-sm mb-8">
          Please contact <a href="mailto:support@subtrackers.com" className="text-primary hover:underline">support@subtrackers.com</a> for assistance.
        </p>
        <button
          onClick={onLogout}
          className="flex items-center justify-center gap-2 w-full border border-border rounded-xl py-2.5 text-sm font-medium hover:bg-secondary transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
