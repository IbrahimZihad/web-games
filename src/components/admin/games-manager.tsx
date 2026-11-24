"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Flame,
  Gamepad2,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AdminDialog } from "@/components/admin/admin-dialog";
import {
  Banner,
  EmptyState,
  ErrorState,
  GameCover,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  Toggle,
  formatAdminDate,
  formatAdminNumber,
} from "@/components/admin/admin-ui";
import styles from "@/components/admin/admin.module.css";
import {
  deleteAdminGame,
  gameToInput,
  getAdminErrorMessage,
  getAdminGames,
  updateAdminGame,
  type AdminGame,
} from "@/lib/admin-graphql";
import type { GameStatus } from "@/lib/types";

const filters: Array<{ value: "ALL" | GameStatus; label: string }> = [
  { value: "ALL", label: "All games" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Drafts" },
  { value: "ARCHIVED", label: "Archived" },
];

export function GamesManager({
  initialGames,
  initialError,
}: {
  initialGames: AdminGame[];
  initialError?: string;
}) {
  const router = useRouter();
  const [games, setGames] = useState(initialGames);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | GameStatus>("ALL");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(initialError || "");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [busy, setBusy] = useState<{ id: number; field: "featured" | "trending" } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminGame | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const requestSequence = useRef(0);

  async function loadGames(nextSearch = search, nextStatus = status) {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setLoadError("");
    setSuccessMessage("");
    try {
      const result = await getAdminGames(nextSearch, nextStatus === "ALL" ? undefined : nextStatus);
      if (sequence === requestSequence.current) setGames(result);
    } catch (error) {
      if (sequence === requestSequence.current) setLoadError(getAdminErrorMessage(error));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadGames(search, status);
  }

  function selectStatus(nextStatus: "ALL" | GameStatus) {
    setStatus(nextStatus);
    void loadGames(search, nextStatus);
  }

  async function toggleFlag(game: AdminGame, field: "featured" | "trending", checked: boolean) {
    setBusy({ id: game.id, field });
    setActionError("");
    setSuccessMessage("");
    const input = gameToInput(game);
    if (field === "featured") input.isFeatured = checked;
    else input.isTrending = checked;
    try {
      const updated = await updateAdminGame(game.id, input);
      setGames((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSuccessMessage(`${game.title} ${checked ? "marked" : "removed"} as ${field === "featured" ? "featured" : "trending"}.`);
      router.refresh();
    } catch (error) {
      setActionError(getAdminErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function openDelete(game: AdminGame) {
    setDeleteTarget(game);
    setDeleteError("");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const deleted = await deleteAdminGame(deleteTarget.id);
      if (!deleted) throw new Error("The game was not deleted.");
      setGames((current) => current.filter((game) => game.id !== deleteTarget.id));
      setDeleteTarget(null);
      setSuccessMessage("Game deleted successfully.");
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error && error.message === "The game was not deleted."
        ? error.message
        : getAdminErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  const hasFilters = Boolean(search.trim()) || status !== "ALL";

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="Catalog"
        title="Games library"
        description="Search every listing, control visibility, and keep your featured games up to date."
        actions={<Link href="/admin/games/new" className={styles.primaryButton}><Plus size={17} /> Add game</Link>}
      />

      <section className={`${styles.panel} ${styles.libraryPanel}`} aria-label="Game library management">
        <div className={styles.libraryToolbar}>
          <form className={styles.searchForm} onSubmit={handleSearch} role="search">
            <label htmlFor="admin-game-search" className={styles.srOnly}>Search games</label>
            <Search size={17} aria-hidden="true" />
            <input id="admin-game-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, slug, or developer…" />
            <button type="submit" className={styles.searchButton} disabled={loading}>Search</button>
          </form>
          <button type="button" className={styles.iconButton} onClick={() => void loadGames()} disabled={loading} aria-label="Refresh games" title="Refresh games"><RefreshCw size={17} className={loading ? styles.spinner : ""} /></button>
        </div>
        <div className={styles.filterBar}>
          <div className={styles.filterGroup} role="group" aria-label="Filter games by status">
            {filters.map((filter) => (
              <button key={filter.value} type="button" aria-pressed={status === filter.value} disabled={loading} onClick={() => selectStatus(filter.value)} className={`${styles.filterButton} ${status === filter.value ? styles.filterButtonActive : ""}`}>
                {filter.label}
              </button>
            ))}
          </div>
          <span className={styles.resultCount} aria-live="polite">{loading ? "Loading…" : `${games.length} game${games.length === 1 ? "" : "s"}`}</span>
        </div>

        {loadError ? (
          games.length ? <Banner tone="error">{loadError} Showing the last loaded results.</Banner> : <ErrorState description={loadError} onRetry={() => void loadGames()} />
        ) : null}
        {actionError ? <Banner tone="error">{actionError}</Banner> : null}
        {successMessage ? <Banner tone="success">{successMessage}</Banner> : null}

        {loading && !games.length ? <LoadingBlock label="Loading game library" /> : null}
        {!loading && !loadError && !games.length ? (
          <EmptyState
            icon={hasFilters ? <Search size={25} /> : <Gamepad2 size={25} />}
            title={hasFilters ? "No games match these filters" : "No games yet"}
            description={hasFilters ? "Try a different search term or include all statuses." : "Create your first listing to start building the portal."}
            action={hasFilters ? <button type="button" className={styles.secondaryButton} onClick={() => { setSearch(""); setStatus("ALL"); void loadGames("", "ALL"); }}><X size={16} /> Clear filters</button> : <Link href="/admin/games/new" className={styles.primaryButton}><Plus size={16} /> Add game</Link>}
          />
        ) : null}

        {games.length ? (
          <div className={styles.tableScroll} aria-busy={loading}>
            <table className={`${styles.dataTable} ${styles.libraryTable}`}>
              <thead><tr><th scope="col">Game</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col" className={styles.numericCell}>Plays</th><th scope="col">Featured</th><th scope="col">Trending</th><th scope="col">Updated</th><th scope="col"><span className={styles.srOnly}>Actions</span></th></tr></thead>
              <tbody>
                {games.map((game) => {
                  const rowBusy = busy?.id === game.id;
                  return (
                    <tr key={game.id}>
                      <td data-label="Game"><div className={styles.gameCell}><GameCover src={game.thumbnailUrl} alt="" /><div><Link href={`/admin/games/${game.id}/edit`} className={styles.gameTitleLink}>{game.title}</Link><span className={styles.slugText}>/{game.slug}</span></div></div></td>
                      <td data-label="Category"><span className={styles.categoryText}>{game.category.name}</span></td>
                      <td data-label="Status"><StatusBadge status={game.status} /></td>
                      <td data-label="Plays" className={`${styles.numericCell} ${styles.playCount}`}>{formatAdminNumber(game.playCount)}</td>
                      <td data-label="Featured"><div className={styles.flagCell}>{busy?.id === game.id && busy.field === "featured" ? <LoaderCircle size={15} className={styles.spinner} /> : null}<Toggle checked={game.isFeatured} onChange={(checked) => void toggleFlag(game, "featured", checked)} disabled={rowBusy} label={`${game.isFeatured ? "Remove" : "Mark"} ${game.title} as featured`} /><span>{game.isFeatured ? "Yes" : "No"}</span></div></td>
                      <td data-label="Trending"><div className={styles.flagCell}>{busy?.id === game.id && busy.field === "trending" ? <LoaderCircle size={15} className={styles.spinner} /> : null}<Toggle checked={game.isTrending} onChange={(checked) => void toggleFlag(game, "trending", checked)} disabled={rowBusy} label={`${game.isTrending ? "Remove" : "Mark"} ${game.title} as trending`} /><span>{game.isTrending ? <><Flame size={13} /> Yes</> : "No"}</span></div></td>
                      <td data-label="Updated"><span className={styles.mutedText}>{formatAdminDate(game.updatedAt)}</span></td>
                      <td data-label="Actions"><div className={styles.rowActions}><Link href={`/admin/games/${game.id}/edit`} className={styles.rowAction} aria-label={`Edit ${game.title}`} title="Edit game"><Pencil size={16} /></Link><button type="button" className={`${styles.rowAction} ${styles.dangerAction}`} onClick={() => openDelete(game)} aria-label={`Delete ${game.title}`} title="Delete game"><Trash2 size={16} /></button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className={styles.tableFooter}><span><Sparkles size={14} /> Featured and trending changes save immediately.</span><span>Search covers title, slug, and developer.</span></div>
      </section>

      <AdminDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete this game?" description={deleteTarget ? `“${deleteTarget.title}” will be permanently removed from the catalog.` : undefined} busy={deleting}>
        {deleteTarget ? (
          <div className={styles.confirmContent}>
            <div className={styles.deletePreview}><GameCover src={deleteTarget.thumbnailUrl} alt="" /><div><strong>{deleteTarget.title}</strong><span>/{deleteTarget.slug}</span></div></div>
            <p className={styles.confirmText}>This action cannot be undone. Ratings, comments, favorites, and play history associated with this game will also be removed.{deleteTarget.sourceType === "UPLOADED_ZIP" ? " Its uploaded game build will be deleted from the server." : ""}</p>
            {deleteError ? <Banner tone="error">{deleteError}</Banner> : null}
            <div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button><button type="button" className={styles.dangerButton} onClick={() => void confirmDelete()} disabled={deleting}>{deleting ? <LoaderCircle size={16} className={styles.spinner} /> : <Trash2 size={16} />}{deleting ? "Deleting…" : "Delete game"}</button></div>
          </div>
        ) : null}
      </AdminDialog>
    </div>
  );
}
