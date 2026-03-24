import { randomBytes } from 'crypto';
import type { PrismaClient, Sender } from '../../../prisma/generated/client';
import { defineFactory } from '@lowerdeck/testing-tools';
import { getId } from '../../id';

export const SenderFixtures = (db: PrismaClient) => {
  const defaultSender = async (overrides: Partial<Sender> = {}): Promise<Sender> => {
    const { oid, id } = getId('sender');
    const identifier =
      overrides.identifier ?? `test-sender-${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<Sender>(
      {
        oid,
        id,
        identifier,
        name: overrides.name ?? `Test Sender ${identifier}`,
        createdAt: new Date()
      } as Sender,
      {
        persist: value => db.sender.create({ data: value })
      }
    );

    return factory.create(overrides);
  };

  const withIdentifier = async (
    identifier: string,
    overrides: Partial<Sender> = {}
  ): Promise<Sender> =>
    defaultSender({
      identifier,
      name: overrides.name ?? `Sender ${identifier}`,
      ...overrides
    });

  return {
    default: defaultSender,
    withIdentifier
  };
};
