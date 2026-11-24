export type Role = "PLAYER" | "ADMIN";
export type GameStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type SourceType = "UPLOADED_ZIP" | "EXTERNAL_URL";
export type AspectRatio = "RATIO_16_9" | "RATIO_4_3" | "RATIO_9_16" | "RESPONSIVE";
export type Orientation = "LANDSCAPE" | "PORTRAIT" | "ANY";
export type VoteType = "LIKE" | "DISLIKE";

export interface SessionUser {
  id: number;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
}

export interface CategoryDTO {
  id: number;
  name: string;
  slug: string;
  iconName: string;
  description: string | null;
  displayOrder: number;
  gameCount: number;
}

export interface TagDTO {
  id: number;
  name: string;
  slug: string;
}

export interface CommentDTO {
  id: number;
  body: string;
  createdAt: string;
  user: SessionUser;
}

export interface GameDTO {
  id: number;
  title: string;
  slug: string;
  tagline: string | null;
  description: string;
  controlsGuide: string | null;
  developerName: string;
  category: CategoryDTO;
  tags: TagDTO[];
  sourceType: SourceType;
  embedUrl: string;
  aspectRatio: AspectRatio;
  orientation: Orientation;
  supportsMobile: boolean;
  thumbnailUrl: string;
  posterUrl: string | null;
  previewVideoUrl: string | null;
  screenshots: string[];
  status: GameStatus;
  isFeatured: boolean;
  isTrending: boolean;
  isNew?: boolean;
  playCount: number;
  likesCount: number;
  dislikesCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  comments: CommentDTO[];
  similarGames: GameDTO[];
}

export interface HomeFeed {
  featured: GameDTO[];
  trending: GameDTO[];
  newReleases: GameDTO[];
  categoryRows: { category: CategoryDTO; games: GameDTO[] }[];
}

export interface AdminStats {
  totalGames: number;
  publishedGames: number;
  draftGames: number;
  totalPlays: number;
  totalUsers: number;
  topGames: GameDTO[];
}

export interface GameFilters {
  categorySlug?: string;
  tagSlug?: string;
  search?: string;
  status?: GameStatus;
  limit?: number;
  offset?: number;
  featured?: boolean;
  trending?: boolean;
  sort?: "popular" | "newest" | "updated" | "rating" | "title";
}
