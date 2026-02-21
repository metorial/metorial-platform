import {
  BaseMetorialEndpoint,
  MetorialEndpointManager
} from '@metorial/util-endpoint';

import {
  mapDashboardInstanceSessionsParticipantsGetOutput,
  mapDashboardInstanceSessionsParticipantsListOutput,
  mapDashboardInstanceSessionsParticipantsListQuery,
  type DashboardInstanceSessionsParticipantsGetOutput,
  type DashboardInstanceSessionsParticipantsListOutput,
  type DashboardInstanceSessionsParticipantsListQuery
} from '../resources';

/**
 * @name Session Participants controller
 * @description Session participants represent the clients and other entities that are connected to a session. This read-only resource tracks who is participating in a session.
 *
 * @see https://metorial.com/api
 * @see https://metorial.com/docs
 */
export class MetorialSessionsParticipantsEndpoint {
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
   * @name List session participants
   * @description Returns a paginated list of participants in a session.
   *
   * @param `sessionId` - string
   * @param `query` - DashboardInstanceSessionsParticipantsListQuery
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsParticipantsListOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  list(
    sessionId: string,
    query?: DashboardInstanceSessionsParticipantsListQuery,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsParticipantsListOutput> {
    let path = `sessions/${sessionId}/participants`;

    let request = {
      path,

      query: query
        ? mapDashboardInstanceSessionsParticipantsListQuery.transformTo(query)
        : undefined,
      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionsParticipantsListOutput
    );
  }

  /**
   * @name Get session participant
   * @description Retrieves a specific participant in a session.
   *
   * @param `sessionId` - string
   * @param `sessionParticipantId` - string
   * @param `opts` - { headers?: Record<string, string> }
   * @returns DashboardInstanceSessionsParticipantsGetOutput
   * @see https://metorial.com/api
   * @see https://metorial.com/docs
   */
  get(
    sessionId: string,
    sessionParticipantId: string,
    opts?: { headers?: Record<string, string> }
  ): Promise<DashboardInstanceSessionsParticipantsGetOutput> {
    let path = `sessions/${sessionId}/participants/${sessionParticipantId}`;

    let request = {
      path,

      ...(opts?.headers ? { headers: opts.headers } : {})
    } as any;

    return this._get(request).transform(
      mapDashboardInstanceSessionsParticipantsGetOutput
    );
  }
}
