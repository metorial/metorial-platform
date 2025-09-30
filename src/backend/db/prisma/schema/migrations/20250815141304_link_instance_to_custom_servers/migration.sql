/*
  Warnings:

  - You are about to drop the column `environmentOid` on the `CustomServerVersion` table. All the data in the column will be lost.
  - You are about to drop the column `instanceOid` on the `ServerVariant` table. All the data in the column will be lost.
  - You are about to drop the `CustomServerEnvironment` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[serverVariantOid]` on the table `CustomServer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[currentVersionOid]` on the table `CustomServer` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `instanceOid` to the `CustomServer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serverVariantOid` to the `CustomServer` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."CustomServerEnvironment" DROP CONSTRAINT "CustomServerEnvironment_currentVersionOid_fkey";

-- DropForeignKey
ALTER TABLE "public"."CustomServerEnvironment" DROP CONSTRAINT "CustomServerEnvironment_customServerOid_fkey";

-- DropForeignKey
ALTER TABLE "public"."CustomServerEnvironment" DROP CONSTRAINT "CustomServerEnvironment_instanceOid_fkey";

-- DropForeignKey
ALTER TABLE "public"."CustomServerEnvironment" DROP CONSTRAINT "CustomServerEnvironment_organizationOid_fkey";

-- DropForeignKey
ALTER TABLE "public"."CustomServerEnvironment" DROP CONSTRAINT "CustomServerEnvironment_serverVariantOid_fkey";

-- DropForeignKey
ALTER TABLE "public"."CustomServerVersion" DROP CONSTRAINT "CustomServerVersion_environmentOid_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServerVariant" DROP CONSTRAINT "ServerVariant_instanceOid_fkey";

-- AlterTable
ALTER TABLE "public"."CustomServer" ADD COLUMN     "currentVersionOid" BIGINT,
ADD COLUMN     "instanceOid" BIGINT NOT NULL,
ADD COLUMN     "maxVersionIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "serverVariantOid" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "public"."CustomServerVersion" DROP COLUMN "environmentOid";

-- AlterTable
ALTER TABLE "public"."ServerVariant" DROP COLUMN "instanceOid";

-- DropTable
DROP TABLE "public"."CustomServerEnvironment";

-- CreateIndex
CREATE UNIQUE INDEX "CustomServer_serverVariantOid_key" ON "public"."CustomServer"("serverVariantOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomServer_currentVersionOid_key" ON "public"."CustomServer"("currentVersionOid");

-- AddForeignKey
ALTER TABLE "public"."CustomServer" ADD CONSTRAINT "CustomServer_serverVariantOid_fkey" FOREIGN KEY ("serverVariantOid") REFERENCES "public"."ServerVariant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServer" ADD CONSTRAINT "CustomServer_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "public"."Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServer" ADD CONSTRAINT "CustomServer_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "public"."CustomServerVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;
