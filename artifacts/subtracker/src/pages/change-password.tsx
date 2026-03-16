import * as React from "react";
import { useChangePassword } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

interface ChangePasswordProps {
  onSuccess: () => void;
}

export default function ChangePassword({ onSuccess }: ChangePasswordProps) {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNext, setShowNext] = React.useState(false);

  const changePassword = useChangePassword();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (next !== confirm) {
      toast.error("New passwords do not match");
      return;
    }
    try {
      await changePassword.mutateAsync({ data: { currentPassword: current, newPassword: next } });
      toast.success("Password updated! Welcome to SubTracker.");
      onSuccess();
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || "Failed to change password";
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-display">Set Your Password</h1>
          <p className="text-muted-foreground mt-2">
            Your account was created with a temporary password. Please set a new password to continue.
          </p>
        </div>

        <Card className="border border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Choose a new password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Temporary password</label>
                <div className="relative">
                  <Input
                    type={showCurrent ? "text" : "password"}
                    placeholder="Enter your temporary password"
                    value={current}
                    onChange={e => setCurrent(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">New password</label>
                <div className="relative">
                  <Input
                    type={showNext ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={next}
                    onChange={e => setNext(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNext(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Confirm new password</label>
                <Input
                  type="password"
                  placeholder="Repeat your new password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={changePassword.isPending}
              >
                {changePassword.isPending ? "Saving…" : "Set new password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
