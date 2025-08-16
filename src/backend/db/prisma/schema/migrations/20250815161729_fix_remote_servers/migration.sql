-- DropForeignKey
ALTER TABLE "public"."RemoteServerInstance" DROP CONSTRAINT "RemoteServerInstance_instanceOid_fkey";

-- AddForeignKey
ALTER TABLE "public"."RemoteServerInstance" ADD CONSTRAINT "RemoteServerInstance_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "public"."Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
