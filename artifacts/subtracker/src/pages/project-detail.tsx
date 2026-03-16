import * as React from "react";
import { useRoute } from "wouter";
import { Layout } from "@/components/layout";
import { useGetProject, useGetMe, useInviteSubcontractor, useSubmitBid, useAwardBid, getGetProjectQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { Mail, DollarSign, Building, Award, Plus, FileSignature } from "lucide-react";
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

  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");

  const [isBidOpen, setIsBidOpen] = React.useState(false);
  const [bidAmount, setBidAmount] = React.useState("");

  if (isLoading || !project || !user) {
    return <Layout><div className="animate-pulse h-64 bg-card rounded-2xl"></div></Layout>;
  }

  const isGC = user.role === "GC";
  const myBid = project.bids.find(b => b.subId === user.id);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inviteSub.mutateAsync({ projectId, data: { email: inviteEmail } });
      toast.success("Invitation sent!");
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      setIsInviteOpen(false);
      setInviteEmail("");
    } catch {
      toast.error("Failed to send invite");
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
            <Building className="h-4 w-4" /> {project.gc.companyName}
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
          
          {/* SUBCONTRACTS SECTION */}
          {(isGC || project.subcontracts.some(s => s.subId === user.id)) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-primary" /> Active Subcontracts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {project.subcontracts.length === 0 ? (
                  <p className="text-muted-foreground py-4">No subcontracts awarded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {project.subcontracts
                      .filter(s => isGC || s.subId === user.id)
                      .map(sub => (
                      <Link key={sub.id} href={`/subcontracts/${sub.id}`}>
                        <div className="p-4 rounded-xl border border-border bg-background hover:border-primary/50 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group">
                          <div>
                            <p className="font-bold group-hover:text-primary transition-colors">{sub.sub.companyName}</p>
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
              {project.bids.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center">No bids submitted yet.</p>
              ) : (
                <div className="space-y-4">
                  {project.bids
                    .filter(b => isGC || b.subId === user.id)
                    .map(bid => (
                    <div key={bid.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-secondary/50 border border-border gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold">{isGC ? bid.sub.companyName : "Your Bid"}</p>
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
                {project.members.map(member => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm">
                      {member.user.companyName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{member.user.companyName}</p>
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
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen} title="Invite Subcontractor" description="Send an email invite to a subcontractor.">
        <form onSubmit={handleInvite} className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">Subcontractor Email</label>
            <Input 
              type="email"
              required
              placeholder="sub@example.com" 
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={inviteSub.isPending}>Send Invite</Button>
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
