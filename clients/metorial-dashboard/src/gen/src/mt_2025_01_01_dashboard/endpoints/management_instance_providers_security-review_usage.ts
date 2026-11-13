import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceProvidersSecurityReviewUsageReassessOutput,
  type DashboardInstanceProvidersSecurityReviewUsageReassessOutput
} from '../resources';

/**
 * @name Provider Security Reviews controller
 * @description An AI security review assesses how trustworthy a provider version is and what its tools can do. Reviews of Metorial integrations are shared across organizations; reviews of custom providers are private to the organization.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceProvidersSecurityReviewUsageEndpoint {
  constructor(private readonly _manager: MetorialEndpointManager<any>) {}

  // thin proxies so method bodies stay unchanged
  private _get(request: any) {
    return this._manager._get(request);
  }
  private _post(request: any) {
    return this._manager._post(request);
  }
  private _put(request: any) {
    return this._manager._put(request);
  }
  private _patch(request: any) {
    return this._manager._patch(request);
  }
  private _delete(request: any) {
    return this._manager._delete(request);
  }

  /**
   * @name Reassess usage review
   * @description Starts a new usage review of the provider, based on how it is used in this project. Usage reviews must be enabled for the project.
   *
   * @param `instanceId` - string
   * @param `providerId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceProvidersSecurityReviewUsageReassessOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  reassess(
    instanceId: string,
    providerId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceProvidersSecurityReviewUsageReassessOutput> {
    let path = `instances/${instanceId}/providers/${providerId}/security-review/usage/reassess`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceProvidersSecurityReviewUsageReassessOutput
    );
  }
}
