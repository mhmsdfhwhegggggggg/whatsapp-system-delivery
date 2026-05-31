import { useState } from "react";
import {
  useListSessions,
  useCreateSession,
  useDeleteSession,
  useGetSessionQr,
  getListSessionsQueryKey,
  getGetSessionQrQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Wifi, WifiOff, Loader2, ShieldAlert, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

function StatusIcon({ status }: { status: string }) {
  if (status === "connected") return <Wifi className="w-4 h-4 text-green-500" />;
  if (status === "connecting") return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
  if (status === "banned") return <ShieldAlert className="w-4 h-4 text-red-500" />;
  return <WifiOff className="w-4 h-4 text-muted-foreground" />;
}

function StatusLabel({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    connected: { label: "متصل", cls: "bg-green-100 text-green-700" },
    connecting: { label: "جاري الاتصال", cls: "bg-yellow-100 text-yellow-700" },
    disconnected: { label: "غير متصل", cls: "bg-muted text-muted-foreground" },
    banned: { label: "محظور", cls: "bg-red-100 text-red-700" },
  };
  const s = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", s.cls)}>{s.label}</span>;
}

function QrPanel({ sessionId }: { sessionId: number }) {
  const { data } = useGetSessionQr(sessionId, {
    query: {
      enabled: true,
      queryKey: getGetSessionQrQueryKey(sessionId),
      refetchInterval: 5000,
    },
  });

  if (!data?.qr) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center">
        <Smartphone className="w-10 h-10 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">لا يوجد رمز QR متاح</p>
        <p className="text-xs text-muted-foreground mt-1">الحساب متصل أو لم يتم توليد رمز بعد</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-4">
      <img src={data.qr} alt="QR Code" className="w-48 h-48 rounded-lg border border-border" />
      <p className="text-xs text-muted-foreground mt-3 text-center">افتح واتساب على هاتفك ← المزيد ← الأجهزة المرتبطة ← ربط جهاز</p>
    </div>
  );
}

export default function Sessions() {
  const qc = useQueryClient();
  const { data: sessions, isLoading } = useListSessions();
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [dailyLimit, setDailyLimit] = useState("300");
  const [qrSession, setQrSession] = useState<number | null>(null);

  const handleCreate = () => {
    if (!name.trim()) return;
    createSession.mutate({ data: { name, dailyLimit: Number(dailyLimit) } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        setName("");
        setDailyLimit("300");
        setShowForm(false);
      },
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("هل تريد حذف هذا الحساب؟")) {
      deleteSession.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListSessionsQueryKey() }) });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">حسابات واتساب</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة جلسات واتساب للإرسال الجماعي</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          إضافة حساب
        </button>
      </div>

      {/* Anti-ban info */}
      <div className="bg-accent/40 border border-accent-border rounded-xl px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <ShieldAlert className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">نظام الحماية من الحظر</p>
            <p className="text-sm text-muted-foreground mt-0.5">يتم إرسال الرسائل بفترات عشوائية بين كل رسالة. الحد اليومي يحميك من الحظر. يوصى بـ 50 رسالة في اليوم الأول وما يصل إلى 300 يومياً بعد ذلك.</p>
          </div>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-3">إضافة حساب جديد</h2>
          <div className="flex gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم الحساب (مثال: حساب الأعمال)"
              className="flex-1 bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">الحد اليومي:</span>
              <input
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                type="number"
                min="1"
                max="1000"
                className="w-24 bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button onClick={handleCreate} disabled={createSession.isPending} className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {createSession.isPending ? "جار الإضافة..." : "إضافة"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted">إلغاء</button>
          </div>
        </div>
      )}

      {/* Sessions list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-card border border-card-border rounded-xl animate-pulse" />)}
        </div>
      ) : sessions?.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl flex flex-col items-center justify-center py-16">
          <Smartphone className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <p className="text-base font-medium text-foreground">لا توجد حسابات مضافة</p>
          <p className="text-sm text-muted-foreground mt-1">أضف حساب واتساب وامسح رمز QR للربط</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions?.map((s) => (
            <div key={s.id} className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <StatusIcon status={s.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-foreground">{s.name}</p>
                    <StatusLabel status={s.status} />
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    {s.phone && <span dir="ltr">{s.phone}</span>}
                    <span>الحد اليومي: {s.dailyLimit}</span>
                    <span>المرسل اليوم: {s.dailySentCount}</span>
                  </div>
                </div>

                {/* Daily progress */}
                <div className="hidden md:block w-32">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{s.dailySentCount}</span>
                    <span>{s.dailyLimit}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(((s.dailySentCount ?? 0) / (s.dailyLimit ?? 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQrSession(qrSession === s.id ? null : s.id)}
                    className="px-3 py-1.5 rounded-lg bg-muted hover:bg-accent text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
                  >
                    رمز QR
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {qrSession === s.id && (
                <div className="border-t border-border bg-muted/30">
                  <QrPanel sessionId={s.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
