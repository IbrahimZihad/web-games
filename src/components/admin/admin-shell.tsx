"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  Gamepad2,
  LayoutDashboard,
  Menu,
  PlusCircle,
  ShieldCheck,
  Tags,
  X,
  type LucideIcon,
} from "lucide-react";
import type { SessionUser } from "@/lib/types";
import styles from "./admin.module.css";

const navigation: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Games", href: "/admin/games", icon: Gamepad2 },
  { label: "Add game", href: "/admin/games/new", icon: PlusCircle },
  { label: "Categories & tags", href: "/admin/categories", icon: Tags },
];

function isNavigationActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/games/new") return pathname === href;
  if (href === "/admin/games") {
    return pathname.startsWith("/admin/games") && pathname !== "/admin/games/new";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <Link href="/admin" className={styles.brand} aria-label="Nexus admin overview">
      <span className={styles.brandMark}><Gamepad2 size={22} strokeWidth={2.3} /></span>
      <span className={styles.brandCopy}>
        <span className={styles.brandName}>NEXUS<span>.</span></span>
        <span className={styles.brandSubtitle}>Admin console</span>
      </span>
    </Link>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <div className={styles.sidebarBrand}><Brand /></div>
      <div className={styles.sidebarNavWrap}>
        <p className={styles.sidebarLabel}>Workspace</p>
        <nav className={styles.sidebarNav} aria-label="Admin navigation">
          {navigation.map((item) => {
            const active = isNavigationActive(item.href, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
                {active ? <span className={styles.navActiveDot} aria-hidden="true" /> : null}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className={styles.sidebarFooter}>
        <div className={styles.protectedNote}>
          <ShieldCheck size={18} aria-hidden="true" />
          <div><strong>Protected workspace</strong><span>Administrator access only</span></div>
        </div>
      </div>
    </>
  );
}

function getSectionLabel(pathname: string): string {
  if (pathname === "/admin") return "Overview";
  if (pathname === "/admin/games/new") return "Add game";
  if (/^\/admin\/games\/[^/]+\/edit$/.test(pathname)) return "Edit game";
  if (pathname.startsWith("/admin/games")) return "Games";
  if (pathname.startsWith("/admin/categories")) return "Categories & tags";
  return "Admin";
}

export function AdminShell({ admin, children }: { admin: SessionUser; children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mobileSidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const menuButton = menuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab" || !mobileSidebarRef.current) return;
      const focusable = Array.from(mobileSidebarRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
      else menuButton?.focus();
    };
  }, [mobileOpen]);

  return (
    <div className={styles.shell}>
      <a href="#admin-content" className={styles.skipLink}>Skip to admin content</a>
      <aside className={styles.desktopSidebar}><SidebarContent pathname={pathname} /></aside>

      {mobileOpen ? (
        <>
          <button type="button" className={styles.mobileBackdrop} aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
          <aside ref={mobileSidebarRef} className={styles.mobileSidebar} role="dialog" aria-modal="true" aria-label="Admin navigation">
            <button ref={closeButtonRef} type="button" className={styles.mobileClose} onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button>
            <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      ) : null}

      <div className={styles.shellContent}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button ref={menuButtonRef} type="button" className={styles.menuButton} onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen}>
              <Menu size={20} />
            </button>
            <div className={styles.breadcrumb}><span>Admin</span><span aria-hidden="true">/</span><strong>{getSectionLabel(pathname)}</strong></div>
          </div>
          <div className={styles.topbarRight}>
            <Link href="/" className={styles.viewSiteLink}><ExternalLink size={15} /> <span>View site</span></Link>
            <span className={styles.topbarDivider} aria-hidden="true" />
            <div className={styles.adminIdentity}>
              <span className={styles.adminAvatar}>
                {admin.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={admin.avatarUrl} alt="" />
                ) : admin.username.charAt(0).toUpperCase()}
              </span>
              <span className={styles.adminIdentityCopy}><strong>{admin.username}</strong><span>{admin.email}</span></span>
              <span className={styles.adminRole}>Admin</span>
            </div>
          </div>
        </header>
        <main id="admin-content" className={styles.adminMain} tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
