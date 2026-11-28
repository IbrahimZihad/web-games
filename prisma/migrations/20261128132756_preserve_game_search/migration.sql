-- CreateIndex
CREATE FULLTEXT INDEX `Game_title_tagline_description_idx` ON `Game`(`title`, `tagline`, `description`);
