-- AlterTable
ALTER TABLE "MetorialConfig" ALTER COLUMN "sessionRunner" SET DEFAULT 'engine';

-- CreateTable
CREATE TABLE "SessionConnection" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "serverSessionOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "SessionConnection_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionConnection_id_key" ON "SessionConnection"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SessionConnection_serverSessionOid_key" ON "SessionConnection"("serverSessionOid");

-- AddForeignKey
ALTER TABLE "SessionConnection" ADD CONSTRAINT "SessionConnection_serverSessionOid_fkey" FOREIGN KEY ("serverSessionOid") REFERENCES "ServerSession"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnection" ADD CONSTRAINT "SessionConnection_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnection" ADD CONSTRAINT "SessionConnection_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
