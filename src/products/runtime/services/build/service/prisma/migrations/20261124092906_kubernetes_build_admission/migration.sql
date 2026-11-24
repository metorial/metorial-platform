-- AlterTable
ALTER TABLE "WorkflowRun" ADD COLUMN     "failureCode" TEXT,
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "kubernetesAdmittedAt" TIMESTAMP(3),
ADD COLUMN     "kubernetesQueuedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "WorkflowRun_providerOid_status_kubernetesAdmittedAt_kuberne_idx" ON "WorkflowRun"("providerOid", "status", "kubernetesAdmittedAt", "kubernetesQueuedAt", "oid");
