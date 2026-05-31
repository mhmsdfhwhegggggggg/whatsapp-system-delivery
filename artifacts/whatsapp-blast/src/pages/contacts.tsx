import { useState } from "react";
import {
  useListContactGroups,
  useListContacts,
  useCreateContactGroup,
  useDeleteContactGroup,
  useAddContact,
  useDeleteContact,
  useImportContacts,
  getListContactGroupsQueryKey,
  getListContactsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Users, Upload, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Contacts() {
  const qc = useQueryClient();
  const { data: groups, isLoading } = useListContactGroups();
  const createGroup = useCreateContactGroup();
  const deleteGroup = useDeleteContactGroup();
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [showAddContact, setShowAddContact] = useState<number | null>(null);
  const [showImport, setShowImport] = useState<number | null>(null);
  const [contactPhone, setContactPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [csvData, setCsvData] = useState("");

  const addContact = useAddContact();
  const deleteContact = useDeleteContact();
  const importContacts = useImportContacts();

  const { data: contacts } = useListContacts(expandedGroup ?? 0, {
    query: { enabled: !!expandedGroup, queryKey: getListContactsQueryKey(expandedGroup ?? 0) },
  });

  const handleCreateGroup = () => {
    if (!groupName.trim()) return;
    createGroup.mutate({ data: { name: groupName, description: groupDesc } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListContactGroupsQueryKey() });
        setGroupName("");
        setGroupDesc("");
        setShowGroupForm(false);
      },
    });
  };

  const handleDeleteGroup = (id: number) => {
    if (confirm("هل تريد حذف هذه المجموعة؟ سيتم حذف جميع جهات الاتصال فيها.")) {
      deleteGroup.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListContactGroupsQueryKey() }) });
    }
  };

  const handleAddContact = (groupId: number) => {
    if (!contactPhone.trim()) return;
    addContact.mutate({ id: groupId, data: { phone: contactPhone, name: contactName } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListContactGroupsQueryKey() });
        qc.invalidateQueries({ queryKey: getListContactsQueryKey(groupId) });
        setContactPhone("");
        setContactName("");
        setShowAddContact(null);
      },
    });
  };

  const handleImport = (groupId: number) => {
    if (!csvData.trim()) return;
    importContacts.mutate({ id: groupId, data: { csvData } }, {
      onSuccess: (result) => {
        qc.invalidateQueries({ queryKey: getListContactGroupsQueryKey() });
        qc.invalidateQueries({ queryKey: getListContactsQueryKey(groupId) });
        alert(`تم الاستيراد: ${result.imported} جديد، ${result.duplicates} مكرر، ${result.errors} خطأ`);
        setCsvData("");
        setShowImport(null);
      },
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">جهات الاتصال</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة قوائم جهات الاتصال للحملات</p>
        </div>
        <button
          onClick={() => setShowGroupForm(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          مجموعة جديدة
        </button>
      </div>

      {/* Create group form */}
      {showGroupForm && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-3">إنشاء مجموعة جديدة</h2>
          <div className="flex gap-3">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="اسم المجموعة *"
              className="flex-1 bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              placeholder="الوصف (اختياري)"
              className="flex-1 bg-background border border-input rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button onClick={handleCreateGroup} className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">إنشاء</button>
            <button onClick={() => setShowGroupForm(false)} className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-muted">إلغاء</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-card border border-card-border rounded-xl animate-pulse" />)}
        </div>
      ) : groups?.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl flex flex-col items-center justify-center py-16">
          <Users className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <p className="text-base font-medium text-foreground">لا توجد مجموعات</p>
          <p className="text-sm text-muted-foreground mt-1">أنشئ مجموعتك الأولى وأضف جهات الاتصال</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups?.map((group) => (
            <div key={group.id} className="bg-card border border-card-border rounded-xl overflow-hidden">
              {/* Group header */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{group.name}</p>
                  <p className="text-sm text-muted-foreground">{(group as any).contactCount ?? 0} جهة اتصال {group.description ? `· ${group.description}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowImport(showImport === group.id ? null : group.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-accent text-muted-foreground hover:text-accent-foreground text-xs font-medium transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    استيراد
                  </button>
                  <button
                    onClick={() => setShowAddContact(showAddContact === group.id ? null : group.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة
                  </button>
                  <button
                    onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                  >
                    {expandedGroup === group.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleDeleteGroup(group.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Import CSV */}
              {showImport === group.id && (
                <div className="px-5 pb-4 border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground mb-2">الصق بيانات CSV (مع رأس: phone, name, ...)</p>
                  <textarea
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    placeholder={"phone,name,city\n+966501234567,أحمد,الرياض\n+966502345678,محمد,جدة"}
                    rows={4}
                    className="w-full bg-background border border-input rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                    dir="ltr"
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => handleImport(group.id)} disabled={importContacts.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                      {importContacts.isPending ? "جار الاستيراد..." : "استيراد"}
                    </button>
                    <button onClick={() => { setShowImport(null); setCsvData(""); }} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">إلغاء</button>
                  </div>
                </div>
              )}

              {/* Add contact inline */}
              {showAddContact === group.id && (
                <div className="px-5 pb-4 border-t border-border pt-3">
                  <div className="flex gap-2">
                    <input
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+966501234567"
                      className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      dir="ltr"
                    />
                    <input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="الاسم (اختياري)"
                      className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button onClick={() => handleAddContact(group.id)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">إضافة</button>
                    <button onClick={() => setShowAddContact(null)} className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted">×</button>
                  </div>
                </div>
              )}

              {/* Contacts list */}
              {expandedGroup === group.id && (
                <div className="border-t border-border">
                  {!contacts || contacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">لا توجد جهات اتصال في هذه المجموعة</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {contacts.map((c) => (
                        <div key={c.id} className="flex items-center gap-4 px-5 py-3">
                          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-medium text-accent-foreground flex-shrink-0">
                            {c.name ? c.name[0] : c.phone[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{c.name || "—"}</p>
                            <p className="text-xs text-muted-foreground" dir="ltr">{c.phone}</p>
                          </div>
                          <button
                            onClick={() => {
                              deleteContact.mutate({ id: c.id }, {
                                onSuccess: () => {
                                  qc.invalidateQueries({ queryKey: getListContactGroupsQueryKey() });
                                  qc.invalidateQueries({ queryKey: getListContactsQueryKey(group.id) });
                                },
                              });
                            }}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
