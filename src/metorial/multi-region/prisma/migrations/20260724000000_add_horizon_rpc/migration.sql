CREATE TABLE "Horizon" (
    "oid" SERIAL NOT NULL,
    "identifier" TEXT NOT NULL,
    "endpointUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Horizon_pkey" PRIMARY KEY ("oid")
);

CREATE TABLE "HorizonToken" (
    "oid" SERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "horizonOid" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HorizonToken_pkey" PRIMARY KEY ("oid")
);

CREATE UNIQUE INDEX "Horizon_identifier_key" ON "Horizon"("identifier");
CREATE UNIQUE INDEX "HorizonToken_id_key" ON "HorizonToken"("id");
CREATE INDEX "HorizonToken_horizonOid_expiresAt_idx" ON "HorizonToken"("horizonOid", "expiresAt");

ALTER TABLE "HorizonToken"
ADD CONSTRAINT "HorizonToken_horizonOid_fkey"
FOREIGN KEY ("horizonOid") REFERENCES "Horizon"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
