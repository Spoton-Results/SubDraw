import * as React from "react";
import { useRoute } from "wouter";
import { Layout } from "@/components/layout";
import { usePageTitle } from "@/hooks/usePageTitle";
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
  useRemoveProjectMember,
  useGetContacts,
  useInviteContactToProject,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, cn } from "@/lib/utils";
import {
  Mail, DollarSign, Building, Award, FileSignature, FileText,
  ChevronRight, Copy, Check, KeyRound, Upload, Trash2, Calendar, AlertTriangle,
  Pencil, MapPin, CalendarDays, StickyNote, Save, Download, PartyPopper, XCircle,
  Archive, ArchiveRestore, Lock, ClipboardList, TrendingUp, TrendingDown, Plus, Clock, Stamp, FileDown, Loader2, CheckCircle2,
  Shield, ShieldCheck, ShieldX, TableProperties, Link2, Link2Off, Clipboard, LayoutGrid,
  Eye, BadgeCheck, ChevronDown, ChevronUp, Users, MessageSquare, ListChecks, SquareCheck,
  UserCog, Bell, BellRing, ThumbsUp, ThumbsDown, BellOff, Scale, BrainCircuit, RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "wouter";
import { format } from "date-fns";
import { useUpload } from "@workspace/object-storage-web";
import { usePermissions } from "@/hooks/usePermissions";

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

const TRADE_CATEGORIES = [
  "General",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Framing",
  "Drywall",
  "Roofing",
  "Flooring",
  "Painting",
  "Concrete",
  "Masonry",
  "Insulation",
  "Windows and Doors",
  "Landscaping",
  "Other",
] as const;

const DEFAULT_SCOPE_TEMPLATES: Partial<Record<string, string>> = {
  Electrical: `All rough-in wiring per approved plans and specifications.\nElectrical panel installation and labeling.\nAll outlets, switches, and devices per plans.\nLight fixture installation — fixtures by owner unless noted.\nExterior lighting and smoke/carbon monoxide detector installation.\nFinal connections to all appliances and equipment shown on plans.`,
  Plumbing: `All rough-in plumbing per approved plans and specifications.\nWater supply lines to all fixtures.\nDrain, waste, and vent (DWV) system installation.\nWater heater installation and connections.\nAll fixtures and trim — supply by owner unless noted.\nExterior hose bibs and final appliance connections.\nAll work to meet local plumbing code.`,
  HVAC: `Complete HVAC system installation per approved mechanical plans.\nEquipment selection and sizing per engineering specifications.\nDuctwork fabrication and installation.\nRefrigerant piping and connections.\nThermostats and controls installation and programming.\nStart-up, commissioning, and testing.\nAll work to meet local mechanical and energy codes.`,
  Framing: `Complete structural and rough framing per approved architectural plans.\nAll exterior and interior wall framing.\nFloor and roof framing per structural drawings.\nStair framing and header/beam/post installation.\nShear panel installation per structural engineer's plans.\nAll hardware and connections per specifications.`,
  Drywall: `All drywall installation, taping, and finishing per plans.\nLevel 4 finish throughout unless otherwise noted.\nMoisture-resistant board in wet areas.\nFire-rated assemblies where required per code.\nPatching of all penetrations and blocking for fixtures as needed.`,
  Roofing: `Complete roofing system installation per plans and specifications.\nTear-off of existing roofing as required.\nUnderlayment and moisture barrier installation.\nRoofing material installation per manufacturer specifications.\nFlashing at all roof penetrations, walls, and transitions.\nGutters and downspouts as specified.\n5-year workmanship warranty included.`,
  Flooring: `All flooring installation per plans and specifications.\nSubfloor preparation and leveling.\nFlooring material installation — materials by owner unless noted.\nTransitions and trim installation.\nProtection of completed work during construction.\nFinal cleaning and inspection.`,
  Painting: `All interior and exterior painting per specifications.\nSurface preparation including patching, sanding, and priming.\nTwo coats finish paint on all walls and ceilings.\nSemi-gloss on all doors, trim, and millwork.\nProtection of adjacent surfaces and flooring throughout.\nFinal cleanup and touch-up walk-through.`,
  Concrete: `All concrete work per approved plans and structural drawings.\nFormwork, reinforcing steel, and pour.\nFlatwork including slabs, walks, and drives as shown on plans.\nFinishing and curing per specifications.\nSaw cutting and joint installation as required.\nAll concrete to achieve specified compressive strength.\n1-year warranty on all concrete work.`,
  Masonry: `All masonry construction per approved plans and specifications.\nBlock or brick installation with mortar joints per architect's detail.\nLintels and reinforcing as specified by structural engineer.\nWaterproofing and flashing at all masonry-wood interfaces.\nCleaning of all masonry upon completion.`,
  Insulation: `All insulation installation per energy compliance documentation.\nBatt insulation in all exterior walls, floors, and ceilings as specified.\nBlown insulation in attic areas to required R-value.\nAir sealing at all penetrations and transitions.\nFinal blower door test coordination if required.`,
  Landscaping: `Complete landscaping per approved landscape plans.\nSite grading and drainage as shown.\nIrrigation system installation and programming.\nAll plantings per plant schedule and landscape architect's plans.\nSoil amendments and mulch per specifications.\nHardscape installation including walks, patios, and walls as shown.\n90-day plant establishment warranty.`,
  Other: `Provide all labor, materials, equipment, and supervision necessary to complete the work as shown on the plans and specifications. Work to be performed in a professional manner in accordance with all applicable codes and regulations. Scope includes all items necessary for a complete and working installation.`,
};

const TRADE_COLORS: Record<string, string> = {
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
  Masonry: "bg-brown-100 text-brown-700 border-brown-200 dark:bg-stone-800 dark:text-stone-300",
  Insulation: "bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-950/30 dark:text-lime-400",
  "Windows and Doors": "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400",
  Landscaping: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400",
  Other: "bg-muted text-muted-foreground border-border",
};

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const projectId = params?.id || "";

  const { data: user } = useGetMe();
  const perms = usePermissions();
  const { data: project, isLoading } = useGetProject(projectId);
  usePageTitle(project?.name ?? "Project");
  const queryClient = useQueryClient();

  const inviteSub = useInviteSubcontractor();
  const inviteContactToProject = useInviteContactToProject();
  const submitBid = useSubmitBid();
  const awardBid = useAwardBid();
  const addPlanFile = useAddPlanFile();
  const deletePlanFileMutation = useDeletePlanFile();
  const updateProject = useUpdateProject();
  const removeMember = useRemoveProjectMember();
  const { data: planFiles = [], refetch: refetchPlans } = useGetProjectPlanFiles(projectId);
  const { data: contacts = [] } = useGetContacts({ query: { enabled: user?.role === "GC" } });

  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editAddress, setEditAddress] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editStartDate, setEditStartDate] = React.useState("");

  const [notes, setNotes] = React.useState("");
  const [notesSaved, setNotesSaved] = React.useState(false);
  const [notesDirty, setNotesDirty] = React.useState(false);

  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [inviteTab, setInviteTab] = React.useState<"contact" | "new">("contact");
  const [inviteStep, setInviteStep] = React.useState<"select" | "contract">("select");
  const [inviteSelectedSub, setInviteSelectedSub] = React.useState<{ subId?: string; email?: string; companyName: string } | null>(null);
  const [contactSearch, setContactSearch] = React.useState("");
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteCompanyName, setInviteCompanyName] = React.useState("");
  const [inviteResult, setInviteResult] = React.useState<{ temporaryPassword: string; email: string } | null>(null);
  const [biddingInviteSuccess, setBiddingInviteSuccess] = React.useState<{ companyName: string; email: string } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [directAmount, setDirectAmount] = React.useState("");
  const [directTrade, setDirectTrade] = React.useState("");
  const [directRetention, setDirectRetention] = React.useState("10");
  const [directLoading, setDirectLoading] = React.useState(false);
  const [directSuccess, setDirectSuccess] = React.useState<{ companyName: string } | null>(null);

  const [bidAmount, setBidAmount] = React.useState("");
  const [bidNotes, setBidNotes] = React.useState("");
  const [bidScopeFile, setBidScopeFile] = React.useState<File | null>(null);
  const [bidScopeUploading, setBidScopeUploading] = React.useState(false);
  const [bidScopeAcknowledged, setBidScopeAcknowledged] = React.useState(false);

  // Trade scope editing (GC)
  const [scopeEditTrade, setScopeEditTrade] = React.useState<string>("");
  const [scopeEditText, setScopeEditText] = React.useState("");
  const [scopeSaving, setScopeSaving] = React.useState(false);
  const [scopeDeleteConfirm, setScopeDeleteConfirm] = React.useState<string | null>(null);
  const [scopeSaveTemplateOpen, setScopeSaveTemplateOpen] = React.useState(false);
  const [scopeTemplateName, setScopeTemplateName] = React.useState("");
  const [scopeTemplateSaving, setScopeTemplateSaving] = React.useState(false);

  // Invite trade category
  const [inviteTrade, setInviteTrade] = React.useState("");

  const [isPlanOpen, setIsPlanOpen] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [fileError, setFileError] = React.useState("");
  const [uploadStep, setUploadStep] = React.useState<"idle" | "uploading" | "saving">("idle");
  const [uploadFileIndex, setUploadFileIndex] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [deletePlanConfirm, setDeletePlanConfirm] = React.useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" });

  const [expandedPlanViews, setExpandedPlanViews] = React.useState<Set<string>>(new Set());
  const [showNoPlanWarning, setShowNoPlanWarning] = React.useState(false);

  const [isScopeOpen, setIsScopeOpen] = React.useState(false);
  const [selectedScopeFiles, setSelectedScopeFiles] = React.useState<File[]>([]);
  const [scopeFileError, setScopeFileError] = React.useState("");
  const [scopeUploadStep, setScopeUploadStep] = React.useState<"idle" | "uploading" | "saving">("idle");
  const [scopeUploadFileIndex, setScopeUploadFileIndex] = React.useState(0);
  const scopeFileInputRef = React.useRef<HTMLInputElement>(null);
  const [deleteScopeConfirm, setDeleteScopeConfirm] = React.useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" });

  // GC Credentials state
  const [gcCredSaving, setGcCredSaving] = React.useState(false);
  const [gcCredInsCompany, setGcCredInsCompany] = React.useState("");
  const [gcCredInsPolicyNumber, setGcCredInsPolicyNumber] = React.useState("");
  const [gcCredInsGLCoverage, setGcCredInsGLCoverage] = React.useState("");
  const [gcCredInsWCCoverage, setGcCredInsWCCoverage] = React.useState("");
  const [gcCredInsExpDate, setGcCredInsExpDate] = React.useState("");
  const [gcCredInsCertPath, setGcCredInsCertPath] = React.useState<string | null>(null);
  const [gcCredInsCertFileName, setGcCredInsCertFileName] = React.useState<string | null>(null);
  const [gcCredLicNumber, setGcCredLicNumber] = React.useState("");
  const [gcCredLicType, setGcCredLicType] = React.useState("");
  const [gcCredLicState, setGcCredLicState] = React.useState("");
  const [gcCredLicExpDate, setGcCredLicExpDate] = React.useState("");
  const [gcCredLicDocPath, setGcCredLicDocPath] = React.useState<string | null>(null);
  const [gcCredLicDocFileName, setGcCredLicDocFileName] = React.useState<string | null>(null);
  const [gcCredInsSection, setGcCredInsSection] = React.useState(true);
  const [gcCredLicSection, setGcCredLicSection] = React.useState(true);
  const [gcCredSaveSuccess, setGcCredSaveSuccess] = React.useState(false);

  // Compliance checklist state
  const [newComplianceTitle, setNewComplianceTitle] = React.useState("");
  const [newComplianceRequired, setNewComplianceRequired] = React.useState(true);
  const [newComplianceDocAllowed, setNewComplianceDocAllowed] = React.useState(false);
  const [newComplianceSaving, setNewComplianceSaving] = React.useState(false);
  const [complianceEditId, setComplianceEditId] = React.useState<string | null>(null);
  const [complianceEditTitle, setComplianceEditTitle] = React.useState("");
  const [complianceEditRequired, setComplianceEditRequired] = React.useState(true);
  const [complianceEditDocAllowed, setComplianceEditDocAllowed] = React.useState(false);
  const [complianceEditSaving, setComplianceEditSaving] = React.useState(false);
  const [complianceDeleteConfirm, setComplianceDeleteConfirm] = React.useState<string | null>(null);

  // Project Owner state
  const [ownerEditing, setOwnerEditing] = React.useState(false);
  const [ownerName, setOwnerName] = React.useState("");
  const [ownerEmail, setOwnerEmail] = React.useState("");
  const [ownerCoThreshold, setOwnerCoThreshold] = React.useState("");
  const [ownerSaving, setOwnerSaving] = React.useState(false);

  // AI Bid Analysis state
  const [aiAnalyzing, setAiAnalyzing] = React.useState(false);
  const [aiArchiveExpanded, setAiArchiveExpanded] = React.useState(false);
  const [aiExpandedTrades, setAiExpandedTrades] = React.useState<Set<string>>(new Set());
  const [aiFeedbackDropdown, setAiFeedbackDropdown] = React.useState<Record<string, boolean>>({});
  const [aiFeedbackSaving, setAiFeedbackSaving] = React.useState<Record<string, boolean>>({});
  const toggleAiTrade = (trade: string) => setAiExpandedTrades(prev => {
    const next = new Set(prev);
    next.has(trade) ? next.delete(trade) : next.add(trade);
    return next;
  });

  const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const isGC_for_views = user?.role === "GC";

  const { data: myPlanViews = [] } = useQuery<{ planFileId: string }[]>({
    queryKey: ["plan-file-my-views", projectId],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/plan-files/my-views`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId && !isGC_for_views,
    staleTime: 0,
  });

  const { data: allPlanViews = [] } = useQuery<{ id: string; planFileId: string; subId: string; subName: string; companyName: string; viewedAt: string }[]>({
    queryKey: ["plan-file-all-views", projectId],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/plan-files/all-views`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId && isGC_for_views,
    staleTime: 30000,
  });

  const viewedPlanFileIds = React.useMemo(() => new Set(myPlanViews.map(v => v.planFileId)), [myPlanViews]);

  const { data: scopeDocs = [], refetch: refetchScopeDocs } = useQuery<{ id: string; projectId: string; fileName: string; objectPath: string | null; fileSize: number | null; description: string | null; createdAt: string }[]>({
    queryKey: ["scope-documents", projectId],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/scope-documents`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  type TradeScope = { id: string; tradeCategory: string; description: string; isLocked: boolean; updatedAt: string };
  const { data: tradeScopes = [], refetch: refetchTradeScopes } = useQuery<TradeScope[]>({
    queryKey: ["trade-scopes", projectId],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/trade-scopes`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId && !!project,
    staleTime: 0,
  });

  type ScopeTemplate = { id: string; tradeCategory: string; name: string; description: string; createdAt: string };
  const { data: scopeTemplates = [], refetch: refetchScopeTemplates } = useQuery<ScopeTemplate[]>({
    queryKey: ["scope-templates"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/scope-templates`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: user?.role === "GC",
    staleTime: 0,
  });

  // Sub's own trade scope (if assigned a trade)
  const myMember = !isGC_for_views ? project?.members?.find((m: any) => m.id === user?.id) : null;
  const myTradeCategory = (myMember as any)?.tradeCategory ?? null;
  const myTradeScope = tradeScopes.find(s => s.tradeCategory === myTradeCategory) ?? null;

  type ComplianceItem = { id: string; projectId: string; title: string; description: string | null; required: boolean; allowDocumentUpload: boolean; sortOrder: number; createdAt: string };
  type ComplianceSummaryRow = { subcontractId: string; subId: string; subCompanyName: string; totalRequired: number; completedRequired: number; status: "FULLY_COMPLIANT" | "INCOMPLETE" | "BLOCKED" };

  const { data: complianceItems = [], refetch: refetchComplianceItems } = useQuery<ComplianceItem[]>({
    queryKey: ["compliance-items", projectId],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/compliance-items`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId && user?.role === "GC",
    staleTime: 0,
  });

  const { data: complianceSummary = [], refetch: refetchComplianceSummary } = useQuery<ComplianceSummaryRow[]>({
    queryKey: ["compliance-summary", projectId],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/compliance-items/summary`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId && user?.role === "GC",
    staleTime: 0,
  });

  type GcCredentials = {
    id: string; projectId: string;
    insCompany: string | null; insPolicyNumber: string | null; insGLCoverage: string | null; insWCCoverage: string | null; insExpDate: string | null; insCertPath: string | null;
    licNumber: string | null; licType: string | null; licState: string | null; licExpDate: string | null; licDocPath: string | null;
    credentialsComplete: boolean;
    gcCompanyName?: string | null;
  } | null;

  const { data: gcCredentials, refetch: refetchGcCredentials } = useQuery<GcCredentials>({
    queryKey: ["gc-credentials", projectId],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/gc-credentials`, { credentials: "include" });
      if (res.status === 404 || res.status === 403) return null;
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!projectId && user?.role === "GC",
    staleTime: 0,
    refetchOnMount: "always",
  });

  React.useEffect(() => {
    if (!gcCredentials) return;
    setGcCredInsCompany(gcCredentials.insCompany ?? "");
    setGcCredInsPolicyNumber(gcCredentials.insPolicyNumber ?? "");
    setGcCredInsGLCoverage(gcCredentials.insGLCoverage ?? "");
    setGcCredInsWCCoverage(gcCredentials.insWCCoverage ?? "");
    setGcCredInsExpDate(gcCredentials.insExpDate ?? "");
    setGcCredInsCertPath(gcCredentials.insCertPath ?? null);
    setGcCredLicNumber(gcCredentials.licNumber ?? "");
    setGcCredLicType(gcCredentials.licType ?? "");
    setGcCredLicState(gcCredentials.licState ?? "");
    setGcCredLicExpDate(gcCredentials.licExpDate ?? "");
    setGcCredLicDocPath(gcCredentials.licDocPath ?? null);
  }, [gcCredentials]);

  const { uploadFile: uploadGcInsCert, isUploading: gcInsCertUploading } = useUpload({
    onError: (err) => toast.error(err.message || "Certificate upload failed"),
  });
  const { uploadFile: uploadGcLicDoc, isUploading: gcLicDocUploading } = useUpload({
    onError: (err) => toast.error(err.message || "License document upload failed"),
  });

  function gcCredDaysUntilExpiry(dateStr: string | null | undefined): number | null {
    if (!dateStr) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const exp = new Date(dateStr); exp.setHours(0, 0, 0, 0);
    return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  function gcCredBadge(dateStr: string | null | undefined) {
    if (!dateStr) return null;
    const days = gcCredDaysUntilExpiry(dateStr);
    if (days === null) return null;
    if (days < 0) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-600 px-2 py-0.5 rounded-full"><ShieldX className="h-3 w-3" /> Expired</span>;
    if (days <= 30) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-800 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 px-2 py-0.5 rounded-full"><Shield className="h-3 w-3" /> Expiring in {days}d</span>;
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-2 py-0.5 rounded-full"><ShieldCheck className="h-3 w-3" /> Valid</span>;
  }

  async function handleSaveGcCredentials() {
    setGcCredSaving(true);
    setGcCredSaveSuccess(false);
    try {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/gc-credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          insCompany: gcCredInsCompany.trim() || null,
          insPolicyNumber: gcCredInsPolicyNumber.trim() || null,
          insGLCoverage: gcCredInsGLCoverage.trim() || null,
          insWCCoverage: gcCredInsWCCoverage.trim() || null,
          insExpDate: gcCredInsExpDate || null,
          insCertPath: gcCredInsCertPath || null,
          licNumber: gcCredLicNumber.trim() || null,
          licType: gcCredLicType.trim() || null,
          licState: gcCredLicState.trim() || null,
          licExpDate: gcCredLicExpDate || null,
          licDocPath: gcCredLicDocPath || null,
        }),
      });
      if (!res.ok) { toast.error("Failed to save credentials"); return; }
      await refetchGcCredentials();
      setGcCredSaveSuccess(true);
      setTimeout(() => setGcCredSaveSuccess(false), 5000);
    } finally { setGcCredSaving(false); }
  }

  async function handleRunAiAnalysis() {
    if (!projectId) return;
    setAiAnalyzing(true);
    try {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/ai-analysis`, {
        method: "POST",
        credentials: "include",
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("Unexpected server response. Please try again.");
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "AI analysis failed");
      toast.success("AI bid analysis complete!");
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
    } catch (err: any) {
      toast.error(err.message || "AI analysis failed");
    } finally {
      setAiAnalyzing(false);
    }
  }

  async function handleAiFeedback(trade: string, helpful: boolean, reason?: string) {
    if (!projectId) return;
    setAiFeedbackSaving(prev => ({ ...prev, [trade]: true }));
    try {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/ai-analysis/feedback`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade, helpful, reason }),
      });
      if (!res.ok) throw new Error("Failed to save feedback");
      toast.success("Feedback saved");
      setAiFeedbackDropdown(prev => ({ ...prev, [trade]: false }));
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
    } catch (err: any) {
      toast.error(err.message || "Failed to save feedback");
    } finally {
      setAiFeedbackSaving(prev => ({ ...prev, [trade]: false }));
    }
  }

  async function saveGcCredsToDB(overrides: Partial<{
    insCertPath: string | null; licDocPath: string | null;
  }> = {}) {
    const res = await fetch(`${BASE_URL}/api/projects/${projectId}/gc-credentials`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        insCompany: gcCredInsCompany || null,
        insPolicyNumber: gcCredInsPolicyNumber || null,
        insGLCoverage: gcCredInsGLCoverage || null,
        insWCCoverage: gcCredInsWCCoverage || null,
        insExpDate: gcCredInsExpDate || null,
        insCertPath: "insCertPath" in overrides ? overrides.insCertPath : (gcCredInsCertPath || null),
        licNumber: gcCredLicNumber || null,
        licType: gcCredLicType || null,
        licState: gcCredLicState || null,
        licExpDate: gcCredLicExpDate || null,
        licDocPath: "licDocPath" in overrides ? overrides.licDocPath : (gcCredLicDocPath || null),
      }),
    });
    return res.ok;
  }

  async function handleUploadGcInsCert(file: File) {
    const result = await uploadGcInsCert(file);
    if (!result?.objectPath) { toast.error("Upload failed"); return; }
    const path = result.objectPath;
    setGcCredInsCertPath(path);
    setGcCredInsCertFileName(file.name);
    setGcCredInsSection(true);
    const saved = await saveGcCredsToDB({ insCertPath: path });
    if (saved) {
      refetchGcCredentials();
      toast.success("Certificate uploaded successfully");
    } else {
      toast.error("File uploaded but could not be saved — click Save Credentials");
    }
  }

  async function handleUploadGcLicDoc(file: File) {
    const result = await uploadGcLicDoc(file);
    if (!result?.objectPath) { toast.error("Upload failed"); return; }
    const path = result.objectPath;
    setGcCredLicDocPath(path);
    setGcCredLicDocFileName(file.name);
    setGcCredLicSection(true);
    const saved = await saveGcCredsToDB({ licDocPath: path });
    if (saved) {
      refetchGcCredentials();
      toast.success("License document uploaded successfully");
    } else {
      toast.error("File uploaded but could not be saved — click Save Credentials");
    }
  }

  async function handleDownloadGcDoc(docType: "cert" | "license") {
    try {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/gc-credentials/download/${docType}`, { credentials: "include" });
      if (!res.ok) { toast.error("Failed to download document"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = docType === "cert" ? "gc-insurance-certificate.pdf" : "gc-contractor-license.pdf";
      a.click(); URL.revokeObjectURL(url);
    } catch { toast.error("Download failed"); }
  }

  async function handleAddComplianceItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newComplianceTitle.trim()) return;
    setNewComplianceSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/compliance-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: newComplianceTitle.trim(), required: newComplianceRequired, allowDocumentUpload: newComplianceDocAllowed }),
      });
      if (!res.ok) { toast.error("Failed to add item"); return; }
      setNewComplianceTitle("");
      setNewComplianceRequired(true);
      setNewComplianceDocAllowed(false);
      refetchComplianceItems();
      refetchComplianceSummary();
      toast.success("Compliance item added");
    } finally { setNewComplianceSaving(false); }
  }

  async function handleUpdateComplianceItem(id: string) {
    setComplianceEditSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/compliance-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: complianceEditTitle.trim(), required: complianceEditRequired, allowDocumentUpload: complianceEditDocAllowed }),
      });
      if (!res.ok) { toast.error("Failed to update item"); return; }
      setComplianceEditId(null);
      refetchComplianceItems();
      refetchComplianceSummary();
      toast.success("Updated");
    } finally { setComplianceEditSaving(false); }
  }

  async function handleDeleteComplianceItem(id: string) {
    try {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/compliance-items/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) { toast.error("Failed to delete item"); return; }
      setComplianceDeleteConfirm(null);
      refetchComplianceItems();
      refetchComplianceSummary();
      toast.success("Item removed");
    } catch { toast.error("Failed to delete item"); }
  }

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  type CompletionDoc = { id: string; projectId: string; fileName: string; objectPath: string; fileSize: number | null; category: string; label: string | null; uploadedBy: string | null; createdAt: string };
  const { data: completionDocsData = [], refetch: refetchCompletionDocs } = useQuery<CompletionDoc[]>({
    queryKey: ["completion-docs", projectId],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/completion-documents`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId && user?.role === "GC" && (project?.status === "COMPLETE" || !!(project as any)?.archivedAt),
    staleTime: 15000,
  });

  type OwnerNotification = { id: string; changeOrderId: string; ownerName: string; ownerEmail: string; ownerResponse: string | null; ownerResponseAt: string | null; sentAt: string; changeOrder: { description: string; amount: number; status: string } | null };
  const { data: ownerNotifications = [], refetch: refetchOwnerNotifications } = useQuery<OwnerNotification[]>({
    queryKey: ["owner-notifications", projectId],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}/owner-notifications`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId && user?.role === "GC",
    staleTime: 15000,
  });

  async function handleOwnerSave(e: React.FormEvent) {
    e.preventDefault();
    setOwnerSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ownerName: ownerName.trim() || null,
          ownerEmail: ownerEmail.trim() || null,
          ownerCoThreshold: ownerCoThreshold !== "" ? Number(ownerCoThreshold) : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      setOwnerEditing(false);
      toast.success("Project owner saved");
    } catch {
      toast.error("Failed to save project owner");
    } finally {
      setOwnerSaving(false);
    }
  }

  const queryClient_ref = queryClient;

  const handlePlanFileDownload = React.useCallback(async (planFileId: string) => {
    if (isGC_for_views) return;
    try {
      await fetch(`${BASE_URL}/api/projects/${projectId}/plan-files/${planFileId}/view`, {
        method: "POST",
        credentials: "include",
      });
      queryClient_ref.invalidateQueries({ queryKey: ["plan-file-my-views", projectId] });
    } catch {
    }
  }, [projectId, isGC_for_views, BASE_URL, queryClient_ref]);
  const [awardBidConfirm, setAwardBidConfirm] = React.useState<{ open: boolean; id: string; company: string; amount: number }>({ open: false, id: "", company: "", amount: 0 });
  const [awardTradeCategory, setAwardTradeCategory] = React.useState("");
  const [awardRetentionPct, setAwardRetentionPct] = React.useState("10");
  const [tradeFilter, setTradeFilter] = React.useState("");
  const [removeMemberConfirm, setRemoveMemberConfirm] = React.useState<{ open: boolean; userId: string; companyName: string }>({ open: false, userId: "", companyName: "" });

  // Complete + Archive hooks — must be above early return
  const [completeConfirm, setCompleteConfirm] = React.useState(false);
  const [completeLoading, setCompleteLoading] = React.useState(false);
  const [archiveConfirm, setArchiveConfirm] = React.useState(false);
  const [unarchiveConfirm, setUnarchiveConfirm] = React.useState(false);
  const [archiveLoading, setArchiveLoading] = React.useState(false);

  // Completion checklist modal state
  type CompletionUploadedFile = { objectPath: string; fileName: string; fileSize: number; category: "document" | "photo"; label: string };
  const [completionUploadedFiles, setCompletionUploadedFiles] = React.useState<CompletionUploadedFile[]>([]);
  const [completionNoteText, setCompletionNoteText] = React.useState("");
  const [retentionReleased, setRetentionReleased] = React.useState(false);
  const [retentionWaived, setRetentionWaived] = React.useState(false);
  const [completionDocUploading, setCompletionDocUploading] = React.useState(false);
  const completionDocInputRef = React.useRef<HTMLInputElement>(null);
  const completionPhotoInputRef = React.useRef<HTMLInputElement>(null);

  // ── Bulk Change Order state (hooks must be before early returns) ───────────
  const [isBulkCOOpen, setIsBulkCOOpen] = React.useState(false);
  const [bulkCODescription, setBulkCODescription] = React.useState("");
  const [bulkCOScope, setBulkCOScope] = React.useState("");
  const [selectedSubIds, setSelectedSubIds] = React.useState<Set<string>>(new Set());
  const [subAmounts, setSubAmounts] = React.useState<Record<string, string>>({});
  const [bulkCOLoading, setBulkCOLoading] = React.useState(false);

  // Fetch all COs for this project (GC only) — must be before early return
  const { data: projectCOs = [] } = useQuery<any[]>({
    queryKey: ["project-cos", projectId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/projects/${projectId}/change-orders`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
    refetchOnWindowFocus: false,
  });

  // Fetch insurance summary for all subcontracts in this project (GC only — must be before early return)
  const { data: projectInsurance = [] } = useQuery<{ subcontractId: string; status: string; expirationDate: string | null }[]>({
    queryKey: ["project-insurance-summary", projectId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/projects/${projectId}/insurance-summary`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  // Fetch license summary for all subcontracts in this project (GC only — must be before early return)
  const { data: projectLicenses = [] } = useQuery<{ subcontractId: string; status: string; expirationDate: string | null }[]>({
    queryKey: ["project-license-summary", projectId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/projects/${projectId}/license-summary`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  // Fetch lien waivers for this project — must be before early return
  const { data: lienWaivers = [], isLoading: lienWaiversLoading } = useQuery<any[]>({
    queryKey: ["project-lien-waivers", projectId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/projects/${projectId}/lien-waivers`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  // Draw Schedule — GC only
  const [activeSection, setActiveSection] = React.useState<"overview" | "draw-schedule">("overview");
  const [dsAddDescription, setDsAddDescription] = React.useState("");
  const [dsAddBudget, setDsAddBudget] = React.useState("");
  const [dsAddLoading, setDsAddLoading] = React.useState(false);
  const [dsInputMode, setDsInputMode] = React.useState<"manual" | "paste">("manual");
  const [dsPasteText, setDsPasteText] = React.useState("");
  const [dsParsedItems, setDsParsedItems] = React.useState<{ description: string; budgetAmount: number }[]>([]);
  const [dsParsing, setDsParsing] = React.useState(false);
  const [dsEditItemId, setDsEditItemId] = React.useState<string | null>(null);
  const [dsEditDescription, setDsEditDescription] = React.useState("");
  const [dsEditBudget, setDsEditBudget] = React.useState("");
  const [dsEditLoading, setDsEditLoading] = React.useState(false);
  const [dsLinkItemId, setDsLinkItemId] = React.useState<string | null>(null);
  const [dsLinkSubId, setDsLinkSubId] = React.useState("");
  const [dsLinkLoading, setDsLinkLoading] = React.useState(false);
  const [awardDrawScheduleItemId, setAwardDrawScheduleItemId] = React.useState("");

  const { data: drawScheduleItems = [], refetch: refetchDrawSchedule } = useQuery<any[]>({
    queryKey: ["draw-schedule", projectId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/projects/${projectId}/draw-schedule`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId && user?.role === "GC",
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  const { uploadFile, progress, isUploading } = useUpload({
    onError: (err) => {
      toast.error(err.message || "Upload failed");
      setUploadStep("idle");
    },
  });

  const { uploadFile: uploadBidScope } = useUpload({
    onError: (err) => {
      toast.error(err.message || "Scope of work upload failed");
      setBidScopeUploading(false);
    },
  });

  const { uploadFile: uploadCompletionFile } = useUpload({
    onError: (err) => {
      toast.error(err.message || "Completion document upload failed");
      setCompletionDocUploading(false);
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
      const result = await inviteSub.mutateAsync({ projectId, data: { email: inviteEmail, companyName: inviteCompanyName, tradeCategory: inviteTrade || undefined } as any });
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      if (result.isNewUser && result.temporaryPassword) {
        setInviteResult({ temporaryPassword: result.temporaryPassword, email: inviteEmail });
        toast.success("Account created and sub added to project!");
      } else {
        toast.success("Subcontractor added to project!");
        setIsInviteOpen(false);
        setInviteEmail("");
        setInviteCompanyName("");
        setInviteTrade("");
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
    setBiddingInviteSuccess(null);
    setCopied(false);
    setContactSearch("");
    setInviteTab("contact");
    setInviteStep("select");
    setInviteSelectedSub(null);
    setDirectAmount("");
    setDirectTrade("");
    setDirectRetention("10");
    setDirectLoading(false);
    setDirectSuccess(null);
    setInviteTrade("");
  };

  // Construction-phase: select sub from contact book → advance to contract details step
  const handleContactSelectForDirect = (subId: string, companyName: string) => {
    setInviteSelectedSub({ subId, companyName });
    setInviteStep("contract");
  };

  // Construction-phase: new sub email form submitted → advance to contract details step
  const handleNewSubNextForDirect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteCompanyName.trim()) return;
    setInviteSelectedSub({ email: inviteEmail.trim(), companyName: inviteCompanyName.trim() });
    setInviteStep("contract");
  };

  // Construction-phase: create subcontract directly with entered amount
  const handleDirectSubcontract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteSelectedSub) return;
    const amount = parseFloat(directAmount.replace(/[$,]/g, ""));
    if (isNaN(amount) || amount <= 0) return toast.error("Enter a valid Direct Award amount");
    setDirectLoading(true);
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/subcontracts/direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subId: inviteSelectedSub.subId,
          email: inviteSelectedSub.email,
          companyName: inviteSelectedSub.companyName,
          baseContractAmount: amount,
          tradeCategory: directTrade.trim() || undefined,
          retentionPercentage: Number(directRetention) || 10,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create subcontract");
      }
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      setDirectSuccess({ companyName: inviteSelectedSub.companyName });
    } catch (err: any) {
      toast.error(err.message || "Failed to create subcontract");
    } finally {
      setDirectLoading(false);
    }
  };

  const handleContactInvite = async (subId: string, companyName: string, email: string) => {
    try {
      const res = await fetch(`${BASE}/api/contacts/${subId}/invite/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tradeCategory: inviteTrade || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to add to project");
      }
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      setBiddingInviteSuccess({ companyName, email });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add to project");
    }
  };

  // ── Trade Scope Handlers ──────────────────────────────────────────────────
  const handleSaveTradeScope = async () => {
    if (!scopeEditTrade || !scopeEditText.trim()) return;
    setScopeSaving(true);
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/trade-scopes/${encodeURIComponent(scopeEditTrade)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ description: scopeEditText.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to save scope");
        return;
      }
      await refetchTradeScopes();
      setScopeEditTrade("");
      setScopeEditText("");
      toast.success("Trade scope saved");
    } finally {
      setScopeSaving(false);
    }
  };

  const handleDeleteTradeScope = async (trade: string) => {
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/trade-scopes/${encodeURIComponent(trade)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to delete scope");
        return;
      }
      await refetchTradeScopes();
      setScopeDeleteConfirm(null);
      toast.success("Trade scope removed");
    } catch {
      toast.error("Failed to delete scope");
    }
  };

  const handleSaveScopeTemplate = async () => {
    if (!scopeTemplateName.trim() || !scopeEditText.trim()) return;
    setScopeTemplateSaving(true);
    try {
      const res = await fetch(`${BASE}/api/scope-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tradeCategory: scopeEditTrade, name: scopeTemplateName.trim(), description: scopeEditText.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to save template");
        return;
      }
      await refetchScopeTemplates();
      setScopeSaveTemplateOpen(false);
      setScopeTemplateName("");
      toast.success("Template saved to your account");
    } finally {
      setScopeTemplateSaving(false);
    }
  };

  const handleDeleteScopeTemplate = async (id: string) => {
    try {
      const res = await fetch(`${BASE}/api/scope-templates/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) return;
      await refetchScopeTemplates();
    } catch {}
  };
  // ─────────────────────────────────────────────────────────────────────────

  const handleCopyPassword = () => {
    if (inviteResult) {
      navigator.clipboard.writeText(inviteResult.temporaryPassword).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const doBidSubmit = async () => {
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) return toast.error("Invalid bid amount");
    if (myTradeScope && !bidScopeAcknowledged) {
      toast.error("You must acknowledge the GC's Scope of Work before submitting your bid.");
      return;
    }
    try {
      let scopeOfWorkObjectPath: string | undefined;
      if (bidScopeFile) {
        setBidScopeUploading(true);
        const result = await uploadBidScope(bidScopeFile, `/bids/${projectId}/scope/`, bidScopeFile.name);
        scopeOfWorkObjectPath = result.objectPath;
        setBidScopeUploading(false);
      }
      await submitBid.mutateAsync({ projectId, data: { amount, notes: bidNotes.trim() || undefined, scopeOfWorkObjectPath: scopeOfWorkObjectPath ?? null, scopeAcknowledged: myTradeScope ? bidScopeAcknowledged : undefined } as any });
      toast.success("Bid submitted successfully!");
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      setBidAmount("");
      setBidNotes("");
      setBidScopeFile(null);
      setBidScopeAcknowledged(false);
      setShowNoPlanWarning(false);
    } catch {
      toast.error("Failed to submit bid");
      setBidScopeUploading(false);
    }
  };

  const handleBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (planFiles.length > 0 && viewedPlanFileIds.size === 0) {
      setShowNoPlanWarning(true);
      return;
    }
    await doBidSubmit();
  };

  const handlePlanFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError("");
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const invalid = files.find(f => !ALLOWED_EXTENSIONS.test(f.name));
    if (invalid) { setFileError(`"${invalid.name}" is not a supported file type. Use PDF, PNG, JPG, DWG, or DOCX.`); e.target.value = ""; return; }
    const tooBig = files.find(f => f.size > MAX_SIZE_BYTES);
    if (tooBig) { setFileError(`"${tooBig.name}" exceeds the 50 MB limit.`); e.target.value = ""; return; }
    setSelectedFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...files.filter(f => !names.has(f.name))];
    });
    e.target.value = "";
  };

  const handleUploadPlans = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFiles.length) return toast.error("Please select at least one file");
    setUploadStep("uploading");
    const results: { file: File; objectPath: string }[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      setUploadFileIndex(i);
      const result = await uploadFile(selectedFiles[i]);
      if (!result) { setUploadStep("idle"); return; }
      results.push({ file: selectedFiles[i], objectPath: result.objectPath });
    }
    setUploadStep("saving");
    try {
      for (const { file, objectPath } of results) {
        await addPlanFile.mutateAsync({ projectId, data: { objectPath, fileName: file.name, fileSize: file.size } as any });
      }
      toast.success(results.length === 1 ? "Plan file uploaded!" : `${results.length} plan files uploaded!`);
      queryClient.invalidateQueries({ queryKey: getGetProjectPlanFilesQueryKey(projectId) });
      handleClosePlanDialog();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Failed to save plan files");
      setUploadStep("idle");
    }
  };

  const handleClosePlanDialog = () => {
    setIsPlanOpen(false);
    setSelectedFiles([]);
    setFileError("");
    setUploadStep("idle");
    setUploadFileIndex(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleScopeFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScopeFileError("");
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const invalid = files.find(f => !ALLOWED_EXTENSIONS.test(f.name));
    if (invalid) { setScopeFileError(`"${invalid.name}" is not a supported file type. Use PDF, PNG, JPG, DWG, or DOCX.`); e.target.value = ""; return; }
    const tooBig = files.find(f => f.size > MAX_SIZE_BYTES);
    if (tooBig) { setScopeFileError(`"${tooBig.name}" exceeds the 50 MB limit.`); e.target.value = ""; return; }
    setSelectedScopeFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...files.filter(f => !names.has(f.name))];
    });
    e.target.value = "";
  };

  const handleUploadScopeDocs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScopeFiles.length) return toast.error("Please select at least one file");
    setScopeUploadStep("uploading");
    const results: { file: File; objectPath: string }[] = [];
    for (let i = 0; i < selectedScopeFiles.length; i++) {
      setScopeUploadFileIndex(i);
      const result = await uploadFile(selectedScopeFiles[i]);
      if (!result) { setScopeUploadStep("idle"); return; }
      results.push({ file: selectedScopeFiles[i], objectPath: result.objectPath });
    }
    setScopeUploadStep("saving");
    try {
      for (const { file, objectPath } of results) {
        await fetch(`${BASE_URL}/api/projects/${projectId}/scope-documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ objectPath, fileName: file.name, fileSize: file.size }),
        });
      }
      toast.success(results.length === 1 ? "Scope document uploaded!" : `${results.length} scope documents uploaded!`);
      refetchScopeDocs();
      handleCloseScopeDialog();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save scope documents");
      setScopeUploadStep("idle");
    }
  };

  const handleCloseScopeDialog = () => {
    setIsScopeOpen(false);
    setSelectedScopeFiles([]);
    setScopeFileError("");
    setScopeUploadStep("idle");
    setScopeUploadFileIndex(0);
    if (scopeFileInputRef.current) scopeFileInputRef.current.value = "";
  };

  const handleDeleteScope = async () => {
    try {
      await fetch(`${BASE_URL}/api/projects/${projectId}/scope-documents/${deleteScopeConfirm.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      toast.success("Document deleted");
      refetchScopeDocs();
      setDeleteScopeConfirm({ open: false, id: "", name: "" });
    } catch {
      toast.error("Failed to delete document");
    }
  };

  const handleRemoveMember = async () => {
    try {
      await removeMember.mutateAsync({ projectId, userId: removeMemberConfirm.userId });
      toast.success(`${removeMemberConfirm.companyName} removed from project`);
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      setRemoveMemberConfirm({ open: false, userId: "", companyName: "" });
    } catch (err: any) {
      toast.error(err?.data?.error || "Failed to remove subcontractor");
      setRemoveMemberConfirm({ open: false, userId: "", companyName: "" });
    }
  };

  const handleDeletePlan = async () => {
    try {
      await deletePlanFileMutation.mutateAsync({ projectId, planFileId: deletePlanConfirm.id });
      toast.success("Plan file deleted");
      queryClient.invalidateQueries({ queryKey: getGetProjectPlanFilesQueryKey(projectId) });
      setDeletePlanConfirm({ open: false, id: "", name: "" });
    } catch {
      toast.error("Failed to delete plan file");
    }
  };

  const handleAward = async () => {
    const retPct = Math.min(15, Math.max(0, parseFloat(awardRetentionPct) || 10));
    try {
      const result = await awardBid.mutateAsync({ projectId, bidId: awardBidConfirm.id, data: { tradeCategory: awardTradeCategory || null, retentionPercentage: retPct } });
      if (awardDrawScheduleItemId && result?.id) {
        await fetch(`${BASE}/api/projects/${projectId}/draw-schedule/link-subcontract`, {
          method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subcontractId: result.id, drawScheduleItemId: awardDrawScheduleItemId }),
        }).catch(() => null);
        refetchDrawSchedule();
      }
      toast.success("Bid awarded and subcontract created!");
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      setAwardBidConfirm({ open: false, id: "", company: "", amount: 0 });
      setAwardTradeCategory("");
      setAwardRetentionPct("10");
      setAwardDrawScheduleItemId("");
    } catch {
      toast.error("Failed to award bid");
    }
  };

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const handleMarkComplete = async () => {
    if (!retentionReleased && !retentionWaived) {
      toast.error("Please confirm retention status before completing the project.");
      return;
    }
    setCompleteLoading(true);
    try {
      // Register any uploaded completion documents with the API
      for (const doc of completionUploadedFiles) {
        await fetch(`${BASE}/api/projects/${projectId}/completion-documents`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: doc.fileName, objectPath: doc.objectPath, fileSize: doc.fileSize, category: doc.category, label: doc.label || null }),
        });
      }
      // Mark project complete with note and retention status
      const res = await fetch(`${BASE}/api/projects/${projectId}/complete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completionNote: completionNoteText.trim() || undefined,
          retentionWaived: retentionWaived && !retentionReleased,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to mark project complete");
      toast.success("Project marked as complete!");
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      queryClient.invalidateQueries({ queryKey: ["completion-docs", projectId] });
      setCompleteConfirm(false);
      setCompletionUploadedFiles([]);
      setCompletionNoteText("");
      setRetentionReleased(false);
      setRetentionWaived(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to mark project complete");
    } finally {
      setCompleteLoading(false);
    }
  };

  const handleCompletionFileSelect = async (files: FileList | null, category: "document" | "photo") => {
    if (!files || files.length === 0) return;
    setCompletionDocUploading(true);
    const added: typeof completionUploadedFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const result = await uploadCompletionFile(file);
        if (result) {
          added.push({ objectPath: result.objectPath, fileName: result.metadata.name, fileSize: result.metadata.size, category, label: "" });
        }
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setCompletionUploadedFiles(prev => [...prev, ...added]);
    setCompletionDocUploading(false);
  };

  const handleArchive = async () => {
    setArchiveLoading(true);
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/archive`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to archive project");
      }
      toast.success("Project archived!");
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      setArchiveConfirm(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to archive project");
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleUnarchive = async () => {
    setArchiveLoading(true);
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/unarchive`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to unarchive project");
      }
      toast.success("Project restored!");
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      setUnarchiveConfirm(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to unarchive project");
    } finally {
      setArchiveLoading(false);
    }
  };

  const isArchived = !!(project as any).archivedAt;

  // ── Bulk Change Order helpers (non-hook, safe after early return) ──────────
  const toggleSubSelection = (scId: string) => {
    setSelectedSubIds(prev => {
      const next = new Set(prev);
      if (next.has(scId)) next.delete(scId);
      else next.add(scId);
      return next;
    });
  };

  const bulkCOTotal = Array.from(selectedSubIds).reduce((sum, scId) => {
    const val = parseFloat(subAmounts[scId] ?? "0");
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const handleBulkCOSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkCODescription.trim()) return toast.error("Description is required");
    if (selectedSubIds.size === 0) return toast.error("Select at least one subcontractor");
    const entries = Array.from(selectedSubIds).map(scId => ({
      subcontractId: scId,
      amount: parseFloat(subAmounts[scId] ?? "0"),
    }));
    if (entries.some(e => !e.amount || e.amount <= 0)) {
      return toast.error("Enter a valid amount for each selected subcontractor");
    }
    setBulkCOLoading(true);
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/change-orders/bulk`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: bulkCODescription.trim(), scope: bulkCOScope.trim() || undefined, entries }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create change orders");
      }
      const created = await res.json();
      toast.success(`${created.length} change order${created.length !== 1 ? "s" : ""} sent!`);
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      queryClient.invalidateQueries({ queryKey: ["project-cos", projectId] });
      setIsBulkCOOpen(false);
      setBulkCODescription("");
      setBulkCOScope("");
      setSelectedSubIds(new Set());
      setSubAmounts({});
    } catch (err: any) {
      toast.error(err.message || "Failed to create change orders");
    } finally {
      setBulkCOLoading(false);
    }
  };

  const pendingCOs = projectCOs.filter(co => co.status === "PENDING_GC" || co.status === "PENDING_SUB");

  const getFileUrl = (plan: { objectPath?: string | null; fileUrl?: string | null }) => {
    if (plan.objectPath) return `/api/storage${plan.objectPath}`;
    return plan.fileUrl ?? "#";
  };

  const uploadProgressDisplay = uploadStep === "uploading" ? progress : uploadStep === "saving" ? 100 : 0;
  const uploadStatusText = uploadStep === "uploading"
    ? selectedFiles.length > 1
      ? `Uploading file ${uploadFileIndex + 1} of ${selectedFiles.length}… ${progress}%`
      : `Uploading… ${progress}%`
    : uploadStep === "saving" ? "Saving…" : "";
  const isSubmitting = uploadStep !== "idle";
  const isScopeSubmitting = scopeUploadStep !== "idle";
  const scopeUploadStatusText = scopeUploadStep === "uploading"
    ? selectedScopeFiles.length > 1
      ? `Uploading file ${scopeUploadFileIndex + 1} of ${selectedScopeFiles.length}… ${progress}%`
      : `Uploading… ${progress}%`
    : scopeUploadStep === "saving" ? "Saving…" : "";

  const handleDsAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dsAddDescription.trim()) return toast.error("Description is required");
    const amount = parseFloat(dsAddBudget.replace(/[$,]/g, ""));
    if (isNaN(amount) || amount <= 0) return toast.error("Enter a valid budget amount");
    setDsAddLoading(true);
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/draw-schedule`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: dsAddDescription.trim(), budgetAmount: amount }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to add item"); }
      toast.success("Line item added");
      setDsAddDescription(""); setDsAddBudget("");
      refetchDrawSchedule();
    } catch (err: any) { toast.error(err.message || "Failed to add item"); }
    finally { setDsAddLoading(false); }
  };

  const handleDsParse = async () => {
    if (!dsPasteText.trim()) return toast.error("Paste some text first");
    setDsParsing(true);
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/draw-schedule/parse`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: dsPasteText }),
      });
      const parsed = await res.json();
      if (!res.ok) throw new Error(parsed.error || "Failed to parse");
      if (parsed.length === 0) toast.error("No line items could be parsed. Try: 'Framing, $85,000' or 'Electrical $45,000'");
      else { setDsParsedItems(parsed); toast.success(`Parsed ${parsed.length} line item${parsed.length !== 1 ? "s" : ""}`); }
    } catch (err: any) { toast.error(err.message || "Parse failed"); }
    finally { setDsParsing(false); }
  };

  const handleDsImport = async () => {
    if (dsParsedItems.length === 0) return;
    setDsAddLoading(true);
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/draw-schedule/import`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: dsParsedItems }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Import failed"); }
      toast.success(`${dsParsedItems.length} items imported`);
      setDsParsedItems([]); setDsPasteText(""); setDsInputMode("manual");
      refetchDrawSchedule();
    } catch (err: any) { toast.error(err.message || "Import failed"); }
    finally { setDsAddLoading(false); }
  };

  const handleDsEdit = async (itemId: string) => {
    if (!dsEditDescription.trim()) return toast.error("Description is required");
    const amount = parseFloat(dsEditBudget.replace(/[$,]/g, ""));
    if (isNaN(amount) || amount <= 0) return toast.error("Enter a valid budget amount");
    setDsEditLoading(true);
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/draw-schedule/${itemId}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: dsEditDescription.trim(), budgetAmount: amount }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Update failed"); }
      toast.success("Item updated");
      setDsEditItemId(null);
      refetchDrawSchedule();
    } catch (err: any) { toast.error(err.message || "Update failed"); }
    finally { setDsEditLoading(false); }
  };

  const handleDsDelete = async (itemId: string, description: string) => {
    if (!confirm(`Delete "${description}"? Any linked subcontracts will be unlinked.`)) return;
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/draw-schedule/${itemId}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Delete failed"); }
      toast.success("Item deleted");
      refetchDrawSchedule();
    } catch (err: any) { toast.error(err.message || "Delete failed"); }
  };

  const handleDsLinkSub = async () => {
    if (!dsLinkItemId) return;
    setDsLinkLoading(true);
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/draw-schedule/link-subcontract`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subcontractId: dsLinkSubId || null, drawScheduleItemId: dsLinkItemId }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to link"); }
      toast.success("Subcontract linked");
      setDsLinkItemId(null); setDsLinkSubId("");
      refetchDrawSchedule();
    } catch (err: any) { toast.error(err.message || "Failed to link"); }
    finally { setDsLinkLoading(false); }
  };

  const handleDsUnlinkSub = async (subcontractId: string) => {
    try {
      const res = await fetch(`${BASE}/api/projects/${projectId}/draw-schedule/link-subcontract`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subcontractId, drawScheduleItemId: null }),
      });
      if (!res.ok) throw new Error("Failed to unlink");
      toast.success("Subcontract unlinked");
      refetchDrawSchedule();
    } catch { toast.error("Failed to unlink subcontract"); }
  };

  const handleDsExportCSV = () => {
    if (drawScheduleItems.length === 0) { toast.error("No items to export"); return; }
    const header = "Line Item,Budget Amount,Committed,Variance,% Used,Linked Subcontracts";
    const rows = drawScheduleItems.map((item: any) => {
      const committed = item.committed ?? 0;
      const variance = item.budgetAmount - committed;
      const pct = item.budgetAmount > 0 ? ((committed / item.budgetAmount) * 100).toFixed(1) : "0.0";
      const subs = (item.linkedSubcontracts ?? []).map((s: any) => s.companyName).join("; ");
      return `"${item.description}",${item.budgetAmount},${committed},${variance},${pct}%,"${subs}"`;
    });
    const totalBudget = drawScheduleItems.reduce((s: number, i: any) => s + i.budgetAmount, 0);
    const totalCommitted = drawScheduleItems.reduce((s: number, i: any) => s + (i.committed ?? 0), 0);
    const totalVariance = totalBudget - totalCommitted;
    const totalPct = totalBudget > 0 ? ((totalCommitted / totalBudget) * 100).toFixed(1) : "0.0";
    rows.push(`"TOTAL",${totalBudget},${totalCommitted},${totalVariance},${totalPct}%,""`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `draw-schedule-${project?.name?.replace(/[^a-z0-9]/gi, "-").toLowerCase() ?? "project"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="mb-8 bg-card p-6 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold font-display leading-tight">{project.name}</h1>
              <Badge variant={project.status === "CONSTRUCTION" ? "success" : project.status === "BIDDING" ? "default" : project.status === "COMPLETE" ? "secondary" : "secondary"}>
                {project.status === "CONSTRUCTION" ? "In Construction" : project.status === "COMPLETE" ? "Complete" : project.status === "BIDDING" ? "Bidding" : project.status}
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

          <div className="flex flex-wrap gap-3">
            {isGC && !isArchived && (
              <Button variant="outline" onClick={handleOpenEdit} className="gap-2 min-h-[44px]">
                <Pencil className="h-4 w-4" /> Edit Project
              </Button>
            )}
            {isGC && !isArchived && project.status !== "COMPLETE" && (
              <Button onClick={() => setIsInviteOpen(true)} className="gap-2 min-h-[44px] px-5">
                <Plus className="h-5 w-5" />
                {project.status === "BIDDING" ? "Invite Sub to Bid" : "Add Subcontractor"}
              </Button>
            )}
            {isGC && project.status === "COMPLETE" && !isArchived && (
              <Button
                onClick={() => setArchiveConfirm(true)}
                className="gap-2 min-h-[48px] px-6 text-base font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-md"
              >
                <Archive className="h-5 w-5" /> Archive Project
              </Button>
            )}
            {isGC && isArchived && (
              <Button
                variant="outline"
                onClick={() => setUnarchiveConfirm(true)}
                className="gap-2 min-h-[44px]"
              >
                <ArchiveRestore className="h-4 w-4" /> Restore Project
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* SECTION TABS — GC only */}
      {isGC && (
        <div className="flex border-b border-border mb-6">
          <button
            onClick={() => setActiveSection("overview")}
            className={cn("flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors",
              activeSection === "overview" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-4 w-4" /> Overview
          </button>
          <button
            onClick={() => setActiveSection("draw-schedule")}
            className={cn("flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors",
              activeSection === "draw-schedule" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <TableProperties className="h-4 w-4" /> Draw Schedule
            {drawScheduleItems.length > 0 && (
              <span className="ml-1 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">{drawScheduleItems.length}</span>
            )}
          </button>
        </div>
      )}

      {activeSection === "overview" && (
      <>
      {/* ARCHIVED READ-ONLY BANNER */}
      {isArchived && (
        <div className="mb-6 rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-amber-800 dark:text-amber-300 text-sm">This project is archived — read-only</div>
            <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              All data is preserved. No new change orders or invoices can be added. PDFs are still available for download.
              {(project as any).archivedAt && (
                <> Archived on {format(new Date((project as any).archivedAt), "MMMM d, yyyy")}.</>
              )}
            </div>
          </div>
          {isGC && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setUnarchiveConfirm(true)}
              className="gap-1.5 shrink-0 text-amber-700 border-amber-400 hover:bg-amber-100"
            >
              <ArchiveRestore className="h-3.5 w-3.5" /> Restore
            </Button>
          )}
        </div>
      )}

      {/* GC FINANCIAL OVERVIEW */}
      {isGC && perms.hasFinancialAccess && project.subcontracts && project.subcontracts.length > 0 && (() => {
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
                  "text-base md:text-xl font-bold font-mono break-all leading-tight",
                  stat.highlight ? "text-amber-700 dark:text-amber-400" : "text-foreground"
                )}>{formatCurrency(stat.value)}</p>
              </div>
            ))}
          </div>
        );
      })()}

      <div className={isGC ? "grid lg:grid-cols-3 gap-8" : "space-y-8"}>
        <div className={isGC ? "lg:col-span-2 space-y-8" : "space-y-8"}>

          {/* PLAN FILES SECTION */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Site Plans
                </CardTitle>
                {isGC && project.status === "BIDDING" && (
                  <Button size="sm" variant="outline" onClick={() => setIsPlanOpen(true)} className="gap-1.5">
                    <Upload className="h-4 w-4" /> Upload Plans
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {planFiles.length === 0 ? (
                <p className="text-muted-foreground text-sm py-2">No plan files uploaded yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {planFiles.map((plan) => {
                    const isViewed = viewedPlanFileIds.has(plan.id);
                    const fileViews = allPlanViews.filter(v => v.planFileId === plan.id);
                    const isExpanded = expandedPlanViews.has(plan.id);
                    return (
                      <li key={plan.id} className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className={cn(
                              "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                              !isGC && isViewed ? "bg-green-100 dark:bg-green-950/30" : "bg-primary/10"
                            )}>
                              {!isGC && isViewed
                                ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                : <FileText className="h-4 w-4 text-primary" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold truncate">{plan.fileName ?? "Unnamed file"}</p>
                                {!isGC && isViewed && (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400">
                                    <Check className="h-3 w-3" /> Downloaded
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                              <div className="flex items-center gap-2 flex-wrap mt-1">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(plan.createdAt), "MMM d, yyyy")}
                                </div>
                                {(plan as any).fileSize && (
                                  <span className="text-xs text-muted-foreground">{formatFileSize((plan as any).fileSize)}</span>
                                )}
                                {isGC && fileViews.length > 0 && (
                                  <button
                                    onClick={() => setExpandedPlanViews(prev => {
                                      const next = new Set(prev);
                                      next.has(plan.id) ? next.delete(plan.id) : next.add(plan.id);
                                      return next;
                                    })}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                  >
                                    <Eye className="h-3 w-3" />
                                    Viewed by {fileViews.length} sub{fileViews.length !== 1 ? "s" : ""}
                                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  </button>
                                )}
                                {isGC && fileViews.length === 0 && (
                                  <span className="text-xs text-muted-foreground italic">No subs have downloaded this file</span>
                                )}
                              </div>
                              {isGC && isExpanded && fileViews.length > 0 && (
                                <div className="mt-2 ml-1 space-y-1 border-l-2 border-primary/20 pl-3">
                                  {fileViews.map(v => (
                                    <div key={v.id} className="text-xs text-muted-foreground">
                                      <span className="font-semibold text-foreground">{v.subName}</span>
                                      {v.companyName && ` · ${v.companyName}`}
                                      <span className="ml-1.5 text-muted-foreground">
                                        {format(new Date(v.viewedAt), "MMM d, yyyy 'at' h:mm a")}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={getFileUrl(plan)}
                              download={plan.fileName ?? true}
                              onClick={() => handlePlanFileDownload(plan.id)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                            >
                              <Download className="h-3.5 w-3.5" /> Download
                            </a>
                            {isGC && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeletePlanConfirm({ open: true, id: plan.id, name: plan.fileName ?? plan.description })}
                                disabled={deletePlanFileMutation.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* SCOPE DOCUMENTS SECTION */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" /> Scope of Work Documents
                </CardTitle>
                {isGC && project.status === "BIDDING" && (
                  <Button size="sm" variant="outline" onClick={() => setIsScopeOpen(true)} className="gap-1.5">
                    <Upload className="h-4 w-4" /> Upload Docs
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Specifications, project requirements, and scope documents available to all invited subs before bidding.</p>
            </CardHeader>
            <CardContent>
              {scopeDocs.length === 0 ? (
                <p className="text-muted-foreground text-sm py-2">No scope documents uploaded yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {scopeDocs.map((doc) => (
                    <li key={doc.id} className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-primary/10">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{doc.fileName}</p>
                            {doc.description && doc.description !== doc.fileName && (
                              <p className="text-xs text-muted-foreground mt-0.5">{doc.description}</p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap mt-1">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(doc.createdAt), "MMM d, yyyy")}
                              </div>
                              {doc.fileSize && (
                                <span className="text-xs text-muted-foreground">{formatFileSize(doc.fileSize)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {doc.objectPath && (
                            <a
                              href={`${BASE_URL}/api/storage${doc.objectPath}`}
                              download={doc.fileName}
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                            >
                              <Download className="h-3.5 w-3.5" /> Download
                            </a>
                          )}
                          {isGC && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteScopeConfirm({ open: true, id: doc.id, name: doc.fileName })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* COMPLIANCE CHECKLIST SECTION — GC only */}
          {isGC && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-primary" /> Compliance Checklist
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">{complianceItems.length} item{complianceItems.length !== 1 ? "s" : ""}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Required documents and tasks each subcontractor must complete. Required items block invoice submission until marked complete.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Checklist Items */}
                {complianceItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No compliance items yet. Add items below to require subs to complete tasks before submitting invoices.</p>
                ) : (
                  <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                    {complianceItems.map(item => (
                      <div key={item.id} className="p-3 bg-card hover:bg-muted/30 transition-colors">
                        {complianceEditId === item.id ? (
                          <div className="space-y-2">
                            <input
                              className="w-full text-sm rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
                              value={complianceEditTitle}
                              onChange={e => setComplianceEditTitle(e.target.value)}
                              placeholder="Item title"
                            />
                            <div className="flex flex-wrap items-center gap-4 text-sm">
                              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                <input type="checkbox" checked={complianceEditRequired} onChange={e => setComplianceEditRequired(e.target.checked)} className="accent-primary h-3.5 w-3.5" />
                                <span className="text-xs font-medium">Required (blocks invoices)</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                <input type="checkbox" checked={complianceEditDocAllowed} onChange={e => setComplianceEditDocAllowed(e.target.checked)} className="accent-primary h-3.5 w-3.5" />
                                <span className="text-xs font-medium">Allow document upload</span>
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" disabled={complianceEditSaving} onClick={() => handleUpdateComplianceItem(item.id)} className="gap-1">
                                {complianceEditSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setComplianceEditId(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2 min-w-0">
                              <SquareCheck className={cn("h-4 w-4 mt-0.5 shrink-0", item.required ? "text-orange-500" : "text-muted-foreground")} />
                              <div className="min-w-0">
                                <p className="text-sm font-medium leading-snug">{item.title}</p>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {item.required ? (
                                    <span className="text-xs font-semibold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 px-1.5 py-0.5 rounded-full">Required</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full border">Optional</span>
                                  )}
                                  {item.allowDocumentUpload && (
                                    <span className="text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded-full">Doc upload</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setComplianceEditId(item.id); setComplianceEditTitle(item.title); setComplianceEditRequired(item.required); setComplianceEditDocAllowed(item.allowDocumentUpload); }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setComplianceDeleteConfirm(item.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new item form */}
                {!isArchived && (
                  <form onSubmit={handleAddComplianceItem} className="flex flex-col gap-2 pt-2 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Item</p>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 text-sm rounded-lg border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="e.g. Submit W-9 form, Upload insurance certificate…"
                        value={newComplianceTitle}
                        onChange={e => setNewComplianceTitle(e.target.value)}
                      />
                      <Button type="submit" size="sm" disabled={newComplianceSaving || !newComplianceTitle.trim()} className="gap-1">
                        {newComplianceSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm">
                        <input type="checkbox" checked={newComplianceRequired} onChange={e => setNewComplianceRequired(e.target.checked)} className="accent-primary h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Required (blocks invoices if incomplete)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none text-sm">
                        <input type="checkbox" checked={newComplianceDocAllowed} onChange={e => setNewComplianceDocAllowed(e.target.checked)} className="accent-primary h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Allow document upload</span>
                      </label>
                    </div>
                  </form>
                )}

                {/* Per-subcontractor compliance summary */}
                {complianceSummary.length > 0 && complianceItems.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Subcontractor Status</p>
                    <div className="space-y-1.5">
                      {complianceSummary.map(row => (
                        <div key={row.subcontractId} className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium truncate">{row.subCompanyName}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">{row.completedRequired}/{row.totalRequired} required</span>
                            {row.status === "FULLY_COMPLIANT" ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-1.5 py-0.5 rounded-full">
                                <CheckCircle2 className="h-3 w-3" /> Fully Compliant
                              </span>
                            ) : row.status === "BLOCKED" ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-1.5 py-0.5 rounded-full">
                                <AlertTriangle className="h-3 w-3" /> Blocked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 px-1.5 py-0.5 rounded-full">
                                <Clock className="h-3 w-3" /> Incomplete
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* COMPLIANCE DELETE CONFIRM */}
          {complianceDeleteConfirm && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setComplianceDeleteConfirm(null)}>
              <div className="bg-card rounded-2xl border shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-base font-bold font-display text-destructive flex items-center gap-2"><Trash2 className="h-4 w-4" /> Remove Compliance Item</h3>
                <p className="text-sm text-muted-foreground">This will remove the item and all completion records. This cannot be undone.</p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setComplianceDeleteConfirm(null)}>Cancel</Button>
                  <Button variant="destructive" className="flex-1" onClick={() => handleDeleteComplianceItem(complianceDeleteConfirm)}>Remove</Button>
                </div>
              </div>
            </div>
          )}

          {/* GC CREDENTIALS SECTION — GC only */}
          {isGC && (() => {
            const insExpired = gcCredentials?.insExpDate ? gcCredDaysUntilExpiry(gcCredentials.insExpDate)! < 0 : false;
            const licExpired = gcCredentials?.licExpDate ? gcCredDaysUntilExpiry(gcCredentials.licExpDate)! < 0 : false;
            const insExpiring = gcCredentials?.insExpDate ? (gcCredDaysUntilExpiry(gcCredentials.insExpDate)! <= 30 && gcCredDaysUntilExpiry(gcCredentials.insExpDate)! >= 0) : false;
            const licExpiring = gcCredentials?.licExpDate ? (gcCredDaysUntilExpiry(gcCredentials.licExpDate)! <= 30 && gcCredDaysUntilExpiry(gcCredentials.licExpDate)! >= 0) : false;
            const credComplete = gcCredentials?.credentialsComplete === true;
            const hasWarning = insExpired || licExpired || insExpiring || licExpiring || !credComplete;
            return (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" /> GC Credentials
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {(insExpired || licExpired) && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-600 px-2.5 py-1 rounded-full">
                          <ShieldX className="h-3.5 w-3.5" /> Credentials Expired
                        </span>
                      )}
                      {!insExpired && !licExpired && (insExpiring || licExpiring) && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-800 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 px-2.5 py-1 rounded-full">
                          <Shield className="h-3.5 w-3.5" /> Expiring Soon
                        </span>
                      )}
                      {!insExpired && !licExpired && !insExpiring && !licExpiring && !credComplete && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted border border-border px-2.5 py-1 rounded-full">
                          <Shield className="h-3.5 w-3.5" /> Credentials Incomplete
                        </span>
                      )}
                      {!hasWarning && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-2.5 py-1 rounded-full">
                          <ShieldCheck className="h-3.5 w-3.5" /> Credentials Complete
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Enter your insurance certificate and contractor license once per project — this information is automatically shown to all subcontractors.</p>
                </CardHeader>
                <CardContent className="space-y-6">

                  {/* SUCCESS BANNER */}
                  {gcCredSaveSuccess && (
                    <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">GC Credentials saved successfully</p>
                    </div>
                  )}

                  {/* INSURANCE CERTIFICATE */}
                  <div className="border border-border rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => setGcCredInsSection(v => !v)}
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-semibold">Insurance Certificate</p>
                          {gcCredentials?.insCompany && <p className="text-xs text-muted-foreground">{gcCredentials.insCompany}{gcCredentials.insExpDate ? ` · Exp: ${gcCredentials.insExpDate}` : ""}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {gcCredBadge(gcCredentials?.insExpDate)}
                        {gcCredInsSection ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>
                    {gcCredInsSection && (
                      <div className="p-4 space-y-4 bg-background">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Insurance Company</label>
                            <Input value={gcCredInsCompany} onChange={e => setGcCredInsCompany(e.target.value)} placeholder="e.g. Travelers, Hartford" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Policy Number</label>
                            <Input value={gcCredInsPolicyNumber} onChange={e => setGcCredInsPolicyNumber(e.target.value)} placeholder="e.g. GL-1234567" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">General Liability Coverage</label>
                            <Input value={gcCredInsGLCoverage} onChange={e => setGcCredInsGLCoverage(e.target.value)} placeholder="e.g. $2,000,000" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Workers Comp Coverage</label>
                            <Input value={gcCredInsWCCoverage} onChange={e => setGcCredInsWCCoverage(e.target.value)} placeholder="e.g. $1,000,000" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Certificate Expiration Date</label>
                            <Input type="date" value={gcCredInsExpDate} onChange={e => setGcCredInsExpDate(e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Certificate (PDF or Image)</label>
                            <div className="flex flex-wrap items-center gap-2">
                              {gcCredInsCertPath ? (
                                <>
                                  <span className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 font-medium">
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                    {gcCredInsCertFileName ?? "Certificate on file"}
                                  </span>
                                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handleDownloadGcDoc("cert")}>
                                    <Download className="h-3.5 w-3.5" /> Download
                                  </Button>
                                  <label className="cursor-pointer">
                                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs pointer-events-none" disabled={gcInsCertUploading}>
                                      {gcInsCertUploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...</> : <><Upload className="h-3.5 w-3.5" /> Replace</>}
                                    </Button>
                                    <input type="file" accept="image/*,.pdf" className="hidden" disabled={gcInsCertUploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadGcInsCert(f); e.target.value = ""; }} />
                                  </label>
                                </>
                              ) : (
                                <label className="cursor-pointer">
                                  <Button variant="outline" size="sm" className="gap-1.5 text-xs pointer-events-none" disabled={gcInsCertUploading}>
                                    {gcInsCertUploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...</> : <><Upload className="h-3.5 w-3.5" /> Upload Certificate</>}
                                  </Button>
                                  <input type="file" accept="image/*,.pdf" className="hidden" disabled={gcInsCertUploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadGcInsCert(f); e.target.value = ""; }} />
                                </label>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CONTRACTOR LICENSE */}
                  <div className="border border-border rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => setGcCredLicSection(v => !v)}
                    >
                      <div className="flex items-center gap-3">
                        <BadgeCheck className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-semibold">Contractor License</p>
                          {gcCredentials?.licNumber && <p className="text-xs text-muted-foreground">#{gcCredentials.licNumber}{gcCredentials.licState ? ` · ${gcCredentials.licState}` : ""}{gcCredentials.licExpDate ? ` · Exp: ${gcCredentials.licExpDate}` : ""}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {gcCredBadge(gcCredentials?.licExpDate)}
                        {gcCredLicSection ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>
                    {gcCredLicSection && (
                      <div className="p-4 space-y-4 bg-background">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">License Number</label>
                            <Input value={gcCredLicNumber} onChange={e => setGcCredLicNumber(e.target.value)} placeholder="e.g. B-123456" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">License Type</label>
                            <Input value={gcCredLicType} onChange={e => setGcCredLicType(e.target.value)} placeholder="e.g. General B, Electrical C-10" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Issuing State</label>
                            <Input value={gcCredLicState} onChange={e => setGcCredLicState(e.target.value)} placeholder="e.g. CA, TX, NY" maxLength={2} />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Expiration Date</label>
                            <Input type="date" value={gcCredLicExpDate} onChange={e => setGcCredLicExpDate(e.target.value)} />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-xs font-medium text-muted-foreground block mb-1">License Document — optional (PDF or Image)</label>
                            <div className="flex flex-wrap items-center gap-2">
                              {gcCredLicDocPath ? (
                                <>
                                  <span className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 font-medium">
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                    {gcCredLicDocFileName ?? "License document on file"}
                                  </span>
                                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handleDownloadGcDoc("license")}>
                                    <Download className="h-3.5 w-3.5" /> Download
                                  </Button>
                                  <label className="cursor-pointer">
                                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs pointer-events-none" disabled={gcLicDocUploading}>
                                      {gcLicDocUploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...</> : <><Upload className="h-3.5 w-3.5" /> Replace</>}
                                    </Button>
                                    <input type="file" accept="image/*,.pdf" className="hidden" disabled={gcLicDocUploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadGcLicDoc(f); e.target.value = ""; }} />
                                  </label>
                                </>
                              ) : (
                                <label className="cursor-pointer">
                                  <Button variant="outline" size="sm" className="gap-1.5 text-xs pointer-events-none" disabled={gcLicDocUploading}>
                                    {gcLicDocUploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...</> : <><Upload className="h-3.5 w-3.5" /> Upload License Doc</>}
                                  </Button>
                                  <input type="file" accept="image/*,.pdf" className="hidden" disabled={gcLicDocUploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadGcLicDoc(f); e.target.value = ""; }} />
                                </label>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-1 flex-wrap">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 max-w-sm">
                      <Shield className="h-3.5 w-3.5 shrink-0 text-primary" />
                      This information appears automatically on all subcontractor dashboards for this project. Keep it current so your subs always have your valid credentials on file.
                    </p>
                    <Button onClick={handleSaveGcCredentials} disabled={gcCredSaving} className="gap-2 shrink-0">
                      {gcCredSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save Credentials</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* SUBCONTRACTS SECTION */}
          {(isGC || project.subcontracts?.some(s => s.subId === user.id)) && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <FileSignature className="h-5 w-5 text-primary" /> Active Subcontracts
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isGC && (project.subcontracts?.length ?? 0) > 0 && (
                      <select
                        className="text-sm rounded-xl border border-border bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[160px]"
                        value={tradeFilter}
                        onChange={(e) => setTradeFilter(e.target.value)}
                      >
                        <option value="">All Trades</option>
                        {TRADE_CATEGORIES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    )}
                    {isGC && !isArchived && (project.subcontracts?.length ?? 0) > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setIsBulkCOOpen(true); setSelectedSubIds(new Set()); setSubAmounts({}); setBulkCODescription(""); setBulkCOScope(""); }}
                        className="gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" /> Create Change Order
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {(project.subcontracts?.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground py-6 px-6">No subcontracts awarded yet.</p>
                ) : (() => {
                  const visible = (project.subcontracts?.filter(s => isGC || s.subId === user.id) ?? [])
                    .filter(s => !tradeFilter || (s as any).tradeCategory === tradeFilter);
                  if (visible.length === 0) {
                    return <p className="text-muted-foreground py-6 px-6">No subcontracts match the selected trade filter.</p>;
                  }
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
                    <div className="p-4 sm:p-6 space-y-4">
                      {/* Card grid — 1 col mobile, 2 col desktop */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {visible.map(sub => {
                          const sb = sub.scoreboard;
                          const remaining = sb?.remaining ?? sub.baseContractAmount;
                          const hasFlagged = (sb as any)?.hasFlaggedInvoices as boolean | undefined;
                          const insInfo = projectInsurance.find(i => i.subcontractId === sub.id);
                          const licInfo = projectLicenses.find(l => l.subcontractId === sub.id);
                          const compRow = complianceSummary.find(c => c.subcontractId === sub.id);
                          const complianceIncomplete = compRow && compRow.status !== "FULLY_COMPLIANT";
                          return (
                            <Link key={sub.id} href={`/subcontracts/${sub.id}`} className="block">
                              <div className="relative flex flex-col rounded-xl border border-border bg-white dark:bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer min-h-[160px] overflow-hidden group">
                                {/* Card body */}
                                <div className="flex-1 p-4">
                                  {/* Company name + unread badge */}
                                  <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <span className="font-bold text-base leading-tight group-hover:text-primary transition-colors">{sub.sub?.companyName}</span>
                                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                                    {isGC && (sub as any).hasPendingCOForGC && (
                                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 rounded-full shrink-0">
                                        <AlertTriangle className="h-2.5 w-2.5" /> CO Needs Approval
                                      </span>
                                    )}
                                    {!isGC && (sub as any).hasPendingCOForSub && (
                                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 rounded-full shrink-0">
                                        <AlertTriangle className="h-2.5 w-2.5" /> New Change Order
                                      </span>
                                    )}
                                    {((sub as any).unreadCommentCount ?? 0) > 0 && (
                                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded-full shrink-0">
                                        <MessageSquare className="h-2.5 w-2.5" /> {(sub as any).unreadCommentCount}
                                      </span>
                                    )}
                                    </div>
                                  </div>

                                  {/* Trade + Insurance + License badges */}
                                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                                    {(sub as any).tradeCategory && (
                                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${TRADE_COLORS[(sub as any).tradeCategory] ?? TRADE_COLORS.Other}`}>
                                        {(sub as any).tradeCategory}
                                      </span>
                                    )}
                                    {isGC && (!insInfo || insInfo.status === "NO_INSURANCE" ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded-full">
                                        <Shield className="h-3 w-3" /> Ins: None
                                      </span>
                                    ) : insInfo.status === "VALID" ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-1.5 py-0.5 rounded-full">
                                        <ShieldCheck className="h-3 w-3" /> Ins: Valid
                                      </span>
                                    ) : insInfo.status === "EXPIRING_SOON" ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 px-1.5 py-0.5 rounded-full">
                                        <Shield className="h-3 w-3" /> Ins: Expiring
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-1.5 py-0.5 rounded-full">
                                        <ShieldX className="h-3 w-3" /> Ins: Expired
                                      </span>
                                    ))}
                                    {isGC && (!licInfo || licInfo.status === "NO_LICENSE" ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded-full">
                                        <BadgeCheck className="h-3 w-3" /> Lic: None
                                      </span>
                                    ) : licInfo.status === "VALID" ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded-full">
                                        <BadgeCheck className="h-3 w-3" /> Lic: Valid
                                      </span>
                                    ) : licInfo.status === "EXPIRING_SOON" ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 px-1.5 py-0.5 rounded-full">
                                        <BadgeCheck className="h-3 w-3" /> Lic: Expiring
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-1.5 py-0.5 rounded-full">
                                        <BadgeCheck className="h-3 w-3" /> Lic: Expired
                                      </span>
                                    ))}
                                  </div>

                                  {/* Financial 2×2 grid */}
                                  {perms.hasFinancialAccess ? (
                                    <>
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-2">
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-0.5">Base Contract</p>
                                          <p className="font-mono text-sm">{formatCurrency(sb?.base ?? sub.baseContractAmount)}</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-xs text-muted-foreground mb-0.5">Change Orders</p>
                                          <p className="font-mono text-sm text-muted-foreground">{formatCurrency(sb?.coTotal ?? 0)}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-0.5">Approved Total</p>
                                          <p className="font-mono text-sm font-bold">{formatCurrency(sb?.currentApprovedTotal ?? sub.baseContractAmount)}</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-xs text-muted-foreground mb-0.5">Remaining Balance</p>
                                          <p className={cn("font-mono text-sm font-bold", remaining >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                            {formatCurrency(remaining)}
                                          </p>
                                        </div>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        Invoiced: <span className="font-mono">{formatCurrency(sb?.invoicedTotal ?? 0)}</span>
                                      </p>
                                    </>
                                  ) : (
                                    <p className="text-xs text-muted-foreground mt-1">Financial details restricted</p>
                                  )}
                                </div>

                                {/* Warning banners — stacked at bottom */}
                                {hasFlagged && (
                                  <div className="bg-red-600 text-white text-xs font-bold px-4 py-2 flex items-center gap-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Invoice Needs Review
                                  </div>
                                )}
                                {complianceIncomplete && (
                                  <div className="bg-yellow-400 dark:bg-yellow-500 text-yellow-950 text-xs font-bold px-4 py-2 flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5 shrink-0" /> Compliance Incomplete
                                  </div>
                                )}
                              </div>
                            </Link>
                          );
                        })}
                      </div>

                      {/* Totals bar */}
                      {visible.length > 1 && (
                        <div className="rounded-xl border border-border bg-muted/50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Totals — {visible.length} Subcontracts</p>
                          {perms.hasFinancialAccess ? (
                            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">Base Contracts</p>
                                <p className="font-mono font-semibold">{formatCurrency(totals.base)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Change Orders</p>
                                <p className="font-mono text-muted-foreground">{formatCurrency(totals.coTotal)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Approved Total</p>
                                <p className="font-mono font-bold">{formatCurrency(totals.approved)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Total Invoiced</p>
                                <p className="font-mono">{formatCurrency(totals.invoiced)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Remaining Balance</p>
                                <p className={cn("font-mono font-bold", totals.remaining >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                  {formatCurrency(totals.remaining)}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Financial details restricted</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* LIEN WAIVERS SECTION */}
          {(isGC || lienWaivers.length > 0) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Stamp className="h-5 w-5 text-primary" /> Lien Waivers
                    {lienWaivers.length > 0 && (
                      <span className="ml-1 text-sm font-normal text-muted-foreground">({lienWaivers.length})</span>
                    )}
                  </CardTitle>
                  {isGC && lienWaivers.length > 0 && (
                    <a
                      href={`${BASE}/api/projects/${projectId}/lien-waivers/zip`}
                      download
                      className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Download className="h-4 w-4" /> Download All (ZIP)
                    </a>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {lienWaiversLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : lienWaivers.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-6 px-6">No signed lien waivers yet. They will appear here once subcontractors confirm payment.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          {isGC && <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Subcontractor</th>}
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Invoice #</th>
                          <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Amount</th>
                          <th className="hidden sm:table-cell text-left px-4 py-3 font-semibold text-muted-foreground">Signed By</th>
                          <th className="hidden md:table-cell text-left px-4 py-3 font-semibold text-muted-foreground">Signed Date</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {lienWaivers.map((waiver: any) => (
                          <tr key={waiver.id} className="hover:bg-muted/30 transition-colors bg-green-50/30 dark:bg-green-950/10">
                            {isGC && (
                              <td className="px-4 py-3">
                                <p className="font-semibold">{waiver.subCompanyName}</p>
                              </td>
                            )}
                            <td className="px-4 py-3">
                              <span className="font-mono font-semibold">#{waiver.invoiceNumber}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold">{formatCurrency(waiver.amount)}</td>
                            <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground italic">{waiver.signedByName}</td>
                            <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">
                              {format(new Date(waiver.signedAt), "MMM d, yyyy")}
                            </td>
                            <td className="px-4 py-3">
                              <a
                                href={`${BASE}/api/subcontracts/${waiver.subcontractId}/invoices/${waiver.invoiceId}/lien-waiver/pdf`}
                                download={`LienWaiver-${waiver.invoiceNumber}.pdf`}
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                title="Download Lien Waiver PDF"
                              >
                                <FileDown className="h-4 w-4" />
                                <span className="hidden sm:inline">PDF</span>
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* CHANGE ORDER LOG SECTION (GC only) */}
          {isGC && projectCOs.length > 0 && (
            <>
              {/* Pending COs alert card */}
              {pendingCOs.length > 0 && (
                <Card className="border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                      <Clock className="h-5 w-5" />
                      Pending Change Orders ({pendingCOs.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-amber-200 dark:divide-amber-800">
                      {pendingCOs.map(co => (
                        <div key={co.id} className="px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{co.subCompanyName}</p>
                            <p className="text-sm text-muted-foreground truncate">{co.description}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono font-semibold text-amber-800 dark:text-amber-300">{formatCurrency(co.amount)}</span>
                            <Badge variant="warning" className="text-xs">{co.status === "PENDING_GC" ? "Awaiting GC" : "Awaiting Sub"}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Full CO Log table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    Change Order Log ({projectCOs.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">Sub</th>
                          <th className="hidden sm:table-cell px-4 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">Description</th>
                          <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">Amount</th>
                          <th className="hidden md:table-cell px-4 py-2.5 text-center font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                          <th className="hidden lg:table-cell px-4 py-2.5 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {projectCOs.map(co => (
                          <tr key={co.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-semibold">{co.subCompanyName}</p>
                              {co.tradeCategory && <p className="text-xs text-muted-foreground">{co.tradeCategory}</p>}
                              <p className="sm:hidden text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">{co.description}</p>
                            </td>
                            <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground max-w-[220px]">
                              <p className="truncate">{co.description}</p>
                              {co.scope && <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{co.scope}</p>}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold">{formatCurrency(co.amount)}</td>
                            <td className="hidden md:table-cell px-4 py-3 text-center">
                              <Badge variant={
                                co.status === "APPROVED" ? "success" :
                                co.status === "REJECTED" ? "destructive" :
                                co.status === "PENDING_GC" || co.status === "PENDING_SUB" ? "warning" : "secondary"
                              } className="text-xs whitespace-nowrap">
                                {co.status === "PENDING_GC" ? "Awaiting GC" :
                                 co.status === "PENDING_SUB" ? "Awaiting Sub" :
                                 co.status}
                              </Badge>
                            </td>
                            <td className="hidden lg:table-cell px-4 py-3 text-right text-muted-foreground text-xs">
                              {format(new Date(co.createdAt), "MMM d, yyyy")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {projectCOs.length > 1 && (
                        <tfoot>
                          <tr className="border-t-2 border-border bg-muted/50 font-bold">
                            <td className="px-4 py-3 text-sm uppercase tracking-wider text-muted-foreground" colSpan={2}>Total ({projectCOs.length} COs)</td>
                            <td className="px-4 py-3 text-right font-mono">
                              {formatCurrency(projectCOs.reduce((s, co) => s + (co.amount ?? 0), 0))}
                            </td>
                            <td className="hidden md:table-cell"></td>
                            <td className="hidden lg:table-cell"></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* TRADE SCOPES SECTION — visible in BIDDING phase */}
          {project.status === "BIDDING" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    {isGC ? "Trade Scopes of Work" : myTradeCategory ? `Scope of Work — ${myTradeCategory}` : "Scope of Work"}
                  </CardTitle>
                  {isGC && !scopeEditTrade && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 min-h-[36px]"
                      onClick={() => {
                        const usedTrades = new Set(tradeScopes.map(s => s.tradeCategory));
                        const next = TRADE_CATEGORIES.find(t => !usedTrades.has(t)) ?? TRADE_CATEGORIES[0];
                        setScopeEditTrade(next);
                        setScopeEditText(DEFAULT_SCOPE_TEMPLATES[next] ?? "");
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Trade Scope
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* GC: Add/Edit form */}
                {isGC && scopeEditTrade && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-semibold">Trade</label>
                        <select
                          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          value={scopeEditTrade}
                          onChange={e => {
                            const t = e.target.value;
                            setScopeEditTrade(t);
                            const existing = tradeScopes.find(s => s.tradeCategory === t);
                            if (existing) {
                              setScopeEditText(existing.description);
                            } else {
                              setScopeEditText(DEFAULT_SCOPE_TEMPLATES[t] ?? "");
                            }
                          }}
                        >
                          {TRADE_CATEGORIES.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        {tradeScopes.find(s => s.tradeCategory === scopeEditTrade)?.isLocked && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                            <Lock className="h-3 w-3" /> Locked — pending bids exist
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {/* Use Template dropdown */}
                        {(scopeTemplates.filter(t => t.tradeCategory === scopeEditTrade).length > 0 || DEFAULT_SCOPE_TEMPLATES[scopeEditTrade]) && (
                          <div className="relative group">
                            <Button size="sm" variant="outline" className="gap-1.5 text-xs min-h-[32px]">
                              <FileText className="h-3 w-3" /> Use Template
                            </Button>
                            <div className="hidden group-hover:block absolute top-full right-0 mt-1 z-50 bg-popover border border-border rounded-xl shadow-lg min-w-[220px] py-1">
                              {scopeTemplates.filter(t => t.tradeCategory === scopeEditTrade).map(tpl => (
                                <button
                                  key={tpl.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between gap-2"
                                  onClick={() => setScopeEditText(tpl.description)}
                                >
                                  <span className="truncate">{tpl.name}</span>
                                  <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); handleDeleteScopeTemplate(tpl.id); }}
                                    className="text-muted-foreground hover:text-destructive shrink-0"
                                  ><Trash2 className="h-3 w-3" /></button>
                                </button>
                              ))}
                              {DEFAULT_SCOPE_TEMPLATES[scopeEditTrade] && (
                                <button
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-muted-foreground"
                                  onClick={() => setScopeEditText(DEFAULT_SCOPE_TEMPLATES[scopeEditTrade] ?? "")}
                                >
                                  Standard {scopeEditTrade} template
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs min-h-[32px]"
                          onClick={() => { setScopeEditTrade(""); setScopeEditText(""); setScopeSaveTemplateOpen(false); setScopeTemplateName(""); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                    <textarea
                      className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none min-h-[160px]"
                      placeholder="Describe the complete scope of work for this trade — what is and isn't included, quality standards, code references, special requirements…"
                      value={scopeEditText}
                      onChange={e => setScopeEditText(e.target.value)}
                      disabled={tradeScopes.find(s => s.tradeCategory === scopeEditTrade)?.isLocked}
                    />
                    {/* Save as Template inline form */}
                    {scopeSaveTemplateOpen ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input
                          className="flex-1 min-w-[180px] h-8 text-sm"
                          placeholder="Template name (e.g. Standard Electrical SOW)"
                          value={scopeTemplateName}
                          onChange={e => setScopeTemplateName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSaveScopeTemplate(); } }}
                        />
                        <Button size="sm" className="h-8 text-xs gap-1" isLoading={scopeTemplateSaving} onClick={handleSaveScopeTemplate}>
                          <Save className="h-3 w-3" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setScopeSaveTemplateOpen(false); setScopeTemplateName(""); }}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 font-medium"
                          onClick={() => setScopeSaveTemplateOpen(true)}
                        >
                          <Save className="h-3 w-3" /> Save as my template
                        </button>
                        <Button
                          size="sm"
                          className="gap-1.5 bg-green-600 hover:bg-green-700 text-white min-h-[36px]"
                          onClick={handleSaveTradeScope}
                          isLoading={scopeSaving}
                          disabled={!scopeEditText.trim() || tradeScopes.find(s => s.tradeCategory === scopeEditTrade)?.isLocked}
                        >
                          <Save className="h-3.5 w-3.5" /> Save Scope
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* GC: List of saved scopes */}
                {isGC && tradeScopes.length === 0 && !scopeEditTrade && (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No trade scopes defined yet</p>
                    <p className="text-xs mt-1">Define scopes per trade so subs know exactly what to bid on. Subs must acknowledge before submitting a bid.</p>
                  </div>
                )}
                {isGC && tradeScopes.length > 0 && (
                  <div className="space-y-3">
                    {tradeScopes.map(scope => {
                      const isEditing = scopeEditTrade === scope.tradeCategory;
                      if (isEditing) return null;
                      return (
                        <div key={scope.id} className="rounded-xl border border-border bg-secondary/40 p-4">
                          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs font-semibold border px-2 py-0.5 rounded-full", TRADE_COLORS[scope.tradeCategory] ?? TRADE_COLORS.Other)}>
                                {scope.tradeCategory}
                              </span>
                              {scope.isLocked && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                                  <Lock className="h-3 w-3" /> Locked
                                </span>
                              )}
                            </div>
                            {!scopeEditTrade && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs gap-1"
                                  disabled={scope.isLocked}
                                  onClick={() => { setScopeEditTrade(scope.tradeCategory); setScopeEditText(scope.description); }}
                                >
                                  <Pencil className="h-3 w-3" /> Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-destructive hover:text-destructive gap-1"
                                  disabled={scope.isLocked}
                                  onClick={() => setScopeDeleteConfirm(scope.tradeCategory)}
                                >
                                  <Trash2 className="h-3 w-3" /> Delete
                                </Button>
                              </div>
                            )}
                          </div>
                          {scopeDeleteConfirm === scope.tradeCategory ? (
                            <div className="flex items-center gap-3 mt-2">
                              <p className="text-sm text-muted-foreground flex-1">Delete this scope? This cannot be undone.</p>
                              <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleDeleteTradeScope(scope.tradeCategory)}>Delete</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setScopeDeleteConfirm(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{scope.description}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* SUB: Show the scope for their trade */}
                {!isGC && myTradeCategory && myTradeScope && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <ClipboardList className="h-4 w-4 text-green-700 dark:text-green-400 shrink-0" />
                        <p className="text-sm font-bold text-green-800 dark:text-green-300">GC's Scope of Work for {myTradeCategory}</p>
                        {myTradeScope.isLocked && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                            <Lock className="h-3 w-3" /> Locked for bidding
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-green-900 dark:text-green-200 leading-relaxed whitespace-pre-line">{myTradeScope.description}</p>
                    </div>
                    {myBid ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                        <p className="text-xs font-medium text-muted-foreground">You acknowledged this scope before submitting your bid.</p>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Read and acknowledge this scope before submitting your bid below.</p>
                      </div>
                    )}
                  </div>
                )}
                {!isGC && myTradeCategory && !myTradeScope && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    The GC hasn't defined a scope for <strong>{myTradeCategory}</strong> yet. Check back before bidding.
                  </p>
                )}
                {!isGC && !myTradeCategory && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    You haven't been assigned a trade category for this project. Contact the GC for details.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI BID BENCHMARKS — GC only, shown in BIDDING phase as live panel; archived in CONSTRUCTION+ */}
          {isGC && project.status === "BIDDING" && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle className="flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-primary" />
                    AI Bid Benchmarks
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {(project as any).aiAnalysisAt && (
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        Last run {format(new Date((project as any).aiAnalysisAt), "MMM d, yyyy h:mm a")}
                      </span>
                    )}
                    <Button
                      variant={(project as any).aiAnalysis ? "outline" : "default"}
                      size="sm"
                      className="gap-1.5 min-h-[36px]"
                      onClick={handleRunAiAnalysis}
                      disabled={aiAnalyzing || !planFiles.length}
                    >
                      {aiAnalyzing ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</>
                      ) : (project as any).aiAnalysis ? (
                        <><RefreshCw className="h-4 w-4" /> Re-analyze</>
                      ) : (
                        <><BrainCircuit className="h-4 w-4" /> Run AI Analysis</>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!planFiles.length ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
                    <BrainCircuit className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-muted-foreground">Upload plan files to run AI analysis</p>
                    <p className="text-xs text-muted-foreground mt-1">AI will analyze your plans and generate trade-by-trade bid benchmarks.</p>
                  </div>
                ) : aiAnalyzing ? (
                  <div className="py-8 flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-semibold text-muted-foreground">Analyzing plan files…</p>
                    <p className="text-xs text-muted-foreground">This may take up to 60 seconds</p>
                  </div>
                ) : !(project as any).aiAnalysis ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
                    <BrainCircuit className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-muted-foreground">No analysis yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Click <strong>Run AI Analysis</strong> to generate trade-by-trade bid ranges from your {planFiles.length} plan {planFiles.length === 1 ? "file" : "files"}.</p>
                    <p className="text-xs text-muted-foreground mt-1">Labor type: <strong>{(project as any).laborType === "union" ? "Union Prevailing Wage" : "Non-Union Open Shop"}</strong></p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      AI-generated estimates based on {planFiles.length} plan {planFiles.length === 1 ? "file" : "files"} · {(project as any).laborType === "union" ? "Union Prevailing Wage" : "Non-Union Open Shop"} labor · Visible to GC team only
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {((project as any).aiAnalysis as Array<{ trade: string; lowEstimate: number; highEstimate: number; costDrivers: string; rangeFactors: string }>).map((item) => {
                        const feedback = (project as any).aiAnalysisFeedback as Record<string, { helpful: boolean; reason?: string }> | null;
                        const tradeFeedback = feedback?.[item.trade];
                        const bidsForTrade = project.bids?.filter(b => (b.tradeCategory ?? "").toLowerCase() === item.trade.toLowerCase()) ?? [];
                        const isExpanded = aiExpandedTrades.has(item.trade);
                        return (
                          <div key={item.trade} className="rounded-xl border border-border bg-secondary/30 min-w-0 overflow-hidden">
                            {/* Always-visible header row — clickable to expand */}
                            <button
                              className="w-full text-left px-4 pt-3 pb-3"
                              onClick={() => toggleAiTrade(item.trade)}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                                <div className="font-semibold text-sm flex items-center gap-1">
                                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                  {item.trade}
                                </div>
                                <div className="font-bold text-sm text-primary font-mono whitespace-nowrap">
                                  {formatCurrency(item.lowEstimate)} – {formatCurrency(item.highEstimate)}
                                </div>
                              </div>
                              {/* Bid status indicators — always visible */}
                              {bidsForTrade.length > 0 && (
                                <div className="space-y-1 mt-2">
                                  {bidsForTrade.map(bid => {
                                    const status = bid.amount > item.highEstimate * 1.15 ? "above" : bid.amount < item.lowEstimate * 0.85 ? "below" : "within";
                                    return (
                                      <div key={bid.id} className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">{bid.sub?.companyName}</span>
                                        <span className="text-xs font-mono font-semibold">{formatCurrency(bid.amount)}</span>
                                        <div className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
                                          status === "within" ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" :
                                          "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-500"
                                        )}>
                                          {status === "within" ? <CheckCircle2 className="h-3 w-3" /> : status === "above" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                          {status === "within" ? "Within range" : status === "above" ? "Above range" : "Below range"}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </button>
                            {/* Collapsible detail text + feedback */}
                            {isExpanded && (
                              <div className="px-4 pb-3 space-y-2 border-t border-border/50 pt-2">
                                <p className="text-xs text-muted-foreground leading-relaxed">{item.costDrivers}</p>
                                {item.rangeFactors && (
                                  <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">{item.rangeFactors}</p>
                                )}
                                <div className="flex items-center pt-1">
                                  {tradeFeedback ? (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      {tradeFeedback.helpful ? <ThumbsUp className="h-3 w-3 text-green-500" /> : <ThumbsDown className="h-3 w-3 text-amber-500" />}
                                      {tradeFeedback.helpful ? "Marked helpful" : "Marked not helpful"}
                                    </span>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-muted-foreground">Helpful?</span>
                                      <button
                                        className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors"
                                        title="Mark helpful"
                                        onClick={() => handleAiFeedback(item.trade, true)}
                                        disabled={aiFeedbackSaving[item.trade]}
                                      >
                                        {aiFeedbackSaving[item.trade] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5 text-muted-foreground" />}
                                      </button>
                                      <div className="relative">
                                        <button
                                          className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors"
                                          title="Mark not helpful"
                                          onClick={() => setAiFeedbackDropdown(prev => ({ ...prev, [item.trade]: !prev[item.trade] }))}
                                          disabled={aiFeedbackSaving[item.trade]}
                                        >
                                          <ThumbsDown className="h-3.5 w-3.5 text-muted-foreground" />
                                        </button>
                                        {aiFeedbackDropdown[item.trade] && (
                                          <div className="absolute left-0 top-8 z-20 w-48 max-w-[calc(100vw-2rem)] bg-popover border border-border rounded-xl shadow-lg p-2 space-y-1">
                                            <p className="text-xs font-semibold text-muted-foreground px-2 pb-1">Why wasn't this helpful?</p>
                                            {["Range too wide", "Range too narrow", "Wrong trade", "Inaccurate for my market", "Other"].map(reason => (
                                              <button
                                                key={reason}
                                                className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-muted transition-colors"
                                                onClick={() => handleAiFeedback(item.trade, false, reason)}
                                              >
                                                {reason}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI BID BENCHMARKS ARCHIVED — CONSTRUCTION phase, read-only collapsed */}
          {isGC && project.status === "CONSTRUCTION" && (project as any).aiAnalysis && (
            <Card className="border-blue-200 dark:border-blue-800">
              <button
                className="w-full text-left"
                onClick={() => setAiArchiveExpanded(e => !e)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-base leading-snug">
                      <BrainCircuit className="h-5 w-5 shrink-0" />
                      <span>AI Bid Benchmarks<span className="hidden sm:inline"> (Archived)</span></span>
                    </CardTitle>
                    <div className="flex items-center gap-2 shrink-0">
                      {(project as any).aiAnalysisAt && (
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          {format(new Date((project as any).aiAnalysisAt), "MMM d, yyyy")}
                        </span>
                      )}
                      <Badge variant="secondary" className="text-xs">Archived</Badge>
                      {aiArchiveExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                </CardHeader>
              </button>
              {aiArchiveExpanded && (
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Historical AI estimates from the bidding phase. These ranges are archived and cannot be regenerated while the project is in construction.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {((project as any).aiAnalysis as Array<{ trade: string; lowEstimate: number; highEstimate: number; costDrivers: string; rangeFactors: string }>).map((item) => {
                        const archKey = `arch:${item.trade}`;
                        const isArchExpanded = aiExpandedTrades.has(archKey);
                        return (
                          <div key={item.trade} className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10 min-w-0 overflow-hidden">
                            <button
                              className="w-full text-left px-4 py-3"
                              onClick={() => toggleAiTrade(archKey)}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                                <div className="font-semibold text-sm flex items-center gap-1">
                                  {isArchExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                  {item.trade}
                                </div>
                                <div className="font-bold text-sm text-blue-700 dark:text-blue-400 font-mono whitespace-nowrap">
                                  {formatCurrency(item.lowEstimate)} – {formatCurrency(item.highEstimate)}
                                </div>
                              </div>
                            </button>
                            {isArchExpanded && (
                              <div className="px-4 pb-3 space-y-2 border-t border-blue-200/50 dark:border-blue-800/50 pt-2">
                                <p className="text-xs text-muted-foreground leading-relaxed">{item.costDrivers}</p>
                                {item.rangeFactors && (
                                  <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">{item.rangeFactors}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* BIDS SECTION */}
          {(isGC || project.status === "BIDDING" || myBid) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    {isGC ? "Bids" : myBid ? "Your Bid" : "Submit Your Bid"}
                  </CardTitle>
                  {isGC && (project.bids?.filter(b => b.status !== "REJECTED").length ?? 0) >= 2 && (
                    <Link href={`/projects/${projectId}/bid-comparison`}>
                      <Button variant="outline" size="sm" className="gap-1.5 min-h-[36px]">
                        <Scale className="h-4 w-4" /> Compare Bids
                      </Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isGC ? (
                  (project.bids?.length ?? 0) === 0 ? (
                    <div className="py-4 text-center space-y-1">
                      <p className="text-muted-foreground">No bids received yet.</p>
                      {project.status === "BIDDING" && (
                        <p className="text-xs text-muted-foreground">Invited subs will submit their own bid amounts — you review and accept the one you want.</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {project.bids?.map(bid => {
                        const bidSubViews = allPlanViews.filter(v => v.subId === bid.subId);
                        const bidViewedFileIds = new Set(bidSubViews.map(v => v.planFileId));
                        const allPlansReviewed = planFiles.length > 0 && planFiles.every(p => bidViewedFileIds.has(p.id));
                        const somePlansReviewed = planFiles.length > 0 && bidSubViews.length > 0 && !allPlansReviewed;
                        return (
                        <div key={bid.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-secondary/50 border border-border gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="font-bold">{bid.sub?.companyName}</p>
                              <Badge variant={
                                bid.status === "AWARDED" ? "success" :
                                bid.status === "REJECTED" ? "destructive" : "warning"
                              }>{bid.status}</Badge>
                              {allPlansReviewed && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                                  <BadgeCheck className="h-3 w-3" /> Plans Reviewed
                                </span>
                              )}
                              {somePlansReviewed && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                                  <Eye className="h-3 w-3" /> {bidSubViews.length}/{planFiles.length} Plans Downloaded
                                </span>
                              )}
                              {planFiles.length > 0 && bidSubViews.length === 0 && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
                                  <AlertTriangle className="h-3 w-3" /> No Plans Downloaded
                                </span>
                              )}
                            </div>
                            <p className="text-2xl font-bold font-display text-primary">{formatCurrency(bid.amount)}</p>
                            {bid.notes && (
                              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{bid.notes}</p>
                            )}
                            {bid.scopeOfWorkObjectPath && (
                              <a
                                href={`${BASE}/api/storage${bid.scopeOfWorkObjectPath}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline mt-2"
                              >
                                <FileText className="h-4 w-4" /> View Scope of Work
                              </a>
                            )}
                          </div>
                          {bid.status === "PENDING" && project.status === "BIDDING" && (
                            <Button
                              onClick={() => setAwardBidConfirm({ open: true, id: bid.id, company: bid.sub?.companyName ?? "this subcontractor", amount: bid.amount })}
                              className="bg-green-600 hover:bg-green-700 text-white shadow-green-600/20 shrink-0"
                            >
                              <Award className="h-4 w-4 mr-2" /> Accept Bid
                            </Button>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  )
                ) : !myBid ? (
                  <form onSubmit={handleBidSubmit} className="space-y-5">
                    <p className="text-sm text-muted-foreground">Submit your proposed bid for this project. You may only submit one bid per project.</p>

                    {/* SCOPE DOCUMENTS — quick access for subs while filling in their bid */}
                    {scopeDocs.length > 0 && (
                      <div className="rounded-xl border border-border bg-muted/30 p-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                          <ClipboardList className="h-3.5 w-3.5" /> Scope of Work Documents
                        </p>
                        <ul className="space-y-1.5">
                          {scopeDocs.map(doc => (
                            <li key={doc.id}>
                              {doc.objectPath ? (
                                <a
                                  href={`${BASE_URL}/api/storage${doc.objectPath}`}
                                  download={doc.fileName}
                                  className="flex items-center gap-2 text-xs font-medium text-primary hover:underline"
                                >
                                  <Download className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{doc.fileName}</span>
                                  {doc.fileSize && <span className="text-muted-foreground shrink-0">{formatFileSize(doc.fileSize)}</span>}
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">{doc.fileName}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* PLAN FILE REVIEW STATUS — shown in bid form so subs know what they've downloaded */}
                    {planFiles.length > 0 && (
                      <div className={cn(
                        "rounded-xl border p-4",
                        viewedPlanFileIds.size === planFiles.length
                          ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                          : viewedPlanFileIds.size > 0
                          ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                          : "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
                      )}>
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className={cn(
                            "h-4 w-4 shrink-0",
                            viewedPlanFileIds.size === planFiles.length ? "text-green-600 dark:text-green-400"
                              : viewedPlanFileIds.size > 0 ? "text-amber-600 dark:text-amber-400"
                              : "text-orange-600 dark:text-orange-400"
                          )} />
                          <p className={cn(
                            "text-sm font-semibold",
                            viewedPlanFileIds.size === planFiles.length ? "text-green-800 dark:text-green-300"
                              : viewedPlanFileIds.size > 0 ? "text-amber-800 dark:text-amber-300"
                              : "text-orange-800 dark:text-orange-300"
                          )}>
                            {viewedPlanFileIds.size === planFiles.length
                              ? "All plan files downloaded — your review is on record"
                              : viewedPlanFileIds.size > 0
                              ? `${viewedPlanFileIds.size} of ${planFiles.length} plan files downloaded`
                              : "No plan files downloaded yet — review plans before bidding"}
                          </p>
                        </div>
                        <ul className="space-y-1">
                          {planFiles.map(p => (
                            <li key={p.id} className="flex items-center gap-2 text-xs">
                              {viewedPlanFileIds.has(p.id)
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                                : <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                              <span className={viewedPlanFileIds.has(p.id) ? "text-green-800 dark:text-green-300" : "text-orange-800 dark:text-orange-300"}>
                                {p.description || p.fileName}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* SCOPE ACKNOWLEDGMENT — required if the GC has defined a scope for this sub's trade */}
                    {myTradeScope && (
                      <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border bg-muted/40 p-4 hover:bg-muted/60 transition-colors">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                          checked={bidScopeAcknowledged}
                          onChange={e => setBidScopeAcknowledged(e.target.checked)}
                        />
                        <span className="text-sm leading-relaxed">
                          <span className="font-semibold">I acknowledge the GC's Scope of Work for {myTradeCategory}.</span>
                          {" "}I have read, understood, and will bid based on the full scope defined above.
                        </span>
                      </label>
                    )}
                    <div>
                      <label className="text-lg font-bold mb-1.5 block">Enter Your Bid Amount</label>
                      <p className="text-xs text-muted-foreground mb-2">This is the total amount you are proposing for your scope of work on this project.</p>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="e.g. 50000.00"
                        value={bidAmount}
                        onChange={e => setBidAmount(e.target.value)}
                        className="font-mono text-lg h-14"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold mb-1.5 block">
                        Scope of work notes <span className="font-normal text-muted-foreground">(optional)</span>
                      </label>
                      <textarea
                        className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none min-h-[90px]"
                        placeholder="Describe what your bid includes — scope of work, timeline, qualifications, exclusions…"
                        value={bidNotes}
                        onChange={e => setBidNotes(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold mb-1 block">
                        Scope of Work Document <span className="font-normal text-muted-foreground">(optional)</span>
                      </label>
                      <p className="text-xs text-muted-foreground mb-2">Upload your bid breakdown, scope of work, or proposal PDF</p>
                      <label className={cn(
                        "flex items-center gap-3 cursor-pointer border border-dashed rounded-xl px-4 py-3 transition-colors",
                        bidScopeFile ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
                      )}>
                        <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm text-muted-foreground truncate flex-1">
                          {bidScopeFile ? bidScopeFile.name : "PDF, Word doc, or image — up to 50 MB"}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => setBidScopeFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      {bidScopeFile && (
                        <button
                          type="button"
                          onClick={() => setBidScopeFile(null)}
                          className="text-xs text-muted-foreground hover:text-destructive mt-1.5 ml-1"
                        >
                          Remove file
                        </button>
                      )}
                    </div>
                    <Button
                      type="submit"
                      isLoading={submitBid.isPending || bidScopeUploading}
                      className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white min-h-[44px]"
                    >
                      <DollarSign className="h-5 w-5" /> {bidScopeUploading ? "Uploading document…" : "Submit Bid"}
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-3">
                    {myBid.status === "AWARDED" && (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                        <PartyPopper className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                        <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                          Your bid was accepted — a subcontract has been created
                        </p>
                      </div>
                    )}
                    {myBid.status === "REJECTED" && (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/60 border border-border">
                        <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                        <p className="text-sm text-muted-foreground">
                          Your bid was not selected for this project.
                        </p>
                      </div>
                    )}
                    <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Submitted Bid</p>
                            {planFiles.length > 0 && viewedPlanFileIds.size === planFiles.length && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                                <BadgeCheck className="h-3 w-3" /> Plans Reviewed
                              </span>
                            )}
                          </div>
                          <p className="text-3xl font-bold font-display text-primary">{formatCurrency(myBid.amount)}</p>
                          {myBid.notes && (
                            <div className="mt-3">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Scope of Work Notes</p>
                              <p className="text-sm text-foreground leading-relaxed">{myBid.notes}</p>
                            </div>
                          )}
                          {myBid.scopeOfWorkObjectPath && (
                            <div className="mt-3">
                              <a
                                href={`${BASE}/api/storage${myBid.scopeOfWorkObjectPath}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                              >
                                <FileText className="h-4 w-4" /> View Scope of Work Document
                              </a>
                            </div>
                          )}
                        </div>
                        <Badge
                          variant={myBid.status === "AWARDED" ? "success" : myBid.status === "REJECTED" ? "destructive" : "warning"}
                          className="text-sm px-3 py-1 shrink-0"
                        >
                          {myBid.status === "AWARDED" ? "ACCEPTED" : myBid.status}
                        </Badge>
                      </div>
                      {myBid.status === "PENDING" && (
                        <p className="text-sm text-muted-foreground mt-3 pt-3 border-t border-border/60">
                          Your bid is under review by the general contractor.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>

        {/* MEMBERS SIDEBAR — GC only; subs must never see other subs on the project */}
        {isGC && (
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building className="h-5 w-5 text-primary" /> {project.status === "BIDDING" ? "Invited Subs" : "Project Members"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {project.status === "BIDDING" && (
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed border-b border-border pb-3">
                    Invite your subcontractors below. They will receive an email with a link to view your plans and submit their own bid amount. You review all bids and accept the one you want — that creates the subcontract automatically.
                  </p>
                )}
                <div className="space-y-3">
                  {(project.members?.filter(m => m.roleOnProject === "SUB") ?? []).length === 0 && project.status === "BIDDING" ? (
                    <div className="rounded-xl bg-secondary/50 border border-dashed border-border p-4 text-center space-y-2">
                      <p className="text-sm text-muted-foreground font-medium">No subcontractors invited yet.</p>
                      <p className="text-xs text-muted-foreground">Tap <span className="font-semibold text-foreground">Invite Sub to Bid</span> to send your first invitation. Subs will receive a link to view your plans and submit their bid.</p>
                      <Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={() => setIsInviteOpen(true)}>
                        <Plus className="h-3.5 w-3.5" /> Invite Sub to Bid
                      </Button>
                    </div>
                  ) : (
                    project.members?.map(member => {
                      const canRemove = isGC && project.status === "BIDDING" && member.roleOnProject === "SUB";
                      return (
                        <div key={member.id} className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm shrink-0">
                            {member.user?.companyName?.charAt(0) ?? "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{member.user?.companyName}</p>
                            <p className="text-xs text-muted-foreground capitalize">{project.status === "BIDDING" ? "Invited — awaiting bid" : member.roleOnProject}</p>
                          </div>
                          {canRemove && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="min-h-[36px] min-w-[36px] p-0 text-muted-foreground hover:text-destructive shrink-0"
                              title={`Remove ${member.user?.companyName}`}
                              onClick={() => setRemoveMemberConfirm({ open: true, userId: member.userId, companyName: member.user?.companyName ?? "this subcontractor" })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* PROJECT OWNER CARD */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UserCog className="h-5 w-5 text-primary" /> Project Owner
                  </CardTitle>
                  {!ownerEditing && !isArchived && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setOwnerName((project as any).ownerName ?? "");
                        setOwnerEmail((project as any).ownerEmail ?? "");
                        setOwnerCoThreshold((project as any).ownerCoThreshold != null ? String((project as any).ownerCoThreshold) : "");
                        setOwnerEditing(true);
                      }}
                      className="gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" /> {(project as any).ownerName ? "Edit" : "Add Owner"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {ownerEditing ? (
                  <form onSubmit={handleOwnerSave} className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Owner Name</label>
                      <Input
                        placeholder="e.g. John Smith"
                        value={ownerName}
                        onChange={e => setOwnerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Owner Email</label>
                      <Input
                        type="email"
                        placeholder="e.g. owner@company.com"
                        value={ownerEmail}
                        onChange={e => setOwnerEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">CO Notification Threshold</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input
                          type="number"
                          min="0"
                          step="500"
                          placeholder="e.g. 5000"
                          className="pl-7"
                          value={ownerCoThreshold}
                          onChange={e => setOwnerCoThreshold(e.target.value)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Notify owner for change orders at or above this amount. Leave blank to notify on all COs.</p>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button type="submit" size="sm" isLoading={ownerSaving} disabled={ownerSaving} className="flex-1">Save Owner</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setOwnerEditing(false)}>Cancel</Button>
                    </div>
                  </form>
                ) : (project as any).ownerName ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold shrink-0">
                        {(project as any).ownerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{(project as any).ownerName}</p>
                        <p className="text-xs text-muted-foreground truncate">{(project as any).ownerEmail}</p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/40 border border-border p-3">
                      <p className="text-xs text-muted-foreground font-medium mb-0.5">CO Notification Threshold</p>
                      <p className="text-sm font-semibold text-foreground">
                        {(project as any).ownerCoThreshold != null
                          ? `${formatCurrency((project as any).ownerCoThreshold)} and above`
                          : "All change orders"}
                      </p>
                    </div>
                    {ownerNotifications.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <BellRing className="h-3.5 w-3.5" /> Notification History
                        </p>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {ownerNotifications.map(n => (
                            <div key={n.id} className="rounded-lg border border-border bg-muted/20 p-2.5">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="text-xs font-medium text-foreground truncate flex-1">{n.changeOrder?.description ?? "CO #" + n.changeOrderId.slice(0, 8)}</p>
                                {n.ownerResponse ? (
                                  <span className={cn(
                                    "text-xs font-semibold px-2 py-0.5 rounded-full shrink-0",
                                    n.ownerResponse === "APPROVED" ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                                  )}>
                                    {n.ownerResponse === "APPROVED" ? <ThumbsUp className="inline h-3 w-3 mr-0.5" /> : <ThumbsDown className="inline h-3 w-3 mr-0.5" />}
                                    {n.ownerResponse}
                                  </span>
                                ) : (
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 shrink-0">
                                    <Bell className="inline h-3 w-3 mr-0.5" /> Pending
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {n.changeOrder ? formatCurrency(n.changeOrder.amount) : ""} · Sent {format(new Date(n.sentAt), "MMM d, yyyy")}
                              </p>
                              {n.ownerResponseAt && (
                                <p className="text-xs text-muted-foreground">Responded {format(new Date(n.ownerResponseAt), "MMM d, yyyy")}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <BellOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No project owner set</p>
                    <p className="text-xs text-muted-foreground mt-1">Add the property owner or developer to receive change order notifications.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Mark Project Complete Button — above notes, GC only, CONSTRUCTION status only */}
      {isGC && project.status === "CONSTRUCTION" && !isArchived && (
        <div className="mt-8">
          <Card className="border-green-200/70 dark:border-green-800/40 bg-green-50/40 dark:bg-green-950/10">
            <CardContent className="pt-5 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 shrink-0" /> Ready to wrap up this project?
                  </h3>
                  <p className="text-sm text-green-700/80 dark:text-green-400/80 mt-0.5">Upload completion documents, confirm retention, and mark it done.</p>
                </div>
                <Button
                  onClick={() => {
                    setCompletionUploadedFiles([]);
                    setCompletionNoteText("");
                    setRetentionReleased(false);
                    setRetentionWaived(false);
                    setCompleteConfirm(true);
                  }}
                  className="gap-2 min-h-[44px] px-6 font-semibold bg-green-600 hover:bg-green-700 text-white shadow-sm shrink-0"
                >
                  <CheckCircle2 className="h-4 w-4" /> Mark Project Complete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Completion Documents — shown once project is COMPLETE or archived */}
      {isGC && (project.status === "COMPLETE" || isArchived) && (
        <div className="mt-8">
          <Card className="border-green-200/60 dark:border-green-800/30">
            <CardHeader className="border-b border-green-200/60 dark:border-green-800/30 pb-4">
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" /> Project Completion Record
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Completion note */}
              {(project as any).completionNote && (
                <div className="rounded-xl bg-green-50/60 dark:bg-green-950/10 border border-green-200/60 dark:border-green-800/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400 mb-1.5">Completion Note</p>
                  <p className="text-sm text-foreground leading-relaxed">{(project as any).completionNote}</p>
                </div>
              )}
              {/* Retention status */}
              <div className="flex items-center gap-2 text-sm">
                {(project as any).retentionWaived ? (
                  <><span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-3 py-1 text-xs font-semibold"><Shield className="h-3.5 w-3.5" /> Retention Waived</span><span className="text-muted-foreground">Marked as waived at completion</span></>
                ) : (
                  <><span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-3 py-1 text-xs font-semibold"><ShieldCheck className="h-3.5 w-3.5" /> Retention Released</span><span className="text-muted-foreground">Confirmed at completion</span></>
                )}
              </div>
              {/* Documents */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Completion Documents</p>
                {completionDocsData.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No completion documents uploaded.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {completionDocsData.map(doc => (
                      <a
                        key={doc.id}
                        href={`${BASE}/api/storage${doc.objectPath}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 p-3 transition-colors group"
                      >
                        {doc.category === "photo" ? <Eye className="h-5 w-5 text-blue-500 shrink-0" /> : <FileText className="h-5 w-5 text-primary shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{doc.fileName}</p>
                          <p className="text-xs text-muted-foreground capitalize">{doc.category} · {format(new Date(doc.createdAt), "MMM d, yyyy")}</p>
                        </div>
                        <Download className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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

      </>
      )}

      {/* DRAW SCHEDULE SECTION */}
      {isGC && activeSection === "draw-schedule" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold font-display">Bank Draw Schedule</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Track your budgeted cost categories vs. committed subcontract amounts</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={handleDsExportCSV} className="gap-1.5">
                <FileDown className="h-4 w-4" /> Export CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`${BASE}/api/projects/${projectId}/draw-schedule/pdf`, "_blank")}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" /> Download PDF
              </Button>
            </div>
          </div>

          {/* Add Line Items Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4 text-primary" /> Add Line Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex rounded-xl border border-border overflow-hidden mb-4">
                <button
                  type="button"
                  className={cn("flex-1 py-2 text-sm font-medium transition-colors", dsInputMode === "manual" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary")}
                  onClick={() => setDsInputMode("manual")}
                >
                  Add Manually
                </button>
                <button
                  type="button"
                  className={cn("flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2", dsInputMode === "paste" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary")}
                  onClick={() => setDsInputMode("paste")}
                >
                  <Clipboard className="h-3.5 w-3.5" /> Paste from Bank Doc
                </button>
              </div>

              {dsInputMode === "manual" ? (
                <form onSubmit={handleDsAddItem} className="flex flex-col sm:flex-row gap-3">
                  <Input
                    placeholder="e.g. Framing, Electrical, Plumbing…"
                    value={dsAddDescription}
                    onChange={e => setDsAddDescription(e.target.value)}
                    className="flex-1"
                    required
                  />
                  <Input
                    type="text"
                    placeholder="Budget amount, e.g. $85,000"
                    value={dsAddBudget}
                    onChange={e => setDsAddBudget(e.target.value)}
                    className="w-full sm:w-48 font-mono"
                    required
                  />
                  <Button type="submit" isLoading={dsAddLoading} className="gap-1.5 shrink-0">
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </form>
              ) : (
                <div className="space-y-3">
                  <textarea
                    className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[120px]"
                    placeholder={"Paste your bank draw schedule here — CSV or plain text:\n\nFraming, $85,000\nElectrical, 45000\nPlumbing $28,000\nHVAC,$32,500"}
                    value={dsPasteText}
                    onChange={e => setDsPasteText(e.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" variant="outline" isLoading={dsParsing} onClick={handleDsParse} className="gap-1.5">
                      <Clipboard className="h-4 w-4" /> Parse Items
                    </Button>
                    {dsParsedItems.length > 0 && (
                      <span className="text-sm text-muted-foreground">{dsParsedItems.length} items detected — review below and import</span>
                    )}
                  </div>
                  {dsParsedItems.length > 0 && (
                    <div className="border border-border rounded-xl overflow-hidden">
                      <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parsed Preview</span>
                        <Button size="sm" onClick={handleDsImport} isLoading={dsAddLoading} className="gap-1.5 h-7 px-3 text-xs">
                          <Plus className="h-3 w-3" /> Import {dsParsedItems.length} Items
                        </Button>
                      </div>
                      <div className="divide-y divide-border">
                        {dsParsedItems.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                            <span className="flex-1 text-sm font-medium">{item.description}</span>
                            <span className="text-sm font-mono text-muted-foreground">{formatCurrency(item.budgetAmount)}</span>
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              onClick={() => setDsParsedItems(prev => prev.filter((_, i) => i !== idx))}
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Draw Schedule Table */}
          {drawScheduleItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <TableProperties className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No line items yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Add items manually above or paste your bank draw schedule</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Line Item</th>
                        <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Budget</th>
                        <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Committed</th>
                        <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Variance</th>
                        <th className="text-right px-4 py-3 font-semibold text-muted-foreground hidden sm:table-cell">% Used</th>
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Linked Subcontracts</th>
                        <th className="px-4 py-3 w-24"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {drawScheduleItems.map((item: any) => {
                        const committed = item.committed ?? 0;
                        const variance = item.budgetAmount - committed;
                        const pct = item.budgetAmount > 0 ? (committed / item.budgetAmount) * 100 : 0;
                        const isEditing = dsEditItemId === item.id;
                        const varColor = variance < 0
                          ? "text-red-600 dark:text-red-400"
                          : pct >= 90
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-green-600 dark:text-green-400";
                        const varBg = variance < 0
                          ? "bg-red-50 dark:bg-red-950/20"
                          : pct >= 90
                          ? "bg-amber-50 dark:bg-amber-950/20"
                          : "bg-green-50 dark:bg-green-950/20";

                        const linkedSubs = item.linkedSubcontracts ?? [];
                        const unlinkedSubs = (project.subcontracts ?? []).filter(
                          (sc: any) => !drawScheduleItems.some((di: any) =>
                            (di.linkedSubcontracts ?? []).some((ls: any) => ls.id === sc.id)
                          )
                        );

                        return (
                          <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <Input
                                  value={dsEditDescription}
                                  onChange={e => setDsEditDescription(e.target.value)}
                                  className="h-8 text-sm"
                                  autoFocus
                                />
                              ) : (
                                <span className="font-semibold">{item.description}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {isEditing ? (
                                <Input
                                  value={dsEditBudget}
                                  onChange={e => setDsEditBudget(e.target.value)}
                                  className="h-8 text-sm text-right font-mono w-32 ml-auto"
                                />
                              ) : (
                                formatCurrency(item.budgetAmount)
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(committed)}</td>
                            <td className={cn("px-4 py-3 text-right font-mono font-semibold rounded-sm", varColor)}>
                              <span className={cn("px-2 py-0.5 rounded-md text-xs font-bold", varBg, varColor)}>
                                {variance >= 0 ? "+" : ""}{formatCurrency(variance)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono hidden sm:table-cell">
                              <span className={cn("text-xs font-semibold", pct > 100 ? "text-red-600" : pct >= 90 ? "text-amber-600" : "text-muted-foreground")}>
                                {pct.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <div className="flex flex-wrap gap-1.5 items-center">
                                {linkedSubs.map((ls: any) => (
                                  <span key={ls.id} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                    {ls.companyName}
                                    <button
                                      type="button"
                                      title="Unlink"
                                      onClick={() => handleDsUnlinkSub(ls.id)}
                                      className="hover:text-destructive transition-colors ml-0.5"
                                    >
                                      <Link2Off className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                                {dsLinkItemId === item.id ? (
                                  <div className="flex items-center gap-1">
                                    <select
                                      className="text-xs rounded-lg border border-border bg-background px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                      value={dsLinkSubId}
                                      onChange={e => setDsLinkSubId(e.target.value)}
                                    >
                                      <option value="">— select sub —</option>
                                      {unlinkedSubs.map((sc: any) => (
                                        <option key={sc.id} value={sc.id}>{sc.sub?.companyName ?? "Unknown"}</option>
                                      ))}
                                    </select>
                                    <Button
                                      size="sm"
                                      className="h-7 px-2 text-xs gap-1"
                                      disabled={!dsLinkSubId}
                                      isLoading={dsLinkLoading}
                                      onClick={handleDsLinkSub}
                                    >
                                      <Link2 className="h-3 w-3" /> Link
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setDsLinkItemId(null); setDsLinkSubId(""); }}>
                                      Cancel
                                    </Button>
                                  </div>
                                ) : unlinkedSubs.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => { setDsLinkItemId(item.id); setDsLinkSubId(""); }}
                                    className="text-xs text-primary/70 hover:text-primary flex items-center gap-1 transition-colors"
                                  >
                                    <Link2 className="h-3 w-3" /> Link sub
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                {isEditing ? (
                                  <>
                                    <Button size="sm" className="h-7 px-2 text-xs" isLoading={dsEditLoading} onClick={() => handleDsEdit(item.id)}>
                                      <Save className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDsEditItemId(null)}>
                                      <XCircle className="h-3 w-3" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                      onClick={() => { setDsEditItemId(item.id); setDsEditDescription(item.description); setDsEditBudget(String(item.budgetAmount)); }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                      onClick={() => handleDsDelete(item.id, item.description)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/60 font-bold">
                        <td className="px-4 py-3 text-sm">TOTAL</td>
                        <td className="px-4 py-3 text-right font-mono text-sm">
                          {formatCurrency(drawScheduleItems.reduce((s: number, i: any) => s + i.budgetAmount, 0))}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm">
                          {formatCurrency(drawScheduleItems.reduce((s: number, i: any) => s + (i.committed ?? 0), 0))}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {(() => {
                            const totalBudget = drawScheduleItems.reduce((s: number, i: any) => s + i.budgetAmount, 0);
                            const totalCommitted = drawScheduleItems.reduce((s: number, i: any) => s + (i.committed ?? 0), 0);
                            const totalVariance = totalBudget - totalCommitted;
                            const varColor = totalVariance < 0 ? "text-red-600" : totalVariance / totalBudget < 0.1 ? "text-amber-600" : "text-green-600";
                            return <span className={cn("font-mono font-bold", varColor)}>{totalVariance >= 0 ? "+" : ""}{formatCurrency(totalVariance)}</span>;
                          })()}
                        </td>
                        <td className="px-4 py-3 text-right text-sm hidden sm:table-cell">
                          {(() => {
                            const totalBudget = drawScheduleItems.reduce((s: number, i: any) => s + i.budgetAmount, 0);
                            const totalCommitted = drawScheduleItems.reduce((s: number, i: any) => s + (i.committed ?? 0), 0);
                            const pct = totalBudget > 0 ? (totalCommitted / totalBudget) * 100 : 0;
                            return <span className="font-mono">{pct.toFixed(1)}%</span>;
                          })()}
                        </td>
                        <td className="hidden md:table-cell"></td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Color key */}
                <div className="px-4 py-3 border-t border-border flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 dark:bg-green-950/40 inline-block"></span> Under budget</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 dark:bg-amber-950/40 inline-block"></span> Within 10% of budget</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 dark:bg-red-950/40 inline-block"></span> Over budget</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
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

      {/* GC Add Subcontractor Dialog */}
      <Dialog
        open={isInviteOpen}
        onOpenChange={(open) => { if (!open) handleInviteClose(); }}
        title={
          directSuccess ? "Subcontractor Added" :
          biddingInviteSuccess ? "Invitation Sent!" :
          inviteResult ? "Invitation Sent!" :
          inviteStep === "contract" ? `Direct Award — No Bid Required` :
          project.status === "BIDDING" ? "Invite Sub to Bid" : "Add Subcontractor"
        }
        description={
          biddingInviteSuccess || inviteResult ? undefined :
          inviteStep === "contract" ? `Direct mid-construction addition to ${project.name}. Enter the negotiated amount agreed on with this subcontractor.` :
          project.status === "CONSTRUCTION"
            ? "Direct Award — No Bid Required. Pick a sub to add mid-construction. You'll enter the agreed amount next."
            : undefined
        }
      >
        {/* ─── SUCCESS: direct subcontract created ─── */}
        {directSuccess ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 flex items-start gap-3">
              <PartyPopper className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-300">{directSuccess.companyName} added to {project.name}</p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">Direct Award subcontract created — they've been notified and can start submitting invoices.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleInviteClose} className="min-h-[44px] w-full sm:w-auto">Done</Button>
            </div>
          </div>

        /* ─── SUCCESS: existing contact invited in bidding phase ─── */
        ) : biddingInviteSuccess ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 flex items-start gap-3">
              <Mail className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="font-semibold text-green-800 dark:text-green-300">
                  An invitation has been sent to <span className="font-bold">{biddingInviteSuccess.companyName}</span> at {biddingInviteSuccess.email}.
                </p>
                <p className="text-sm text-green-700 dark:text-green-400">They will receive a magic link to view your plans and submit their bid.</p>
                <p className="text-sm text-green-700 dark:text-green-400">You will be notified when their bid is received.</p>
                <p className="text-xs text-green-600 dark:text-green-500 mt-2 pt-2 border-t border-green-200 dark:border-green-800">There is no amount to enter at this stage — the sub submits their own bid.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleInviteClose} className="min-h-[44px] w-full sm:w-auto">Done</Button>
            </div>
          </div>

        /* ─── SUCCESS: new user invited (bidding) ─── */
        ) : inviteResult ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold">
                <Mail className="h-4 w-4" />
                Invitation sent to {inviteResult.email}
              </div>
              <p className="text-sm text-green-700 dark:text-green-400">They will receive a magic link to view your plans and submit their bid. You will be notified when their bid is received.</p>
              <p className="text-xs text-green-600 dark:text-green-500">There is no amount to enter at this stage — the sub submits their own bid.</p>
              <div className="border-t border-green-200 dark:border-green-800 pt-3 space-y-2 text-sm">
                <p className="text-xs font-semibold text-green-800 dark:text-green-300">New account created — share these credentials if they can't find the email:</p>
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
            <div className="flex justify-end pt-1">
              <Button onClick={handleInviteClose} className="min-h-[44px] w-full sm:w-auto">Done</Button>
            </div>
          </div>

        /* ─── CONSTRUCTION: contract details step ─── */
        ) : inviteStep === "contract" ? (
          <form onSubmit={handleDirectSubcontract} className="mt-4 space-y-4">
            <div className="rounded-xl bg-muted/40 border border-border p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                {inviteSelectedSub?.companyName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm">{inviteSelectedSub?.companyName}</p>
                <p className="text-xs text-muted-foreground">Will be added to {project.name}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">Direct Award Amount *</label>
              <p className="text-xs text-muted-foreground mb-2">The negotiated contract amount agreed upon with this subcontractor for mid-construction work. This bypasses the normal bidding process.</p>
              <Input
                type="text"
                inputMode="decimal"
                required
                placeholder="$85,000"
                value={directAmount}
                onChange={e => setDirectAmount(e.target.value)}
                className="text-lg font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold mb-1 block">Trade Category</label>
                <select
                  value={directTrade}
                  onChange={e => setDirectTrade(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm min-h-[44px]"
                >
                  <option value="">Select trade…</option>
                  {TRADE_CATEGORIES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Retention %</label>
                <Input
                  type="number"
                  min="0"
                  max="15"
                  step="0.5"
                  value={directRetention}
                  onChange={e => setDirectRetention(e.target.value)}
                  placeholder="10"
                />
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2">
              <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => setInviteStep("select")}>
                ← Back
              </Button>
              <Button type="submit" isLoading={directLoading} className="min-h-[44px] px-6">
                Create Direct Award Subcontract
              </Button>
            </div>
          </form>

        /* ─── SELECT SUB step (both BIDDING and CONSTRUCTION) ─── */
        ) : (
          <div className="mt-4">
            {project.status === "CONSTRUCTION" && (
              <div className="mb-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 font-medium">
                Adding a sub mid-construction? You'll enter a negotiated Direct Award amount after selecting them.
              </div>
            )}
            <div className="flex rounded-xl border border-border overflow-hidden mb-4">
              <button
                type="button"
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${inviteTab === "contact" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
                onClick={() => setInviteTab("contact")}
              >
                From Contact Book
              </button>
              <button
                type="button"
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${inviteTab === "new" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
                onClick={() => setInviteTab("new")}
              >
                Invite New Sub
              </button>
            </div>

            {inviteTab === "contact" ? (
              <div className="space-y-3">
                {project.status === "BIDDING" && (
                  <div>
                    <label className="text-sm font-semibold mb-1 block">Trade Category <span className="font-normal text-muted-foreground">(optional)</span></label>
                    <select
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={inviteTrade}
                      onChange={e => setInviteTrade(e.target.value)}
                    >
                      <option value="">— No specific trade —</option>
                      {TRADE_CATEGORIES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {inviteTrade && tradeScopes.find(s => s.tradeCategory === inviteTrade) && (
                      <p className="text-xs text-green-700 dark:text-green-400 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Scope of work defined — will be included in invite email
                      </p>
                    )}
                  </div>
                )}
                <Input
                  placeholder="Search contacts…"
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                />
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {contacts.filter(c =>
                    c.sub.companyName.toLowerCase().includes(contactSearch.toLowerCase()) ||
                    c.sub.email.toLowerCase().includes(contactSearch.toLowerCase())
                  ).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      {contacts.length === 0 ? "Your contact book is empty. Use 'Invite New Sub' to get started." : "No contacts match your search."}
                    </p>
                  ) : contacts
                    .filter(c =>
                      c.sub.companyName.toLowerCase().includes(contactSearch.toLowerCase()) ||
                      c.sub.email.toLowerCase().includes(contactSearch.toLowerCase())
                    )
                    .map(contact => {
                      const alreadyOnProject = project?.members?.some((m: any) => m.id === contact.subId);
                      const hasSubcontract = project.status === "CONSTRUCTION" && (project as any).subcontracts?.some((s: any) => s.subId === contact.subId);
                      return (
                        <div key={contact.subId} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                            {contact.sub.companyName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{contact.sub.companyName}</p>
                            <p className="text-xs text-muted-foreground truncate">{contact.subProfile?.trade ?? contact.sub.email}</p>
                          </div>
                          {project.status === "CONSTRUCTION" ? (
                            <Button
                              size="sm"
                              variant={hasSubcontract ? "outline" : "default"}
                              disabled={hasSubcontract}
                              onClick={() => !hasSubcontract && handleContactSelectForDirect(contact.subId, contact.sub.companyName)}
                            >
                              {hasSubcontract ? "Active" : "Select →"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant={alreadyOnProject ? "outline" : "default"}
                              disabled={alreadyOnProject || inviteContactToProject.isPending}
                              onClick={() => handleContactInvite(contact.subId, contact.sub.companyName, contact.sub.email)}
                            >
                              {alreadyOnProject ? "Invited" : "Invite to Bid"}
                            </Button>
                          )}
                        </div>
                      );
                    })
                  }
                </div>
                <div className="flex justify-end pt-1">
                  <Button type="button" variant="ghost" onClick={handleInviteClose}>Cancel</Button>
                </div>
              </div>
            ) : project.status === "CONSTRUCTION" ? (
              <form onSubmit={handleNewSubNextForDirect} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1 block">Email Address</label>
                  <Input type="email" required placeholder="sub@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Company Name</label>
                  <Input type="text" required placeholder="ABC Electric LLC" value={inviteCompanyName} onChange={e => setInviteCompanyName(e.target.value)} />
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                  <Button type="button" variant="ghost" onClick={handleInviteClose} className="min-h-[44px]">Cancel</Button>
                  <Button type="submit" className="min-h-[44px]">Next — Enter Award Amount →</Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1 block">Email Address</label>
                  <Input type="email" required placeholder="sub@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Company Name</label>
                  <Input type="text" required placeholder="ABC Electric LLC" value={inviteCompanyName} onChange={e => setInviteCompanyName(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Trade Category <span className="font-normal text-muted-foreground">(optional)</span></label>
                  <select
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={inviteTrade}
                    onChange={e => setInviteTrade(e.target.value)}
                  >
                    <option value="">— No specific trade —</option>
                    {TRADE_CATEGORIES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {inviteTrade && tradeScopes.find(s => s.tradeCategory === inviteTrade) && (
                    <p className="text-xs text-green-700 dark:text-green-400 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Scope of work defined — will be included in invite email
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  If this subcontractor isn't in the system yet, an account will be created with a temporary password you can share with them.
                </p>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                  <Button type="button" variant="ghost" onClick={handleInviteClose} className="min-h-[44px]">Cancel</Button>
                  <Button type="submit" isLoading={inviteSub.isPending} className="min-h-[44px]">
                    {project.status === "BIDDING" ? "Send Invitation" : "Add Subcontractor"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Dialog>

      {/* Upload Plan Files Dialog (multi-file) */}
      <Dialog
        open={isPlanOpen}
        onOpenChange={(open) => { if (!open && !isSubmitting) handleClosePlanDialog(); }}
        title="Upload Site Plans"
        description="Select one or more plan files. PDF, PNG, JPG, DWG, and DOCX up to 50 MB each."
      >
        <form onSubmit={handleUploadPlans} className="space-y-4 mt-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.dwg,.docx,.doc"
            onChange={handlePlanFilesSelect}
            disabled={isSubmitting}
          />
          {selectedFiles.length > 0 ? (
            <div className="space-y-2">
              <ul className="space-y-2 max-h-52 overflow-y-auto">
                {selectedFiles.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-muted/30">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                    </div>
                    {!isSubmitting && (
                      <button type="button" onClick={() => setSelectedFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive p-1 min-h-[36px] min-w-[36px] flex items-center justify-center">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {!isSubmitting && (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add more files
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => !isSubmitting && fileInputRef.current?.click()}
              disabled={isSubmitting}
              className="w-full border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 active:bg-muted/40 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <Upload className="h-8 w-8 mx-auto mb-2 opacity-50 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Tap to browse — select multiple files at once</p>
              <p className="text-xs mt-1 text-muted-foreground">PDF, PNG, JPG, DWG, DOCX · max 50 MB each</p>
            </button>
          )}
          {fileError && <p className="text-xs text-destructive">{fileError}</p>}
          {isSubmitting && (
            <div className="space-y-1.5">
              <Progress value={uploadProgressDisplay} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{uploadStatusText}</p>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={handleClosePlanDialog} disabled={isSubmitting} className="min-h-[44px]">Cancel</Button>
            <Button type="submit" isLoading={isSubmitting} disabled={!selectedFiles.length || isSubmitting} className="gap-2 min-h-[44px]">
              <Upload className="h-4 w-4" /> Upload {selectedFiles.length > 1 ? `${selectedFiles.length} Files` : "File"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Upload Scope Documents Dialog (multi-file) */}
      <Dialog
        open={isScopeOpen}
        onOpenChange={(open) => { if (!open && !isScopeSubmitting) handleCloseScopeDialog(); }}
        title="Upload Scope Documents"
        description="Specifications, requirements, and other scope documents visible to invited subs. PDF, Word, PNG, JPG, DWG up to 50 MB each."
      >
        <form onSubmit={handleUploadScopeDocs} className="space-y-4 mt-4">
          <input
            ref={scopeFileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.dwg,.docx,.doc"
            onChange={handleScopeFilesSelect}
            disabled={isScopeSubmitting}
          />
          {selectedScopeFiles.length > 0 ? (
            <div className="space-y-2">
              <ul className="space-y-2 max-h-52 overflow-y-auto">
                {selectedScopeFiles.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-muted/30">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                    </div>
                    {!isScopeSubmitting && (
                      <button type="button" onClick={() => setSelectedScopeFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive p-1 min-h-[36px] min-w-[36px] flex items-center justify-center">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {!isScopeSubmitting && (
                <button type="button" onClick={() => scopeFileInputRef.current?.click()} className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add more files
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => !isScopeSubmitting && scopeFileInputRef.current?.click()}
              disabled={isScopeSubmitting}
              className="w-full border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 active:bg-muted/40 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <Upload className="h-8 w-8 mx-auto mb-2 opacity-50 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Tap to browse — select multiple files at once</p>
              <p className="text-xs mt-1 text-muted-foreground">PDF, Word, PNG, JPG, DWG · max 50 MB each</p>
            </button>
          )}
          {scopeFileError && <p className="text-xs text-destructive">{scopeFileError}</p>}
          {isScopeSubmitting && (
            <div className="space-y-1.5">
              <Progress value={uploadProgressDisplay} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{scopeUploadStatusText}</p>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={handleCloseScopeDialog} disabled={isScopeSubmitting} className="min-h-[44px]">Cancel</Button>
            <Button type="submit" isLoading={isScopeSubmitting} disabled={!selectedScopeFiles.length || isScopeSubmitting} className="gap-2 min-h-[44px]">
              <Upload className="h-4 w-4" /> Upload {selectedScopeFiles.length > 1 ? `${selectedScopeFiles.length} Files` : "File"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Award Bid Confirmation */}
      <Dialog
        open={awardBidConfirm.open}
        onOpenChange={(open) => { if (!open) { setAwardBidConfirm({ open: false, id: "", company: "", amount: 0 }); setAwardTradeCategory(""); setAwardRetentionPct("10"); } }}
        title="Accept Bid"
        description="Assign a trade category and retention rate for this subcontract, then confirm."
      >
        <div className="space-y-4 mt-2">
          <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4">
            <p className="text-sm text-foreground">
              Accepting this bid will create a subcontract with{" "}
              <span className="font-semibold">{awardBidConfirm.company}</span>
              {" "}for{" "}
              <span className="font-mono font-bold">{formatCurrency(awardBidConfirm.amount)}</span>.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This amount was submitted by the subcontractor. Accepting will create a subcontract and move the project to <strong>Active</strong> status. This action cannot be undone.
            </p>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">Trade Category</label>
            <select
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={awardTradeCategory}
              onChange={(e) => setAwardTradeCategory(e.target.value)}
            >
              <option value="">— Select trade (optional) —</option>
              {TRADE_CATEGORIES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">
              Retention Rate (0–15%)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={15}
                step={0.5}
                value={awardRetentionPct}
                onChange={(e) => setAwardRetentionPct(e.target.value)}
                className="flex-1 accent-primary"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={15}
                  step={0.5}
                  value={awardRetentionPct}
                  onChange={(e) => setAwardRetentionPct(e.target.value)}
                  className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Percentage withheld from each invoice until project close. Default is 10%.
            </p>
          </div>
          {drawScheduleItems.length > 0 && (
            <div>
              <label className="text-sm font-semibold mb-1.5 block">Link to Draw Schedule Item <span className="font-normal text-muted-foreground">(optional)</span></label>
              <select
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={awardDrawScheduleItemId}
                onChange={e => setAwardDrawScheduleItemId(e.target.value)}
              >
                <option value="">— No draw schedule link —</option>
                {drawScheduleItems.map((item: any) => (
                  <option key={item.id} value={item.id}>{item.description} ({formatCurrency(item.budgetAmount)})</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button
              variant="ghost"
              className="min-h-[44px]"
              onClick={() => { setAwardBidConfirm({ open: false, id: "", company: "", amount: 0 }); setAwardTradeCategory(""); setAwardDrawScheduleItemId(""); }}
            >
              Cancel
            </Button>
            <Button
              className="min-h-[44px] bg-green-600 hover:bg-green-700 text-white"
              isLoading={awardBid.isPending}
              onClick={handleAward}
            >
              <Award className="h-4 w-4 mr-2" /> Accept Bid
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Remove Subcontractor Confirmation */}
      <Dialog
        open={removeMemberConfirm.open}
        onOpenChange={(open) => !open && setRemoveMemberConfirm({ open: false, userId: "", companyName: "" })}
        title="Remove Subcontractor"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4">
            <p className="text-sm text-foreground">
              Are you sure you want to remove{" "}
              <span className="font-semibold">{removeMemberConfirm.companyName}</span>{" "}
              from this project?
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This will also cancel any pending bids they have submitted. They will be notified by email.
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button
              variant="ghost"
              className="min-h-[44px]"
              onClick={() => setRemoveMemberConfirm({ open: false, userId: "", companyName: "" })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-h-[44px]"
              isLoading={removeMember.isPending}
              onClick={handleRemoveMember}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Remove Subcontractor
            </Button>
          </div>
        </div>
      </Dialog>

      {/* No Plans Downloaded Warning — shown when sub tries to bid without downloading any plan files */}
      <Dialog
        open={showNoPlanWarning}
        onOpenChange={(open) => !open && setShowNoPlanWarning(false)}
        title="Plans Not Downloaded"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                  You haven't downloaded any plan files
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-400 mt-1 leading-relaxed">
                  The GC has uploaded plan files for this project. By submitting a bid without reviewing them, you may miss critical scope information that could affect your pricing.
                </p>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            We recommend downloading and reviewing all plan files before submitting. Do you want to continue anyway?
          </p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button
              variant="ghost"
              className="min-h-[44px]"
              onClick={() => setShowNoPlanWarning(false)}
            >
              Go Back &amp; Review Plans
            </Button>
            <Button
              className="min-h-[44px] bg-orange-600 hover:bg-orange-700 text-white gap-2"
              isLoading={submitBid.isPending}
              onClick={() => { setShowNoPlanWarning(false); doBidSubmit(); }}
            >
              Submit Anyway
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Plan File Confirmation */}
      <Dialog
        open={deletePlanConfirm.open}
        onOpenChange={(open) => !open && setDeletePlanConfirm({ open: false, id: "", name: "" })}
        title="Delete Plan File"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4">
            <p className="text-sm text-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deletePlanConfirm.name}</span>?
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This will permanently remove the file. All team members will lose access to it.
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button
              variant="ghost"
              className="min-h-[44px]"
              onClick={() => setDeletePlanConfirm({ open: false, id: "", name: "" })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="min-h-[44px]"
              isLoading={deletePlanFileMutation.isPending}
              onClick={handleDeletePlan}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete File
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Scope Document Confirmation */}
      <Dialog
        open={deleteScopeConfirm.open}
        onOpenChange={(open) => !open && setDeleteScopeConfirm({ open: false, id: "", name: "" })}
        title="Delete Scope Document"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4">
            <p className="text-sm text-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deleteScopeConfirm.name}</span>?
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This will permanently remove the file. All team members will lose access to it.
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button variant="ghost" className="min-h-[44px]" onClick={() => setDeleteScopeConfirm({ open: false, id: "", name: "" })}>
              Cancel
            </Button>
            <Button variant="destructive" className="min-h-[44px]" onClick={handleDeleteScope}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete File
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Mark Project Complete — Checklist Modal */}
      <Dialog
        open={completeConfirm}
        onOpenChange={(open) => { if (!open && !completeLoading) { setCompleteConfirm(false); } }}
        title="Mark Project Complete"
      >
        <div className="flex flex-col gap-0">
        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1 pb-1">
          {/* Section 1: Upload completion documents */}
          <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-muted/40">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold text-sm">Upload Completion Documents</span>
              <span className="text-xs text-muted-foreground ml-1">optional</span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">Final inspection report, certificate of occupancy, punch list sign-off, or any other project closeout documents.</p>
              <input
                ref={completionDocInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={e => handleCompletionFileSelect(e.target.files, "document")}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={completionDocUploading}
                onClick={() => completionDocInputRef.current?.click()}
                className="gap-2"
              >
                {completionDocUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Select Documents
              </Button>
            </div>
          </div>

          {/* Section 2: Upload completion photos */}
          <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-muted/40">
              <Eye className="h-4 w-4 text-blue-500 shrink-0" />
              <span className="font-semibold text-sm">Upload Photos of Completed Work</span>
              <span className="text-xs text-muted-foreground ml-1">optional</span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">Photographs documenting the finished state of the project for your records.</p>
              <input
                ref={completionPhotoInputRef}
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={e => handleCompletionFileSelect(e.target.files, "photo")}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={completionDocUploading}
                onClick={() => completionPhotoInputRef.current?.click()}
                className="gap-2"
              >
                {completionDocUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Select Photos
              </Button>
            </div>
          </div>

          {/* Uploaded files preview */}
          {completionUploadedFiles.length > 0 && (
            <div className="rounded-xl border border-green-200 dark:border-green-800/40 bg-green-50/40 dark:bg-green-950/10 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400 mb-1">{completionUploadedFiles.length} file{completionUploadedFiles.length !== 1 ? "s" : ""} ready to upload</p>
              {completionUploadedFiles.map((f, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  {f.category === "photo" ? <Eye className="h-4 w-4 text-blue-500 shrink-0" /> : <FileText className="h-4 w-4 text-primary shrink-0" />}
                  <span className="truncate flex-1 text-foreground">{f.fileName}</span>
                  <span className="text-xs text-muted-foreground capitalize shrink-0">{f.category}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    onClick={() => setCompletionUploadedFiles(prev => prev.filter((_, i) => i !== idx))}
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Section 3: Completion note */}
          <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-muted/40">
              <StickyNote className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="font-semibold text-sm">Completion Note</span>
              <span className="text-xs text-muted-foreground ml-1">optional</span>
            </div>
            <div className="p-4">
              <textarea
                className="w-full min-h-[80px] bg-background rounded-lg border border-input p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y placeholder:text-muted-foreground/60"
                placeholder="Add any final notes about the project completion — punch list status, final walkthrough, or handoff details…"
                value={completionNoteText}
                onChange={e => setCompletionNoteText(e.target.value)}
              />
            </div>
          </div>

          {/* Section 4: Retention confirmation — required */}
          <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-muted/40">
              <Shield className="h-4 w-4 text-violet-500 shrink-0" />
              <span className="font-semibold text-sm">Subcontract Retention</span>
              <span className="text-xs font-semibold text-destructive ml-1">required</span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">Confirm the status of retention held on all subcontracts for this project.</p>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="retention"
                  className="mt-0.5 shrink-0 accent-green-600"
                  checked={retentionReleased}
                  onChange={() => { setRetentionReleased(true); setRetentionWaived(false); }}
                />
                <div>
                  <p className="text-sm font-medium group-hover:text-foreground">All retention has been released</p>
                  <p className="text-xs text-muted-foreground">Subcontractors have been paid or will receive their retention balance.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="retention"
                  className="mt-0.5 shrink-0 accent-amber-600"
                  checked={retentionWaived && !retentionReleased}
                  onChange={() => { setRetentionWaived(true); setRetentionReleased(false); }}
                />
                <div>
                  <p className="text-sm font-medium group-hover:text-foreground">Mark retention as waived</p>
                  <p className="text-xs text-muted-foreground">Retention was waived by agreement — no additional payments owed.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Info bullets */}
          <div className="rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2 uppercase tracking-wide">After marking complete</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-600 shrink-0" /> Subcontractors can request their retention balance</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-600 shrink-0" /> New invoices and change orders can still be added</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-600 shrink-0" /> You can archive the project once all payments are settled</li>
            </ul>
          </div>

        </div>
        {/* Action buttons — outside scrollable area so they are always accessible */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-border mt-4">
            <Button variant="ghost" className="min-h-[44px]" disabled={completeLoading} onClick={() => setCompleteConfirm(false)}>Cancel</Button>
            <Button
              className="min-h-[44px] bg-green-600 hover:bg-green-700 text-white gap-2"
              isLoading={completeLoading}
              disabled={completeLoading || completionDocUploading || (!retentionReleased && !retentionWaived)}
              onClick={handleMarkComplete}
            >
              <CheckCircle2 className="h-4 w-4" /> Mark Project Complete
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Archive Project Confirmation */}
      <Dialog
        open={archiveConfirm}
        onOpenChange={(open) => !open && setArchiveConfirm(false)}
        title="Archive Project"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4">
            <p className="text-sm text-foreground font-medium">
              Archive this project? It will be moved to your archive and become read only. All data is preserved.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-600 shrink-0" /> All data, invoices, change orders, and PDFs are preserved</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-600 shrink-0" /> Project disappears from the main dashboard</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-600 shrink-0" /> Does not count against your plan limit</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-green-600 shrink-0" /> You can restore it anytime</li>
            </ul>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button variant="ghost" className="min-h-[44px]" onClick={() => setArchiveConfirm(false)}>Cancel</Button>
            <Button
              className="min-h-[44px] bg-amber-600 hover:bg-amber-700 text-white"
              isLoading={archiveLoading}
              onClick={handleArchive}
            >
              <Archive className="h-4 w-4 mr-2" /> Archive Project
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Unarchive / Restore Project Confirmation */}
      <Dialog
        open={unarchiveConfirm}
        onOpenChange={(open) => !open && setUnarchiveConfirm(false)}
        title="Restore Project"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-muted border border-border p-4">
            <p className="text-sm text-foreground">
              Restore <span className="font-semibold">{project.name}</span> back to your active dashboard?
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              The project will reappear on your main dashboard as Complete. You can re-archive it at any time.
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <Button variant="ghost" className="min-h-[44px]" onClick={() => setUnarchiveConfirm(false)}>Cancel</Button>
            <Button
              className="min-h-[44px]"
              isLoading={archiveLoading}
              onClick={handleUnarchive}
            >
              <ArchiveRestore className="h-4 w-4 mr-2" /> Restore Project
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Bulk Change Order Modal */}
      <Dialog
        open={isBulkCOOpen}
        onOpenChange={(open) => { if (!open) setIsBulkCOOpen(false); }}
        title="Create Change Order"
      >
        <form onSubmit={handleBulkCOSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-semibold mb-1.5 block">Description <span className="text-destructive">*</span></label>
            <Input
              placeholder="e.g. Added exterior drainage scope"
              value={bulkCODescription}
              onChange={e => setBulkCODescription(e.target.value)}
              required
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1.5 block">Scope / Notes <span className="font-normal text-muted-foreground">(optional)</span></label>
            <textarea
              className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none min-h-[80px]"
              placeholder="Describe the additional scope of work…"
              value={bulkCOScope}
              onChange={e => setBulkCOScope(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-2 block">Select Subcontractors <span className="text-destructive">*</span></label>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {project.subcontracts?.map(sc => {
                const checked = selectedSubIds.has(sc.id);
                return (
                  <div
                    key={sc.id}
                    className={cn(
                      "rounded-xl border transition-colors cursor-pointer",
                      checked ? "border-primary bg-primary/5" : "border-border bg-secondary/30 hover:bg-secondary/60"
                    )}
                    onClick={() => toggleSubSelection(sc.id)}
                  >
                    <div className="flex items-start gap-3 p-3">
                      <input
                        type="checkbox"
                        readOnly
                        checked={checked}
                        className="mt-0.5 h-4 w-4 rounded accent-primary shrink-0 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{sc.sub?.companyName ?? "Unknown"}</p>
                        {sc.tradeCategory && <p className="text-xs text-muted-foreground">{sc.tradeCategory}</p>}
                      </div>
                      {checked && (
                        <div onClick={e => e.stopPropagation()} className="shrink-0">
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="Amount $"
                            value={subAmounts[sc.id] ?? ""}
                            onChange={e => setSubAmounts(prev => ({ ...prev, [sc.id]: e.target.value }))}
                            className="w-[120px] font-mono text-sm h-8"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {selectedSubIds.size > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3 border border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Combined CO Value ({selectedSubIds.size} sub{selectedSubIds.size !== 1 ? "s" : ""})</span>
              </div>
              <span className="font-mono font-bold text-lg">{formatCurrency(bulkCOTotal)}</span>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              className="min-h-[44px]"
              onClick={() => setIsBulkCOOpen(false)}
              disabled={bulkCOLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="min-h-[44px] gap-2"
              isLoading={bulkCOLoading}
              disabled={selectedSubIds.size === 0}
            >
              <ClipboardList className="h-4 w-4" />
              Send {selectedSubIds.size > 0 ? selectedSubIds.size : ""} Change Order{selectedSubIds.size !== 1 ? "s" : ""}
            </Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
