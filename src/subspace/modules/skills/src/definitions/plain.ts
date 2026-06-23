import { cargo } from '../cargo';
import { detag } from '../lib/detag';
import { template } from '../lib/template';

export let plainSkillTemplateItems = [
  {
    path: '/SKILL.md',
    type: 'document' as const,
    content: detag`
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
    encoding: 'utf-8' as const
  },
  {
    path: '/references/',
    type: 'directory' as const
  },
  {
    path: '/assets/',
    type: 'directory' as const
  }
];

let getTitleFromMarkdownContent = (content: string) => {
  let match = content.match(/^#\s+(.*)$/m);
  return match ? match[1].trim() : 'Untitled Document';
};

export let createStoreForPlainTemplate = async (
  cargoScope: {
    tenantId: string;
    environmentId: string;
  },
  name: string
) => {
  let cargoStore = await cargo.store.create({
    ...cargoScope,
    name,
    access: 'public_read'
  });

  for (let item of plainSkillTemplateItems) {
    if (item.type === 'document') {
      await cargo.document.create({
        ...cargoScope,
        title: getTitleFromMarkdownContent(item.content),
        content: item.content,
        store: {
          id: cargoStore.id,
          path: item.path
        }
      });
    }
  }

  let directories = plainSkillTemplateItems.filter(item => item.type === 'directory');

  await cargo.store.modifyItems({
    ...cargoScope,
    storeId: cargoStore.id,
    operations: directories.map(dir => ({
      type: 'add' as const,
      path: dir.path
    }))
  });

  return cargoStore;
};

export let plainTemplate = template({
  identifier: 'plain',
  name: 'Plain',
  description: 'A plain skill template with no items.',
  items: plainSkillTemplateItems
});
