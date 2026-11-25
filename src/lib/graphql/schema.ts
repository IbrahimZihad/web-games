export const typeDefs = /* GraphQL */ `
  enum Role { PLAYER ADMIN }
  enum GameStatus { DRAFT PUBLISHED ARCHIVED }
  enum SourceType { UPLOADED_ZIP EXTERNAL_URL }
  enum AspectRatio { RATIO_16_9 RATIO_4_3 RATIO_9_16 RESPONSIVE }
  enum VoteType { LIKE DISLIKE }

  type User {
    id: ID!
    username: String!
    email: String!
    avatarUrl: String
    role: Role!
  }

  type PublicUser {
    id: ID!
    username: String!
    avatarUrl: String
    role: Role!
  }

  type Category {
    id: ID!
    name: String!
    slug: String!
    iconName: String!
    description: String
    displayOrder: Int!
    gameCount: Int!
  }

  type Tag {
    id: ID!
    name: String!
    slug: String!
  }

  type Comment {
    id: ID!
    body: String!
    createdAt: String!
    user: PublicUser!
  }

  type Game {
    id: ID!
    title: String!
    slug: String!
    tagline: String
    description: String!
    controlsGuide: String
    developerName: String!
    category: Category!
    tags: [Tag!]!
    sourceType: SourceType!
    embedUrl: String!
    aspectRatio: AspectRatio!
    orientation: String!
    supportsMobile: Boolean!
    thumbnailUrl: String!
    posterUrl: String
    previewVideoUrl: String
    screenshots: [String!]!
    status: GameStatus!
    isFeatured: Boolean!
    isTrending: Boolean!
    playCount: Float!
    likesCount: Int!
    dislikesCount: Int!
    publishedAt: String
    createdAt: String!
    updatedAt: String!
    comments: [Comment!]!
    similarGames: [Game!]!
  }

  type HomeFeed {
    featured: [Game!]!
    trending: [Game!]!
    newReleases: [Game!]!
    categoryRows: [CategoryRow!]!
  }

  type CategoryRow {
    category: Category!
    games: [Game!]!
  }

  type PlayHistoryItem {
    game: Game!
    playedAt: String!
  }

  type PlayerLibrary {
    favorites: [Game!]!
    playHistory: [PlayHistoryItem!]!
  }

  type AdminStats {
    totalGames: Int!
    publishedGames: Int!
    draftGames: Int!
    totalPlays: Float!
    totalUsers: Int!
    topGames: [Game!]!
  }

  input UpsertGameInput {
    title: String!
    slug: String!
    tagline: String
    description: String!
    controlsGuide: String
    developerName: String
    categoryId: ID!
    tagIds: [ID!]
    sourceType: SourceType!
    embedUrl: String!
    aspectRatio: AspectRatio!
    orientation: String
    supportsMobile: Boolean
    thumbnailUrl: String!
    posterUrl: String
    previewVideoUrl: String
    screenshots: [String!]
    status: GameStatus!
    isFeatured: Boolean
    isTrending: Boolean
  }

  type Query {
    me: User
    homeFeed: HomeFeed!
    games(categorySlug: String, tagSlug: String, search: String, featured: Boolean, trending: Boolean, sort: String, limit: Int = 24, offset: Int = 0): [Game!]!
    gameBySlug(slug: String!): Game
    gameById(id: ID!): Game
    gamesByIds(ids: [ID!]!): [Game!]!
    categories: [Category!]!
    tags: [Tag!]!
    myFavorites: [Game!]!
    myPlayHistory: [PlayHistoryItem!]!
    myLibrary: PlayerLibrary!
    adminStats: AdminStats!
    adminGames(search: String, status: GameStatus, limit: Int, offset: Int): [Game!]!
  }

  type Mutation {
    register(username: String!, email: String!, password: String!): User!
    login(email: String!, password: String!): User!
    logout: Boolean!

    recordPlay(gameId: ID!): Boolean!
    toggleFavorite(gameId: ID!): Boolean!
    voteGame(gameId: ID!, vote: VoteType!): Game!
    addComment(gameId: ID!, body: String!): Comment!
    syncGuestLibrary(favoriteGameIds: [ID!], playedGameIds: [ID!]): Boolean!

    createGame(input: UpsertGameInput!): Game!
    updateGame(id: ID!, input: UpsertGameInput!): Game!
    deleteGame(id: ID!): Boolean!
    createCategory(name: String!, slug: String!, iconName: String!, description: String, displayOrder: Int): Category!
    updateCategory(id: ID!, name: String!, slug: String!, iconName: String!, description: String, displayOrder: Int): Category!
    deleteCategory(id: ID!): Boolean!
    createTag(name: String!, slug: String!): Tag!
    updateTag(id: ID!, name: String!, slug: String!): Tag!
    deleteTag(id: ID!): Boolean!
  }
`;
