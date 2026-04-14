-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EventDestinationType" AS ENUM ('http_endpoint');

-- CreateEnum
CREATE TYPE "EventDestinationStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "EventRetryType" AS ENUM ('linear', 'exponential');

-- CreateEnum
CREATE TYPE "WebhookMethod" AS ENUM ('POST', 'PUT', 'PATCH');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('pending', 'delivered', 'failed');

-- CreateEnum
CREATE TYPE "EventDeliveryIntentStatus" AS ENUM ('pending', 'delivered', 'retrying', 'failed');

-- CreateEnum
CREATE TYPE "EventDeliveryAttemptStatus" AS ENUM ('succeeded', 'failed');

-- CreateTable
CREATE TABLE "Tenant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Sender" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sender_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EventDestination" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "EventDestinationStatus" NOT NULL,
    "type" "EventDestinationType" NOT NULL,
    "eventTypes" TEXT[],
    "hasEventTypesFilter" BOOLEAN NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "retryType" "EventRetryType" NOT NULL,
    "retryDelaySeconds" INTEGER NOT NULL,
    "retryMaxAttempts" INTEGER NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "senderOid" BIGINT NOT NULL,
    "currentInstanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "EventDestination_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EventDestinationInstance" (
    "oid" BIGINT NOT NULL,
    "type" "EventDestinationType" NOT NULL,
    "webhookOid" BIGINT,
    "destinationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventDestinationInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "WebhookDestinationWebhook" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "method" "WebhookMethod" NOT NULL,
    "signingSecret" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDestinationWebhook_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Event" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL,
    "topics" TEXT[],
    "deliveryDestinationCount" INTEGER NOT NULL,
    "deliverySuccessCount" INTEGER NOT NULL,
    "deliveryFailureCount" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" TEXT,
    "onlyForDestinations" TEXT[],
    "hasOnlyForDestinationsFilter" BOOLEAN NOT NULL DEFAULT false,
    "headers" JSONB NOT NULL DEFAULT '[]',
    "tenantOid" BIGINT NOT NULL,
    "senderOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EventDeliveryIntent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "EventDeliveryIntentStatus" NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "eventOid" BIGINT NOT NULL,
    "destinationOid" BIGINT NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventDeliveryIntent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EventDeliveryAttempt" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "EventDeliveryAttemptStatus" NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "responseStatusCode" INTEGER,
    "destinationInstanceOid" BIGINT NOT NULL,
    "intentOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventDeliveryAttempt_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_key" ON "Tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_identifier_key" ON "Tenant"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Sender_id_key" ON "Sender"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Sender_identifier_key" ON "Sender"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "EventDestination_id_key" ON "EventDestination"("id");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDestinationWebhook_id_key" ON "WebhookDestinationWebhook"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Event_id_key" ON "Event"("id");

-- CreateIndex
CREATE INDEX "Event_topics_idx" ON "Event"("topics");

-- CreateIndex
CREATE INDEX "Event_eventType_idx" ON "Event"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "EventDeliveryIntent_id_key" ON "EventDeliveryIntent"("id");

-- CreateIndex
CREATE INDEX "EventDeliveryIntent_status_idx" ON "EventDeliveryIntent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EventDeliveryAttempt_id_key" ON "EventDeliveryAttempt"("id");

-- CreateIndex
CREATE INDEX "EventDeliveryAttempt_status_idx" ON "EventDeliveryAttempt"("status");

-- AddForeignKey
ALTER TABLE "EventDestination" ADD CONSTRAINT "EventDestination_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDestination" ADD CONSTRAINT "EventDestination_senderOid_fkey" FOREIGN KEY ("senderOid") REFERENCES "Sender"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDestination" ADD CONSTRAINT "EventDestination_currentInstanceOid_fkey" FOREIGN KEY ("currentInstanceOid") REFERENCES "EventDestinationInstance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDestinationInstance" ADD CONSTRAINT "EventDestinationInstance_webhookOid_fkey" FOREIGN KEY ("webhookOid") REFERENCES "WebhookDestinationWebhook"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDestinationInstance" ADD CONSTRAINT "EventDestinationInstance_destinationOid_fkey" FOREIGN KEY ("destinationOid") REFERENCES "EventDestination"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDestinationWebhook" ADD CONSTRAINT "WebhookDestinationWebhook_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_senderOid_fkey" FOREIGN KEY ("senderOid") REFERENCES "Sender"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDeliveryIntent" ADD CONSTRAINT "EventDeliveryIntent_eventOid_fkey" FOREIGN KEY ("eventOid") REFERENCES "Event"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDeliveryIntent" ADD CONSTRAINT "EventDeliveryIntent_destinationOid_fkey" FOREIGN KEY ("destinationOid") REFERENCES "EventDestination"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDeliveryAttempt" ADD CONSTRAINT "EventDeliveryAttempt_destinationInstanceOid_fkey" FOREIGN KEY ("destinationInstanceOid") REFERENCES "EventDestinationInstance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDeliveryAttempt" ADD CONSTRAINT "EventDeliveryAttempt_intentOid_fkey" FOREIGN KEY ("intentOid") REFERENCES "EventDeliveryIntent"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

