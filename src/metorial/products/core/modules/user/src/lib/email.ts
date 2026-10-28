import { withTransaction } from '@metorial/db';

export let normalizeUserEmail = (email: string) => email.trim().toLowerCase();

// Prisma's case-insensitive `equals` compiles to ILIKE, where `_` and `%` in an address act as
// wildcards, so case-insensitive matching is done with lower() instead.
export let findUserOidsByEmail = (email: string) =>
  withTransaction(
    async db => {
      let rows = await db.$queryRaw<{ oid: bigint }[]>`
        SELECT "oid" FROM "User" WHERE lower("email") = lower(${normalizeUserEmail(email)})
      `;

      return rows.map(row => row.oid);
    },
    { ifExists: true }
  );
