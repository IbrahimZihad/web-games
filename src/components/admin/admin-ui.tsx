import type { ReactNode } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Gamepad2,
  Info,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import type { GameStatus } from "@/lib/types";
import styles from "./admin.module.css";

export function formatAdminNumber(value: number, compact = false): string {
  return new Intl.NumberFormat("en", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

export function formatAdminDate(value: string | null): string {
  if (!value) return "Not published";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeaderCopy}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className={styles.pageActions}>{actions}</div> : null}
    </header>
  );
}

const statusClasses: Record<GameStatus, string> = {
  PUBLISHED: styles.statusPublished,
  DRAFT: styles.statusDraft,
  ARCHIVED: styles.statusArchived,
};

export function StatusBadge({ status }: { status: GameStatus }) {
  return (
    <span className={`${styles.statusBadge} ${statusClasses[status]}`}>
      <span className={styles.statusDot} aria-hidden="true" />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function GameCover({
  src,
  alt,
  size = "medium",
}: {
  src: string;
  alt: string;
  size?: "small" | "medium" | "large";
}) {
  return (
    <span className={`${styles.gameCover} ${styles[`cover${size.charAt(0).toUpperCase()}${size.slice(1)}`]}`}>
      {/* Admin media can be uploaded or externally hosted, so a plain image avoids host allowlist coupling. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" />
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`${styles.toggle} ${checked ? styles.toggleOn : ""}`}
    >
      <span className={styles.toggleThumb} aria-hidden="true" />
    </button>
  );
}

export function Banner({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
}) {
  const Icon = tone === "error" ? CircleAlert : tone === "success" ? CheckCircle2 : Info;
  return (
    <div className={`${styles.banner} ${styles[`banner${tone.charAt(0).toUpperCase()}${tone.slice(1)}`]}`} role={tone === "error" ? "alert" : "status"}>
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}>{icon || <Gamepad2 size={25} />}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "This view could not be loaded",
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.errorState} role="alert">
      <span className={styles.errorIcon}><CircleAlert size={25} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {onRetry ? (
        <button type="button" className={styles.secondaryButton} onClick={onRetry}>
          <RotateCcw size={16} /> Try again
        </button>
      ) : null}
    </div>
  );
}

export function LoadingBlock({ label = "Loading admin data" }: { label?: string }) {
  return (
    <div className={styles.loadingBlock} role="status">
      <LoaderCircle size={20} className={styles.spinner} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className={styles.fieldError}>{message}</p>;
}
