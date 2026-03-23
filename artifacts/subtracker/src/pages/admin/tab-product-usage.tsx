import * as React from "react";
import { BarChart2, RefreshCw, FileText, Zap, Layers, DollarSign, CheckSquare, FileCheck, ArrowUpRight, Receipt } from "lucide-react";
import toast from "react-hot-toast";

const BASE = import.meta.env.BASE_URL;
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}api/admin${path}`, { credentials: "include", ...opts });

interface ProductUsage {
  totalGCs: number;
  totalSubs: number;
  gcFeatures: Record<string, { count: number; total: number; label: string }>;
  platformTotals: {
    changeOrders: number;
    invoices: number;
    lienWaiversSigned: number;
    subsWithPaymentConfirmed: number;
  };
}

function AdoptionBar({ count, total, label, icon }: { count: number; total: number; label: string; icon: React.ReactNode }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const color = pct >= 60 ? "bg-green-500" : pct >= 30 ? "bg-yellow-500" : "bg-slate-400";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-muted-foreground">{icon}</span>
          {label}
        </div>
        <div className="text-sm font-semibold">{count} <span className="text-muted-foreground font-normal">/ {total}</span></div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-muted-foreground">{pct}% adoption rate</div>
    </div>
  );
}

function TotalCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">{icon}</div>
      <div>
        <div className="text-xl font-bold">{value.toLocaleString()}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export function TabProductUsage() {
  const [data, setData] = React.useState<ProductUsage | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    api("/product-usage").then(r => r.json()).then(setData).catch(() => toast.error("Failed to load product usage")).finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const featureIcons: Record<string, React.ReactNode> = {
    planFilesUploaded:  <FileText className="h-4 w-4" />,
    aiAnalysisRun:      <Zap className="h-4 w-4" />,
    tradeScopes:        <Layers className="h-4 w-4" />,
    retention:          <DollarSign className="h-4 w-4" />,
    compliance:         <CheckSquare className="h-4 w-4" />,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Product Usage</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Feature adoption across all real GC accounts</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 border border-border rounded-lg transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Loading...
        </div>
      ) : !data ? null : (
        <>
          {/* Platform totals */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Platform Activity Totals</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <TotalCard icon={<ArrowUpRight className="h-4 w-4" />} label="Change Orders Created" value={data.platformTotals.changeOrders} />
              <TotalCard icon={<Receipt className="h-4 w-4" />} label="Invoices Submitted" value={data.platformTotals.invoices} />
              <TotalCard icon={<FileCheck className="h-4 w-4" />} label="Lien Waivers Signed" value={data.platformTotals.lienWaiversSigned} />
              <TotalCard icon={<CheckSquare className="h-4 w-4" />} label="Payments Confirmed" value={data.platformTotals.subsWithPaymentConfirmed} />
            </div>
          </div>

          {/* User counts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-2xl font-bold">{data.totalGCs.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Total GC Accounts (non-demo)</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-2xl font-bold">{data.totalSubs.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Total Subcontractor Accounts</div>
            </div>
          </div>

          {/* Feature adoption */}
          <div>
            <h3 className="text-sm font-semibold mb-4">GC Feature Adoption</h3>
            <div className="bg-card border border-border rounded-xl p-5 space-y-6">
              {Object.entries(data.gcFeatures).map(([key, feat]) => (
                <AdoptionBar
                  key={key}
                  count={feat.count}
                  total={feat.total}
                  label={feat.label}
                  icon={featureIcons[key] ?? <BarChart2 className="h-4 w-4" />}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
