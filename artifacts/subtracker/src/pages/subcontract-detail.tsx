import * as React from "react";
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  useGetSubcontract, useGetMe,
  useCreateChangeOrder, useApproveChangeOrder, useRejectChangeOrder,
  useApproveInvoice, useRejectInvoice, useOverrideInvoice,
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
import { formatCurrency, cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, Check, X, AlertTriangle, FileText, PlusCircle,
  Activity, Receipt, TrendingUp, TrendingDown, Trash2, Hash, ClipboardList, MessageSquare,
  Clock, Building2, FileSignature, BadgeCheck, Ban, Loader2, FileDown,
  CreditCard, DollarSign, CheckCircle2, ShieldAlert, Unlock, Percent, Stamp,
  Shield, ShieldCheck, ShieldX, Upload, Pencil, ExternalLink, CalendarDays,
  ListChecks, SquareCheck, Download,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useUpload } from "@workspace/object-storage-web";
import { usePermissions } from "@/hooks/usePermissions";
import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";

const INSURANCE_PRESETS = [
  { id: "umbrella", label: "Umbrella Policy minimum $2,000,000" },
  { id: "perf_bond", label: "Performance Bond required" },
  { id: "pay_bond", label: "Payment Bond required" },
  { id: "prof_liab", label: "Professional Liability Insurance required" },
  { id: "auto_liab", label: "Automobile Liability minimum $1,000,000" },
  { id: "builders_risk", label: "Builder's Risk Insurance required" },
];

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
  const perms = usePermissions();
  const { data: sub, isLoading } = useGetSubcontract(subcontractId);
  usePageTitle(sub?.description ?? "Subcontract");
  const { data: activityLog = [], isLoading: activityLoading } = useGetSubcontractActivity(subcontractId);
  const queryClient = useQueryClient();

  const createCO = useCreateChangeOrder();
  const approveCO = useApproveChangeOrder();
  const rejectCO = useRejectChangeOrder();

  const [submittingInv, setSubmittingInv] = React.useState(false);
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
  const [invPercent, setInvPercent] = React.useState("");

  const [rejectInvConfirm, setRejectInvConfirm] = React.useState<{ open: boolean; id: string; invoiceNumber: string; amount: number }>({ open: false, id: "", invoiceNumber: "", amount: 0 });
  const [rejectInvReason, setRejectInvReason] = React.useState("");
  const [resubmitInv, setResubmitInv] = React.useState<{ open: boolean; amount: number } | null>(null);
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

  const [contractDocUploading, setContractDocUploading] = React.useState(false);
  const [signedDocUploading, setSignedDocUploading] = React.useState(false);
  const [waiverLoading, setWaiverLoading] = React.useState(false);
  const [deleteContractConfirmOpen, setDeleteContractConfirmOpen] = React.useState(false);
  const [deleteSignedConfirmOpen, setDeleteSignedConfirmOpen] = React.useState(false);

  const [paymentTermsSaving, setPaymentTermsSaving] = React.useState(false);

  const [insDialogOpen, setInsDialogOpen] = React.useState(false);
  const [insCompany, setInsCompany] = React.useState("");
  const [insPolicy, setInsPolicy] = React.useState("");
  const [insGL, setInsGL] = React.useState("");
  const [insWC, setInsWC] = React.useState("");
  const [insExpDate, setInsExpDate] = React.useState("");
  const [insSaving, setInsSaving] = React.useState(false);
  const [insCertPath, setInsCertPath] = React.useState<string | null>(null);
  const [insAdditional, setInsAdditional] = React.useState("");

  const [licDialogOpen, setLicDialogOpen] = React.useState(false);
  const [licNumber, setLicNumber] = React.useState("");
  const [licType, setLicType] = React.useState("");
  const [licState, setLicState] = React.useState("");
  const [licExpDate, setLicExpDate] = React.useState("");
  const [licSaving, setLicSaving] = React.useState(false);

  // Compliance state
  const [complianceMarkingId, setComplianceMarkingId] = React.useState<string | null>(null);
  const [complianceUploadingId, setComplianceUploadingId] = React.useState<string | null>(null);
  const complianceFileInputRef = React.useRef<HTMLInputElement>(null);
  const [pendingComplianceItemId, setPendingComplianceItemId] = React.useState<string | null>(null);

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

  const { data: license, refetch: refetchLicense } = useQuery({
    queryKey: ["subcontract-license", subcontractId],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/api/subcontracts/${subcontractId}/license`, { credentials: "include" });
      if (!res.ok) return { status: "NO_LICENSE" } as any;
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const [commentText, setCommentText] = React.useState("");
  const [sendingComment, setSendingComment] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const { data: comments = [], refetch: refetchComments } = useQuery({
    queryKey: ["subcontract-comments", subcontractId],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/api/subcontracts/${subcontractId}/comments`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 30000,
  });

  React.useEffect(() => {
    if (!subcontractId) return;
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    fetch(`${base}/api/subcontracts/${subcontractId}/comments/mark-read`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }, [subcontractId, comments.length]);

  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments.length]);

  const BASE_URL_SUB = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  type ComplianceCompletionSub = { id: string; checklistItemId: string; subcontractId: string; isComplete: boolean; completedByRole: string | null; completedByName: string | null; completedAt: string | null; documentPath: string | null; documentName: string | null; notes: string | null };
  type ComplianceItemWithCompletion = { id: string; title: string; description: string | null; required: boolean; allowDocumentUpload: boolean; sortOrder: number; completion: ComplianceCompletionSub | null };

  const { data: complianceItems = [], refetch: refetchCompliance } = useQuery<ComplianceItemWithCompletion[]>({
    queryKey: ["compliance-subcontract", subcontractId],
    queryFn: async () => {
      if (!sub?.projectId) return [];
      const res = await fetch(`${BASE_URL_SUB}/api/projects/${sub.projectId}/compliance-items/subcontract/${subcontractId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!subcontractId && !!sub?.projectId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  async function handleMarkComplianceComplete(itemId: string, complete: boolean) {
    setComplianceMarkingId(itemId);
    try {
      const url = `${BASE_URL_SUB}/api/projects/${sub?.projectId}/compliance-items/${itemId}/complete/${subcontractId}`;
      const res = await fetch(url, { method: complete ? "POST" : "DELETE", credentials: "include" });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed to update"); return; }
      refetchCompliance();
      toast.success(complete ? "Marked complete" : "Marked incomplete");
    } catch { toast.error("Failed to update"); }
    finally { setComplianceMarkingId(null); }
  }

  async function handleUploadComplianceDoc(itemId: string, file: File) {
    setComplianceUploadingId(itemId);
    try {
      const result = await uploadComplianceDoc(file);
      if (!result?.objectPath) throw new Error("Upload failed");
      const url = `${BASE_URL_SUB}/api/projects/${sub?.projectId}/compliance-items/${itemId}/document/${subcontractId}`;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentPath: result.objectPath, documentName: file.name }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed to upload"); return; }
      refetchCompliance();
      toast.success("Document uploaded and item marked complete");
    } catch { toast.error("Upload failed"); }
    finally { setComplianceUploadingId(null); setPendingComplianceItemId(null); }
  }

  const handleSendComment = async () => {
    const msg = commentText.trim();
    if (!msg) return;
    setSendingComment(true);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/api/subcontracts/${subcontractId}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to send message");
        return;
      }
      setCommentText("");
      refetchComments();
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSendingComment(false);
    }
  };

  const { uploadFile: uploadComplianceDoc, isUploading: complianceDocIsUploading } = useUpload({
    onError: (err) => toast.error(err.message || "Document upload failed"),
  });

  const { uploadFile: uploadCert, progress: certProgress, isUploading: certUploading } = useUpload({
    onError: (err) => toast.error(err.message || "Certificate upload failed"),
  });

  const { uploadFile: uploadContractDoc, progress: contractDocProgress, isUploading: contractDocIsUploading } = useUpload({
    onError: (err) => toast.error(err.message || "Contract upload failed"),
  });

  const { uploadFile: uploadSignedDoc, progress: signedDocProgress, isUploading: signedDocIsUploading } = useUpload({
    onError: (err) => toast.error(err.message || "Signed contract upload failed"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetSubcontractQueryKey(subcontractId) });
    queryClient.invalidateQueries({ queryKey: getGetSubcontractActivityQueryKey(subcontractId) });
  };

  const handlePaymentTermsChange = async (newTerms: number) => {
    setPaymentTermsSaving(true);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/api/subcontracts/${subcontractId}/payment-terms`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentTermsDays: newTerms }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Payment terms updated to Net ${newTerms}`);
      invalidate();
    } catch {
      toast.error("Failed to update payment terms");
    } finally {
      setPaymentTermsSaving(false);
    }
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
  const isSub = user.role === "SUB";
  const sb = sub.scoreboard as any;
  const hasFlagged = sb.hasFlaggedInvoices as boolean || sub.invoices.some((i: any) => i.status === "PAYMENT_DISPUTED");
  const lastInvoice = sb.lastInvoice as { amount: number; createdAt: string; status: string } | null;

  const invoicePercent = sb.currentApprovedTotal > 0
    ? Math.min(100, Math.round((sb.invoicedTotal / sb.currentApprovedTotal) * 100))
    : 0;
  const isOverBudget = sb.remaining < 0 || hasFlagged;

  // Scope complete tracking
  const latestPercentageComplete: number | null = sb.latestPercentageComplete ?? null;
  const invoicedPercent = sb.currentApprovedTotal > 0
    ? Math.round((sb.grossInvoiced / sb.currentApprovedTotal) * 100)
    : 0;
  const scopeInconsistent = latestPercentageComplete != null && sb.currentApprovedTotal > 0 &&
    Math.abs(latestPercentageComplete - invoicedPercent) > 20;

  // Build sorted list of non-retention-release, non-rejected invoices for regression detection
  const scopeInvoices = [...sub.invoices]
    .filter((i: any) => !i.isRetentionRelease && i.status !== "REJECTED" && (i as any).percentageComplete != null)
    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const scopeRegressionSet = new Set<string>();
  const scopeRegressionPrevMap = new Map<string, number>();
  for (let idx = 1; idx < scopeInvoices.length; idx++) {
    const prev = scopeInvoices[idx - 1] as any;
    const curr = scopeInvoices[idx] as any;
    if (curr.percentageComplete < prev.percentageComplete) {
      scopeRegressionSet.add(curr.id);
      scopeRegressionPrevMap.set(curr.id, prev.percentageComplete);
    }
  }

  const retPct: number = (sub as any).retentionPercentage ?? 0;
  const retentionBalance: number = sb.retentionBalance ?? 0;
  const grossInvoiced: number = sb.grossInvoiced ?? 0;
  const totalRetentionHeld: number = sb.totalRetentionHeld ?? 0;
  const netPaid: number = sb.netPaid ?? 0;

  // Projection data from backend scoreboard
  const projectedFinalCost: number | null = (sb as any).projectedFinalCost ?? null;
  const projectedVariance: number | null = (sb as any).projectedVariance ?? null;
  const isProjectedOverrun: boolean = (sb as any).isProjectedOverrun ?? false;
  const projectionBasisDate: string | null = (sb as any).projectionBasisDate ?? null;
  const projectionBasisInvoiceNumber: string | null = (sb as any).projectionBasisInvoiceNumber ?? null;
  const percentageCompleteHistory: Array<{ date: string; percentageComplete: number; invoiceNumber: string; amount: number }> =
    (sb as any).percentageCompleteHistory ?? [];
  const billingAheadWarning: boolean = (sb as any).billingAheadWarning ?? false;
  const underbillingNote: boolean = (sb as any).underbillingNote ?? false;
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
    const pct = parseInt(invPercent, 10);
    if (!invPercent || isNaN(pct) || pct < 1 || pct > 100) return toast.error("Please enter a valid percentage complete (1–100)");
    try {
      setSubmittingInv(true);
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const resp = await fetch(`${base}/api/subcontracts/${subcontractId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          invoiceNumber: invNumber.trim(),
          amount,
          description: invDescription.trim() || undefined,
          percentageComplete: pct,
        }),
      });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to submit invoice");
      }
      toast.success("Invoice submitted successfully");
      invalidate();
      setInvDialogOpen(false);
      setInvNumber(""); setInvAmount(""); setInvDescription(""); setInvPercent("");
    } catch (err: any) { toast.error(err?.message || "Failed to submit invoice"); }
    finally { setSubmittingInv(false); }
  };

  const handleActionInv = async (id: string, action: "approve") => {
    try {
      await approveInv.mutateAsync({ subcontractId, invoiceId: id });
      toast.success("Invoice approved");
      invalidate();
    } catch (err: any) { toast.error(err?.data?.error || "Failed to approve invoice"); }
  };

  const handleRejectInv = async () => {
    if (!rejectInvReason.trim()) return toast.error("Please provide a rejection reason");
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""}/api/subcontracts/${subcontractId}/invoices/${rejectInvConfirm.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rejectionReason: rejectInvReason.trim() }),
      });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to reject invoice");
      }
      toast.success("Invoice rejected — the subcontractor has been notified");
      invalidate();
      setRejectInvConfirm({ open: false, id: "", invoiceNumber: "", amount: 0 });
      setRejectInvReason("");
    } catch (err: any) { toast.error(err?.message || "Failed to reject invoice"); }
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

  const handleUploadContractDoc = async (file: File) => {
    setContractDocUploading(true);
    try {
      const result = await uploadContractDoc(file);
      if (!result?.objectPath) throw new Error("Upload failed");
      const res = await fetch(`${BASE}/api/subcontracts/${subcontractId}/contract-document`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectPath: result.objectPath, fileName: file.name }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Failed to save"); }
      toast.success("Subcontract agreement uploaded — sub has been notified");
      invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to upload contract");
    } finally {
      setContractDocUploading(false);
    }
  };

  const handleDeleteContractDoc = async () => {
    setDeleteContractConfirmOpen(false);
    try {
      const res = await fetch(`${BASE}/api/subcontracts/${subcontractId}/contract-document`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Contract document removed");
      invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete contract");
    }
  };

  const handleUploadSignedDoc = async (file: File) => {
    setSignedDocUploading(true);
    try {
      const result = await uploadSignedDoc(file);
      if (!result?.objectPath) throw new Error("Upload failed");
      const res = await fetch(`${BASE}/api/subcontracts/${subcontractId}/signed-contract`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectPath: result.objectPath, fileName: file.name }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Failed to save"); }
      toast.success("Signed contract uploaded — GC has been notified");
      invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to upload signed contract");
    } finally {
      setSignedDocUploading(false);
    }
  };

  const handleDeleteSignedDoc = async () => {
    setDeleteSignedConfirmOpen(false);
    try {
      const res = await fetch(`${BASE}/api/subcontracts/${subcontractId}/signed-contract`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Signed contract removed");
      invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete signed contract");
    }
  };

  const handleWaiveContract = async () => {
    setWaiverLoading(true);
    try {
      const res = await fetch(`${BASE}/api/subcontracts/${subcontractId}/waive-contract`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to waive");
      toast.success("Contract signature requirement waived");
      invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to waive");
    } finally {
      setWaiverLoading(false);
    }
  };

  const handleUnwaiveContract = async () => {
    setWaiverLoading(true);
    try {
      const res = await fetch(`${BASE}/api/subcontracts/${subcontractId}/waive-contract`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Contract requirement reinstated");
      invalidate();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to reinstate");
    } finally {
      setWaiverLoading(false);
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
    setInsAdditional(insurance?.additionalRequirements ?? "");
    setInsDialogOpen(true);
  };

  const toggleInsPreset = (label: string) => {
    setInsAdditional(prev => {
      const lines = prev.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.includes(label)) {
        return lines.filter(l => l !== label).join("\n");
      }
      return [...lines, label].join("\n");
    });
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
          additionalRequirements: insAdditional.trim() || null,
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

  const licStatus: string = license?.status ?? "NO_LICENSE";

  const openLicDialog = () => {
    setLicNumber(license?.licenseNumber ?? "");
    setLicType(license?.licenseType ?? "");
    setLicState(license?.issuingState ?? "");
    setLicExpDate(license?.expirationDate ?? "");
    setLicDialogOpen(true);
  };

  const handleSaveLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    setLicSaving(true);
    try {
      const res = await fetch(`${base}/api/subcontracts/${subcontractId}/license`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          licenseNumber: licNumber.trim() || null,
          licenseType: licType.trim() || null,
          issuingState: licState.trim() || null,
          expirationDate: licExpDate || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save license");
      }
      toast.success("Contractor license saved");
      refetchLicense();
      invalidate();
      setLicDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save license");
    } finally {
      setLicSaving(false);
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

  const getDueDateInfo = (paymentDueDate: string | Date | null | undefined): { label: string; className: string } | null => {
    if (!paymentDueDate) return null;
    const due = new Date(paymentDueDate);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    const label = `Due: ${format(due, "MMM d, yyyy")}`;
    if (diffDays < 0) return { label: `Overdue: ${format(due, "MMM d, yyyy")}`, className: "text-red-600 dark:text-red-400 font-semibold" };
    if (diffDays <= 7) return { label, className: "text-orange-600 dark:text-orange-400 font-semibold" };
    if (diffDays <= 14) return { label, className: "text-amber-600 dark:text-amber-400 font-semibold" };
    return { label, className: "text-muted-foreground" };
  };

  const getActivityIcon = (type: string) => {
    if (type === "PLAN_FILE_VIEWED") return <FileDown className="h-4 w-4 text-blue-500" />;
    if (type === "SUBCONTRACT_CREATED") return <FileSignature className="h-4 w-4 text-primary" />;
    if (type === "SUBCONTRACT_SIGNED") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (type === "CONTRACT_UPLOADED") return <FileSignature className="h-4 w-4 text-primary" />;
    if (type === "CONTRACT_SIGNED") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (type === "CONTRACT_REMOVED") return <Trash2 className="h-4 w-4 text-muted-foreground" />;
    if (type === "CONTRACT_WAIVED") return <Ban className="h-4 w-4 text-muted-foreground" />;
    if (type === "CONTRACT_UNWAIVED") return <Unlock className="h-4 w-4 text-primary" />;
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
            {licStatus === "VALID" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                <BadgeCheck className="h-3.5 w-3.5" /> License Valid
              </span>
            )}
            {licStatus === "EXPIRING_SOON" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800">
                <BadgeCheck className="h-3.5 w-3.5" /> License Expiring
              </span>
            )}
            {licStatus === "EXPIRED" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
                <BadgeCheck className="h-3.5 w-3.5" /> License Expired
              </span>
            )}
            {licStatus === "NO_LICENSE" && isGC && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                <BadgeCheck className="h-3.5 w-3.5" /> No License on File
              </span>
            )}
          </div>
        </div>
      </div>

      {/* CONTRACT SUMMARY HERO CARD — sub-facing, first thing they see */}
      {!isGC && (
        <div className="mb-6 rounded-2xl border border-border bg-white dark:bg-card shadow-sm overflow-hidden">
          {/* Header row: project + company */}
          <div className="px-6 pt-5 pb-4 border-b border-border/50 flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Project</p>
              <p className="text-sm font-bold text-foreground">{(sub as any).project?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Your Company</p>
              <p className="text-sm font-bold text-foreground">{(sub as any).sub?.companyName}</p>
            </div>
          </div>

          {/* Base contract — the biggest number */}
          <div className="px-6 pt-5 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Your Contract</p>
            <p className="text-5xl font-bold font-mono tabular-nums text-foreground leading-none">{formatCurrency(sb.base)}</p>
          </div>

          {/* Approved change orders — only if non-zero */}
          {sb.coTotal !== 0 && (
            <div className="px-6 pb-2">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-muted-foreground">Approved Change Orders</span>
                <span className={cn(
                  "font-mono text-base tabular-nums font-semibold",
                  sb.coTotal > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}>
                  {sb.coTotal > 0 ? `+${formatCurrency(sb.coTotal)}` : `−${formatCurrency(Math.abs(sb.coTotal))}`}
                </span>
              </div>
            </div>
          )}

          {/* Total contract value */}
          <div className="px-6 pb-4">
            <div className="flex items-baseline justify-between gap-4 border-t border-border/50 pt-3 mt-2">
              <span className="text-sm font-bold text-foreground">Total Contract Value</span>
              <span className="font-mono text-lg font-bold tabular-nums text-foreground">{formatCurrency(sb.currentApprovedTotal)}</span>
            </div>
          </div>

          <hr className="border-border/50" />

          {/* Invoiced so far */}
          <div className="px-6 pt-4 pb-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-muted-foreground">Invoiced so far</span>
              <span className="font-mono text-base tabular-nums text-muted-foreground">
                {isGC && !perms.hasFinancialAccess ? "—" : formatCurrency(grossInvoiced)}
              </span>
            </div>
          </div>

          {/* Remaining — hero green/red number */}
          <div className="px-6 pb-5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-bold text-foreground">Still to be paid</span>
              {isGC && !perms.hasFinancialAccess ? (
                <span className="text-muted-foreground italic text-sm">Restricted</span>
              ) : (
                <span className={cn(
                  "font-mono font-bold tabular-nums text-3xl leading-none",
                  sb.remaining <= 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                )}>
                  {sb.remaining < 0 ? `−${formatCurrency(Math.abs(sb.remaining))}` : formatCurrency(sb.remaining)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PENDING SIGNATURE BANNER — sub has not yet uploaded signed contract */}
      {!isGC && (sub as any).contractDocPath && !(sub as any).signedContractPath && !(sub as any).contractWaived && (
        <div className="mb-6 flex items-start gap-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-300 dark:border-yellow-700 rounded-2xl px-5 py-4">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-yellow-700 dark:text-yellow-300 text-sm">Subcontract agreement ready — signature required</p>
            <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-0.5">Download the agreement below, sign it, and upload your signed copy to the Subcontract Agreement card.</p>
          </div>
        </div>
      )}

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

      {/* PROJECTED OVERRUN BANNER */}
      {isGC && isProjectedOverrun && projectedFinalCost !== null && projectedVariance !== null && perms.hasFinancialAccess && (
        <div className="mb-6 flex items-start gap-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-300 dark:border-yellow-700 rounded-2xl px-5 py-4">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-yellow-700 dark:text-yellow-300 text-sm">
              This subcontract is projected to exceed the approved total by {formatCurrency(Math.abs(projectedVariance))} based on current billing rate — consider a change order now
            </p>
            {projectionBasisDate && (
              <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-0.5">
                Projection based on {projectionBasisInvoiceNumber ? `Invoice #${projectionBasisInvoiceNumber}` : "last invoice"} dated {format(new Date(projectionBasisDate), "MMM d, yyyy")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* SCOREBOARD — receipt / calculator-tape — single vertical column */}
      <div className="mb-6">
        <h2 className="text-xl font-bold font-display flex items-center gap-2 mb-3">
          <Activity className="h-5 w-5 text-primary" /> Financial Scoreboard
        </h2>

        <div className="border border-border rounded-2xl bg-white dark:bg-card shadow-sm overflow-hidden w-full max-w-[400px] mx-auto">

          {/* BASE CONTRACT */}
          <div className="px-6 pt-5 pb-0 space-y-2.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-bold text-foreground uppercase tracking-wide">Base Contract</span>
              <span className="font-mono text-base tabular-nums text-foreground">
                {isGC && !perms.hasFinancialAccess ? <span className="text-muted-foreground italic text-sm">Restricted</span> : formatCurrency(sb.base)}
              </span>
            </div>

            {/* APPROVED CHANGE ORDERS — always shown */}
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-foreground">Approved Change Orders</span>
              <span className="font-mono text-base tabular-nums text-foreground">
                {isGC && !perms.hasFinancialAccess ? "—" : (sb.coTotal > 0 ? `+${formatCurrency(sb.coTotal)}` : formatCurrency(sb.coTotal))}
              </span>
            </div>
          </div>

          <hr className="border-foreground/20 mt-4" />

          {/* APPROVED TOTAL */}
          <div className="px-6 py-3.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-base font-bold text-foreground uppercase tracking-wide">Approved Total</span>
              <span className="font-mono text-lg font-bold tabular-nums text-foreground">
                {isGC && !perms.hasFinancialAccess ? <span className="text-muted-foreground italic text-sm">Restricted</span> : formatCurrency(sb.currentApprovedTotal)}
              </span>
            </div>
          </div>

          {/* blank spacer row */}
          <div className="px-6 pt-1 pb-3 space-y-2.5">
            {/* TOTAL INVOICED */}
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-foreground">Total Invoiced</span>
              <span className="font-mono text-base tabular-nums text-foreground">
                {isGC && !perms.hasFinancialAccess ? "—" : formatCurrency(grossInvoiced)}
              </span>
            </div>

            {/* SCOPE COMPLETE — from sub's latest invoice */}
            {latestPercentageComplete != null && (
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-foreground flex items-center gap-1">
                  <Percent className="h-3 w-3 text-muted-foreground" />
                  Scope Complete
                </span>
                <span className={cn(
                  "font-mono text-base tabular-nums font-semibold",
                  scopeInconsistent ? "text-orange-600 dark:text-orange-400" : "text-primary"
                )}>
                  {latestPercentageComplete}%
                </span>
              </div>
            )}

            {/* PROJECTION ROWS — only when there's billing history with a % reported */}
            {projectedFinalCost !== null && (!isGC || perms.hasFinancialAccess) && (
              <>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm text-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-blue-500" />
                    Projected Final Cost
                  </span>
                  <span className="font-mono text-base tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                    {formatCurrency(projectedFinalCost)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm text-foreground flex items-center gap-1">
                    {projectedVariance !== null && projectedVariance >= 0
                      ? <TrendingDown className="h-3 w-3 text-green-500" />
                      : <AlertTriangle className="h-3 w-3 text-red-500" />
                    }
                    Projected Variance
                  </span>
                  <span className={cn(
                    "font-mono text-base tabular-nums font-semibold",
                    projectedVariance !== null && projectedVariance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {projectedVariance !== null
                      ? projectedVariance >= 0
                        ? `+${formatCurrency(projectedVariance)}`
                        : `−${formatCurrency(Math.abs(projectedVariance))}`
                      : "—"
                    }
                  </span>
                </div>
                {projectionBasisDate && (
                  <p className="text-xs text-muted-foreground leading-snug">
                    Based on sub reported % complete on{" "}
                    {projectionBasisInvoiceNumber ? `Invoice #${projectionBasisInvoiceNumber}` : "last invoice"}{" "}
                    ({format(new Date(projectionBasisDate), "MMM d, yyyy")})
                  </p>
                )}
              </>
            )}

            {/* RETENTION HELD — only if retention is active and held */}
            {retPct > 0 && totalRetentionHeld > 0 && (
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-foreground">Retention Held ({retPct}%)</span>
                <span className="font-mono text-base tabular-nums text-foreground">{formatCurrency(totalRetentionHeld)}</span>
              </div>
            )}
          </div>

          <hr className="border-foreground/20" />

          {/* REMAINING BALANCE — most prominent number on the page */}
          <div className="px-6 pt-5 pb-6">
            <div className="flex items-end justify-between gap-4">
              <span className="text-base font-bold text-foreground uppercase tracking-wide leading-tight">Remaining Balance</span>
              <span className={cn(
                "font-mono font-bold tabular-nums text-4xl leading-none",
                sb.remaining <= 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
              )}>
                {sb.remaining < 0 ? `−${formatCurrency(Math.abs(sb.remaining))}` : formatCurrency(sb.remaining)}
              </span>
            </div>
            {isOverBudget && (
              <p className="text-xs font-semibold text-red-500 mt-2 text-right tracking-wide uppercase">Over budget</p>
            )}
          </div>

          {/* RETENTION RELEASE — only if retention is active */}
          {retPct > 0 && (
            <>
              <hr className="border-foreground/20" />
              <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Retention Balance</p>
                  <p className={cn("text-xl font-bold font-mono tabular-nums", retentionBalance > 0 ? "text-foreground" : "text-green-600 dark:text-green-400")}>
                    {formatCurrency(retentionBalance)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {retentionBalance > 0 ? "Owed to sub upon project close" : "All retention released"}
                  </p>
                </div>
                <div>
                  {canReleaseRetention && !alreadyReleasedInvoice ? (
                    releaseRetentionConfirm ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white min-h-[36px] gap-1.5"
                          isLoading={releaseRetentionLoading}
                          onClick={handleReleaseRetention}
                        >
                          <Unlock className="h-4 w-4" /> Confirm Release
                        </Button>
                        <Button size="sm" variant="ghost" className="min-h-[36px]" onClick={() => setReleaseRetentionConfirm(false)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white min-h-[36px] gap-1.5"
                        onClick={() => setReleaseRetentionConfirm(true)}
                      >
                        <Unlock className="h-4 w-4" /> Release Retention ({formatCurrency(retentionBalance)})
                      </Button>
                    )
                  ) : alreadyReleasedInvoice ? (
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5">
                      <Unlock className="h-4 w-4" /> Release Pending — Invoice #{alreadyReleasedInvoice.invoiceNumber}
                    </p>
                  ) : retentionBalance === 0 && totalRetentionHeld > 0 ? (
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5">
                      <Unlock className="h-4 w-4" /> All retention released
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Available when project closes</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* PAYMENT TERMS SETTING — GC only */}
      {isGC && (
        <div className="mb-6 bg-card border border-border/50 rounded-2xl px-5 py-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">Payment Terms</p>
              <p className="text-xs text-muted-foreground">Net days applied to approved invoices</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[15, 30, 45].map((terms) => {
              const currentTerms = (sub as any).paymentTermsDays ?? 30;
              const isActive = currentTerms === terms;
              return (
                <button
                  key={terms}
                  disabled={paymentTermsSaving}
                  onClick={() => !isActive && handlePaymentTermsChange(terms)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-semibold border transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground",
                    paymentTermsSaving && "opacity-50 cursor-not-allowed"
                  )}
                >
                  Net {terms}
                </button>
              );
            })}
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
        {/* SCOPE COMPLETE — second progress bar / indicator */}
        {latestPercentageComplete != null && (
          <>
            <div className="flex items-center justify-between mb-1 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-muted-foreground">Scope Complete</span>
              </div>
              <span className={cn(
                "text-sm font-bold tabular-nums",
                scopeInconsistent ? "text-orange-600" : "text-primary"
              )}>
                {latestPercentageComplete}%
              </span>
            </div>
            <Progress
              value={latestPercentageComplete}
              className={cn("h-3 rounded-full", scopeInconsistent ? "[&>div]:bg-orange-500" : "[&>div]:bg-primary")}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>Per sub's last invoice</span>
              {scopeInconsistent && isGC && (
                <span className="text-orange-600 dark:text-orange-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Claims {latestPercentageComplete}% complete but only {invoicedPercent}% invoiced
                </span>
              )}
            </div>
          </>
        )}
        {/* BILLING DIVERGENCE WARNINGS */}
        {isGC && billingAheadWarning && latestPercentageComplete != null && (
          <div className="flex items-start gap-2 pt-2 border-t border-border">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
              Sub is billing ahead of reported progress — verify completion on site ({invoicedPercent}% invoiced vs {latestPercentageComplete}% reported complete)
            </p>
          </div>
        )}
        {isGC && underbillingNote && latestPercentageComplete != null && (
          <div className="flex items-start gap-2 pt-2 border-t border-border">
            <AlertTriangle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              Sub may be underbilling — consider discussing billing schedule ({latestPercentageComplete}% reported complete but only {invoicedPercent}% invoiced)
            </p>
          </div>
        )}

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

      {/* PERCENTAGE COMPLETE HISTORY CHART */}
      {percentageCompleteHistory.length >= 2 && (
        <div className="bg-card border border-border/50 rounded-2xl p-5 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Percent className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground">Scope Progress History</span>
            <span className="text-xs text-muted-foreground ml-auto">% complete per invoice</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={percentageCompleteHistory} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tickFormatter={(d) => format(new Date(d), "M/d")}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md text-xs">
                      <p className="font-bold text-foreground">{d.percentageComplete}% complete</p>
                      <p className="text-muted-foreground">Invoice #{d.invoiceNumber}</p>
                      <p className="text-muted-foreground">{format(new Date(d.date), "MMM d, yyyy")}</p>
                    </div>
                  );
                }}
              />
              <ReferenceLine y={100} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="percentageComplete"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

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
                <Pencil className="h-3.5 w-3.5" /> {!insurance?.id ? "Add Insurance" : "Update"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!insurance?.id ? (
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
          {insurance?.additionalRequirements && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Additional Insurance Requirements</p>
              <ul className="space-y-1">
                {insurance.additionalRequirements.split("\n").map(l => l.trim()).filter(Boolean).map((req, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CONTRACTOR LICENSE CARD */}
      <Card className={cn(
        "mb-6",
        licStatus === "EXPIRED" && "border-red-400 dark:border-red-700",
        licStatus === "EXPIRING_SOON" && "border-yellow-400 dark:border-yellow-700",
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {licStatus === "VALID" && <BadgeCheck className="h-5 w-5 text-blue-600" />}
              {licStatus === "EXPIRING_SOON" && <BadgeCheck className="h-5 w-5 text-yellow-600" />}
              {licStatus === "EXPIRED" && <BadgeCheck className="h-5 w-5 text-red-600" />}
              {licStatus === "NO_LICENSE" && <BadgeCheck className="h-5 w-5 text-muted-foreground" />}
              Contractor License
            </CardTitle>
            {isGC && (
              <Button size="sm" variant="outline" onClick={openLicDialog} className="gap-1.5 min-h-[36px]">
                <Pencil className="h-3.5 w-3.5" /> {licStatus === "NO_LICENSE" ? "Add License" : "Update"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {licStatus === "NO_LICENSE" ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {isGC ? "No contractor license on file. Click Add License to record their license details." : "No contractor license has been recorded yet. Contact the GC if you believe this is an error."}
              </p>
              {(sub as any).subLicenseNumber && (
                <div className="mt-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-4 py-3">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-1">Sub-Provided License Number</p>
                  <p className="font-mono font-semibold text-blue-900 dark:text-blue-200">{(sub as any).subLicenseNumber}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {license?.licenseNumber && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">License Number</p>
                    <p className="font-mono font-semibold">{license.licenseNumber}</p>
                  </div>
                )}
                {license?.licenseType && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">License Type</p>
                    <p className="font-semibold">{license.licenseType}</p>
                  </div>
                )}
                {license?.issuingState && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Issuing State</p>
                    <p className="font-semibold">{license.issuingState}</p>
                  </div>
                )}
                {license?.expirationDate && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Expiration Date</p>
                    <p className={cn("font-semibold flex items-center gap-1.5",
                      licStatus === "EXPIRED" && "text-red-600",
                      licStatus === "EXPIRING_SOON" && "text-yellow-700 dark:text-yellow-400",
                    )}>
                      <CalendarDays className="h-3.5 w-3.5" />
                      {license.expirationDate}
                    </p>
                  </div>
                )}
              </div>
              {(sub as any).subLicenseNumber && (
                <div className={cn(
                  "rounded-lg px-4 py-3 border",
                  license?.licenseNumber && (sub as any).subLicenseNumber === license.licenseNumber
                    ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                    : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                )}>
                  <p className={cn("text-xs font-semibold uppercase tracking-wide mb-1",
                    license?.licenseNumber && (sub as any).subLicenseNumber === license.licenseNumber
                      ? "text-green-700 dark:text-green-400"
                      : "text-amber-700 dark:text-amber-400"
                  )}>
                    {license?.licenseNumber && (sub as any).subLicenseNumber === license.licenseNumber
                      ? "Sub-Provided License — Matches"
                      : "Sub-Provided License — Verify Match"}
                  </p>
                  <p className="font-mono font-semibold">{(sub as any).subLicenseNumber}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SUBCONTRACT AGREEMENT CARD */}
      {(() => {
        const contractDocPath: string | null = (sub as any).contractDocPath ?? null;
        const contractDocName: string | null = (sub as any).contractDocName ?? null;
        const contractDocUploadedAt: string | null = (sub as any).contractDocUploadedAt ?? null;
        const signedContractPath: string | null = (sub as any).signedContractPath ?? null;
        const signedContractName: string | null = (sub as any).signedContractName ?? null;
        const signedContractUploadedAt: string | null = (sub as any).signedContractUploadedAt ?? null;
        const contractWaived: boolean = !!(sub as any).contractWaived;

        const contractStatus: "NO_DOCUMENT" | "PENDING_SUB_SIGNATURE" | "SIGNED_AND_UPLOADED" | "WAIVED" =
          contractWaived ? "WAIVED" :
          signedContractPath ? "SIGNED_AND_UPLOADED" :
          contractDocPath ? "PENDING_SUB_SIGNATURE" :
          "NO_DOCUMENT";

        const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

        return (
          <Card className={cn(
            "mb-6",
            contractStatus === "SIGNED_AND_UPLOADED" && "border-green-400 dark:border-green-700",
            contractStatus === "PENDING_SUB_SIGNATURE" && "border-yellow-400 dark:border-yellow-700",
          )}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSignature className={cn("h-5 w-5",
                    contractStatus === "SIGNED_AND_UPLOADED" ? "text-green-600" :
                    contractStatus === "PENDING_SUB_SIGNATURE" ? "text-yellow-600" :
                    contractStatus === "WAIVED" ? "text-muted-foreground" :
                    "text-muted-foreground"
                  )} />
                  Subcontract Agreement
                  <Badge variant="outline" className={cn("ml-1 text-xs font-semibold",
                    contractStatus === "SIGNED_AND_UPLOADED" && "border-green-400 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30",
                    contractStatus === "PENDING_SUB_SIGNATURE" && "border-yellow-400 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30",
                    contractStatus === "WAIVED" && "border-border text-muted-foreground",
                    contractStatus === "NO_DOCUMENT" && "border-border text-muted-foreground",
                  )}>
                    {contractStatus === "SIGNED_AND_UPLOADED" && "SIGNED & UPLOADED"}
                    {contractStatus === "PENDING_SUB_SIGNATURE" && "PENDING SUB SIGNATURE"}
                    {contractStatus === "WAIVED" && "WAIVED"}
                    {contractStatus === "NO_DOCUMENT" && "NO DOCUMENT"}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  {isGC && contractWaived && (
                    <Button size="sm" variant="outline" onClick={handleUnwaiveContract} isLoading={waiverLoading} className="gap-1.5 min-h-[36px] text-xs">
                      <Unlock className="h-3.5 w-3.5" /> Reinstate Requirement
                    </Button>
                  )}
                  {isGC && !contractWaived && (
                    <Button size="sm" variant="outline" onClick={handleWaiveContract} isLoading={waiverLoading} className="gap-1.5 min-h-[36px] text-xs text-muted-foreground hover:text-foreground">
                      <Ban className="h-3.5 w-3.5" /> Waive Requirement
                    </Button>
                  )}
                  {isGC && !contractWaived && (
                    <label className={cn(
                      "inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold border rounded-lg px-3 py-2 min-h-[36px] transition-colors",
                      (contractDocIsUploading || contractDocUploading) ? "opacity-60 pointer-events-none" : "hover:bg-muted",
                    )}>
                      {(contractDocIsUploading || contractDocUploading)
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading… {contractDocProgress}%</>
                        : <><Upload className="h-3.5 w-3.5" /> {contractDocPath ? "Replace Agreement" : "Upload Agreement"}</>
                      }
                      <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={e => { if (e.target.files?.[0]) { handleUploadContractDoc(e.target.files[0]); e.target.value = ""; } }} />
                    </label>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {contractStatus === "NO_DOCUMENT" && (
                <p className="text-sm text-muted-foreground">
                  {isGC ? "No subcontract agreement uploaded yet. Click Upload Agreement to attach your contract template for the sub to sign." : "No subcontract agreement has been uploaded by the GC yet."}
                </p>
              )}
              {contractStatus === "WAIVED" && (
                <p className="text-sm text-muted-foreground">The contract signature requirement has been waived by the GC for this subcontract.</p>
              )}

              {/* GC's original document */}
              {contractDocPath && (
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agreement Document (GC)</p>
                  <div className="flex items-center justify-between gap-3">
                    <a
                      href={`${BASE_URL}/api/storage${contractDocPath}`}
                      download={contractDocName ?? "subcontract-agreement"}
                      className="flex items-center gap-2 text-sm font-medium text-primary hover:underline min-w-0"
                    >
                      <FileDown className="h-4 w-4 shrink-0" />
                      <span className="truncate">{contractDocName ?? "Subcontract Agreement"}</span>
                    </a>
                    <div className="flex items-center gap-2 shrink-0">
                      {contractDocUploadedAt && (
                        <span className="text-xs text-muted-foreground">{format(new Date(contractDocUploadedAt), "MMM d, yyyy")}</span>
                      )}
                      {isGC && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteContractConfirmOpen(true)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub's signed document — upload area or display */}
              {contractDocPath && !contractWaived && (
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Signed Copy (Sub)</p>
                  {signedContractPath ? (
                    <div className="flex items-center justify-between gap-3">
                      <a
                        href={`${BASE_URL}/api/storage${signedContractPath}`}
                        download={signedContractName ?? "signed-contract"}
                        className="flex items-center gap-2 text-sm font-medium text-primary hover:underline min-w-0"
                      >
                        <FileDown className="h-4 w-4 shrink-0" />
                        <span className="truncate">{signedContractName ?? "Signed Contract"}</span>
                      </a>
                      <div className="flex items-center gap-2 shrink-0">
                        {signedContractUploadedAt && (
                          <span className="text-xs text-muted-foreground">{format(new Date(signedContractUploadedAt), "MMM d, yyyy")}</span>
                        )}
                        {isGC && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteSignedConfirmOpen(true)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      {!isGC ? (
                        <label className={cn(
                          "flex items-center gap-3 cursor-pointer border border-dashed rounded-xl px-4 py-3 transition-colors",
                          (signedDocIsUploading || signedDocUploading) ? "opacity-60 pointer-events-none border-border" : "border-border hover:border-primary/40 hover:bg-muted/30",
                        )}>
                          {(signedDocIsUploading || signedDocUploading)
                            ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
                            : <Upload className="h-4 w-4 text-muted-foreground shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {(signedDocIsUploading || signedDocUploading) ? `Uploading… ${signedDocProgress}%` : "Upload signed contract"}
                            </p>
                            <p className="text-xs text-muted-foreground">PDF, DOC, or DOCX</p>
                          </div>
                          <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={e => { if (e.target.files?.[0]) { handleUploadSignedDoc(e.target.files[0]); e.target.value = ""; } }} />
                        </label>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Awaiting signed copy from {(sub as any).sub?.companyName ?? "subcontractor"}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* COMPLIANCE CHECKLIST CARD */}
      {(complianceItems.length > 0 || insurance?.generalLiabilityCoverage != null || insurance?.workersCompCoverage != null || insurance?.additionalRequirements) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-5 w-5 text-primary" /> Compliance &amp; Insurance Requirements
              </CardTitle>
              <div className="flex items-center gap-1.5">
                {complianceItems.filter(i => i.required && !i.completion?.isComplete).length > 0 ? (
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full">
                    {complianceItems.filter(i => i.required && !i.completion?.isComplete).length} required pending
                  </span>
                ) : complianceItems.length > 0 ? (
                  <span className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="inline h-3 w-3 mr-0.5 -mt-0.5" /> All required complete
                  </span>
                ) : null}
              </div>
            </div>
            {isGC ? (
              <p className="text-xs text-muted-foreground mt-1">Mark items complete for this subcontractor. Required items must be completed before the sub can submit invoices.</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Complete all required items before submitting invoices. Upload documents if required.</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {(insurance?.generalLiabilityCoverage != null || insurance?.workersCompCoverage != null || insurance?.additionalRequirements) && (
              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/10 p-4">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Required Insurance Coverage
                </p>
                <ul className="space-y-1.5">
                  {insurance?.generalLiabilityCoverage != null && (
                    <li className="flex items-center gap-2 text-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                      General Liability — minimum {formatCurrency(insurance.generalLiabilityCoverage)}
                    </li>
                  )}
                  {insurance?.workersCompCoverage != null && (
                    <li className="flex items-center gap-2 text-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                      Workers Compensation — minimum {formatCurrency(insurance.workersCompCoverage)}
                    </li>
                  )}
                  {insurance?.additionalRequirements && insurance.additionalRequirements.split("\n").map(l => l.trim()).filter(Boolean).map((req, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {complianceItems.length > 0 && (
            <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
              {complianceItems.map(item => {
                const completion = item.completion;
                const isComplete = completion?.isComplete === true;
                const isMarkingThis = complianceMarkingId === item.id;
                const isUploadingThis = complianceUploadingId === item.id;
                return (
                  <div key={item.id} className={cn("p-3 flex items-start gap-3 transition-colors", isComplete ? "bg-green-50/50 dark:bg-green-950/10" : "bg-card hover:bg-muted/20")}>
                    <div className="mt-0.5 shrink-0">
                      {isComplete ? (
                        <CheckCircle2 className="h-4.5 w-4.5 text-green-600 dark:text-green-400 h-5 w-5" />
                      ) : (
                        <SquareCheck className={cn("h-5 w-5", item.required ? "text-orange-400" : "text-muted-foreground/40")} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={cn("text-sm font-medium leading-snug", isComplete && "line-through text-muted-foreground")}>{item.title}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {item.required ? (
                              <span className="text-xs font-semibold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 px-1.5 py-0.5 rounded-full">Required</span>
                            ) : (
                              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full border">Optional</span>
                            )}
                            {isComplete && completion?.completedByName && (
                              <span className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20 px-1.5 py-0.5 rounded-full border border-green-200 dark:border-green-800">
                                ✓ {completion.completedByName}
                              </span>
                            )}
                          </div>
                          {isComplete && completion?.documentName && (
                            <a
                              href={`${BASE_URL_SUB}/api/storage${completion.documentPath}`}
                              download={completion.documentName}
                              className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline"
                            >
                              <Download className="h-3 w-3" /> {completion.documentName}
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isComplete && item.allowDocumentUpload && (isSub || isGC) && (
                            <label className={cn("inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-primary/30 bg-primary/5 text-primary cursor-pointer hover:bg-primary/10 transition-colors", (isUploadingThis || complianceDocIsUploading) && "opacity-60 pointer-events-none")}>
                              {isUploadingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                              Upload Doc
                              <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => { if (e.target.files?.[0]) { handleUploadComplianceDoc(item.id, e.target.files[0]); e.target.value = ""; } }} disabled={isUploadingThis || complianceDocIsUploading} />
                            </label>
                          )}
                          {!isComplete && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs h-7"
                              disabled={isMarkingThis}
                              onClick={() => handleMarkComplianceComplete(item.id, true)}
                            >
                              {isMarkingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              Mark Done
                            </Button>
                          )}
                          {isComplete && (isGC || isSub) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 text-xs h-7 text-muted-foreground hover:text-destructive"
                              disabled={isMarkingThis}
                              onClick={() => handleMarkComplianceComplete(item.id, false)}
                            >
                              {isMarkingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                              Undo
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* DELETE CONTRACT DOCUMENT CONFIRM */}
      {deleteContractConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setDeleteContractConfirmOpen(false)}>
          <div className="bg-card rounded-2xl border shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold font-display text-destructive flex items-center gap-2"><Trash2 className="h-4 w-4" /> Remove Contract Agreement</h3>
            <p className="text-sm text-muted-foreground">This will also remove the signed copy if one was uploaded. This action cannot be undone.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteContractConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={handleDeleteContractDoc}>Remove</Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SIGNED CONTRACT CONFIRM */}
      {deleteSignedConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setDeleteSignedConfirmOpen(false)}>
          <div className="bg-card rounded-2xl border shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold font-display text-destructive flex items-center gap-2"><Trash2 className="h-4 w-4" /> Remove Signed Contract</h3>
            <p className="text-sm text-muted-foreground">This will remove the signed copy. The original agreement will remain. This action cannot be undone.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteSignedConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={handleDeleteSignedDoc}>Remove</Button>
            </div>
          </div>
        </div>
      )}

      {/* INSURANCE EDIT DIALOG */}
      <Dialog open={insDialogOpen} onOpenChange={setInsDialogOpen}>
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setInsDialogOpen(false)}>
          <div className="bg-card rounded-2xl border shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b shrink-0">
              <h3 className="text-lg font-bold font-display flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" /> Insurance Certificate Details
              </h3>
              <button onClick={() => setInsDialogOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSaveInsurance} className="p-6 space-y-4 overflow-y-auto">
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
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Additional Insurance Requirements</label>
                <p className="text-xs text-muted-foreground">Check common requirements — they'll be added to the text field automatically. You can also type custom requirements directly.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-3 rounded-lg border bg-muted/30">
                  {INSURANCE_PRESETS.map(preset => {
                    const lines = insAdditional.split("\n").map(l => l.trim()).filter(Boolean);
                    const checked = lines.includes(preset.label);
                    return (
                      <label key={preset.id} className="flex items-center gap-2 cursor-pointer select-none text-sm py-0.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleInsPreset(preset.label)}
                          className="rounded border-border accent-primary h-3.5 w-3.5 shrink-0"
                        />
                        <span className={cn("leading-snug", checked && "font-medium")}>{preset.label}</span>
                      </label>
                    );
                  })}
                </div>
                <Textarea
                  value={insAdditional}
                  onChange={e => setInsAdditional(e.target.value)}
                  placeholder="e.g. Umbrella Policy minimum $2,000,000&#10;Performance Bond required&#10;(one requirement per line)"
                  rows={4}
                  className="text-sm font-mono"
                />
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

      {/* LICENSE EDIT DIALOG */}
      <Dialog open={licDialogOpen} onOpenChange={setLicDialogOpen}>
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setLicDialogOpen(false)}>
          <div className="bg-card rounded-2xl border shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold font-display flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-primary" /> Contractor License Details
              </h3>
              <button onClick={() => setLicDialogOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSaveLicense} className="p-6 space-y-4">
              {(sub as any).subLicenseNumber && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-4 py-3">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-1">Sub-Provided License</p>
                  <p className="font-mono font-semibold text-blue-900 dark:text-blue-200">{(sub as any).subLicenseNumber}</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">License Number</label>
                  <Input value={licNumber} onChange={e => setLicNumber(e.target.value)} placeholder="e.g. C-10-123456" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">License Type</label>
                  <Input value={licType} onChange={e => setLicType(e.target.value)} placeholder="e.g. General, Electrical" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Issuing State</label>
                  <Input value={licState} onChange={e => setLicState(e.target.value)} placeholder="e.g. CA" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Expiration Date</label>
                  <Input type="date" value={licExpDate} onChange={e => setLicExpDate(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" className="flex-1" isLoading={licSaving}>Save License Details</Button>
                <Button type="button" variant="outline" onClick={() => setLicDialogOpen(false)}>Cancel</Button>
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
            {isGC && perms.canCreateChangeOrders && (
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
                          {!(inv as any).isRetentionRelease && (inv as any).percentageComplete != null && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                              <Percent className="h-3 w-3" />{(inv as any).percentageComplete}% complete
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
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-muted-foreground">{format(new Date(inv.createdAt), "MMM d, yyyy")}</p>
                          {(inv as any).paymentDueDate && ["APPROVED", "PAYMENT_UNCONFIRMED"].includes(inv.status) && (() => {
                            const dueDateInfo = getDueDateInfo((inv as any).paymentDueDate);
                            return dueDateInfo ? (
                              <p className={cn("text-xs flex items-center gap-1", dueDateInfo.className)}>
                                <CalendarDays className="h-3 w-3 shrink-0" />
                                {dueDateInfo.label}
                              </p>
                            ) : null;
                          })()}
                        </div>
                        {/* 7-day reminder banner for subs — approved invoice with due date within 7 days */}
                        {!isGC && inv.status === "APPROVED" && (inv as any).paymentDueDate && (() => {
                          const due = new Date((inv as any).paymentDueDate);
                          const diffDays = Math.ceil((due.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                          if (diffDays <= 7 && diffDays >= 0) {
                            return (
                              <div className="mt-2 flex items-start gap-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2">
                                <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-orange-700 dark:text-orange-300 font-semibold">
                                  Payment due in {diffDays} day{diffDays !== 1 ? "s" : ""} — your GC has not yet recorded a payment.
                                </p>
                              </div>
                            );
                          }
                          if (diffDays < 0) {
                            return (
                              <div className="mt-2 flex items-start gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700 dark:text-red-300 font-semibold">
                                  Payment overdue — this invoice was due {format(due, "MMM d, yyyy")} with no payment recorded yet.
                                </p>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {/* SCOPE REGRESSION WARNING — GC only */}
                        {isGC && scopeRegressionSet.has(inv.id) && (
                          <div className="mt-2 flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-700 dark:text-amber-300 font-semibold">
                              Warning: Sub previously reported {scopeRegressionPrevMap.get(inv.id)}% complete but is now reporting {(inv as any).percentageComplete}%
                            </p>
                          </div>
                        )}
                        {/* SCOPE INCONSISTENCY FLAG — GC only, on the latest invoice */}
                        {isGC && scopeInconsistent && latestPercentageComplete != null && (inv as any).percentageComplete === latestPercentageComplete && !(inv as any).isRetentionRelease && (
                          <div className="mt-2 flex items-start gap-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-700 rounded-lg px-3 py-2">
                            <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-orange-700 dark:text-orange-300 font-semibold">
                              Sub claims {latestPercentageComplete}% complete but has only invoiced {invoicedPercent}% of contract value — verify scope progress
                            </p>
                          </div>
                        )}
                        {/* REJECTION REASON — shown in red to both GC and sub */}
                        {inv.status === "REJECTED" && (inv as any).rejectionReason && (
                          <div className="mt-2 flex items-start gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                            <X className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide block mb-0.5">Rejected</span>
                              <span className="text-sm text-red-700 dark:text-red-300">{(inv as any).rejectionReason}</span>
                            </div>
                          </div>
                        )}
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
                        {isGC && perms.canApproveInvoices && (inv.status === "PENDING" || inv.status === "FLAGGED") && (
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
                        {isGC && perms.canApproveInvoices && inv.status === "APPROVED" && (
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

                    {/* Sub: resubmit banner on rejected invoices */}
                    {!isGC && inv.status === "REJECTED" && (
                      <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3 space-y-2">
                        <p className="text-sm text-muted-foreground flex items-start gap-2">
                          <Receipt className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                          Make the necessary corrections and resubmit your invoice.
                        </p>
                        <Button
                          size="sm"
                          className="gap-1.5 min-h-[44px] w-full sm:w-auto"
                          onClick={() => {
                            setInvAmount(String(inv.amount));
                            setInvNumber("");
                            setInvDescription(inv.description ?? "");
                            setInvDialogOpen(true);
                          }}
                        >
                          <PlusCircle className="h-4 w-4" /> Resubmit Invoice
                        </Button>
                      </div>
                    )}

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

      {/* MESSAGES */}
      <Card className="mb-8">
        <CardHeader className="border-b pb-4">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" /> Messages
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1 mb-4">
            {comments.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No messages yet. Start the conversation below.</p>
              </div>
            ) : (
              comments.map((c: any) => {
                const isMe = c.userId === user?.id;
                return (
                  <div key={c.id} className={`flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium">{c.companyName}</span>
                      <Badge variant={c.role === "GC" ? "default" : "secondary"} className="text-[10px] py-0 h-4">{c.role}</Badge>
                    </div>
                    <div className={`rounded-lg px-4 py-2.5 text-sm max-w-[80%] break-words shadow-sm ${isMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      {c.message}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex gap-2 items-end border-t pt-4">
            <Textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Type a message…"
              className="min-h-[72px] resize-none flex-1 text-sm"
              maxLength={2000}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSendComment();
                }
              }}
            />
            <Button onClick={handleSendComment} disabled={sendingComment || !commentText.trim()} className="h-10 px-5 shrink-0">
              {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Press Ctrl+Enter to send</p>
        </CardContent>
      </Card>

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
                        <Badge
                          variant={entry.actorRole === "SUB" ? "secondary" : "default"}
                          className={cn(
                            "text-[10px] py-0 h-4",
                            entry.actorRole === "OWNER" && "bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100"
                          )}
                        >
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

      <Dialog open={invDialogOpen} onOpenChange={(open) => { if (!open) { setInvDialogOpen(false); setInvNumber(""); setInvAmount(""); setInvDescription(""); setInvPercent(""); } }} title="Submit Invoice">
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
              Percentage of Total Scope Complete <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-muted-foreground mb-1.5">
              As of this invoice, what percentage of your total scope of work is complete? (e.g. 65)
            </p>
            <div className="relative">
              <Input
                required
                type="number"
                min="1"
                max="100"
                step="1"
                placeholder="e.g. 65"
                value={invPercent}
                onChange={e => setInvPercent(e.target.value)}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold pointer-events-none">%</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">
              Description / Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </label>
            <Input placeholder="e.g. Rough-in electrical work, weeks 3–4" value={invDescription} onChange={e => setInvDescription(e.target.value)} />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => { setInvDialogOpen(false); setInvNumber(""); setInvAmount(""); setInvDescription(""); setInvPercent(""); }}>Cancel</Button>
            <Button type="submit" className="min-h-[44px]" isLoading={submittingInv}>Submit Invoice</Button>
          </div>
        </form>
      </Dialog>

      {/* Reject Invoice Dialog — requires a reason */}
      <Dialog
        open={rejectInvConfirm.open}
        onOpenChange={(open) => { if (!open) { setRejectInvConfirm({ open: false, id: "", invoiceNumber: "", amount: 0 }); setRejectInvReason(""); } }}
        title="Reject Invoice"
      >
        <form onSubmit={e => { e.preventDefault(); handleRejectInv(); }} className="space-y-4">
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4">
            <p className="text-sm text-foreground">
              Rejecting{" "}
              <span className="font-semibold">Invoice #{rejectInvConfirm.invoiceNumber}</span>
              {" "}— {" "}
              <span className="font-mono font-bold">{formatCurrency(rejectInvConfirm.amount)}</span>
            </p>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">
              Why are you rejecting this invoice? <span className="text-destructive">*</span>
            </label>
            <Textarea
              required
              placeholder="e.g. Work not completed in section 3 — please resubmit when finished"
              className="min-h-[100px] resize-none"
              value={rejectInvReason}
              onChange={e => setRejectInvReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              This reason will be sent to the subcontractor by email and shown on their invoice.
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              className="min-h-[44px]"
              onClick={() => { setRejectInvConfirm({ open: false, id: "", invoiceNumber: "", amount: 0 }); setRejectInvReason(""); }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="min-h-[44px]"
              disabled={!rejectInvReason.trim()}
            >
              Reject Invoice
            </Button>
          </div>
        </form>
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
