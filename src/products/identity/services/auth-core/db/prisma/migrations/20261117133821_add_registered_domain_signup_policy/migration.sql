-- AlterTable
ALTER TABLE "App" ADD COLUMN     "registeredDomainOwner" TEXT,
ADD COLUMN     "registeredDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "restrictSignupToRegisteredDomains" BOOLEAN NOT NULL DEFAULT false;
