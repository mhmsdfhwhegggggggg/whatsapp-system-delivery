import { useParams, Link } from "wouter";
import {
  useGetCampaign,
  useListCampaignMessages,
  useStartCampaign,
  usePauseCampaign,
  useResumeCampaign,
  getGetCampaignQueryKey,
  getListCampaignMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Play, Pause, RotateCcw, CheckCircle2, XCircle, Clock, Send } from "lucide-react";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "مسودة", cls: "bg-muted text-muted-foreground" },
    running: { label: "يعمل", cls: "bg-green-100 text-green-700" },
    paused: { label: "متوقف", cls: "bg-yellow-100 text-yellow-700" },
    completed: { label: "مكتمل", cls: "bg-blue-100 text-blue-700" },
    failed: { label: "فشل", cls: "bg-red-100 text-red-700" },
    pending: { label: "في الانتظار", cls: "bg-gray-100 text-gray-600" },
    sent: { label: "مرسل", cls: "bg-blue-100 text-blue-700" },
    delivered: { label: "وصل", cls: "bg-green-100 text-green-700" },
  };
  const s = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", s.cls)}>{s.label}</span>;
}

function MsgIcon({ status }: { status: string }) {
  if (status === "delivered") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-500" />;
  if (status === "sent") return <Send className="w-4 h-4 text-blue-500" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const numId = Number(id);
  const qc = useQueryClient();

  const { data: campaign, isLoading } = useGetCampaign(numId, {
    query: { enabled: !!numId, queryKey: getGetCampaignQueryKey(numId), refetchInterval: 3000 },
  });
  const { data: messages } = useListCampaignMessages(numId, {
    query: { enabled: !!numId, queryKey: getListCampaignMessagesQueryKey(numId), refetchInterval: 3000 },
  });

  const startCampaign = useStartCampaign();
  const pauseCampaign = usePauseCampaign();
  const resumeCampaign = useResumeCampaign();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getGetCampaignQueryKey(numId) });
    qc.invalidateQueries({ queryKey: getListCampaignMessagesQueryKey(numId) });
  };

  const handleStart = () => startCampaign.mutate({ id: numId }, { onSuccess: refresh });
  const handlePause = () => pauseCampaign.mutate({ id: numId }, { onSuccess: refresh });
  const handleResume = () => resumeCampaign.mutate({ id: numId }, { onSuccess: refresh });

  const pct = campaign && campaign.totalCount > 0 ? Math.min((campaign.sentCount / campaign.totalCount) * 100, 100) : 0;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-card border border-card-border rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-muted-foreground">الحملة غير موجودة</p>
        <Link to="/campaigns"><a className="text-primary text-sm mt-2 inline-block">العودة للحملات</a></Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/campaigns">
          <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-foreground">{campaign.name}</h1>
            <StatusBadge status={campaign.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <RotateCcw className="w-4 h-4" />
          </button>
          {(campaign.status === "draft" || campaign.status === "paused") && (
            <button
              onClick={campaign.status === "paused" ? handleResume : handleStart}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Play className="w-4 h-4" />
              {campaign.status === "paused" ? "استئناف" : "بدء الإرسال"}
            </button>
          )}
          {campaign.status === "running" && (
            <button
              onClick={handlePause}
              className="flex items-center gap-2 bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-200 transition-colors"
            >
              <Pause className="w-4 h-4" />
              إيقاف مؤقت
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي", value: campaign.totalCount, color: "text-foreground" },
          { label: "مرسل", value: campaign.sentCount, color: "text-blue-600" },
          { label: "وصل", value: campaign.deliveredCount, color: "text-green-600" },
          { label: "فشل", value: campaign.failedCount, color: "text-red-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-card-border rounded-xl p-4 text-center">
            <p className={cn("text-2xl font-bold", color)}>{value}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold">التقدم</h2>
          <span className="text-sm font-medium text-primary">{Math.round(pct)}%</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", campaign.status === "running" ? "animate-pulse" : "")}
            style={{
              width: `${pct}%`,
              background: "hsl(var(--primary))",
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>{campaign.sentCount} رسالة مرسلة</span>
          <span>{campaign.totalCount - campaign.sentCount} متبقية</span>
        </div>
      </div>

      {/* Message log */}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">سجل الرسائل</h2>
        </div>
        {!messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="w-10 h-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد رسائل بعد. ابدأ الحملة لرؤية السجل.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-center gap-4 px-5 py-3">
                <MsgIcon status={msg.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{msg.contactName || msg.phone}</p>
                  <p className="text-xs text-muted-foreground">{msg.phone}</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={msg.status} />
                  {msg.errorMessage && (
                    <p className="text-xs text-destructive mt-1">{msg.errorMessage}</p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground w-24 text-left shrink-0">
                  {msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString("ar") : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
