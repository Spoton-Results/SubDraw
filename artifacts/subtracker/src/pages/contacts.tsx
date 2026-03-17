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
import { Loader2, Search, Trash2, Pencil, PlusCircle, BookUser, Building2, Phone, FileText, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

const TRADE_LABELS: Record<string, string> = {};

export default function Contacts() {
  usePageTitle("Contact Book");
  const { data: contacts, isLoading } = useGetContacts();
  const { data: projects } = useGetProjects();
  const updateNote = useUpdateContactNote();
  const removeContact = useRemoveContact();
  const inviteContact = useInviteContactToProject();
  const qc = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [noteDialog, setNoteDialog] = React.useState<{ subId: string; current: string | null } | null>(null);
  const [noteText, setNoteText] = React.useState("");
  const [deleteDialog, setDeleteDialog] = React.useState<{ subId: string; name: string } | null>(null);
  const [inviteDialog, setInviteDialog] = React.useState<{ subId: string; name: string } | null>(null);
  const [selectedProjectId, setSelectedProjectId] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!contacts) return [];
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.sub.companyName.toLowerCase().includes(q) ||
        c.sub.email.toLowerCase().includes(q) ||
        (c.subProfile?.trade ?? "").toLowerCase().includes(q)
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

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <BookUser className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold font-display">Contact Book</h1>
            <p className="text-sm text-muted-foreground">All subcontractors you've worked with</p>
          </div>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by company, email, or trade…"
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
            <p className="text-sm mt-1">Subcontractors you invite to projects will appear here automatically.</p>
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

      {/* Note dialog */}
      <Dialog
        open={!!noteDialog}
        onOpenChange={(open) => { if (!open) setNoteDialog(null); }}
        title="Edit Note"
        description="Add a private note about this subcontractor. Only you can see it."
      >
        <div className="mt-4 space-y-4">
          <textarea
            className="w-full rounded-xl border border-border bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[100px]"
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
