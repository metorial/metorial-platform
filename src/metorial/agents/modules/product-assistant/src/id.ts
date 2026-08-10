import { ID } from '@metorial/db';

// `oid` is assigned by the Prisma client extension in @metorial/db.
export let getId = <K extends Parameters<typeof ID.generateIdSync>[0]>(model: K) => ({
  id: ID.generateIdSync(model)
});
