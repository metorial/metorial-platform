import { uniqueId } from '@metorial/e2e';
import type { OrganizationFixture } from '@metorial/e2e/db';
import { portalService } from '../src';

type PortalInput = Parameters<typeof portalService.createPortal>[0]['input'];

export let createPortal = async (
  fixture: OrganizationFixture,
  input: Partial<PortalInput> = {}
) =>
  await portalService.createPortal({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('Portal'), ...input }
  });

export let dnsLabel = /^[a-z0-9]+(-[a-z0-9]+)*$/;
