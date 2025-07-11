/*
  Warnings:

  - You are about to drop the column `engineEventsId` on the `SessionEvent` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[engineEventId]` on the table `SessionEvent` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "SessionEvent_engineEventsId_key";

-- AlterTable
ALTER TABLE "SessionEvent" DROP COLUMN "engineEventsId",
ADD COLUMN     "engineEventId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "SessionEvent_engineEventId_key" ON "SessionEvent"("engineEventId");
