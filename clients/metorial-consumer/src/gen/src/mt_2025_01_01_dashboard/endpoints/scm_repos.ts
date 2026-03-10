import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceScmReposCreateBody,
  mapDashboardInstanceScmReposCreateOutput,
  mapDashboardInstanceScmReposPreviewBody,
  mapDashboardInstanceScmReposPreviewOutput,
  type DashboardInstanceScmReposCreateBody,
  type DashboardInstanceScmReposCreateOutput,
  type DashboardInstanceScmReposPreviewBody,
  type DashboardInstanceScmReposPreviewOutput
} from '../resources';

/**
 * @name SCM Repos controller
 * @description Manage source control repositories.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialScmReposEndpoint {
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
   * @name Preview SCM repos
   * @description Lists available repositories from an SCM installation.
   *
   * @param `body` - DashboardInstanceScmReposPreviewBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceScmReposPreviewOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  preview(
    body: DashboardInstanceScmReposPreviewBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceScmReposPreviewOutput> {
    let path = 'scm/repos/preview';

    let request = {
      path,
      body: mapDashboardInstanceScmReposPreviewBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceScmReposPreviewOutput
    );
  }

  /**
   * @name Create SCM repo
   * @description Links or creates a repository in an SCM installation.
   *
   * @param `body` - DashboardInstanceScmReposCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceScmReposCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceScmReposCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceScmReposCreateOutput> {
    let path = 'scm/repos';

    let request = {
      path,
      body: mapDashboardInstanceScmReposCreateBody.transformTo(body),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceScmReposCreateOutput
    );
  }
}
