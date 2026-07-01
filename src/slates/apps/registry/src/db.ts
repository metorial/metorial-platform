import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client';

let adapter = new PrismaPg({
  connectionString: process.env.SLATES_REGISTRY_DATABASE_URL ?? process.env.DATABASE_URL
});

export let db = new PrismaClient({ adapter });

declare global {
  namespace PrismaJson {
    type EntityLinks = {
      url: string;
      label: string;
    }[];

    interface SlateJson {
      name: string;
      version: string;
      description?: string;
      categories?: string[];
      skills?: string[];
      logoUrl?: string;
      timeout?: number;
    }

    type FilterExpression = {
      type: 'prefix' | 'scope' | 'slate';
      value: string;
    }[];
  }
}
