-- AlterTable
ALTER TABLE "SlateAttachment" ADD COLUMN     "egressPolicy" JSONB,
ADD COLUMN     "enclaveId" TEXT,
ADD COLUMN     "instanceConfigurationOid" BIGINT;

-- AddForeignKey
ALTER TABLE "SlateAttachment" ADD CONSTRAINT "SlateAttachment_instanceConfigurationOid_fkey" FOREIGN KEY ("instanceConfigurationOid") REFERENCES "SlateInstanceConfiguration"("oid") ON DELETE SET NULL ON UPDATE CASCADE;
