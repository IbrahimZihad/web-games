import Link from "next/link";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { EmptyState } from "@/components/admin/admin-ui";
import styles from "@/components/admin/admin.module.css";

export default function AdminNotFound() {
  return (
    <EmptyState
      icon={<Gamepad2 size={26} />}
      title="This admin page could not be found"
      description="The game or page may have been removed. Return to the game library to continue managing the portal."
      action={<Link href="/admin/games" className={styles.primaryButton}><ArrowLeft size={16} /> Back to games</Link>}
    />
  );
}
