import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

type OrganizationFlagOverrideAuditPayload = {
  flagOverride: {
    flag: string;
    value: unknown;
  };
};

type OrganizationBetaAuditPayload = {
  beta: {
    slug: string;
    assignedBy: string;
  };
};

type OrganizationFlagCohortAuditPayload = {
  flagCohort: {
    slug: string;
  };
};

export let organizationFlagOverrideResource = resource({
  name: 'organization_flag_override',
  payload: v.typedAny<OrganizationFlagOverrideAuditPayload>('organization_flag_override'),
  presenter: undefined,
  actions: {
    set: true,
    remove: true
  }
});

export let organizationBetaResource = resource({
  name: 'organization_beta',
  payload: v.typedAny<OrganizationBetaAuditPayload>('organization_beta'),
  presenter: undefined,
  actions: {
    assign: true,
    unassign: true
  }
});

export let organizationFlagCohortResource = resource({
  name: 'organization_flag_cohort',
  payload: v.typedAny<OrganizationFlagCohortAuditPayload>('organization_flag_cohort'),
  presenter: undefined,
  actions: {
    assign: true,
    unassign: true
  }
});
