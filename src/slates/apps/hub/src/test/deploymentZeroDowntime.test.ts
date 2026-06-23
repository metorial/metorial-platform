import { describe, expect, it } from 'vitest';
import { hasServingSlateDeployment } from '../queues/deployment/deploy';
import {
  getSlateDiscoveryDeploymentTarget,
  shouldPreserveActiveVersionOnStagedDiscoveryFailure
} from '../queues/discovery/discover';

describe('zero-downtime slate deployment decisions', () => {
  it('treats active versions with provider info as currently serving', () => {
    let providerDeploymentInfo = {
      functionId: 'fn_old',
      functionDeploymentId: 'dep_old'
    };

    expect(
      hasServingSlateDeployment({
        status: 'active',
        providerDeploymentInfo,
        activeDeploymentOid: 1n
      })
    ).toBe(true);

    expect(
      hasServingSlateDeployment({
        status: 'deploying',
        providerDeploymentInfo,
        activeDeploymentOid: 1n
      })
    ).toBe(false);

    expect(
      hasServingSlateDeployment({
        status: 'active',
        providerDeploymentInfo: null,
        activeDeploymentOid: null
      })
    ).toBe(false);
  });

  it('uses staged deployment pointers for discovery without replacing the serving version', () => {
    let version = {
      providerDeploymentInfo: {
        functionId: 'fn_old',
        functionDeploymentId: 'dep_old'
      },
      activeDeploymentOid: 1n
    };
    let stagedDeployment = {
      oid: 2n,
      providerDeploymentInfo: {
        functionId: 'fn_new',
        functionDeploymentId: 'dep_new'
      }
    };

    expect(
      getSlateDiscoveryDeploymentTarget({ version, stagedDeployment })
    ).toEqual({
      providerDeploymentInfo: stagedDeployment.providerDeploymentInfo,
      activeDeploymentOid: stagedDeployment.oid
    });

    expect(getSlateDiscoveryDeploymentTarget({ version })).toEqual({
      providerDeploymentInfo: version.providerDeploymentInfo,
      activeDeploymentOid: version.activeDeploymentOid
    });
  });

  it('keeps the current deployment when staged discovery fails for an active redeploy', () => {
    expect(
      shouldPreserveActiveVersionOnStagedDiscoveryFailure({
        version: {
          status: 'active',
          activeDeploymentOid: 1n
        },
        stagedDeployment: { oid: 2n }
      })
    ).toBe(true);

    expect(
      shouldPreserveActiveVersionOnStagedDiscoveryFailure({
        version: {
          status: 'active',
          activeDeploymentOid: 2n
        },
        stagedDeployment: { oid: 2n }
      })
    ).toBe(false);

    expect(
      shouldPreserveActiveVersionOnStagedDiscoveryFailure({
        version: {
          status: 'discovering',
          activeDeploymentOid: null
        },
        stagedDeployment: { oid: 2n }
      })
    ).toBe(false);
  });
});
