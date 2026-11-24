"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import styles from "@/components/admin/admin.module.css";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className={styles.routeError}>
      <span className={styles.errorIcon}><CircleAlert size={28} /></span>
      <p className={styles.eyebrow}>Admin error</p>
      <h1>We couldn’t open this view</h1>
      <p>The request did not complete. Your session is still protected; try loading the view again.</p>
      <button type="button" className={styles.primaryButton} onClick={reset}><RotateCcw size={16} /> Try again</button>
    </div>
  );
}
