import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsMergeRequestsItemsBulkResolveBody,
  mapDashboardInstanceSkillsMergeRequestsItemsBulkResolveOutput,
  mapDashboardInstanceSkillsMergeRequestsItemsResolveBody,
  mapDashboardInstanceSkillsMergeRequestsItemsResolveOutput,
  type DashboardInstanceSkillsMergeRequestsItemsBulkResolveBody,
  type DashboardInstanceSkillsMergeRequestsItemsBulkResolveOutput,
  type DashboardInstanceSkillsMergeRequestsItemsResolveBody,
  type DashboardInstanceSkillsMergeRequestsItemsResolveOutput
} from '../resources';

/**
 * @name Skill Merge Requests controller
 * @description Review, resolve, and apply changes between skills.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementInstanceSkillsMergeRequestsItemsEndpoint {
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
   * @name Resolve skill merge request item
   * @description Saves a resolution for one proposed skill change.
   *
   * @param `instanceId` - string
   * @param `skillMergeRequestId` - string
   * @param `itemId` - string
   * @param `body` - DashboardInstanceSkillsMergeRequestsItemsResolveBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMergeRequestsItemsResolveOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  resolve(
    instanceId: string,
    skillMergeRequestId: string,
    itemId: string,
    body: DashboardInstanceSkillsMergeRequestsItemsResolveBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMergeRequestsItemsResolveOutput> {
    let path = `instances/${instanceId}/skill-merge-requests/${skillMergeRequestId}/items/${itemId}`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsMergeRequestsItemsResolveBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSkillsMergeRequestsItemsResolveOutput
    );
  }

  /**
   * @name Resolve skill merge request items
   * @description Saves resolutions for multiple proposed skill changes.
   *
   * @param `instanceId` - string
   * @param `skillMergeRequestId` - string
   * @param `body` - DashboardInstanceSkillsMergeRequestsItemsBulkResolveBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMergeRequestsItemsBulkResolveOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  bulkResolve(
    instanceId: string,
    skillMergeRequestId: string,
    body: DashboardInstanceSkillsMergeRequestsItemsBulkResolveBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMergeRequestsItemsBulkResolveOutput> {
    let path = `instances/${instanceId}/skill-merge-requests/${skillMergeRequestId}/items`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsMergeRequestsItemsBulkResolveBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSkillsMergeRequestsItemsBulkResolveOutput
    );
  }
}
