import * as React from "react";
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useGetMe } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  ArrowLeft, Download, FileText, Send, Upload, CheckCircle2,
  Clock, AlertTriangle, MessageSquare, X, CalendarDays, Loader2,
} from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";
import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type SubmittalStatus = "PENDING_REVIEW" | "IN_DISCUSSION" | "ACKNOWLEDGED" | "OVERDUE";

interface SubmittalMessage {
  id: string;
  submittalId: string;
  senderId: string;
  senderName: string;
  senderRole: "GC" | "SUB";
  message: string | null;
  documentPath: string | null;
  documentName: string | null;
  createdAt: string;
}

interface SubmittalDetail {
  id: string;
  subcontractId: string;
  projectId: string;
  name: string;
  documentPath: string;
  documentName: string;
  openingMessage: string | null;
  requiredResponseDate: string | null;
  acknowledgedAt: string | null;
  acknowledgedByName: string | null;
  acknowledgmentMessage: string | null;
  status: SubmittalStatus;
  projectName: string;
  gcCompanyName: string;
  subCompanyName: string;
  messages: SubmittalMessage[];
  createdAt: string;
  /** Which role originally created this submittal */
  creatorRole: "GC" | "SUB";
}

function getStatusConfig(status: SubmittalStatus) {
  switch (status) {
    case "PENDING_REVIEW":
      return { label: "Pending Review", className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800" };
    case "IN_DISCUSSION":
      return { label: "In Discussion", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800" };
    case "ACKNOWLEDGED":
      return { label: "Acknowledged", className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800" };
    case "OVERDUE":
      return { label: "Overdue", className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800" };
  }
}

async function downloadSubmittalDocument(submittalId: string, fileName: string) {
  const res = await fetch(`${BASE}/api/submittals/${submittalId}/document`, { credentials: "include" });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadMessageDocument(path: string, fileName: string) {
  const encoded = encodeURIComponent(path);
  const res = await fetch(`${BASE}/api/storage/download?path=${encoded}`, { credentials: "include" });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SubmittalDetail() {
  const [, params] = useRoute("/submittals/:id");
  const submittalId = params?.id ?? "";
  const { data: user } = useGetMe();
  const queryClient = useQueryClient();
  const isGC = user?.role === "GC";

  const { data: submittal, isLoading } = useQuery<SubmittalDetail>({
    queryKey: ["submittal", submittalId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/submittals/${submittalId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load submittal");
      return res.json();
    },
    enabled: !!submittalId,
    refetchInterval: 15_000,
  });

  usePageTitle(submittal?.name ?? "Submittal");

  // Message state
  const [msgText, setMsgText] = React.useState("");
  const [msgDocPath, setMsgDocPath] = React.useState<string | null>(null);
  const [msgDocName, setMsgDocName] = React.useState<string | null>(null);
  const [sendingMsg, setSendingMsg] = React.useState(false);

  // Acknowledge state
  const [ackDialogOpen, setAckDialogOpen] = React.useState(false);
  const [ackMsg, setAckMsg] = React.useState("");
  const [ackLoading, setAckLoading] = React.useState(false);

  // Download states
  const [downloadingDoc, setDownloadingDoc] = React.useState<string | null>(null);

  const { uploadFile: uploadMsgDoc, isUploading: msgDocUploading } = useUpload({
    onError: (err) => toast.error(err.message || "Upload failed"),
  });

  const handleMsgDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadMsgDoc(file);
    if (result?.objectPath) {
      setMsgDocPath(result.objectPath);
      setMsgDocName(file.name);
      toast.success("Document ready to send");
    }
    e.target.value = "";
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgText.trim() && !msgDocPath) {
      toast.error("Please enter a message or upload a document");
      return;
    }
    setSendingMsg(true);
    try {
      const res = await fetch(`${BASE}/api/submittals/${submittalId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msgText.trim() || undefined, documentPath: msgDocPath || undefined, documentName: msgDocName || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send message");
      }
      setMsgText("");
      setMsgDocPath(null);
      setMsgDocName(null);
      queryClient.invalidateQueries({ queryKey: ["submittal", submittalId] });
      toast.success("Message sent");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSendingMsg(false);
    }
  };

  const handleAcknowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    setAckLoading(true);
    try {
      const res = await fetch(`${BASE}/api/submittals/${submittalId}/acknowledge`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledgmentMessage: ackMsg.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to acknowledge");
      }
      setAckDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["submittal", submittalId] });
      toast.success("Submittal acknowledged");
    } catch (err: any) {
      toast.error(err.message || "Failed to acknowledge");
    } finally {
      setAckLoading(false);
    }
  };

  const handleDownloadOriginal = async () => {
    if (!submittal) return;
    setDownloadingDoc("original");
    try {
      await downloadSubmittalDocument(submittalId, submittal.documentName);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloadingDoc(null);
    }
  };

  const handleDownloadMsgDoc = async (msg: SubmittalMessage) => {
    if (!msg.documentPath || !msg.documentName) return;
    setDownloadingDoc(msg.id);
    try {
      await downloadMessageDocument(msg.documentPath, msg.documentName);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloadingDoc(null);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="h-8 w-48 bg-muted animate-pulse rounded mb-6" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (!submittal) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8 text-center text-muted-foreground">
          Submittal not found.
        </div>
      </Layout>
    );
  }

  const statusConfig = getStatusConfig(submittal.status);

  // creatorRole determines who receives and who acknowledges.
  // GC-created → SUB acknowledges (original behaviour)
  // SUB-created → GC acknowledges
  const creatorRole = submittal.creatorRole ?? "GC"; // default "GC" for existing records
  const canAcknowledge =
    submittal.status !== "ACKNOWLEDGED" &&
    ((creatorRole === "GC" && !isGC) || (creatorRole === "SUB" && isGC));

  // Label for the original document row in the thread
  const originatorLabel = creatorRole === "GC" ? "GC Document" : "SUB Document";
  const originatorCompany = creatorRole === "GC" ? submittal.gcCompanyName : submittal.subCompanyName;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Back navigation */}
        <Link href={`/subcontracts/${submittal.subcontractId}`}>
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors group">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Subcontract
          </button>
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-foreground font-display truncate">{submittal.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">{submittal.projectName} · {isGC ? submittal.subCompanyName : submittal.gcCompanyName}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <Badge variant="outline" className={cn("text-xs font-semibold px-2.5 py-1", statusConfig.className)}>
                {submittal.status === "PENDING_REVIEW" && <Clock className="h-3 w-3 mr-1" />}
                {submittal.status === "IN_DISCUSSION" && <MessageSquare className="h-3 w-3 mr-1" />}
                {submittal.status === "ACKNOWLEDGED" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                {submittal.status === "OVERDUE" && <AlertTriangle className="h-3 w-3 mr-1" />}
                {statusConfig.label}
              </Badge>
              {submittal.requiredResponseDate && submittal.status !== "ACKNOWLEDGED" && (
                <span className={cn(
                  "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border",
                  submittal.status === "OVERDUE"
                    ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400"
                    : "bg-muted border-border text-muted-foreground"
                )}>
                  <CalendarDays className="h-3 w-3" />
                  Response due {submittal.requiredResponseDate}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Acknowledged banner */}
        {submittal.status === "ACKNOWLEDGED" && submittal.acknowledgedAt && (
          <div className="mb-6 flex items-start gap-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                Formally Acknowledged by {submittal.acknowledgedByName}
              </p>
              <p className="text-xs text-green-600/80 dark:text-green-500 mt-0.5">
                {format(new Date(submittal.acknowledgedAt), "MMMM d, yyyy 'at' h:mm a")} — This timestamp is permanent and locked.
              </p>
              {submittal.acknowledgmentMessage && (
                <p className="text-sm text-green-700 dark:text-green-400 mt-2 italic">"{submittal.acknowledgmentMessage}"</p>
              )}
            </div>
          </div>
        )}

        {/* Thread */}
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> Conversation Thread
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Original document — label reflects actual creator */}
            <div className="p-4 border-b bg-primary/5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-primary uppercase tracking-wide">{originatorLabel}</span>
                      <span className="text-xs text-muted-foreground">
                        Submitted by {originatorCompany} · {format(new Date(submittal.createdAt), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate">{submittal.documentName}</p>
                    {submittal.openingMessage && (
                      <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{submittal.openingMessage}</p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 min-h-[36px] gap-1.5"
                  onClick={handleDownloadOriginal}
                  disabled={downloadingDoc === "original"}
                >
                  {downloadingDoc === "original" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Download
                </Button>
              </div>
            </div>

            {/* Messages */}
            {submittal.messages.length > 0 && (
              <div className="divide-y divide-border">
                {submittal.messages.map(msg => {
                  const isFromMe = (isGC && msg.senderRole === "GC") || (!isGC && msg.senderRole === "SUB");
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "p-4",
                        isFromMe ? "bg-primary/5" : "bg-muted/30"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className={cn(
                              "text-xs font-bold uppercase tracking-wide",
                              msg.senderRole === "GC" ? "text-primary" : "text-orange-600 dark:text-orange-400"
                            )}>
                              {msg.senderRole === "GC" ? "GC" : "Sub"}
                            </span>
                            <span className="text-xs font-semibold text-foreground">{msg.senderName}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(msg.createdAt), "MMM d, yyyy h:mm a")}
                            </span>
                          </div>
                          {msg.message && (
                            <p className="text-sm text-foreground whitespace-pre-wrap">{msg.message}</p>
                          )}
                          {msg.documentPath && msg.documentName && (
                            <div className="mt-2 flex items-center gap-2 p-2 bg-card border border-border rounded-lg w-fit max-w-full">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm text-foreground truncate max-w-[200px]">{msg.documentName}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 gap-1 shrink-0"
                                onClick={() => handleDownloadMsgDoc(msg)}
                                disabled={downloadingDoc === msg.id}
                              >
                                {downloadingDoc === msg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                                Download
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {submittal.messages.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No replies yet.
              </div>
            )}

            {/* Reply form */}
            <form onSubmit={handleSendMessage} className="p-4 border-t bg-card">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Add a message or document
              </p>
              <div className="space-y-3">
                <Textarea
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  placeholder="Type your message here..."
                  rows={3}
                  className="resize-none"
                />
                {msgDocName && (
                  <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground flex-1 truncate">{msgDocName}</span>
                    <button type="button" onClick={() => { setMsgDocPath(null); setMsgDocName(null); }} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className={cn(
                    "flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-dashed cursor-pointer transition-colors",
                    msgDocUploading
                      ? "opacity-50 cursor-not-allowed border-border text-muted-foreground"
                      : "border-border text-muted-foreground hover:border-primary/60 hover:text-primary"
                  )}>
                    <Upload className="h-4 w-4" />
                    {msgDocUploading ? "Uploading…" : msgDocName ? "Replace Document" : "Attach Document"}
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx"
                      className="hidden"
                      onChange={handleMsgDocUpload}
                      disabled={msgDocUploading}
                    />
                  </label>
                  <Button
                    type="submit"
                    className="ml-auto gap-1.5"
                    disabled={(!msgText.trim() && !msgDocPath) || sendingMsg || msgDocUploading}
                    isLoading={sendingMsg}
                  >
                    <Send className="h-4 w-4" /> Send
                  </Button>
                </div>
              </div>
            </form>

            {/* Acknowledge Receipt — visible to the party that RECEIVED the submittal */}
            {canAcknowledge && (
              <div className="p-4 border-t bg-muted/30">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Ready to formally acknowledge this submittal?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Acknowledgment is permanent and timestamped. It confirms you have reviewed and received all information.
                    </p>
                  </div>
                  <Button
                    onClick={() => setAckDialogOpen(true)}
                    className="bg-green-500 hover:bg-green-600 text-white gap-1.5 shrink-0 min-h-[44px]"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Acknowledge Receipt
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Acknowledge Dialog */}
      {ackDialogOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setAckDialogOpen(false)}>
          <div className="bg-card rounded-2xl border shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold font-display flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" /> Confirm Acknowledgment
              </h3>
              <button onClick={() => setAckDialogOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAcknowledge} className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                <strong>This action is permanent.</strong> Once acknowledged, the timestamp is locked and cannot be changed or deleted by anyone.
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                  Acknowledgment Message <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                  value={ackMsg}
                  onChange={e => setAckMsg(e.target.value)}
                  placeholder="Add a final note or confirm your understanding (optional)"
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="flex-1 bg-green-500 hover:bg-green-600 text-white gap-1.5" isLoading={ackLoading}>
                  <CheckCircle2 className="h-4 w-4" /> Confirm Acknowledgment
                </Button>
                <Button type="button" variant="outline" onClick={() => setAckDialogOpen(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
