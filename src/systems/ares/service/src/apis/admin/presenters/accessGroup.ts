import type {
  AccessGroup,
  AccessGroupAssignment,
  AccessGroupRule,
  App
} from '../../../../prisma/generated/client';

export let accessGroupPresenter = (
  accessGroup: AccessGroup & {
    rules: AccessGroupRule[];
    assignments: (AccessGroupAssignment & {
      app: Pick<App, 'id' | 'clientId'>;
    })[];
  }
) => ({
  object: 'ares#accessGroup' as const,

  id: accessGroup.id,
  name: accessGroup.name,

  rules: accessGroup.rules.map(rule => ({
    id: rule.id,
    type: rule.type,
    value: rule.value
  })),

  assignments: accessGroup.assignments?.map(a => ({
    id: a.id,
    target: { type: 'app' as const, id: a.app.id, clientId: a.app.clientId },
    createdAt: a.createdAt
  })),

  counts: {
    rules: accessGroup.rules.length,
    assignments: accessGroup.assignments.length
  },

  createdAt: accessGroup.createdAt,
  updatedAt: accessGroup.updatedAt
});
