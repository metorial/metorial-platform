import { createIntegration, createTool, z } from '../registry';
import { scout } from '../scout';

if (scout != null) {
  let scoutClient = scout;

  let searchResultSchema = z.union([
    z.object({
      title: z.any().describe('Result title as returned by Scout.'),
      url: z.any().describe('Canonical URL for the search result.'),
      imageUrl: z.any().describe('Image URL for image-style results.')
    }),
    z.object({
      title: z.any().describe('Result title as returned by Scout.'),
      url: z.any().describe('Canonical URL for the search result.'),
      description: z.any().describe('Short summary snippet for the result.'),
      category: z.any().describe('Scout category label for the result.')
    })
  ]);

  let extractResultSchema = z.object({
    markdown: z
      .string()
      .optional()
      .describe(
        'Main page content converted to Markdown. Read this first when you need the actual text of a page.'
      ),
    links: z
      .array(z.string().describe('Absolute URL discovered on the page.'))
      .optional()
      .describe(
        'Links extracted from the page. Use these for follow-up crawling or to navigate to source documents.'
      )
  });

  let webSearchTool = createTool(
    {
      key: 'webSearch',
      name: 'Web Search',
      description:
        'Search the web through Scout. Use this first when you need to discover relevant URLs, recent coverage, documents, images, code, or research before opening a page.',
      input: z.object({
        query: z
          .string()
          .describe(
            'Natural-language search query. Include specific entities, dates, constraints, site names, or intent so the returned URLs are useful for the next step.'
          ),
        country: z
          .string()
          .optional()
          .describe(
            'Optional country hint, an ISO 3166-1 alpha-2 code such as "US" or "DE". Set this only when geographic relevance matters.'
          ),
        type: z
          .enum(['images', 'code', 'research', 'news', 'documents', 'web'])
          .optional()
          .describe(
            'Optional result mode. Use "web" for general browsing, "news" for current coverage, "research" for academic material, "documents" for PDFs/docs, "code" for repositories/snippets, and "images" for image discovery.'
          )
      }),
      output: z
        .object({
          results: z
            .array(searchResultSchema)
            .describe(
              'Ordered search results from Scout. Inspect titles and URLs, then fetch the most relevant pages with getWebContent or extractWebContent.'
            )
        })
        .describe(
          'Search response from Scout. The results array contains the candidate pages or assets to inspect next.'
        ),
      tags: {
        readOnly: true
      }
    },
    async input => ({
      results: await scoutClient.crawl.search(input)
    })
  );

  let getWebContentTool = createTool(
    {
      key: 'getWebContent',
      name: 'Get Web Content',
      description:
        'Fetch the readable content of a single page. Use this after webSearch when you already know the target URL and want the page text plus discovered links.',
      input: z.object({
        url: z
          .url()
          .describe(
            'Absolute page URL to fetch and convert into Markdown. Pass the final page URL, not a search query.'
          )
      }),
      output: extractResultSchema.describe(
        'Readable page content and extracted links for the requested URL.'
      ),
      tags: {
        readOnly: true
      }
    },
    async input => await scoutClient.crawl.extract(input)
  );

  let extractWebContentTool = createTool(
    {
      key: 'extractWebContent',
      name: 'Extract Web Content',
      description:
        'Extract the main content and outgoing links from a page. Use this when you want focused crawling/extraction behavior rather than search-oriented browsing.',
      input: z.object({
        url: z
          .url()
          .describe(
            'Absolute URL of the page to extract. Best used for a specific page that you already identified elsewhere.'
          )
      }),
      output: extractResultSchema.describe(
        'Extracted Markdown content and page links for downstream summarization, citation, or follow-up crawling.'
      ),
      tags: {
        readOnly: true
      }
    },
    async input => await scoutClient.crawl.extract(input)
  );

  createIntegration({
    identifier: 'metorial-search',
    name: 'Metorial Search',
    description:
      'Search the web and fetch readable content from selected pages. Built for fast discovery and content extraction.',
    logoUrl: 'https://cdn.metorial.com/metorial-bw.svg',
    readme: `
# Metorial Search

Web search and retrieval provider.

Core functionality:
- Search across the web, news, research, documents, code, or images
- Return structured results with URLs and metadata
- Fetch a selected page as readable Markdown with extracted links

Use this provider when you want both discovery and page retrieval in one place.
`,
    tools: [webSearchTool, getWebContentTool]
  });

  createIntegration({
    identifier: 'metorial-crawl',
    name: 'Metorial Crawl',
    description:
      'Extract readable content and links from a known URL. Best for focused page retrieval after discovery is already done.',
    logoUrl: 'https://cdn.metorial.com/metorial-bw.svg',
    readme: `
# Metorial Crawl

Focused web extraction provider.

Core functionality:
- Fetch the main content of a page as Markdown
- Extract outgoing links for follow-up navigation
- Work from a specific known URL without doing search first

Use this provider when you already know the page you want to inspect.
`,
    tools: [extractWebContentTool]
  });
}
