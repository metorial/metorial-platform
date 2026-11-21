import { defaultDecisionModel } from '@mtsrc/ai-gateway-spec';
import { virtualModelTemplate } from '../lib/definitions/template';

export let virtualModelTemplates = {
  complexityTiers: virtualModelTemplate({
    slug: 'complexity-tiers',
    name: 'Complexity tiers',
    description:
      'A decision model rates how hard each request is. Easy requests go to a cheap model, hard ones to a premium model, everything else to a standard model.',
    usesDecisionModel: true,
    parameters: [
      {
        key: 'cheap',
        name: 'Cheap model',
        description: 'Handles trivial and simple requests.'
      },
      {
        key: 'standard',
        name: 'Standard model',
        description: 'Handles everything in between.'
      },
      {
        key: 'premium',
        name: 'Premium model',
        description: 'Handles hard and expert requests.'
      }
    ],
    build: models => ({
      decision: { model: defaultDecisionModel, onError: 'default' },
      signals: {
        complexity: {
          type: 'score',
          instructions:
            'Rate how much reasoning, expertise and care a strong assistant needs to answer the latest request well.',
          levels: [
            'Trivial: greetings, lookups, reformatting or a one-line answer',
            'Simple: a short, well-specified task with an obvious approach',
            'Moderate: several steps or some domain knowledge, but a familiar problem',
            'Hard: multi-step reasoning, non-trivial code, or careful analysis',
            'Expert: deep expertise, novel problem solving, or long rigorous work'
          ]
        }
      },
      rules: [
        {
          id: 'hard',
          description: 'Hard and expert requests',
          when: 'signals.complexity.level >= 3',
          models: [{ model: models.premium! }]
        },
        {
          id: 'easy',
          description: 'Trivial and simple requests the classifier is sure about',
          when: 'signals.complexity.level <= 1 && signals.complexity.probability >= 0.6',
          models: [{ model: models.cheap! }]
        }
      ],
      default: { models: [{ model: models.standard! }] }
    })
  }),

  taskSpecialists: virtualModelTemplate({
    slug: 'task-specialists',
    name: 'Task specialists',
    description:
      'A decision model recognizes the kind of task and sends coding and writing to models that are best at them.',
    usesDecisionModel: true,
    parameters: [
      { key: 'coding', name: 'Coding model', description: 'Writes, reviews and debugs code.' },
      { key: 'writing', name: 'Writing model', description: 'Drafts and edits prose.' },
      { key: 'general', name: 'General model', description: 'Handles everything else.' }
    ],
    build: models => ({
      decision: { model: defaultDecisionModel, onError: 'default' },
      signals: {
        task: {
          type: 'choice',
          instructions: 'What kind of work does the latest request ask for?',
          options: {
            coding: 'Writing, reviewing, explaining or debugging source code',
            writing: 'Drafting, editing or translating prose',
            other: 'Anything else: questions, analysis, planning or conversation'
          }
        }
      },
      rules: [
        {
          id: 'coding',
          when: 'signals.task.choice == "coding"',
          models: [{ model: models.coding! }]
        },
        {
          id: 'writing',
          when: 'signals.task.choice == "writing" && signals.task.probability >= 0.5',
          models: [{ model: models.writing! }]
        }
      ],
      default: { models: [{ model: models.general! }] }
    })
  }),

  longContext: virtualModelTemplate({
    slug: 'long-context',
    name: 'Long context',
    description:
      'Large prompts go to a model with a big context window; everything else stays on a faster, cheaper model. No decision model involved.',
    usesDecisionModel: false,
    parameters: [
      {
        key: 'standard',
        name: 'Standard model',
        description: 'Handles normal-sized requests.'
      },
      {
        key: 'long_context',
        name: 'Long-context model',
        description: 'Handles requests above roughly 64k input tokens.'
      }
    ],
    build: models => ({
      rules: [
        {
          id: 'long-prompt',
          when: 'request.input_tokens > 64000',
          models: [{ model: models.long_context! }]
        }
      ],
      default: { models: [{ model: models.standard! }, { model: models.long_context! }] }
    })
  }),

  agentLoop: virtualModelTemplate({
    slug: 'agent-loop',
    name: 'Agent loop',
    description:
      'The first turn of a task is planned by a strong model; follow-up steps that only feed tool results back run on a faster model. No decision model involved.',
    usesDecisionModel: false,
    parameters: [
      {
        key: 'planner',
        name: 'Planner model',
        description: 'Reads the task and makes the plan.'
      },
      { key: 'executor', name: 'Executor model', description: 'Runs the tool-calling steps.' }
    ],
    build: models => ({
      rules: [
        {
          id: 'tool-step',
          description: 'Steps that continue an agent loop with tool results',
          when: 'request.is_continuation && request.tool_count > 0',
          models: [{ model: models.executor! }, { model: models.planner! }]
        }
      ],
      default: { models: [{ model: models.planner! }] }
    })
  })
};

export let allVirtualModelTemplates = Object.values(virtualModelTemplates);
