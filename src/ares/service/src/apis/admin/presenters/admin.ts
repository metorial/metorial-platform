import type { Admin } from '../../../../prisma/generated/client';

export let adminPresenter = (admin: Admin) => ({
  object: 'ares#admin' as const,

  id: admin.id,
  email: admin.email,
  name: admin.name,

  createdAt: admin.createdAt,
  updatedAt: admin.updatedAt
});
