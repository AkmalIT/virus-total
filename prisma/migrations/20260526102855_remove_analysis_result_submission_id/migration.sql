/*
  Warnings:

  - You are about to drop the column `submission_id` on the `analysis_results` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "analysis_results" DROP CONSTRAINT "analysis_results_submission_id_fkey";

-- DropIndex
DROP INDEX "analysis_results_submission_id_idx";

-- AlterTable
ALTER TABLE "analysis_results" DROP COLUMN "submission_id";
