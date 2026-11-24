import styles from "@/components/admin/admin.module.css";

export default function AdminLoading() {
  return (
    <div className={styles.pageStack} aria-label="Loading admin page" role="status">
      <div className={`${styles.skeleton} ${styles.skeletonHeading}`} />
      <div className={styles.kpiGrid}>
        {[1, 2, 3, 4, 5].map((item) => <div key={item} className={`${styles.skeleton} ${styles.skeletonCard}`} />)}
      </div>
      <div className={`${styles.skeleton} ${styles.skeletonPanel}`} />
      <span className={styles.srOnly}>Loading admin data…</span>
    </div>
  );
}
