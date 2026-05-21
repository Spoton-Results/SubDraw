import * as React from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HardHat, HardHat as HardHatIcon, Building2, Loader2, Mail, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

const BASE = import.meta.env.BASE_URL;

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  usePageTitle("Sign In");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetMe({ query: { retry: false, staleTime: 30_000 } });
  const login = useLogin();
  const [demoLoading, setDemoLoading] = React.useState<"GC" | "SUB" | null>(null);
  // Track that we've already triggered a redirect so the useEffect doesn't race
  const didRedirect = React.useRef(false);

  const [magicEmail, setMagicEmail] = React.useState("");
  const [magicSent, setMagicSent] = React.useState(false);
  const [magicLoading, setMagicLoading] = React.useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  React.useEffect(() => {
    const params = new URLSearchParams(search);
    const error = params.get("error");
    if (error === "link_expired") {
      toast.error("That login link has expired. Request a new one below.");
    } else if (error === "link_used") {
      toast.error("That login link has already been used. Request a new one below.");
    } else if (error === "invalid_link") {
      toast.error("Invalid login link. Please request a new one.");
    }
  }, [search]);

  // Only auto-redirect if we haven't already manually redirected (prevents race)
  React.useEffect(() => {
    if (!isLoading && user && !didRedirect.current) {
      didRedirect.current = true;
      setLocation("/dashboard");
    }
  }, [user, isLoading, setLocation]);

  const finishLoginRedirect = async (fallbackUser?: unknown) => {
    const loginUser = fallbackUser as any;
    // Mark redirect as in-progress so the useEffect above won't double-fire
    didRedirect.current = true;
    if (loginUser) queryClient.setQueryData(getGetMeQueryKey(), loginUser);

    toast.success("Welcome back!");
    setLocation("/dashboard");
    // Refresh session data in the background after navigation
    window.setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }).catch(() => {});
    }, 500);
  };

  const onSubmit = async (data: LoginForm) => {
    try {
      const response = await login.mutateAsync({ data });
      await finishLoginRedirect(response?.user);
    } catch (e: any) {
      toast.error(e?.data?.error || e?.message || "Login failed");
    }
  };

  const handleDemoLogin = async (role: "GC" | "SUB") => {
    if (demoLoading) return;
    setDemoLoading(role);
    toast.dismiss();
    fetch(`${BASE}api/analytics/demo-click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    }).catch(() => {});

    let didNavigate = false;
    try {
      const res = await fetch(`${BASE}api/auth/demo-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      let body: any = null;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        body = await res.json();
      } else {
        const text = await res.text();
        console.error("[demo-login] Non-JSON response:", res.status, text.slice(0, 200));
      }
      if (!res.ok) {
        toast.error(body?.error || `Demo login failed (${res.status}). Please try again.`);
        return;
      }

      localStorage.setItem("subdraw_demo_mode", "true");
      localStorage.setItem("subdraw_demo_role", role);
      if (body?.user) queryClient.setQueryData(getGetMeQueryKey(), body.user);
      toast.success(`Exploring as demo ${role === "GC" ? "General Contractor" : "Subcontractor"}`);
      didNavigate = true;
      didRedirect.current = true;
      setLocation("/dashboard");
      window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }).catch(() => {});
      }, 500);
    } catch (err: any) {
      console.error("[demo-login] fetch error:", err?.message);
      toast.error("Demo login failed. Check your connection and try again.");
    } finally {
      if (!didNavigate) setDemoLoading(null);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicEmail.trim()) return;
    setMagicLoading(true);
    try {
      const res = await fetch(`${BASE}api/auth/magic-link/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: magicEmail.trim() }),
      });
      if (res.ok) {
        setMagicSent(true);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setMagicLoading(false);
    }
  };

  // Show spinner while checking existing session (not blank screen)
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100dvh",
          background: "hsl(var(--background))",
        }}
      >
        <Loader2
          style={{ width: 36, height: 36, animation: "spin 0.7s linear infinite" }}
          className="text-primary animate-spin"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:block relative">
        <img
          src={`${import.meta.env.BASE_URL}images/login-bg.png`}
          alt="Abstract construction site"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-12 text-white">
          <h2 className="text-4xl font-bold font-display mb-4">Build Better, Together.</h2>
          <p className="text-lg text-white/80 max-w-md">The modern subcontract management platform for GCs and Subcontractors.</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-2 text-primary">
            <div className="bg-primary text-white p-3 rounded-2xl shadow-lg shadow-primary/30">
              <HardHat className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold font-display text-foreground">SubDraw</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Subcontract management built for modern GCs</p>

          <div className="rounded-2xl border border-border bg-secondary/40 p-4 mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Try the interactive demo — no sign-up needed
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="default"
                className="gap-2"
                onClick={() => handleDemoLogin("GC")}
                disabled={demoLoading !== null}
              >
                {demoLoading === "GC" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
                Demo as GC
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-green-500 text-green-700 hover:bg-green-50 hover:text-green-800"
                onClick={() => handleDemoLogin("SUB")}
                disabled={demoLoading !== null}
              >
                {demoLoading === "SUB" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <HardHatIcon className="h-4 w-4" />
                )}
                Demo as Sub
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-4 w-4 text-primary shrink-0" />
              <p className="text-sm font-semibold text-foreground">Get a login link — no password needed</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Enter your email and we'll send you a one-click login link.</p>
            {magicSent ? (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">Check your email</p>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                    If <strong>{magicEmail}</strong> is registered, a login link is on its way. It's valid for 72 hours.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={magicEmail}
                  onChange={e => setMagicEmail(e.target.value)}
                  required
                  className="flex-1"
                />
                <Button type="submit" isLoading={magicLoading} className="shrink-0 whitespace-nowrap">
                  Send link
                </Button>
              </form>
            )}
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or sign in with password</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <h2 className="text-2xl font-bold mb-2">Welcome back</h2>
          <p className="text-muted-foreground mb-6">Enter your credentials to access your account</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Input
                placeholder="Email address"
                {...register("email")}
              />
              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                {...register("password")}
              />
              {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
            </div>

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-primary font-semibold hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full mt-2"
              isLoading={login.isPending}
            >
              Sign In
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            You only need to log in once — we remember you on this device.
          </p>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline">
              Start your free 7-day trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
