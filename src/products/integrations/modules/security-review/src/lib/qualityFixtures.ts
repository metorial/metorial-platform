import type { SecurityReportBehavior, SecurityReviewAction } from '@metorial-subspace/db';

let action = (
  operation: SecurityReviewAction['operation'],
  scope: SecurityReviewAction['scope'],
  target: string,
  extra: Partial<SecurityReviewAction> = {}
): SecurityReviewAction => ({
  operation,
  scope,
  target,
  data: 'user_provided',
  destination: 'none',
  evidence: [{ type: 'file', path: '/evidence/skill/SKILL.md' }],
  ...extra
});

export let qualityFixtures: {
  name: string;
  path?: string;
  source: string;
  behaviors: { tag: SecurityReportBehavior['tag']; actions: SecurityReviewAction[] }[];
  exposure: string;
}[] = [
  {
    name: 'Release notes returned in chat',
    source:
      'Write release notes using only the changes supplied by the user. Return the draft in chat.',
    behaviors: [],
    exposure: 'low'
  },
  {
    name: 'Release notes saved to the requested file',
    source: 'Save the draft to the file selected by the user, only when requested.',
    behaviors: [
      {
        tag: 'filesystem_outside_skill',
        actions: [action('write', 'selected_resource', 'User-selected release notes file')]
      }
    ],
    exposure: 'low'
  },
  {
    name: 'Small local formatting script',
    path: 'scripts/format.py',
    source: 'print("Release notes")',
    behaviors: [
      {
        tag: 'code_execution',
        actions: [action('execute', 'provided_data', 'Bundled formatter')]
      }
    ],
    exposure: 'low'
  },
  {
    name: 'Warning against credential access',
    source: 'Never read ~/.ssh/id_rsa or send credentials anywhere.',
    behaviors: [],
    exposure: 'low'
  },
  {
    name: 'Ordinary code review role',
    source: 'You are an AI reviewer. Review the supplied code and explain bugs to the user.',
    behaviors: [],
    exposure: 'low'
  },
  {
    name: 'Requested project changelog',
    source:
      'Resolve ../../CHANGELOG.md against the selected project. Save the requested notes only if the resolved path stays inside that project; otherwise ask the user to choose a project-local output file.',
    behaviors: [
      {
        tag: 'filesystem_outside_skill',
        actions: [action('write', 'workspace', 'Selected project CHANGELOG.md')]
      }
    ],
    exposure: 'low'
  },
  {
    name: 'Expected Slack notification',
    source:
      'Send the user supplied release notes to the configured Slack webhook at https://hooks.slack.com/services/TEAM/CHANNEL/PLACEHOLDER.',
    behaviors: [
      {
        tag: 'network_egress',
        actions: [
          action('send', 'selected_resource', 'Configured release-notes channel', {
            destination: 'expected_service'
          })
        ]
      }
    ],
    exposure: 'moderate'
  },
  {
    name: 'Legitimate arbitrary shell remains powerful',
    path: 'scripts/run.sh',
    source: 'eval "$1"',
    behaviors: [
      {
        tag: 'code_execution',
        actions: [
          action('execute', 'unrestricted', 'Caller-provided shell command', {
            data: 'private'
          })
        ]
      }
    ],
    exposure: 'high'
  }
];
