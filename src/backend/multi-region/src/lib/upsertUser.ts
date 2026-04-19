import { User } from '@metorial/db';
import { cell } from '../cell';
import { globalDB, Prisma } from '../db';

export let upsertUser = async (
  user: User,
  db: Pick<Prisma.TransactionClient, 'user'> = globalDB
) => {
  let inner = {
    status: user.status,
    type: user.type,
    email: user.email,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    image: user.image,
    createdAt: user.createdAt,
    deletedAt: user.deletedAt,

    lastEditByOid: (await cell).oid
  };

  return await db.user.upsert({
    where: { id: user.id },
    update: inner,
    create: { id: user.id, ...inner }
  });
};
