import Link from "next/link";
import {
  ArrowUpRight,
  CircleDashed,
  FilePenLine,
  Gamepad2,
  Layers3,
  MousePointerClick,
  Plus,
  Tags,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  EmptyState,
  GameCover,
  PageHeader,
  StatusBadge,
  formatAdminDate,
  formatAdminNumber,
} from "@/components/admin/admin-ui";
import styles from "@/components/admin/admin.module.css";
import { getAdminGames, getAdminStats } from "@/lib/admin-graphql";

interface KpiCardProps {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  tone: string;
}

function KpiCard({ label, value, detail, icon: Icon, tone }: KpiCardProps) {
  return (
    <article className={`${styles.kpiCard} ${tone}`}>
      <div className={styles.kpiTop}><span>{label}</span><span className={styles.kpiIcon}><Icon size={19} /></span></div>
      <strong className={styles.kpiValue}>{formatAdminNumber(value)}</strong>
      <p>{detail}</p>
    </article>
  );
}

export default async function AdminOverviewPage() {
  const [stats, recentGames] = await Promise.all([getAdminStats(), getAdminGames()]);
  const recent = recentGames.slice(0, 5);
  const maxPlays = Math.max(0, ...stats.topGames.map((game) => game.playCount));

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="Control room"
        title="Portal overview"
        description="A live snapshot of your game catalog, player activity, and publishing pipeline."
        actions={<Link href="/admin/games/new" className={styles.primaryButton}><Plus size={17} /> Add game</Link>}
      />

      <section className={styles.kpiGrid} aria-label="Portal key performance indicators">
        <KpiCard label="Total Games" value={stats.totalGames} detail="Across every status" icon={Gamepad2} tone={styles.kpiViolet} />
        <KpiCard label="Published" value={stats.publishedGames} detail="Live on the portal" icon={Layers3} tone={styles.kpiGreen} />
        <KpiCard label="Drafts" value={stats.draftGames} detail="Not visible to players" icon={CircleDashed} tone={styles.kpiAmber} />
        <KpiCard label="Total Plays" value={stats.totalPlays} detail="All-time recorded plays" icon={MousePointerClick} tone={styles.kpiBlue} />
        <KpiCard label="Registered Users" value={stats.totalUsers} detail="Player and admin accounts" icon={Users} tone={styles.kpiPink} />
      </section>

      <div className={styles.dashboardGrid}>
        <section className={`${styles.panel} ${styles.playsPanel}`} aria-labelledby="plays-overview-title">
          <div className={styles.panelHeader}>
            <div><p className={styles.sectionKicker}>Catalog activity</p><h2 id="plays-overview-title">Plays overview</h2></div>
            <span className={styles.panelBadge}>All time</span>
          </div>
          <p className={styles.panelDescription}>All-time play counts for the 10 most-played games, across all statuses. This ranked snapshot is not a time series.</p>
          {stats.topGames.length ? (
            <ol className={styles.playsChart}>
              {stats.topGames.map((game, index) => {
                const width = maxPlays > 0 ? (game.playCount / maxPlays) * 100 : 0;
                return (
                  <li key={game.id} className={styles.playsRow}>
                    <span className={styles.playsRank}>{String(index + 1).padStart(2, "0")}</span>
                    <div className={styles.playsGame}>
                      <Link href={`/admin/games/${game.id}/edit`} title={game.title}>{game.title}</Link>
                      <div className={styles.playsTrack} aria-hidden="true"><span style={{ width: `${width}%` }} /></div>
                    </div>
                    <strong className={styles.playsValue}>{formatAdminNumber(game.playCount)}</strong>
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState title="No play data yet" description="Play counts will appear here after games are added and played." />
          )}
        </section>

        <section className={styles.panel} aria-labelledby="quick-actions-title">
          <div className={styles.panelHeader}><div><p className={styles.sectionKicker}>Shortcuts</p><h2 id="quick-actions-title">Quick actions</h2></div></div>
          <div className={styles.quickActions}>
            <Link href="/admin/games/new" className={styles.quickAction}><span><Plus size={19} /></span><div><strong>Add a new game</strong><p>Build a listing and upload media</p></div><ArrowUpRight size={17} /></Link>
            <Link href="/admin/games" className={styles.quickAction}><span><FilePenLine size={19} /></span><div><strong>Manage library</strong><p>Edit, feature, publish, or remove</p></div><ArrowUpRight size={17} /></Link>
            <Link href="/admin/categories" className={styles.quickAction}><span><Tags size={19} /></span><div><strong>Organize taxonomy</strong><p>Create categories and discovery tags</p></div><ArrowUpRight size={17} /></Link>
          </div>
          <div className={styles.quickNote}><Trophy size={18} /><p><strong>Keep the catalog fresh.</strong> Review drafts and recent updates before your next publishing pass.</p></div>
        </section>
      </div>

      <div className={styles.dashboardGridLower}>
        <section className={styles.panel} aria-labelledby="top-games-title">
          <div className={styles.panelHeader}>
            <div><p className={styles.sectionKicker}>Leaderboard</p><h2 id="top-games-title">Top 10 most played games</h2></div>
            <Link href="/admin/games" className={styles.textLink}>View library <ArrowUpRight size={15} /></Link>
          </div>
          {stats.topGames.length ? (
            <div className={styles.tableScroll}>
              <table className={styles.dataTable}>
                <thead><tr><th scope="col">Rank</th><th scope="col">Game</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col" className={styles.numericCell}>Plays</th></tr></thead>
                <tbody>
                  {stats.topGames.map((game, index) => (
                    <tr key={game.id}>
                      <td className={styles.rankCell}>{String(index + 1).padStart(2, "0")}</td>
                      <td><div className={styles.gameCell}><GameCover src={game.thumbnailUrl} alt="" size="small" /><div><Link href={`/admin/games/${game.id}/edit`} className={styles.gameTitleLink}>{game.title}</Link><span className={styles.slugText}>{game.slug}</span></div></div></td>
                      <td>{game.category.name}</td>
                      <td><StatusBadge status={game.status} /></td>
                      <td className={`${styles.numericCell} ${styles.playCount}`}>{formatAdminNumber(game.playCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="No games to rank" description="Add your first game to start building the leaderboard." action={<Link href="/admin/games/new" className={styles.secondaryButton}><Plus size={16} /> Add game</Link>} />}
        </section>

        <section className={styles.panel} aria-labelledby="recent-games-title">
          <div className={styles.panelHeader}><div><p className={styles.sectionKicker}>Latest changes</p><h2 id="recent-games-title">Recent games</h2></div></div>
          {recent.length ? (
            <div className={styles.recentList}>
              {recent.map((game) => (
                <Link key={game.id} href={`/admin/games/${game.id}/edit`} className={styles.recentItem}>
                  <GameCover src={game.thumbnailUrl} alt="" size="small" />
                  <span className={styles.recentCopy}><strong>{game.title}</strong><span>Updated {formatAdminDate(game.updatedAt)}</span></span>
                  <StatusBadge status={game.status} />
                </Link>
              ))}
            </div>
          ) : <EmptyState title="Your library is empty" description="Recently updated games will appear here." />}
        </section>
      </div>
    </div>
  );
}
