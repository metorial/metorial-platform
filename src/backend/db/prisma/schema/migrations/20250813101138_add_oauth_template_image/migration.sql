/*
  Warnings:

  - Made the column `metadata` on table `ProviderOAuthConnection` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."ProviderOAuthConnection" ALTER COLUMN "metadata" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."ProviderOAuthConnectionTemplate" ADD COLUMN     "imageUrl" TEXT;
