import * as React from "react";
import { Link } from "wouter";
import { useGetProjects, useCreateProject, getGetProjectsQueryKey, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Plus, Briefcase, Building2, ChevronRight, FileSignature, DollarSign, AlertTriangle, MapPin, CalendarDays } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";

export default function Dashboard() {
  const { data: user } = useGetMe();
  const { data: projects, isLoading } = useGetProjects();
  const createProject = useCreateProject();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newAddress, setNewAddress] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [newStartDate, setNewStartDate] = React.useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createProject.mutateAsync({ data: {
        name: newName.trim(),
        address: newAddress.trim() || undefined,
        description: newDescription.trim() || undefined,
        estimatedStartDate: newStartDate || undefined,
      }});
      toast.success("Project created!");
      queryClient.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
      setIsCreateOpen(false);
      setNewName("");
      setNewAddress("");
      setNewDescription("");
      setNewStartDate("");
    } catch {
      toast.error("Failed to create project");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "BIDDING": return "default";
      case "ACTIVE": return "success";
      case "CLOSED": return "secondary";
      default: return "outline";
    }
  };

  const isGC = user?.role === "GC";

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage your active bids and subcontracts</p>
        </div>
        {isGC && (
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="h-5 w-5" />
            New Project
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse h-48 bg-card/50" />
          ))}
        </div>
      ) : projects?.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-3xl border border-border/50 shadow-sm">
          <Briefcase className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-xl font-bold mb-2">No projects yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {isGC
              ? "Create your first project to start inviting subcontractors."
              : "You haven't been invited to any projects yet."}
          </p>
          {isGC && (
            <Button onClick={() => setIsCreateOpen(true)}>Create Project</Button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects?.map(project => {
            const fs = (project as any).financialSummary as {
              subcontractCount: number;
              totalApprovedAmount: number;
              totalInvoiced: number;
              hasFlaggedInvoices: boolean;
            } | undefined;

            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full hover:-translate-y-1 hover:shadow-xl hover:border-primary/30 transition-all duration-300 cursor-pointer group">
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-primary/10 p-3 rounded-xl text-primary">
                        <Briefcase className="h-6 w-6" />
                      </div>
                      <div className="flex items-center gap-2">
                        {isGC && fs?.hasFlaggedInvoices && (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <AlertTriangle className="h-3 w-3" /> Flagged
                          </Badge>
                        )}
                        <Badge variant={getStatusColor(project.status) as any}>
                          {project.status}
                        </Badge>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold font-display mb-1 group-hover:text-primary transition-colors line-clamp-1">
                      {project.name}
                    </h3>
                    <div className="space-y-1 mb-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="h-4 w-4 shrink-0" />
                        <span className="truncate">{project.gc.companyName}</span>
                      </div>
                      {(project as any).address && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 shrink-0" />
                          <span className="truncate">{(project as any).address}</span>
                        </div>
                      )}
                      {(project as any).estimatedStartDate && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarDays className="h-4 w-4 shrink-0" />
                          <span>Start: {format(new Date((project as any).estimatedStartDate), "MMM d, yyyy")}</span>
                        </div>
                      )}
                    </div>

                    {isGC && fs && (
                      <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-muted/40 rounded-xl border border-border/50">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                            <FileSignature className="h-3 w-3" />
                            <span className="text-xs">Active Subs</span>
                          </div>
                          <p className="text-lg font-bold font-mono">{fs.subcontractCount}</p>
                        </div>
                        <div className="text-center border-l border-border/50">
                          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                            <DollarSign className="h-3 w-3" />
                            <span className="text-xs">Total Value</span>
                          </div>
                          <p className="text-sm font-bold font-mono text-foreground leading-tight">
                            {formatCurrency(fs.totalApprovedAmount)}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-auto pt-4 border-t border-border flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {format(new Date(project.createdAt), "MMM d, yyyy")}
                      </span>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen} title="Create New Project" description="Add details about your project. Only the name is required.">
        <form onSubmit={handleCreate} className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-semibold mb-1 block">Project Name *</label>
            <Input
              autoFocus
              required
              placeholder="e.g. Downtown Office Renovation"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Full Address</label>
            <Input
              placeholder="e.g. 123 Main St, Chicago, IL 60601"
              value={newAddress}
              onChange={e => setNewAddress(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Project Description</label>
            <textarea
              className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              rows={3}
              placeholder="Brief overview of the project scope and objectives..."
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Estimated Start Date</label>
            <Input
              type="date"
              value={newStartDate}
              onChange={e => setNewStartDate(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createProject.isPending}>Create Project</Button>
          </div>
        </form>
      </Dialog>
    </Layout>
  );
}
