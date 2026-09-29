"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Ticket,
  Wallet,
  BrainCircuit,
  Mail,
  MessagesSquare,
  ShieldAlert,
  ChartNoAxesCombined,
  Server,
  GitBranch,
  ScrollText,
  Settings,
  LogOut,
  Menu,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { navigation } from "@/lib/catalog";
import { canRead } from "@/lib/rbac";
import type { Actor } from "@/lib/contracts";
const icons = [
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Ticket,
  Wallet,
  BrainCircuit,
  Mail,
  MessagesSquare,
  ShieldAlert,
  ChartNoAxesCombined,
  Server,
  GitBranch,
  ScrollText,
  Settings,
];
export default function Shell({
  actor,
  children,
}: {
  actor: Actor;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const current = navigation.find((item) => path.startsWith(`/${item.id}`));
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }
  return (
    <div
      className="app-shell"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <aside id="main-nav" className={`sidebar ${open ? "is-open" : ""}`}>
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">
            V<span>·</span>
          </span>
          <div>
            Visual Deadline<small>运营控制台</small>
          </div>
        </Link>
        <div className="workspace-badge">
          <ShieldCheck size={15} />
          <span>内部工作空间</span>
          <span className="tiny-dot" />
        </div>
        <nav aria-label="主要导航">
          {navigation.map((item, index) => {
            const Icon = icons[index];
            if (!canRead(actor.role, item.id)) return null;
            return (
              <div key={item.id}>
                {(index === 0 ||
                  item.group !== navigation[index - 1].group) && (
                  <p className="nav-group">{item.group}</p>
                )}
                <Link
                  onClick={() => setOpen(false)}
                  href={`/${item.id}`}
                  className={`nav-item ${path.startsWith(`/${item.id}`) ? "active" : ""}`}
                >
                  <Icon size={17} />
                  {item.label}
                  {path.startsWith(`/${item.id}`) && (
                    <span className="active-dot" />
                  )}
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">{actor.email.slice(0, 1).toUpperCase()}</div>
          <div className="operator">
            <strong>所有者</strong>
            <small title={actor.email}>{actor.email}</small>
          </div>
          <button
            className="icon-button"
            onClick={logout}
            aria-label="退出登录"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {open && (
        <button
          className="sidebar-overlay"
          onClick={() => setOpen(false)}
          aria-label="关闭导航"
        />
      )}
      <div className="main-frame">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setOpen(!open)}
              aria-label="打开导航"
              aria-controls="main-nav"
              aria-expanded={open}
            >
              <Menu size={20} />
            </button>
            <span>运营工作台</span>
            <ChevronRight size={14} />
            <strong>{current?.label ?? "用户详情"}</strong>
          </div>
          <div className="header-meta">
            <span className="status-pill">
              <span className="tiny-dot" />
              权限已验证
            </span>
            <span className="header-divider" />
            <span>控制台 · 0.1</span>
          </div>
        </header>
        <main className="main-content">{children}</main>
        <footer className="page-footer">
          <span>Visual Deadline 内部运营系统</span>
          <span>北京时间 · 最小权限 · 操作留痕</span>
        </footer>
      </div>
    </div>
  );
}
