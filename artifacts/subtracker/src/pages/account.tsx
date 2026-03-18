import * as React from "react";
import { Layout } from "@/components/layout";
import {
  useGetMe, useUpdateProfile, useChangePassword, getGetMeQueryKey
} from "@workspace/api-client-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, User, KeyRound, Building2, Lock } from "lucide-react";
import toast from "react-hot-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function Account() {
  usePageTitle("Account Settings");
  const { data: user } = useGetMe();
  const queryClient = useQueryClient();

  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [companyName, setCompanyName] = React.useState(user?.companyName ?? "");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);

  const [setNewPwd, setSetNewPwd] = React.useState("");
  const [setConfirmPwd, setSetConfirmPwd] = React.useState("");
  const [showSetNew, setShowSetNew] = React.useState(false);
  const [setPasswordLoading, setSetPasswordLoading] = React.useState(false);

  React.useEffect(() => {
    if (user?.companyName) setCompanyName(user.companyName);
  }, [user?.companyName]);

  const hasPassword = (user as any)?.hasPassword ?? true;

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return toast.error("Company name cannot be empty");
    try {
      await updateProfile.mutateAsync({ data: { companyName: companyName.trim() } });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast.success("Profile updated!");
    } catch (err: any) {
      toast.error(err?.data?.error || "Failed to update profile");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error("New password must be at least 8 characters");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match");
    try {
      await changePassword.mutateAsync({ data: { currentPassword, newPassword } });
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.data?.error || "Failed to change password");
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setNewPwd.length < 8) return toast.error("Password must be at least 8 characters");
    if (setNewPwd !== setConfirmPwd) return toast.error("Passwords do not match");
    setSetPasswordLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword: setNewPwd }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || "Failed to set password");
        return;
      }
      toast.success("Password set successfully! You can now log in with your email and password.");
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setSetNewPwd("");
      setSetConfirmPwd("");
    } catch {
      toast.error("Failed to set password. Please try again.");
    } finally {
      setSetPasswordLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile and security settings</p>
      </div>

      <div className="max-w-2xl space-y-8">
        {/* PROFILE INFO CARD */}
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted/40 rounded-xl border border-border/50">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                {user.companyName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold">{user.companyName}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <Badge variant={user.role === "GC" ? "default" : "secondary"} className="ml-auto">
                {user.role}
              </Badge>
            </div>

            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1.5 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" /> Company Name
                </label>
                <Input
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Your company name"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block text-muted-foreground">Email address</label>
                <Input value={user.email} disabled className="bg-muted/50 text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed.</p>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  isLoading={updateProfile.isPending}
                  disabled={companyName === user.companyName}
                  className="w-full sm:w-auto min-h-[44px]"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* SET PASSWORD CARD — shown for magic-link-only users */}
        {!hasPassword && (
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" /> Set a Password
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                You currently log in via magic link. Set a password if you prefer traditional login.
              </p>
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">New password</label>
                  <div className="relative">
                    <Input
                      type={showSetNew ? "text" : "password"}
                      required
                      placeholder="At least 8 characters"
                      value={setNewPwd}
                      onChange={e => setSetNewPwd(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSetNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Confirm new password</label>
                  <Input
                    type="password"
                    required
                    placeholder="Repeat your new password"
                    value={setConfirmPwd}
                    onChange={e => setSetConfirmPwd(e.target.value)}
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" isLoading={setPasswordLoading} className="w-full sm:w-auto min-h-[44px]">
                    Set Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* CHANGE PASSWORD CARD — shown for users who already have a password */}
        {hasPassword && (
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" /> Change Password
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Current password</label>
                  <div className="relative">
                    <Input
                      type={showCurrent ? "text" : "password"}
                      required
                      placeholder="Enter your current password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
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
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">New password</label>
                  <div className="relative">
                    <Input
                      type={showNew ? "text" : "password"}
                      required
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Confirm new password</label>
                  <Input
                    type="password"
                    required
                    placeholder="Repeat your new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" isLoading={changePassword.isPending} className="w-full sm:w-auto min-h-[44px]">
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
