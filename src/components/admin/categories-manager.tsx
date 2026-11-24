"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  CarFront,
  Check,
  Compass,
  Crosshair,
  Dices,
  Flag,
  Gamepad2,
  Globe,
  Heart,
  LoaderCircle,
  Pencil,
  Plus,
  Puzzle,
  RefreshCw,
  Rocket,
  Shapes,
  Sparkles,
  Star,
  Swords,
  Tags,
  Target,
  Trash2,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AdminDialog } from "@/components/admin/admin-dialog";
import {
  Banner,
  EmptyState,
  ErrorState,
  FieldError,
  PageHeader,
} from "@/components/admin/admin-ui";
import styles from "@/components/admin/admin.module.css";
import {
  createAdminCategory,
  createAdminTag,
  deleteAdminCategory,
  deleteAdminTag,
  getAdminCategories,
  getAdminErrorMessage,
  getAdminTags,
  updateAdminCategory,
  updateAdminTag,
  type CategoryInput,
  type CategoryWriteResult,
} from "@/lib/admin-graphql";
import type { CategoryDTO, TagDTO } from "@/lib/types";

const iconMap: Record<string, LucideIcon> = {
  swords: Swords,
  compass: Compass,
  flag: Flag,
  puzzle: Puzzle,
  crosshair: Crosshair,
  trophy: Trophy,
  users: Users,
  brain: Brain,
  sparkles: Sparkles,
  gamepad: Gamepad2,
  rocket: Rocket,
  car: CarFront,
  target: Target,
  zap: Zap,
  shapes: Shapes,
  dice: Dices,
  heart: Heart,
  globe: Globe,
  star: Star,
};

const iconOptions = [
  ["gamepad", "Gamepad"],
  ["swords", "Swords / action"],
  ["compass", "Compass / adventure"],
  ["flag", "Flag / racing"],
  ["puzzle", "Puzzle"],
  ["crosshair", "Crosshair / shooting"],
  ["trophy", "Trophy / sports"],
  ["users", "Users / multiplayer"],
  ["brain", "Brain / strategy"],
  ["sparkles", "Sparkles / casual"],
  ["rocket", "Rocket"],
  ["car", "Car"],
  ["target", "Target"],
  ["zap", "Zap"],
  ["shapes", "Shapes"],
  ["dice", "Dice"],
  ["heart", "Heart"],
  ["globe", "Globe"],
  ["star", "Star"],
] as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function CategoryIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Icon = iconMap[name] || Shapes;
  return <Icon size={size} aria-hidden="true" />;
}

interface CategoryFormState {
  name: string;
  slug: string;
  iconName: string;
  description: string;
  displayOrder: string;
}

function CategoryEditor({
  category,
  defaultOrder,
  onClose,
  onSaved,
}: {
  category: CategoryDTO | null;
  defaultOrder: number;
  onClose: () => void;
  onSaved: (category: CategoryWriteResult, previous: CategoryDTO | null) => void;
}) {
  const [form, setForm] = useState<CategoryFormState>(() => category ? {
    name: category.name,
    slug: category.slug,
    iconName: category.iconName,
    description: category.description || "",
    displayOrder: String(category.displayOrder),
  } : { name: "", slug: "", iconName: "gamepad", description: "", displayOrder: String(defaultOrder) });
  const [slugEdited, setSlugEdited] = useState(Boolean(category));
  const [errors, setErrors] = useState<Partial<Record<keyof CategoryFormState, string>>>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  function update<K extends keyof CategoryFormState>(field: K, value: CategoryFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Partial<Record<keyof CategoryFormState, string>> = {};
    if (!form.name.trim()) nextErrors.name = "Enter a category name.";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) nextErrors.slug = "Use lowercase letters, numbers, and single hyphens.";
    if (!form.iconName) nextErrors.iconName = "Choose an icon.";
    if (form.description.length > 1000) nextErrors.description = "Keep the description under 1,000 characters.";
    const order = Number(form.displayOrder);
    if (!Number.isInteger(order) || order < 0 || order > 9999) nextErrors.displayOrder = "Enter a whole number from 0 to 9,999.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const input: CategoryInput = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      iconName: form.iconName,
      description: form.description.trim() || null,
      displayOrder: order,
    };
    setSaving(true);
    setSubmitError("");
    try {
      const result = category ? await updateAdminCategory(category.id, input) : await createAdminCategory(input);
      onSaved(result, category);
    } catch (error) {
      setSubmitError(getAdminErrorMessage(error));
      setSaving(false);
    }
  }

  return (
    <AdminDialog open onClose={onClose} title={category ? "Edit category" : "Create category"} description="Categories organize the public catalog and determine where games can be filed." busy={saving}>
      <form onSubmit={handleSubmit} className={styles.dialogForm} noValidate>
        {submitError ? <Banner tone="error">{submitError}</Banner> : null}
        <div className={styles.formGrid}>
          <div className={styles.field}><label htmlFor="category-name">Name <span aria-hidden="true">*</span></label><input id="category-name" data-autofocus="true" value={form.name} maxLength={100} onChange={(event) => { const name = event.target.value; setForm((current) => ({ ...current, name, ...(slugEdited ? {} : { slug: slugify(name) }) })); setErrors((current) => { const next = { ...current }; delete next.name; if (!slugEdited) delete next.slug; return next; }); }} placeholder="e.g. Adventure" aria-invalid={Boolean(errors.name)} />{!errors.name ? null : <FieldError id="category-name-error" message={errors.name} />}</div>
          <div className={styles.field}><div className={styles.labelRow}><label htmlFor="category-slug">Slug <span aria-hidden="true">*</span></label><span>{slugEdited ? "Manual" : "Auto-generated"}</span></div><input id="category-slug" value={form.slug} maxLength={120} onChange={(event) => { setSlugEdited(true); update("slug", event.target.value); }} placeholder="adventure" aria-invalid={Boolean(errors.slug)} />{!errors.slug ? null : <FieldError id="category-slug-error" message={errors.slug} />}</div>
          <div className={`${styles.field} ${styles.fieldFull}`}><label htmlFor="category-icon">Icon identifier <span aria-hidden="true">*</span></label><select id="category-icon" value={form.iconName} onChange={(event) => update("iconName", event.target.value)}>{!iconOptions.some(([value]) => value === form.iconName) ? <option value={form.iconName}>{form.iconName} (existing)</option> : null}{iconOptions.map(([value, label]) => <option key={value} value={value}>{label} · {value}</option>)}</select><p className={styles.fieldHint}>Uses a known Lucide icon identifier.</p>{!errors.iconName ? null : <FieldError id="category-icon-error" message={errors.iconName} />}</div>
          <div className={`${styles.field} ${styles.fieldFull}`}><label htmlFor="category-description">Description</label><textarea id="category-description" rows={4} maxLength={1000} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Explain the kinds of games in this category" />{!errors.description ? null : <FieldError id="category-description-error" message={errors.description} />}</div>
          <div className={`${styles.field} ${styles.fieldFull}`}><label htmlFor="category-order">Display order</label><input id="category-order" type="number" min={0} max={9999} step={1} value={form.displayOrder} onChange={(event) => update("displayOrder", event.target.value)} />{!errors.displayOrder ? null : <FieldError id="category-order-error" message={errors.displayOrder} />}</div>
        </div>
        <div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}{saving ? "Saving…" : category ? "Save category" : "Create category"}</button></div>
      </form>
    </AdminDialog>
  );
}

function TagEditor({
  tag,
  onClose,
  onSaved,
}: {
  tag: TagDTO | null;
  onClose: () => void;
  onSaved: (tag: TagDTO, previous: TagDTO | null) => void;
}) {
  const [name, setName] = useState(tag?.name || "");
  const [slug, setSlug] = useState(tag?.slug || "");
  const [slugEdited, setSlugEdited] = useState(Boolean(tag));
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: { name?: string; slug?: string } = {};
    if (!name.trim()) nextErrors.name = "Enter a tag name.";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())) nextErrors.slug = "Use lowercase letters, numbers, and single hyphens.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    setSubmitError("");
    try {
      const result = tag ? await updateAdminTag(tag.id, { name: name.trim(), slug: slug.trim() }) : await createAdminTag({ name: name.trim(), slug: slug.trim() });
      onSaved(result, tag);
    } catch (error) {
      setSubmitError(getAdminErrorMessage(error));
      setSaving(false);
    }
  }

  return (
    <AdminDialog open onClose={onClose} title={tag ? "Edit tag" : "Create tag"} description="Tags are flexible discovery labels that can be assigned to multiple games." busy={saving}>
      <form onSubmit={handleSubmit} className={styles.dialogForm} noValidate>
        {submitError ? <Banner tone="error">{submitError}</Banner> : null}
        <div className={styles.field}><label htmlFor="tag-name">Name <span aria-hidden="true">*</span></label><input id="tag-name" data-autofocus="true" value={name} maxLength={80} onChange={(event) => { const value = event.target.value; setName(value); if (!slugEdited) setSlug(slugify(value)); setErrors((current) => { const next = { ...current }; delete next.name; if (!slugEdited) delete next.slug; return next; }); }} placeholder="e.g. Co-op" aria-invalid={Boolean(errors.name)} /><FieldError id="tag-name-error" message={errors.name} /></div>
        <div className={styles.field}><div className={styles.labelRow}><label htmlFor="tag-slug">Slug <span aria-hidden="true">*</span></label><span>{slugEdited ? "Manual" : "Auto-generated"}</span></div><input id="tag-slug" value={slug} maxLength={100} onChange={(event) => { setSlugEdited(true); setSlug(event.target.value); setErrors((current) => { const next = { ...current }; delete next.slug; return next; }); }} placeholder="co-op" aria-invalid={Boolean(errors.slug)} /><FieldError id="tag-slug-error" message={errors.slug} /></div>
        <div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? <LoaderCircle size={16} className={styles.spinner} /> : <Check size={16} />}{saving ? "Saving…" : tag ? "Save tag" : "Create tag"}</button></div>
      </form>
    </AdminDialog>
  );
}

type DeleteTarget = { kind: "category"; item: CategoryDTO } | { kind: "tag"; item: TagDTO };

export function CategoriesManager({
  initialCategories,
  initialTags,
  initialCategoryError = "",
  initialTagError = "",
}: {
  initialCategories: CategoryDTO[];
  initialTags: TagDTO[];
  initialCategoryError?: string;
  initialTagError?: string;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [tags, setTags] = useState(initialTags);
  const [categoryError, setCategoryError] = useState(initialCategoryError);
  const [tagError, setTagError] = useState(initialTagError);
  const [categoryEditor, setCategoryEditor] = useState<{ category: CategoryDTO | null } | null>(null);
  const [tagEditor, setTagEditor] = useState<{ tag: TagDTO | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

  function sortCategories(items: CategoryDTO[]) {
    return [...items].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  }

  function saveCategory(result: CategoryWriteResult, previous: CategoryDTO | null) {
    setCategories((current) => sortCategories(previous
      ? current.map((item) => item.id === previous.id ? { ...result, gameCount: previous.gameCount } : item)
      : [...current, { ...result, gameCount: 0 }]));
    setCategoryEditor(null);
    setCategoryError("");
    setMessage(previous ? "Category updated." : "Category created.");
    router.refresh();
  }

  function saveTag(result: TagDTO, previous: TagDTO | null) {
    setTags((current) => previous
      ? current.map((item) => item.id === previous.id ? result : item)
      : [...current, result].sort((a, b) => a.name.localeCompare(b.name)));
    setTagEditor(null);
    setTagError("");
    setMessage(previous ? "Tag updated." : "Tag created.");
    router.refresh();
  }

  async function refreshCategories() {
    setCategoryError("");
    try {
      setCategories(sortCategories(await getAdminCategories()));
    } catch (error) {
      setCategoryError(getAdminErrorMessage(error));
    }
  }

  async function refreshTags() {
    setTagError("");
    try {
      setTags(await getAdminTags());
    } catch (error) {
      setTagError(getAdminErrorMessage(error));
    }
  }

  function openDelete(target: DeleteTarget) {
    setDeleteTarget(target);
    setDeleteError("");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      if (deleteTarget.kind === "category") {
        const deleted = await deleteAdminCategory(deleteTarget.item.id);
        if (!deleted) throw new Error("The server did not confirm that the category was deleted.");
        setCategories((current) => current.filter((item) => item.id !== deleteTarget.item.id));
        setMessage("Category deleted.");
      } else {
        const deleted = await deleteAdminTag(deleteTarget.item.id);
        if (!deleted) throw new Error("The server did not confirm that the tag was deleted.");
        setTags((current) => current.filter((item) => item.id !== deleteTarget.item.id));
        setMessage("Tag deleted.");
      }
      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error && error.message.startsWith("The server did not confirm")
        ? error.message
        : getAdminErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  const nextCategoryOrder = categories.length ? Math.max(...categories.map((category) => category.displayOrder)) + 1 : 1;

  return (
    <div className={styles.pageStack}>
      <PageHeader eyebrow="Taxonomy" title="Categories & tags" description="Shape the browsing structure and discovery labels used across the public portal." />
      {message ? <Banner tone="success">{message}</Banner> : null}

      <section className={styles.panel} aria-labelledby="categories-title">
        <div className={styles.panelHeader}><div><p className={styles.sectionKicker}>Browse structure</p><h2 id="categories-title">Categories</h2><p className={styles.panelDescription}>{categories.length} categor{categories.length === 1 ? "y" : "ies"} · ordered for public display</p></div><div className={styles.panelHeaderActions}><button type="button" className={styles.iconButton} onClick={() => void refreshCategories()} aria-label="Refresh categories"><RefreshCw size={16} /></button><button type="button" className={styles.primaryButton} onClick={() => setCategoryEditor({ category: null })}><Plus size={16} /> Add category</button></div></div>
        {categoryError ? categories.length ? <Banner tone="error">{categoryError}</Banner> : <ErrorState description={categoryError} onRetry={() => void refreshCategories()} /> : null}
        {!categoryError && !categories.length ? <EmptyState icon={<Shapes size={25} />} title="No categories yet" description="Create a category so games can be classified on the portal." action={<button type="button" className={styles.secondaryButton} onClick={() => setCategoryEditor({ category: null })}><Plus size={16} /> Add category</button>} /> : null}
        {categories.length ? <div className={styles.categoryGrid}>{categories.map((category) => <article key={category.id} className={styles.categoryCard}><div className={styles.categoryCardTop}><span className={styles.categoryIcon}><CategoryIcon name={category.iconName} size={23} /></span><div className={styles.rowActions}><button type="button" className={styles.rowAction} onClick={() => setCategoryEditor({ category })} aria-label={`Edit ${category.name}`}><Pencil size={15} /></button><button type="button" className={`${styles.rowAction} ${styles.dangerAction}`} onClick={() => openDelete({ kind: "category", item: category })} aria-label={`Delete ${category.name}`}><Trash2 size={15} /></button></div></div><h3>{category.name}</h3><code>/{category.slug}</code><p>{category.description || "No description added."}</p><div className={styles.categoryCardMeta}><span>{category.gameCount} published game{category.gameCount === 1 ? "" : "s"}</span><span>Order {category.displayOrder}</span></div></article>)}</div> : null}
      </section>

      <section className={styles.panel} aria-labelledby="tags-title">
        <div className={styles.panelHeader}><div><p className={styles.sectionKicker}>Discovery labels</p><h2 id="tags-title">Tags</h2><p className={styles.panelDescription}>Reusable labels for genres, modes, and features.</p></div><div className={styles.panelHeaderActions}><button type="button" className={styles.iconButton} onClick={() => void refreshTags()} aria-label="Refresh tags"><RefreshCw size={16} /></button><button type="button" className={styles.secondaryButton} onClick={() => setTagEditor({ tag: null })}><Plus size={16} /> Add tag</button></div></div>
        {tagError ? tags.length ? <Banner tone="error">{tagError}</Banner> : <ErrorState description={tagError} onRetry={() => void refreshTags()} /> : null}
        {!tagError && !tags.length ? <EmptyState icon={<Tags size={25} />} title="No tags yet" description="Add tags such as Co-op, Pixel art, or Multiplayer to improve discovery." action={<button type="button" className={styles.secondaryButton} onClick={() => setTagEditor({ tag: null })}><Plus size={16} /> Add tag</button>} /> : null}
        {tags.length ? <div className={styles.tableScroll}><table className={styles.dataTable}><thead><tr><th scope="col">Tag</th><th scope="col">Slug</th><th scope="col"><span className={styles.srOnly}>Actions</span></th></tr></thead><tbody>{tags.map((tag) => <tr key={tag.id}><td data-label="Tag"><span className={styles.tagName}><Tags size={15} />{tag.name}</span></td><td data-label="Slug"><code className={styles.slugText}>/{tag.slug}</code></td><td data-label="Actions"><div className={styles.rowActions}><button type="button" className={styles.rowAction} onClick={() => setTagEditor({ tag })} aria-label={`Edit ${tag.name}`}><Pencil size={15} /></button><button type="button" className={`${styles.rowAction} ${styles.dangerAction}`} onClick={() => openDelete({ kind: "tag", item: tag })} aria-label={`Delete ${tag.name}`}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div> : null}
      </section>

      {categoryEditor ? <CategoryEditor key={categoryEditor.category?.id || "new"} category={categoryEditor.category} defaultOrder={nextCategoryOrder} onClose={() => setCategoryEditor(null)} onSaved={saveCategory} /> : null}
      {tagEditor ? <TagEditor key={tagEditor.tag?.id || "new"} tag={tagEditor.tag} onClose={() => setTagEditor(null)} onSaved={saveTag} /> : null}

      <AdminDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title={deleteTarget?.kind === "category" ? "Delete category?" : "Delete tag?"} description={deleteTarget ? `“${deleteTarget.item.name}” will be permanently removed.` : undefined} busy={deleting}>
        {deleteTarget ? <div className={styles.confirmContent}><p className={styles.confirmText}>{deleteTarget.kind === "category" ? "The backend will refuse deletion while games are still assigned to this category. Move or delete those games first." : "Deleting this tag removes its assignments from games. The games themselves will not be deleted."}</p>{deleteError ? <Banner tone="error">{deleteError}</Banner> : null}<div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button><button type="button" className={styles.dangerButton} onClick={() => void confirmDelete()} disabled={deleting}>{deleting ? <LoaderCircle size={16} className={styles.spinner} /> : <Trash2 size={16} />}{deleting ? "Deleting…" : `Delete ${deleteTarget.kind}`}</button></div></div> : null}
      </AdminDialog>
    </div>
  );
}
