-- AlterTable
ALTER TABLE "public"."ProviderOAuthConnection" ADD COLUMN     "description" TEXT,
ADD COLUMN     "metadata" JSONB,
ALTER COLUMN "name" DROP NOT NULL;
