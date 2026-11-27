import { SkillStartInput } from '@metorial/scene-assistant';
import {
  useMetorialAssistantEnabled,
  queueSkillAssistantPrompt,
  useCreateSkill
} from '@metorial/state';
import { useNavigate } from 'react-router-dom';

let skillStartSuggestions = [
  {
    id: 'review',
    label: 'Code review',
    prompt:
      'A skill that reviews pull requests against our conventions: check naming, error handling and test coverage, and summarize findings by severity.'
  },
  {
    id: 'support',
    label: 'Support replies',
    prompt:
      'A skill that drafts customer support replies in a friendly, concise tone, using our product docs to answer and escalating billing questions.'
  },
  {
    id: 'release',
    label: 'Release notes',
    prompt:
      'A skill that turns a list of merged changes into release notes grouped by feature, fix and breaking change.'
  }
];

let provisionalSkillName = (description: string) => {
  let firstLine = description.split('\n')[0]!.trim();
  return firstLine.length > 60 ? `${firstLine.slice(0, 57).trim()}...` : firstLine;
};

export let CreateSkillWithAgent = (p: {
  instanceId: string;
  getSkillPath: (skillId: string) => string;
  createSkill?: (input: { name: string }) => Promise<{ id: string }>;
}) => {
  let assistantEnabled = useMetorialAssistantEnabled();
  let createSkill = useCreateSkill();
  let navigate = useNavigate();

  let create = async (name: string) => {
    if (p.createSkill) return await p.createSkill({ name });

    let [skill, error] = await createSkill.mutate({ instanceId: p.instanceId, name });
    if (error || !skill) {
      throw new Error(error?.data.message ?? 'Unable to create the skill.');
    }

    return skill;
  };

  if (!assistantEnabled) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <SkillStartInput
        placeholder="Describe a new skill and the agent will draft it…"
        suggestions={skillStartSuggestions}
        onSubmit={async description => {
          let skill = await create(provisionalSkillName(description));

          queueSkillAssistantPrompt(
            skill.id,
            `${description}\n\nSet a fitting name and description for this skill, then write SKILL.md and any other files it needs.`
          );
          navigate(p.getSkillPath(skill.id));
        }}
      />
    </div>
  );
};
