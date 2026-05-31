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
import { Plus, Play, Pause, Trash2, ChevronRight, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
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

type FormData = {
  name: string;
  templateId: string;
  contactGroupId: string;
  sessionId: string;
  delayMin: string;
  delayMax: string;
  batchSize: string;
  batchPauseSeconds: string;
  enableVariation: boolean;
  stopOnBan: boolean;
};

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
  const [showAntiban, setShowAntiban] = useState(false);

  const { register, handleSubmit, reset, watch } = useForm<FormData>({
    defaultValues: {
      delayMin: "8",
      delayMax: "20",
      batchSize: "10",
      batchPauseSeconds: "120",
      enableVariation: true,
      stopOnBan: true,
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: getListCampaignsQueryKey() });

  const onSubmit = handleSubmit((data) => {
    createCampaign.mutate({
      data: {
        name: data.name,
        templateId: data.templateId ? Number(data.templateId) : undefined,
        contactGroupId: data.contactGroupId ? Number(data.contactGroupId) : undefined,
        sessionId: data.sessionId ? Number(data.sessionId) : undefined,
        delayMin: Number(data.delayMin) || 8,
        delayMax: Number(data.delayMax) || 20,
        batchSize: Number(data.batchSize) || 10,
        batchPauseSeconds: Number(data.batchPauseSeconds) || 120,
        enableVariation: Boolean(data.enableVariation),
        stopOnBan: Boolean(data.stopOnBan),
      },
    }, {
      onSuccess: () => { invalidate(); reset(); setShowForm(false); setShowAntiban(false); },
    });
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
          <p className="text-sm text-muted-foreground mt-1">إدارة حملات الإرسال الجماعي مع الحماية من الحظر</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          حملة جديدة
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-card border border-card-border rounded-xl p-6">
          <h2 className="text-base font-semibold mb-4">إنشاء حملة جديدة</h2>
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Basic settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1.5">اسم الحملة *</label>
                <input {...register("name", { required: true })} placeholder="مثال: حملة رمضان 2025" className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
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
                  {sessions?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.status === "connected" ? "✅" : s.status === "banned" ? "🚫" : "⚪"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">تأخير بين الرسائل (ثانية)</label>
                <div className="flex items-center gap-2">
                  <input {...register("delayMin")} type="number" min="1" className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="8" />
                  <span className="text-muted-foreground text-sm shrink-0">إلى</span>
                  <input {...register("delayMax")} type="number" min="1" className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="20" />
                </div>
              </div>
            </div>

            {/* Anti-ban accordion */}
            <div className="border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAntiban(!showAntiban)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">إعدادات الحماية من الحظر</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">مُفعّل</span>
                </div>
                {showAntiban ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {showAntiban && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-card">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">حجم الدفعة</label>
                    <input {...register("batchSize")} type="number" min="1" max="100" className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    <p className="text-xs text-muted-foreground mt-1">عدد الرسائل قبل التوقف الطويل</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">مدة التوقف الطويل (ثانية)</label>
                    <input {...register("batchPauseSeconds")} type="number" min="30" className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    <p className="text-xs text-muted-foreground mt-1">الراحة بين الدفعات (120 ثانية = دقيقتان)</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" id="variation" {...register("enableVariation")} className="mt-0.5 w-4 h-4 rounded border-border accent-primary" />
                    <div>
                      <label htmlFor="variation" className="text-sm font-medium text-foreground cursor-pointer">تنويع الرسائل</label>
                      <p className="text-xs text-muted-foreground mt-0.5">إضافة تغيير خفي لكل رسالة لتفادي فلاتر البريد العشوائي</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" id="stopOnBan" {...register("stopOnBan")} className="mt-0.5 w-4 h-4 rounded border-border accent-primary" />
                    <div>
                      <label htmlFor="stopOnBan" className="text-sm font-medium text-foreground cursor-pointer">إيقاف تلقائي عند الحظر</label>
                      <p className="text-xs text-muted-foreground mt-0.5">توقف فوري عند رصد 5 فشل متتالي</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 justify-end">
              <button type="button" onClick={() => { setShowForm(false); setShowAntiban(false); reset(); }} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">إلغاء</button>
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
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-card border border-card-border rounded-xl animate-pulse" />)}
        </div>
      ) : campaigns?.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl flex flex-col items-center justify-center py-16">
          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mb-4">
            <ShieldCheck className="w-7 h-7 text-muted-foreground/50" />
          </div>
          <p className="text-base font-medium text-foreground">لا توجد حملات</p>
          <p className="text-sm text-muted-foreground mt-1">أنشئ حملتك الأولى مع إعدادات الحماية</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns?.map((c) => (
            <div key={c.id} className="bg-card border border-card-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <p className="font-semibold text-foreground">{c.name}</p>
                    <StatusBadge status={c.status} />
                    {/* Anti-ban badges */}
                    {c.enableVariation && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">🔄 تنويع</span>
                    )}
                    {c.stopOnBan && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">🛡️ حماية</span>
                    )}
                  </div>
                  <ProgressBar sent={c.sentCount} total={c.totalCount} />
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                    <span className="text-green-600">{c.deliveredCount} وصل</span>
                    <span className="text-red-500">{c.failedCount} فشل</span>
                    <span>تأخير: {c.delayMin}–{c.delayMax}s</span>
                    <span>دفعة: {c.batchSize} رسالة / توقف {c.batchPauseSeconds}s</span>
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
                  <button onClick={() => handleDelete(c.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
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
