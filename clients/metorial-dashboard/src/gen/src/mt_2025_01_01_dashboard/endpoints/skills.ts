import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsCreateBody,
  mapDashboardInstanceSkillsCreateOutput,
  mapDashboardInstanceSkillsDeleteOutput,
  mapDashboardInstanceSkillsDuplicateBody,
  mapDashboardInstanceSkillsDuplicateOutput,
  mapDashboardInstanceSkillsForkBody,
  mapDashboardInstanceSkillsForkOutput,
  mapDashboardInstanceSkillsGetOutput,
  mapDashboardInstanceSkillsListOutput,
  mapDashboardInstanceSkillsListQuery,
  mapDashboardInstanceSkillsPublishConsumerSkillOutput,
  mapDashboardInstanceSkillsUpdateBody,
  mapDashboardInstanceSkillsUpdateOutput,
  type DashboardInstanceSkillsCreateBody,
  type DashboardInstanceSkillsCreateOutput,
  type DashboardInstanceSkillsDeleteOutput,
  type DashboardInstanceSkillsDuplicateBody,
  type DashboardInstanceSkillsDuplicateOutput,
  type DashboardInstanceSkillsForkBody,
  type DashboardInstanceSkillsForkOutput,
  type DashboardInstanceSkillsGetOutput,
  type DashboardInstanceSkillsListOutput,
  type DashboardInstanceSkillsListQuery,
  type DashboardInstanceSkillsPublishConsumerSkillOutput,
  type DashboardInstanceSkillsUpdateBody,
  type DashboardInstanceSkillsUpdateOutput
} from '../resources';

/**
 * @name Skills controller
 * @description Skills group provider and integration capabilities into reusable, owned compositions.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSkillsEndpoint {
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
   * @name List skills
   * @description Returns a paginated list of skills.
   *
   * @param `query` - DashboardInstanceSkillsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceSkillsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsListOutput> {
    let path = 'skills';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceSkillsListOutput);
  }

  /**
   * @name Get skill
   * @description Retrieves a specific skill.
   *
   * @param `skillId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    skillId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsGetOutput> {
    let path = `skills/${skillId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(mapDashboardInstanceSkillsGetOutput);
  }

  /**
   * @name Create skill
   * @description Creates a new skill.
   *
   * @param `body` - DashboardInstanceSkillsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceSkillsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsCreateOutput> {
    let path = 'skills';

    let request = {
      path,
      body: mapDashboardInstanceSkillsCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsCreateOutput
    );
  }

  /**
   * @name Update skill
   * @description Updates a specific skill.
   *
   * @param `skillId` - string
   * @param `body` - DashboardInstanceSkillsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    skillId: string,
    body: DashboardInstanceSkillsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsUpdateOutput> {
    let path = `skills/${skillId}`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsUpdateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceSkillsUpdateOutput
    );
  }

  /**
   * @name Delete skill
   * @description Archives a specific skill.
   *
   * @param `skillId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    skillId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsDeleteOutput> {
    let path = `skills/${skillId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillsDeleteOutput
    );
  }

  /**
   * @name Fork skill
   * @description Forks a skill for the current consumer. Non-consumer callers duplicate the skill instead.
   *
   * @param `skillId` - string
   * @param `body` - DashboardInstanceSkillsForkBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsForkOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  fork(
    skillId: string,
    body: DashboardInstanceSkillsForkBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsForkOutput> {
    let path = `skills/${skillId}/fork`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsForkBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(mapDashboardInstanceSkillsForkOutput);
  }

  /**
   * @name Publish consumer skill
   * @description Publishes a consumer-owned skill to the consumer groups they belong to.
   *
   * @param `skillId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsPublishConsumerSkillOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  publishConsumerSkill(
    skillId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsPublishConsumerSkillOutput> {
    let path = `skills/${skillId}/publish`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsPublishConsumerSkillOutput
    );
  }

  /**
   * @name Duplicate skill
   * @description Duplicates a skill.
   *
   * @param `skillId` - string
   * @param `body` - DashboardInstanceSkillsDuplicateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsDuplicateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  duplicate(
    skillId: string,
    body: DashboardInstanceSkillsDuplicateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsDuplicateOutput> {
    let path = `skills/${skillId}/duplicate`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsDuplicateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsDuplicateOutput
    );
  }
}
