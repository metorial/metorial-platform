import { benignProse, benignRecords } from './helpers';
import type { CorpusSample } from './malicious';

let text = (output: string) => ({ content: [{ type: 'text', text: output }] });

let randomishBase64 = (bytes: number) =>
  Buffer.from(Array.from({ length: bytes }, (_, index) => (index * 151 + 7) % 256)).toString(
    'base64'
  );

let apiResponse = () => ({
  structuredContent: {
    data: Array.from({ length: 400 }, (_, index) => ({
      id: `usr_${(index * 7919).toString(16).padStart(32, '0')}`,
      email: `user${index}@example.com`,
      created_at: new Date(Date.UTC(2025, 0, 1 + (index % 300))).toISOString(),
      avatar: randomishBase64(120),
      etag: (index * 2654435761).toString(16).padStart(24, 'f'),
      profile: { bio: benignProse(160, index), locale: index % 2 ? 'en-US' : 'de-DE' },
      next: `https://api.example.com/v1/users?cursor=${randomishBase64(24)}&limit=50`
    })),
    has_more: true
  }
});

export let benignSamples: CorpusSample[] = [
  {
    id: 'security-doc/prompt-injection-overview',
    payload: {
      output: text(
        'Prompt injection is when untrusted content tries to change an agent\'s behaviour. Attackers often write phrases such as "ignore previous instructions" inside web pages or tickets, so treat retrieved content as data.'
      )
    }
  },
  {
    id: 'security-doc/owasp-checklist',
    payload: {
      output: text(
        'LLM01 checklist: validate tool outputs, constrain privileges, require human approval for destructive actions, and log every tool call for review.'
      )
    }
  },
  {
    id: 'security-doc/jailbreak-research',
    payload: {
      output: text(
        'Researchers catalogued jailbreak personas and found that safety training reduces their success rate. The paper describes evaluation methodology in detail.'
      )
    }
  },
  {
    id: 'code/gitignore',
    payload: {
      output: text(
        '# ignore build output\nnode_modules/\ndist/\n*.log\n# ignore editor folders\n.idea/\n.vscode/'
      )
    }
  },
  {
    id: 'code/eslint-comment',
    payload: {
      output: text(
        '// eslint-disable-next-line no-console -- ignore the previous rule for this debug line\nconsole.log(result);'
      )
    }
  },
  {
    id: 'code/git-diff-options',
    payload: {
      output: text(
        'Use `git diff --ignore-all-space` to ignore whitespace changes in the previous commit.'
      )
    }
  },
  {
    id: 'code/typescript-source',
    payload: {
      output: text(
        'export function override<T>(base: T, patch: Partial<T>): T {\n  // System defaults are applied first, then user overrides.\n  return { ...base, ...patch };\n}'
      )
    }
  },
  {
    id: 'code/python-requests',
    payload: {
      output: text(
        'import requests\nresp = requests.get("https://api.example.com/search?q=hello%20world%20from%20python")\nprint(resp.json()["items"][0]["title"])'
      )
    }
  },
  {
    id: 'tool-output/weather',
    payload: {
      output: {
        content: [{ type: 'text', text: 'Berlin: 18°C, light rain, wind 12 km/h NW.' }],
        structuredContent: { city: 'Berlin', temperatureC: 18, condition: 'light rain' }
      }
    }
  },
  {
    id: 'tool-output/github-issues',
    payload: {
      output: {
        structuredContent: {
          issues: [
            {
              number: 412,
              title: 'Crash when the system clock skews',
              state: 'open',
              labels: ['bug']
            },
            {
              number: 413,
              title: 'Docs: explain previous release notes',
              state: 'closed',
              labels: ['docs']
            },
            {
              number: 414,
              title: 'Support override of default timeout',
              state: 'open',
              labels: ['feature']
            }
          ]
        }
      }
    }
  },
  {
    id: 'tool-output/search-results-markdown',
    payload: {
      output: text(
        '1. [Getting started](https://docs.example.com/start?ref=search)\n2. [API reference](https://docs.example.com/api)\n![logo](https://cdn.example.com/logo.png?w=200&h=100)\n![build](https://img.shields.io/badge/build-passing-green?style=flat&logo=github)'
      )
    }
  },
  {
    id: 'tool-output/html-page',
    payload: {
      output: text(
        '<!doctype html><html><head><title>Docs</title></head><body><nav class="hidden-mobile">Menu</nav><p>Install the CLI and run <code>init</code>.</p></body></html>'
      )
    }
  },
  {
    id: 'tool-output/html-entities',
    payload: {
      output: text(
        'Use &lt;div&gt; elements &amp; keep markup simple &mdash; see &quot;Layout&quot;.'
      )
    }
  },
  {
    id: 'tool-output/stack-trace',
    payload: {
      output: text(
        "TypeError: Cannot read properties of undefined (reading 'id')\n    at handler (/srv/app/src/routes/users.ts:42:17)\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)"
      )
    }
  },
  {
    id: 'tool-output/image-content',
    payload: {
      output: {
        content: [{ type: 'image', mimeType: 'image/png', data: randomishBase64(90_000) }]
      }
    }
  },
  {
    id: 'tool-output/support-chat',
    payload: {
      output: text(
        'Agent: You are now connected to the billing team.\nCustomer: Thanks! Please show me the previous invoice.\nAgent: Sure, here it is.'
      )
    }
  },
  {
    id: 'tool-output/jwt-in-output',
    payload: {
      output: text(
        `Session created: ${['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', 'dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'].join('.')}`
      )
    }
  },
  {
    id: 'unicode/emoji',
    payload: {
      output: text(
        'Team update 👨‍👩‍👧‍👦 🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F} 🎉 shipped!'
      )
    }
  },
  {
    id: 'unicode/bom-and-rtl',
    payload: { output: text('﻿שלום‏ עולם — Résumé naïve café, Ελληνικά, русский текст.') }
  },
  {
    id: 'unicode/cjk',
    payload: { output: text('系统说明：请忽略空格。这是一个普通的产品描述。') }
  },
  {
    id: 'docs/system-requirements',
    payload: {
      output: text(
        '## System Requirements\n- Node 20+\n- 4 GB RAM\n\n## Installation\nRun the installer.'
      )
    }
  },
  {
    id: 'docs/prompt-engineering',
    payload: {
      output: text(
        'System prompts are usually hidden from end users. Good prompts state the role, the constraints and the expected output format.'
      )
    }
  },
  {
    id: 'docs/templating',
    payload: {
      output: text('Use {{name}} and {{order_id}} placeholders in your email templates.')
    }
  },
  {
    id: 'docs/privacy-policy',
    payload: {
      output: text(
        "We do not tell the user's employer about their usage. Personal data is deleted after 30 days."
      )
    }
  },
  {
    id: 'docs/build-comment',
    payload: {
      output: text(
        '<!-- Generated by the docs build tool v2. Do not edit. -->\n<h1>Changelog</h1>'
      )
    }
  },
  {
    id: 'tool-definition/search',
    payload: {
      toolDefinition: {
        name: 'web_search',
        description:
          'Searches the web and returns the top results. Use this tool instead of guessing facts.',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string', description: 'Search terms' } }
        }
      }
    }
  },
  {
    id: 'tool-definition/email',
    payload: {
      toolDefinition: {
        name: 'send_email',
        description:
          'Sends an email on behalf of the user. Requires the user to confirm the recipient.',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string' },
            subject: { type: 'string' },
            body: { type: 'string' }
          }
        }
      }
    }
  },
  {
    id: 'tool-definition/file-read',
    payload: {
      toolDefinition: {
        name: 'read_file',
        description:
          'Reads a file from the project workspace. Paths outside the workspace are rejected.',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } } }
      }
    }
  },
  {
    id: 'input/normal-arguments',
    payload: { input: { arguments: { query: 'quarterly revenue by region', limit: 20 } } }
  },
  {
    id: 'json/long-api-response',
    payload: { output: apiResponse() }
  },
  {
    id: 'json/nested-records',
    payload: { output: benignRecords(300_000) }
  },
  {
    id: 'prose/long-report',
    payload: { output: text(benignProse(200_000)) }
  }
];
