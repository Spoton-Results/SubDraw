import * as React from "react";
import { Layout } from "@/components/layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import toast from "react-hot-toast";
import {
  Search,
  MapPin,
  Wrench,
  Phone,
  FileText,
  Building2,
  BookmarkPlus,
  CheckCircle2,
  Loader2,
  Users,
  RotateCcw,
  PlusCircle,
  Star,
} from "lucide-react";

interface DirectorySubcontractor {
  subId: string;
  companyName: string;
  email: string;
  trade: string;
  phone: string | null;
  businessAddress: string | null;
  city: string | null;
  state: string | null;
  serviceArea: string | null;
  licenseNumber: string | null;
  savedToContacts: boolean;
  preferred: boolean;
}

interface ProjectOption {
  id: string;
  name: string;
  status?: string;
}

const TRADE_OPTIONS = ["", "Electrical", "Plumbing", "HVAC", "Framing", "Drywall", "Roofing", "Flooring", "Painting", "Concrete", "Masonry", "Insulation", "Windows and Doors", "Landscaping", "General", "Other"];
const STATE_OPTIONS = ["", "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

function getBaseUrl() {
  return import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
}

export default function Directory() {
  usePageTitle("Subcontractor Directory");

  const BASE = getBaseUrl();
  const [q, setQ] = React.useState("");
  const [trade, setTrade] = React.useState("");
  const [state, setState] = React.useState("");
  const [city, setCity] = React.useState("");
  const [preferredOnly, setPreferredOnly] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [preferredSavingId, setPreferredSavingId] = React.useState<string | null>(null);
  const [invitingId, setInvitingId] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<DirectorySubcontractor[]>([]);
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [inviteTarget, setInviteTarget] = React.useState<DirectorySubcontractor | null>(null);
  const [selectedProjectId, setSelectedProjectId] = React.useState("");
  const [inviteTradeCategory, setInviteTradeCategory] = React.useState("");

  const buildQuery = React.useCallback(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (trade.trim()) params.set("trade", trade.trim());
    if (state.trim()) params.set("state", state.trim());
    if (city.trim()) params.set("city", city.trim());
    if (preferredOnly) params.set("preferredOnly", "true");
    return params.toString();
  }, [q, trade, state, city, preferredOnly]);

  const loadProjects = React.useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/projects`, { credentials: "include" });
      if (!res.ok) return;
      const body = await res.json().catch(() => []);
      setProjects(Array.isArray(body) ? body.filter((p: ProjectOption) => p.status !== "COMPLETE" && p.status !== "ARCHIVED") : []);
    } catch {
      // Project list is optional for directory search.
    }
  }, [BASE]);

  const runSearch = React.useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const qs = buildQuery();
      const res = await fetch(`${BASE}/api/directory/subcontractors${qs ? `?${qs}` : ""}`, { credentials: "include" });
      const body = await res.json().catch(() => []);
      if (!res.ok) throw new Error(body?.error || "Directory search failed");
      const sorted = [...body].sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.companyName.localeCompare(b.companyName));
      setResults(sorted);
    } catch (err: any) {
      toast.error(err.message || "Directory search failed");
    } finally {
      setLoading(false);
    }
  }, [BASE, buildQuery]);

  React.useEffect(() => {
    runSearch();
    loadProjects();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (hasSearched) runSearch();
  }, [preferredOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearFilters = () => {
    setQ("");
    setTrade("");
    setState("");
    setCity("");
    setPreferredOnly(false);
    setTimeout(() => runSearch(), 0);
  };

  const updateSub = (subId: string, updates: Partial<DirectorySubcontractor>) => {
    setResults(prev => [...prev.map(item => item.subId === subId ? { ...item, ...updates } : item)]
      .sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.companyName.localeCompare(b.companyName)));
  };

  const saveToContacts = async (sub: DirectorySubcontractor) => {
    setSavingId(sub.subId);
    try {
      const res = await fetch(`${BASE}/api/directory/subcontractors/${sub.subId}/save`, { method: "POST", credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Could not save subcontractor");
      updateSub(sub.subId, { savedToContacts: true });
      toast.success(`${sub.companyName} saved to Contact Book`);
    } catch (err: any) {
      toast.error(err.message || "Could not save subcontractor");
    } finally {
      setSavingId(null);
    }
  };

  const togglePreferred = async (sub: DirectorySubcontractor) => {
    setPreferredSavingId(sub.subId);
    try {
      const res = await fetch(`${BASE}/api/directory/subcontractors/${sub.subId}/preferred`, {
        method: sub.preferred ? "DELETE" : "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Could not update preferred status");
      updateSub(sub.subId, { preferred: !sub.preferred, savedToContacts: sub.savedToContacts || !sub.preferred });
      toast.success(!sub.preferred ? `${sub.companyName} marked preferred` : `${sub.companyName} removed from preferred`);
    } catch (err: any) {
      toast.error(err.message || "Could not update preferred status");
    } finally {
      setPreferredSavingId(null);
    }
  };

  const openInvite = (sub: DirectorySubcontractor) => {
    setInviteTarget(sub);
    setSelectedProjectId("");
    setInviteTradeCategory(sub.trade || "");
    if (projects.length === 0) loadProjects();
  };

  const inviteToProject = async () => {
    if (!inviteTarget || !selectedProjectId) return;
    setInvitingId(inviteTarget.subId);
    try {
      if (!inviteTarget.savedToContacts) {
        const saveRes = await fetch(`${BASE}/api/directory/subcontractors/${inviteTarget.subId}/save`, { method: "POST", credentials: "include" });
        const saveBody = await saveRes.json().catch(() => ({}));
        if (!saveRes.ok) throw new Error(saveBody?.error || "Could not save subcontractor before invite");
      }

      const inviteRes = await fetch(`${BASE}/api/contacts/${inviteTarget.subId}/invite/${selectedProjectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tradeCategory: inviteTradeCategory || inviteTarget.trade || undefined }),
      });
      const inviteBody = await inviteRes.json().catch(() => ({}));
      if (!inviteRes.ok) throw new Error(inviteBody?.error || "Could not add subcontractor to project");

      const projectName = projects.find(p => p.id === selectedProjectId)?.name || "project";
      updateSub(inviteTarget.subId, { savedToContacts: true });
      toast.success(`${inviteTarget.companyName} added to ${projectName}`);
      setInviteTarget(null);
      setSelectedProjectId("");
      setInviteTradeCategory("");
    } catch (err: any) {
      toast.error(err.message || "Could not add subcontractor to project");
    } finally {
      setInvitingId(null);
    }
  };

  const preferredCount = results.filter(r => r.preferred).length;

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold uppercase tracking-wide mb-3">
              <Users className="h-3.5 w-3.5" /> GC Network
            </div>
            <h1 className="text-2xl md:text-3xl font-bold font-display">Subcontractor Directory</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Search subcontractors by trade, city, and state. Star trusted subs as preferred, then add them directly to active projects.
            </p>
          </div>
          <Button variant="outline" onClick={clearFilters} className="gap-2 w-full md:w-auto">
            <RotateCcw className="h-4 w-4" /> Reset Filters
          </Button>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }} className="pl-9" placeholder="Search company, email, license, service area…" />
            </div>
            <div className="md:col-span-3">
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary/30" value={trade} onChange={(e) => setTrade(e.target.value)}>
                {TRADE_OPTIONS.map(t => <option key={t || "all"} value={t}>{t || "All trades"}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary/30" value={state} onChange={(e) => setState(e.target.value)}>
                {STATE_OPTIONS.map(s => <option key={s || "all"} value={s}>{s || "All states"}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <Input value={city} onChange={(e) => setCity(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }} placeholder="City" />
            </div>
          </div>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted-foreground">{loading ? "Searching directory…" : `${results.length} subcontractor${results.length === 1 ? "" : "s"} found`}</p>
              <button
                type="button"
                onClick={() => setPreferredOnly(v => !v)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${preferredOnly ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800" : "bg-background text-muted-foreground border-border hover:bg-muted"}`}
              >
                <Star className={`h-3.5 w-3.5 ${preferredOnly ? "fill-current" : ""}`} /> Preferred only {preferredCount > 0 ? `(${preferredCount})` : ""}
              </button>
            </div>
            <Button onClick={runSearch} disabled={loading} className="gap-2 w-full sm:w-auto">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search Directory
            </Button>
          </div>
        </div>

        {loading && !hasSearched ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : results.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-foreground">No subcontractors found</p>
            <p className="text-sm mt-1">Try widening your filters or importing subcontractors into your Contact Book first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {results.map(sub => (
              <div key={sub.subId} className={`bg-card border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow ${sub.preferred ? "border-amber-300 ring-1 ring-amber-200 dark:border-amber-700 dark:ring-amber-900/40" : "border-border"}`}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`h-11 w-11 rounded-full flex items-center justify-center font-bold shrink-0 ${sub.preferred ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "bg-primary/10 text-primary"}`}>{sub.companyName.charAt(0).toUpperCase()}</div>
                    <div className="min-w-0"><h2 className="font-bold text-base truncate">{sub.companyName}</h2><p className="text-sm text-muted-foreground truncate">{sub.email}</p></div>
                  </div>
                  <button
                    type="button"
                    disabled={preferredSavingId === sub.subId}
                    onClick={() => togglePreferred(sub)}
                    className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-colors shrink-0 ${sub.preferred ? "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-amber-600"}`}
                    aria-label={sub.preferred ? "Remove preferred" : "Mark preferred"}
                    title={sub.preferred ? "Remove preferred" : "Mark preferred"}
                  >
                    {preferredSavingId === sub.subId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className={`h-4 w-4 ${sub.preferred ? "fill-current" : ""}`} />}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {sub.preferred && <Badge variant="secondary" className="gap-1 shrink-0 text-amber-800 bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300"><Star className="h-3 w-3 fill-current" /> Preferred</Badge>}
                  {sub.savedToContacts ? <Badge variant="secondary" className="gap-1 shrink-0 text-green-700 bg-green-100 dark:bg-green-950/30 dark:text-green-300"><CheckCircle2 className="h-3 w-3" /> Saved</Badge> : null}
                  {sub.trade && <Badge variant="outline" className="gap-1"><Wrench className="h-3 w-3" /> {sub.trade}</Badge>}
                  {(sub.city || sub.state) && <Badge variant="outline" className="gap-1"><MapPin className="h-3 w-3" /> {[sub.city, sub.state].filter(Boolean).join(", ")}</Badge>}
                  {sub.licenseNumber && <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" /> Lic: {sub.licenseNumber}</Badge>}
                </div>

                <div className="space-y-2 text-sm text-muted-foreground mb-5">
                  {sub.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {sub.phone}</p>}
                  {sub.businessAddress && <p className="flex items-center gap-2"><Building2 className="h-4 w-4" /> {sub.businessAddress}</p>}
                  {sub.serviceArea && <p className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5" /> <span>{sub.serviceArea}</span></p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button variant={sub.savedToContacts ? "outline" : "default"} disabled={sub.savedToContacts || savingId === sub.subId} onClick={() => saveToContacts(sub)} className="gap-2">
                    {savingId === sub.subId ? <Loader2 className="h-4 w-4 animate-spin" /> : sub.savedToContacts ? <CheckCircle2 className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
                    {sub.savedToContacts ? "Saved" : "Save"}
                  </Button>
                  <Button variant="outline" onClick={() => openInvite(sub)} className="gap-2" disabled={invitingId === sub.subId}>
                    {invitingId === sub.subId ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                    Add to Project
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={!!inviteTarget}
        onOpenChange={(open) => { if (!open) setInviteTarget(null); }}
        title={`Add ${inviteTarget?.companyName ?? "Subcontractor"} to Project`}
        description="Choose an active project and trade category. This also saves the subcontractor to your Contact Book if needed."
      >
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Project</label>
            <select className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
              <option value="">Select a project…</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}{project.status ? ` — ${project.status}` : ""}</option>)}
            </select>
            {projects.length === 0 && <p className="text-xs text-muted-foreground mt-2">Create a project first, then come back to add subcontractors from the directory.</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Trade Category</label>
            <Input value={inviteTradeCategory} onChange={(e) => setInviteTradeCategory(e.target.value)} placeholder="Electrical, Plumbing, Drywall…" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setInviteTarget(null)}>Cancel</Button>
            <Button onClick={inviteToProject} disabled={!selectedProjectId || !!invitingId || projects.length === 0} className="gap-2">
              {invitingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              Add to Project
            </Button>
          </div>
        </div>
      </Dialog>
    </Layout>
  );
}
