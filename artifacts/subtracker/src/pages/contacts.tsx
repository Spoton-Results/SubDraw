import * as React from "react";
import { Layout } from "@/components/layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  useGetContacts,
  useUpdateContactNote,
  useRemoveContact,
  useInviteContactToProject,
  useGetProjects,
  getGetContactsQueryKey,
} from "@workspace/api-client-react";
import {
  Loader2, Search, Trash2, Pencil, PlusCircle, BookUser, Building2, Phone,
  FileText, Wrench, Upload, Download, UserPlus, X, CheckCircle2, AlertCircle, User,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const CSV_HEADERS = ["Company Name", "Contact Name", "Email", "Phone", "Trade Specialty", "License Number"];
const CSV_TEMPLATE_ROWS = [
  ["Acme Electrical Co.", "John Smith", "john@acmeelectrical.com", "555-123-4567", "Electrical", "C-10-123456"],
  ["ABC Plumbing", "Jane Doe", "jane@abcplumbing.com", "555-987-6543", "Plumbing", "C-36-654321"],
];

function generateCSVTemplate(): string {
  const rows = [CSV_HEADERS, ...CSV_TEMPLATE_ROWS];
  return rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
}

function downloadCSVTemplate() {
  const blob = new Blob([generateCSVTemplate()], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "subtracker-contacts-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

interface ParsedContact {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  tradeSpecialty: string;
  licenseNumber: string;
  valid: boolean;
  error?: string;
}

function parseCSV(text: string): ParsedContact[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCSVRow(headerLine).map(h => h.trim().toLowerCase());

  const colIdx = {
    companyName: headers.findIndex(h => h.includes("company")),
    contactName: headers.findIndex(h => h.includes("contact name") || h === "contact"),
    email: headers.findIndex(h => h.includes("email")),
    phone: headers.findIndex(h => h.includes("phone")),
    tradeSpecialty: headers.findIndex(h => h.includes("trade")),
    licenseNumber: headers.findIndex(h => h.includes("license")),
  };

  const results: ParsedContact[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVRow(lines[i]);
    const get = (idx: number) => (idx >= 0 ? (cells[idx] ?? "").trim() : "");

    const companyName = get(colIdx.companyName);
    const email = get(colIdx.email);
    const valid = !!companyName && !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    results.push({
      companyName,
      contactName: get(colIdx.contactName),
      email,
      phone: get(colIdx.phone),
      tradeSpecialty: get(colIdx.tradeSpecialty),
      licenseNumber: get(colIdx.licenseNumber),
      valid,
      error: !companyName ? "Missing company name" : !email ? "Missing email" : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Invalid email" : undefined,
    });
  }
  return results;
}

function parseCSVRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

const TRADE_OPTIONS = [
  "General", "Electrical", "Plumbing", "HVAC", "Framing", "Drywall", "Roofing",
  "Flooring", "Painting", "Concrete", "Masonry", "Insulation", "Windows and Doors",
  "Landscaping", "Other",
];

export default function Contacts() {
  usePageTitle("Contact Book");
  const { data: contacts, isLoading } = useGetContacts();
  const { data: projects } = useGetProjects();
  const updateNote = useUpdateContactNote();
  const removeContact = useRemoveContact();
  const inviteContact = useInviteContactToProject();
  const qc = useQueryClient();

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const [search, setSearch] = React.useState("");
  const [noteDialog, setNoteDialog] = React.useState<{ subId: string; current: string | null } | null>(null);
  const [noteText, setNoteText] = React.useState("");
  const [deleteDialog, setDeleteDialog] = React.useState<{ subId: string; name: string } | null>(null);
  const [inviteDialog, setInviteDialog] = React.useState<{ subId: string; name: string } | null>(null);
  const [selectedProjectId, setSelectedProjectId] = React.useState("");

  const [importOpen, setImportOpen] = React.useState(false);
  const [importTab, setImportTab] = React.useState<"csv" | "manual">("csv");

  const [csvParsed, setCsvParsed] = React.useState<ParsedContact[] | null>(null);
  const [csvFileName, setCsvFileName] = React.useState("");
  const [importing, setImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<{ imported: number; skipped: number } | null>(null);
  const csvInputRef = React.useRef<HTMLInputElement>(null);

  const [manualForm, setManualForm] = React.useState({
    companyName: "", contactName: "", email: "", phone: "", tradeSpecialty: "", licenseNumber: "",
  });
  const [manualSaving, setManualSaving] = React.useState(false);

  const filtered = React.useMemo(() => {
    if (!contacts) return [];
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.sub.companyName.toLowerCase().includes(q) ||
        c.sub.email.toLowerCase().includes(q) ||
        (c.subProfile?.trade ?? "").toLowerCase().includes(q) ||
        ((c as any).contactName ?? "").toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const handleEditNote = (subId: string, current: string | null) => {
    setNoteDialog({ subId, current });
    setNoteText(current ?? "");
  };

  const handleSaveNote = async () => {
    if (!noteDialog) return;
    try {
      await updateNote.mutateAsync({ subId: noteDialog.subId, data: { note: noteText || null } });
      qc.invalidateQueries({ queryKey: getGetContactsQueryKey() });
      toast.success("Note saved");
      setNoteDialog(null);
    } catch {
      toast.error("Failed to save note");
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await removeContact.mutateAsync({ subId: deleteDialog.subId });
      qc.invalidateQueries({ queryKey: getGetContactsQueryKey() });
      toast.success("Contact removed");
      setDeleteDialog(null);
    } catch {
      toast.error("Failed to remove contact");
    }
  };

  const handleInvite = async () => {
    if (!inviteDialog || !selectedProjectId) return;
    try {
      await inviteContact.mutateAsync({ subId: inviteDialog.subId, projectId: selectedProjectId });
      toast.success(`${inviteDialog.name} added to project`);
      setInviteDialog(null);
      setSelectedProjectId("");
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Failed to add to project");
    }
  };

  const handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setCsvParsed(parsed);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const validRows = csvParsed?.filter(r => r.valid) ?? [];
  const invalidRows = csvParsed?.filter(r => !r.valid) ?? [];

  const handleConfirmImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch(`${BASE}/api/contacts/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ contacts: validRows }),
      });
      if (!res.ok) throw new Error("Import failed");
      const result = await res.json();
      setImportResult(result);
      qc.invalidateQueries({ queryKey: getGetContactsQueryKey() });
      setCsvParsed(null);
      setCsvFileName("");
    } catch {
      toast.error("Import failed — please try again");
    } finally {
      setImporting(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.companyName.trim() || !manualForm.email.trim()) {
      toast.error("Company name and email are required");
      return;
    }
    setManualSaving(true);
    try {
      const res = await fetch(`${BASE}/api/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(manualForm),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to add contact");
      qc.invalidateQueries({ queryKey: getGetContactsQueryKey() });
      toast.success(`${manualForm.companyName} added to contact book`);
      setManualForm({ companyName: "", contactName: "", email: "", phone: "", tradeSpecialty: "", licenseNumber: "" });
      setImportOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add contact");
    } finally {
      setManualSaving(false);
    }
  };

  const resetImportDialog = () => {
    setCsvParsed(null);
    setCsvFileName("");
    setImportResult(null);
    setManualForm({ companyName: "", contactName: "", email: "", phone: "", tradeSpecialty: "", licenseNumber: "" });
    setImportTab("csv");
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <BookUser className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold font-display">Contact Book</h1>
              <p className="text-sm text-muted-foreground">All subcontractors you've worked with</p>
            </div>
          </div>
          <Button onClick={() => { resetImportDialog(); setImportOpen(true); }} className="gap-2">
            <UserPlus className="h-4 w-4" /> Import Contacts
          </Button>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by company, name, email, or trade…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <BookUser className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No contacts yet</p>
            <p className="text-sm mt-1 mb-4">Subcontractors you invite to projects will appear here automatically, or import them with the button above.</p>
            <Button variant="outline" onClick={() => { resetImportDialog(); setImportOpen(true); }} className="gap-2 mx-auto">
              <UserPlus className="h-4 w-4" /> Import Contacts
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((contact) => (
              <div key={contact.subId} className="bg-card border border-border rounded-2xl p-5 flex flex-col md:flex-row md:items-start gap-4">
                <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                  {contact.sub.companyName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-base">{contact.sub.companyName}</span>
                    {contact.subProfile?.trade && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Wrench className="h-3 w-3" />
                        {contact.subProfile.trade}
                      </Badge>
                    )}
                  </div>
                  {(contact as any).contactName && (
                    <p className="text-sm font-medium text-foreground/80 flex items-center gap-1 mb-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {(contact as any).contactName}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground truncate mb-2">{contact.sub.email}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
                    {contact.subProfile?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {contact.subProfile.phone}
                      </span>
                    )}
                    {contact.subProfile?.businessAddress && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {contact.subProfile.businessAddress}
                      </span>
                    )}
                    {contact.subProfile?.licenseNumber && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Lic: {contact.subProfile.licenseNumber}
                      </span>
                    )}
                  </div>
                  {contact.sharedProjects.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {contact.sharedProjects.map((p) => (
                        <Badge key={p.id} variant="outline" className="text-xs">{p.name}</Badge>
                      ))}
                    </div>
                  )}
                  {contact.note && (
                    <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2 mt-1">{contact.note}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setInviteDialog({ subId: contact.subId, name: contact.sub.companyName })}>
                    <PlusCircle className="h-4 w-4 mr-1" />
                    Add to Project
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleEditNote(contact.subId, contact.note ?? null)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteDialog({ subId: contact.subId, name: contact.sub.companyName })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* IMPORT CONTACTS DIALOG */}
      {importOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setImportOpen(false)}>
          <div className="bg-card rounded-2xl border shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b shrink-0">
              <h3 className="text-lg font-bold font-display flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" /> Import Contacts
              </h3>
              <button onClick={() => setImportOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex border-b shrink-0">
              <button
                className={cn("flex-1 py-3 text-sm font-medium transition-colors border-b-2", importTab === "csv" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                onClick={() => setImportTab("csv")}
              >
                <Upload className="inline h-4 w-4 mr-1.5 -mt-0.5" /> Upload CSV
              </button>
              <button
                className={cn("flex-1 py-3 text-sm font-medium transition-colors border-b-2", importTab === "manual" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
                onClick={() => setImportTab("manual")}
              >
                <PlusCircle className="inline h-4 w-4 mr-1.5 -mt-0.5" /> Add Manually
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {importTab === "csv" ? (
                <div className="p-6 space-y-5">
                  {importResult ? (
                    <div className="text-center py-8 space-y-4">
                      <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                      <div>
                        <p className="text-lg font-bold text-green-700 dark:text-green-400">
                          {importResult.imported} contact{importResult.imported !== 1 ? "s" : ""} imported successfully
                        </p>
                        {importResult.skipped > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {importResult.skipped} duplicate{importResult.skipped !== 1 ? "s" : ""} skipped (already in contact book)
                          </p>
                        )}
                      </div>
                      <Button variant="outline" onClick={() => { setImportResult(null); setCsvParsed(null); setCsvFileName(""); }}>
                        Import More
                      </Button>
                      <Button variant="ghost" onClick={() => setImportOpen(false)}>Done</Button>
                    </div>
                  ) : csvParsed ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{csvFileName}</p>
                          <p className="text-xs text-muted-foreground">{csvParsed.length} row{csvParsed.length !== 1 ? "s" : ""} found — {validRows.length} valid, {invalidRows.length} invalid</p>
                        </div>
                        <button className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => { setCsvParsed(null); setCsvFileName(""); }}>Clear</button>
                      </div>

                      {invalidRows.length > 0 && (
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" /> {invalidRows.length} row{invalidRows.length !== 1 ? "s" : ""} will be skipped
                          </p>
                          {invalidRows.slice(0, 3).map((r, i) => (
                            <p key={i} className="text-xs text-amber-700 dark:text-amber-400">{r.email || "(no email)"} — {r.error}</p>
                          ))}
                          {invalidRows.length > 3 && <p className="text-xs text-amber-600 mt-0.5">…and {invalidRows.length - 3} more</p>}
                        </div>
                      )}

                      {validRows.length > 0 && (
                        <div className="border border-border rounded-xl overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Company</th>
                                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Contact</th>
                                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Email</th>
                                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Trade</th>
                                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Phone</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {validRows.map((r, i) => (
                                  <tr key={i} className="hover:bg-muted/30">
                                    <td className="px-3 py-2 font-medium">{r.companyName}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{r.contactName || "—"}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{r.email}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{r.tradeSpecialty || "—"}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{r.phone || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3 pt-1">
                        <Button
                          className="flex-1"
                          onClick={handleConfirmImport}
                          disabled={importing || validRows.length === 0}
                          isLoading={importing}
                        >
                          Import {validRows.length} Contact{validRows.length !== 1 ? "s" : ""}
                        </Button>
                        <Button variant="outline" onClick={() => { setCsvParsed(null); setCsvFileName(""); }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="rounded-lg bg-muted/40 border border-border p-4 space-y-2">
                        <p className="text-sm font-semibold">How it works</p>
                        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                          <li>Download the CSV template below</li>
                          <li>Fill in your subcontractor contacts (one per row)</li>
                          <li>Upload the completed CSV file</li>
                          <li>Review the preview and confirm the import</li>
                        </ol>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">CSV Template</p>
                        <div className="flex items-center gap-3">
                          <Button variant="outline" size="sm" onClick={downloadCSVTemplate} className="gap-2">
                            <Download className="h-4 w-4" /> Download Template
                          </Button>
                          <span className="text-xs text-muted-foreground">Columns: {CSV_HEADERS.join(", ")}</span>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Upload CSV File</p>
                        <label className="flex items-center justify-center gap-3 cursor-pointer border-2 border-dashed border-border hover:border-primary/60 transition-colors rounded-xl p-8 bg-muted/20 hover:bg-muted/30 text-muted-foreground hover:text-primary">
                          <Upload className="h-6 w-6" />
                          <div className="text-center">
                            <p className="font-medium text-sm">Click to upload CSV</p>
                            <p className="text-xs mt-0.5">Supports .csv files</p>
                          </div>
                          <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCSVFile} />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleManualAdd} className="p-6 space-y-4">
                  <p className="text-sm text-muted-foreground">Add a single subcontractor to your contact book. Company name and email are required.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Company Name <span className="text-destructive">*</span></label>
                      <Input
                        required
                        value={manualForm.companyName}
                        onChange={e => setManualForm(f => ({ ...f, companyName: e.target.value }))}
                        placeholder="e.g. Acme Electrical Co."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Contact Name</label>
                      <Input
                        value={manualForm.contactName}
                        onChange={e => setManualForm(f => ({ ...f, contactName: e.target.value }))}
                        placeholder="e.g. John Smith"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Email <span className="text-destructive">*</span></label>
                      <Input
                        required
                        type="email"
                        value={manualForm.email}
                        onChange={e => setManualForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="e.g. contact@company.com"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Phone</label>
                      <Input
                        value={manualForm.phone}
                        onChange={e => setManualForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="e.g. 555-123-4567"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Trade Specialty</label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={manualForm.tradeSpecialty}
                        onChange={e => setManualForm(f => ({ ...f, tradeSpecialty: e.target.value }))}
                      >
                        <option value="">Select a trade…</option>
                        {TRADE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">License Number</label>
                      <Input
                        value={manualForm.licenseNumber}
                        onChange={e => setManualForm(f => ({ ...f, licenseNumber: e.target.value }))}
                        placeholder="e.g. C-10-123456"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="submit" className="flex-1" isLoading={manualSaving} disabled={manualSaving}>
                      Add to Contact Book
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Note dialog */}
      <Dialog
        open={!!noteDialog}
        onOpenChange={(open) => { if (!open) setNoteDialog(null); }}
        title="Edit Note"
        description="Add a private note about this subcontractor. Only you can see it."
      >
        <div className="mt-4 space-y-4">
          <Textarea
            className="min-h-[100px]"
            placeholder="Private note about this subcontractor…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setNoteDialog(null)}>Cancel</Button>
            <Button onClick={handleSaveNote} disabled={updateNote.isPending}>
              {updateNote.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save Note
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete dialog */}
      <Dialog
        open={!!deleteDialog}
        onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}
        title="Remove Contact?"
        description={`Remove ${deleteDialog?.name ?? ""} from your contact book? This won't remove them from any active projects.`}
      >
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={removeContact.isPending}
          >
            {removeContact.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Remove
          </Button>
        </div>
      </Dialog>

      {/* Invite to project dialog */}
      <Dialog
        open={!!inviteDialog}
        onOpenChange={(open) => { if (!open) { setInviteDialog(null); setSelectedProjectId(""); } }}
        title={`Add ${inviteDialog?.name ?? ""} to a Project`}
        description="Select a project to add this subcontractor to."
      >
        <div className="mt-4 space-y-4">
          <select
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <option value="">Select a project…</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setInviteDialog(null); setSelectedProjectId(""); }}>Cancel</Button>
            <Button onClick={handleInvite} disabled={!selectedProjectId || inviteContact.isPending}>
              {inviteContact.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Add to Project
            </Button>
          </div>
        </div>
      </Dialog>
    </Layout>
  );
}
