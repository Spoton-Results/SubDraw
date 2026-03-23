import * as React from "react";
import { useLocation } from "wouter";
import { HardHat, Loader2, Shield } from "lucide-react";
import toast from "react-hot-toast";

const BASE = import.meta.env.BASE_URL;

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    fetch(`${BASE}api/admin/me`, { credentials: "include" })
      .then(r => { if (r.ok) setLocation("/admin/dashboard"); })
      .finally(() => setChecking(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Login failed");
        return;
      }
      toast.success("Welcome, admin");
      setLocation("/admin/dashboard");
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary mb-4">
            <HardHat className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="flex items-center justify-center gap-2 text-foreground font-bold text-xl mb-1">
            SubTracker
          </div>
          <p className="text-muted-foreground text-sm flex items-center justify-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Super Admin Portal
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <h1 className="text-foreground font-bold text-xl mb-6 text-center">Admin Sign In</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-background border border-border text-foreground rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-background border border-border text-foreground rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-muted-foreground"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-muted-foreground text-xs mt-6">
          Restricted access — authorized personnel only
        </p>
      </div>
    </div>
  );
}
