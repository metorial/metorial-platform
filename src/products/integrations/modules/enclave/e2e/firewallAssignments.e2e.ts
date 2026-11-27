import {
  expectServiceError,
  firstPage,
  uniqueId,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { firewallService } from '@metorial/module-networking';
import { describe, expect, it } from 'vitest';
import {
  integrationEnclaveService,
  integrationFirewallAssignmentService,
  integrationInternetGatewayService
} from '../src';
import type { FirewallAssignmentInput } from '../src/services/integrationFirewallAssignment';
import {
  assignFirewall,
  createDeployableProvider,
  createEnclave,
  createFirewallWithRules,
  facingFor,
  httpsEgress,
  unassignFirewall,
  waitForProviderUse,
  type Organization
} from './_fixtures';

let ids = (items: { id: string }[]) => items.map(item => item.id).sort();

let listAssignments = async (
  org: Organization,
  params: Omit<
    Parameters<typeof integrationFirewallAssignmentService.listFirewallAssignments>[0],
    'instance'
  > = {}
) => {
  let { instance } = await facingFor(org);

  return firstPage(
    await integrationFirewallAssignmentService.listFirewallAssignments({ instance, ...params })
  );
};

let countAssignments = (firewallId: string) =>
  subspaceDb.integrationFirewallAssignment.count({ where: { firewall: { id: firewallId } } });

describe('module-enclave firewall assignments', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let providerPromise: ReturnType<typeof createDeployableProvider> | undefined;
  let provider = () => (providerPromise ??= createDeployableProvider(org, server.url));

  it('places new firewalls on the instance internet gateway without assignments', async () => {
    let { instance } = await facingFor(org);
    let gateway = await integrationInternetGatewayService.get({ instance });

    let { firewall } = await createFirewallWithRules(org, [httpsEgress]);

    expect(firewall.internetGateway).toMatchObject({ id: gateway.id });
    expect(
      ids((await integrationInternetGatewayService.get({ instance })).firewalls)
    ).toContain(firewall.id);
    expect(await listAssignments(org, { firewallIds: [firewall.id] })).toEqual([]);
    expect(
      await firstPage(
        await integrationEnclaveService.listEnclaves({ instance, firewallIds: [firewall.id] })
      )
    ).toEqual([]);
  });

  it('assigns a firewall to the internet gateway idempotently and removes it', async () => {
    let { instance } = await facingFor(org);
    let gateway = await integrationInternetGatewayService.get({ instance });
    let { firewall } = await createFirewallWithRules(org, [httpsEgress]);

    let assignment = await assignFirewall(org, firewall.id, {
      targetType: 'internet_gateway'
    });

    expect(assignment).toMatchObject({
      targetType: 'internet_gateway',
      firewall: { id: firewall.id, slug: firewall.slug, name: firewall.name },
      internetGateway: { id: gateway.id, name: gateway.name },
      enclave: null,
      provider: null
    });

    let again = await assignFirewall(org, firewall.id, { targetType: 'internet_gateway' });
    expect(again.id).toBe(assignment.id);
    expect(await countAssignments(firewall.id)).toBe(1);

    expect(ids(await listAssignments(org, { firewallIds: [firewall.id] }))).toEqual([
      assignment.id
    ]);
    expect(ids(await listAssignments(org, { firewallIds: [firewall.slug] }))).toEqual([
      assignment.id
    ]);
    expect(
      ids(
        await listAssignments(org, {
          firewallIds: [firewall.id],
          targetTypes: ['internet_gateway']
        })
      )
    ).toEqual([assignment.id]);
    expect(
      await listAssignments(org, {
        firewallIds: [firewall.id],
        targetTypes: ['enclave', 'provider']
      })
    ).toEqual([]);
    expect(
      ids(
        await listAssignments(org, { internetGatewayIds: [gateway.id], ids: [assignment.id] })
      )
    ).toEqual([assignment.id]);

    let fetched = await integrationFirewallAssignmentService.getFirewallAssignmentById({
      instance,
      firewallAssignmentId: assignment.id
    });
    expect(fetched).toMatchObject({ id: assignment.id, targetType: 'internet_gateway' });
    expect(
      ids((await integrationInternetGatewayService.get({ instance })).firewallAssignments)
    ).toContain(assignment.id);

    let deleted = await unassignFirewall(org, assignment.id);
    expect(deleted.id).toBe(assignment.id);

    await expectServiceError(
      integrationFirewallAssignmentService.getFirewallAssignmentById({
        instance,
        firewallAssignmentId: assignment.id
      }),
      'not_found'
    );
    await expectServiceError(
      integrationFirewallAssignmentService.deleteFirewallAssignment({
        instance,
        firewallAssignment: fetched
      }),
      'not_found'
    );
    expect(await listAssignments(org, { firewallIds: [firewall.id] })).toEqual([]);
    expect(await countAssignments(firewall.id)).toBe(0);
  });

  it('assigns a firewall to an enclave and to a provider', async () => {
    let { instance } = await facingFor(org);
    let { providerId } = await provider();
    let { enclave } = await createEnclave(org, providerId);
    await waitForProviderUse(org, providerId);
    let { firewall } = await createFirewallWithRules(org, [httpsEgress]);

    let enclaveAssignment = await assignFirewall(org, firewall.id, {
      targetType: 'enclave',
      enclaveId: enclave.id
    });
    expect(enclaveAssignment).toMatchObject({
      targetType: 'enclave',
      enclave: { id: enclave.id, slug: enclave.slug },
      provider: null,
      internetGateway: null
    });

    let providerAssignment = await assignFirewall(org, firewall.id, {
      targetType: 'provider',
      providerId
    });
    expect(providerAssignment).toMatchObject({
      targetType: 'provider',
      provider: { id: providerId },
      enclave: null,
      internetGateway: null
    });

    expect(
      (
        await assignFirewall(org, firewall.id, {
          targetType: 'enclave',
          enclaveId: enclave.id
        })
      ).id
    ).toBe(enclaveAssignment.id);
    expect(
      (await assignFirewall(org, firewall.id, { targetType: 'provider', providerId })).id
    ).toBe(providerAssignment.id);
    expect(await countAssignments(firewall.id)).toBe(2);

    expect(ids(await listAssignments(org, { firewallIds: [firewall.id] }))).toEqual(
      [enclaveAssignment.id, providerAssignment.id].sort()
    );
    expect(ids(await listAssignments(org, { enclaveIds: [enclave.id] }))).toEqual([
      enclaveAssignment.id
    ]);
    expect(
      ids(
        await listAssignments(org, { providerIds: [providerId], firewallIds: [firewall.id] })
      )
    ).toEqual([providerAssignment.id]);

    let refreshed = await integrationEnclaveService.getEnclaveById({
      instance,
      enclaveId: enclave.id
    });
    expect(ids(refreshed.firewallAssignments)).toEqual([enclaveAssignment.id]);
    expect(
      ids(
        await firstPage(
          await integrationEnclaveService.listEnclaves({
            instance,
            firewallIds: [firewall.id]
          })
        )
      )
    ).toEqual([enclave.id]);
  });

  it('rejects malformed assignment targets without persisting anything', async () => {
    let { providerId } = await provider();
    let { enclave } = await createEnclave(org, providerId);
    let { firewall } = await createFirewallWithRules(org, [httpsEgress]);

    let invalidTargets: FirewallAssignmentInput[] = [
      { targetType: 'enclave' },
      { targetType: 'enclave', enclaveId: enclave.id, providerId },
      { targetType: 'provider' },
      { targetType: 'provider', providerId, enclaveId: enclave.id },
      { targetType: 'internet_gateway', enclaveId: enclave.id },
      { targetType: 'internet_gateway', providerId },
      { targetType: 'machine' as FirewallAssignmentInput['targetType'] }
    ];

    for (let input of invalidTargets) {
      await expectServiceError(
        assignFirewall(org, firewall.id, input),
        'invalid_firewall_assignments'
      );
    }

    expect(await countAssignments(firewall.id)).toBe(0);
  });

  it('rejects unknown firewalls and targets, and archived firewalls', async () => {
    let { fixture, facing } = await facingFor(org);
    let { firewall } = await createFirewallWithRules(org, [httpsEgress]);

    await expectServiceError(
      assignFirewall(org, uniqueId('missing'), { targetType: 'internet_gateway' }),
      'not_found'
    );
    await expectServiceError(
      assignFirewall(org, firewall.id, {
        targetType: 'enclave',
        enclaveId: uniqueId('missing')
      }),
      'not_found'
    );
    await expectServiceError(
      assignFirewall(org, firewall.id, {
        targetType: 'provider',
        providerId: uniqueId('missing')
      }),
      'not_found'
    );
    expect(await countAssignments(firewall.id)).toBe(0);

    let archived = await firewallService.archiveFirewall({ ...facing, firewall });
    expect(archived.status).toBe('archived');

    await expectServiceError(
      assignFirewall(org, firewall.id, { targetType: 'internet_gateway' }),
      'use_after_delete'
    );
    await expectServiceError(
      integrationFirewallAssignmentService.createFirewallAssignments({
        instance: fixture.instance,
        firewall: archived,
        assignments: [{ targetType: 'internet_gateway' }]
      }),
      'use_after_delete'
    );
    expect(await countAssignments(firewall.id)).toBe(0);
  });

  it('creates several assignments at once and rejects duplicate targets in a batch', async () => {
    let { instance } = await facingFor(org);
    let { providerId } = await provider();
    let { enclave } = await createEnclave(org, providerId);
    let { firewall } = await createFirewallWithRules(org, [httpsEgress]);

    for (let assignments of [
      [
        { targetType: 'enclave', enclaveId: enclave.id },
        { targetType: 'enclave', enclaveId: enclave.id }
      ],
      [{ targetType: 'internet_gateway' }, { targetType: 'internet_gateway' }],
      [
        { targetType: 'provider', providerId },
        { targetType: 'provider', providerId }
      ],
      [{ targetType: 'internet_gateway' }, { targetType: 'enclave' }]
    ] as FirewallAssignmentInput[][]) {
      await expectServiceError(
        integrationFirewallAssignmentService.createFirewallAssignments({
          instance,
          firewall,
          assignments
        }),
        'invalid_firewall_assignments'
      );
    }
    expect(await countAssignments(firewall.id)).toBe(0);

    await integrationFirewallAssignmentService.createFirewallAssignments({
      instance,
      firewall,
      assignments: [
        { targetType: 'internet_gateway' },
        { targetType: 'enclave', enclaveId: enclave.id }
      ]
    });

    let created = await listAssignments(org, { firewallIds: [firewall.id] });
    expect(created.map(assignment => assignment.targetType).sort()).toEqual([
      'enclave',
      'internet_gateway'
    ]);

    await integrationFirewallAssignmentService.createFirewallAssignments({
      instance,
      firewall,
      assignments: [{ targetType: 'enclave', enclaveId: enclave.id }]
    });
    expect(await countAssignments(firewall.id)).toBe(2);
  });

  it('hides assignments of archived firewalls unless archived ones are requested', async () => {
    let { instance, facing } = await facingFor(org);
    let { firewall } = await createFirewallWithRules(org, [httpsEgress]);
    let assignment = await assignFirewall(org, firewall.id, {
      targetType: 'internet_gateway'
    });

    await firewallService.archiveFirewall({ ...facing, firewall });

    expect(await listAssignments(org, { firewallIds: [firewall.id] })).toEqual([]);
    expect(
      ids(await listAssignments(org, { firewallIds: [firewall.id], status: ['archived'] }))
    ).toEqual([assignment.id]);
    expect(
      (
        await integrationFirewallAssignmentService.getFirewallAssignmentById({
          instance,
          firewallAssignmentId: assignment.id
        })
      ).id
    ).toBe(assignment.id);
  });

  it('keeps assignments and their targets inside the owning instance', async () => {
    let { instance: otherInstance } = await facingFor(otherOrg);
    let { providerId } = await provider();
    let { enclave } = await createEnclave(org, providerId);
    await waitForProviderUse(org, providerId);
    let { firewall } = await createFirewallWithRules(org, [httpsEgress]);
    let { firewall: otherFirewall } = await createFirewallWithRules(otherOrg, [httpsEgress]);
    let assignment = await assignFirewall(org, firewall.id, {
      targetType: 'enclave',
      enclaveId: enclave.id
    });

    await expectServiceError(
      integrationFirewallAssignmentService.getFirewallAssignmentById({
        instance: otherInstance,
        firewallAssignmentId: assignment.id
      }),
      'not_found'
    );
    expect(await listAssignments(otherOrg, { firewallIds: [firewall.id] })).toEqual([]);
    expect(await listAssignments(otherOrg, { ids: [assignment.id] })).toEqual([]);
    expect(await listAssignments(otherOrg, { enclaveIds: [enclave.id] })).toEqual([]);

    await expectServiceError(
      assignFirewall(otherOrg, firewall.id, { targetType: 'internet_gateway' }),
      'not_found'
    );
    await expectServiceError(
      assignFirewall(otherOrg, otherFirewall.id, {
        targetType: 'enclave',
        enclaveId: enclave.id
      }),
      'not_found'
    );
    await expectServiceError(
      assignFirewall(otherOrg, otherFirewall.id, { targetType: 'provider', providerId }),
      'not_found'
    );
    expect(await countAssignments(otherFirewall.id)).toBe(0);

    await expect(
      integrationFirewallAssignmentService.deleteFirewallAssignment({
        instance: otherInstance,
        firewallAssignment: assignment
      })
    ).rejects.toThrow('Tenant mismatch');
    expect(await countAssignments(firewall.id)).toBe(1);
  });
});
