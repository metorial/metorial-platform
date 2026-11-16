import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsMarketplacesArchiveOutput,
  mapDashboardInstanceSkillsMarketplacesCreateBody,
  mapDashboardInstanceSkillsMarketplacesCreateOutput,
  mapDashboardInstanceSkillsMarketplacesGetOutput,
  mapDashboardInstanceSkillsMarketplacesListOutput,
  mapDashboardInstanceSkillsMarketplacesListQuery,
  mapDashboardInstanceSkillsMarketplacesSyncBody,
  mapDashboardInstanceSkillsMarketplacesSyncOutput,
  mapDashboardInstanceSkillsMarketplacesUpdateBody,
  mapDashboardInstanceSkillsMarketplacesUpdateOutput,
  type DashboardInstanceSkillsMarketplacesArchiveOutput,
  type DashboardInstanceSkillsMarketplacesCreateBody,
  type DashboardInstanceSkillsMarketplacesCreateOutput,
  type DashboardInstanceSkillsMarketplacesGetOutput,
  type DashboardInstanceSkillsMarketplacesListOutput,
  type DashboardInstanceSkillsMarketplacesListQuery,
  type DashboardInstanceSkillsMarketplacesSyncBody,
  type DashboardInstanceSkillsMarketplacesSyncOutput,
  type DashboardInstanceSkillsMarketplacesUpdateBody,
  type DashboardInstanceSkillsMarketplacesUpdateOutput
} from '../resources';

/**
 * @name Skill Marketplaces controller
 * @description Manage skill marketplaces for an instance.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsMarketplacesEndpoint {
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
   * @name List skill marketplaces
   * @description Returns a paginated list of skill marketplaces.
   *
   * @param `query` - DashboardInstanceSkillsMarketplacesListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMarketplacesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceSkillsMarketplacesListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMarketplacesListOutput> {
    let path = 'skill-marketplaces';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsMarketplacesListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsMarketplacesListOutput
    );
  }

  /**
   * @name Get skill marketplace
   * @description Retrieves a skill marketplace.
   *
   * @param `skillMarketplaceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMarketplacesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    skillMarketplaceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMarketplacesGetOutput> {
    let path = `skill-marketplaces/${skillMarketplaceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsMarketplacesGetOutput
    );
  }

  /**
   * @name Create skill marketplace
   * @description Creates a skill marketplace.
   *
   * @param `body` - DashboardInstanceSkillsMarketplacesCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMarketplacesCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceSkillsMarketplacesCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMarketplacesCreateOutput> {
    let path = 'skill-marketplaces';

    let request = {
      path,
      body: mapDashboardInstanceSkillsMarketplacesCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsMarketplacesCreateOutput
    );
  }

  /**
   * @name Update skill marketplace
   * @description Updates a skill marketplace.
   *
   * @param `skillMarketplaceId` - string
   * @param `body` - DashboardInstanceSkillsMarketplacesUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMarketplacesUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    skillMarketplaceId: string,
    body: DashboardInstanceSkillsMarketplacesUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMarketplacesUpdateOutput> {
    let path = `skill-marketplaces/${skillMarketplaceId}`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsMarketplacesUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSkillsMarketplacesUpdateOutput
    );
  }

  /**
   * @name Archive skill marketplace
   * @description Archives a skill marketplace.
   *
   * @param `skillMarketplaceId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMarketplacesArchiveOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  archive(
    skillMarketplaceId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMarketplacesArchiveOutput> {
    let path = `skill-marketplaces/${skillMarketplaceId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillsMarketplacesArchiveOutput
    );
  }

  /**
   * @name Sync skill marketplace
   * @description Forces a skill marketplace sync.
   *
   * @param `skillMarketplaceId` - string
   * @param `body` - DashboardInstanceSkillsMarketplacesSyncBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsMarketplacesSyncOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  sync(
    skillMarketplaceId: string,
    body: DashboardInstanceSkillsMarketplacesSyncBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsMarketplacesSyncOutput> {
    let path = `skill-marketplaces/${skillMarketplaceId}/sync`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsMarketplacesSyncBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsMarketplacesSyncOutput
    );
  }
}
