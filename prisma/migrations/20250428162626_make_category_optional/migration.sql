-- DropForeignKey
ALTER TABLE `Article` DROP FOREIGN KEY `Article_categoryId_fkey`;

-- DropIndex
DROP INDEX `Article_categoryId_fkey` ON `Article`;

-- AlterTable
ALTER TABLE `Article` MODIFY `categoryId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Article` ADD CONSTRAINT `Article_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
