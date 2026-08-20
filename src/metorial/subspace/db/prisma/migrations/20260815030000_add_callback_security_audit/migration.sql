CREATE TYPE "CallbackSecurityAuditAction" AS ENUM (
  'secret_created',
  'secret_imported',
  'secret_projected',
  'secret_rotated',
  'secret_revoked',
  'secret_issuance_receipt_issued',
  'secret_issuance_receipt_consumed',
  'secret_issuance_receipt_denied'
);

CREATE TABLE "CallbackSecurityAuditRecord" (
  "oid" BIGINT NOT NULL,
  "id" TEXT NOT NULL,
  "tenantOid" BIGINT,
  "callbackOid" BIGINT,
  "callbackInstanceOid" BIGINT,
  "hubReceiverId" TEXT NOT NULL,
  "hubAuditCorrelationId" TEXT NOT NULL,
  "tenantIdSnapshot" TEXT NOT NULL,
  "callbackIdSnapshot" TEXT NOT NULL,
  "callbackInstanceIdSnapshot" TEXT NOT NULL,
  "receiverAuthorityVersionSnapshot" INTEGER NOT NULL,
  "authorityCommittedAt" TIMESTAMP(3) NOT NULL,
  "action" "CallbackSecurityAuditAction" NOT NULL,
  "actorId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "requestIp" TEXT,
  "requestUserAgent" TEXT,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallbackSecurityAuditRecord_pkey" PRIMARY KEY ("oid"),
  CONSTRAINT "sub_callback_security_audit_tenant_fk" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "sub_callback_security_audit_callback_fk" FOREIGN KEY ("callbackOid") REFERENCES "Callback"("oid") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "sub_callback_security_audit_instance_fk" FOREIGN KEY ("callbackInstanceOid") REFERENCES "CallbackInstance"("oid") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sub_callback_security_audit_id_key" ON "CallbackSecurityAuditRecord"("id");
CREATE UNIQUE INDEX "sub_callback_security_audit_correlation_key" ON "CallbackSecurityAuditRecord"("hubAuditCorrelationId");
CREATE INDEX "sub_callback_security_audit_owner_idx" ON "CallbackSecurityAuditRecord"("tenantOid", "callbackInstanceOid", "createdAt");

CREATE TABLE "CallbackSecurityAuditOutbox" (
  "oid" BIGINT NOT NULL,
  "id" TEXT NOT NULL,
  "auditRecordOid" BIGINT NOT NULL,
  "hubAuditCorrelationId" TEXT NOT NULL,
  "action" "CallbackSecurityAuditAction" NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "CallbackSecurityAuditOutbox_pkey" PRIMARY KEY ("oid"),
  CONSTRAINT "sub_callback_security_outbox_audit_fk" FOREIGN KEY ("auditRecordOid") REFERENCES "CallbackSecurityAuditRecord"("oid") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sub_callback_security_outbox_id_key" ON "CallbackSecurityAuditOutbox"("id");
CREATE UNIQUE INDEX "sub_callback_security_outbox_audit_key" ON "CallbackSecurityAuditOutbox"("auditRecordOid");
CREATE UNIQUE INDEX "sub_callback_security_outbox_correlation_key" ON "CallbackSecurityAuditOutbox"("hubAuditCorrelationId");
CREATE INDEX "sub_callback_security_outbox_pending_idx" ON "CallbackSecurityAuditOutbox"("publishedAt", "createdAt");
