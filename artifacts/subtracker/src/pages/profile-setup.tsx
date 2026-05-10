import * as React from "react";
import { useUpsertMyProfile, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HardHat, Loader2, BriefcaseBusiness } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import toast from "react-hot-toast";

const TRADES = [
  "Concrete",
  "Demolition",
  "Earthwork / Grading",
  "Electrical",
  "Elevators",
  "Fire Protection",
  "Flooring",
  "Framing",
  "Glazing",
  "HVAC",
  "Insulation",
  "Landscaping",
  "Masonry",
  "Millwork / Casework",
  "Painting",
  "Plumbing",
  "Roofing",
  "Sitework",
  "Steel / Structural",
  "Tile",
  "Waterproofing",
  "Other",
];

interface ProfileSetupProps {
  onComplete: () => void;
}

function getBaseUrl() {
  return import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
}

export default function ProfileSetup({ onComplete }: ProfileSetupProps) {
  const upsert = useUpsertMyProfile();
  const qc = useQueryClient();
  const BASE_URL = getBaseUrl();
  const inviteProjectId = typeof window !== "undefined" ? sessionStorage.getItem("subdraw_invite_project_id") : null;
  const redirectPath = typeof window !== "undefined" ? sessionStorage.getItem("subdraw_post_login_redirect") : null;

  const { data: invitedProject } = useQuery<any>({
    queryKey: ["profile-setup-invite-project", inviteProjectId],
    queryFn: async () => {
      if (!inviteProjectId) return null;
      const res = await fetch(`${BASE_URL}/api/projects/${inviteProjectId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!inviteProjectId,
    staleTime: 30_000,
  });

  const [trade, setTrade] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [businessAddress, setBusinessAddress] = React.useState("");
  const [licenseNumber, setLicenseNumber] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trade) { toast.error("Please select your trade"); return; }
    try {
      await upsert.mutateAsync({ data: { trade, phone: phone || undefined, businessAddress: businessAddress || undefined, licenseNumber: licenseNumber || undefined } });
      await qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast.success("Profile saved!");
      if (redirectPath) {
        sessionStorage.removeItem("subdraw_invite_project_id");
        sessionStorage.removeItem("subdraw_post_login_redirect");
        window.location.replace(`${import.meta.env.BASE_URL}${redirectPath.replace(/^\//, "")}`);
        return;
      }
      onComplete();
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Failed to save profile");
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <HardHat className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold font-display text-primary">SubDraw</span>
          </div>
          <h1 className="text-xl font-bold mb-1">Set up your trade profile</h1>
          <p className="text-sm text-muted-foreground">Help GCs find you by completing your profile before continuing.</p>
        </div>

        {invitedProject ? (
          <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <BriefcaseBusiness className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-primary uppercase tracking-wide">Project Invite</p>
                <p className="font-bold text-foreground mt-0.5">{invitedProject.name}</p>
                {invitedProject.address ? <p className="text-sm text-muted-foreground mt-0.5">{invitedProject.address}</p> : null}
                <p className="text-xs text-muted-foreground mt-2">Complete your profile to continue into this project.</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="trade">Trade <span className="text-destructive">*</span></Label>
              <Select value={trade} onValueChange={setTrade}>
                <SelectTrigger id="trade">
                  <SelectValue placeholder="Select your trade…" />
                </SelectTrigger>
                <SelectContent className="max-h-56 overflow-y-auto">
                  {TRADES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="(555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Business Address</Label>
              <Input id="address" placeholder="123 Main St, City, State" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="license">License Number</Label>
              <Input id="license" placeholder="e.g. C-10-123456" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
            </div>

            <Button type="submit" className="w-full" disabled={upsert.isPending}>
              {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {redirectPath ? "Save Profile & Open Project" : "Save Profile & Continue"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
