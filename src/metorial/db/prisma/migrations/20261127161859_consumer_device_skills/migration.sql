-- CreateTable
CREATE TABLE "ConsumerDeviceSkill" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumerDeviceOid" BIGINT NOT NULL,
    "skillOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,

    CONSTRAINT "ConsumerDeviceSkill_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerDeviceSkill_id_key" ON "ConsumerDeviceSkill"("id");

-- CreateIndex
CREATE INDEX "ConsumerDeviceSkill_instanceOid_name_idx" ON "ConsumerDeviceSkill"("instanceOid", "name");

-- CreateIndex
CREATE INDEX "ConsumerDeviceSkill_skillOid_idx" ON "ConsumerDeviceSkill"("skillOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerDeviceSkill_consumerDeviceOid_name_key" ON "ConsumerDeviceSkill"("consumerDeviceOid", "name");

-- AddForeignKey
ALTER TABLE "ConsumerDeviceSkill" ADD CONSTRAINT "ConsumerDeviceSkill_consumerDeviceOid_fkey" FOREIGN KEY ("consumerDeviceOid") REFERENCES "ConsumerDevice"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerDeviceSkill" ADD CONSTRAINT "ConsumerDeviceSkill_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerDeviceSkill" ADD CONSTRAINT "ConsumerDeviceSkill_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;
