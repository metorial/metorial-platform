-- CreateEnum
CREATE TYPE "ConsumerDeviceConnectionMode" AS ENUM ('local_proxy', 'direct');

-- AlterTable
ALTER TABLE "ConsumerDeviceSettings" ADD COLUMN     "connectionMode" "ConsumerDeviceConnectionMode" NOT NULL DEFAULT 'local_proxy';
