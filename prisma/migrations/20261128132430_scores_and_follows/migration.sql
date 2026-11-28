-- DropIndex
DROP INDEX `ft_games_search` ON `game`;

-- AlterTable
ALTER TABLE `playhistory` MODIFY `countedAt` TIMESTAMP(0) NULL;

-- CreateTable
CREATE TABLE `UserFollow` (
    `followerId` INTEGER UNSIGNED NOT NULL,
    `followeeId` INTEGER UNSIGNED NOT NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `UserFollow_followeeId_idx`(`followeeId`),
    PRIMARY KEY (`followerId`, `followeeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GameScore` (
    `gameId` INTEGER UNSIGNED NOT NULL,
    `userId` INTEGER UNSIGNED NOT NULL,
    `score` INTEGER UNSIGNED NOT NULL,
    `updatedAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `GameScore_gameId_score_idx`(`gameId`, `score`),
    PRIMARY KEY (`gameId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserFollow` ADD CONSTRAINT `UserFollow_followerId_fkey` FOREIGN KEY (`followerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserFollow` ADD CONSTRAINT `UserFollow_followeeId_fkey` FOREIGN KEY (`followeeId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameScore` ADD CONSTRAINT `GameScore_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameScore` ADD CONSTRAINT `GameScore_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
