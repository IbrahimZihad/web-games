-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `avatarUrl` VARCHAR(500) NULL,
    `role` ENUM('PLAYER', 'ADMIN') NOT NULL DEFAULT 'PLAYER',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `iconName` VARCHAR(100) NOT NULL DEFAULT 'gamepad',
    `description` TEXT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `Category_name_key`(`name`),
    UNIQUE INDEX `Category_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Game` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(220) NOT NULL,
    `tagline` VARCHAR(300) NULL,
    `description` TEXT NOT NULL,
    `controlsGuide` TEXT NULL,
    `developerName` VARCHAR(150) NOT NULL DEFAULT 'In-House Studio',
    `categoryId` INTEGER UNSIGNED NOT NULL,
    `sourceType` ENUM('UPLOADED_ZIP', 'EXTERNAL_URL') NOT NULL DEFAULT 'UPLOADED_ZIP',
    `embedUrl` VARCHAR(500) NOT NULL,
    `aspectRatio` ENUM('RATIO_16_9', 'RATIO_4_3', 'RATIO_9_16', 'RESPONSIVE') NOT NULL DEFAULT 'RATIO_16_9',
    `orientation` ENUM('LANDSCAPE', 'PORTRAIT', 'ANY') NOT NULL DEFAULT 'LANDSCAPE',
    `supportsMobile` BOOLEAN NOT NULL DEFAULT false,
    `thumbnailUrl` VARCHAR(500) NOT NULL,
    `posterUrl` VARCHAR(500) NULL,
    `previewVideoUrl` VARCHAR(500) NULL,
    `screenshots` JSON NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `isTrending` BOOLEAN NOT NULL DEFAULT false,
    `playCount` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `likesCount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `dislikesCount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `createdById` INTEGER UNSIGNED NULL,
    `publishedAt` TIMESTAMP(0) NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `Game_slug_key`(`slug`),
    INDEX `Game_status_publishedAt_idx`(`status`, `publishedAt`),
    INDEX `Game_categoryId_idx`(`categoryId`),
    INDEX `Game_playCount_idx`(`playCount`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `Tag_name_key`(`name`),
    UNIQUE INDEX `Tag_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GameTag` (
    `gameId` INTEGER UNSIGNED NOT NULL,
    `tagId` INTEGER UNSIGNED NOT NULL,

    PRIMARY KEY (`gameId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserFavorite` (
    `userId` INTEGER UNSIGNED NOT NULL,
    `gameId` INTEGER UNSIGNED NOT NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`userId`, `gameId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlayHistory` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `userId` INTEGER UNSIGNED NULL,
    `sessionFingerprint` VARCHAR(128) NULL,
    `gameId` INTEGER UNSIGNED NOT NULL,
    `playedAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `PlayHistory_userId_playedAt_idx`(`userId`, `playedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GameRating` (
    `userId` INTEGER UNSIGNED NOT NULL,
    `gameId` INTEGER UNSIGNED NOT NULL,
    `vote` ENUM('LIKE', 'DISLIKE') NOT NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`userId`, `gameId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Comment` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `gameId` INTEGER UNSIGNED NOT NULL,
    `userId` INTEGER UNSIGNED NOT NULL,
    `body` TEXT NOT NULL,
    `isHidden` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `Comment_gameId_createdAt_idx`(`gameId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Game` ADD CONSTRAINT `Game_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Game` ADD CONSTRAINT `Game_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameTag` ADD CONSTRAINT `GameTag_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameTag` ADD CONSTRAINT `GameTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserFavorite` ADD CONSTRAINT `UserFavorite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserFavorite` ADD CONSTRAINT `UserFavorite_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayHistory` ADD CONSTRAINT `PlayHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayHistory` ADD CONSTRAINT `PlayHistory_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameRating` ADD CONSTRAINT `GameRating_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameRating` ADD CONSTRAINT `GameRating_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Full-text discovery search
CREATE FULLTEXT INDEX `ft_games_search` ON `Game`(`title`, `tagline`, `description`);
