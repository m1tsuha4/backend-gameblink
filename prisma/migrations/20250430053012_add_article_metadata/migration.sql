/*
  Warnings:

  - Added the required column `slug` to the `Article` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Article` ADD COLUMN `contentHtml` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `contentRaw` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `coverImage` VARCHAR(191) NULL,
    ADD COLUMN `excerpt` VARCHAR(191) NULL,
    ADD COLUMN `isPublished` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `likes` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `publishedAt` DATETIME(3) NULL,
    ADD COLUMN `slug` VARCHAR(191) NOT NULL,
    ADD COLUMN `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN `views` INTEGER NOT NULL DEFAULT 0;
