import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsMarketplacesRepositoriesCreateBody,
  mapDashboardInstanceSkillsMarketplacesRepositoriesCreateOutput,
  mapDashboardInstanceSkillsMarketplacesRepositoriesDeleteOutput,
  mapDashboardInstanceSkillsMarketplacesRepositoriesGetOutput,
  mapDashboardInstanceSkillsMarketplacesRepositoriesListOutput,
  mapDashboardInstanceSkillsMarketplacesRepositoriesListQuery,
  type DashboardInstanceSkillsMarketplacesRepositoriesCreateBody,
  type DashboardInstanceSkillsMarketplacesRepositoriesCreateOutput,
  type DashboardInstanceSkillsMarketplacesRepositoriesDeleteOutput,
  type DashboardInstanceSkillsMarketplacesRepositoriesGetOutput,
  type DashboardInstanceSkillsMarketplacesRepositoriesListOutput,
  type DashboardInstanceSkillsMarketplacesRepositoriesListQuery
} from '../resources';

/**
 * @name Skill Marketplaces controller
 * @description Manage skill marketplaces for an instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsMarketplacesRepositoriesEndpoint {
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
   * @name List skill marketplace repositories
   * @description Returns repositories linked to a skill marketplace.
   *
   * @param `skillMarketplaceId` - string
   * @param `query` - DashboardInstanceSkillsMarketplacesRepositoriesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMarketplacesRepositoriesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    skillMarketplaceId: string,
    query?: DashboardInstanceSkillsMarketplacesRepositoriesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMarketplacesRepositoriesListOutput> {
    let path = `skill-marketplaces/${skillMarketplaceId}/repositories`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsMarketplacesRepositoriesListQuery.transformTo(
            query
          )
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsMarketplacesRepositoriesListOutput
    );
  }

  /**
   * @name Get skill marketplace repository
   * @description Retrieves a repository linked to a skill marketplace.
   *
   * @param `skillMarketplaceId` - string
   * @param `skillMarketplaceRepositoryId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMarketplacesRepositoriesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    skillMarketplaceId: string,
    skillMarketplaceRepositoryId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMarketplacesRepositoriesGetOutput> {
    let path = `skill-marketplaces/${skillMarketplaceId}/repositories/${skillMarketplaceRepositoryId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsMarketplacesRepositoriesGetOutput
    );
  }

  /**
   * @name Link skill marketplace repository
   * @description Links an SCM repository to a skill marketplace.
   *
   * @param `skillMarketplaceId` - string
   * @param `body` - DashboardInstanceSkillsMarketplacesRepositoriesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMarketplacesRepositoriesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    skillMarketplaceId: string,
    body: DashboardInstanceSkillsMarketplacesRepositoriesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMarketplacesRepositoriesCreateOutput> {
    let path = `skill-marketplaces/${skillMarketplaceId}/repositories`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsMarketplacesRepositoriesCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsMarketplacesRepositoriesCreateOutput
    );
  }

  /**
   * @name Unlink skill marketplace repository
   * @description Unlinks an SCM repository from a skill marketplace.
   *
   * @param `skillMarketplaceId` - string
   * @param `skillMarketplaceRepositoryId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMarketplacesRepositoriesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    skillMarketplaceId: string,
    skillMarketplaceRepositoryId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMarketplacesRepositoriesDeleteOutput> {
    let path = `skill-marketplaces/${skillMarketplaceId}/repositories/${skillMarketplaceRepositoryId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillsMarketplacesRepositoriesDeleteOutput
    );
  }
}
