import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceIdentitiesCredentialsCreateBody,
  mapDashboardInstanceIdentitiesCredentialsCreateOutput,
  mapDashboardInstanceIdentitiesCredentialsDeleteOutput,
  mapDashboardInstanceIdentitiesCredentialsGetOutput,
  mapDashboardInstanceIdentitiesCredentialsListOutput,
  mapDashboardInstanceIdentitiesCredentialsListQuery,
  mapDashboardInstanceIdentitiesCredentialsUpdateBody,
  mapDashboardInstanceIdentitiesCredentialsUpdateOutput,
  type DashboardInstanceIdentitiesCredentialsCreateBody,
  type DashboardInstanceIdentitiesCredentialsCreateOutput,
  type DashboardInstanceIdentitiesCredentialsDeleteOutput,
  type DashboardInstanceIdentitiesCredentialsGetOutput,
  type DashboardInstanceIdentitiesCredentialsListOutput,
  type DashboardInstanceIdentitiesCredentialsListQuery,
  type DashboardInstanceIdentitiesCredentialsUpdateBody,
  type DashboardInstanceIdentitiesCredentialsUpdateOutput
} from '../resources';

/**
 * @name Identity Credentials controller
 * @description Identity credentials bind an identity to concrete provider deployment, config, and auth resources.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialIdentitiesCredentialsEndpoint {
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
   * @name List identity credentials
   * @description Returns a paginated list of identity credentials for the instance.
   *
   * @param `query` - DashboardInstanceIdentitiesCredentialsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesCredentialsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    query?: DashboardInstanceIdentitiesCredentialsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesCredentialsListOutput> {
    let path = 'identity-credentials';

    let request = {
      path,

      query: query
        ? mapDashboardInstanceIdentitiesCredentialsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIdentitiesCredentialsListOutput
    );
  }

  /**
   * @name Get identity credential
   * @description Retrieves a specific identity credential by ID.
   *
   * @param `identityCredentialId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesCredentialsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    identityCredentialId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesCredentialsGetOutput> {
    let path = `identity-credentials/${identityCredentialId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceIdentitiesCredentialsGetOutput
    );
  }

  /**
   * @name Create identity credential
   * @description Creates a new credential and attaches it to an identity.
   *
   * @param `body` - DashboardInstanceIdentitiesCredentialsCreateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesCredentialsCreateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  create(
    body: DashboardInstanceIdentitiesCredentialsCreateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesCredentialsCreateOutput> {
    let path = 'identity-credentials';

    let request = {
      path,
      body: mapDashboardInstanceIdentitiesCredentialsCreateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._post(request).transform(
      mapDashboardInstanceIdentitiesCredentialsCreateOutput
    );
  }

  /**
   * @name Update identity credential
   * @description Updates the delegation config attached to an identity credential.
   *
   * @param `identityCredentialId` - string
   * @param `body` - DashboardInstanceIdentitiesCredentialsUpdateBody
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesCredentialsUpdateOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  update(
    identityCredentialId: string,
    body: DashboardInstanceIdentitiesCredentialsUpdateBody,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesCredentialsUpdateOutput> {
    let path = `identity-credentials/${identityCredentialId}`;

    let request = {
      path,
      body: mapDashboardInstanceIdentitiesCredentialsUpdateBody.transformTo(
        body
      ),

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._patch(request).transform(
      mapDashboardInstanceIdentitiesCredentialsUpdateOutput
    );
  }

  /**
   * @name Delete identity credential
   * @description Archives an identity credential.
   *
   * @param `identityCredentialId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceIdentitiesCredentialsDeleteOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  delete(
    identityCredentialId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceIdentitiesCredentialsDeleteOutput> {
    let path = `identity-credentials/${identityCredentialId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._delete(request).transform(
      mapDashboardInstanceIdentitiesCredentialsDeleteOutput
    );
  }
}
