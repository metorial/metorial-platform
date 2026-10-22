import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSkillsFilesBatchBody,
  mapDashboardInstanceSkillsFilesBatchOutput,
  mapDashboardInstanceSkillsFilesDeleteOutput,
  mapDashboardInstanceSkillsFilesDeleteQuery,
  mapDashboardInstanceSkillsFilesGetOutput,
  mapDashboardInstanceSkillsFilesGetQuery,
  mapDashboardInstanceSkillsFilesListOutput,
  mapDashboardInstanceSkillsFilesMoveBody,
  mapDashboardInstanceSkillsFilesMoveOutput,
  mapDashboardInstanceSkillsFilesPutBody,
  mapDashboardInstanceSkillsFilesPutOutput,
  type DashboardInstanceSkillsFilesBatchBody,
  type DashboardInstanceSkillsFilesBatchOutput,
  type DashboardInstanceSkillsFilesDeleteOutput,
  type DashboardInstanceSkillsFilesDeleteQuery,
  type DashboardInstanceSkillsFilesGetOutput,
  type DashboardInstanceSkillsFilesGetQuery,
  type DashboardInstanceSkillsFilesListOutput,
  type DashboardInstanceSkillsFilesMoveBody,
  type DashboardInstanceSkillsFilesMoveOutput,
  type DashboardInstanceSkillsFilesPutBody,
  type DashboardInstanceSkillsFilesPutOutput
} from '../resources';

/**
 * @name Skill Files controller
 * @description Read and edit the files of a skill by path.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialDashboardInstanceSkillsFilesEndpoint {
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
   * @name List skill files
   * @description Lists every file of a skill with its path, size and etag. Directories are implied by file paths.
   *
   * @param `instanceId` - string
   * @param `skillId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsFilesListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    instanceId: string,
    skillId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsFilesListOutput> {
    let path = `dashboard/instances/${instanceId}/skills/${skillId}/files`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsFilesListOutput
    );
  }

  /**
   * @name Get skill file
   * @description Retrieves a single skill file by path. Documents include their text content, other files include a download URL.
   *
   * @param `instanceId` - string
   * @param `skillId` - string
   * @param `query` - DashboardInstanceSkillsFilesGetQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsFilesGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    instanceId: string,
    skillId: string,
    query?: DashboardInstanceSkillsFilesGetQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsFilesGetOutput> {
    let path = `dashboard/instances/${instanceId}/skills/${skillId}/files/content`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsFilesGetQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSkillsFilesGetOutput
    );
  }

  /**
   * @name Write skill file
   * @description Creates or replaces the file at a path. Parent directories are created automatically.
   *
   * @param `instanceId` - string
   * @param `skillId` - string
   * @param `body` - DashboardInstanceSkillsFilesPutBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsFilesPutOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  put(
    instanceId: string,
    skillId: string,
    body: DashboardInstanceSkillsFilesPutBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsFilesPutOutput> {
    let path = `dashboard/instances/${instanceId}/skills/${skillId}/files`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsFilesPutBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._put(request).transform(
      mapDashboardInstanceSkillsFilesPutOutput
    );
  }

  /**
   * @name Delete skill file
   * @description Deletes the file at a path. Directories that were created automatically and become empty are removed. The root SKILL.md cannot be deleted.
   *
   * @param `instanceId` - string
   * @param `skillId` - string
   * @param `query` - DashboardInstanceSkillsFilesDeleteQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsFilesDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    instanceId: string,
    skillId: string,
    query?: DashboardInstanceSkillsFilesDeleteQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsFilesDeleteOutput> {
    let path = `dashboard/instances/${instanceId}/skills/${skillId}/files`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSkillsFilesDeleteQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceSkillsFilesDeleteOutput
    );
  }

  /**
   * @name Move skill file
   * @description Moves or renames a file. The root SKILL.md cannot be moved.
   *
   * @param `instanceId` - string
   * @param `skillId` - string
   * @param `body` - DashboardInstanceSkillsFilesMoveBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsFilesMoveOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  move(
    instanceId: string,
    skillId: string,
    body: DashboardInstanceSkillsFilesMoveBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsFilesMoveOutput> {
    let path = `dashboard/instances/${instanceId}/skills/${skillId}/files/move`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsFilesMoveBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsFilesMoveOutput
    );
  }

  /**
   * @name Apply skill file changes
   * @description Applies up to 100 put, delete and move changes one after another, in order. Every change is validated before any is applied, but changes are not applied atomically: if a change fails while being applied, the changes before it stay applied. Every change can carry its own if_match precondition.
   *
   * @param `instanceId` - string
   * @param `skillId` - string
   * @param `body` - DashboardInstanceSkillsFilesBatchBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSkillsFilesBatchOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  batch(
    instanceId: string,
    skillId: string,
    body: DashboardInstanceSkillsFilesBatchBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSkillsFilesBatchOutput> {
    let path = `dashboard/instances/${instanceId}/skills/${skillId}/files/batch`;

    let request = {
      path,
      body: mapDashboardInstanceSkillsFilesBatchBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceSkillsFilesBatchOutput
    );
  }
}
