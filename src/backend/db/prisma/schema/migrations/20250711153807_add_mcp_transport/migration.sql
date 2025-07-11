-- CreateEnum
CREATE TYPE "McpTransport" AS ENUM ('sse', 'streamable_http');

-- AlterTable
ALTER TABLE "ServerVariant" ADD COLUMN     "mcpTransport" "McpTransport" NOT NULL DEFAULT 'sse';

-- AlterTable
ALTER TABLE "ServerVersion" ADD COLUMN     "mcpTransport" "McpTransport" NOT NULL DEFAULT 'sse';
