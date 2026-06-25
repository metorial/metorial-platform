-- CreateEnum
CREATE TYPE "EmailIdentityType" AS ENUM ('email');

-- CreateEnum
CREATE TYPE "OutgoingEmailDestinationStatus" AS ENUM ('pending', 'sent', 'retry', 'failed');

-- CreateEnum
CREATE TYPE "OutgoingEmailSendStatus" AS ENUM ('success', 'failed');

-- CreateTable
CREATE TABLE "Sender" (
    "oid" INTEGER NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sender_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EmailIdentity" (
    "oid" INTEGER NOT NULL,
    "id" TEXT NOT NULL,
    "type" "EmailIdentityType" NOT NULL,
    "slug" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "subjectMarker" TEXT,
    "senderOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailIdentity_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OutgoingEmail" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "numberOfDestinations" INTEGER NOT NULL,
    "numberOfDestinationsCompleted" INTEGER NOT NULL,
    "identityId" INTEGER NOT NULL,
    "values" JSONB NOT NULL,
    "subject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutgoingEmail_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OutgoingEmailDestination" (
    "id" BIGINT NOT NULL,
    "status" "OutgoingEmailDestinationStatus" NOT NULL,
    "emailId" BIGINT NOT NULL,
    "destination" TEXT NOT NULL,

    CONSTRAINT "OutgoingEmailDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutgoingEmailContent" (
    "emailId" BIGINT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "subject" TEXT NOT NULL,

    CONSTRAINT "OutgoingEmailContent_pkey" PRIMARY KEY ("emailId")
);

-- CreateTable
CREATE TABLE "OutgoingEmailSend" (
    "id" BIGINT NOT NULL,
    "status" "OutgoingEmailSendStatus" NOT NULL,
    "destinationId" BIGINT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutgoingEmailSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sender_id_key" ON "Sender"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Sender_identifier_key" ON "Sender"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "EmailIdentity_id_key" ON "EmailIdentity"("id");

-- CreateIndex
CREATE UNIQUE INDEX "EmailIdentity_senderOid_slug_key" ON "EmailIdentity"("senderOid", "slug");

-- AddForeignKey
ALTER TABLE "EmailIdentity" ADD CONSTRAINT "EmailIdentity_senderOid_fkey" FOREIGN KEY ("senderOid") REFERENCES "Sender"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingEmail" ADD CONSTRAINT "OutgoingEmail_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "EmailIdentity"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingEmailDestination" ADD CONSTRAINT "OutgoingEmailDestination_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OutgoingEmail"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingEmailContent" ADD CONSTRAINT "OutgoingEmailContent_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OutgoingEmail"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingEmailSend" ADD CONSTRAINT "OutgoingEmailSend_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "OutgoingEmailDestination"("id") ON DELETE CASCADE ON UPDATE CASCADE;
