import * as React from "react";
import { useRoute, Link } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import {
  ArrowLeft, Plus, Trash2, Printer, BadgeCheck, AlertTriangle,
  FileText, GripVertical, Scale, TrendingUp, TrendingDown, CheckCircle2, BrainCircuit,
} from "lucide-react";
import toast from "react-hot-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Criterion = { id: string; name: string; weight: number };
type Scores = Record<string, Record<string, number>>;

type EnrichedBid = {
  id: string;
  subId: string;
  amount: number;
  notes: string | null;
  status: string;
  scopeOfWorkObjectPath: string | null;
  sub: { companyName: string; email: string } | null;
  planFilesReviewed: number;
  totalPlanFiles: number;
  allPlansReviewed: boolean;
  complianceStatus: "COMPLIANT" | "INCOMPLETE" | "BLOCKED" | "NA";
  contactNote: string;
  tradeCategory: string | null;
};

type ComparisonData = {
  comparison: { levelingNotes: string; criteria: Criterion[]; scores: Scores };
  bids: EnrichedBid[];
  planFileCount: number;
};

function useBidComparison(projectId: string) {
  return useQuery<ComparisonData>({
    queryKey: ["bid-comparison", projectId],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/projects/${projectId}/bid-comparison`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load bid comparison");
      return r.json();
    },
    enabled: !!projectId,
  });
}

type AiTradeEstimate = {
  trade: string;
  lowEstimate: number;
  highEstimate: number;
  costDrivers: string;
  rangeFactors: string;
};

function useProjectAiAnalysis(projectId: string) {
  return useQuery<{ aiAnalysis: AiTradeEstimate[] | null; aiAnalysisAt: string | null }>({
    queryKey: ["project-ai-analysis", projectId],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/projects/${projectId}`, { credentials: "include" });
      if (!r.ok) return { aiAnalysis: null, aiAnalysisAt: null };
      const project = await r.json();
      return { aiAnalysis: project.aiAnalysis ?? null, aiAnalysisAt: project.aiAnalysisAt ?? null };
    },
    enabled: !!projectId,
  });
}

function getBidRangeStatus(amount: number, low: number, high: number): "within" | "above" | "below" | "neutral" {
  if (amount > high * 1.15) return "above";
  if (amount < low * 0.85) return "below";
  return "within";
}

function useSaveComparison(projectId: string) {
  return useMutation({
    mutationFn: async (payload: { levelingNotes: string; criteria: Criterion[]; scores: Scores }) => {
      const r = await fetch(`${BASE}/api/projects/${projectId}/bid-comparison`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Failed to save");
    },
  });
}

function ComplianceBadge({ status }: { status: EnrichedBid["complianceStatus"] }) {
  if (status === "COMPLIANT") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400"><BadgeCheck className="h-3.5 w-3.5" />Complete</span>;
  if (status === "INCOMPLETE") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5" />Incomplete</span>;
  if (status === "BLOCKED") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400"><AlertTriangle className="h-3.5 w-3.5" />Not Started</span>;
  return <span className="text-xs text-muted-foreground">No subcontract yet</span>;
}

function PlansBadge({ bid }: { bid: EnrichedBid }) {
  if (bid.totalPlanFiles === 0) return <span className="text-xs text-muted-foreground">No plans uploaded</span>;
  if (bid.allPlansReviewed) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400"><BadgeCheck className="h-3.5 w-3.5" />All reviewed</span>;
  if (bid.planFilesReviewed > 0) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5" />{bid.planFilesReviewed}/{bid.totalPlanFiles}</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400"><AlertTriangle className="h-3.5 w-3.5" />None reviewed</span>;
}

function ScorePicker({ value, onChange }: { value: number | undefined; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1 justify-center">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={cn(
            "w-7 h-7 rounded-md text-xs font-bold border transition-all",
            value === n
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border text-muted-foreground hover:border-primary hover:text-foreground"
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function BidComparison() {
  const [, params] = useRoute("/projects/:id/bid-comparison");
  const projectId = params?.id ?? "";
  usePageTitle("Bid Comparison");

  const { data: user } = useGetMe();
  const isGC = user?.role === "GC";

  const { data, isLoading, error } = useBidComparison(projectId);
  const { data: aiData } = useProjectAiAnalysis(projectId);
  const aiAnalysis = aiData?.aiAnalysis ?? null;
  const saveComparison = useSaveComparison(projectId);

  const [levelingNotes, setLevelingNotes] = React.useState("");
  const [criteria, setCriteria] = React.useState<Criterion[]>([]);
  const [scores, setScores] = React.useState<Scores>({});

  const [newCritName, setNewCritName] = React.useState("");
  const [newCritWeight, setNewCritWeight] = React.useState("20");
  const [showAddCrit, setShowAddCrit] = React.useState(false);
  const [editingCrit, setEditingCrit] = React.useState<Criterion | null>(null);

  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const bids = React.useMemo(() => data?.bids ?? [], [data]);
  const submittedBids = bids.filter(b => b.status !== "REJECTED");

  React.useEffect(() => {
    if (!data) return;
    setLevelingNotes(data.comparison?.levelingNotes ?? "");
    setCriteria(data.comparison?.criteria ?? []);
    setScores(data.comparison?.scores ?? {});
  }, [data]);

  const scheduleSave = React.useCallback((ln: string, crit: Criterion[], sc: Scores) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveComparison.mutate({ levelingNotes: ln, criteria: crit, scores: sc });
    }, 800);
  }, [saveComparison]);

  const handleLevelingNotesChange = (v: string) => {
    setLevelingNotes(v);
    scheduleSave(v, criteria, scores);
  };

  const handleWeightChange = (criterionId: string, weight: number) => {
    const next = criteria.map(c => c.id === criterionId ? { ...c, weight } : c);
    setCriteria(next);
    scheduleSave(levelingNotes, next, scores);
  };

  const handleScoreChange = (subId: string, criterionId: string, score: number) => {
    const next = { ...scores, [subId]: { ...(scores[subId] ?? {}), [criterionId]: score } };
    setScores(next);
    scheduleSave(levelingNotes, criteria, next);
  };

  const handleAddCriterion = () => {
    const trimmed = newCritName.trim();
    const w = Math.min(100, Math.max(1, parseInt(newCritWeight, 10) || 20));
    if (!trimmed) return toast.error("Criterion name is required");
    const newCrit: Criterion = { id: crypto.randomUUID(), name: trimmed, weight: w };
    const next = [...criteria, newCrit];
    setCriteria(next);
    setNewCritName("");
    setNewCritWeight("20");
    setShowAddCrit(false);
    scheduleSave(levelingNotes, next, scores);
  };

  const handleSaveEditCrit = () => {
    if (!editingCrit) return;
    const next = criteria.map(c => c.id === editingCrit.id ? editingCrit : c);
    setCriteria(next);
    setEditingCrit(null);
    scheduleSave(levelingNotes, next, scores);
  };

  const handleDeleteCriterion = (id: string) => {
    const next = criteria.filter(c => c.id !== id);
    const nextScores = { ...scores };
    Object.keys(nextScores).forEach(subId => { delete nextScores[subId][id]; });
    setCriteria(next);
    setScores(nextScores);
    scheduleSave(levelingNotes, next, nextScores);
  };

  const avgBidAmount = submittedBids.length > 0
    ? submittedBids.reduce((s, b) => s + b.amount, 0) / submittedBids.length
    : 0;

  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);

  const getWeightedTotal = (subId: string) => {
    if (criteria.length === 0 || totalWeight === 0) return null;
    const subScores = scores[subId] ?? {};
    const scored = criteria.filter(c => subScores[c.id] != null);
    if (scored.length === 0) return null;
    const scoredWeight = scored.reduce((s, c) => s + c.weight, 0);
    if (scoredWeight === 0) return null;
    const total = scored.reduce((s, c) => s + (subScores[c.id] ?? 0) * c.weight, 0);
    return Math.round((total / scoredWeight) * 10) / 10;
  };

  const handlePrint = () => window.print();

  if (!isGC) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto py-20 text-center">
          <p className="text-muted-foreground">You don't have access to this page.</p>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return <Layout><div className="animate-pulse h-64 bg-card rounded-2xl max-w-4xl mx-auto mt-8" /></Layout>;
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto py-20 text-center">
          <p className="text-muted-foreground">Failed to load bid comparison data.</p>
          <Link href={`/projects/${projectId}`}>
            <Button variant="outline" className="mt-4 gap-2"><ArrowLeft className="h-4 w-4" />Back to Project</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  if (submittedBids.length < 2) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto py-20 text-center">
          <Scale className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-bold mb-2">Not enough bids to compare</h2>
          <p className="text-muted-foreground mb-6">You need at least 2 submitted bids to use the bid leveling tool.</p>
          <Link href={`/projects/${projectId}`}>
            <Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" />Back to Project</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <style>{`
        @media print {
          header, nav, aside, [data-no-print] { display: none !important; }
          [data-print-area] { display: block !important; }
          body { font-size: 11px; }
          .print-table th, .print-table td { padding: 6px 8px !important; font-size: 10px; }
        }
      `}</style>

      {/* PAGE HEADER */}
      <div className="flex flex-wrap items-center gap-3 mb-6" data-no-print>
        <Link href={`/projects/${projectId}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 min-h-[36px]">
            <ArrowLeft className="h-4 w-4" /> Back to Project
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" /> Bid Leveling & Comparison
          </h1>
          <p className="text-sm text-muted-foreground">{submittedBids.length} bids — scores are informational only</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 min-h-[36px]" onClick={handlePrint}>
          <Printer className="h-4 w-4" /> Export PDF
        </Button>
      </div>

      {/* PRINT HEADER — only visible in print */}
      <div className="hidden print:block mb-4" data-print-area>
        <h1 className="text-xl font-bold">Bid Leveling & Comparison — Project {projectId}</h1>
        <p className="text-sm text-muted-foreground">{submittedBids.length} bids — scoring is informational only, no automatic ranking</p>
      </div>

      {/* COMPARISON TABLE */}
      <div className="mb-8 overflow-x-auto rounded-2xl border border-border shadow-sm" data-print-area>
        <table className="w-full min-w-[640px] border-collapse print-table bg-card">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-sm w-48 sticky left-0 bg-muted/40 z-10">
                Criteria
              </th>
              {submittedBids.map(bid => (
                <th key={bid.id} className="text-center px-4 py-3 font-semibold text-sm min-w-[180px]">
                  <div className="font-bold text-foreground">{bid.sub?.companyName ?? "—"}</div>
                  {bid.tradeCategory && <div className="text-xs text-muted-foreground font-normal mt-0.5">{bid.tradeCategory}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">

            {/* BID AMOUNT */}
            <tr className="hover:bg-muted/20">
              <td className="px-4 py-3 text-sm font-semibold text-foreground sticky left-0 bg-card z-10">Bid Amount</td>
              {submittedBids.map(bid => {
                const variance = bid.amount - avgBidAmount;
                const aiEstimate = aiAnalysis?.find(e => e.trade.toLowerCase() === (bid.tradeCategory ?? "").toLowerCase()) ?? null;
                const rangeStatus = aiEstimate ? getBidRangeStatus(bid.amount, aiEstimate.lowEstimate, aiEstimate.highEstimate) : "neutral";
                return (
                  <td key={bid.id} className="px-4 py-3 text-center">
                    <div className="font-bold font-mono text-lg text-foreground">{formatCurrency(bid.amount)}</div>
                    <div className={cn("text-xs font-semibold mt-0.5", variance > 0 ? "text-red-600 dark:text-red-400" : variance < 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                      {variance === 0 ? "avg" : variance > 0 ? `+${formatCurrency(variance)} above avg` : `${formatCurrency(variance)} below avg`}
                    </div>
                    {aiEstimate && (
                      <div className={cn("inline-flex items-center gap-1 text-xs font-semibold mt-1.5 px-2 py-0.5 rounded-full",
                        rangeStatus === "within" ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" :
                        "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-500"
                      )}>
                        {rangeStatus === "within" ? <CheckCircle2 className="h-3 w-3" /> : rangeStatus === "above" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {rangeStatus === "within" ? "Within range" : rangeStatus === "above" ? "Above range" : "Below range"}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* AI BENCHMARK RANGE — only shown when aiAnalysis exists */}
            {aiAnalysis && (
              <tr className="hover:bg-muted/20 bg-blue-50/30 dark:bg-blue-950/10">
                <td className="px-4 py-3 sticky left-0 bg-blue-50/30 dark:bg-blue-950/10 z-10">
                  <div className="flex items-center gap-1.5">
                    <BrainCircuit className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">AI Benchmark</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Reference range</div>
                </td>
                {submittedBids.map(bid => {
                  const aiEstimate = aiAnalysis.find(e => e.trade.toLowerCase() === (bid.tradeCategory ?? "").toLowerCase()) ?? null;
                  if (!aiEstimate) return <td key={bid.id} className="px-4 py-3 text-center text-xs text-muted-foreground">—</td>;
                  return (
                    <td key={bid.id} className="px-4 py-3 text-center">
                      <div className="font-semibold text-sm text-blue-700 dark:text-blue-400 font-mono">
                        {formatCurrency(aiEstimate.lowEstimate)} – {formatCurrency(aiEstimate.highEstimate)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-snug max-w-[220px] mx-auto line-clamp-2">{aiEstimate.costDrivers}</div>
                    </td>
                  );
                })}
              </tr>
            )}

            {/* SCOPE NOTES */}
            <tr className="hover:bg-muted/20">
              <td className="px-4 py-3 text-sm font-semibold text-foreground sticky left-0 bg-card z-10">Scope Notes</td>
              {submittedBids.map(bid => (
                <td key={bid.id} className="px-4 py-3 text-center">
                  {bid.notes ? (
                    <p className="text-xs text-muted-foreground text-left leading-relaxed max-w-[240px] mx-auto">{bid.notes}</p>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                  {bid.scopeOfWorkObjectPath && (
                    <a
                      href={`${BASE}/api/storage${bid.scopeOfWorkObjectPath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      <FileText className="h-3 w-3" /> View SOW
                    </a>
                  )}
                </td>
              ))}
            </tr>

            {/* PLAN FILES */}
            <tr className="hover:bg-muted/20">
              <td className="px-4 py-3 text-sm font-semibold text-foreground sticky left-0 bg-card z-10">Plans Reviewed</td>
              {submittedBids.map(bid => (
                <td key={bid.id} className="px-4 py-3 text-center">
                  <PlansBadge bid={bid} />
                </td>
              ))}
            </tr>

            {/* COMPLIANCE */}
            <tr className="hover:bg-muted/20">
              <td className="px-4 py-3 text-sm font-semibold text-foreground sticky left-0 bg-card z-10">Compliance</td>
              {submittedBids.map(bid => (
                <td key={bid.id} className="px-4 py-3 text-center">
                  <ComplianceBadge status={bid.complianceStatus} />
                </td>
              ))}
            </tr>

            {/* TRADE CATEGORY */}
            <tr className="hover:bg-muted/20">
              <td className="px-4 py-3 text-sm font-semibold text-foreground sticky left-0 bg-card z-10">Trade</td>
              {submittedBids.map(bid => (
                <td key={bid.id} className="px-4 py-3 text-center text-sm text-muted-foreground">
                  {bid.tradeCategory ?? "—"}
                </td>
              ))}
            </tr>

            {/* CONTACT NOTES */}
            <tr className="hover:bg-muted/20">
              <td className="px-4 py-3 text-sm font-semibold text-foreground sticky left-0 bg-card z-10">
                <div>GC Notes</div>
                <div className="text-xs font-normal text-muted-foreground">From contact book</div>
              </td>
              {submittedBids.map(bid => (
                <td key={bid.id} className="px-4 py-3 text-center">
                  {bid.contactNote ? (
                    <p className="text-xs text-muted-foreground text-left leading-relaxed max-w-[240px] mx-auto">{bid.contactNote}</p>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* CUSTOM CRITERIA */}
            {criteria.length > 0 && (
              <tr>
                <td colSpan={submittedBids.length + 1} className="px-4 py-2 bg-muted/30 border-t border-border">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Custom Evaluation Criteria</span>
                </td>
              </tr>
            )}
            {criteria.map(crit => (
              <tr key={crit.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 sticky left-0 bg-card z-10">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      {editingCrit?.id === crit.id ? (
                        <div className="space-y-1.5">
                          <Input
                            value={editingCrit.name}
                            onChange={e => setEditingCrit({ ...editingCrit, name: e.target.value })}
                            className="h-7 text-xs"
                            placeholder="Name"
                          />
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={1} max={100}
                              value={editingCrit.weight}
                              onChange={e => setEditingCrit({ ...editingCrit, weight: parseInt(e.target.value, 10) || 20 })}
                              className="h-7 text-xs w-16"
                            />
                            <span className="text-xs text-muted-foreground">% weight</span>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" className="h-6 text-xs px-2" onClick={handleSaveEditCrit}>Save</Button>
                            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingCrit(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm font-semibold text-foreground leading-tight">{crit.name}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs text-muted-foreground">Weight:</span>
                            <Input
                              type="number"
                              min={1} max={100}
                              value={crit.weight}
                              onChange={e => handleWeightChange(crit.id, parseInt(e.target.value, 10) || 1)}
                              className="h-6 text-xs w-14 px-1"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </>
                      )}
                    </div>
                    {editingCrit?.id !== crit.id && (
                      <button onClick={() => handleDeleteCriterion(crit.id)} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0 mt-0.5" data-no-print>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
                {submittedBids.map(bid => (
                  <td key={bid.id} className="px-4 py-3 text-center" data-no-print>
                    <ScorePicker
                      value={scores[bid.subId]?.[crit.id]}
                      onChange={score => handleScoreChange(bid.subId, crit.id, score)}
                    />
                    {scores[bid.subId]?.[crit.id] != null && (
                      <div className="text-xs text-muted-foreground mt-1">{scores[bid.subId][crit.id]}/5</div>
                    )}
                  </td>
                ))}
              </tr>
            ))}

            {/* WEIGHTED TOTAL */}
            {criteria.length > 0 && (
              <tr className="border-t-2 border-border bg-muted/30 font-bold">
                <td className="px-4 py-3 sticky left-0 bg-muted/30 z-10">
                  <div className="text-sm font-bold text-foreground">Weighted Score</div>
                  {totalWeight !== 100 && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 font-normal mt-0.5">
                      Weights total {totalWeight}% (not 100%)
                    </div>
                  )}
                </td>
                {submittedBids.map(bid => {
                  const score = getWeightedTotal(bid.subId);
                  return (
                    <td key={bid.id} className="px-4 py-3 text-center">
                      {score != null ? (
                        <div className="text-xl font-bold font-mono text-foreground">{score.toFixed(1)}<span className="text-sm text-muted-foreground font-normal">/5</span></div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No scores yet</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ADD CUSTOM CRITERION */}
      <div className="mb-8" data-no-print>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-base font-bold text-foreground">Evaluation Criteria</h2>
          <span className="text-xs text-muted-foreground">Score each sub 1–5 on your own criteria</span>
        </div>
        {showAddCrit ? (
          <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-end gap-3 mb-3">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Criterion Name</label>
              <Input
                value={newCritName}
                onChange={e => setNewCritName(e.target.value)}
                placeholder="e.g. Experience with similar projects"
                onKeyDown={e => e.key === "Enter" && handleAddCriterion()}
                autoFocus
              />
            </div>
            <div className="w-28">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Weight (%)</label>
              <Input
                type="number"
                min={1} max={100}
                value={newCritWeight}
                onChange={e => setNewCritWeight(e.target.value)}
              />
            </div>
            <Button size="sm" className="gap-1.5 min-h-[40px]" onClick={handleAddCriterion}>
              <Plus className="h-4 w-4" /> Add
            </Button>
            <Button size="sm" variant="ghost" className="min-h-[40px]" onClick={() => { setShowAddCrit(false); setNewCritName(""); }}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5 min-h-[36px]" onClick={() => setShowAddCrit(true)}>
            <Plus className="h-4 w-4" /> Add Evaluation Criterion
          </Button>
        )}

        {criteria.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
            <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            Scores are purely informational — this tool does not rank or recommend any subcontractor. Use your own judgment.
          </div>
        )}
      </div>

      {/* BID LEVELING NOTES */}
      <div className="mb-8" data-print-area>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-bold text-foreground">Bid Leveling Notes</h2>
          <span className="text-xs text-muted-foreground">Note scope differences between bids</span>
        </div>
        <Textarea
          value={levelingNotes}
          onChange={e => handleLevelingNotesChange(e.target.value)}
          placeholder="Example: Sub A included demolition — Sub B excluded it and notes it as an allowance. Sub C included a 3-year labor warranty, others did not..."
          className="min-h-[140px] text-sm resize-y"
        />
        <p className="text-xs text-muted-foreground mt-1.5">Auto-saved as you type</p>
      </div>

      {/* PRIVACY REMINDER */}
      <div className="mb-8 flex items-start gap-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3" data-no-print>
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">
          Bid amounts and this comparison are visible only to your GC team. Subcontractors never see competitor bids.
        </p>
      </div>
    </Layout>
  );
}
