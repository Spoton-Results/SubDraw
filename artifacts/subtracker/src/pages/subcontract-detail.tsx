import * as React from "react";
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  useGetSubcontract, useGetMe,
  useCreateChangeOrder, useApproveChangeOrder, useRejectChangeOrder,
  useSubmitInvoice, useApproveInvoice, useRejectInvoice, useOverrideInvoice,
  useDeleteInvoice, useGetSubcontractActivity,
  getGetSubcontractQueryKey, getGetSubcontractActivityQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, Check, X, AlertTriangle, FileText, PlusCircle,
  Activity, Receipt, TrendingUp, Trash2, Hash, ClipboardList, MessageSquare,
  HelpCircle, Clock, Building2, FileSignature, BadgeCheck, Ban, Loader2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";

export default function SubcontractDetail() {
  const [, params] = useRoute("/subcontracts/:id");
  const subcontractId = params?.id || "";

  const { data: user } = useGetMe();
  const { data: sub, isLoading } = useGetSubcontract(subcontractId);
  const { data: activityLog = [], isLoading: activityLoading } = useGetSubcontractActivity(subcontractId);
  const queryClient = useQueryClient();

  const createCO = useCreateChangeOrder();
  const approveCO = useApproveChangeOrder();
  const rejectCO = useRejectChangeOrder();

  const submitInv = useSubmitInvoice();
  const approveInv = useApproveInvoice();
  const rejectInv = useRejectInvoice();
  const overrideInv = useOverrideInvoice();
  const deleteInv = useDeleteInvoice();

  const [coDialogOpen, setCoDialogOpen] = React.useState(false);
  const [coDesc, setCoDesc] = React.useState("");
  const [coScope, setCoScope] = React.useState("");
  const [coAmount, setCoAmount] = React.useState("");

  const [rejectCODialogOpen, setRejectCODialogOpen] = React.useState<{ open: boolean; id: string }>({ open: false, id: "" });
  const [coRejectReason, setCoRejectReason] = React.useState("");

  const [approveCOConfirm, setApproveCOConfirm] = React.useState<string | null>(null);

  const [invDialogOpen, setInvDialogOpen] = React.useState(false);
  const [invNumber, setInvNumber] = React.useState("");
  const [invAmount, setInvAmount] = React.useState("");
  const [invDescription, setInvDescription] = React.useState("");

  const [rejectInvConfirm, setRejectInvConfirm] = React.useState<{ open: boolean; id: string; invoiceNumber: string; amount: number }>({ open: false, id: "", invoiceNumber: "", amount: 0 });
  const [overrideDialogOpen, setOverrideDialogOpen] = React.useState<{ open: boolean; id: string }>({ open: false, id: "" });
  const [overrideReason, setOverrideReason] = React.useState("");

  const [cancelConfirm, setCancelConfirm] = React.useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetSubcontractQueryKey(subcontractId) });
    queryClient.invalidateQueries({ queryKey: getGetSubcontractActivityQueryKey(subcontractId) });
  };

  if (isLoading || !sub || !user) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const isGC = user.role === "GC";
  const sb = sub.scoreboard;
  const hasFlagged = (sb as any).hasFlaggedInvoices as boolean;
  const lastInvoice = (sb as any).lastInvoice as { amount: number; createdAt: string; status: string } | null;

  const invoicePercent = sb.currentApprovedTotal > 0
    ? Math.min(100, Math.round((sb.invoicedTotal / sb.currentApprovedTotal) * 100))
    : 0;
  const isOverBudget = sb.remaining < 0 || hasFlagged;

  const flaggedInvoices = sub.invoices.filter(i => i.status === "FLAGGED");
  const sortedInvoices = [...sub.invoices].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleCreateCO = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(coAmount);
    if (!coDesc || isNaN(amount)) return toast.error("Please fill in all required fields");
    try {
      await createCO.mutateAsync({ subcontractId, data: { description: coDesc, scope: coScope.trim() || undefined, amount } });
      toast.success("Change order submitted successfully");
      invalidate();
      setCoDialogOpen(false);
      setCoDesc(""); setCoScope(""); setCoAmount("");
    } catch (err: any) { toast.error(err?.data?.error || "Failed to submit change order"); }
  };

  const handleApproveCO = async (id: string) => {
    try {
      await approveCO.mutateAsync({ subcontractId, changeOrderId: id });
      toast.success("Change order approved");
      invalidate();
      setApproveCOConfirm(null);
    } catch (err: any) { toast.error(err?.data?.error || "Failed to approve change order"); }
  };

  const handleRejectCO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await rejectCO.mutateAsync({
        subcontractId,
        changeOrderId: rejectCODialogOpen.id,
        data: { rejectionReason: coRejectReason.trim() || undefined },
      });
      toast.success("Change order rejected");
      invalidate();
      setRejectCODialogOpen({ open: false, id: "" });
      setCoRejectReason("");
    } catch (err: any) { toast.error(err?.data?.error || "Failed to reject change order"); }
  };

  const handleSubmitInv = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(invAmount);
    if (isNaN(amount) || amount <= 0) return toast.error("Please enter a valid invoice amount");
    if (!invNumber.trim()) return toast.error("Invoice number is required");
    try {
      await submitInv.mutateAsync({
        subcontractId,
        data: { invoiceNumber: invNumber.trim(), amount, description: invDescription.trim() || undefined },
      });
      toast.success("Invoice submitted successfully");
      invalidate();
      setInvDialogOpen(false);
      setInvNumber(""); setInvAmount(""); setInvDescription("");
    } catch (err: any) { toast.error(err?.data?.error || "Failed to submit invoice"); }
  };

  const handleActionInv = async (id: string, action: "approve") => {
    try {
      await approveInv.mutateAsync({ subcontractId, invoiceId: id });
      toast.success("Invoice approved");
      invalidate();
    } catch (err: any) { toast.error(err?.data?.error || "Failed to approve invoice"); }
  };

  const handleRejectInv = async () => {
    try {
      await rejectInv.mutateAsync({ subcontractId, invoiceId: rejectInvConfirm.id });
      toast.success("Invoice rejected");
      invalidate();
      setRejectInvConfirm({ open: false, id: "", invoiceNumber: "", amount: 0 });
    } catch (err: any) { toast.error(err?.data?.error || "Failed to reject invoice"); }
  };

  const handleOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason) return;
    try {
      await overrideInv.mutateAsync({ subcontractId, invoiceId: overrideDialogOpen.id, data: { overrideReason } });
      toast.success("Invoice overridden and approved");
      invalidate();
      setOverrideDialogOpen({ open: false, id: "" });
      setOverrideReason("");
    } catch (err: any) { toast.error(err?.data?.error || "Override failed"); }
  };

  const handleCancelInvoice = async (id: string) => {
    try {
      await deleteInv.mutateAsync({ subcontractId, invoiceId: id });
      toast.success("Invoice cancelled");
      invalidate();
      setCancelConfirm(null);
    } catch (err: any) { toast.error(err?.data?.error || "Failed to cancel invoice"); }
  };

  const getCOStatusBadge = (s: string) => {
    if (s === "APPROVED") return <Badge variant="success">Approved</Badge>;
    if (s === "REJECTED") return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="warning">Pending</Badge>;
  };

  const getInvStatusBadge = (s: string) => {
    if (s === "APPROVED") return <Badge variant="success">Approved</Badge>;
    if (s === "REJECTED") return <Badge variant="destructive">Rejected</Badge>;
    if (s === "FLAGGED") return <Badge className="bg-orange-500 text-white hover:bg-orange-600">Flagged</Badge>;
    return <Badge variant="warning">Pending</Badge>;
  };

  const getActivityIcon = (type: string) => {
    if (type === "SUBCONTRACT_CREATED") return <FileSignature className="h-4 w-4 text-primary" />;
    if (type === "CO_CREATED") return <PlusCircle className="h-4 w-4 text-blue-500" />;
    if (type === "CO_APPROVED") return <BadgeCheck className="h-4 w-4 text-green-600" />;
    if (type === "CO_REJECTED") return <Ban className="h-4 w-4 text-red-500" />;
    if (type === "INVOICE_SUBMITTED") return <Receipt className="h-4 w-4 text-primary" />;
    if (type === "INVOICE_FLAGGED") return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    if (type === "INVOICE_APPROVED") return <Check className="h-4 w-4 text-green-600" />;
    if (type === "INVOICE_REJECTED") return <X className="h-4 w-4 text-red-500" />;
    if (type === "INVOICE_OVERRIDDEN") return <BadgeCheck className="h-4 w-4 text-orange-500" />;
    if (type === "INVOICE_CANCELLED") return <Trash2 className="h-4 w-4 text-muted-foreground" />;
    return <Activity className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Layout>
      <div className="mb-6">
        <Link href={`/projects/${sub.projectId}`} className="text-primary hover:underline flex items-center gap-1 text-sm font-semibold mb-4 w-fit">
          <ArrowLeft className="h-4 w-4" /> Back to Project
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold font-display leading-tight">Subcontract: {sub.sub.companyName}</h1>
        <p className="text-muted-foreground mt-1 md:text-lg">{sub.project.name}</p>
      </div>

      {/* SCOREBOARD */}
      <h2 className="text-xl font-bold font-display mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" /> Financial Scoreboard
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <ScoreCard
          title="Base Contract"
          amount={sb.base}
          tooltip="The original awarded contract amount before any changes."
        />
        <ScoreCard
          title="Approved COs"
          amount={sb.coTotal}
          tooltip="Total dollar value of all approved change orders added to this contract."
        />
        <ScoreCard
          title="Current Total"
          amount={sb.currentApprovedTotal}
          highlight
          tooltip="Base contract plus all approved change orders — the current maximum the sub can invoice."
        />
        <ScoreCard
          title="Invoiced To Date"
          amount={sb.invoicedTotal}
          tooltip="Total of all approved invoices paid or approved so far."
        />
        <ScoreCard
          title="Remaining Balance"
          amount={sb.remaining}
          danger={isOverBudget}
          className={isOverBudget ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "border-green-500/50 bg-green-50/50 dark:bg-green-950/10"}
          tooltip="How much is left to invoice before hitting the approved contract ceiling. Negative means over budget."
        />
      </div>

      {/* PROGRESS BAR */}
      <div className="bg-card border border-border/50 rounded-2xl p-5 mb-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground">Invoice Progress</span>
          </div>
          <span className={cn(
            "text-sm font-bold tabular-nums",
            isOverBudget ? "text-red-600" : "text-green-600"
          )}>
            {invoicePercent}% invoiced
          </span>
        </div>
        <Progress
          value={invoicePercent}
          className={cn("h-3 rounded-full", isOverBudget ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500")}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span>{formatCurrency(sb.invoicedTotal)} invoiced</span>
          <span>{formatCurrency(sb.currentApprovedTotal)} approved total</span>
        </div>
        {lastInvoice && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
            <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">Most recent:</span>
            <span className="text-sm font-bold font-mono">{formatCurrency(lastInvoice.amount)}</span>
            <span className="text-sm text-muted-foreground">{format(new Date(lastInvoice.createdAt), "MMM d, yyyy")}</span>
            {getInvStatusBadge(lastInvoice.status)}
          </div>
        )}
      </div>

      {/* FLAGGED INVOICES BANNER */}
      {flaggedInvoices.length > 0 && (
        <div className="rounded-2xl border-2 border-red-500 bg-red-50 dark:bg-red-950/30 p-5 mb-8 flex items-start gap-4">
          <div className="bg-red-100 dark:bg-red-900/40 rounded-xl p-2 shrink-0">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-red-700 dark:text-red-400 text-lg mb-2">
              {flaggedInvoices.length === 1 ? "Invoice Flagged for Review" : `${flaggedInvoices.length} Invoices Flagged for Review`}
            </h3>
            <div className="space-y-2">
              {flaggedInvoices.map(inv => (
                <div key={inv.id} className="text-sm text-red-700 dark:text-red-300 bg-red-100/60 dark:bg-red-900/30 rounded-lg px-4 py-2 border border-red-200 dark:border-red-800">
                  <span className="font-semibold">Invoice #{inv.invoiceNumber}</span>
                  {" — "}
                  <span className="font-mono font-bold">{formatCurrency(inv.amount)}</span>
                  {" exceeds the approved contract balance by "}
                  <span className="font-mono font-bold text-red-800 dark:text-red-200">{formatCurrency(inv.flaggedOverAmount)}</span>
                  {". "}
                  {isGC
                    ? "You can override and approve this invoice with a reason, or reject it."
                    : "The GC must review this invoice before it can be approved."}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8 mb-10">
        {/* CHANGE ORDERS */}
        <Card className="flex flex-col min-h-[360px] lg:h-[600px]">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4 shrink-0">
            <CardTitle>Change Orders</CardTitle>
            {isGC && (
              <Button size="sm" onClick={() => setCoDialogOpen(true)} className="gap-1 min-h-[44px]">
                <PlusCircle className="h-4 w-4" /> Create CO
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0 overflow-auto flex-1">
            {sub.changeOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
                <FileText className="h-12 w-12 mb-3 opacity-20" />
                <p>No change orders yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {sub.changeOrders.map(co => (
                  <div key={co.id} className={cn(
                    "p-4 hover:bg-muted/50 transition-colors",
                    co.status === "PENDING_GC" && !isGC && "bg-amber-50/50 dark:bg-amber-950/10"
                  )}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {getCOStatusBadge(co.status)}
                          <span className="text-xs text-muted-foreground">{format(new Date(co.createdAt), "MMM d, yyyy")}</span>
                        </div>
                        <p className="font-semibold text-foreground">{co.description}</p>
                        {co.scope && (
                          <div className="mt-2 p-3 bg-muted/50 rounded-lg border-l-2 border-primary/40 text-sm text-muted-foreground whitespace-pre-wrap">
                            {co.scope}
                          </div>
                        )}
                        <p className="font-mono font-bold text-lg mt-2">{formatCurrency(co.amount)}</p>
                        {co.status === "REJECTED" && co.rejectionReason && (
                          <div className="mt-2 flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                            <MessageSquare className="h-4 w-4 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold block text-xs uppercase tracking-wide mb-0.5">Rejection Reason</span>
                              {co.rejectionReason}
                            </div>
                          </div>
                        )}
                      </div>
                      {!isGC && co.status === "PENDING_GC" && (
                        approveCOConfirm === co.id ? (
                          <div className="flex flex-col gap-2 shrink-0">
                            <p className="text-xs text-muted-foreground text-right">Confirm approve?</p>
                            <Button size="sm" className="min-h-[44px] bg-green-500 hover:bg-green-600 text-white gap-1" isLoading={approveCO.isPending} onClick={() => handleApproveCO(co.id)}>
                              <Check className="h-3.5 w-3.5" /> Yes, Approve
                            </Button>
                            <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={() => setApproveCOConfirm(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 shrink-0">
                            <Button size="sm" className="min-h-[44px] bg-green-500 hover:bg-green-600 text-white gap-1" onClick={() => setApproveCOConfirm(co.id)}>
                              <Check className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" className="min-h-[44px] gap-1" onClick={() => setRejectCODialogOpen({ open: true, id: co.id })}>
                              <X className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* INVOICES */}
        <Card className="flex flex-col min-h-[360px] lg:h-[600px]">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4 shrink-0">
            <CardTitle>Invoices</CardTitle>
            {!isGC && (
              <Button size="sm" onClick={() => setInvDialogOpen(true)} className="gap-1 min-h-[44px]">
                <PlusCircle className="h-4 w-4" /> Submit Invoice
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0 overflow-auto flex-1">
            {sub.invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
                <FileText className="h-12 w-12 mb-3 opacity-20" />
                <p>No invoices submitted yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {sub.invoices.map(inv => (
                  <div
                    key={inv.id}
                    className={cn(
                      "p-4 hover:bg-muted/50 transition-colors",
                      inv.status === "FLAGGED" && "bg-orange-50/60 dark:bg-orange-950/20"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                            <Hash className="h-3 w-3" />{inv.invoiceNumber}
                          </span>
                          {getInvStatusBadge(inv.status)}
                        </div>
                        <div className="font-mono text-xl font-bold text-foreground">{formatCurrency(inv.amount)}</div>
                        {inv.description && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">{inv.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{format(new Date(inv.createdAt), "MMM d, yyyy")}</p>
                        {inv.overrideReason && (
                          <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-primary pl-2">
                            Override: {inv.overrideReason}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end shrink-0">
                        {isGC && (inv.status === "PENDING" || inv.status === "FLAGGED") && (
                          <>
                            {inv.status === "FLAGGED" ? (
                              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white min-h-[44px] text-xs" onClick={() => setOverrideDialogOpen({ open: true, id: inv.id })}>
                                Override &amp; Approve
                              </Button>
                            ) : (
                              <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white min-h-[44px] min-w-[44px] p-0" isLoading={approveInv.isPending} onClick={() => handleActionInv(inv.id, "approve")}>
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              className="min-h-[44px] min-w-[44px] p-0"
                              onClick={() => setRejectInvConfirm({ open: true, id: inv.id, invoiceNumber: inv.invoiceNumber, amount: inv.amount })}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {!isGC && inv.status === "PENDING" && (
                          cancelConfirm === inv.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-red-600 font-semibold">Cancel?</span>
                              <Button size="sm" variant="destructive" className="min-h-[44px] text-xs px-3" isLoading={deleteInv.isPending} onClick={() => handleCancelInvoice(inv.id)}>Yes</Button>
                              <Button size="sm" variant="ghost" className="min-h-[44px] text-xs px-3" onClick={() => setCancelConfirm(null)}>No</Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" className="min-h-[44px] min-w-[44px] p-0 text-muted-foreground hover:text-red-600" title="Cancel invoice" onClick={() => setCancelConfirm(inv.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* INVOICE HISTORY TABLE */}
      {sub.invoices.length > 0 && (
        <Card className="mb-8">
          <CardHeader className="border-b pb-4">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" /> Invoice History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Invoice No.</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Amount</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Description</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedInvoices.map((inv, idx) => (
                    <tr key={inv.id} className={cn(
                      "hover:bg-muted/30 transition-colors",
                      inv.status === "FLAGGED" && "bg-orange-50/40 dark:bg-orange-950/10"
                    )}>
                      <td className="px-4 py-3 text-muted-foreground">{sortedInvoices.length - idx}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold">#{inv.invoiceNumber}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{formatCurrency(inv.amount)}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{inv.description || <span className="italic opacity-50">—</span>}</td>
                      <td className="px-4 py-3 text-muted-foreground">{format(new Date(inv.createdAt), "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">{getInvStatusBadge(inv.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ACTIVITY LOG */}
      <Card className="mb-8">
        <CardHeader className="border-b pb-4">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {activityLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activityLog.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Clock className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No activity recorded yet.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-0">
                {activityLog.map((entry, idx) => (
                  <div key={entry.id} className="relative flex items-start gap-4 pb-6 last:pb-0">
                    <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card border border-border shadow-sm">
                      {getActivityIcon(entry.type)}
                    </div>
                    <div className="flex-1 min-w-0 pt-1.5">
                      <p className="text-sm font-medium text-foreground leading-snug">{entry.description}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {entry.actorName}
                        </span>
                        <Badge variant={entry.actorRole === "GC" ? "default" : "secondary"} className="text-[10px] py-0 h-4">
                          {entry.actorRole}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOGS */}
      <Dialog open={coDialogOpen} onOpenChange={setCoDialogOpen} title="Create Change Order">
        <form onSubmit={handleCreateCO} className="space-y-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">
              Change Summary <span className="text-red-500">*</span>
            </label>
            <Input required placeholder="e.g. Additional electrical outlets in conference room" value={coDesc} onChange={e => setCoDesc(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">
              Full Scope of Work & Reason <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </label>
            <Textarea
              placeholder={"Describe why this change is needed and the full scope of work the sub must perform..."}
              value={coScope}
              onChange={e => setCoScope(e.target.value)}
              rows={4}
              className="resize-none text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">
              Amount ($) <span className="text-red-500">*</span>
            </label>
            <Input required type="number" step="0.01" placeholder="1500.00" value={coAmount} onChange={e => setCoAmount(e.target.value)} />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => setCoDialogOpen(false)}>Cancel</Button>
            <Button type="submit" className="min-h-[44px]" isLoading={createCO.isPending}>Submit Change Order</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={rejectCODialogOpen.open} onOpenChange={(open) => !open && setRejectCODialogOpen({ open: false, id: "" })} title="Reject Change Order">
        <form onSubmit={handleRejectCO} className="space-y-4">
          <p className="text-sm text-muted-foreground">Optionally provide a reason for rejecting this change order. The GC will see your reason.</p>
          <div>
            <label className="text-sm font-semibold mb-1 block">
              Rejection Reason <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </label>
            <Textarea
              placeholder="e.g. Scope of work is outside our agreed contract terms. Please revise and resubmit."
              value={coRejectReason}
              onChange={e => setCoRejectReason(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => setRejectCODialogOpen({ open: false, id: "" })}>Back</Button>
            <Button type="submit" variant="destructive" className="min-h-[44px]" isLoading={rejectCO.isPending}>Confirm Rejection</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={invDialogOpen} onOpenChange={setInvDialogOpen} title="Submit Invoice">
        <form onSubmit={handleSubmitInv} className="space-y-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">
              Invoice Number <span className="text-red-500">*</span>
            </label>
            <Input required placeholder="e.g. INV-2024-001" value={invNumber} onChange={e => setInvNumber(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">
              Amount ($) <span className="text-red-500">*</span>
            </label>
            <Input required type="number" step="0.01" placeholder="5000.00" value={invAmount} onChange={e => setInvAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">
              Description / Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </label>
            <Input placeholder="e.g. Rough-in electrical work, weeks 3–4" value={invDescription} onChange={e => setInvDescription(e.target.value)} />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => setInvDialogOpen(false)}>Cancel</Button>
            <Button type="submit" className="min-h-[44px]" isLoading={submitInv.isPending}>Submit Invoice</Button>
          </div>
        </form>
      </Dialog>

      {/* Reject Invoice Confirmation Dialog */}
      <Dialog
        open={rejectInvConfirm.open}
        onOpenChange={(open) => !open && setRejectInvConfirm({ open: false, id: "", invoiceNumber: "", amount: 0 })}
        title="Reject Invoice"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4">
            <p className="text-sm text-foreground">
              Are you sure you want to reject{" "}
              <span className="font-semibold">Invoice #{rejectInvConfirm.invoiceNumber}</span>
              {" "}for{" "}
              <span className="font-mono font-bold">{formatCurrency(rejectInvConfirm.amount)}</span>?
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This will notify the subcontractor. The invoice cannot be un-rejected once confirmed.
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button
              variant="ghost"
              className="min-h-[44px]"
              onClick={() => setRejectInvConfirm({ open: false, id: "", invoiceNumber: "", amount: 0 })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-h-[44px]"
              isLoading={rejectInv.isPending}
              onClick={handleRejectInv}
            >
              Reject Invoice
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={overrideDialogOpen.open} onOpenChange={(open) => !open && setOverrideDialogOpen({ open: false, id: "" })} title="Override Flagged Invoice">
        <form onSubmit={handleOverride} className="space-y-4">
          <p className="text-sm text-muted-foreground">This invoice exceeds the remaining contract balance. Please provide a reason to override and approve it.</p>
          <div>
            <label className="text-sm font-semibold mb-1 block">Override Reason</label>
            <Input required placeholder="Authorized verbal agreement..." value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => setOverrideDialogOpen({ open: false, id: "" })}>Cancel</Button>
            <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white min-h-[44px]" isLoading={overrideInv.isPending}>Override &amp; Approve</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}

function ScoreCard({
  title, amount, highlight, danger, className, tooltip,
}: {
  title: string;
  amount: number;
  highlight?: boolean;
  danger?: boolean;
  className?: string;
  tooltip: string;
}) {
  return (
    <Card className={cn("overflow-hidden border-border/50", highlight && "border-primary shadow-primary/10", className)}>
      <CardContent className={cn("p-4", highlight ? "bg-primary/5" : "bg-card")}>
        <div className="flex items-center gap-1 mb-2">
          <p className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            highlight ? "text-primary" : danger ? "text-red-600" : "text-muted-foreground"
          )}>{title}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors shrink-0">
                <HelpCircle className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] text-center">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </div>
        <p className={cn(
          "text-xl md:text-2xl font-bold font-mono tracking-tight truncate",
          danger ? "text-red-600" : "text-foreground"
        )}>{formatCurrency(amount)}</p>
      </CardContent>
    </Card>
  );
}
