import * as React from "react";
import { useRoute } from "wouter";
import { Layout } from "@/components/layout";
import {
  useGetProject,
  useGetMe,
  useInviteSubcontractor,
  useSubmitBid,
  useAwardBid,
  getGetProjectQueryKey,
  useGetProjectPlanFiles,
  getGetProjectPlanFilesQueryKey,
  useAddPlanFile,
  useDeletePlanFile,
  useUpdateProject,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Mail, DollarSign, Building, Award, Plus, FileSignature, FileText, ExternalLink,
  ChevronRight, Copy, Check, KeyRound, Upload, Trash2, Calendar, AlertTriangle,
  Pencil, MapPin, CalendarDays, StickyNote, Save,
} from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "wouter";
import { format } from "date-fns";
import { useUpload } from "@workspace/object-storage-web";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/octet-stream",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];
const ALLOWED_EXTENSIONS = /\.(pdf|png|jpg|jpeg|dwg|docx|doc)$/i;
const MAX_SIZE_BYTES = 50 * 1024 * 1024;

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
  const deletePlanFileMutation = useDeletePlanFile();
  const updateProject = useUpdateProject();
  const { data: planFiles = [], refetch: refetchPlans } = useGetProjectPlanFiles(projectId);

  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editAddress, setEditAddress] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editStartDate, setEditStartDate] = React.useState("");

  const [notes, setNotes] = React.useState("");
  const [notesSaved, setNotesSaved] = React.useState(false);
  const [notesDirty, setNotesDirty] = React.useState(false);

  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteCompanyName, setInviteCompanyName] = React.useState("");
  const [inviteResult, setInviteResult] = React.useState<{ temporaryPassword: string; email: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  const [isBidOpen, setIsBidOpen] = React.useState(false);
  const [bidAmount, setBidAmount] = React.useState("");

  const [isPlanOpen, setIsPlanOpen] = React.useState(false);
  const [planDescription, setPlanDescription] = React.useState("");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState("");
  const [uploadStep, setUploadStep] = React.useState<"idle" | "uploading" | "saving">("idle");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { uploadFile, progress, isUploading } = useUpload({
    onError: (err) => {
      toast.error(err.message || "Upload failed");
      setUploadStep("idle");
    },
  });

  // Initialize notes from project data
  React.useEffect(() => {
    if (project) {
      setNotes((project as any).notes ?? "");
    }
  }, [project?.id]);

  const handleOpenEdit = () => {
    setEditName(project?.name ?? "");
    setEditAddress((project as any)?.address ?? "");
    setEditDescription((project as any)?.description ?? "");
    setEditStartDate((project as any)?.estimatedStartDate ?? "");
    setIsEditOpen(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return toast.error("Project name is required");
    try {
      await updateProject.mutateAsync({
        projectId,
        data: {
          name: editName.trim(),
          address: editAddress.trim() || undefined,
          description: editDescription.trim() || undefined,
          estimatedStartDate: editStartDate || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      toast.success("Project updated!");
      setIsEditOpen(false);
    } catch (err: any) {
      toast.error(err?.data?.error || "Failed to update project");
    }
  };

  const handleSaveNotes = async () => {
    try {
      await updateProject.mutateAsync({ projectId, data: { notes: notes || undefined } });
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      setNotesSaved(true);
      setNotesDirty(false);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch (err: any) {
      toast.error(err?.data?.error || "Failed to save notes");
    }
  };

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
      toast.error(err?.data?.error || err?.message || "Failed to send invite");
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_EXTENSIONS.test(file.name)) {
      setFileError("Unsupported file type. Please upload PDF, PNG, JPG, DWG, or DOCX.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setFileError("File is too large. Maximum size is 50 MB.");
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
  };

  const handleUploadPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return toast.error("Please select a file");
    if (!planDescription.trim()) return toast.error("Please add a description");

    setUploadStep("uploading");
    const result = await uploadFile(selectedFile);
    if (!result) {
      setUploadStep("idle");
      return;
    }

    setUploadStep("saving");
    try {
      await addPlanFile.mutateAsync({
        projectId,
        data: {
          objectPath: result.objectPath,
          fileName: selectedFile.name,
          description: planDescription.trim(),
        },
      });
      toast.success("Plan file uploaded!");
      queryClient.invalidateQueries({ queryKey: getGetProjectPlanFilesQueryKey(projectId) });
      handleClosePlanDialog();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Failed to save plan file");
      setUploadStep("idle");
    }
  };

  const handleClosePlanDialog = () => {
    setIsPlanOpen(false);
    setPlanDescription("");
    setSelectedFile(null);
    setFileError("");
    setUploadStep("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeletePlan = async (planFileId: string) => {
    if (!confirm("Delete this plan file?")) return;
    try {
      await deletePlanFileMutation.mutateAsync({ projectId, planFileId });
      toast.success("Plan file deleted");
      queryClient.invalidateQueries({ queryKey: getGetProjectPlanFilesQueryKey(projectId) });
    } catch {
      toast.error("Failed to delete plan file");
    }
  };

  const getFileUrl = (plan: { objectPath?: string | null; fileUrl?: string | null }) => {
    if (plan.objectPath) return `/api/storage${plan.objectPath}`;
    return plan.fileUrl ?? "#";
  };

  const uploadProgressDisplay = uploadStep === "uploading" ? progress : uploadStep === "saving" ? 100 : 0;
  const uploadStatusText = uploadStep === "uploading" ? `Uploading… ${progress}%` : uploadStep === "saving" ? "Saving…" : "";
  const isSubmitting = uploadStep !== "idle";

  return (
    <Layout>
      <div className="mb-8 bg-card p-6 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold font-display leading-tight">{project.name}</h1>
              <Badge variant={project.status === "ACTIVE" ? "success" : project.status === "BIDDING" ? "default" : "secondary"}>
                {project.status}
              </Badge>
            </div>

            <div className="space-y-1.5">
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Building className="h-4 w-4 shrink-0" /> {project.gc?.companyName}
              </p>
              {(project as any).address && (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 shrink-0" /> {(project as any).address}
                </p>
              )}
              {(project as any).estimatedStartDate && (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  Est. Start: {format(new Date((project as any).estimatedStartDate), "MMMM d, yyyy")}
                </p>
              )}
              {(project as any).description && (
                <p className="text-muted-foreground text-sm mt-3 max-w-2xl leading-relaxed border-t border-border/50 pt-3">
                  {(project as any).description}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isGC && (
              <Button variant="outline" onClick={handleOpenEdit} className="gap-2 min-h-[44px]">
                <Pencil className="h-4 w-4" /> Edit Project
              </Button>
            )}
            {isGC && project.status === "BIDDING" && (
              <Button onClick={() => setIsInviteOpen(true)} className="gap-2 min-h-[44px]">
                <Mail className="h-5 w-5" />
                Invite Subcontractor
              </Button>
            )}
            {!isGC && project.status === "BIDDING" && !myBid && (
              <Button onClick={() => setIsBidOpen(true)} className="gap-2 bg-green-600 hover:bg-green-700 text-white shadow-green-600/30 min-h-[44px]">
                <DollarSign className="h-5 w-5" />
                Submit Bid
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* GC FINANCIAL OVERVIEW */}
      {isGC && project.subcontracts && project.subcontracts.length > 0 && (() => {
        const subs = project.subcontracts!;
        const totalBase = subs.reduce((s, c) => s + c.baseContractAmount, 0);
        const totalApproved = subs.reduce((s, c) => s + (c.scoreboard?.currentApprovedTotal ?? c.baseContractAmount), 0);
        const totalCO = subs.reduce((s, c) => s + (c.scoreboard?.coTotal ?? 0), 0);
        const totalInvoiced = subs.reduce((s, c) => s + (c.scoreboard?.invoicedTotal ?? 0), 0);
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Base Contracts", value: totalBase, icon: "📋" },
              { label: "Approved CO Exposure", value: totalCO, icon: "🔄", highlight: totalCO > 0 },
              { label: "Total Approved", value: totalApproved, icon: "✅" },
              { label: "Total Invoiced", value: totalInvoiced, icon: "🧾" },
            ].map(stat => (
              <div key={stat.label} className={cn(
                "bg-card rounded-2xl border p-4 shadow-sm",
                stat.highlight ? "border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20" : "border-border/50"
              )}>
                <p className={cn(
                  "text-xs font-semibold uppercase tracking-wider mb-2",
                  stat.highlight ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
                )}>{stat.label}</p>
                <p className={cn(
                  "text-xl font-bold font-mono",
                  stat.highlight ? "text-amber-700 dark:text-amber-400" : "text-foreground"
                )}>{formatCurrency(stat.value)}</p>
              </div>
            ))}
          </div>
        );
      })()}

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
                    <Upload className="h-4 w-4" /> Upload Plan
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
                    <li key={plan.id} className="flex items-start justify-between py-4 gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{plan.fileName ?? "Unnamed file"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(plan.createdAt), "MMM d, yyyy")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={getFileUrl(plan)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-border bg-background hover:bg-secondary transition-colors"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                        {isGC && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeletePlan(plan.id)}
                            disabled={deletePlanFileMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
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
              <CardContent className="p-0">
                {(project.subcontracts?.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground py-6 px-6">No subcontracts awarded yet.</p>
                ) : (() => {
                  const visible = project.subcontracts?.filter(s => isGC || s.subId === user.id) ?? [];
                  const totals = visible.reduce(
                    (acc, s) => {
                      const sb = s.scoreboard;
                      return {
                        base: acc.base + (sb?.base ?? s.baseContractAmount),
                        coTotal: acc.coTotal + (sb?.coTotal ?? 0),
                        approved: acc.approved + (sb?.currentApprovedTotal ?? s.baseContractAmount),
                        invoiced: acc.invoiced + (sb?.invoicedTotal ?? 0),
                        remaining: acc.remaining + (sb?.remaining ?? s.baseContractAmount),
                      };
                    },
                    { base: 0, coTotal: 0, approved: 0, invoiced: 0, remaining: 0 }
                  );
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[580px]">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Subcontractor</th>
                            <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Base</th>
                            <th className="text-right px-4 py-3 font-semibold text-muted-foreground">COs</th>
                            <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Approved Total</th>
                            <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Invoiced</th>
                            <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Remaining</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {visible.map(sub => {
                            const sb = sub.scoreboard;
                            const remaining = sb?.remaining ?? sub.baseContractAmount;
                            const hasFlagged = (sb as any)?.hasFlaggedInvoices as boolean | undefined;
                            const isNeg = remaining < 0 || hasFlagged;
                            return (
                              <tr key={sub.id} className="hover:bg-muted/30 transition-colors group">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold group-hover:text-primary transition-colors">{sub.sub?.companyName}</span>
                                    {hasFlagged && (
                                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-1.5 py-0.5 rounded-full">
                                        <AlertTriangle className="h-2.5 w-2.5" /> Flagged
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-mono">{formatCurrency(sb?.base ?? sub.baseContractAmount)}</td>
                                <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatCurrency(sb?.coTotal ?? 0)}</td>
                                <td className="px-4 py-3 text-right font-mono font-semibold">{formatCurrency(sb?.currentApprovedTotal ?? sub.baseContractAmount)}</td>
                                <td className="px-4 py-3 text-right font-mono">{formatCurrency(sb?.invoicedTotal ?? 0)}</td>
                                <td className={cn("px-4 py-3 text-right font-mono font-semibold", isNeg ? "text-red-600" : "text-green-600")}>
                                  {formatCurrency(remaining)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Link href={`/subcontracts/${sub.id}`}>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 group-hover:bg-primary/10">
                                      <ChevronRight className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {visible.length > 1 && (
                          <tfoot>
                            <tr className="border-t-2 border-border bg-muted/50 font-bold">
                              <td className="px-4 py-3 text-sm uppercase tracking-wider text-muted-foreground">Totals</td>
                              <td className="px-4 py-3 text-right font-mono">{formatCurrency(totals.base)}</td>
                              <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatCurrency(totals.coTotal)}</td>
                              <td className="px-4 py-3 text-right font-mono">{formatCurrency(totals.approved)}</td>
                              <td className="px-4 py-3 text-right font-mono">{formatCurrency(totals.invoiced)}</td>
                              <td className={cn("px-4 py-3 text-right font-mono", totals.remaining < 0 ? "text-red-600" : "text-green-600")}>
                                {formatCurrency(totals.remaining)}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  );
                })()}
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

      {/* GC Private Notes */}
      {isGC && (
        <Card className="mt-8 border-amber-200/60 dark:border-amber-800/40">
          <CardHeader className="border-b border-amber-200/60 dark:border-amber-800/40 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <StickyNote className="h-5 w-5" /> Private Notes
                <span className="text-xs font-normal text-muted-foreground ml-1">(Only visible to you)</span>
              </CardTitle>
              <Button
                size="sm"
                variant={notesSaved ? "default" : notesDirty ? "default" : "ghost"}
                onClick={handleSaveNotes}
                isLoading={updateProject.isPending}
                disabled={!notesDirty}
                className={cn("gap-2 transition-all", notesSaved && "bg-green-600 hover:bg-green-700 text-white")}
              >
                <Save className="h-4 w-4" />
                {notesSaved ? "Saved!" : "Save Notes"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <textarea
              className="w-full min-h-[140px] bg-amber-50/50 dark:bg-amber-950/10 rounded-xl border border-amber-200/60 dark:border-amber-800/40 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-y placeholder:text-muted-foreground/60"
              placeholder="Add internal notes for this project — observations, reminders, vendor contacts, or anything the team shouldn't see…"
              value={notes}
              onChange={e => { setNotes(e.target.value); setNotesDirty(true); setNotesSaved(false); }}
            />
          </CardContent>
        </Card>
      )}

      {/* Edit Project Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen} title="Edit Project" description="Update the project details. Changes are visible to all members.">
        <form onSubmit={handleEditSave} className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-semibold mb-1 block">Project Name *</label>
            <Input required value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. Downtown Office Renovation" />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Full Address</label>
            <Input value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="e.g. 123 Main St, Chicago, IL 60601" />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Project Description</label>
            <textarea
              className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              rows={3}
              placeholder="Brief overview of the project scope and objectives..."
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Estimated Start Date</label>
            <Input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)} className="min-h-[44px]">Cancel</Button>
            <Button type="submit" isLoading={updateProject.isPending} className="min-h-[44px]">Save Changes</Button>
          </div>
        </form>
      </Dialog>

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
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={handleCopyPassword}>
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
              <Button onClick={handleInviteClose} className="min-h-[44px] w-full sm:w-auto">Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-semibold mb-1 block">Email Address</label>
              <Input type="email" required placeholder="sub@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">Company Name</label>
              <Input type="text" required placeholder="ABC Electric LLC" value={inviteCompanyName} onChange={e => setInviteCompanyName(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              If this subcontractor isn't in the system yet, an account will be created with a secure temporary password that you'll be able to share with them.
            </p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={handleInviteClose} className="min-h-[44px]">Cancel</Button>
              <Button type="submit" isLoading={inviteSub.isPending} className="min-h-[44px]">Add Subcontractor</Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Upload Plan File Dialog */}
      <Dialog
        open={isPlanOpen}
        onOpenChange={(open) => { if (!open && !isSubmitting) handleClosePlanDialog(); }}
        title="Upload Site Plan"
        description="Select a file from your device and add a brief description. PDF, PNG, JPG, DWG, and DOCX files up to 50 MB are supported."
      >
        <form onSubmit={handleUploadPlan} className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">Description</label>
            <Input
              type="text"
              required
              placeholder="e.g. Architectural Floor Plan – Level 1"
              value={planDescription}
              onChange={e => setPlanDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="text-sm font-semibold mb-1 block">File</label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.dwg,.docx,.doc"
              onChange={handleFileSelect}
              disabled={isSubmitting}
            />
            {selectedFile ? (
              <div className="border-2 border-primary/40 bg-primary/5 rounded-xl p-4 flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  disabled={isSubmitting}
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => !isSubmitting && fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="w-full border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 active:bg-muted/40 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <Upload className="h-8 w-8 mx-auto mb-2 opacity-50 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Tap to browse files</p>
                <p className="text-xs mt-1 text-muted-foreground">PDF, PNG, JPG, DWG, DOCX · max 50 MB</p>
              </button>
            )}
            {fileError && <p className="text-xs text-destructive mt-1">{fileError}</p>}
          </div>

          {isSubmitting && (
            <div className="space-y-1.5">
              <Progress value={uploadProgressDisplay} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{uploadStatusText}</p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={handleClosePlanDialog} disabled={isSubmitting} className="min-h-[44px]">Cancel</Button>
            <Button type="submit" isLoading={isSubmitting} disabled={!selectedFile || isSubmitting} className="gap-2 min-h-[44px]">
              <Upload className="h-4 w-4" /> Upload
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Sub Submit Bid Dialog */}
      <Dialog open={isBidOpen} onOpenChange={setIsBidOpen} title="Submit Bid" description="Enter your proposed amount for this project.">
        <form onSubmit={handleBidSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">Bid Amount ($)</label>
            <Input type="number" step="0.01" required placeholder="50000.00" value={bidAmount} onChange={e => setBidAmount(e.target.value)} />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsBidOpen(false)} className="min-h-[44px]">Cancel</Button>
            <Button type="submit" isLoading={submitBid.isPending} className="min-h-[44px]">Submit Bid</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
