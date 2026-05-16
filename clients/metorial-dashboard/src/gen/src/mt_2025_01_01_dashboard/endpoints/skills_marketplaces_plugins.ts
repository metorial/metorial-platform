import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsMarketplacesPluginsAddBody,
  mapDashboardInstanceSkillsMarketplacesPluginsAddOutput,
  mapDashboardInstanceSkillsMarketplacesPluginsGetOutput,
  mapDashboardInstanceSkillsMarketplacesPluginsListOutput,
  mapDashboardInstanceSkillsMarketplacesPluginsListQuery,
  mapDashboardInstanceSkillsMarketplacesPluginsRemoveOutput,
  type DashboardInstanceSkillsMarketplacesPluginsAddBody,
  type DashboardInstanceSkillsMarketplacesPluginsAddOutput,
  type DashboardInstanceSkillsMarketplacesPluginsGetOutput,
  type DashboardInstanceSkillsMarketplacesPluginsListOutput,
  type DashboardInstanceSkillsMarketplacesPluginsListQuery,
  type DashboardInstanceSkillsMarketplacesPluginsRemoveOutput
} from '../resources';

/**
 * @name Skill Marketplace Plugins controller
 * @description Manage plugin links for skill marketplaces.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsMarketplacesPluginsEndpoint {
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
   * @name List skill marketplace plugins
   * @description Returns plugins linked to a skill marketplace.
   *
   * @param `skillMarketplaceId` - string
   * @param `query` - DashboardInstanceSkillsMarketplacesPluginsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMarketplacesPluginsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    skillMarketplaceId: string,
    query?: DashboardInstanceSkillsMarketplacesPluginsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMarketplacesPluginsListOutput> {
    let path = `skill-marketplaces/${skillMarketplaceId}/plugins`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsMarketplacesPluginsListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsMarketplacesPluginsListOutput
    );
  }

  /**
   * @name Add skill marketplace plugin
   * @description Adds a skill plugin to a skill marketplace.
   *
   * @param `skillMarketplaceId` - string
   * @param `body` - DashboardInstanceSkillsMarketplacesPluginsAddBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMarketplacesPluginsAddOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  add(
    skillMarketplaceId: string,
    body: DashboardInstanceSkillsMarketplacesPluginsAddBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMarketplacesPluginsAddOutput> {
    let path = `skill-marketplaces/${skillMarketplaceId}/plugins`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsMarketplacesPluginsAddBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsMarketplacesPluginsAddOutput
    );
  }

  /**
   * @name Get skill marketplace plugin
   * @description Retrieves a skill marketplace plugin link.
   *
   * @param `skillMarketplaceId` - string
   * @param `skillMarketplacePluginId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMarketplacesPluginsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    skillMarketplaceId: string,
    skillMarketplacePluginId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMarketplacesPluginsGetOutput> {
    let path = `skill-marketplaces/${skillMarketplaceId}/plugins/${skillMarketplacePluginId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsMarketplacesPluginsGetOutput
    );
  }

  /**
   * @name Remove skill marketplace plugin
   * @description Removes a skill plugin from a skill marketplace.
   *
   * @param `skillMarketplaceId` - string
   * @param `skillMarketplacePluginId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMarketplacesPluginsRemoveOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  remove(
    skillMarketplaceId: string,
    skillMarketplacePluginId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMarketplacesPluginsRemoveOutput> {
    let path = `skill-marketplaces/${skillMarketplaceId}/plugins/${skillMarketplacePluginId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillsMarketplacesPluginsRemoveOutput
    );
  }
}
