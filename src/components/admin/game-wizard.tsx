"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  CloudUpload,
  ExternalLink,
  FileArchive,
  FileText,
  Film,
  Gamepad2,
  ImagePlus,
  Info,
  Layers3,
  LoaderCircle,
  Monitor,
  Save,
  SlidersHorizontal,
  Smartphone,
  Star,
  Tags,
  Upload,
  Video,
  X,
} from "lucide-react";
import {
  Banner,
  FieldError,
  PageHeader,
  Toggle,
} from "@/components/admin/admin-ui";
import styles from "@/components/admin/admin.module.css";
import {
  createAdminGame,
  gameToInput,
  getAdminErrorMessage,
  updateAdminGame,
  type AdminGame,
  type UpsertGameInput,
} from "@/lib/admin-graphql";
import type {
  AspectRatio,
  CategoryDTO,
  Orientation,
  TagDTO,
} from "@/lib/types";

type GameForm = Omit<
  UpsertGameInput,
  "categoryId" | "tagline" | "controlsGuide" | "posterUrl" | "previewVideoUrl"
> & {
  categoryId: string;
  tagline: string;
  controlsGuide: string;
  posterUrl: string;
  previewVideoUrl: string;
};
type FormErrors = Partial<Record<keyof GameForm, string>>;
type MediaKind = "thumbnailUrl" | "posterUrl" | "previewVideoUrl";

const emptyForm: GameForm = {
  title: "",
  slug: "",
  tagline: "",
  description: "",
  controlsGuide: "",
  developerName: "In-House Studio",
  categoryId: "",
  tagIds: [],
  sourceType: "UPLOADED_ZIP",
  embedUrl: "",
  aspectRatio: "RATIO_16_9",
  orientation: "LANDSCAPE",
  supportsMobile: false,
  thumbnailUrl: "",
  posterUrl: "",
  previewVideoUrl: "",
  screenshots: [],
  status: "DRAFT",
  isFeatured: false,
  isTrending: false,
};

const steps = [
  { title: "Basic info", description: "Identity & story", icon: FileText },
  { title: "Classification", description: "Category & tags", icon: Tags },
  { title: "Source & media", description: "Build & artwork", icon: CloudUpload },
  { title: "Viewport & publishing", description: "Display & visibility", icon: SlidersHorizontal },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function formFromGame(game: AdminGame): GameForm {
  return {
    ...gameToInput(game),
    categoryId: String(game.category.id),
    tagline: game.tagline || "",
    controlsGuide: game.controlsGuide || "",
    posterUrl: game.posterUrl || "",
    previewVideoUrl: game.previewVideoUrl || "",
  };
}

function isValidMediaUrl(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !/\s/.test(value);
  } catch {
    return false;
  }
}

function validateStep(step: number, form: GameForm): FormErrors {
  const errors: FormErrors = {};
  if (step === 0) {
    if (!form.title.trim()) errors.title = "Enter a game title.";
    else if (form.title.trim().length > 200) errors.title = "Keep the title under 200 characters.";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) errors.slug = "Use lowercase letters, numbers, and single hyphens.";
    if (form.tagline.length > 300) errors.tagline = "Keep the tagline under 300 characters.";
    if (!form.description.trim()) errors.description = "Add a description for players.";
    else if (form.description.trim().length > 20000) errors.description = "Keep the description under 20,000 characters.";
    if (form.controlsGuide.length > 10000) errors.controlsGuide = "Keep the controls guide under 10,000 characters.";
    if (!form.developerName.trim()) errors.developerName = "Enter the developer or studio name.";
    else if (form.developerName.trim().length > 150) errors.developerName = "Keep the developer name under 150 characters.";
  }
  if (step === 1 && !Number.isSafeInteger(Number(form.categoryId))) {
    errors.categoryId = "Choose a category.";
  }
  if (step === 1 && Number(form.categoryId) <= 0) errors.categoryId = "Choose a category.";
  if (step === 2) {
    if (!form.embedUrl.trim()) errors.embedUrl = form.sourceType === "UPLOADED_ZIP" ? "Upload a ZIP build first." : "Enter the external game URL.";
    else if (form.sourceType === "EXTERNAL_URL") {
      try {
        const url = new URL(form.embedUrl);
        if (url.protocol !== "https:" || /\s/.test(form.embedUrl)) throw new Error("Invalid URL");
      } catch {
        errors.embedUrl = "Use a complete HTTPS URL.";
      }
    } else if (!/^\/uploads\/games\/[a-z0-9-]+\/index\.html$/.test(form.embedUrl)) {
      errors.embedUrl = "Upload a ZIP build to generate the game index URL.";
    }
    if (!isValidMediaUrl(form.thumbnailUrl)) errors.thumbnailUrl = "Upload a cover image.";
    if (form.posterUrl && !isValidMediaUrl(form.posterUrl)) errors.posterUrl = "Use a valid poster image URL.";
    if (form.previewVideoUrl && !isValidMediaUrl(form.previewVideoUrl)) errors.previewVideoUrl = "Use a valid preview video URL.";
    if (form.screenshots.length > 12) errors.screenshots = "A game can have up to 12 screenshots.";
  }
  return errors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function extractUploadUrl(payload: unknown, keys: string[]): string | null {
  if (!isRecord(payload)) return null;
  for (const key of keys) {
    const direct = readString(payload, key);
    if (direct) return direct;
  }
  for (const container of [payload.data, payload.file, payload.upload, payload.result]) {
    if (isRecord(container)) {
      for (const key of keys) {
        const nested = readString(container, key);
        if (nested) return nested;
      }
    }
  }
  return null;
}

function extractUploadError(payload: unknown, status: number): string {
  if (isRecord(payload)) {
    const message = readString(payload, "message") || readString(payload, "error");
    if (message) return message;
    if (isRecord(payload.error)) {
      const nested = readString(payload.error, "message");
      if (nested) return nested;
    }
  }
  return `The upload failed (${status}). Please try again.`;
}

function parseUploadPayload(xhr: XMLHttpRequest): unknown {
  if (xhr.response !== null && xhr.response !== undefined && xhr.response !== "") {
    return xhr.response as unknown;
  }
  if (!xhr.responseText) return null;
  try {
    return JSON.parse(xhr.responseText) as unknown;
  } catch {
    return null;
  }
}

function uploadWithProgress(
  endpoint: string,
  formData: FormData,
  urlKeys: string[],
  onProgress: (progress: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.responseType = "json";
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      const payload = parseUploadPayload(xhr);
      if (xhr.status >= 200 && xhr.status < 300) {
        const url = extractUploadUrl(payload, urlKeys);
        if (url) resolve(url);
        else reject(new Error("The upload completed, but the server did not return a file URL."));
      } else {
        reject(new Error(extractUploadError(payload, xhr.status)));
      }
    };
    xhr.onerror = () => reject(new Error("The upload could not reach the server. Check your connection and try again."));
    xhr.onabort = () => reject(new Error("The upload was cancelled."));
    xhr.send(formData);
  });
}

function UploadControl({
  id,
  label,
  hint,
  accept,
  multiple = false,
  disabled,
  onFiles,
}: {
  id: string;
  label: string;
  hint: string;
  accept: string;
  multiple?: boolean;
  disabled: boolean;
  onFiles: (files: File[]) => void;
}) {
  return (
    <div className={styles.uploadControlWrap}>
      <label htmlFor={id} className={styles.uploadControl}>
        <input
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className={styles.fileInput}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(event.target.files || []);
            event.target.value = "";
            if (files.length) onFiles(files);
          }}
        />
        <span className={styles.uploadControlIcon}><Upload size={18} /></span>
        <span><strong>{label}</strong><small>{hint}</small></span>
      </label>
    </div>
  );
}

function ImagePreview({ src, alt, onRemove }: { src: string; alt: string; onRemove: () => void }) {
  return (
    <div className={styles.mediaPreview}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} />
      <button type="button" className={styles.mediaRemove} onClick={onRemove} aria-label={`Remove ${alt}`}><X size={15} /></button>
    </div>
  );
}

export function GameWizard({
  game,
  categories,
  tags,
}: {
  game?: AdminGame;
  categories: CategoryDTO[];
  tags: TagDTO[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<GameForm>(() => game ? formFromGame(game) : { ...emptyForm, tagIds: [] });
  const [slugEdited, setSlugEdited] = useState(Boolean(game));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FormErrors>({});
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [upload, setUpload] = useState<{ label: string; progress: number } | null>(null);
  const [tagQuery, setTagQuery] = useState("");
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const busy = saving || Boolean(upload);
  const visibleTags = tags.filter((tag) => `${tag.name} ${tag.slug}`.toLowerCase().includes(tagQuery.toLowerCase()));
  const selectedCategory = categories.find((category) => category.id === Number(form.categoryId));
  const validatedSteps = steps.map((_, index) => Object.keys(validateStep(index, form)).length === 0);
  const readiness = [validatedSteps[0], validatedSteps[1], validatedSteps[2], validatedSteps.every(Boolean)];

  function updateField<K extends keyof GameForm>(field: K, value: GameForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateTitle(value: string) {
    setForm((current) => ({
      ...current,
      title: value,
      ...(slugEdited ? {} : { slug: slugify(value) }),
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next.title;
      if (!slugEdited) delete next.slug;
      return next;
    });
  }

  function focusFirstError(nextErrors: FormErrors) {
    const fieldIds: Partial<Record<keyof GameForm, string>> = {
      title: "game-title",
      slug: "game-slug",
      tagline: "game-tagline",
      description: "game-description",
      controlsGuide: "game-controls",
      developerName: "game-developer",
      categoryId: "game-category",
      embedUrl: form.sourceType === "EXTERNAL_URL" ? "game-external-url" : "bundle-upload",
      thumbnailUrl: "thumbnail-upload",
      screenshots: "screenshots-upload",
    };
    const first = (Object.keys(nextErrors) as Array<keyof GameForm>).map((field) => fieldIds[field]).find(Boolean);
    if (first) window.requestAnimationFrame(() => document.getElementById(first)?.focus());
  }

  function moveToStep(nextStep: number) {
    setStep(nextStep);
    setActionError("");
    window.requestAnimationFrame(() => {
      stepHeadingRef.current?.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function goNext() {
    const nextErrors = validateStep(step, form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      focusFirstError(nextErrors);
      return;
    }
    moveToStep(Math.min(step + 1, steps.length - 1));
  }

  async function saveGame() {
    const allErrors: FormErrors = {};
    let firstInvalidStep = 0;
    for (let index = 0; index < steps.length; index += 1) {
      const stepErrors = validateStep(index, form);
      if (Object.keys(stepErrors).length && !Object.keys(allErrors).length) firstInvalidStep = index;
      Object.assign(allErrors, stepErrors);
    }
    if (Object.keys(allErrors).length) {
      setErrors(allErrors);
      setStep(firstInvalidStep);
      focusFirstError(allErrors);
      setActionError("Complete the highlighted fields before saving.");
      return;
    }

    const input: UpsertGameInput = {
      ...form,
      title: form.title.trim(),
      slug: form.slug.trim(),
      tagline: form.tagline.trim() || null,
      description: form.description.trim(),
      controlsGuide: form.controlsGuide.trim() || null,
      developerName: form.developerName.trim(),
      categoryId: Number(form.categoryId),
      embedUrl: form.embedUrl.trim(),
      thumbnailUrl: form.thumbnailUrl.trim(),
      posterUrl: form.posterUrl.trim() || null,
      previewVideoUrl: form.previewVideoUrl.trim() || null,
      screenshots: form.screenshots.map((url) => url.trim()),
    };

    setSaving(true);
    setActionError("");
    setSuccessMessage("");
    try {
      if (game) await updateAdminGame(game.id, input);
      else await createAdminGame(input);
      setSuccessMessage(game ? "Changes saved. Opening the game library…" : "Game created. Opening the game library…");
      router.push("/admin/games");
      router.refresh();
    } catch (error) {
      setActionError(getAdminErrorMessage(error));
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < steps.length - 1) goNext();
    else void saveGame();
  }

  async function runUpload(label: string, operation: (progress: (value: number) => void) => Promise<void>): Promise<boolean> {
    setUpload({ label, progress: 0 });
    setActionError("");
    try {
      await operation((value) => setUpload((current) => current ? { ...current, progress: value } : current));
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The upload could not be completed.");
      return false;
    } finally {
      setUpload(null);
    }
  }

  async function uploadBundle(file: File) {
    if (!file.name.toLowerCase().endsWith(".zip") && file.type !== "application/zip") {
      setActionError("Choose a .zip game build.");
      return;
    }
    const slug = form.slug.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setActionError("Set a valid slug in Basic info before uploading a build.");
      return;
    }
    const formData = new FormData();
    formData.append("slug", slug);
    formData.append("bundle", file);
    await runUpload(`Uploading ${file.name}`, async (progress) => {
      const url = await uploadWithProgress("/api/upload/game-build", formData, ["embedUrl", "indexUrl", "gameUrl", "url", "path"], progress);
      updateField("embedUrl", url);
    });
  }

  async function uploadOneMedia(file: File, kind: MediaKind) {
    const isVideo = kind === "previewVideoUrl";
    const validImage = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    const validVideo = ["video/mp4", "video/webm"].includes(file.type);
    if (isVideo ? !validVideo : !validImage) {
      setActionError(isVideo ? "Choose an MP4 or WebM preview video." : "Choose a JPEG, PNG, or WebP image.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    await runUpload(`Uploading ${file.name}`, async (progress) => {
      const url = await uploadWithProgress("/api/upload/media", formData, ["url", "fileUrl", "path"], progress);
      updateField(kind, url);
    });
  }

  async function uploadScreenshots(files: File[]) {
    const available = 12 - form.screenshots.length;
    if (available <= 0) {
      setActionError("A game can have up to 12 screenshots.");
      return;
    }
    const selected = files.slice(0, available);
    if (files.length > available) setActionError(`Only the first ${available} screenshot${available === 1 ? " was" : "s were"} added; the limit is 12.`);
    for (let index = 0; index < selected.length; index += 1) {
      const file = selected[index];
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setActionError("Screenshots must be JPEG, PNG, or WebP images.");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      const uploaded = await runUpload(`Uploading screenshot ${index + 1} of ${selected.length}`, async (progress) => {
        const url = await uploadWithProgress("/api/upload/media", formData, ["url", "fileUrl", "path"], (value) => progress(Math.round(((index + value / 100) / selected.length) * 100)));
        setForm((current) => current.screenshots.includes(url) ? current : { ...current, screenshots: [...current.screenshots, url] });
        setErrors((current) => {
          const next = { ...current };
          delete next.screenshots;
          return next;
        });
      });
      if (!uploaded) return;
    }
  }

  function toggleTag(id: number, checked: boolean) {
    updateField("tagIds", checked ? [...new Set([...form.tagIds, id])] : form.tagIds.filter((tagId) => tagId !== id));
  }

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow={game ? "Edit listing" : "New listing"}
        title={game ? `Edit ${game.title}` : "Add a new game"}
        description={game ? "Update the game build, presentation, classification, and publishing settings." : "Create a complete portal listing in four focused steps."}
        actions={<Link href="/admin/games" className={styles.secondaryButton}><ArrowLeft size={16} /> Back to library</Link>}
      />

      <ol className={styles.stepper} aria-label="Game setup progress">
        {steps.map((item, index) => {
          const Icon = item.icon;
          const complete = readiness[index] && index !== step;
          return (
            <li key={item.title} className={`${styles.stepItem} ${index === step ? styles.stepItemActive : ""} ${index < step ? styles.stepItemComplete : ""}`} aria-current={index === step ? "step" : undefined}>
              <span className={styles.stepNumber}>{index < step ? <Check size={16} /> : <Icon size={16} />}</span>
              <span className={styles.stepCopy}><strong>{item.title}</strong><small>{item.description}</small></span>
              {complete ? <CheckCircle2 size={15} className={styles.stepCheck} /> : null}
            </li>
          );
        })}
      </ol>

      {actionError ? <Banner tone="error">{actionError}</Banner> : null}
      {successMessage ? <Banner tone="success">{successMessage}</Banner> : null}
      {upload ? (
        <div className={styles.uploadProgress} role="status" aria-live="polite">
          <LoaderCircle size={18} className={styles.spinner} />
          <div><strong>{upload.label}</strong><progress max={100} value={upload.progress}>{upload.progress}%</progress></div>
          <span>{upload.progress}%</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className={styles.wizardLayout} noValidate>
        <fieldset className={styles.wizardFieldset} disabled={busy}>
          <section className={`${styles.panel} ${styles.wizardPanel}`} aria-labelledby="wizard-step-title">
            <div className={styles.wizardPanelHeader}>
              <p className={styles.sectionKicker}>Step {step + 1} of {steps.length}</p>
              <h2 id="wizard-step-title" ref={stepHeadingRef} tabIndex={-1}>{steps[step].title}</h2>
              <p>{step === 0 ? "Give players a clear identity and explain what makes this game worth playing." : step === 1 ? "Place the game in the right category and add tags that improve discovery." : step === 2 ? "Connect the playable build and upload the artwork players will see." : "Choose how the game fits the viewport and control its portal visibility."}</p>
            </div>

            <div className={styles.wizardPanelBody}>
              {step === 0 ? (
                <div className={styles.formGrid}>
                  <div className={styles.field}><label htmlFor="game-title">Title <span aria-hidden="true">*</span></label><input id="game-title" data-autofocus="true" value={form.title} onChange={(event) => updateTitle(event.target.value)} placeholder="e.g. Neon Drift" maxLength={200} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "game-title-error" : undefined} /><FieldError id="game-title-error" message={errors.title} /></div>
                  <div className={styles.field}><div className={styles.labelRow}><label htmlFor="game-slug">Slug <span aria-hidden="true">*</span></label><span>{slugEdited ? "Manual" : "Auto-generated"}</span></div><input id="game-slug" value={form.slug} onChange={(event) => { setSlugEdited(true); updateField("slug", event.target.value); }} placeholder="neon-drift" maxLength={220} aria-invalid={Boolean(errors.slug)} aria-describedby="game-slug-hint game-slug-error" /><p id="game-slug-hint" className={styles.fieldHint}>Lowercase letters, numbers, and single hyphens. Editing this stops auto-generation.</p><FieldError id="game-slug-error" message={errors.slug} /></div>
                  <div className={`${styles.field} ${styles.fieldFull}`}><label htmlFor="game-tagline">Tagline</label><input id="game-tagline" value={form.tagline} onChange={(event) => updateField("tagline", event.target.value)} placeholder="A short, punchy summary for cards and search" maxLength={300} aria-invalid={Boolean(errors.tagline)} aria-describedby={errors.tagline ? "game-tagline-error" : undefined} /><FieldError id="game-tagline-error" message={errors.tagline} /></div>
                  <div className={`${styles.field} ${styles.fieldFull}`}><label htmlFor="game-description">Description <span aria-hidden="true">*</span></label><textarea id="game-description" value={form.description} onChange={(event) => updateField("description", event.target.value)} rows={8} placeholder="Describe the gameplay, objectives, and what players can expect. Markdown is supported." aria-invalid={Boolean(errors.description)} aria-describedby="game-description-hint game-description-error" /><p id="game-description-hint" className={styles.fieldHint}>Markdown is rendered safely on the public game page.</p><FieldError id="game-description-error" message={errors.description} /></div>
                  <div className={`${styles.field} ${styles.fieldFull}`}><label htmlFor="game-controls">Controls</label><textarea id="game-controls" value={form.controlsGuide} onChange={(event) => updateField("controlsGuide", event.target.value)} rows={5} placeholder="Keyboard, mouse, touch, or gamepad instructions" aria-invalid={Boolean(errors.controlsGuide)} aria-describedby={errors.controlsGuide ? "game-controls-error" : undefined} /><FieldError id="game-controls-error" message={errors.controlsGuide} /></div>
                  <div className={`${styles.field} ${styles.fieldFull}`}><label htmlFor="game-developer">Developer <span aria-hidden="true">*</span></label><input id="game-developer" value={form.developerName} onChange={(event) => updateField("developerName", event.target.value)} placeholder="Studio or developer name" maxLength={150} aria-invalid={Boolean(errors.developerName)} aria-describedby={errors.developerName ? "game-developer-error" : undefined} /><FieldError id="game-developer-error" message={errors.developerName} /></div>
                </div>
              ) : null}

              {step === 1 ? (
                <div className={styles.classificationForm}>
                  <div className={styles.field}><label htmlFor="game-category">Category <span aria-hidden="true">*</span></label><select id="game-category" data-autofocus="true" value={form.categoryId} onChange={(event) => updateField("categoryId", event.target.value)} aria-invalid={Boolean(errors.categoryId)} aria-describedby={errors.categoryId ? "game-category-error" : undefined}><option value="">Choose a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><FieldError id="game-category-error" message={errors.categoryId} />{!categories.length ? <Banner tone="info">Create a category before adding a game. <Link href="/admin/categories" className={styles.inlineLink}>Manage categories</Link></Banner> : null}</div>
                  <fieldset className={styles.tagFieldset}><legend>Tags <span>Optional</span></legend><p className={styles.fieldHint}>Select every tag that helps players find this game.</p><label htmlFor="tag-search" className={styles.srOnly}>Filter tags</label><div className={styles.tagSearch}><Tags size={16} /><input id="tag-search" type="search" value={tagQuery} onChange={(event) => setTagQuery(event.target.value)} placeholder="Filter tags…" /></div><div className={styles.tagOptions}>{visibleTags.length ? visibleTags.map((tag) => <label key={tag.id} className={`${styles.tagOption} ${form.tagIds.includes(tag.id) ? styles.tagOptionSelected : ""}`}><input type="checkbox" checked={form.tagIds.includes(tag.id)} onChange={(event) => toggleTag(tag.id, event.target.checked)} /><span>{tag.name}</span>{form.tagIds.includes(tag.id) ? <Check size={14} /> : null}</label>) : <p className={styles.mutedText}>{tags.length ? "No tags match this filter." : "No tags exist yet. You can add them in Categories & tags."}</p>}</div><p className={styles.selectionCount}>{form.tagIds.length} tag{form.tagIds.length === 1 ? "" : "s"} selected</p></fieldset>
                </div>
              ) : null}

              {step === 2 ? (
                <div className={styles.sourceMediaForm}>
                  <fieldset className={styles.sourceFieldset}><legend>Game source <span aria-hidden="true">*</span></legend><div className={styles.sourceCards}>
                    <label className={`${styles.sourceCard} ${form.sourceType === "UPLOADED_ZIP" ? styles.sourceCardActive : ""}`}><input type="radio" name="sourceType" value="UPLOADED_ZIP" checked={form.sourceType === "UPLOADED_ZIP"} onChange={() => updateField("sourceType", "UPLOADED_ZIP")} /><span className={styles.sourceIcon}><FileArchive size={22} /></span><strong>Uploaded ZIP</strong><small>Host an HTML5 build on this portal</small></label>
                    <label className={`${styles.sourceCard} ${form.sourceType === "EXTERNAL_URL" ? styles.sourceCardActive : ""}`}><input type="radio" name="sourceType" value="EXTERNAL_URL" checked={form.sourceType === "EXTERNAL_URL"} onChange={() => updateField("sourceType", "EXTERNAL_URL")} /><span className={styles.sourceIcon}><ExternalLink size={22} /></span><strong>External URL</strong><small>Embed a game hosted on an HTTPS URL</small></label>
                  </div></fieldset>

                  {form.sourceType === "UPLOADED_ZIP" ? (
                    <div className={styles.sourceDetail}><UploadControl id="bundle-upload" label="Upload game build" hint=".zip containing index.html · multipart fields: slug + bundle" accept=".zip,application/zip" disabled={busy} onFiles={(files) => void uploadBundle(files[0])} />{form.embedUrl ? <div className={styles.uploadedFile}><CheckCircle2 size={17} /><div><strong>Build connected</strong><code>{form.embedUrl}</code></div></div> : <p className={styles.fieldHint}><Info size={14} /> The upload endpoint will return the local index.html URL.</p>}<FieldError id="game-embed-error" message={errors.embedUrl} /></div>
                  ) : (
                    <div className={styles.field}><label htmlFor="game-external-url">External HTTPS URL <span aria-hidden="true">*</span></label><input id="game-external-url" data-autofocus="true" type="url" value={form.embedUrl} onChange={(event) => updateField("embedUrl", event.target.value)} placeholder="https://games.example.com/play/my-game" inputMode="url" aria-invalid={Boolean(errors.embedUrl)} aria-describedby="game-external-hint game-embed-error" /><p id="game-external-hint" className={styles.fieldHint}>Use the direct HTTPS page that contains the playable game.</p><FieldError id="game-embed-error" message={errors.embedUrl} /></div>
                  )}

                  <div className={styles.formSectionDivider}><span>Media library</span></div>
                  <div className={styles.mediaUploadGrid}>
                    <div className={styles.mediaUploadCard}><div className={styles.mediaCardHeading}><span><ImagePlus size={18} /></span><div><strong>Cover <span aria-hidden="true">*</span></strong><small>Primary image used across the portal</small></div></div><UploadControl id="thumbnail-upload" label={form.thumbnailUrl ? "Replace cover" : "Upload cover"} hint="JPEG, PNG, or WebP" accept="image/jpeg,image/png,image/webp" disabled={busy} onFiles={(files) => void uploadOneMedia(files[0], "thumbnailUrl")} />{form.thumbnailUrl ? <ImagePreview src={form.thumbnailUrl} alt="Selected game cover" onRemove={() => updateField("thumbnailUrl", "")} /> : null}<FieldError id="game-thumbnail-error" message={errors.thumbnailUrl} /></div>
                    <div className={styles.mediaUploadCard}><div className={styles.mediaCardHeading}><span><ImagePlus size={18} /></span><div><strong>Poster</strong><small>Optional tall artwork for detail pages</small></div></div><UploadControl id="poster-upload" label={form.posterUrl ? "Replace poster" : "Upload poster"} hint="Optional image" accept="image/jpeg,image/png,image/webp" disabled={busy} onFiles={(files) => void uploadOneMedia(files[0], "posterUrl")} />{form.posterUrl ? <ImagePreview src={form.posterUrl} alt="Selected game poster" onRemove={() => updateField("posterUrl", "")} /> : null}<FieldError id="game-poster-error" message={errors.posterUrl} /></div>
                    <div className={`${styles.mediaUploadCard} ${styles.fieldFull}`}><div className={styles.mediaCardHeading}><span><Video size={18} /></span><div><strong>Hover preview video</strong><small>Optional silent preview shown on game cards</small></div></div><UploadControl id="preview-upload" label={form.previewVideoUrl ? "Replace preview video" : "Upload preview video"} hint="MP4 or WebM" accept="video/mp4,video/webm" disabled={busy} onFiles={(files) => void uploadOneMedia(files[0], "previewVideoUrl")} />{form.previewVideoUrl ? <div className={styles.videoPreview}><video src={form.previewVideoUrl} controls preload="metadata" aria-label="Selected hover preview video" /><button type="button" className={styles.mediaRemove} onClick={() => updateField("previewVideoUrl", "")} aria-label="Remove preview video"><X size={15} /></button></div> : null}<FieldError id="game-preview-error" message={errors.previewVideoUrl} /></div>
                  </div>

                  <div className={styles.screenshotsSection}><div className={styles.mediaCardHeading}><span><Film size={18} /></span><div><strong>Screenshots</strong><small>Up to 12 images · {form.screenshots.length} added</small></div></div><UploadControl id="screenshots-upload" label="Upload screenshots" hint="Select multiple JPEG, PNG, or WebP images" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || form.screenshots.length >= 12} onFiles={(files) => void uploadScreenshots(files)} />{form.screenshots.length ? <div className={styles.screenshotGrid}>{form.screenshots.map((url, index) => <ImagePreview key={`${url}-${index}`} src={url} alt={`Game screenshot ${index + 1}`} onRemove={() => updateField("screenshots", form.screenshots.filter((_, itemIndex) => itemIndex !== index))} />)}</div> : null}<FieldError id="game-screenshots-error" message={errors.screenshots} /></div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className={styles.publishingForm}>
                  <div className={styles.formSectionTitle}><Monitor size={19} /><div><h3>Viewport</h3><p>Set the player frame and device expectations.</p></div></div>
                  <div className={styles.formGrid}>
                    <div className={styles.field}><label htmlFor="game-aspect">Aspect ratio</label><select id="game-aspect" data-autofocus="true" value={form.aspectRatio} onChange={(event) => updateField("aspectRatio", event.target.value as AspectRatio)}><option value="RATIO_16_9">16:9 widescreen</option><option value="RATIO_4_3">4:3 classic</option><option value="RATIO_9_16">9:16 portrait</option><option value="RESPONSIVE">Responsive / fluid</option></select></div>
                    <div className={styles.field}><label htmlFor="game-orientation">Orientation</label><select id="game-orientation" value={form.orientation} onChange={(event) => updateField("orientation", event.target.value as Orientation)}><option value="LANDSCAPE">Landscape</option><option value="PORTRAIT">Portrait</option><option value="ANY">Any orientation</option></select></div>
                  </div>
                  <div className={styles.settingRow}><span className={styles.settingIcon}><Smartphone size={19} /></span><div><strong>Mobile support</strong><p>Show this game as compatible with touch and mobile devices.</p></div><Toggle checked={form.supportsMobile} onChange={(checked) => updateField("supportsMobile", checked)} label="Supports mobile devices" disabled={busy} /></div>

                  <div className={styles.formSectionDivider}><span>Publishing</span></div>
                  <div className={styles.field}><label htmlFor="game-status">Status</label><select id="game-status" value={form.status} onChange={(event) => updateField("status", event.target.value as GameForm["status"])}><option value="DRAFT">Draft — hidden from players</option><option value="PUBLISHED">Published — live on the portal</option><option value="ARCHIVED">Archived — removed from discovery</option></select>{form.status === "PUBLISHED" ? <Banner tone="info">Published games become visible on the portal as soon as you save.</Banner> : null}</div>
                  <div className={styles.settingRow}><span className={styles.settingIcon}><Star size={19} /></span><div><strong>Featured game</strong><p>Highlight this listing in featured placements on the portal.</p></div><Toggle checked={form.isFeatured} onChange={(checked) => updateField("isFeatured", checked)} label="Featured game" disabled={busy} /></div>
                  <div className={styles.settingRow}><span className={styles.settingIcon}><Layers3 size={19} /></span><div><strong>Trending game</strong><p>Include this listing in the portal’s trending collection.</p></div><Toggle checked={form.isTrending} onChange={(checked) => updateField("isTrending", checked)} label="Trending game" disabled={busy} /></div>

                  <div className={styles.publishReview}><h3>Ready to save</h3><dl><div><dt>Game</dt><dd>{form.title || "Untitled game"}</dd></div><div><dt>Category</dt><dd>{selectedCategory?.name || "Not selected"}</dd></div><div><dt>Source</dt><dd>{form.sourceType === "UPLOADED_ZIP" ? "Uploaded ZIP" : "External HTTPS URL"}</dd></div><div><dt>Status</dt><dd>{form.status.charAt(0) + form.status.slice(1).toLowerCase()}</dd></div></dl></div>
                </div>
              ) : null}
            </div>

            <div className={styles.wizardFooter}><div>{step > 0 ? <button type="button" className={styles.secondaryButton} onClick={() => moveToStep(step - 1)} disabled={busy}><ArrowLeft size={16} /> Back</button> : <Link href="/admin/games" className={styles.secondaryButton}>Cancel</Link>}</div><span>Step {step + 1} of {steps.length}</span>{step < steps.length - 1 ? <button type="submit" className={styles.primaryButton}>Continue <ArrowRight size={16} /></button> : <button type="submit" className={styles.primaryButton} disabled={busy}>{saving ? <LoaderCircle size={16} className={styles.spinner} /> : <Save size={16} />}{saving ? "Saving…" : game ? "Save changes" : "Create game"}</button>}</div>
          </section>
        </fieldset>

        <aside className={styles.wizardAside} aria-label="Listing readiness">
          <div className={`${styles.panel} ${styles.readinessPanel}`}><div className={styles.panelHeader}><div><p className={styles.sectionKicker}>Checklist</p><h2>Listing readiness</h2></div></div><ul className={styles.readinessList}>{steps.map((item, index) => <li key={item.title} className={readiness[index] ? styles.readinessDone : ""}>{readiness[index] ? <CheckCircle2 size={17} /> : <Circle size={17} />}<span>{item.title}</span></li>)}</ul><p className={styles.readinessNote}>Each step is validated before you continue. Required fields cannot be skipped.</p></div>
          {form.thumbnailUrl ? (
            <div className={`${styles.panel} ${styles.wizardPreviewPanel}`}>
              <p className={styles.sectionKicker}>Cover preview</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.thumbnailUrl} alt="Current game cover preview" />
              <strong>{form.title || "Untitled game"}</strong>
              <span>{form.tagline || "No tagline added"}</span>
            </div>
          ) : null}
          <div className={styles.wizardTip}><Gamepad2 size={19} /><p><strong>Build for the player.</strong> Clear controls and accurate mobile support help players choose the right game.</p></div>
        </aside>
      </form>
    </div>
  );
}
