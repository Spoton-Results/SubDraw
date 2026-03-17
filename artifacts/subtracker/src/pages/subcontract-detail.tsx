import * as React from "react";
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  useGetSubcontract, useGetMe,
  useCreateChangeOrder, useApproveChangeOrder, useRejectChangeOrder,
  useSubmitInvoice, useApproveInvoice, useRejectInvoice, useOverrideInvoice,
  useDeleteInvoice, useGetSubcontractActivity,
  useMarkInvoicePaid, useConfirmInvoicePayment, useDisputeInvoicePayment,
  getGetSubcontractQueryKey, getGetSubcontractActivityQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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
  HelpCircle, Clock, Building2, FileSignature, BadgeCheck, Ban, Loader2, FileDown,
  CreditCard, DollarSign, CheckCircle2, ShieldAlert, Unlock, Percent, Stamp,
  Shield, ShieldCheck, ShieldX, Upload, Pencil, ExternalLink, CalendarDays,
} from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";
import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";

const TRADE_BADGE_COLORS: Record<string, string> = {
  General: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
  Electrical: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400",
  Plumbing: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400",
  HVAC: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400",
  Framing: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400",
  Drywall: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
  Roofing: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400",
  Flooring: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400",
  Painting: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400",
  Concrete: "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300",
  Masonry: "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300",
  Insulation: "bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-950/30 dark:text-lime-400",
  "Windows and Doors": "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400",
  Landscaping: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400",
  Other: "bg-muted text-muted-foreground border-border",
};

export default function SubcontractDetail() {
  const [, params] = useRoute("/subcontracts/:id");
  const subcontractId = params?.id || "";

  const { data: user } = useGetMe();
  const { data: sub, isLoading } = useGetSubcontract(subcontractId);
  usePageTitle(sub?.description ?? "Subcontract");
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
  const markPaid = useMarkInvoicePaid();
  const confirmPayment = useConfirmInvoicePayment();
  const disputePayment = useDisputeInvoicePayment();

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

  const [payDialog, setPayDialog] = React.useState<{ open: boolean; id: string; invoiceNumber: string; amount: number }>({ open: false, id: "", invoiceNumber: "", amount: 0 });
  const [payDate, setPayDate] = React.useState("");
  const [payMethod, setPayMethod] = React.useState("");
  const [payReference, setPayReference] = React.useState("");
  const [payNotes, setPayNotes] = React.useState("");
  const [disputeDialog, setDisputeDialog] = React.useState<{ open: boolean; id: string }>({ open: false, id: "" });
  const [disputeReasonText, setDisputeReasonText] = React.useState("");
  const [releaseRetentionLoading, setReleaseRetentionLoading] = React.useState(false);
  const [releaseRetentionConfirm, setReleaseRetentionConfirm] = React.useState(false);
  const [lienWaiverDialog, setLienWaiverDialog] = React.useState<{ open: boolean; invoiceId: string; invoiceNumber: string; amount: number }>({ open: false, invoiceId: "", invoiceNumber: "", amount: 0 });
  const [signedByName, setSignedByName] = React.useState("");
  const [waiverSigning, setWaiverSigning] = React.useState(false);

  const [insDialogOpen, setInsDialogOpen] = React.useState(false);
  const [insCompany, setInsCompany] = React.useState("");
  const [insPolicy, setInsPolicy] = React.useState("");
  const [insGL, setInsGL] = React.useState("");
  const [insWC, setInsWC] = React.useState("");
  const [insExpDate, setInsExpDate] = React.useState("");
  const [insSaving, setInsSaving] = React.useState(false);
  const [insCertPath, setInsCertPath] = React.useState<string | null>(null);

  const { data: insurance, refetch: refetchInsurance } = useQuery({
    queryKey: ["subcontract-insurance", subcontractId],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/api/subcontracts/${subcontractId}/insurance`, { credentials: "include" });
      if (!res.ok) return { status: "NO_INSURANCE" } as any;
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { uploadFile: uploadCert, progress: certProgress, isUploading: certUploading } = useUpload({
    onError: (err) => toast.error(err.message || "Certificate upload failed"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetSubcontractQueryKey(subcontractId) });
    queryClient.invalidateQueries({ queryKey: getGetSubcontractActivityQueryKey(subcontractId) });
  };

  const handleMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payDate || !payMethod) return toast.error("Payment date and method are required");
    try {
      await markPaid.mutateAsync({ subcontractId, invoiceId: payDialog.id, data: { paymentDate: payDate, paymentMethod: payMethod as any, paymentReference: payReference || undefined, paymentNotes: payNotes || undefined } });
      toast.success("Invoice marked as paid — awaiting sub confirmation");
      invalidate();
      setPayDialog({ open: false, id: "", invoiceNumber: "", amount: 0 });
      setPayDate(""); setPayMethod(""); setPayReference(""); setPayNotes("");
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Failed to record payment");
    }
  };

  const openConfirmPayment = (inv: any) => {
    const lienWaivers: any[] = (sub as any).lienWaivers ?? [];
    const alreadySigned = lienWaivers.some((w: any) => w.invoiceId === inv.id);
    if (alreadySigned) {
      handleConfirmPayment(inv.id);
    } else {
      setSignedByName("");
      setLienWaiverDialog({ open: true, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, amount: inv.amount });
    }
  };

  const handleConfirmPayment = async (invoiceId: string) => {
    try {
      await confirmPayment.mutateAsync({ subcontractId, invoiceId });
      toast.success("Payment confirmed — thank you!");
      invalidate();
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Failed to confirm payment");
    }
  };

  const handleSignAndConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signedByName.trim()) return toast.error("Please type your full legal name to sign");
    setWaiverSigning(true);
    try {
      const base = import.meta.env.BASE_URL ?? "/";
      const signRes = await fetch(`${base}api/subcontracts/${subcontractId}/invoices/${lienWaiverDialog.invoiceId}/sign-lien-waiver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedByName: signedByName.trim() }),
        credentials: "include",
      });
      if (!signRes.ok) {
        const errData = await signRes.json().catch(() => ({}));
        toast.error(errData?.error ?? "Failed to sign lien waiver");
        setWaiverSigning(false);
        return;
      }
      await confirmPayment.mutateAsync({ subcontractId, invoiceId: lienWaiverDialog.invoiceId });
      toast.success("Lien waiver signed and payment confirmed!");
      invalidate();
      setLienWaiverDialog({ open: false, invoiceId: "", invoiceNumber: "", amount: 0 });
      setSignedByName("");
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Failed to confirm payment");
    } finally {
      setWaiverSigning(false);
    }
  };

  const handleDisputePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeReasonText.trim()) return toast.error("Please describe the issue");
    try {
      await disputePayment.mutateAsync({ subcontractId, invoiceId: disputeDialog.id, data: { disputeReason: disputeReasonText.trim() } });
      toast.success("Payment dispute recorded");
      invalidate();
      setDisputeDialog({ open: false, id: "" });
      setDisputeReasonText("");
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Failed to dispute payment");
    }
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
  const sb = sub.scoreboard as any;
  const hasFlagged = sb.hasFlaggedInvoices as boolean || sub.invoices.some((i: any) => i.status === "PAYMENT_DISPUTED");
  const lastInvoice = sb.lastInvoice as { amount: number; createdAt: string; status: string } | null;

  const invoicePercent = sb.currentApprovedTotal > 0
    ? Math.min(100, Math.round((sb.invoicedTotal / sb.currentApprovedTotal) * 100))
    : 0;
  const isOverBudget = sb.remaining < 0 || hasFlagged;

  const retPct: number = (sub as any).retentionPercentage ?? 0;
  const retentionBalance: number = sb.retentionBalance ?? 0;
  const grossInvoiced: number = sb.grossInvoiced ?? 0;
  const totalRetentionHeld: number = sb.totalRetentionHeld ?? 0;
  const netPaid: number = sb.netPaid ?? 0;
  const projectStatus: string = (sub as any).project?.status ?? "";

  const canReleaseRetention = isGC && projectStatus === "CLOSED" && retentionBalance > 0;
  const alreadyReleasedInvoice = (sub.invoices as any[]).find((i: any) => i.isRetentionRelease && i.status !== "REJECTED");

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

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const handleReleaseRetention = async () => {
    setReleaseRetentionLoading(true);
    try {
      const resp = await fetch(`${BASE}/api/subcontracts/${subcontractId}/release-retention`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include" });
      if (!resp.ok) { const d = await resp.json(); throw new Error(d.error ?? "Failed"); }
      toast.success("Retention release invoice created");
      invalidate();
      setReleaseRetentionConfirm(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to release retention");
    } finally {
      setReleaseRetentionLoading(false);
    }
  };

  const insStatus: string = insurance?.status ?? "NO_INSURANCE";

  const openInsDialog = () => {
    setInsCompany(insurance?.insuranceCompany ?? "");
    setInsPolicy(insurance?.policyNumber ?? "");
    setInsGL(insurance?.generalLiabilityCoverage?.toString() ?? "");
    setInsWC(insurance?.workersCompCoverage?.toString() ?? "");
    setInsExpDate(insurance?.expirationDate ?? "");
    setInsCertPath(insurance?.certificateObjectPath ?? null);
    setInsDialogOpen(true);
  };

  const handleUploadCert = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadCert(file, `/insurance/${subcontractId}/`, file.name);
      setInsCertPath(result.objectPath);
      toast.success("Certificate uploaded — click Save to confirm");
    } catch { }
  };

  const handleSaveInsurance = async (e: React.FormEvent) => {
    e.preventDefault();
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    setInsSaving(true);
    try {
      const res = await fetch(`${base}/api/subcontracts/${subcontractId}/insurance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          insuranceCompany: insCompany.trim() || null,
          policyNumber: insPolicy.trim() || null,
          generalLiabilityCoverage: insGL ? parseFloat(insGL) : null,
          workersCompCoverage: insWC ? parseFloat(insWC) : null,
          expirationDate: insExpDate || null,
          certificateObjectPath: insCertPath || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save insurance");
      }
      toast.success("Insurance certificate saved");
      refetchInsurance();
      invalidate();
      setInsDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save insurance");
    } finally {
      setInsSaving(false);
    }
  };

  const getCOStatusBadge = (s: string) => {
    if (s === "APPROVED") return <Badge variant="success">Approved</Badge>;
    if (s === "REJECTED") return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="warning">Pending</Badge>;
  };

  const getInvStatusBadge = (s: string) => {
    if (s === "APPROVED") return <Badge className="bg-blue-500 text-white hover:bg-blue-600">Approved</Badge>;
    if (s === "REJECTED") return <Badge variant="destructive">Rejected</Badge>;
    if (s === "FLAGGED") return <Badge className="bg-orange-500 text-white hover:bg-orange-600">Flagged</Badge>;
    if (s === "PAYMENT_UNCONFIRMED") return <Badge className="bg-orange-400 text-white hover:bg-orange-500">Payment Unconfirmed</Badge>;
    if (s === "PAYMENT_CONFIRMED") return <Badge className="bg-green-600 text-white hover:bg-green-700">Payment Confirmed</Badge>;
    if (s === "PAYMENT_DISPUTED") return <Badge className="bg-red-600 text-white hover:bg-red-700">Payment Disputed</Badge>;
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
    if (type === "RETENTION_RELEASED") return <Unlock className="h-4 w-4 text-green-600" />;
    return <Activity className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Layout>
      <div className="mb-6">
        <Link href={`/projects/${sub.projectId}`} className="text-primary hover:underline flex items-center gap-1 text-sm font-semibold mb-4 w-fit">
          <ArrowLeft className="h-4 w-4" /> Back to Project
        </Link>
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold font-display leading-tight">Subcontract: {sub.sub.companyName}</h1>
            <p className="text-muted-foreground mt-1 md:text-lg">{sub.project.name}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {sub.tradeCategory && (
              <span className={`inline-flex items-center text-sm font-semibold px-3 py-1 rounded-full border ${TRADE_BADGE_COLORS[sub.tradeCategory] ?? TRADE_BADGE_COLORS.Other}`}>
                {sub.tradeCategory}
              </span>
            )}
            {insStatus === "VALID" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                <ShieldCheck className="h-3.5 w-3.5" /> Insurance Valid
              </span>
            )}
            {insStatus === "EXPIRING_SOON" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800">
                <Shield className="h-3.5 w-3.5" /> Expiring Soon
              </span>
            )}
            {insStatus === "EXPIRED" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
                <ShieldX className="h-3.5 w-3.5" /> Insurance Expired
              </span>
            )}
            {insStatus === "NO_INSURANCE" && isGC && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                <Shield className="h-3.5 w-3.5" /> No Insurance on File
              </span>
            )}
          </div>
        </div>
      </div>

      {/* INSURANCE EXPIRED BANNER */}
      {insStatus === "EXPIRED" && (
        <div className="mb-6 flex items-start gap-3 bg-red-50 dark:bg-red-950/20 border border-red-300 dark:border-red-700 rounded-2xl px-5 py-4">
          <ShieldX className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-700 dark:text-red-300 text-sm">Insurance Expired — Verify coverage before approving any invoices</p>
            <p className="text-red-600 dark:text-red-400 text-xs mt-0.5">
              The certificate for {insurance?.insuranceCompany ?? "this subcontractor"} expired on {insurance?.expirationDate ?? "an unknown date"}.
              {isGC ? " Update the insurance details below." : " Contact the GC for an updated certificate."}
            </p>
          </div>
        </div>
      )}

      {/* INSURANCE EXPIRING SOON BANNER */}
      {insStatus === "EXPIRING_SOON" && (
        <div className="mb-6 flex items-start gap-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-300 dark:border-yellow-700 rounded-2xl px-5 py-4">
          <Shield className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-yellow-700 dark:text-yellow-300 text-sm">Insurance Expiring Soon</p>
            <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-0.5">
              The certificate for {insurance?.insuranceCompany ?? "this subcontractor"} expires on {insurance?.expirationDate ?? "an unknown date"}.
              {isGC ? " Request an updated certificate from the sub." : " Please provide an updated certificate to the GC."}
            </p>
          </div>
        </div>
      )}

      {/* SCOREBOARD */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold font-display flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" /> Financial Scoreboard
        </h2>
        {retPct > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800">
            <Percent className="h-3.5 w-3.5" /> {retPct}% Retention Rate
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
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
          title="Gross Invoiced"
          amount={grossInvoiced}
          tooltip="Total billed by the sub before retention is withheld."
        />
        <ScoreCard
          title="Net Paid to Sub"
          amount={netPaid}
          className="border-green-500/50 bg-green-50/50 dark:bg-green-950/10"
          tooltip="Gross invoiced minus all retention held — the actual economic value transferred to the sub."
        />
        <ScoreCard
          title="Remaining Balance"
          amount={sb.remaining}
          danger={isOverBudget}
          className={isOverBudget ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "border-green-500/50 bg-green-50/50 dark:bg-green-950/10"}
          tooltip="Current contract total minus net paid — amount still to be invoiced."
        />
      </div>

      {/* RETENTION SCOREBOARD — only if retention is active */}
      {retPct > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl border border-orange-200 dark:border-orange-800 bg-orange-50/60 dark:bg-orange-950/20 p-4">
            <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold uppercase tracking-wide mb-1">Total Retention Held</p>
            <p className="text-2xl font-bold font-mono text-orange-700 dark:text-orange-300">{formatCurrency(totalRetentionHeld)}</p>
            <p className="text-xs text-muted-foreground mt-1">Withheld across all approved invoices</p>
          </div>
          <div className={cn(
            "rounded-2xl border p-4",
            retentionBalance > 0
              ? "border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20"
              : "border-green-300 dark:border-green-700 bg-green-50/60 dark:bg-green-950/10"
          )}>
            <p className={cn("text-xs font-semibold uppercase tracking-wide mb-1", retentionBalance > 0 ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400")}>Retention Balance</p>
            <p className={cn("text-2xl font-bold font-mono", retentionBalance > 0 ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-300")}>{formatCurrency(retentionBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">{retentionBalance > 0 ? "Still owed to sub upon project close" : "All retention released"}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-col justify-center gap-2">
            {canReleaseRetention && !alreadyReleasedInvoice ? (
              <>
                <p className="text-xs text-muted-foreground">Project is CLOSED — release remaining retention to the sub.</p>
                {releaseRetentionConfirm ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white min-h-[44px] gap-1.5"
                      isLoading={releaseRetentionLoading}
                      onClick={handleReleaseRetention}
                    >
                      <Unlock className="h-4 w-4" /> Confirm Release
                    </Button>
                    <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={() => setReleaseRetentionConfirm(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700 text-white min-h-[44px] gap-1.5"
                    onClick={() => setReleaseRetentionConfirm(true)}
                  >
                    <Unlock className="h-4 w-4" /> Release Retention ({formatCurrency(retentionBalance)})
                  </Button>
                )}
              </>
            ) : alreadyReleasedInvoice ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5 justify-center">
                  <Unlock className="h-4 w-4" /> Retention Release Pending
                </p>
                <p className="text-xs text-muted-foreground mt-1">Invoice #{alreadyReleasedInvoice.invoiceNumber} created</p>
              </div>
            ) : !isGC && retentionBalance > 0 ? (
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Retention will be released by the GC when this project closes.</p>
              </div>
            ) : retentionBalance === 0 && totalRetentionHeld > 0 ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">All retention released</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Retention release available when project closes.</p>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* INSURANCE DETAILS CARD */}
      <Card className={cn(
        "mb-6",
        insStatus === "EXPIRED" && "border-red-400 dark:border-red-700",
        insStatus === "EXPIRING_SOON" && "border-yellow-400 dark:border-yellow-700",
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {insStatus === "VALID" && <ShieldCheck className="h-5 w-5 text-green-600" />}
              {insStatus === "EXPIRING_SOON" && <Shield className="h-5 w-5 text-yellow-600" />}
              {insStatus === "EXPIRED" && <ShieldX className="h-5 w-5 text-red-600" />}
              {insStatus === "NO_INSURANCE" && <Shield className="h-5 w-5 text-muted-foreground" />}
              Insurance Certificate
            </CardTitle>
            {isGC && (
              <Button size="sm" variant="outline" onClick={openInsDialog} className="gap-1.5 min-h-[36px]">
                <Pencil className="h-3.5 w-3.5" /> {insStatus === "NO_INSURANCE" ? "Add Insurance" : "Update"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {insStatus === "NO_INSURANCE" ? (
            <p className="text-sm text-muted-foreground">
              {isGC ? "No insurance certificate on file. Click Update to add coverage details." : "No insurance certificate has been recorded yet. Contact the GC if you believe this is an error."}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {insurance?.insuranceCompany && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Insurance Company</p>
                  <p className="font-semibold">{insurance.insuranceCompany}</p>
                </div>
              )}
              {insurance?.policyNumber && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Policy Number</p>
                  <p className="font-mono font-semibold">{insurance.policyNumber}</p>
                </div>
              )}
              {insurance?.expirationDate && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Expiration Date</p>
                  <p className={cn("font-semibold flex items-center gap-1.5",
                    insStatus === "EXPIRED" && "text-red-600",
                    insStatus === "EXPIRING_SOON" && "text-yellow-700 dark:text-yellow-400",
                  )}>
                    <CalendarDays className="h-3.5 w-3.5" />
                    {insurance.expirationDate}
                  </p>
                </div>
              )}
              {insurance?.generalLiabilityCoverage != null && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">General Liability</p>
                  <p className="font-mono font-semibold">{formatCurrency(insurance.generalLiabilityCoverage)}</p>
                </div>
              )}
              {insurance?.workersCompCoverage != null && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Workers Comp</p>
                  <p className="font-mono font-semibold">{formatCurrency(insurance.workersCompCoverage)}</p>
                </div>
              )}
              {insurance?.certificateObjectPath && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Certificate PDF</p>
                  <a
                    href={`/api/storage${insurance.certificateObjectPath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <FileDown className="h-4 w-4" /> Download Certificate
                  </a>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* INSURANCE EDIT DIALOG */}
      <Dialog open={insDialogOpen} onOpenChange={setInsDialogOpen}>
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setInsDialogOpen(false)}>
          <div className="bg-card rounded-2xl border shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold font-display flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" /> Insurance Certificate Details
              </h3>
              <button onClick={() => setInsDialogOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSaveInsurance} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Insurance Company</label>
                  <Input value={insCompany} onChange={e => setInsCompany(e.target.value)} placeholder="e.g. Acme Insurance Co." />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Policy Number</label>
                  <Input value={insPolicy} onChange={e => setInsPolicy(e.target.value)} placeholder="e.g. POL-123456" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">General Liability Coverage</label>
                  <Input type="number" min="0" step="1000" value={insGL} onChange={e => setInsGL(e.target.value)} placeholder="e.g. 1000000" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Workers Comp Coverage</label>
                  <Input type="number" min="0" step="1000" value={insWC} onChange={e => setInsWC(e.target.value)} placeholder="e.g. 500000" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Certificate Expiration Date</label>
                  <Input type="date" value={insExpDate} onChange={e => setInsExpDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Certificate PDF (optional)</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary/60 transition-colors bg-muted/30 text-sm text-muted-foreground hover:text-primary">
                    <Upload className="h-4 w-4" />
                    {certUploading ? `Uploading ${certProgress}%…` : insCertPath ? "Replace Certificate" : "Upload Certificate"}
                    <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleUploadCert} disabled={certUploading} />
                  </label>
                  {insCertPath && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> Certificate on file
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" className="flex-1" isLoading={insSaving} disabled={certUploading}>
                  Save Insurance Details
                </Button>
                <Button type="button" variant="outline" onClick={() => setInsDialogOpen(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      </Dialog>

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
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
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
                          <div className="flex sm:flex-col gap-2 shrink-0">
                            <p className="text-xs text-muted-foreground sm:text-right hidden sm:block">Confirm approve?</p>
                            <Button size="sm" className="flex-1 sm:flex-none min-h-[44px] bg-green-500 hover:bg-green-600 text-white gap-1" isLoading={approveCO.isPending} onClick={() => handleApproveCO(co.id)}>
                              <Check className="h-3.5 w-3.5" /> Yes, Approve
                            </Button>
                            <Button size="sm" variant="ghost" className="flex-1 sm:flex-none min-h-[44px]" onClick={() => setApproveCOConfirm(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <div className="flex sm:flex-col gap-2 shrink-0">
                            <Button size="sm" className="flex-1 sm:flex-none min-h-[44px] bg-green-500 hover:bg-green-600 text-white gap-1" onClick={() => setApproveCOConfirm(co.id)}>
                              <Check className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" className="flex-1 sm:flex-none min-h-[44px] gap-1" onClick={() => setRejectCODialogOpen({ open: true, id: co.id })}>
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
                      inv.status === "FLAGGED" && "bg-orange-50/60 dark:bg-orange-950/20",
                      inv.status === "PAYMENT_UNCONFIRMED" && "bg-orange-50/40 dark:bg-orange-950/10",
                      inv.status === "PAYMENT_CONFIRMED" && "bg-green-50/40 dark:bg-green-950/10",
                      inv.status === "PAYMENT_DISPUTED" && "bg-red-50/40 dark:bg-red-950/10",
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                            <Hash className="h-3 w-3" />{inv.invoiceNumber}
                          </span>
                          {getInvStatusBadge(inv.status)}
                          {(inv as any).isRetentionRelease && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                              <Unlock className="h-3 w-3" /> Retention Release
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-xl font-bold text-foreground">{formatCurrency(inv.amount)}</div>
                        {!(inv as any).isRetentionRelease && retPct > 0 && (inv as any).retentionAmount != null && (
                          <div className="flex items-center gap-3 mt-1 text-xs">
                            <span className="text-orange-600 dark:text-orange-400 font-semibold">
                              −{formatCurrency((inv as any).retentionAmount)} retention ({retPct}%)
                            </span>
                            <span className="text-green-700 dark:text-green-400 font-semibold">
                              = {formatCurrency(inv.amount - (inv as any).retentionAmount)} net
                            </span>
                          </div>
                        )}
                        {inv.description && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">{inv.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{format(new Date(inv.createdAt), "MMM d, yyyy")}</p>
                        {inv.overrideReason && (
                          <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-primary pl-2">
                            Override: {inv.overrideReason}
                          </p>
                        )}
                        {(inv.status === "PAYMENT_UNCONFIRMED" || inv.status === "PAYMENT_CONFIRMED" || inv.status === "PAYMENT_DISPUTED") && inv.paymentMethod && (
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground border-l-2 border-green-400 pl-2">
                            <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" />{inv.paymentMethod}</span>
                            {inv.paymentDate && <span>{inv.paymentDate}</span>}
                            {inv.paymentReference && <span>Ref: {inv.paymentReference}</span>}
                            {inv.paymentNotes && <span className="italic">{inv.paymentNotes}</span>}
                          </div>
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
                              <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white min-h-[44px] min-w-[44px] p-0" isLoading={approveInv.isPending} onClick={() => handleActionInv(inv.id, "approve")}>
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
                        {isGC && inv.status === "APPROVED" && (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white min-h-[44px] text-xs gap-1.5" onClick={() => setPayDialog({ open: true, id: inv.id, invoiceNumber: inv.invoiceNumber, amount: inv.amount })}>
                            <DollarSign className="h-3.5 w-3.5" /> Mark as Paid
                          </Button>
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

                    {/* Sub: yellow payment confirmation banner */}
                    {!isGC && inv.status === "PAYMENT_UNCONFIRMED" && (
                      <div className="mt-3 rounded-xl border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 p-3 space-y-3">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300 font-semibold flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          Your GC has marked this invoice as paid — please confirm you received this payment.
                        </p>
                        {Date.now() - new Date(inv.updatedAt).getTime() > 7 * 24 * 60 * 60 * 1000 && (
                          <p className="text-xs text-orange-700 dark:text-orange-400 flex items-center gap-1 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-1.5">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            Reminder: This has been awaiting your confirmation for over 7 days.
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white flex-1 min-h-[44px] gap-1.5"
                            isLoading={confirmPayment.isPending || waiverSigning}
                            onClick={() => openConfirmPayment(inv)}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Confirm Payment Received
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1 min-h-[44px] gap-1.5"
                            onClick={() => { setDisputeDialog({ open: true, id: inv.id }); setDisputeReasonText(""); }}
                          >
                            <ShieldAlert className="h-4 w-4" /> Dispute Payment
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Both: confirmed date/time */}
                    {inv.status === "PAYMENT_CONFIRMED" && (inv as any).paymentConfirmedAt && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        Confirmed {format(new Date((inv as any).paymentConfirmedAt), "MMM d, yyyy 'at' h:mm a")}
                      </div>
                    )}

                    {/* GC: red dispute banner */}
                    {isGC && inv.status === "PAYMENT_DISPUTED" && (
                      <div className="mt-3 rounded-xl border-2 border-red-400 bg-red-50 dark:bg-red-950/20 p-3">
                        <p className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2 mb-1">
                          <ShieldAlert className="h-4 w-4 shrink-0" /> Sub has disputed this payment
                        </p>
                        {(inv as any).disputeReason && (
                          <p className="text-sm text-red-700 dark:text-red-300 italic">"{(inv as any).disputeReason}"</p>
                        )}
                      </div>
                    )}
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Invoice No.</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Amount</th>
                    <th className="hidden sm:table-cell text-left px-4 py-3 font-semibold text-muted-foreground">Description</th>
                    <th className="hidden sm:table-cell text-left px-4 py-3 font-semibold text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground hidden md:table-cell">Lien Waiver</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedInvoices.map((inv, idx) => {
                    const invLienWaivers: any[] = (sub as any).lienWaivers ?? [];
                    const waiver = invLienWaivers.find((w: any) => w.invoiceId === inv.id);
                    return (
                    <tr key={inv.id} className={cn(
                      "hover:bg-muted/30 transition-colors",
                      inv.status === "FLAGGED" && "bg-orange-50/40 dark:bg-orange-950/10",
                      inv.status === "PAYMENT_UNCONFIRMED" && "bg-orange-50/30 dark:bg-orange-950/10",
                      inv.status === "PAYMENT_CONFIRMED" && "bg-green-50/30 dark:bg-green-950/10",
                      inv.status === "PAYMENT_DISPUTED" && "bg-red-50/30 dark:bg-red-950/10",
                    )}>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono font-semibold">#{inv.invoiceNumber}</span>
                          <span className="text-xs text-muted-foreground sm:hidden">{format(new Date(inv.createdAt), "MMM d, yyyy")}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{formatCurrency(inv.amount)}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground max-w-xs truncate">{inv.description || <span className="italic opacity-50">—</span>}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">{format(new Date(inv.createdAt), "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">{getInvStatusBadge(inv.status)}</td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        {waiver ? (
                          <a
                            href={`/api/subcontracts/${subcontractId}/invoices/${inv.id}/lien-waiver/pdf`}
                            download={`LienWaiver-${inv.invoiceNumber}.pdf`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:underline"
                            title="Download Lien Waiver PDF"
                          >
                            <Stamp className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">Signed</span>
                          </a>
                        ) : (inv.status === "PAYMENT_CONFIRMED" || inv.status === "PAYMENT_UNCONFIRMED") ? (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/api/subcontracts/${subcontractId}/invoices/${inv.id}/pdf`}
                          download={`Invoice-${inv.invoiceNumber}.pdf`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          title="Download Invoice PDF"
                        >
                          <FileDown className="h-4 w-4" />
                          <span className="hidden sm:inline">PDF</span>
                        </a>
                      </td>
                    </tr>
                    );
                  })}
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

      {/* Mark as Paid Dialog */}
      <Dialog
        open={payDialog.open}
        onOpenChange={(open) => { if (!open) { setPayDialog({ open: false, id: "", invoiceNumber: "", amount: 0 }); setPayDate(""); setPayMethod(""); setPayReference(""); setPayNotes(""); } }}
        title="Record Payment"
        description={`Invoice #${payDialog.invoiceNumber} — ${formatCurrency(payDialog.amount)}`}
      >
        <form onSubmit={handleMarkPaid} className="space-y-4 mt-2">
          <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-400">
            After submitting, the subcontractor will be asked to confirm receipt of payment. The invoice will show as <strong>Payment Unconfirmed</strong> until they confirm.
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">Payment Date <span className="text-red-500">*</span></label>
            <Input type="date" required value={payDate} onChange={e => setPayDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">Payment Method <span className="text-red-500">*</span></label>
            <select
              required
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={payMethod}
              onChange={e => setPayMethod(e.target.value)}
            >
              <option value="">— Select method —</option>
              {["Check", "ACH Transfer", "Wire Transfer", "Credit Card", "Other"].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">
              Check / Reference Number <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input placeholder="e.g. Check #1042 or ACH ref 8812349" value={payReference} onChange={e => setPayReference(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">
              Payment Notes <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea rows={2} className="resize-none text-sm" placeholder="e.g. Partial payment, remainder next month" value={payNotes} onChange={e => setPayNotes(e.target.value)} />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => { setPayDialog({ open: false, id: "", invoiceNumber: "", amount: 0 }); setPayDate(""); setPayMethod(""); setPayReference(""); setPayNotes(""); }}>Cancel</Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white min-h-[44px] gap-2" isLoading={markPaid.isPending}>
              <DollarSign className="h-4 w-4" /> Submit Payment
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Dispute Payment Dialog */}
      <Dialog
        open={disputeDialog.open}
        onOpenChange={(open) => { if (!open) { setDisputeDialog({ open: false, id: "" }); setDisputeReasonText(""); } }}
        title="Dispute Payment"
        description="Describe the issue with this payment. Your GC will be notified with your explanation."
      >
        <form onSubmit={handleDisputePayment} className="space-y-4 mt-2">
          <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
            This will mark the invoice as <strong>Payment Disputed</strong>. Please be specific about what went wrong so your GC can resolve it.
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">Describe the Issue <span className="text-red-500">*</span></label>
            <Textarea
              required
              rows={4}
              className="resize-none text-sm"
              placeholder="e.g. I have not received this payment. The amount deposited was different from what was expected."
              value={disputeReasonText}
              onChange={e => setDisputeReasonText(e.target.value)}
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => { setDisputeDialog({ open: false, id: "" }); setDisputeReasonText(""); }}>Cancel</Button>
            <Button type="submit" variant="destructive" className="min-h-[44px] gap-2" isLoading={disputePayment.isPending}>
              <ShieldAlert className="h-4 w-4" /> Submit Dispute
            </Button>
          </div>
        </form>
      </Dialog>

      {/* LIEN WAIVER SIGN DIALOG */}
      <Dialog
        open={lienWaiverDialog.open}
        onOpenChange={(open) => { if (!open && !waiverSigning) setLienWaiverDialog({ open: false, invoiceId: "", invoiceNumber: "", amount: 0 }); }}
        title="Sign Lien Waiver"
        description={`Invoice #${lienWaiverDialog.invoiceNumber} — ${formatCurrency(lienWaiverDialog.amount)}`}
      >
        <form onSubmit={handleSignAndConfirm} className="space-y-5">
          {/* Waiver statement preview */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 p-4">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Stamp className="h-3.5 w-3.5" /> Lien Waiver Statement
            </p>
            <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              Upon receipt of payment in the amount of <strong>{formatCurrency(lienWaiverDialog.amount)}</strong>, your company hereby waives and releases any and all lien rights against the project property for all labor, materials, and equipment furnished through the date of this waiver. This waiver is conditioned upon the actual receipt of said payment and is effective only upon collection thereof.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold block">
              Type your full legal name to sign <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-muted-foreground">By typing your name below, you are electronically signing this lien waiver document.</p>
            <Input
              required
              autoFocus
              placeholder="Full legal name (e.g. Jane Smith)"
              value={signedByName}
              onChange={e => setSignedByName(e.target.value)}
              className="font-medium"
            />
            {signedByName.trim() && (
              <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Signed as: <span className="font-bold italic">{signedByName.trim()}</span>
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" className="min-h-[44px]" disabled={waiverSigning} onClick={() => setLienWaiverDialog({ open: false, invoiceId: "", invoiceNumber: "", amount: 0 })}>Cancel</Button>
            <Button type="submit" className="min-h-[44px] gap-2 bg-green-600 hover:bg-green-700 text-white" isLoading={waiverSigning || confirmPayment.isPending}>
              <CheckCircle2 className="h-4 w-4" /> Sign & Confirm Payment
            </Button>
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
      <CardContent className={cn("p-3 md:p-4", highlight ? "bg-primary/5" : "bg-card")}>
        <div className="flex items-center gap-1 mb-1 md:mb-2">
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
          "text-base md:text-xl font-bold font-mono tracking-tight break-all leading-tight",
          danger ? "text-red-600" : "text-foreground"
        )}>{formatCurrency(amount)}</p>
      </CardContent>
    </Card>
  );
}
