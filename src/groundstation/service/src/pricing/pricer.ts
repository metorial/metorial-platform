import type { BillingMode } from '@metorial/groundstation-spec';
import type { CatalogIndex, RequestTokens, ResolvedModel } from '../catalog';
import type { Amount } from '../sessions/decimal';
import { contractAmount } from './contract';
import { matchOverride, type MatchableOverride, type OverrideRequest } from './match';

export type ContractPrice = { override: MatchableOverride; amount: Amount };

export type OverridePricer = (d: {
  at: Date;
  resolution: ResolvedModel;
  billingMode: BillingMode;
  list: Amount | undefined;
  tokens: RequestTokens | undefined;
  contextTokens: number;
}) => ContractPrice | undefined;

export let overrideRequestOf = (d: {
  at: Date;
  organizationId: string;
  projectId: string;
  resolution: ResolvedModel;
  billingMode: BillingMode;
  catalog: Pick<CatalogIndex, 'modelInfo'> | null;
}): OverrideRequest => {
  let { resolution } = d;
  let info = resolution.modelId ? d.catalog?.modelInfo(resolution.modelId) : undefined;

  return {
    at: d.at,
    organizationId: d.organizationId,
    projectId: d.projectId,
    ...(resolution.offering ? { offeringId: resolution.offering.id } : {}),
    ...(resolution.modelId ? { modelId: resolution.modelId } : {}),
    ...(info?.familyId ? { familyId: info.familyId } : {}),
    ...(info ? { labId: info.labId } : {}),
    ...(resolution.agentId ? { agentId: resolution.agentId } : {}),
    ...(resolution.vendorId ? { vendorId: resolution.vendorId } : {}),
    billingMode: d.billingMode
  };
};

export let createOverridePricer = (d: {
  overrides: MatchableOverride[];
  organizationId: string;
  projectId: string;
  catalog: Pick<CatalogIndex, 'modelInfo'> | null;
}): OverridePricer | null => {
  if (!d.overrides.length) return null;

  return request => {
    let override = matchOverride(
      d.overrides,
      overrideRequestOf({
        at: request.at,
        organizationId: d.organizationId,
        projectId: d.projectId,
        resolution: request.resolution,
        billingMode: request.billingMode,
        catalog: d.catalog
      })
    );
    if (!override) return undefined;

    let amount = contractAmount({
      override,
      list: request.list,
      tokens: request.tokens,
      contextTokens: request.contextTokens
    });

    return amount === undefined ? undefined : { override, amount };
  };
};
