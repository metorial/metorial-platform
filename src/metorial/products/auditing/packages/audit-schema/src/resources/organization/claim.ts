import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

type OrganizationClaimAuditPayload = {
  organizationClaim: {
    id: string;
    source: 'cli';
    status: 'unclaimed' | 'claimed';
    claimEmailSet: boolean;
    claimEmailChangeCount: number;
    claimedByUserId: string | null;
    claimedAt: Date | null;
    createdAt: Date;
  };
};

export let organizationClaimResource = resource({
  name: 'organization_claim',
  payload: v.typedAny<OrganizationClaimAuditPayload>('organization_claim'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    claim: true
  }
});
