import { providerListingCategoryService } from '../services';

await Promise.all(
  [
    {
      name: 'Web Search',
      identifier: 'web-search',
      description:
        'Tools that allow models to search and retrieve real-time information from the internet.'
    },
    {
      name: 'Code Execution',
      identifier: 'code-execution',
      description:
        'Run code snippets securely in isolated environments for testing or demonstration.'
    },
    {
      name: 'IoT and Device Control',
      identifier: 'iot-and-device-control',
      description: 'Interact with and control smart devices, sensors, and embedded systems.'
    },
    {
      name: 'Security',
      identifier: 'security',
      description:
        'Tools for monitoring, analyzing, and responding to security threats and incidents.'
    },
    {
      name: 'Speech Recognition and Synthesis',
      identifier: 'speech-recognition-and-synthesis',
      description: 'Convert speech to text or text to speech using voice processing services.'
    },
    {
      name: 'Legal and Compliance',
      identifier: 'legal-and-compliance',
      description:
        'Tools for understanding regulations, generating contracts, or performing legal research.'
    },
    {
      name: 'Healthcare and Medical',
      identifier: 'healthcare-and-medical',
      description: 'Access to clinical data, symptom checkers, or medical knowledge bases.'
    },
    {
      name: 'Education and Learning',
      identifier: 'education-and-learning',
      description: 'Resources for tutoring, course content delivery, and educational data.'
    },
    {
      name: 'News and Media',
      identifier: 'news-and-media',
      description:
        'Retrieve and analyze news articles, headlines, and media mentions in real time.'
    },
    {
      name: 'E-commerce and Retail',
      identifier: 'e-commerce-and-retail',
      description: 'Access product catalogs, inventory systems, and order management tools.'
    },
    {
      name: 'Language Translation',
      identifier: 'language-translation',
      description: 'Services for translating text or speech between different languages.'
    },
    {
      name: 'CRM and Sales Tools',
      identifier: 'crm-and-sales-tools',
      description: 'Manage customer relationships, leads, and sales pipelines.'
    },
    {
      name: 'HR and Recruiting',
      identifier: 'hr-and-recruiting',
      description:
        'Support for hiring workflows, resume analysis, and employee management systems.'
    },
    {
      name: 'Note-Taking and Knowledge Bases',
      identifier: 'note-taking-and-knowledge-bases',
      description: 'Capture and organize ideas, documents, and structured notes.'
    },
    {
      name: 'Task and Project Management',
      identifier: 'task-and-project-management',
      description: 'Support for managing to-do lists, tasks, and complex project workflows.'
    },
    {
      name: 'Financial Data and Stock Market',
      identifier: 'financial-data-and-stock-market',
      description:
        'Real-time and historical financial market data, analytics, and trading interfaces.'
    },
    {
      name: 'APIs and HTTP Requests',
      identifier: 'apis-and-http-requests',
      description:
        'General-purpose tools for calling external APIs and handling HTTP requests and responses.'
    },
    {
      name: 'Email and Messaging',
      identifier: 'email-and-messaging',
      description:
        'Send, receive, and analyze communications through email and chat platforms.'
    },
    {
      name: 'Scheduling and Calendars',
      identifier: 'scheduling-and-calendars',
      description: 'Access and manage events, calendars, and meeting scheduling systems.'
    },
    {
      name: 'Document Processing',
      identifier: 'document-processing',
      description:
        'Read, write, summarize, or edit documents in various formats like PDF, DOCX, and TXT.'
    }
  ].map(c =>
    providerListingCategoryService.upsertProviderListingCategory({
      input: {
        name: c.name,
        slug: c.identifier,
        description: c.description
      }
    })
  )
).catch(e => console.error('Error seeding categories', e));
