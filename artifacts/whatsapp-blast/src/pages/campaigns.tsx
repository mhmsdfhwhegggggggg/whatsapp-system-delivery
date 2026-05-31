import { useState } from "react";
import { Link } from "wouter";
import {
  useListCampaigns,
  useCreateCampaign,
  useDeleteCampaign,
  useStartCampaign,
  usePauseCampaign,
  useResumeCampaign,
  getListCampaignsQueryKey,
  useListContactGroups,
  useListTemplates,
  useListSessions,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Play, Pause, Trash2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";

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

function ProgressBar({ sent, total }: { sent: number; total: number }) {
  const pct = total > 0 ? Math.min((sent / total) * 100, 100) : 0;
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{sent} مرسل</span>
        <span>{total} إجمالي</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Campaigns() {
  const qc = useQueryClient();
  const { data: campaigns, isLoading } = useListCampaigns();
  const { data: groups } = useListContactGroups();
  const { data: templates } = useListTemplates();
  const { data: sessions } = useListSessions();
  const createCampaign = useCreateCampaign();
  const deleteCampaign = useDeleteCampaign();
  const startCampaign = useStartCampaign();
  const pauseCampaign = usePauseCampaign();
  const resumeCampaign = useResumeCampaign();
  const [showForm, setShowForm] = useState(false);

  const { register, handleSubmit, reset } = useForm<{
    name: string;
    templateId: string;
    contactGroupId: string;
    sessionId: string;
    delayMin: string;
    delayMax: string;
  }>();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListCampaignsQueryKey() });

  const onSubmit = handleSubmit((data) => {
    createCampaign.mutate(
      {
        data: {
          name: data.name,
          templateId: data.templateId ? Number(data.templateId) : undefined,
          contactGroupId: data.contactGroupId ? Number(data.contactGroupId) : undefined,
          sessionId: data.sessionId ? Number(data.sessionId) : undefined,
          delayMin: Number(data.delayMin) || 5,
          delayMax: Number(data.delayMax) || 15,
        },
      },
      {
        onSuccess: () => {
          invalidate();
          reset();
          setShowForm(false);
        },
      }
    );
  });

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذه الحملة؟")) {
      deleteCampaign.mutate({ id }, { onSuccess: invalidate });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الحملات</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة حملات الإرسال الجماعي</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          حملة جديدة
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-card border border-card-border rounded-xl p-6">
          <h2 className="text-base font-semibold mb-4">إنشاء حملة جديدة</h2>
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">اسم الحملة *</label>
              <input
                {...register("name", { required: true })}
                placeholder="مثال: حملة رمضان 2025"
                className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">القالب</label>
              <select {...register("templateId")} className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">-- اختر قالب --</option>
                {templates?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">قائمة جهات الاتصال</label>
              <select {...register("contactGroupId")} className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">-- اختر قائمة --</option>
                {groups?.map((g) => <option key={g.id} value={g.id}>{g.name} ({(g as any).contactCount ?? 0})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">حساب واتساب</label>
              <select {...register("sessionId")} className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">-- اختر حساب --</option>
                {sessions?.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.status === "connected" ? "متصل" : "غير متصل"})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">التأخير بين الرسائل (ثانية)</label>
              <div className="flex items-center gap-2">
                <input {...register("delayMin")} defaultValue="5" type="number" min="1" className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="الأدنى" />
                <span className="text-muted-foreground text-sm">-</span>
                <input {...register("delayMax")} defaultValue="15" type="number" min="1" className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="الأقصى" />
              </div>
            </div>
            <div className="md:col-span-2 flex items-center gap-3 justify-end pt-2">
              <button type="button" onClick={() => { setShowForm(false); reset(); }} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
                إلغاء
              </button>
              <button type="submit" disabled={createCampaign.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {createCampaign.isPending ? "جار الإنشاء..." : "إنشاء الحملة"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Campaign list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-card border border-card-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : campaigns?.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl flex flex-col items-center justify-center py-16">
          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
          </div>
          <p className="text-base font-medium text-foreground">لا توجد حملات</p>
          <p className="text-sm text-muted-foreground mt-1">أنشئ حملتك الأولى للبدء</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns?.map((c) => (
            <div key={c.id} className="bg-card border border-card-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-semibold text-foreground">{c.name}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <ProgressBar sent={c.sentCount} total={c.totalCount} />
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="text-green-600">{c.deliveredCount} وصل</span>
                    <span className="text-red-500">{c.failedCount} فشل</span>
                    <span>تأخير: {c.delayMin}–{c.delayMax}s</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(c.status === "draft" || c.status === "paused") && (
                    <button
                      onClick={() => c.status === "paused"
                        ? resumeCampaign.mutate({ id: c.id }, { onSuccess: invalidate })
                        : startCampaign.mutate({ id: c.id }, { onSuccess: invalidate })
                      }
                      className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      title="بدء الإرسال"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  {c.status === "running" && (
                    <button
                      onClick={() => pauseCampaign.mutate({ id: c.id }, { onSuccess: invalidate })}
                      className="p-2 rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
                      title="إيقاف مؤقت"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  )}
                  <Link to={`/campaigns/${c.id}`}>
                    <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="التفاصيل">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </Link>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
