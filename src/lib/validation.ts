import { z } from "zod";

const pathOrUrl = z.string().trim().min(1).max(500).refine(
  (value) => value.startsWith("/") || /^https:\/\/[^\s]+$/i.test(value),
  "Use a local path or an HTTPS URL.",
);

export const registerSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters.").max(50).regex(/^[a-zA-Z0-9_.-]+$/, "Use letters, numbers, dots, dashes, or underscores."),
  email: z.string().trim().email("Enter a valid email address.").max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const gameInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  slug: z.string().trim().min(1).max(220).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and single hyphens."),
  tagline: z.string().trim().max(300).optional().nullable(),
  description: z.string().trim().min(1, "Description is required.").max(20000),
  controlsGuide: z.string().trim().max(10000).optional().nullable(),
  developerName: z.string().trim().min(1).max(150).default("In-House Studio"),
  categoryId: z.coerce.number().int().positive(),
  tagIds: z.array(z.coerce.number().int().positive()).optional().default([]),
  sourceType: z.enum(["UPLOADED_ZIP", "EXTERNAL_URL"]),
  embedUrl: z.string().trim().min(1).max(500),
  aspectRatio: z.enum(["RATIO_16_9", "RATIO_4_3", "RATIO_9_16", "RESPONSIVE"]),
  orientation: z.enum(["LANDSCAPE", "PORTRAIT", "ANY"]).default("LANDSCAPE"),
  supportsMobile: z.boolean().default(false),
  thumbnailUrl: pathOrUrl,
  posterUrl: pathOrUrl.optional().nullable(),
  previewVideoUrl: pathOrUrl.optional().nullable(),
  screenshots: z.array(pathOrUrl).max(12).optional().default([]),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  isFeatured: z.boolean().default(false),
  isTrending: z.boolean().default(false),
}).superRefine((input, context) => {
  if (input.sourceType === "EXTERNAL_URL" && !/^https:\/\/[^\s]+$/i.test(input.embedUrl)) {
    context.addIssue({ code: "custom", path: ["embedUrl"], message: "External game sources must use HTTPS." });
  }
  if (input.sourceType === "UPLOADED_ZIP" && !/^\/uploads\/games\/[a-z0-9-]+\/index\.html$/.test(input.embedUrl)) {
    context.addIssue({ code: "custom", path: ["embedUrl"], message: "Uploaded builds must use a local game index.html URL." });
  }
});

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  iconName: z.string().trim().min(1).max(100).default("gamepad"),
  description: z.string().trim().max(1000).optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const tagSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}
