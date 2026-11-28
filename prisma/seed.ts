import bcrypt from "bcryptjs";
import { PrismaClient, type AspectRatio, type Orientation, type SourceType } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  { name: "Action", slug: "action", iconName: "swords", displayOrder: 1, description: "Fast reflexes, big stakes, and non-stop action." },
  { name: "Adventure", slug: "adventure", iconName: "compass", displayOrder: 2, description: "Explore new worlds and uncover hidden stories." },
  { name: "Racing", slug: "racing", iconName: "flag", displayOrder: 3, description: "Hit the track and chase the perfect lap." },
  { name: "Puzzle", slug: "puzzle", iconName: "puzzle", displayOrder: 4, description: "Sharpen your mind with clever challenges." },
  { name: "Shooting", slug: "shooting", iconName: "crosshair", displayOrder: 5, description: "Take aim and test your precision." },
  { name: "Sports", slug: "sports", iconName: "trophy", displayOrder: 6, description: "Competitive play for every kind of athlete." },
  { name: "Multiplayer", slug: "multiplayer", iconName: "users", displayOrder: 7, description: "Team up or go head-to-head with friends." },
  { name: "Strategy", slug: "strategy", iconName: "brain", displayOrder: 8, description: "Plan your moves and outthink the competition." },
  { name: "Casual", slug: "casual", iconName: "sparkles", displayOrder: 9, description: "Easy to pick up, hard to put down." },
];

const tags = ["3D", "HTML5", "WebGL", "Unity", "2 Player", "Endless", "Physics", "Pixel Art", "Car", "Arcade", "PixiJS", "Three.js"];

const games = [
  {
    title: "Cyber Runner",
    slug: "cyber-runner",
    tagline: "Outrun the city. Rewrite the night.",
    description: "Sprint through a neon megacity where every rooftop is a trap and every second counts. Dodge barriers, slide under lasers, collect credits, and push your reflexes to the limit in this fast-paced endless runner.\n\nBuilt as a fully playable Canvas demo, Cyber Runner is the perfect way to test the portal's game runtime.",
    controlsGuide: "**Move:** A / D or Left / Right\n**Jump:** Space, W, or Up\n**Slide:** S or Down\n**Pause:** P",
    developerName: "Neon Forge",
    categorySlug: "action",
    sourceType: "UPLOADED_ZIP" as SourceType,
    embedUrl: "/uploads/games/demo-cyber-runner/index.html",
    aspectRatio: "RATIO_16_9" as AspectRatio,
    orientation: "LANDSCAPE" as Orientation,
    supportsMobile: true,
    thumbnailUrl: "/images/games/cyber-runner.svg",
    isFeatured: true,
    isTrending: true,
    playCount: 128450n,
    likesCount: 2847,
    dislikesCount: 31,
    publishedAt: new Date("2026-11-18T10:00:00Z"),
    tagSlugs: ["html5", "endless", "arcade", "pixel-art"],
  },
  {
    title: "Neon Drift",
    slug: "neon-drift",
    tagline: "Own the night. Leave nothing but neon.",
    description: "Weave through traffic at breakneck speed in a rain-soaked city. Switch lanes, build your combo, and see how long you can survive the midnight highway.",
    controlsGuide: "**Steer:** A / D or Left / Right\n**Boost:** Space\n**Pause:** P",
    developerName: "Apex Assembly",
    categorySlug: "racing",
    sourceType: "UPLOADED_ZIP" as SourceType,
    embedUrl: "/uploads/games/neon-drift/index.html",
    aspectRatio: "RATIO_16_9" as AspectRatio,
    orientation: "LANDSCAPE" as Orientation,
    supportsMobile: true,
    thumbnailUrl: "/images/games/neon-drift.svg",
    isFeatured: false,
    isTrending: true,
    playCount: 98320n,
    likesCount: 1934,
    dislikesCount: 22,
    publishedAt: new Date("2026-11-20T10:00:00Z"),
    tagSlugs: ["html5", "car", "arcade", "3d"],
  },
  {
    title: "Blockfall",
    slug: "blockfall",
    tagline: "Stack smart. Clear the skyline.",
    description: "A modern falling-block puzzler with satisfying combos and a clean neon twist. Rotate and place pieces to clear lines before the stack reaches the top.",
    controlsGuide: "**Move:** A / D or Left / Right\n**Rotate:** W or Up\n**Soft drop:** S or Down\n**Hard drop:** Space",
    developerName: "Bitworks Lab",
    categorySlug: "puzzle",
    sourceType: "UPLOADED_ZIP" as SourceType,
    embedUrl: "/uploads/games/blockfall/index.html",
    aspectRatio: "RATIO_4_3" as AspectRatio,
    orientation: "ANY" as Orientation,
    supportsMobile: true,
    thumbnailUrl: "/images/games/blockfall.svg",
    isFeatured: false,
    isTrending: false,
    playCount: 75930n,
    likesCount: 1512,
    dislikesCount: 18,
    publishedAt: new Date("2026-11-12T10:00:00Z"),
    tagSlugs: ["html5", "pixel-art", "arcade"],
  },
  {
    title: "Star Siege",
    slug: "star-siege",
    tagline: "One pilot. An endless swarm.",
    description: "Defend the outer colonies in a pulse-pounding arcade shooter. Dodge incoming fire, destroy enemy formations, and unleash powerful upgrades as the swarm closes in.",
    controlsGuide: "**Move:** WASD or Arrow keys\n**Fire:** Space\n**Pause:** P",
    developerName: "Orbit Interactive",
    categorySlug: "shooting",
    sourceType: "UPLOADED_ZIP" as SourceType,
    embedUrl: "/uploads/games/star-siege/index.html",
    aspectRatio: "RATIO_16_9" as AspectRatio,
    orientation: "LANDSCAPE" as Orientation,
    supportsMobile: true,
    thumbnailUrl: "/images/games/star-siege.svg",
    isFeatured: true,
    isTrending: true,
    playCount: 110240n,
    likesCount: 2260,
    dislikesCount: 27,
    publishedAt: new Date("2026-11-21T10:00:00Z"),
    tagSlugs: ["html5", "arcade", "2-player"],
  },
  {
    title: "Prism Pilot",
    slug: "prism-pilot",
    tagline: "One ship. Every color of chaos.",
    description: "Split the prism and dive into a vivid arcade swarm in this PixiJS 8 shooter. Pilot a responsive starfighter with WASD or arrow keys, hold Space or the pointer to fire, and unleash a screen-clearing prism burst with Shift. Escalating waves, enemy formations, energy pickups, and a worker-driven simulation keep every run sharp.\n\nBuilt as a full-viewport static cartridge with keyboard, mouse, and touch controls, Prism Pilot launches directly inside the portal and reports your score in real time.",
    controlsGuide: "**Steer:** WASD or Arrow keys\n**Fire:** Hold Space, mouse, or touch\n**Prism burst:** Shift or the on-screen burst button\n**Pause:** P or Escape\n**Restart:** R",
    developerName: "Nexus In-House Studio",
    categorySlug: "shooting",
    sourceType: "UPLOADED_ZIP" as SourceType,
    embedUrl: "/uploads/games/prism-pilot/index.html",
    aspectRatio: "RATIO_16_9" as AspectRatio,
    orientation: "LANDSCAPE" as Orientation,
    supportsMobile: true,
    thumbnailUrl: "/images/games/prism-pilot.svg",
    isFeatured: true,
    isTrending: true,
    playCount: 0n,
    likesCount: 0,
    dislikesCount: 0,
    publishedAt: new Date("2026-11-24T12:00:00Z"),
    tagSlugs: ["html5", "arcade", "webgl", "pixijs"],
  },
  {
    title: "Void Rally",
    slug: "void-rally",
    tagline: "No finish line. Only velocity.",
    description: "Thread a neon hover craft through an endless 3D highway in this Three.js racer. Switch lanes with A / D or the arrow keys, hold Space to burn flux boost, and swipe or use the touch controls on mobile. The road gets faster, traffic gets denser, and every clean dodge pushes your score farther into the void.\n\nBuilt as a full-viewport static cartridge with perspective lighting, fog, camera motion, collectible flux cells, and instant restart, Void Rally delivers a complete browser racing run without external assets.",
    controlsGuide: "**Steer:** A / D or Left / Right\n**Touch steer:** Swipe or use the arrow buttons\n**Boost:** Hold Space or the on-screen boost button\n**Pause:** P or Escape\n**Restart:** R",
    developerName: "Nexus In-House Studio",
    categorySlug: "racing",
    sourceType: "UPLOADED_ZIP" as SourceType,
    embedUrl: "/uploads/games/void-rally/index.html",
    aspectRatio: "RATIO_16_9" as AspectRatio,
    orientation: "LANDSCAPE" as Orientation,
    supportsMobile: true,
    thumbnailUrl: "/images/games/void-rally.svg",
    isFeatured: true,
    isTrending: true,
    playCount: 0n,
    likesCount: 0,
    dislikesCount: 0,
    publishedAt: new Date("2026-11-24T12:05:00Z"),
    tagSlugs: ["html5", "3d", "webgl", "three-js", "endless", "arcade"],
  },
  {
    title: "Hoop Rush",
    slug: "hoop-rush",
    tagline: "Beat the clock. Drain the bucket.",
    description: "Find your shooting rhythm in this quick-fire basketball challenge. Time your release, read the defender, and chain baskets before the buzzer sounds.",
    controlsGuide: "**Aim:** Move mouse or A / D\n**Shoot:** Space or click\n**Pause:** P",
    developerName: "Courtside Studio",
    categorySlug: "sports",
    sourceType: "UPLOADED_ZIP" as SourceType,
    embedUrl: "/uploads/games/hoop-rush/index.html",
    aspectRatio: "RATIO_4_3" as AspectRatio,
    orientation: "ANY" as Orientation,
    supportsMobile: true,
    thumbnailUrl: "/images/games/hoop-rush.svg",
    isFeatured: false,
    isTrending: false,
    playCount: 42310n,
    likesCount: 986,
    dislikesCount: 16,
    publishedAt: new Date("2026-11-09T10:00:00Z"),
    tagSlugs: ["html5", "physics", "arcade"],
  },
];

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@12345";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@gameportal.local";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN", isActive: true, passwordHash },
    create: {
      username: "admin",
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
    },
  });

  const player = await prisma.user.upsert({
    where: { email: "player@gameportal.local" },
    update: { role: "PLAYER", isActive: true, passwordHash: await bcrypt.hash("Player@12345", 12) },
    create: {
      username: "player",
      email: "player@gameportal.local",
      passwordHash: await bcrypt.hash("Player@12345", 12),
      role: "PLAYER",
    },
  });

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }

  for (const name of tags) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await prisma.tag.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
  }

  for (const game of games) {
    const { categorySlug, tagSlugs, playCount, likesCount, dislikesCount, ...gameData } = game;
    const data = { ...gameData, status: "PUBLISHED" as const };
    const initialCounters = { playCount, likesCount, dislikesCount };
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: categorySlug } });
    const tagRecords = await Promise.all(
      tagSlugs.map((slug) => prisma.tag.findUniqueOrThrow({ where: { slug } })),
    );

    await prisma.game.upsert({
      where: { slug: game.slug },
      update: {
        ...data,
        categoryId: category.id,
        tags: {
          deleteMany: {},
          create: tagRecords.map((tag) => ({ tagId: tag.id })),
        },
      },
      create: {
        ...data,
        ...initialCounters,
        categoryId: category.id,
        createdById: admin.id,
        screenshots: [game.thumbnailUrl],
        tags: {
          create: tagRecords.map((tag) => ({ tagId: tag.id })),
        },
      },
    });
  }

  const cyberRunner = await prisma.game.findUniqueOrThrow({ where: { slug: "cyber-runner" } });
  const commentCount = await prisma.comment.count({ where: { gameId: cyberRunner.id } });
  if (commentCount === 0) {
    await prisma.comment.createMany({
      data: [
        { gameId: cyberRunner.id, userId: player.id, body: "The jump timing feels great. Cleared 2,000 on my second run!" },
        { gameId: cyberRunner.id, userId: admin.id, body: "Welcome to the portal! Try theater mode for the full neon experience." },
      ],
    });
  }

  console.log(`Seeded ${categories.length} categories, ${tags.length} tags, ${games.length} games, and demo accounts.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
