import {
  skillStoreResourceAccess,
  standaloneStoreResourceAccess,
  storeResourceAccessLevels,
  type StoreResourceAccessDefinition
} from '@metorial/module-access/src/definitions/storeResourceAccess';

export type ParityFlag = 'store-participants-v2' | 'store-access-v2';

export type ParityCheck = {
  id: string;
  flag: ParityFlag;
  title: string;
  violations: string;
  population: string;
};

let quote = (value: string) => `'${value.replace(/'/g, "''")}'`;

let textArray = (values: readonly string[]) =>
  `ARRAY[${values.map(quote).join(', ')}]::text[]`;

let levelRoles = (access: StoreResourceAccessDefinition) =>
  storeResourceAccessLevels
    .map(level => `(${quote(level)}, ${textArray(access.policies[level].roles)})`)
    .join(', ');

let levelIdentifiers = (access: StoreResourceAccessDefinition) =>
  storeResourceAccessLevels
    .map(level => `(${quote(access.policies[level].systemIdentifier)}, ${quote(level)})`)
    .join(', ');

let identifierList = (access: StoreResourceAccessDefinition) =>
  storeResourceAccessLevels
    .map(level => quote(access.policies[level].systemIdentifier))
    .join(', ');

let row = (d: {
  project: string;
  organization?: string;
  ref: string;
  detail: string;
  createdAt?: string;
}) =>
  `${d.project} AS "projectOid", ${d.organization ?? 'NULL::bigint'} AS "organizationOid", ${d.ref} AS ref, ${d.detail} AS detail, ${d.createdAt ?? 'NULL::timestamp'} AS "createdAt"`;

let nonSystemActor = (actor: string, organizationActor: string) =>
  `${actor}.type::text <> 'system' AND COALESCE(${organizationActor}.type::text, '') <> 'system'`;

let actorRowIsLegacyVisible = (alias: string) =>
  `NOT (starts_with(${alias}.id, 'stpa_') AND cardinality(${alias}.permissions) = 0)`;

let skillGrantSets = () => `
  WITH wanted AS (
    SELECT DISTINCT s.id AS skill_id, s."storeOid", s."projectOid", e."accessTagOid", lvl.level
    FROM "AccessTagEntity" e
    JOIN "Skill" s ON s.oid = e."skillOid"
    JOIN "AccessTagPolicy" p ON p.oid = e."accessTagPolicyOid"
    JOIN (VALUES ${levelRoles(skillStoreResourceAccess)}) AS lvl(level, roles)
      ON p.roles && lvl.roles
    WHERE s."storeOid" IS NOT NULL
  ), present AS (
    SELECT DISTINCT s.id AS skill_id, s."storeOid", s."projectOid", e."accessTagOid", lvl.level
    FROM "AccessTagEntity" e
    JOIN "AccessTagPolicy" p ON p.oid = e."accessTagPolicyOid"
    JOIN (VALUES ${levelIdentifiers(skillStoreResourceAccess)}) AS lvl(identifier, level)
      ON lvl.identifier = p."systemIdentifier"
    JOIN "Skill" s ON s."storeOid" = e."storeOid"
  )`;

let standaloneGrantSets = () => `
  WITH actor_levels AS (
    SELECT spa."storeOid", st."projectOid", g."accessTagOid",
      bool_or(spa.permissions::text[] @> ARRAY['content_write']) AS can_write,
      bool_or(spa.permissions::text[] @> ARRAY['content_read']) AS can_read
    FROM "StoreParticipant" spa
    JOIN "Store" st ON st.oid = spa."storeOid"
    JOIN "ResourceActor" ra ON ra.oid = spa."resourceActorOid"
    JOIN "ConsumerProfile" cp ON cp.oid = ra."consumerProfileOid"
    JOIN "ConsumerGroup" g ON g.oid = cp."personalConsumerGroupOid"
    WHERE NOT EXISTS (SELECT 1 FROM "Skill" s WHERE s."storeOid" = spa."storeOid")
      AND ${actorRowIsLegacyVisible('spa')}
    GROUP BY spa."storeOid", st."projectOid", g."accessTagOid"
  ), wanted AS (
    SELECT "storeOid", "projectOid", "accessTagOid", 'read' AS level
    FROM actor_levels WHERE can_write OR can_read
    UNION
    SELECT "storeOid", "projectOid", "accessTagOid", 'write' AS level
    FROM actor_levels WHERE can_write
  ), present AS (
    SELECT DISTINCT e."storeOid", st."projectOid", e."accessTagOid", lvl.level
    FROM "AccessTagEntity" e
    JOIN "AccessTagPolicy" p ON p.oid = e."accessTagPolicyOid"
    JOIN (VALUES ${levelIdentifiers(standaloneStoreResourceAccess)}) AS lvl(identifier, level)
      ON lvl.identifier = p."systemIdentifier"
    JOIN "Store" st ON st.oid = e."storeOid"
    WHERE NOT EXISTS (SELECT 1 FROM "Skill" s WHERE s."storeOid" = e."storeOid")
  )`;

let policyDefinitions = () =>
  [skillStoreResourceAccess, standaloneStoreResourceAccess]
    .flatMap(access =>
      storeResourceAccessLevels.map(
        level =>
          `(${quote(access.policies[level].systemIdentifier)}, ${textArray(access.policies[level].roles)})`
      )
    )
    .join(', ');

let policyIdentifiers = () =>
  [skillStoreResourceAccess, standaloneStoreResourceAccess].map(identifierList).join(', ');

let resolvedConsumer = (actor: string) => `
  CROSS JOIN LATERAL (
    SELECT COALESCE(${actor}."consumerOid", (
      SELECT c.oid
      FROM "Consumer" c
      WHERE ${actor}."organizationActorOid" IS NOT NULL
        AND (
          c."organizationActorOid" = ${actor}."organizationActorOid"
          OR EXISTS (
            SELECT 1 FROM "ConsumerOrganizationActor" coa
            WHERE coa."consumerOid" = c.oid
              AND coa."organizationActorOid" = ${actor}."organizationActorOid"
          )
          OR EXISTS (
            SELECT 1 FROM "ConsumerProfile" cp
            WHERE cp."consumerOid" = c.oid
              AND cp."organizationActorOid" = ${actor}."organizationActorOid"
          )
        )
      ORDER BY c.oid
      LIMIT 1
    )) AS oid
  ) resolved`;

let documentInStore = (store: string) => `
  EXISTS (
    SELECT 1 FROM "StoreItem" si
    WHERE si."storeOid" = ${store}
      AND (si."documentOid" = d.oid OR si."fileOid" = d."fileOid")
  )`;

export let parityChecks = (): ParityCheck[] => [
  {
    id: 'policy-roles',
    flag: 'store-access-v2',
    title: 'Access policies carry the roles of their definition',
    violations: `
      SELECT ${row({
        project: 'NULL::bigint',
        organization: 'p."organizationOid"',
        ref: 'p.id',
        detail: `p."systemIdentifier" || ' has roles {' || array_to_string(p.roles, ',') || '}, expected {' || array_to_string(d.roles, ',') || '}'`,
        createdAt: 'p."createdAt"'
      })}
      FROM "AccessTagPolicy" p
      JOIN (VALUES ${policyDefinitions()}) AS d(identifier, roles)
        ON d.identifier = p."systemIdentifier"
      WHERE NOT (p.roles @> d.roles AND p.roles <@ d.roles)`,
    population: `
      SELECT NULL::bigint AS "projectOid", p."organizationOid" AS "organizationOid"
      FROM "AccessTagPolicy" p
      WHERE p."systemIdentifier" IN (${policyIdentifiers()})`
  },
  {
    id: 'skill-grants-missing',
    flag: 'store-access-v2',
    title: 'Skill grants exist as store grants',
    violations: `${skillGrantSets()}
      SELECT ${row({
        project: 'w."projectOid"',
        ref: 'w.skill_id',
        detail: `'access tag ' || w."accessTagOid" || ' has skill ' || w.level || ' access but no store grant'`
      })}
      FROM wanted w
      WHERE NOT EXISTS (
        SELECT 1 FROM present x
        WHERE x."storeOid" = w."storeOid"
          AND x."accessTagOid" = w."accessTagOid"
          AND x.level = w.level
      )`,
    population: `${skillGrantSets()} SELECT "projectOid", NULL::bigint AS "organizationOid" FROM wanted`
  },
  {
    id: 'skill-grants-stale',
    flag: 'store-access-v2',
    title: 'Store grants of skills are backed by a skill grant',
    violations: `${skillGrantSets()}
      SELECT ${row({
        project: 'x."projectOid"',
        ref: 'x.skill_id',
        detail: `'access tag ' || x."accessTagOid" || ' has store ' || x.level || ' access without a skill grant'`
      })}
      FROM present x
      WHERE NOT EXISTS (
        SELECT 1 FROM wanted w
        WHERE w."storeOid" = x."storeOid"
          AND w."accessTagOid" = x."accessTagOid"
          AND w.level = x.level
      )`,
    population: `${skillGrantSets()} SELECT "projectOid", NULL::bigint AS "organizationOid" FROM present`
  },
  {
    id: 'standalone-grants-missing',
    flag: 'store-access-v2',
    title: 'Permissions of standalone stores are mirrored as grants',
    violations: `${standaloneGrantSets()}
      SELECT ${row({
        project: 'w."projectOid"',
        ref: 'st.id',
        detail: `'access tag ' || w."accessTagOid" || ' has store ' || w.level || ' permission but no grant'`
      })}
      FROM wanted w
      JOIN "Store" st ON st.oid = w."storeOid"
      WHERE NOT EXISTS (
        SELECT 1 FROM present x
        WHERE x."storeOid" = w."storeOid"
          AND x."accessTagOid" = w."accessTagOid"
          AND x.level = w.level
      )`,
    population: `${standaloneGrantSets()} SELECT "projectOid", NULL::bigint AS "organizationOid" FROM wanted`
  },
  {
    id: 'standalone-grants-stale',
    flag: 'store-access-v2',
    title: 'Grants of standalone stores are backed by a permission',
    violations: `${standaloneGrantSets()}
      SELECT ${row({
        project: 'x."projectOid"',
        ref: 'st.id',
        detail: `'access tag ' || x."accessTagOid" || ' has store ' || x.level || ' grant without a permission'`
      })}
      FROM present x
      JOIN "Store" st ON st.oid = x."storeOid"
      WHERE NOT EXISTS (
        SELECT 1 FROM wanted w
        WHERE w."storeOid" = x."storeOid"
          AND w."accessTagOid" = x."accessTagOid"
          AND w.level = x.level
      )`,
    population: `${standaloneGrantSets()} SELECT "projectOid", NULL::bigint AS "organizationOid" FROM present`
  },
  {
    id: 'actor-rows-unlinked',
    flag: 'store-participants-v2',
    title: 'Store participant rows are linked to a deduplicated participant',
    violations: `
      SELECT ${row({
        project: 'st."projectOid"',
        ref: 'spa.id',
        detail: `'participant row is not linked to a store participant'`,
        createdAt: 'spa."createdAt"'
      })}
      FROM "StoreParticipant" spa
      JOIN "Store" st ON st.oid = spa."storeOid"
      JOIN "ResourceActor" ra ON ra.oid = spa."resourceActorOid"
      LEFT JOIN "OrganizationActor" oa ON oa.oid = ra."organizationActorOid"
      WHERE spa."storeParticipantOid" IS NULL
        AND ${actorRowIsLegacyVisible('spa')}
        AND ${nonSystemActor('ra', 'oa')}`,
    population: `
      SELECT st."projectOid" AS "projectOid", NULL::bigint AS "organizationOid"
      FROM "StoreParticipant" spa
      JOIN "Store" st ON st.oid = spa."storeOid"
      JOIN "ResourceActor" ra ON ra.oid = spa."resourceActorOid"
      LEFT JOIN "OrganizationActor" oa ON oa.oid = ra."organizationActorOid"
      WHERE ${actorRowIsLegacyVisible('spa')}
        AND ${nonSystemActor('ra', 'oa')}`
  },
  {
    id: 'actor-rows-wrong-store',
    flag: 'store-participants-v2',
    title: 'Participant rows link to a participant of the same store',
    violations: `
      SELECT ${row({
        project: 'st."projectOid"',
        ref: 'spa.id',
        detail: `'participant row of one store is linked to a participant of another store'`,
        createdAt: 'spa."createdAt"'
      })}
      FROM "StoreParticipant" spa
      JOIN "StoreParticipantPrincipal" pp ON pp.oid = spa."storeParticipantOid"
      JOIN "Store" st ON st.oid = spa."storeOid"
      WHERE pp."storeOid" <> spa."storeOid"`,
    population: `
      SELECT st."projectOid" AS "projectOid", NULL::bigint AS "organizationOid"
      FROM "StoreParticipant" spa
      JOIN "Store" st ON st.oid = spa."storeOid"
      WHERE spa."storeParticipantOid" IS NOT NULL`
  },
  {
    id: 'participants-consumer-conflict',
    flag: 'store-participants-v2',
    title: 'Participants are deduplicated per consumer',
    violations: `
      SELECT ${row({
        project: 'st."projectOid"',
        ref: 'spa.id',
        detail: `'actor resolves to consumer ' || resolved.oid || ' but its participant is ' || COALESCE('consumer ' || pp."consumerOid", 'not tied to a consumer')`,
        createdAt: 'spa."createdAt"'
      })}
      FROM "StoreParticipant" spa
      JOIN "StoreParticipantPrincipal" pp ON pp.oid = spa."storeParticipantOid"
      JOIN "Store" st ON st.oid = spa."storeOid"
      JOIN "ResourceActor" ra ON ra.oid = spa."resourceActorOid"
      ${resolvedConsumer('ra')}
      WHERE resolved.oid IS NOT NULL
        AND pp."consumerOid" IS DISTINCT FROM resolved.oid`,
    population: `
      SELECT st."projectOid" AS "projectOid", NULL::bigint AS "organizationOid"
      FROM "StoreParticipant" spa
      JOIN "Store" st ON st.oid = spa."storeOid"
      WHERE spa."storeParticipantOid" IS NOT NULL`
  },
  {
    id: 'participants-roles',
    flag: 'store-participants-v2',
    title: 'Participants carry every role of their participant rows',
    violations: `
      SELECT ${row({
        project: 'st."projectOid"',
        ref: 'spa.id',
        detail: `'participant row has roles {' || array_to_string(spa.roles::text[], ',') || '} but its participant only has {' || array_to_string(pp.roles::text[], ',') || '}'`,
        createdAt: 'spa."createdAt"'
      })}
      FROM "StoreParticipant" spa
      JOIN "StoreParticipantPrincipal" pp ON pp.oid = spa."storeParticipantOid"
      JOIN "Store" st ON st.oid = spa."storeOid"
      WHERE NOT (spa.roles::text[] <@ pp.roles::text[])`,
    population: `
      SELECT st."projectOid" AS "projectOid", NULL::bigint AS "organizationOid"
      FROM "StoreParticipant" spa
      JOIN "Store" st ON st.oid = spa."storeOid"
      WHERE spa."storeParticipantOid" IS NOT NULL`
  },
  {
    id: 'participants-without-rows',
    flag: 'store-participants-v2',
    title: 'Participants have at least one participant row',
    violations: `
      SELECT ${row({
        project: 'st."projectOid"',
        ref: 'pp.id',
        detail: `'participant has no participant rows'`,
        createdAt: 'pp."createdAt"'
      })}
      FROM "StoreParticipantPrincipal" pp
      JOIN "Store" st ON st.oid = pp."storeOid"
      WHERE NOT EXISTS (
        SELECT 1 FROM "StoreParticipant" spa WHERE spa."storeParticipantOid" = pp.oid
      )`,
    population: `
      SELECT st."projectOid" AS "projectOid", NULL::bigint AS "organizationOid"
      FROM "StoreParticipantPrincipal" pp
      JOIN "Store" st ON st.oid = pp."storeOid"`
  },
  {
    id: 'skill-participants-missing',
    flag: 'store-participants-v2',
    title: 'Skill participants exist as store participants',
    violations: `
      SELECT ${row({
        project: 's."projectOid"',
        ref: 'sp.id',
        detail: `'skill participant has no linked participant in the skill store'`,
        createdAt: 'sp."createdAt"'
      })}
      FROM "SkillParticipant" sp
      JOIN "Skill" s ON s.oid = sp."skillOid" AND s."storeOid" IS NOT NULL
      JOIN "ResourceActor" ra ON ra.oid = sp."resourceActorOid"
      LEFT JOIN "OrganizationActor" oa ON oa.oid = ra."organizationActorOid"
      WHERE ${nonSystemActor('ra', 'oa')}
        AND NOT EXISTS (
          SELECT 1 FROM "StoreParticipant" spa
          WHERE spa."storeOid" = s."storeOid"
            AND spa."resourceActorOid" = sp."resourceActorOid"
            AND spa."storeParticipantOid" IS NOT NULL
        )`,
    population: `
      SELECT s."projectOid" AS "projectOid", NULL::bigint AS "organizationOid"
      FROM "SkillParticipant" sp
      JOIN "Skill" s ON s.oid = sp."skillOid" AND s."storeOid" IS NOT NULL
      JOIN "ResourceActor" ra ON ra.oid = sp."resourceActorOid"
      LEFT JOIN "OrganizationActor" oa ON oa.oid = ra."organizationActorOid"
      WHERE ${nonSystemActor('ra', 'oa')}`
  },
  {
    id: 'skill-participants-roles',
    flag: 'store-participants-v2',
    title: 'Store participants carry the roles of skill participants',
    violations: `
      SELECT ${row({
        project: 's."projectOid"',
        ref: 'sp.id',
        detail: `'skill participant has roles {' || array_to_string(sp.roles::text[], ',') || '} but the store participant only has {' || array_to_string(pp.roles::text[], ',') || '}'`,
        createdAt: 'sp."createdAt"'
      })}
      FROM "SkillParticipant" sp
      JOIN "Skill" s ON s.oid = sp."skillOid" AND s."storeOid" IS NOT NULL
      JOIN "StoreParticipant" spa
        ON spa."storeOid" = s."storeOid" AND spa."resourceActorOid" = sp."resourceActorOid"
      JOIN "StoreParticipantPrincipal" pp ON pp.oid = spa."storeParticipantOid"
      WHERE NOT (sp.roles::text[] <@ pp.roles::text[])`,
    population: `
      SELECT s."projectOid" AS "projectOid", NULL::bigint AS "organizationOid"
      FROM "SkillParticipant" sp
      JOIN "Skill" s ON s.oid = sp."skillOid" AND s."storeOid" IS NOT NULL
      JOIN "StoreParticipant" spa
        ON spa."storeOid" = s."storeOid" AND spa."resourceActorOid" = sp."resourceActorOid"
      WHERE spa."storeParticipantOid" IS NOT NULL`
  },
  {
    id: 'document-participants-unlinked',
    flag: 'store-participants-v2',
    title: 'Document participants are linked to a store participant',
    violations: `
      SELECT ${row({
        project: 'd."projectOid"',
        ref: 'dp.id',
        detail: `'document participant is not linked to a store participant'`,
        createdAt: 'dp."createdAt"'
      })}
      FROM "DocumentParticipant" dp
      JOIN "Document" d ON d.oid = dp."documentOid"
      JOIN "ResourceActor" ra ON ra.oid = dp."resourceActorOid"
      LEFT JOIN "OrganizationActor" oa ON oa.oid = ra."organizationActorOid"
      WHERE dp."storeParticipantOid" IS NULL
        AND ${nonSystemActor('ra', 'oa')}
        AND EXISTS (
          SELECT 1 FROM "StoreItem" si
          WHERE si."documentOid" = d.oid OR si."fileOid" = d."fileOid"
        )`,
    population: `
      SELECT d."projectOid" AS "projectOid", NULL::bigint AS "organizationOid"
      FROM "DocumentParticipant" dp
      JOIN "Document" d ON d.oid = dp."documentOid"
      JOIN "ResourceActor" ra ON ra.oid = dp."resourceActorOid"
      LEFT JOIN "OrganizationActor" oa ON oa.oid = ra."organizationActorOid"
      WHERE ${nonSystemActor('ra', 'oa')}
        AND EXISTS (
          SELECT 1 FROM "StoreItem" si
          WHERE si."documentOid" = d.oid OR si."fileOid" = d."fileOid"
        )`
  },
  {
    id: 'document-participants-link',
    flag: 'store-participants-v2',
    title: 'Document participants link to a participant of a store holding the document',
    violations: `
      SELECT ${row({
        project: 'd."projectOid"',
        ref: 'dp.id',
        detail: `CASE
          WHEN NOT ${documentInStore('pp."storeOid"')}
            THEN 'linked store participant belongs to a store that does not hold the document'
          ELSE 'linked store participant has no participant row for the document actor'
        END`,
        createdAt: 'dp."createdAt"'
      })}
      FROM "DocumentParticipant" dp
      JOIN "Document" d ON d.oid = dp."documentOid"
      JOIN "StoreParticipantPrincipal" pp ON pp.oid = dp."storeParticipantOid"
      WHERE NOT ${documentInStore('pp."storeOid"')}
        OR NOT EXISTS (
          SELECT 1 FROM "StoreParticipant" spa
          WHERE spa."storeParticipantOid" = pp.oid
            AND spa."resourceActorOid" = dp."resourceActorOid"
        )`,
    population: `
      SELECT d."projectOid" AS "projectOid", NULL::bigint AS "organizationOid"
      FROM "DocumentParticipant" dp
      JOIN "Document" d ON d.oid = dp."documentOid"
      WHERE dp."storeParticipantOid" IS NOT NULL`
  }
];
