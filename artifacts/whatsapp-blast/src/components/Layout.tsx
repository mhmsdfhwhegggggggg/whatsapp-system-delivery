import { Link, useRoute, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Megaphone,
  Users,
  FileText,
  Smartphone,
  BarChart3,
  MessageCircle,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const nav = [
  { to: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/campaigns", label: "الحملات", icon: Megaphone },
  { to: "/contacts", label: "جهات الاتصال", icon: Users },
  { to: "/templates", label: "القوالب", icon: FileText },
  { to: "/sessions", label: "الحسابات", icon: Smartphone },
  { to: "/analytics", label: "التحليلات", icon: BarChart3 },
];

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ElementType }) {
  const [isActive] = useRoute(to === "/" ? "/" : to + "/*?");
  const [isExact] = useRoute(to);
  const active = to === "/" ? isExact : (isActive || isExact);
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background" dir="rtl">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-30 w-64 bg-sidebar border-l border-sidebar-border flex flex-col transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-bold text-sidebar-foreground">WhatsBlast</div>
            <div className="text-xs text-muted-foreground">نظام الإرسال الجماعي</div>
          </div>
          <button
            className="mr-auto lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-sidebar-border">
          <div className="text-xs text-muted-foreground text-center">
            WhatsBlast v1.0
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold">WhatsBlast</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
