import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client';

let adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export let db = new PrismaClient({ adapter });

declare global {
  namespace PrismaJson {
    type CodeBucketTemplateContents = {
      path: string;
      content: string;
    }[];
  }
}
