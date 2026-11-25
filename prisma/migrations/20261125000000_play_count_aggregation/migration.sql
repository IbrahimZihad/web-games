-- Existing history is already represented by Game.playCount. Only new rows remain countable.
ALTER TABLE `PlayHistory` ADD COLUMN `countedAt` DATETIME(0) NULL;

UPDATE `PlayHistory` SET `countedAt` = `playedAt`;

CREATE INDEX `PlayHistory_countedAt_id_idx` ON `PlayHistory` (`countedAt`, `id`);
CREATE INDEX `Game_status_categoryId_playCount_publishedAt_idx` ON `Game` (`status`, `categoryId`, `playCount`, `publishedAt`);
