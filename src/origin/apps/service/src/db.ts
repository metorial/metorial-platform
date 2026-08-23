import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client';

let adapter = new PrismaPg({
  connectionString: process.env.ORIGIN_DATABASE_URL ?? process.env.DATABASE_URL
});

export let db = new PrismaClient({ adapter });

declare global {
  namespace PrismaJson {
    type CodeBucketTemplateContents = {
      path: string;
      content: string;
    }[];
    type SyncLogEntry = [number, string];
    type RepositorySyncStatusSnapshot = {
      version: 1;
      provider: 'github' | 'gitlab' | 'bitbucket';
      pullRequest: {
        id: string;
        url: string;
        state: 'open' | 'merged' | 'closed';
      };
      checks: {
        state: 'pending' | 'success' | 'failed' | 'unknown';
        total: number;
        successful: number;
        pending: number;
        failed: number;
        items: {
          name: string;
          status: 'pending' | 'success' | 'failed' | 'unknown';
          url: string | null;
          summary: string | null;
        }[];
      };
      review: {
        state: 'pending' | 'approved' | 'changes_requested' | 'not_required' | 'unknown';
        approvals: number;
        changesRequested: number;
        requiredApprovals?: number;
      };
      mergeability: {
        state: 'mergeable' | 'blocked' | 'conflicting' | 'checking' | 'unknown';
        reason?: string;
      };
      observedAt: string;
    };
  }
}
