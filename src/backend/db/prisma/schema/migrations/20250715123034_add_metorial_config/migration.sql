-- CreateEnum
CREATE TYPE "MetorialConfigSessionRunner" AS ENUM ('legacy', 'engine');

-- CreateEnum
CREATE TYPE "MetorialConfigId" AS ENUM ('metorial');

-- CreateTable
CREATE TABLE "MetorialConfig" (
    "id" "MetorialConfigId" NOT NULL DEFAULT 'metorial',
    "sessionRunner" "MetorialConfigSessionRunner" NOT NULL DEFAULT 'legacy',
    "instanceIdentifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetorialConfig_pkey" PRIMARY KEY ("id")
);
