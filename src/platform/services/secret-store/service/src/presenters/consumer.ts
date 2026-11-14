import type { Consumer } from '../../prisma/generated/client';

export let consumerPresenter = (consumer: Consumer) => ({
  object: 'nebula#consumer',
  id: consumer.id,
  identifier: consumer.identifier,
  name: consumer.name,
  status: consumer.status,
  createdAt: consumer.createdAt,
  updatedAt: consumer.updatedAt
});
