import * as React from "react";
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout";
import { 
  useGetSubcontract, useGetMe, 
  useCreateChangeOrder, useApproveChangeOrder, useRejectChangeOrder,
  useSubmitInvoice, useApproveInvoice, useRejectInvoice, useOverrideInvoice,
  getGetSubcontractQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { formatCurrency, cn } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowLeft, Check, X, AlertTriangle, FileText, PlusCircle, Activity } from "lucide-react";
import toast from "react-hot-toast";

export default function SubcontractDetail() {
  const [, params] = useRoute("/subcontracts/:id");
  const subcontractId = params?.id || "";
  
  const { data: user } = useGetMe();
  const { data: sub, isLoading } = useGetSubcontract(subcontractId);
  const queryClient = useQueryClient();

  const createCO = useCreateChangeOrder();
  const approveCO = useApproveChangeOrder();
  const rejectCO = useRejectChangeOrder();
  
  const submitInv = useSubmitInvoice();
  const approveInv = useApproveInvoice();
  const rejectInv = useRejectInvoice();
  const overrideInv = useOverrideInvoice();

  const [coDialogOpen, setCoDialogOpen] = React.useState(false);
  const [coDesc, setCoDesc] = React.useState("");
  const [coAmount, setCoAmount] = React.useState("");

  const [invDialogOpen, setInvDialogOpen] = React.useState(false);
  const [invAmount, setInvAmount] = React.useState("");

  const [overrideDialogOpen, setOverrideDialogOpen] = React.useState<{open: boolean, id: string}>({open: false, id: ""});
  const [overrideReason, setOverrideReason] = React.useState("");

  if (isLoading || !sub || !user) {
    return <Layout><div className="animate-pulse h-64 bg-card rounded-2xl"></div></Layout>;
  }

  const isGC = user.role === "GC";
  const sb = sub.scoreboard;

  const handleCreateCO = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(coAmount);
    if (!coDesc || isNaN(amount)) return toast.error("Invalid input");
    try {
      await createCO.mutateAsync({ subcontractId, data: { description: coDesc, amount } });
      toast.success("Change order submitted");
      queryClient.invalidateQueries({ queryKey: getGetSubcontractQueryKey(subcontractId) });
      setCoDialogOpen(false);
      setCoDesc(""); setCoAmount("");
    } catch { toast.error("Failed to submit"); }
  };

  const handleActionCO = async (id: string, action: 'approve'|'reject') => {
    try {
      if (action === 'approve') await approveCO.mutateAsync({ subcontractId, changeOrderId: id });
      else await rejectCO.mutateAsync({ subcontractId, changeOrderId: id });
      toast.success(`Change order ${action}d`);
      queryClient.invalidateQueries({ queryKey: getGetSubcontractQueryKey(subcontractId) });
    } catch { toast.error("Action failed"); }
  };

  const handleSubmitInv = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(invAmount);
    if (isNaN(amount) || amount <= 0) return toast.error("Invalid amount");
    try {
      await submitInv.mutateAsync({ subcontractId, data: { amount } });
      toast.success("Invoice submitted");
      queryClient.invalidateQueries({ queryKey: getGetSubcontractQueryKey(subcontractId) });
      setInvDialogOpen(false);
      setInvAmount("");
    } catch { toast.error("Failed to submit invoice"); }
  };

  const handleActionInv = async (id: string, action: 'approve'|'reject') => {
    try {
      if (action === 'approve') await approveInv.mutateAsync({ subcontractId, invoiceId: id });
      else await rejectInv.mutateAsync({ subcontractId, invoiceId: id });
      toast.success(`Invoice ${action}d`);
      queryClient.invalidateQueries({ queryKey: getGetSubcontractQueryKey(subcontractId) });
    } catch { toast.error("Action failed"); }
  };

  const handleOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason) return;
    try {
      await overrideInv.mutateAsync({ subcontractId, invoiceId: overrideDialogOpen.id, data: { overrideReason } });
      toast.success("Invoice overridden and approved");
      queryClient.invalidateQueries({ queryKey: getGetSubcontractQueryKey(subcontractId) });
      setOverrideDialogOpen({open: false, id: ""});
      setOverrideReason("");
    } catch { toast.error("Override failed"); }
  };

  const getCOStatusBadge = (s: string) => {
    if(s==='APPROVED') return <Badge variant="success">Approved</Badge>;
    if(s==='REJECTED') return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="warning">Pending</Badge>;
  };

  const getInvStatusBadge = (s: string) => {
    if(s==='APPROVED') return <Badge variant="success">Approved</Badge>;
    if(s==='REJECTED') return <Badge variant="destructive">Rejected</Badge>;
    if(s==='FLAGGED') return <Badge variant="warning" className="bg-orange-500">Flagged</Badge>;
    return <Badge variant="warning">Pending</Badge>;
  };

  return (
    <Layout>
      <div className="mb-6">
        <Link href={`/projects/${sub.projectId}`} className="text-primary hover:underline flex items-center gap-1 text-sm font-semibold mb-4 w-fit">
          <ArrowLeft className="h-4 w-4" /> Back to Project
        </Link>
        <h1 className="text-3xl font-bold font-display">Subcontract: {sub.sub.companyName}</h1>
        <p className="text-muted-foreground mt-1 text-lg">{sub.project.name}</p>
      </div>

      {/* SCOREBOARD */}
      <h2 className="text-xl font-bold font-display mb-4 flex items-center gap-2"><Activity className="h-5 w-5 text-primary"/> Financial Scoreboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        <ScoreCard title="Base Contract" amount={sb.base} />
        <ScoreCard title="Approved COs" amount={sb.coTotal} />
        <ScoreCard title="Current Total" amount={sb.currentApprovedTotal} highlight />
        <ScoreCard title="Invoiced To Date" amount={sb.invoicedTotal} />
        <ScoreCard title="Remaining Balance" amount={sb.remaining} 
          className={sb.remaining < 0 ? "border-red-500 bg-red-50 dark:bg-red-950/20" : ""} 
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* CHANGE ORDERS */}
        <Card className="flex flex-col h-[600px]">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <CardTitle>Change Orders</CardTitle>
            {!isGC && (
              <Button size="sm" onClick={() => setCoDialogOpen(true)} className="gap-1 h-9">
                <PlusCircle className="h-4 w-4"/> Propose CO
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0 overflow-auto flex-1">
            {sub.changeOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
                <FileText className="h-12 w-12 mb-3 opacity-20"/>
                <p>No change orders yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {sub.changeOrders.map(co => (
                  <div key={co.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/50 transition-colors">
                    <div>
                      <div className="font-semibold mb-1">{co.description}</div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-mono font-bold text-foreground">{formatCurrency(co.amount)}</span>
                        <span className="text-muted-foreground">{format(new Date(co.createdAt), 'MMM d, yyyy')}</span>
                        {getCOStatusBadge(co.status)}
                      </div>
                    </div>
                    {isGC && co.status === 'PENDING_GC' && (
                      <div className="flex gap-2">
                        <Button size="icon" variant="success" className="h-8 w-8 bg-green-500 hover:bg-green-600 text-white" onClick={() => handleActionCO(co.id, 'approve')}>
                          <Check className="h-4 w-4"/>
                        </Button>
                        <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => handleActionCO(co.id, 'reject')}>
                          <X className="h-4 w-4"/>
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* INVOICES */}
        <Card className="flex flex-col h-[600px]">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <CardTitle>Invoices</CardTitle>
            {!isGC && (
              <Button size="sm" onClick={() => setInvDialogOpen(true)} className="gap-1 h-9">
                <PlusCircle className="h-4 w-4"/> Submit Invoice
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0 overflow-auto flex-1">
            {sub.invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
                <FileText className="h-12 w-12 mb-3 opacity-20"/>
                <p>No invoices submitted yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {sub.invoices.map(inv => (
                  <div key={inv.id} className={cn("p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/50 transition-colors", inv.status === 'FLAGGED' && "bg-orange-50/50 dark:bg-orange-950/20")}>
                    <div>
                      <div className="font-mono text-xl font-bold text-foreground mb-1">{formatCurrency(inv.amount)}</div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">{format(new Date(inv.createdAt), 'MMM d, yyyy')}</span>
                        {getInvStatusBadge(inv.status)}
                      </div>
                      {inv.flaggedOverAmount > 0 && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 flex items-center gap-1 font-semibold">
                          <AlertTriangle className="h-3 w-3"/> Exceeds remaining balance by {formatCurrency(inv.flaggedOverAmount)}
                        </p>
                      )}
                      {inv.overrideReason && (
                        <p className="text-xs text-muted-foreground mt-1 italic border-l-2 border-primary pl-2">
                          Override: {inv.overrideReason}
                        </p>
                      )}
                    </div>
                    {isGC && (inv.status === 'PENDING' || inv.status === 'FLAGGED') && (
                      <div className="flex flex-wrap gap-2 justify-end">
                        {inv.status === 'FLAGGED' ? (
                          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white h-8" onClick={() => setOverrideDialogOpen({open: true, id: inv.id})}>
                            Override & Approve
                          </Button>
                        ) : (
                          <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white h-8 w-8 p-0" onClick={() => handleActionInv(inv.id, 'approve')}>
                            <Check className="h-4 w-4"/>
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={() => handleActionInv(inv.id, 'reject')}>
                          <X className="h-4 w-4"/>
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* FORMS */}
      <Dialog open={coDialogOpen} onOpenChange={setCoDialogOpen} title="Propose Change Order">
        <form onSubmit={handleCreateCO} className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">Description</label>
            <Input required placeholder="Added 3 extra outlets..." value={coDesc} onChange={e=>setCoDesc(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Amount ($)</label>
            <Input required type="number" step="0.01" placeholder="1500.00" value={coAmount} onChange={e=>setCoAmount(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setCoDialogOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createCO.isPending}>Submit</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={invDialogOpen} onOpenChange={setInvDialogOpen} title="Submit Invoice">
        <form onSubmit={handleSubmitInv} className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">Invoice Amount ($)</label>
            <Input required type="number" step="0.01" placeholder="5000.00" value={invAmount} onChange={e=>setInvAmount(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setInvDialogOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={submitInv.isPending}>Submit Invoice</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={overrideDialogOpen.open} onOpenChange={(open) => !open && setOverrideDialogOpen({open:false, id:""})} title="Override Flagged Invoice">
        <form onSubmit={handleOverride} className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">This invoice exceeds the remaining contract balance. Please provide a reason to override and approve it.</p>
          <div>
            <label className="text-sm font-semibold mb-1 block">Override Reason</label>
            <Input required placeholder="Authorized verbal agreement..." value={overrideReason} onChange={e=>setOverrideReason(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOverrideDialogOpen({open:false, id:""})}>Cancel</Button>
            <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white" isLoading={overrideInv.isPending}>Override & Approve</Button>
          </div>
        </form>
      </Dialog>

    </Layout>
  );
}

function ScoreCard({ title, amount, highlight, className }: { title: string, amount: number, highlight?: boolean, className?: string }) {
  return (
    <Card className={cn("overflow-hidden border-border/50", highlight && "border-primary shadow-primary/10", className)}>
      <CardContent className={cn("p-4", highlight ? "bg-primary/5" : "bg-card")}>
        <p className={cn("text-xs font-semibold mb-2 uppercase tracking-wider", highlight ? "text-primary" : "text-muted-foreground")}>{title}</p>
        <p className="text-xl md:text-2xl font-bold font-mono tracking-tight text-foreground truncate">{formatCurrency(amount)}</p>
      </CardContent>
    </Card>
  )
}
