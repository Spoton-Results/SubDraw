import * as React from "react";
import { Layout } from "@/components/layout";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useGetMe, useGetProjects } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTeamMembers,
  inviteTeamMember,
  updateTeamMember,
  deleteTeamMember,
  assignMemberToProject,
  unassignMemberFromProject,
  type TeamMember,
} from "@/lib/team";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  Loader2,
  Shield,
  FolderOpen,
  X,
  Crown,
} from "lucide-react";
import toast from "react-hot-toast";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  project_manager: "Project Manager",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant={role === "owner" ? "default" : "secondary"} className="text-xs gap-1">
      {role === "owner" && <Crown className="h-3 w-3" />}
      {role === "project_manager" && <Shield className="h-3 w-3" />}
      {ROLE_LABELS[role] ?? role}
    </Badge>
  );
}

export default function Team() {
  usePageTitle("Team");
  const { data: projects } = useGetProjects();
  const qc = useQueryClient();

  const { data: members, isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: getTeamMembers,
  });

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteFullName, setInviteFullName] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("project_manager");

  const [editMember, setEditMember] = React.useState<TeamMember | null>(null);
  const [editFullName, setEditFullName] = React.useState("");
  const [editRole, setEditRole] = React.useState("project_manager");

  const [deleteMember, setDeleteMember] = React.useState<TeamMember | null>(null);
  const [assignMember, setAssignMember] = React.useState<TeamMember | null>(null);

  const inviteMutation = useMutation({
    mutationFn: inviteTeamMember,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Invitation sent — they'll receive an email with login credentials");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteFullName("");
      setInviteRole("project_manager");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { gcTeamRole?: string; fullName?: string } }) =>
      updateTeamMember(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Team member updated");
      setEditMember(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (memberId: string) => deleteTeamMember(memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Team member removed");
      setDeleteMember(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assignMutation = useMutation({
    mutationFn: ({ projectId, memberId }: { projectId: string; memberId: string }) =>
      assignMemberToProject(projectId, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      setAssignMember((prev) => {
        if (!prev) return null;
        const updated = members?.find((m) => m.id === prev.id);
        return updated ?? prev;
      });
      toast.success("Project assigned");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unassignMutation = useMutation({
    mutationFn: ({ projectId, memberId }: { projectId: string; memberId: string }) =>
      unassignMemberFromProject(projectId, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      setAssignMember((prev) => {
        if (!prev) return null;
        const updated = members?.find((m) => m.id === prev.id);
        return updated ?? prev;
      });
      toast.success("Project removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEdit = (m: TeamMember) => {
    setEditMember(m);
    setEditFullName(m.displayName ?? "");
    setEditRole(m.gcTeamRole ?? "project_manager");
  };

  const handleInviteSubmit = () => {
    if (!inviteEmail.trim() || !inviteFullName.trim()) {
      toast.error("Email and full name are required");
      return;
    }
    inviteMutation.mutate({
      email: inviteEmail.trim(),
      fullName: inviteFullName.trim(),
      gcTeamRole: inviteRole,
    });
  };

  const handleEditSubmit = () => {
    if (!editMember) return;
    updateMutation.mutate({
      id: editMember.id,
      data: { gcTeamRole: editRole, fullName: editFullName.trim() || undefined },
    });
  };

  const currentAssignMember = React.useMemo(() => {
    if (!assignMember) return null;
    return members?.find((m) => m.id === assignMember.id) ?? assignMember;
  }, [assignMember, members]);

  const unassignedProjects = React.useMemo(() => {
    if (!currentAssignMember || !projects) return [];
    const assignedIds = new Set(currentAssignMember.assignedProjects.map((p) => p.id));
    return (projects as any[]).filter(
      (p: any) => !assignedIds.has(p.id) && p.status !== "ARCHIVED"
    );
  }, [currentAssignMember, projects]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display">Team</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your team members and their project access
            </p>
          </div>
          <Button onClick={() => setInviteOpen(true)} className="gap-2 shrink-0">
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !members || members.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="font-semibold text-lg">No team members yet</p>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs">
                Invite a Project Manager to give them scoped access to your projects.
              </p>
              <Button className="mt-4 gap-2" onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Invite Member
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <Card key={member.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base shrink-0 mt-0.5">
                      {(member.displayName || member.companyName).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">
                          {member.displayName || member.companyName}
                        </span>
                        <RoleBadge role={member.gcTeamRole} />
                        {member.isCurrentUser && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            You
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{member.email}</p>
                      {member.assignedProjects.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {member.assignedProjects.map((p) => (
                            <span
                              key={p.id}
                              className="inline-flex items-center gap-1 bg-secondary text-xs rounded-lg px-2 py-1 font-medium"
                            >
                              <FolderOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                              {p.name}
                              {!member.isCurrentUser && (
                                <button
                                  className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                                  onClick={() =>
                                    unassignMutation.mutate({
                                      projectId: p.id,
                                      memberId: member.id,
                                    })
                                  }
                                  title="Remove from project"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        !member.isCurrentUser && (
                          <p className="text-xs text-muted-foreground/60 mt-1.5 italic">
                            No projects assigned
                          </p>
                        )
                      )}
                    </div>
                    {!member.isCurrentUser && (
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-8"
                          onClick={() => setAssignMember(member)}
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                          Projects
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(member)}
                          title="Edit member"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteMember(member)}
                          title="Remove member"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title="Invite Team Member"
        description="They'll receive an email with a temporary password to log in."
      >
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input
              placeholder="Jane Smith"
              value={inviteFullName}
              onChange={(e) => setInviteFullName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email Address</Label>
            <Input
              type="email"
              placeholder="jane@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project_manager">Project Manager</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Project Managers can access assigned projects and their subcontracts.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteSubmit} disabled={inviteMutation.isPending} className="gap-2">
              {inviteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Send Invitation
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog
        open={!!editMember}
        onOpenChange={(open) => !open && setEditMember(null)}
        title="Edit Team Member"
      >
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input
              placeholder="Full name"
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={editRole} onValueChange={setEditRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project_manager">Project Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => setEditMember(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateMutation.isPending} className="gap-2">
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog
        open={!!deleteMember}
        onOpenChange={(open) => !open && setDeleteMember(null)}
        title="Remove Team Member"
        description={`Are you sure you want to remove ${deleteMember?.displayName || deleteMember?.companyName}? This will revoke their access to all projects immediately.`}
      >
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteMember(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => deleteMember && deleteMutation.mutate(deleteMember.id)}
            disabled={deleteMutation.isPending}
            className="gap-2"
          >
            {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Remove Member
          </Button>
        </div>
      </Dialog>

      {/* Assign Projects Dialog */}
      <Dialog
        open={!!assignMember}
        onOpenChange={(open) => !open && setAssignMember(null)}
        title={`Projects — ${(currentAssignMember?.displayName || currentAssignMember?.companyName) ?? ""}`}
        description="Assign or remove project access for this team member."
      >
        <div className="mt-4 space-y-4">
          {(currentAssignMember?.assignedProjects.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Currently Assigned
              </p>
              <div className="space-y-1.5">
                {currentAssignMember!.assignedProjects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-secondary/60 rounded-xl px-3 py-2"
                  >
                    <span className="text-sm font-medium">{p.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 text-xs"
                      onClick={() =>
                        currentAssignMember &&
                        unassignMutation.mutate({
                          projectId: p.id,
                          memberId: currentAssignMember.id,
                        })
                      }
                      disabled={unassignMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {unassignedProjects.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Available Projects
              </p>
              <div className="space-y-1.5">
                {unassignedProjects.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between border border-border rounded-xl px-3 py-2"
                  >
                    <span className="text-sm font-medium">{p.name}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        currentAssignMember &&
                        assignMutation.mutate({
                          projectId: p.id,
                          memberId: currentAssignMember.id,
                        })
                      }
                      disabled={assignMutation.isPending}
                    >
                      Assign
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {unassignedProjects.length === 0 &&
            (currentAssignMember?.assignedProjects.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No active projects available to assign.
              </p>
            )}
          <div className="flex justify-end pt-1">
            <Button onClick={() => setAssignMember(null)}>Done</Button>
          </div>
        </div>
      </Dialog>
    </Layout>
  );
}
