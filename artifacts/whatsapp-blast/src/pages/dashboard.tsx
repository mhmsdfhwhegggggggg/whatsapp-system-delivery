import { useGetAnalyticsOverview, useListCampaigns, useGetCampaignStats } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Megaphone, Users, CheckCircle, XCircle, TrendingUp, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", color)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "مسودة", cls: "bg-muted text-muted-foreground" },
    running: { label: "يعمل", cls: "bg-green-100 text-green-700" },
    paused: { label: "متوقف", cls: "bg-yellow-100 text-yellow-700" },
    completed: { label: "مكتمل", cls: "bg-blue-100 text-blue-700" },
    failed: { label: "فشل", cls: "bg-red-100 text-red-700" },
  };
  const s = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", s.cls)}>{s.label}</span>;
}

export default function Dashboard() {
  const { data: overview, isLoading } = useGetAnalyticsOverview();
  const { data: campaigns } = useListCampaigns();
  const { data: stats } = useGetCampaignStats();

  const recentCampaigns = campaigns?.slice(-5).reverse() ?? [];
  const chartData = (stats ?? []).slice(-7).map((s) => ({
    name: s.name.length > 12 ? s.name.slice(0, 12) + "…" : s.name,
    مرسل: s.sentCount,
    وصل: s.deliveredCount,
    فشل: s.failedCount,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-sm text-muted-foreground mt-1">نظرة عامة على نشاط حملاتك</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="إجمالي الحملات" value={overview?.totalCampaigns ?? 0} icon={Megaphone} color="bg-primary/10 text-primary" />
          <StatCard label="حملات نشطة" value={overview?.activeCampaigns ?? 0} icon={TrendingUp} color="bg-green-100 text-green-600" />
          <StatCard label="رسائل مرسلة" value={(overview?.totalMessagesSent ?? 0).toLocaleString()} icon={CheckCircle} color="bg-blue-100 text-blue-600" />
          <StatCard label="تم التوصيل" value={(overview?.totalDelivered ?? 0).toLocaleString()} icon={CheckCircle} color="bg-emerald-100 text-emerald-600" />
          <StatCard label="جهات الاتصال" value={(overview?.totalContacts ?? 0).toLocaleString()} icon={Users} color="bg-violet-100 text-violet-600" />
          <StatCard label="نسبة النجاح" value={`${overview?.successRate ?? 0}%`} icon={TrendingUp} color="bg-amber-100 text-amber-600" />
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Chart */}
        <div className="lg:col-span-3 bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">أداء الحملات</h2>
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">لا توجد بيانات بعد</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                />
                <Bar dataKey="مرسل" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="وصل" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="فشل" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Campaigns */}
        <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">آخر الحملات</h2>
          {recentCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Megaphone className="w-10 h-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">لا توجد حملات بعد</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCampaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.sentCount} / {c.totalCount} رسالة</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
