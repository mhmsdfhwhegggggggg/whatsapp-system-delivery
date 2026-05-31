import { useState } from "react";
import {
  useListTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  getListTemplatesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit2, X, FileText, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

function TemplatePreview({ content }: { content: string }) {
  // Highlight {{variable}} placeholders
  const parts = content.split(/(\{\{[^}]+\}\})/g);
  return (
    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) =>
        /^\{\{[^}]+\}\}$/.test(part) ? (
          <span key={i} className="bg-primary/15 text-primary px-1 py-0.5 rounded text-xs font-mono font-medium">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

interface FormState {
  name: string;
  content: string;
  mediaType: string;
  mediaUrl: string;
}

export default function Templates() {
  const qc = useQueryClient();
  const { data: templates, isLoading } = useListTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", content: "", mediaType: "", mediaUrl: "" });

  const openCreate = () => { setEditId(null); setForm({ name: "", content: "", mediaType: "", mediaUrl: "" }); setShowForm(true); };
  const openEdit = (t: any) => { setEditId(t.id); setForm({ name: t.name, content: t.content, mediaType: t.mediaType ?? "", mediaUrl: t.mediaUrl ?? "" }); setShowForm(true); };

  const handleSave = () => {
    const data = {
      name: form.name,
      content: form.content,
      ...(form.mediaType ? { mediaType: form.mediaType as "image" | "video" | "document" } : {}),
      ...(form.mediaUrl ? { mediaUrl: form.mediaUrl } : {}),
    };
    if (editId) {
      updateTemplate.mutate({ id: editId, data }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListTemplatesQueryKey() }); setShowForm(false); } });
    } else {
      createTemplate.mutate({ data }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListTemplatesQueryKey() }); setShowForm(false); } });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("هل تريد حذف هذا القالب؟")) {
      deleteTemplate.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListTemplatesQueryKey() }) });
    }
  };

  // Extract variables from content
  const vars = [...new Set([...form.content.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">قوالب الرسائل</h1>
          <p className="text-sm text-muted-foreground mt-1">إنشاء وإدارة قوالب الرسائل مع المتغيرات الديناميكية</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" />
          قالب جديد
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card border border-card-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">{editId ? "تعديل القالب" : "قالب جديد"}</h2>
            <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">اسم القالب *</label>
              <input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="مثال: رسالة ترحيب"
                className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                نص الرسالة *
                <span className="text-xs text-muted-foreground font-normal mr-2">استخدم &#123;&#123;name&#125;&#125; للمتغيرات</span>
              </label>
              <textarea
                value={form.content}
                onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder={"مرحباً {{name}}،\n\nرسالتك هنا..."}
                rows={5}
                className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              {vars.length > 0 && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">المتغيرات:</span>
                  {vars.map(v => (
                    <span key={v} className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded font-mono">{`{{${v}}}`}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">نوع الوسائط</label>
                <select value={form.mediaType} onChange={(e) => setForm(f => ({ ...f, mediaType: e.target.value }))} className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">بدون وسائط</option>
                  <option value="image">صورة</option>
                  <option value="video">فيديو</option>
                  <option value="document">مستند</option>
                </select>
              </div>
              {form.mediaType && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">رابط الملف</label>
                  <input value={form.mediaUrl} onChange={(e) => setForm(f => ({ ...f, mediaUrl: e.target.value }))} placeholder="https://..." className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" dir="ltr" />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">إلغاء</button>
              <button onClick={handleSave} disabled={!form.name || !form.content || createTemplate.isPending || updateTemplate.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {createTemplate.isPending || updateTemplate.isPending ? "جار الحفظ..." : "حفظ القالب"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 bg-card border border-card-border rounded-xl animate-pulse" />)}
        </div>
      ) : templates?.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl flex flex-col items-center justify-center py-16">
          <FileText className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <p className="text-base font-medium text-foreground">لا توجد قوالب</p>
          <p className="text-sm text-muted-foreground mt-1">أنشئ قالبك الأول مع متغيرات ديناميكية</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {templates?.map((t) => (
            <div key={t.id} className="bg-card border border-card-border rounded-xl overflow-hidden group">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{t.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {(t.variables ?? []).map(v => (
                      <span key={v} className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">{`{{${v}}}`}</span>
                    ))}
                    {t.mediaType && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded capitalize">{t.mediaType}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPreview(preview === t.id ? null : t.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors" title="معاينة">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors" title="تعديل">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="حذف">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {preview === t.id ? (
                <div className="px-5 py-4 bg-accent/30">
                  <TemplatePreview content={t.content} />
                </div>
              ) : (
                <div className="px-5 py-4">
                  <p className="text-sm text-muted-foreground line-clamp-3">{t.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
