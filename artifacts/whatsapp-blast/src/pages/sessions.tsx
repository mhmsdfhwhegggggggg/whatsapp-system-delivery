import { useState } from "react";
import {
  useListSessions,
  useCreateSession,
  useDeleteSession,
  useGetSessionQr,
  useListBlacklist,
  useAddToBlacklist,
  useRemoveFromBlacklist,
  getListSessionsQueryKey,
  getGetSessionQrQueryKey,
  getListBlacklistQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Wifi, WifiOff, Loader2, ShieldAlert, Smartphone, ShieldOff, List } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Warm-up schedule ─────────────────────────────────────────────────────────
const WARMUP_SCHEDULE = [30, 60, 100, 150, 200, 250, 300];
function getWarmupLimit(day: number, configuredLimit: number) {
  if (day <= 0 || day > WARMUP_SCHEDULE.length) return configuredLimit;
  return Math.min(WARMUP_SCHEDULE[day - 1], configuredLimit);
}

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
      refetchInterval: 4000,
    },
  });

  if (!data?.qr) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Smartphone className="w-10 h-10 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">في انتظار رمز QR...</p>
        <p className="text-xs text-muted-foreground mt-1">سيظهر هنا خلال ثوانٍ</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-5 px-4">
      <img src={data.qr} alt="QR Code" className="w-52 h-52 rounded-xl border-2 border-primary/20 shadow-sm" />
      <div className="mt-3 text-center max-w-xs">
        <p className="text-sm font-medium text-foreground">امسح رمز QR لربط الحساب</p>
        <p className="text-xs text-muted-foreground mt-1">
          افتح واتساب ← المزيد (⋮) ← الأجهزة المرتبطة ← ربط جهاز
        </p>
      </div>
    </div>
  );
}

function BlacklistPanel() {
  const qc = useQueryClient();
  const { data: blacklist } = useListBlacklist({ query: { queryKey: getListBlacklistQueryKey() } });
  const addBlacklist = useAddToBlacklist();
  const removeBlacklist = useRemoveFromBlacklist();
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");

  const handleAdd = () => {
    if (!phone.trim()) return;
    addBlacklist.mutate({ data: { phone, reason: reason || undefined } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListBlacklistQueryKey() });
        setPhone("");
        setReason("");
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+966501234567"
          className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          dir="ltr"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="السبب (اختياري)"
          className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={handleAdd}
          disabled={!phone.trim() || addBlacklist.isPending}
          className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          إضافة
        </button>
      </div>

      {!blacklist || blacklist.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">القائمة السوداء فارغة</div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
          {blacklist.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
              <ShieldOff className="w-4 h-4 text-destructive flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground" dir="ltr">{entry.phone}</p>
                {entry.reason && <p className="text-xs text-muted-foreground">{entry.reason}</p>}
              </div>
              <button
                onClick={() => removeBlacklist.mutate({ id: entry.id }, {
                  onSuccess: () => qc.invalidateQueries({ queryKey: getListBlacklistQueryKey() }),
                })}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
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
  const [dailyLimit, setDailyLimit] = useState("50");
  const [sendStart, setSendStart] = useState("9");
  const [sendEnd, setSendEnd] = useState("21");
  const [qrSession, setQrSession] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"sessions" | "blacklist">("sessions");

  const handleCreate = () => {
    if (!name.trim()) return;
    createSession.mutate({
      data: {
        name,
        dailyLimit: Number(dailyLimit),
        warmupMode: true,
        sendHourStart: Number(sendStart),
        sendHourEnd: Number(sendEnd),
      },
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        setName("");
        setDailyLimit("50");
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
          <h1 className="text-2xl font-bold text-foreground">الحماية من الحظر</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة حسابات واتساب + نظام الحماية المتكامل</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          إضافة حساب
        </button>
      </div>

      {/* Anti-ban info cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { icon: "🔥", title: "Warm-up تلقائي", desc: "يوم 1: 30 رسالة، يوم 2: 60، يوم 3: 100... حتى يصل للحد الكامل تلقائياً" },
          { icon: "⏰", title: "نافذة زمنية", desc: "الإرسال فقط بين ساعتين محددتين (مثلاً 9ص–9م) لتقليد السلوك البشري" },
          { icon: "🛡️", title: "كشف الحظر التلقائي", desc: "عند 5 فشل متتاليين، يتوقف الإرسال فوراً ويُعلّم الحساب كمحظور" },
        ].map((card) => (
          <div key={card.title} className="bg-card border border-card-border rounded-xl p-4">
            <div className="text-2xl mb-2">{card.icon}</div>
            <p className="text-sm font-semibold text-foreground">{card.title}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("sessions")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === "sessions" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          <Smartphone className="w-4 h-4" />
          الحسابات
        </button>
        <button
          onClick={() => setActiveTab("blacklist")}
          className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === "blacklist" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          <ShieldOff className="w-4 h-4" />
          القائمة السوداء
        </button>
      </div>

      {activeTab === "blacklist" && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-base font-semibold mb-4">القائمة السوداء — أرقام محظورة من الإرسال</h2>
          <BlacklistPanel />
        </div>
      )}

      {activeTab === "sessions" && (
        <>
          {/* Create form */}
          {showForm && (
            <div className="bg-card border border-card-border rounded-xl p-5">
              <h2 className="text-sm font-semibold mb-4">إضافة حساب واتساب جديد</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">اسم الحساب *</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: حساب الأعمال الرئيسي" className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">الحد اليومي القصوى</label>
                  <input value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} type="number" min="10" max="1000" className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  <p className="text-xs text-muted-foreground mt-1">سيبدأ warm-up من 30 تلقائياً</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">نافذة الإرسال</label>
                  <div className="flex items-center gap-2">
                    <input value={sendStart} onChange={(e) => setSendStart(e.target.value)} type="number" min="0" max="23" className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="9" />
                    <span className="text-muted-foreground">—</span>
                    <input value={sendEnd} onChange={(e) => setSendEnd(e.target.value)} type="number" min="1" max="24" className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="21" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">ساعة البداية — ساعة النهاية (24h)</p>
                </div>
                <div className="col-span-2 flex justify-end gap-2 pt-1">
                  <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">إلغاء</button>
                  <button onClick={handleCreate} disabled={!name.trim() || createSession.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                    {createSession.isPending ? "جار الإضافة..." : "إضافة وربط"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sessions list */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-24 bg-card border border-card-border rounded-xl animate-pulse" />)}
            </div>
          ) : sessions?.length === 0 ? (
            <div className="bg-card border border-card-border rounded-xl flex flex-col items-center justify-center py-16">
              <Smartphone className="w-12 h-12 text-muted-foreground/40 mb-3" />
              <p className="text-base font-medium text-foreground">لا توجد حسابات مضافة</p>
              <p className="text-sm text-muted-foreground mt-1">أضف حساب واتساب وسيُطلب رمز QR للمسح</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions?.map((s) => {
                const warmupDay = s.warmupDay ?? 1;
                const dailyLimitVal = s.dailyLimit ?? 50;
                const effectiveLimit = s.warmupMode ? getWarmupLimit(warmupDay, dailyLimitVal) : dailyLimitVal;
                const dailySent = s.dailySentCount ?? 0;
                const pct = Math.min((dailySent / Math.max(effectiveLimit, 1)) * 100, 100);

                return (
                  <div key={s.id} className="bg-card border border-card-border rounded-xl overflow-hidden">
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <StatusIcon status={s.status} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <p className="font-semibold text-foreground">{s.name}</p>
                          <StatusLabel status={s.status} />
                          {s.warmupMode && warmupDay <= 7 && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                              🔥 Warm-up يوم {warmupDay}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                          {s.phone && <span dir="ltr">{s.phone}</span>}
                          <span>اليوم: {dailySent}/{effectiveLimit}</span>
                          <span>⏰ {s.sendHourStart ?? 9}:00–{s.sendHourEnd ?? 21}:00</span>
                          {(s.consecutiveFailures ?? 0) > 0 && (
                            <span className="text-orange-500">⚠️ {s.consecutiveFailures} فشل متتالي</span>
                          )}
                        </div>
                        {/* Daily progress */}
                        <div className="mt-2">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden w-48">
                            <div
                              className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-destructive" : "bg-primary")}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => setQrSession(qrSession === s.id ? null : s.id)}
                          className="px-3 py-1.5 rounded-lg bg-muted hover:bg-accent text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
                        >
                          QR
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {qrSession === s.id && (
                      <div className="border-t border-border bg-muted/20">
                        <QrPanel sessionId={s.id} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
