/*
  Warnings:

  - You are about to alter the column `oauth_provider` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `oauth_subject` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.

*/
-- AlterTable
ALTER TABLE "users" ALTER COLUMN "oauth_provider" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "oauth_subject" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "updated_at" DROP DEFAULT;
