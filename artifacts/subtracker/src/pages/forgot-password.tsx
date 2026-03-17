import * as React from "react";
import { Link } from "wouter";
import { useForgotPassword } from "@workspace/api-client-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HardHat, ArrowLeft, MailCheck } from "lucide-react";
import toast from "react-hot-toast";

export default function ForgotPassword() {
  usePageTitle("Forgot Password");
  const [email, setEmail] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const forgotPassword = useForgotPassword();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await forgotPassword.mutateAsync({ data: { email } });
      setSubmitted(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:block relative">
        <img
          src={`${import.meta.env.BASE_URL}images/login-bg.png`}
          alt="Construction site"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-12 text-white">
          <h2 className="text-4xl font-bold font-display mb-4">Build Better, Together.</h2>
          <p className="text-lg text-white/80 max-w-md">The modern subcontract management platform for GCs and Subcontractors.</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 text-primary">
            <div className="bg-primary text-white p-3 rounded-2xl shadow-lg shadow-primary/30">
              <HardHat className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold font-display text-foreground">SubTracker</h1>
          </div>

          {submitted ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 mb-6">
                <MailCheck className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Check your email</h2>
              <p className="text-muted-foreground mb-6">
                If <strong>{email}</strong> has an account, you'll receive a password reset link shortly. The link expires in 1 hour.
              </p>
              <Link href="/login" className="text-primary font-semibold hover:underline flex items-center justify-center gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-2">Forgot your password?</h2>
              <p className="text-muted-foreground mb-8">Enter your email and we'll send you a link to reset your password.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Input
                    type="email"
                    required
                    placeholder="Email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" isLoading={forgotPassword.isPending}>
                  Send Reset Link
                </Button>
              </form>

              <p className="mt-8 text-center text-sm text-muted-foreground">
                <Link href="/login" className="text-primary font-semibold hover:underline flex items-center justify-center gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
