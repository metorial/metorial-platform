import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import {
  acceptedStatus,
  createInstance,
  createOrganization,
  createProject,
  createScope,
  createSource,
  createToken,
  errorCode,
  groundstation,
  ingest,
  instanceRecords,
  rpcErrorCode,
  storedRecords
} from './support';

let promptHook = JSON.stringify({
  session_id: 'session-1',
  hook_event_name: 'UserPromptSubmit',
  prompt: 'fix this'
});

let sendHook = (secret: string) =>
  ingest('/v1/ingest/hooks/claude-code', { credential: secret, body: promptHook });

describe('organizations', () => {
  it('creates an organization with defaults', async () => {
    let organization = await createOrganization();

    expect(organization.object).toBe('groundstation#organization');
    expect(organization.hashKeyVersion).toBe(1);
    expect(organization.contentKeyVersion).toBe(1);
    expect(organization.settings).toEqual({ allowedEmailDomains: [], sliceErasureMode: null });
    expect(organization.archivedAt).toBeNull();
  });

  it('upserts by ref idempotently without losing untouched settings', async () => {
    let created = await createOrganization({
      name: 'Acme',
      settings: { allowedEmailDomains: ['Acme.com'] }
    });

    let untouched = await groundstation().organization.upsert({ ref: created.ref });
    let changed = await groundstation().organization.upsert({
      ref: created.ref,
      settings: { sliceErasureMode: 'anonymize' }
    });

    expect(untouched.id).toBe(created.id);
    expect(untouched.settings.allowedEmailDomains).toEqual(['acme.com']);
    expect(changed.id).toBe(created.id);
    expect(changed.settings).toEqual({
      allowedEmailDomains: ['acme.com'],
      sliceErasureMode: 'anonymize'
    });
  });

  it('finds an organization by id or ref', async () => {
    let organization = await createOrganization();

    let byId = await groundstation().organization.get({ organizationId: organization.id });
    let byRef = await groundstation().organization.get({ organizationId: organization.ref });

    expect(byId.id).toBe(organization.id);
    expect(byRef.id).toBe(organization.id);
  });

  it('does not find unknown organizations', async () => {
    let code = await rpcErrorCode(
      groundstation().organization.get({ organizationId: uniqueId('missing') })
    );

    expect(code).toBe('not_found');
  });

  it('hides an archived organization until it is upserted again', async () => {
    let organization = await createOrganization();

    let archived = await groundstation().organization.archive({
      organizationId: organization.id
    });

    expect(archived.archivedAt).not.toBeNull();
    expect(
      await rpcErrorCode(groundstation().organization.get({ organizationId: organization.id }))
    ).toBe('not_found');

    let restored = await groundstation().organization.upsert({ ref: organization.ref });

    expect(restored.id).toBe(organization.id);
    expect(restored.archivedAt).toBeNull();
  });
});

describe('projects', () => {
  it('creates a project with default retention', async () => {
    let organization = await createOrganization();
    let project = await createProject(organization);

    expect(project.object).toBe('groundstation#project');
    expect(project.organizationId).toBe(organization.id);
    expect(project).toMatchObject({
      recordRetentionDays: 90,
      contentRetentionDays: 30,
      usageRetentionDays: 400
    });
  });

  it('upserts by ref idempotently', async () => {
    let organization = await createOrganization();
    let created = await createProject(organization, { name: 'Billing' });

    let again = await groundstation().project.upsert({
      organizationId: organization.id,
      ref: created.ref
    });

    expect(again.id).toBe(created.id);
    expect(again.name).toBe('Billing');
  });

  it('replicates retention to existing and new instances', async () => {
    let { organization, project, instance } = await createScope();

    await groundstation().project.upsert({
      organizationId: organization.id,
      ref: project.ref,
      recordRetentionDays: 7,
      contentRetentionDays: 3
    });

    let existing = await groundstation().instance.get({
      organizationId: organization.id,
      instanceId: instance.id
    });
    let added = await createInstance(organization, project);

    for (let target of [existing, added]) {
      expect(target).toMatchObject({
        recordRetentionDays: 7,
        contentRetentionDays: 3,
        usageRetentionDays: 400
      });
    }
  });

  it('refuses a project ref of another organization', async () => {
    let first = await createOrganization();
    let second = await createOrganization();
    let project = await createProject(first);

    let code = await rpcErrorCode(
      groundstation().project.upsert({ organizationId: second.id, ref: project.ref })
    );

    expect(code).toBe('conflict');
  });

  it('rejects invalid retention', async () => {
    let organization = await createOrganization();

    expect(await rpcErrorCode(createProject(organization, { recordRetentionDays: 0 }))).toBe(
      'invalid_data'
    );
    expect(
      await rpcErrorCode(createProject(organization, { contentRetentionDays: 1.5 }))
    ).toBe('invalid_data');
  });
});

describe('instances', () => {
  it('creates an instance with defaults', async () => {
    let { project, instance } = await createScope();

    expect(instance.object).toBe('groundstation#instance');
    expect(instance.project).toEqual({ id: project.id, ref: project.ref });
    expect(instance.skewBoundSeconds).toBe(86400);
    expect(instance.backfillMaxAgeDays).toBeNull();
    expect(instance.settings).toEqual({});
  });

  it('updates an instance by ref without losing untouched settings', async () => {
    let { organization, project, instance } = await createScope({
      instance: {
        skewBoundSeconds: 600,
        backfillMaxAgeDays: 30,
        settings: { inferredSessionGapMinutes: 20 }
      }
    });

    let target = { organizationId: organization.id, projectId: project.id, ref: instance.ref };

    let untouched = await groundstation().instance.upsert(target);
    let changed = await groundstation().instance.upsert({
      ...target,
      backfillMaxAgeDays: null,
      settings: { ephemeralDeviceIdleDays: 14 }
    });

    expect(untouched.id).toBe(instance.id);
    expect(untouched).toMatchObject({ skewBoundSeconds: 600, backfillMaxAgeDays: 30 });
    expect(changed).toMatchObject({ skewBoundSeconds: 600, backfillMaxAgeDays: null });
    expect(changed.settings).toEqual({
      inferredSessionGapMinutes: 20,
      ephemeralDeviceIdleDays: 14
    });
  });

  it('refuses to move an instance to another project', async () => {
    let { organization, instance } = await createScope();
    let other = await createProject(organization);

    let code = await rpcErrorCode(
      groundstation().instance.upsert({
        organizationId: organization.id,
        projectId: other.id,
        ref: instance.ref
      })
    );

    expect(code).toBe('conflict');
  });

  it('lists the live instances of a project', async () => {
    let { organization, project, instance } = await createScope();
    let second = await createInstance(organization, project);
    let archived = await createInstance(organization, project);

    await groundstation().instance.archive({
      organizationId: organization.id,
      instanceId: archived.id
    });

    let list = await groundstation().instance.list({
      organizationId: organization.id,
      projectId: project.id
    });

    expect(list.items.map(item => item.id).sort()).toEqual([instance.id, second.id].sort());
  });

  it('rejects invalid input', async () => {
    let organization = await createOrganization();
    let project = await createProject(organization);

    expect(
      await rpcErrorCode(createInstance(organization, project, { skewBoundSeconds: -1 }))
    ).toBe('invalid_data');
    expect(
      await rpcErrorCode(createInstance(organization, project, { backfillMaxAgeDays: 1.5 }))
    ).toBe('invalid_data');
  });
});

describe('archived scopes', () => {
  let archive = {
    organization: (scope: Awaited<ReturnType<typeof createScope>>) =>
      groundstation().organization.archive({ organizationId: scope.organization.id }),
    project: (scope: Awaited<ReturnType<typeof createScope>>) =>
      groundstation().project.archive({
        organizationId: scope.organization.id,
        projectId: scope.project.id
      }),
    instance: (scope: Awaited<ReturnType<typeof createScope>>) =>
      groundstation().instance.archive({
        organizationId: scope.organization.id,
        instanceId: scope.instance.id
      })
  };

  it.each(['organization', 'project', 'instance'] as const)(
    'stops accepting tokens and sources of an archived %s',
    async level => {
      let token = await createToken();
      let source = await createSource({}, token);

      expect((await sendHook(token.secret)).status).toBe(acceptedStatus);
      expect((await ingest('/v1/logs', { credential: source.secret })).status).toBe(
        acceptedStatus
      );

      await archive[level](token);

      let tokenResponse = await sendHook(token.secret);
      let sourceResponse = await ingest('/v1/logs', { credential: source.secret });

      expect(tokenResponse.status).toBe(401);
      expect(await errorCode(tokenResponse)).toBe('invalid_credential');
      expect(sourceResponse.status).toBe(401);
    }
  );

  it('keeps sibling instances working when one is archived', async () => {
    let first = await createToken();
    let sibling = await createToken(
      {},
      { ...first, instance: await createInstance(first.organization, first.project) }
    );

    await archive.instance(first);

    expect((await sendHook(first.secret)).status).toBe(401);
    expect((await sendHook(sibling.secret)).status).toBe(acceptedStatus);
  });
});

describe('erasure', () => {
  let seed = async () => {
    let first = await createToken();
    let sibling = await createToken(
      {},
      { ...first, instance: await createInstance(first.organization, first.project) }
    );
    let otherProject = await createProject(first.organization);
    let cousin = await createToken(
      {},
      {
        ...first,
        project: otherProject,
        instance: await createInstance(first.organization, otherProject)
      }
    );
    let stranger = await createToken();

    for (let target of [first, sibling, cousin, stranger]) {
      expect((await sendHook(target.secret)).status).toBe(acceptedStatus);
    }

    return { first, sibling, cousin, stranger };
  };

  let counts = async (...targets: { instance: { id: string } }[]) =>
    Promise.all(targets.map(async target => (await instanceRecords(target.instance)).length));

  it('erases one instance', async () => {
    let { first, sibling, cousin, stranger } = await seed();

    let result = await groundstation().instance.erase({
      organizationId: first.organization.id,
      instanceId: first.instance.id
    });

    expect(result).toEqual({ instanceId: first.instance.id, erasing: true });
    expect(await counts(first, sibling, cousin, stranger)).toEqual([0, 1, 1, 1]);
  });

  it('erases one project', async () => {
    let { first, sibling, cousin, stranger } = await seed();

    await groundstation().project.erase({
      organizationId: first.organization.id,
      projectId: first.project.id
    });

    expect(await counts(first, sibling, cousin, stranger)).toEqual([0, 0, 1, 1]);
  });

  it('erases a whole organization, even once archived', async () => {
    let { first, sibling, cousin, stranger } = await seed();

    await groundstation().organization.archive({ organizationId: first.organization.id });
    let result = await groundstation().organization.erase({
      organizationId: first.organization.id
    });

    expect(result).toEqual({ organizationId: first.organization.id, erasing: true });
    expect(await counts(first, sibling, cousin, stranger)).toEqual([0, 0, 0, 1]);
    expect(await storedRecords({ organizationId: first.organization.id })).toEqual([]);
  });

  it('does not erase unknown scopes', async () => {
    let { organization } = await createScope();

    expect(
      await rpcErrorCode(
        groundstation().instance.erase({
          organizationId: organization.id,
          instanceId: uniqueId('missing')
        })
      )
    ).toBe('not_found');
    expect(
      await rpcErrorCode(groundstation().organization.erase({ organizationId: uniqueId('x') }))
    ).toBe('not_found');
  });
});
