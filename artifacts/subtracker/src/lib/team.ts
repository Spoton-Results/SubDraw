const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const API = `${BASE}/api`;

export interface TeamMember {
  id: string;
  email: string;
  companyName: string;
  displayName: string | null;
  gcTeamRole: string;
  createdAt: string | null;
  assignedProjects: { id: string; name: string }[];
  isCurrentUser?: boolean;
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const res = await fetch(`${API}/team`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch team");
  return res.json();
}

export async function inviteTeamMember(data: {
  email: string;
  fullName: string;
  gcTeamRole: string;
}): Promise<TeamMember> {
  const res = await fetch(`${API}/team/invite`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to invite team member");
  }
  return res.json();
}

export async function updateTeamMember(
  memberId: string,
  data: { gcTeamRole?: string; fullName?: string }
): Promise<TeamMember> {
  const res = await fetch(`${API}/team/${memberId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update team member");
  }
  return res.json();
}

export async function deleteTeamMember(memberId: string): Promise<void> {
  const res = await fetch(`${API}/team/${memberId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to remove team member");
}

export async function assignMemberToProject(
  projectId: string,
  teamMemberUserId: string
): Promise<void> {
  const res = await fetch(`${API}/team/projects/${projectId}/assign`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamMemberUserId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to assign member to project");
  }
}

export async function unassignMemberFromProject(
  projectId: string,
  teamMemberUserId: string
): Promise<void> {
  const res = await fetch(
    `${API}/team/projects/${projectId}/assign/${teamMemberUserId}`,
    { method: "DELETE", credentials: "include" }
  );
  if (!res.ok) throw new Error("Failed to unassign member from project");
}
