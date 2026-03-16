import * as React from "react";
import { useRoute } from "wouter";
import { Layout } from "@/components/layout";
import { useGetProject, useGetMe, useInviteSubcontractor, useSubmitBid, useAwardBid, getGetProjectQueryKey, useGetProjectPlanFiles, useAddPlanFile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { Mail, DollarSign, Building, Award, Plus, FileSignature, FileText, ExternalLink, ChevronRight, Copy, Check, KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "wouter";

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const projectId = params?.id || "";
  
  const { data: user } = useGetMe();
  const { data: project, isLoading } = useGetProject(projectId);
  const queryClient = useQueryClient();

  const inviteSub = useInviteSubcontractor();
  const submitBid = useSubmitBid();
  const awardBid = useAwardBid();
  const addPlanFile = useAddPlanFile();
  const { data: planFiles = [], refetch: refetchPlans } = useGetProjectPlanFiles(projectId);

  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteCompanyName, setInviteCompanyName] = React.useState("");
  const [inviteResult, setInviteResult] = React.useState<{ temporaryPassword: string; email: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  const [isBidOpen, setIsBidOpen] = React.useState(false);
  const [bidAmount, setBidAmount] = React.useState("");

  const [isPlanOpen, setIsPlanOpen] = React.useState(false);
  const [planUrl, setPlanUrl] = React.useState("");
  const [planDescription, setPlanDescription] = React.useState("");

  if (isLoading || !project || !user) {
    return <Layout><div className="animate-pulse h-64 bg-card rounded-2xl"></div></Layout>;
  }

  const isGC = user.role === "GC";
  const myBid = project.bids?.find(b => b.subId === user.id);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await inviteSub.mutateAsync({ projectId, data: { email: inviteEmail, companyName: inviteCompanyName } });
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });

      if (result.isNewUser && result.temporaryPassword) {
        setInviteResult({ temporaryPassword: result.temporaryPassword, email: inviteEmail });
        toast.success("Account created and sub added to project!");
      } else {
        toast.success("Subcontractor added to project!");
        setIsInviteOpen(false);
        setInviteEmail("");
        setInviteCompanyName("");
      }
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || "Failed to send invite";
      toast.error(msg);
    }
  };

  const handleInviteClose = () => {
    setIsInviteOpen(false);
    setInviteEmail("");
    setInviteCompanyName("");
    setInviteResult(null);
    setCopied(false);
  };

  const handleCopyPassword = () => {
    if (inviteResult) {
      navigator.clipboard.writeText(inviteResult.temporaryPassword).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) return toast.error("Invalid amount");
    try {
      await submitBid.mutateAsync({ projectId, data: { amount } });
      toast.success("Bid submitted successfully!");
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      setIsBidOpen(false);
    } catch {
      toast.error("Failed to submit bid");
    }
  };

  const handleAward = async (bidId: string) => {
    try {
      await awardBid.mutateAsync({ projectId, bidId });
      toast.success("Bid awarded and subcontract created!");
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
    } catch {
      toast.error("Failed to award bid");
    }
  };

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addPlanFile.mutateAsync({ projectId, data: { fileUrl: planUrl, description: planDescription } });
      toast.success("Plan file added!");
      refetchPlans();
      setIsPlanOpen(false);
      setPlanUrl("");
      setPlanDescription("");
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || "Failed to add plan file";
      toast.error(msg);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-card p-6 rounded-2xl border border-border/50 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold font-display">{project.name}</h1>
            <Badge variant={project.status === 'ACTIVE' ? 'success' : project.status === 'BIDDING' ? 'default' : 'secondary'}>
              {project.status}
            </Badge>
          </div>
          <p className="text-muted-foreground flex items-center gap-2">
            <Building className="h-4 w-4" /> {project.gc?.companyName}
          </p>
        </div>
        
        {isGC && project.status === "BIDDING" && (
          <Button onClick={() => setIsInviteOpen(true)} className="gap-2">
            <Mail className="h-5 w-5" />
            Invite Subcontractor
          </Button>
        )}

        {!isGC && project.status === "BIDDING" && !myBid && (
          <Button onClick={() => setIsBidOpen(true)} className="gap-2 bg-green-600 hover:bg-green-700 text-white shadow-green-600/30">
            <DollarSign className="h-5 w-5" />
            Submit Bid
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">

          {/* PLAN FILES SECTION */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Site Plans
                </CardTitle>
                {isGC && project.status === "BIDDING" && (
                  <Button size="sm" variant="outline" onClick={() => setIsPlanOpen(true)} className="gap-1.5">
                    <Plus className="h-4 w-4" /> Add Plan
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {planFiles.length === 0 ? (
                <p className="text-muted-foreground text-sm py-2">No plan files uploaded yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {planFiles.map((plan) => (
                    <li key={plan.id} className="flex items-center justify-between py-3 gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{plan.description}</span>
                      </div>
                      <a
                        href={plan.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-primary hover:underline shrink-0"
                      >
                        View <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* SUBCONTRACTS SECTION */}
          {(isGC || project.subcontracts?.some(s => s.subId === user.id)) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-primary" /> Active Subcontracts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(project.subcontracts?.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground py-4">No subcontracts awarded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {project.subcontracts
                      ?.filter(s => isGC || s.subId === user.id)
                      .map(sub => (
                      <Link key={sub.id} href={`/subcontracts/${sub.id}`}>
                        <div className="p-4 rounded-xl border border-border bg-background hover:border-primary/50 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group">
                          <div>
                            <p className="font-bold group-hover:text-primary transition-colors">{sub.sub?.companyName}</p>
                            <p className="text-sm text-muted-foreground mt-1">Base: {formatCurrency(sub.baseContractAmount)}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="group-hover:bg-primary/10">
                            <ChevronRight className="h-5 w-5" />
                          </Button>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* BIDS SECTION */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" /> Bids
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(project.bids?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground py-4 text-center">No bids submitted yet.</p>
              ) : (
                <div className="space-y-4">
                  {project.bids
                    ?.filter(b => isGC || b.subId === user.id)
                    .map(bid => (
                    <div key={bid.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-secondary/50 border border-border gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold">{isGC ? bid.sub?.companyName : "Your Bid"}</p>
                          <Badge variant={
                            bid.status === "AWARDED" ? "success" : 
                            bid.status === "REJECTED" ? "destructive" : "warning"
                          }>{bid.status}</Badge>
                        </div>
                        <p className="text-2xl font-bold font-display text-primary">{formatCurrency(bid.amount)}</p>
                      </div>
                      
                      {isGC && bid.status === "PENDING" && project.status === "BIDDING" && (
                        <Button 
                          onClick={() => handleAward(bid.id)} 
                          className="bg-green-600 hover:bg-green-700 text-white shadow-green-600/20"
                        >
                          <Award className="h-4 w-4 mr-2" /> Award
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
        </div>

        {/* MEMBERS SIDEBAR */}
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building className="h-5 w-5 text-primary" /> Project Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {project.members?.map(member => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm">
                      {member.user?.companyName?.charAt(0) ?? "?"}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{member.user?.companyName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{member.roleOnProject}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* GC Invite Dialog */}
      <Dialog
        open={isInviteOpen}
        onOpenChange={(open) => { if (!open) handleInviteClose(); }}
        title={inviteResult ? "Subcontractor Invited" : "Invite Subcontractor"}
        description={
          inviteResult
            ? "Share these credentials with the subcontractor so they can log in."
            : "Enter the subcontractor's email and company name. A new account will be created if they aren't registered yet."
        }
      >
        {inviteResult ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold">
                <KeyRound className="h-4 w-4" />
                Account created successfully
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Login email:</span>
                  <span className="font-mono font-medium">{inviteResult.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Temp password:</span>
                  <div className="flex items-center gap-2">
                    <code className="font-mono font-bold text-base bg-background border border-border px-2 py-0.5 rounded-md">
                      {inviteResult.temporaryPassword}
                    </code>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={handleCopyPassword}
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              An invitation email has been sent if your SMTP server is configured. The subcontractor will be prompted to set a new password on first login.
            </p>
            <div className="flex justify-end pt-1">
              <Button onClick={handleInviteClose}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-semibold mb-1 block">Email Address</label>
              <Input 
                type="email"
                required
                placeholder="sub@example.com" 
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">Company Name</label>
              <Input 
                type="text"
                required
                placeholder="ABC Electric LLC" 
                value={inviteCompanyName}
                onChange={e => setInviteCompanyName(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              If this subcontractor isn't in the system yet, an account will be created with a secure temporary password that you'll be able to share with them.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={handleInviteClose}>Cancel</Button>
              <Button type="submit" isLoading={inviteSub.isPending}>Add Subcontractor</Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Add Plan File Dialog */}
      <Dialog open={isPlanOpen} onOpenChange={setIsPlanOpen} title="Add Site Plan" description="Paste a URL to the plan document and add a brief description. Subcontractors will be able to view this before submitting their bid.">
        <form onSubmit={handleAddPlan} className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">Description</label>
            <Input
              type="text"
              required
              placeholder="e.g. Architectural Floor Plan - Level 1"
              value={planDescription}
              onChange={e => setPlanDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">File URL</label>
            <Input
              type="url"
              required
              placeholder="https://example.com/plans/floor-plan.pdf"
              value={planUrl}
              onChange={e => setPlanUrl(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsPlanOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={addPlanFile.isPending}>Add Plan</Button>
          </div>
        </form>
      </Dialog>

      {/* Sub Submit Bid Dialog */}
      <Dialog open={isBidOpen} onOpenChange={setIsBidOpen} title="Submit Bid" description="Enter your proposed amount for this project.">
        <form onSubmit={handleBidSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">Bid Amount ($)</label>
            <Input 
              type="number"
              step="0.01"
              required
              placeholder="50000.00" 
              value={bidAmount}
              onChange={e => setBidAmount(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsBidOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={submitBid.isPending}>Submit Bid</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
