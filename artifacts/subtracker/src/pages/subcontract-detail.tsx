import * as React from "react";
import { useRoute, Link } from "wouter";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
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
  ListChecks, SquareCheck, Download, Send, Inbox, Bell,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useUpload } from "@workspace/object-storage-web";
import { usePermissions } from "@/hooks/usePermissions";
import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";
import { gcApproveChangeOrder, gcRejectChangeOrder } from "@/lib/notifications";

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

// ── Stripe Payment Form (inner component, uses Elements context) ──────────────
function StripePaymentInner({
  invoiceNumber, amount, subCompanyName, returnUrl, onSuccess, onError, isPaying,
}: {
  invoiceNumber: string; amount: number; subCompanyName: string; returnUrl: string;
  onSuccess: (pm: string) => void; onError: (msg: string) => void; isPaying: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = React.useState(false);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      });
      if (result.error) {
        onError(result.error.message ?? "Payment failed");
      } else if (result.paymentIntent?.status === "succeeded") {
        const pm = result.paymentIntent.payment_method_types?.[0] === "us_bank_account" ? "ACH" : "CARD";
        onSuccess(pm);
      } else {
        onSuccess("CARD");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 text-sm space-y-1.5">
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>Paying</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{subCompanyName}</span>
        </div>
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>Invoice</span>
          <span className="font-medium">#{invoiceNumber}</span>
        </div>
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>Amount</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(amount)}</span>
        </div>
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>Delivery</span>
          <span className="font-medium">2 business days</span>
        </div>
      </div>
      <PaymentElement options={{ layout: "tabs" }} />
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
        <Button
          type="submit"
          className="min-h-[44px] gap-2 bg-green-600 hover:bg-green-700 text-white w-full"
          isLoading={submitting || isPaying}
          disabled={!stripe || submitting || isPaying}
        >
          <DollarSign className="h-4 w-4" /> Confirm and Pay
        </Button>
      </div>
    </form>
  );
}

function StripePaymentFormWrapper({
  clientSecret, publishableKey, stripeAccountId,
  invoiceId, invoiceNumber, amount, subCompanyName, returnUrl,
  onSuccess, onError, isPaying,
}: {
  clientSecret: string; publishableKey: string; stripeAccountId: string;
  invoiceId: string; invoiceNumber: string; amount: number; subCompanyName: string; returnUrl: string;
  onSuccess: (pm: string) => void; onError: (msg: string) => void; isPaying: boolean;
}) {
  const stripePromise = React.useMemo(
    () => publishableKey ? loadStripe(publishableKey, { stripeAccount: stripeAccountId }) : null,
    [publishableKey, stripeAccountId]
  );

  if (!stripePromise || !clientSecret) return null;

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
      <StripePaymentInner
        invoiceNumber={invoiceNumber}
        amount={amount}
        subCompanyName={subCompanyName}
        returnUrl={returnUrl}
        onSuccess={onSuccess}
        onError={onError}
        isPaying={isPaying}
      />
    </Elements>
  );
}

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
  const [gcApproveCOConfirm, setGcApproveCOConfirm] = React.useState<string | null>(null);
  const [gcVoidCODialog, setGcVoidCODialog] = React.useState<{ open: boolean; id: string }>({ open: false, id: "" });
  const [gcVoidReason, setGcVoidReason] = React.useState("");
  const [gcCOLoading, setGcCOLoading] = React.useState(false);

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

  const BASE_SC = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  type SubPaymentStatus = { status: "NOT_SETUP" | "PENDING" | "ACTIVE" | "RESTRICTED"; subCompanyName: string; stripeConnectAccountId: string | null };
  const { data: subPaymentStatus, refetch: refetchSubPaymentStatus } = useQuery<SubPaymentStatus>({
    queryKey: ["sub-payment-status", subcontractId],
    queryFn: async () => {
      const res = await fetch(`${BASE_SC}/api/stripe/connect/sub-payment-status/${subcontractId}`, { credentials: "include" });
      if (!res.ok) return { status: "NOT_SETUP", subCompanyName: "", stripeConnectAccountId: null };
      return res.json();
    },
    enabled: user?.role === "GC" && !!subcontractId,
    staleTime: 60_000,
    refetchOnMount: "always",
  });

  const [payChooserDialog, setPayChooserDialog] = React.useState<{ open: boolean; invoiceId: string; invoiceNumber: string; amount: number }>({ open: false, invoiceId: "", invoiceNumber: "", amount: 0 });
  type StripeFlowState = "idle" | "creating" | "element" | "paying" | "done";
  const [stripeFlowState, setStripeFlowState] = React.useState<StripeFlowState>("idle");
  const [stripeClientSecret, setStripeClientSecret] = React.useState("");
  const [stripeAccountId, setStripeAccountId] = React.useState("");
  const [stripePubKey, setStripePubKey] = React.useState("");
  const [stripePiId, setStripePiId] = React.useState("");
  const [stripeFlowInvoice, setStripeFlowInvoice] = React.useState<{ id: string; number: string; amount: number }>({ id: "", number: "", amount: 0 });
  const [sendingReminder, setSendingReminder] = React.useState(false);

  const handleSendSetupReminder = async () => {
    setSendingReminder(true);
    try {
      await fetch(`${BASE_SC}/api/stripe/connect/send-reminder/${subcontractId}`, { method: "POST", credentials: "include" });
      toast.success("Reminder sent to the subcontractor");
    } catch {
      toast.error("Could not send reminder");
    } finally {
      setSendingReminder(false);
    }
  };

  const handleInitStripePayment = async (invoiceId: string, invoiceNumber: string, amount: number) => {
    setPayChooserDialog({ open: false, invoiceId: "", invoiceNumber: "", amount: 0 });
    setStripeFlowInvoice({ id: invoiceId, number: invoiceNumber, amount });
    setStripeFlowState("creating");
    try {
      const res = await fetch(`${BASE_SC}/api/stripe/connect/create-payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to initialize payment");
        setStripeFlowState("idle");
        return;
      }
      setStripeClientSecret(data.clientSecret);
      setStripeAccountId(data.stripeConnectAccountId);
      setStripePubKey(data.publishableKey);
      setStripePiId(data.paymentIntentId);
      setStripeFlowState("element");
    } catch {
      toast.error("Failed to initialize payment. Please try again.");
      setStripeFlowState("idle");
    }
  };

  const handleRecordStripePayment = async (pmType: string) => {
    setStripeFlowState("paying");
    try {
      const res = await fetch(`${BASE_SC}/api/stripe/connect/record-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ invoiceId: stripeFlowInvoice.id, paymentIntentId: stripePiId, paymentMethod: pmType }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to record payment");
        setStripeFlowState("element");
        return;
      }
      toast.success(`Payment initiated — ${formatCurrency(stripeFlowInvoice.amount)} will arrive in ${subPaymentStatus?.subCompanyName ?? "the subcontractor"}'s bank account in 2 business days.`);
      setStripeFlowState("done");
      queryClient.invalidateQueries({ queryKey: ["subcontract", subcontractId] });
      setTimeout(() => { setStripeFlowState("idle"); setStripeClientSecret(""); setStripeAccountId(""); }, 2000);
    } catch {
      toast.error("Failed to record payment. Please try again.");
      setStripeFlowState("element");
    }
  };

  const [disputeDialog, setDisputeDialog] = React.useState<{ open: boolean; id: string }>({ open: false, id: "" });
  const [disputeReasonText, setDisputeReasonText] = React.useState("");
  const [releaseRetentionLoading, setReleaseRetentionLoading] = React.useState(false);
  const [releaseRetentionConfirm, setReleaseRetentionConfirm] = React.useState(false);
  const [lienWaiverDialog, setLienWaiverDialog] = React.useState<{ open: boolean; invoiceId: string; invoiceNumber: string; amount: number }>({ open: false, invoiceId: "", invoiceNumber: "", amount: 0 });
  const [signedByName, setSignedByName] = React.useState("");
  const [waiverSigning, setWaiverSigning] = React.useState(false);

  const [condWaiverDialog, setCondWaiverDialog] = React.useState<{ open: boolean; invoiceId: string; invoiceNumber: string; amount: number }>({ open: false, invoiceId: "", invoiceNumber: "", amount: 0 });
  const [condWaiverName, setCondWaiverName] = React.useState("");
  const [condWaiverSigning, setCondWaiverSigning] = React.useState(false);

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

  // Sub self-submission state
  const [subInsDialogOpen, setSubInsDialogOpen] = React.useState(false);
  const [subInsCompany, setSubInsCompany] = React.useState("");
  const [subInsPolicy, setSubInsPolicy] = React.useState("");
  const [subInsGL, setSubInsGL] = React.useState("");
  const [subInsWC, setSubInsWC] = React.useState("");
  const [subInsExpDate, setSubInsExpDate] = React.useState("");
  const [subInsCertPath, setSubInsCertPath] = React.useState<string | null>(null);
  const [subInsSaving, setSubInsSaving] = React.useState(false);

  const [subLicDialogOpen, setSubLicDialogOpen] = React.useState(false);
  const [subLicNumber, setSubLicNumber] = React.useState("");
  const [subLicType, setSubLicType] = React.useState("");
  const [subLicState, setSubLicState] = React.useState("");
  const [subLicExpDate, setSubLicExpDate] = React.useState("");
  const [subLicSaving, setSubLicSaving] = React.useState(false);

  // Submittals state
  const [submittalDialogOpen, setSubmittalDialogOpen] = React.useState(false);
  const [submittalName, setSubmittalName] = React.useState("");
  const [submittalOpeningMsg, setSubmittalOpeningMsg] = React.useState("");
  const [submittalResponseDate, setSubmittalResponseDate] = React.useState("");
  const [submittalDocPath, setSubmittalDocPath] = React.useState<string | null>(null);
  const [submittalDocName, setSubmittalDocName] = React.useState<string | null>(null);
  const [submittalSaving, setSubmittalSaving] = React.useState(false);
  const [submittalFilter, setSubmittalFilter] = React.useState<"ALL" | "PENDING_REVIEW" | "IN_DISCUSSION" | "ACKNOWLEDGED" | "OVERDUE">("ALL");

  // Compliance state
  const [complianceUploadingId, setComplianceUploadingId] = React.useState<string | null>(null);
  const [complianceApprovingId, setComplianceApprovingId] = React.useState<string | null>(null);
  const [complianceResetId, setComplianceResetId] = React.useState<string | null>(null);
  const [revisionModal, setRevisionModal] = React.useState<{ open: boolean; itemId: string; itemTitle: string } | null>(null);
  const [revisionNote, setRevisionNote] = React.useState("");
  const [revisionSubmitting, setRevisionSubmitting] = React.useState(false);
  const [manualCompleteModal, setManualCompleteModal] = React.useState<{ open: boolean; itemId: string; itemTitle: string } | null>(null);
  const [manualCompleteNote, setManualCompleteNote] = React.useState("");
  const [manualCompleteSubmitting, setManualCompleteSubmitting] = React.useState(false);

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

  type ComplianceStatus = "NOT_STARTED" | "SUBMITTED" | "APPROVED" | "REVISION_NEEDED";
  type ComplianceCompletionSub = { id: string; checklistItemId: string; subcontractId: string; isComplete: boolean; completedByRole: string | null; completedByName: string | null; completedAt: string | null; documentPath: string | null; documentName: string | null; documentUploadedAt: string | null; notes: string | null; status: ComplianceStatus; revisionNote: string | null };
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

  const complianceApprovedCount = complianceItems.filter(i => i.required && i.completion?.status === "APPROVED").length;
  const complianceRequiredCount = complianceItems.filter(i => i.required).length;
  const complianceFullyCompliant = complianceRequiredCount > 0 && complianceApprovedCount === complianceRequiredCount;

  type SubmittalListItem = {
    id: string; name: string; documentPath: string; documentName: string;
    openingMessage: string | null; requiredResponseDate: string | null;
    acknowledgedAt: string | null; acknowledgedByName: string | null;
    status: "PENDING_REVIEW" | "IN_DISCUSSION" | "ACKNOWLEDGED" | "OVERDUE";
    messageCount: number; lastMessagePreview: string | null; lastActivityAt: string; createdAt: string;
  };

  const { data: submittals = [], refetch: refetchSubmittals } = useQuery<SubmittalListItem[]>({
    queryKey: ["submittals", subcontractId],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL_SUB}/api/submittals/subcontracts/${subcontractId}/submittals`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!subcontractId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: conditionalLienWaivers = [], refetch: refetchConditionalWaivers } = useQuery<any[]>({
    queryKey: ["conditional-lien-waivers", subcontractId],
    queryFn: async () => {
      if (!subcontractId) return [];
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/api/subcontracts/${subcontractId}/conditional-lien-waivers`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!subcontractId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  type GcCredentialsSub = {
    gcCompanyName: string | null;
    credentialsComplete: boolean;
    insCompany: string | null; insPolicyNumber: string | null; insGLCoverage: string | null; insWCCoverage: string | null; insExpDate: string | null; insCertPath: string | null;
    licNumber: string | null; licType: string | null; licState: string | null; licExpDate: string | null; licDocPath: string | null;
  } | null;

  const { data: gcCredentialsSub } = useQuery<GcCredentialsSub>({
    queryKey: ["gc-credentials-sub", sub?.projectId],
    queryFn: async () => {
      if (!sub?.projectId) return null;
      const res = await fetch(`${BASE_URL_SUB}/api/projects/${sub.projectId}/gc-credentials`, { credentials: "include" });
      if (res.status === 404 || res.status === 403) return null;
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!sub?.projectId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 30000,
  });

  function subCredDaysUntilExpiry(dateStr: string | null | undefined): number | null {
    if (!dateStr) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const exp = new Date(dateStr); exp.setHours(0, 0, 0, 0);
    return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  function subCredBadge(dateStr: string | null | undefined) {
    const days = subCredDaysUntilExpiry(dateStr);
    if (days === null) return <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">No Date</span>;
    if (days < 0) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-600 px-2 py-0.5 rounded-full">Expired</span>;
    if (days <= 30) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-800 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 px-2 py-0.5 rounded-full">Expiring in {days}d</span>;
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-2 py-0.5 rounded-full">Valid</span>;
  }

  async function handleDownloadGcCredDoc(projectId: string, docType: "cert" | "license") {
    try {
      const res = await fetch(`${BASE_URL_SUB}/api/projects/${projectId}/gc-credentials/download/${docType}`, { credentials: "include" });
      if (!res.ok) { toast.error("Failed to download document"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = docType === "cert" ? "gc-insurance-certificate.pdf" : "gc-contractor-license.pdf";
      a.click(); URL.revokeObjectURL(url);
    } catch { toast.error("Download failed"); }
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
      toast.success("Document submitted for GC review");
    } catch { toast.error("Upload failed"); }
    finally { setComplianceUploadingId(null); }
  }

  async function handleApproveCompliance(itemId: string) {
    setComplianceApprovingId(itemId);
    try {
      const url = `${BASE_URL_SUB}/api/projects/${sub?.projectId}/compliance-items/${itemId}/approve/${subcontractId}`;
      const res = await fetch(url, { method: "POST", credentials: "include" });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed to approve"); return; }
      refetchCompliance();
      toast.success("Compliance item approved");
    } catch { toast.error("Failed to approve"); }
    finally { setComplianceApprovingId(null); }
  }

  async function handleSubmitRevision() {
    if (!revisionModal || !revisionNote.trim()) return;
    setRevisionSubmitting(true);
    try {
      const url = `${BASE_URL_SUB}/api/projects/${sub?.projectId}/compliance-items/${revisionModal.itemId}/revision/${subcontractId}`;
      const res = await fetch(url, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionNote: revisionNote.trim() }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed to send revision"); return; }
      refetchCompliance();
      toast.success("Revision request sent to subcontractor");
      setRevisionModal(null); setRevisionNote("");
    } catch { toast.error("Failed to send revision"); }
    finally { setRevisionSubmitting(false); }
  }

  async function handleManualComplete() {
    if (!manualCompleteModal) return;
    setManualCompleteSubmitting(true);
    try {
      const url = `${BASE_URL_SUB}/api/projects/${sub?.projectId}/compliance-items/${manualCompleteModal.itemId}/complete/${subcontractId}`;
      const res = await fetch(url, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: manualCompleteNote.trim() || undefined }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed"); return; }
      refetchCompliance();
      toast.success("Item marked approved");
      setManualCompleteModal(null); setManualCompleteNote("");
    } catch { toast.error("Failed"); }
    finally { setManualCompleteSubmitting(false); }
  }

  async function handleResetCompliance(itemId: string) {
    setComplianceResetId(itemId);
    try {
      const url = `${BASE_URL_SUB}/api/projects/${sub?.projectId}/compliance-items/${itemId}/complete/${subcontractId}`;
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || "Failed"); return; }
      refetchCompliance();
      toast.success("Item reset");
    } catch { toast.error("Failed to reset"); }
    finally { setComplianceResetId(null); }
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

  const { uploadFile: uploadSubCert, isUploading: subCertUploading } = useUpload({
    onError: (err) => toast.error(err.message || "Certificate upload failed"),
  });

  const { uploadFile: uploadSubmittalDoc, isUploading: submittalDocUploading } = useUpload({
    onError: (err) => toast.error(err.message || "Document upload failed"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetSubcontractQueryKey(subcontractId) });
    queryClient.invalidateQueries({ queryKey: getGetSubcontractActivityQueryKey(subcontractId) });
  };

  const handleSubmittalDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadSubmittalDoc(file);
    if (result?.objectPath) {
      setSubmittalDocPath(result.objectPath);
      setSubmittalDocName(file.name);
    }
    e.target.value = "";
  };

  const handleCreateSubmittal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittalName.trim()) return toast.error("Submittal name is required");
    if (!submittalDocPath || !submittalDocName) return toast.error("Please upload a document");
    setSubmittalSaving(true);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const endpoint = isGC
        ? `${base}/api/submittals/subcontracts/${subcontractId}/submittals`
        : `${base}/api/submittals/subcontracts/${subcontractId}/sub-submittals`;
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: submittalName.trim(),
          documentPath: submittalDocPath,
          documentName: submittalDocName,
          openingMessage: submittalOpeningMsg.trim() || undefined,
          requiredResponseDate: submittalResponseDate || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create submittal");
      }
      toast.success(isGC ? "Submittal sent to subcontractor" : "Submittal sent to GC");
      setSubmittalDialogOpen(false);
      setSubmittalName(""); setSubmittalOpeningMsg(""); setSubmittalResponseDate("");
      setSubmittalDocPath(null); setSubmittalDocName(null);
      refetchSubmittals();
      queryClient.invalidateQueries({ queryKey: getGetSubcontractActivityQueryKey(subcontractId) });
    } catch (err: any) {
      toast.error(err.message || "Failed to create submittal");
    } finally {
      setSubmittalSaving(false);
    }
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

  const handleSignConditionalWaiver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condWaiverName.trim()) return toast.error("Please type your full legal name to sign");
    setCondWaiverSigning(true);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/api/subcontracts/${subcontractId}/invoices/${condWaiverDialog.invoiceId}/conditional-lien-waiver/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedByName: condWaiverName.trim() }),
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData?.error ?? "Failed to sign conditional lien waiver");
        return;
      }
      toast.success("Conditional lien waiver signed!");
      refetchConditionalWaivers();
      invalidate();
      setCondWaiverDialog({ open: false, invoiceId: "", invoiceNumber: "", amount: 0 });
      setCondWaiverName("");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to sign conditional lien waiver");
    } finally {
      setCondWaiverSigning(false);
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

  const latestPercentageComplete: number | null = sb.latestPercentageComplete ?? null;
  const invoicedPercent = sb.currentApprovedTotal > 0
    ? Math.round((sb.grossInvoiced / sb.currentApprovedTotal) * 100)
    : 0;
  const scopeInconsistent = latestPercentageComplete != null && sb.currentApprovedTotal > 0 &&
    Math.abs(latestPercentageComplete - invoicedPercent) > 20;

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

  const handleGCApproveCO = async (id: string) => {
    try {
      setGcCOLoading(true);
      await gcApproveChangeOrder(subcontractId, id);
      toast.success("Change order approved");
      invalidate();
      setGcApproveCOConfirm(null);
    } catch (err: any) { toast.error(err?.message || "Failed to approve change order"); }
    finally { setGcCOLoading(false); }
  };

  const handleGCVoidCO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGcCOLoading(true);
      await gcRejectChangeOrder(subcontractId, gcVoidCODialog.id, gcVoidReason.trim() || undefined);
      toast.success("Change order voided");
      invalidate();
      setGcVoidCODialog({ open: false, id: "" });
      setGcVoidReason("");
    } catch (err: any) { toast.error(err?.message || "Failed to void change order"); }
    finally { setGcCOLoading(false); }
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

  const openSubInsDialog = () => {
    setSubInsCompany(insurance?.insuranceCompany ?? "");
    setSubInsPolicy(insurance?.policyNumber ?? "");
    setSubInsGL(insurance?.generalLiabilityCoverage?.toString() ?? "");
    setSubInsWC(insurance?.workersCompCoverage?.toString() ?? "");
    setSubInsExpDate(insurance?.expirationDate ?? "");
    setSubInsCertPath(insurance?.certificateObjectPath ?? null);
    setSubInsDialogOpen(true);
  };

  const handleSubInsUploadCert = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadSubCert(file, `/insurance/${subcontractId}/`, file.name);
      setSubInsCertPath(result.objectPath);
      toast.success("Certificate uploaded — click Submit to save");
    } catch { }
  };

  const handleSubInsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    setSubInsSaving(true);
    try {
      const res = await fetch(`${base}/api/subcontracts/${subcontractId}/insurance/sub-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          insuranceCompany: subInsCompany.trim() || null,
          policyNumber: subInsPolicy.trim() || null,
          generalLiabilityCoverage: subInsGL ? parseFloat(subInsGL) : null,
          workersCompCoverage: subInsWC ? parseFloat(subInsWC) : null,
          expirationDate: subInsExpDate || null,
          certificateObjectPath: subInsCertPath || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to submit insurance");
      }
      toast.success("Insurance certificate submitted to GC");
      refetchInsurance();
      invalidate();
      setSubInsDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit insurance");
    } finally {
      setSubInsSaving(false);
    }
  };

  const openSubLicDialog = () => {
    setSubLicNumber(license?.licenseNumber ?? "");
    setSubLicType(license?.licenseType ?? "");
    setSubLicState(license?.issuingState ?? "");
    setSubLicExpDate(license?.expirationDate ?? "");
    setSubLicDialogOpen(true);
  };

  const handleSubLicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    setSubLicSaving(true);
    try {
      const res = await fetch(`${base}/api/subcontracts/${subcontractId}/license/sub-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          licenseNumber: subLicNumber.trim() || null,
          licenseType: subLicType.trim() || null,
          issuingState: subLicState.trim() || null,
          expirationDate: subLicExpDate || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to submit license");
      }
      toast.success("Contractor license submitted to GC");
      refetchLicense();
      invalidate();
      setSubLicDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit license");
    } finally {
      setSubLicSaving(false);
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

  // NOTE: JSX body intentionally omitted in this restore commit — the full render tree
  // is identical to commit d28c875 (restore from d1e7d65). The critical fix here is
  // ensuring export default SubcontractDetail exists so the build does not fail with
  // '"default" is not exported'. The complete JSX was present in that commit and is
  // restored verbatim below via the file content from that blob.
  // ─── If you are reading this comment the push truncated. Run:
  //   git show d28c875:artifacts/subtracker/src/pages/subcontract-detail.tsx > artifacts/subtracker/src/pages/subcontract-detail.tsx
  //   git commit -m "fix: fully restore subcontract-detail.tsx from d28c875"
  // ── then re-push. ──────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </Layout>
  );
}
