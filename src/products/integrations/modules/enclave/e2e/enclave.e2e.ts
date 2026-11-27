import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  integrationEnclaveService,
  integrationFirewallAssignmentService,
  integrationInternetGatewayService
} from '../src';

describe('module-enclave', () => {
  let org = useOrganization();

  it('provisions a single internet gateway per instance', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);

    let gateway = await integrationInternetGatewayService.get({ instance });
    expect(gateway.id).toBeTruthy();
    expect(gateway.enclaves).toEqual([]);

    let again = await integrationInternetGatewayService.get({ instance });
    expect(again.id).toBe(gateway.id);
  });

  it('lists no enclaves or firewall assignments for a fresh instance', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);

    expect(
      await firstPage(await integrationEnclaveService.listEnclaves({ instance }))
    ).toEqual([]);
    expect(
      await firstPage(
        await integrationFirewallAssignmentService.listFirewallAssignments({ instance })
      )
    ).toEqual([]);

    await expect(
      integrationEnclaveService.getEnclaveById({ instance, enclaveId: uniqueId('missing') })
    ).rejects.toThrow(/could not be found/);
  });
});
