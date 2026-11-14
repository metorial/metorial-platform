import type { Function, FunctionVersion } from '../../prisma/generated/client';

export let functionPresenter = (
  func: Function & { currentVersion: FunctionVersion | null }
) => ({
  object: 'function_bay#function',

  currentVersionId: func.currentVersion?.id ?? null,

  id: func.id,
  status: func.status,

  identifier: func.identifier,
  name: func.name,

  createdAt: func.createdAt,
  updatedAt: func.updatedAt
});
