import { createScoutClient } from '@metorial-services/scout-client';
import { tool, Tool } from 'ai';
import { z } from 'zod';
import { env } from '../../env';

export let webSearchTools: Record<string, Tool> = {};

if (env.scout.SCOUT_TOKEN && env.scout.SCOUT_URL) {
  let scout: ReturnType<typeof createScoutClient> = createScoutClient({
    endpoint: env.scout.SCOUT_URL,
    headers: { 'Scout-Auth': env.scout.SCOUT_TOKEN }
  });

  webSearchTools.webSearch = tool({
    title: 'Web Search',
    description: 'Search the web for recent information.',
    inputSchema: z.object({
      query: z.string().describe('The search query.'),
      country: z
        .string()
        .optional()
        .describe('The country to focus the search on, e.g. "us" or "uk".'),
      type: z
        .enum(['images', 'code', 'research', 'news', 'documents', 'web'])
        .optional()
        .describe('The type of search results to return.')
    }),
    execute: async input =>
      await scout.crawl.search({
        query: input.query,
        country: input.country,
        type: input.type
      })
  });

  webSearchTools.getWebContent = tool({
    title: 'Get Web Content',
    description: 'Fetch the content of a web page.',
    inputSchema: z.object({
      url: z.string().describe('The URL of the web page to fetch.')
    }),
    execute: async input => await scout.crawl.extract({ url: input.url })
  });
}
