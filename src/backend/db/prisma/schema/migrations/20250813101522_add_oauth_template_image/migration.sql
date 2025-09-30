/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `ProviderOAuthConnectionTemplate` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."ProviderOAuthConnectionTemplate" DROP COLUMN "imageUrl",
ADD COLUMN     "image" JSONB NOT NULL DEFAULT '{ "type": "default" }';
