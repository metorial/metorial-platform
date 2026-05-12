import { template } from '../lib/template';

export let plainTemplate = template({
  identifier: 'plain',
  name: 'Plain',
  description: 'A plain skill template with no items.',
  items: [
    {
      path: '/SKILL.md',
      type: 'file',
      content: `---
name: your-skill-name
description: Describe what the skill does, when to use it, and which tasks it helps with.
license: Proprietary. LICENSE.txt has complete terms
compatibility: Requires git, docker, jq, and access to the internet
---

# Skill Template

Set the scene, define the problem and task. Give the agent a personality, basic instructions, scope out the purpose of the skill.

## Prerequisites

List what the agent should prepare before using the skill. For example, a certain file structure, or certain requirements that must be met.

1. ...
2. ...

## Instructions

How should the agent use the skill? Are there specific steps to follow. Use sub headings to group different workloads and scenarios.

### Scenario 1

Describe the scenario and how to handle it. Reference integrations and tools that should be used.d

1. ...
2. ...

## References

Include any references to markdown files in the references directory, web links, or other assets in the assets directory.
      
`,
      encoding: 'utf-8'
    },
    {
      path: '/references/',
      type: 'directory'
    },
    {
      path: '/assets/',
      type: 'directory'
    }
  ]
});
