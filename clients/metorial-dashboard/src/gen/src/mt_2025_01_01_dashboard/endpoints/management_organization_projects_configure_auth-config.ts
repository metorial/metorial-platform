import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapManagementOrganizationProjectsConfigureAuthConfigGetOutput,
  mapManagementOrganizationProjectsConfigureAuthConfigUpdateBody,
  mapManagementOrganizationProjectsConfigureAuthConfigUpdateOutput,
  type ManagementOrganizationProjectsConfigureAuthConfigGetOutput,
  type ManagementOrganizationProjectsConfigureAuthConfigUpdateBody,
  type ManagementOrganizationProjectsConfigureAuthConfigUpdateOutput
} from '../resources';

/**
 * @name Project controller
 * @description Read and write project information
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialManagementOrganizationProjectsConfigureAuthConfigEndpoint {
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
   * @name Get project auth config configuration
   * @description Get auth config export/import and OAuth registration settings for a project
   *
   * @param `projectId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ManagementOrganizationProjectsConfigureAuthConfigGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    projectId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<ManagementOrganizationProjectsConfigureAuthConfigGetOutput> {
    let path = `organization/projects/${projectId}/configure/auth-config`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapManagementOrganizationProjectsConfigureAuthConfigGetOutput
    );
  }

  /**
   * @name Update project auth config configuration
   * @description Update auth config export/import and OAuth registration settings for a project
   *
   * @param `projectId` - string
   * @param `body` - ManagementOrganizationProjectsConfigureAuthConfigUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns ManagementOrganizationProjectsConfigureAuthConfigUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    projectId: string,
    body: ManagementOrganizationProjectsConfigureAuthConfigUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<ManagementOrganizationProjectsConfigureAuthConfigUpdateOutput> {
    let path = `organization/projects/${projectId}/configure/auth-config`;

    let request = {
      path,
      body: mapManagementOrganizationProjectsConfigureAuthConfigUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapManagementOrganizationProjectsConfigureAuthConfigUpdateOutput
    );
  }
}
