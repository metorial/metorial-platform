import { describe, expect, it } from 'vitest';
import { agentTracking, createScope, isoRange, rpcErrorCode } from './support';

let range = () =>
  isoRange(new Date(Date.now() - 24 * 60 * 60 * 1000), new Date(Date.now() + 60 * 60 * 1000));

let rowsQuery = (query: Record<string, unknown> = {}) => ({
  atq: '0',
  dataset: 'sessions',
  mode: 'rows',
  range: range(),
  ...query
});

// The e2e stack runs without object storage, so a valid export stops at `exports_unavailable`;
// the export pipeline itself is covered by the query module's integration tests.
describe('query exports', () => {
  it('validates the query before anything else', async () => {
    let scope = await createScope();
    let organizationId = scope.organization.id;
    let create = (query: Record<string, unknown>) =>
      agentTracking().queryExport.create({ organizationId, query });

    expect(
      await rpcErrorCode(
        create({ atq: '0', dataset: 'usage', range: range(), measures: ['requests'] })
      )
    ).toBe('invalid_query');
    expect(
      await rpcErrorCode(
        create(rowsQuery({ orderBy: [{ field: 'startedAt', direction: 'desc' }] }))
      )
    ).toBe('invalid_query');
    expect(await rpcErrorCode(create(rowsQuery({ select: ['nope'] })))).toBe('invalid_query');
    expect(await rpcErrorCode(create({ dataset: 'sessions' }))).toBe('invalid_query');
  });

  it('rejects unknown formats', async () => {
    let scope = await createScope();

    expect(
      await rpcErrorCode(
        agentTracking().queryExport.create({
          organizationId: scope.organization.id,
          query: rowsQuery(),
          format: 'xlsx' as never
        })
      )
    ).toBe('invalid_data');
  });

  it('reports that exports need object storage', async () => {
    let scope = await createScope();

    expect(
      await rpcErrorCode(
        agentTracking().queryExport.create({
          organizationId: scope.organization.id,
          query: rowsQuery()
        })
      )
    ).toBe('exports_unavailable');
  });

  it('refuses exports for organizations that hide individuals', async () => {
    let scope = await createScope({
      organization: { settings: { privacy: { hideIndividuals: true } } }
    });

    expect(
      await rpcErrorCode(
        agentTracking().queryExport.create({
          organizationId: scope.organization.id,
          query: rowsQuery()
        })
      )
    ).toBe('invalid_query');
  });

  it('keeps export lookups inside the organization', async () => {
    let scope = await createScope();
    let organizationId = scope.organization.id;

    let listed = await agentTracking().queryExport.list({ organizationId });
    expect(listed.items).toEqual([]);

    let lookup = { organizationId, exportId: 'atqe_missing' };
    expect(await rpcErrorCode(agentTracking().queryExport.get(lookup))).toBe('not_found');
    expect(await rpcErrorCode(agentTracking().queryExport.cancel(lookup))).toBe('not_found');
  });
});
