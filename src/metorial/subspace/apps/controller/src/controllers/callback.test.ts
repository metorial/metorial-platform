import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  getSolutionById: vi.fn(),
  getTenantById: vi.fn(),
  getTenantAndEnvironmentById: vi.fn(),
  getCallbackById: vi.fn(),
  sendDashboardTestEvent: vi.fn()
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  solutionService: { getSolutionById: mocks.getSolutionById },
  tenantService: {
    getTenantById: mocks.getTenantById,
    getTenantAndEnvironmentById: mocks.getTenantAndEnvironmentById
  }
}));

vi.mock('@metorial-subspace/module-callback', () => ({
  callbackService: {
    getCallbackById: mocks.getCallbackById,
    sendDashboardTestEvent: mocks.sendDashboardTestEvent
  }
}));

vi.mock('@metorial-subspace/module-deployment', () => ({
  providerDeploymentService: {}
}));

vi.mock('@metorial-subspace/presenters', () => ({
  callbackPresenter: vi.fn(value => value)
}));

import { callbackController } from './callback';

let solution = { oid: 1n, id: 'sol_authorized' } as any;
let tenant = { oid: 2n, id: 'ten_authorized' } as any;
let environment = { oid: 3n, id: 'env_authorized' } as any;
let callback = { oid: 4n, id: 'clb_authorized' } as any;
let callbackEvent = { id: 'cbe_authorized', sourceId: 'dashboard_test' };

let request = (body: Record<string, unknown>, solutionId = solution.id) =>
  ({
    query: new URLSearchParams(),
    headers: new Headers({ 'Subspace-Solution-Id': solutionId }),
    url: '/rpc',
    body,
    rawBody: JSON.stringify(body),
    requestId: 'rpc-request',
    sharedMiddlewareMemo: new Map(),
    beforeSend: () => {},
    appendHeaders: () => {},
    getCookies: () => ({}),
    getCookie: () => undefined,
    setCookie: () => {}
  }) as any;

let body = (overrides: Record<string, unknown> = {}) => ({
  tenantId: tenant.id,
  environmentId: environment.id,
  callbackId: callback.id,
  callbackInstanceId: 'cbi_authorized',
  eventId: 'dashboard_test:stable-action-id',
  eventType: 'dashboard.test',
  payloadJson: '{"test":true}',
  ...overrides
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSolutionById.mockResolvedValue(solution);
  mocks.getTenantById.mockResolvedValue(tenant);
  mocks.getTenantAndEnvironmentById.mockResolvedValue({ tenant, environment });
  mocks.getCallbackById.mockResolvedValue(callback);
  mocks.sendDashboardTestEvent.mockResolvedValue(callbackEvent);
});

describe('Subspace callback controller dashboard synthetic event boundary', () => {
  let handler = callbackController.sendDashboardTestEvent;

  it('runs the production middleware chain and delegates authorized context', async () => {
    let result = await handler.run(request(body()), {});

    expect(mocks.getSolutionById).toHaveBeenCalledWith({ id: solution.id });
    expect(mocks.getTenantAndEnvironmentById).toHaveBeenCalledWith({
      tenantId: tenant.id,
      environmentId: environment.id
    });
    expect(mocks.getCallbackById).toHaveBeenCalledWith({
      tenant,
      solution,
      environment,
      callbackId: callback.id
    });
    expect(mocks.sendDashboardTestEvent).toHaveBeenCalledWith({
      tenant,
      solution,
      environment,
      callbackId: callback.id,
      callbackInstanceId: 'cbi_authorized',
      eventId: 'dashboard_test:stable-action-id',
      input: {
        eventType: 'dashboard.test',
        payloadJson: '{"test":true}'
      }
    });
    expect(result.response).toBe(callbackEvent);
  });

  it('rejects malformed internal input before scope resolution', async () => {
    let malformed = body();
    delete (malformed as Partial<typeof malformed>).eventId;

    await expect(handler.run(request(malformed), {})).rejects.toMatchObject({
      data: { code: 'invalid_data' }
    });
    expect(mocks.getSolutionById).not.toHaveBeenCalled();
    expect(mocks.sendDashboardTestEvent).not.toHaveBeenCalled();
  });

  it('fails closed for the wrong solution', async () => {
    mocks.getSolutionById.mockRejectedValue(new Error('solution not owned'));

    await expect(handler.run(request(body(), 'sol_other'), {})).rejects.toThrow(
      'solution not owned'
    );
    expect(mocks.getTenantAndEnvironmentById).not.toHaveBeenCalled();
    expect(mocks.sendDashboardTestEvent).not.toHaveBeenCalled();
  });

  it.each([
    ['tenant', { tenantId: 'ten_other' }],
    ['environment', { environmentId: 'env_other' }]
  ])('fails closed for the wrong %s', async (_, override) => {
    mocks.getTenantAndEnvironmentById.mockRejectedValue(new Error('tenant scope denied'));

    await expect(handler.run(request(body(override)), {})).rejects.toThrow(
      'tenant scope denied'
    );
    expect(mocks.getCallbackById).not.toHaveBeenCalled();
    expect(mocks.sendDashboardTestEvent).not.toHaveBeenCalled();
  });

  it('fails closed for a callback outside the authorized scope', async () => {
    mocks.getCallbackById.mockRejectedValue(new Error('callback scope denied'));

    await expect(handler.run(request(body({ callbackId: 'clb_other' })), {})).rejects.toThrow(
      'callback scope denied'
    );
    expect(mocks.sendDashboardTestEvent).not.toHaveBeenCalled();
  });
});
