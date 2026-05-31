import {
  useGetAnalyticsOverview,
  useGetCampaignStats,
} from "@workspace/api-client-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--destructive))"];

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

export default function Analytics() {
  const { data: overview, isLoading } = useGetAnalyticsOverview();
  const { data: stats } = useGetCampaignStats();

  const barData = (stats ?? []).map((s) => ({
    name: s.name.length > 14 ? s.name.slice(0, 14) + "…" : s.name,
    مرسل: s.sentCount,
    وصل: s.deliveredCount,
    فشل: s.failedCount,
  }));

  const pieData = overview
    ? [
        { name: "وصل", value: overview.totalDelivered },
        { name: "في الانتظار", value: overview.totalMessagesSent - overview.totalDelivered - overview.totalFailed },
        { name: "فشل", value: overview.totalFailed },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">التحليلات</h1>
        <p className="text-sm text-muted-foreground mt-1">أداء الحملات وإحصائيات الإرسال</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي الرسائل", value: (overview?.totalMessagesSent ?? 0).toLocaleString(), color: "text-foreground" },
          { label: "تم التوصيل", value: (overview?.totalDelivered ?? 0).toLocaleString(), color: "text-green-600" },
          { label: "فشل الإرسال", value: (overview?.totalFailed ?? 0).toLocaleString(), color: "text-red-600" },
          { label: "نسبة النجاح", value: `${overview?.successRate ?? 0}%`, color: "text-primary" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-card-border rounded-xl p-5">
            <p className={cn("text-2xl font-bold", color)}>{isLoading ? "—" : value}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Bar chart */}
        <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-base font-semibold mb-4">أداء الحملات</h2>
          {barData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات بعد</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                <Bar dataKey="مرسل" fill={COLORS[0]} radius={[3, 3, 0, 0]} />
                <Bar dataKey="وصل" fill={COLORS[1]} radius={[3, 3, 0, 0]} />
                <Bar dataKey="فشل" fill={COLORS[2]} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-base font-semibold mb-4">توزيع حالات الرسائل</h2>
          {pieData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">لا توجد بيانات</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {pieData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Campaign table */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">تفاصيل الحملات</h2>
        </div>
        {!stats || stats.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">لا توجد حملات بعد</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">الحملة</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">مرسل</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">وصل</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">فشل</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">النجاح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{s.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-foreground">{s.sentCount}</td>
                    <td className="px-4 py-3 text-green-600">{s.deliveredCount}</td>
                    <td className="px-4 py-3 text-red-600">{s.failedCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${s.successRate}%` }} />
                        </div>
                        <span className="text-muted-foreground text-xs">{s.successRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
