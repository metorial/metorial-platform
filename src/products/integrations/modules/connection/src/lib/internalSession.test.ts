import { describe, expect, it } from 'vitest';
import { getProviderActionAdapterWhere } from './internalSession';

describe('internal session adapter scope', () => {
  it('selects only ordinary actions for ordinary sessions', () => {
    expect(
      getProviderActionAdapterWhere({ isInternal: false, adapterGlobalOid: null })
    ).toEqual({ adapterOid: null });
  });

  it('selects only actions from the bound global adapter', () => {
    expect(getProviderActionAdapterWhere({ isInternal: true, adapterGlobalOid: 42n })).toEqual(
      { adapter: { globalOid: 42n } }
    );
  });

  it('fails closed for an invalid internal session', () => {
    expect(() =>
      getProviderActionAdapterWhere({ isInternal: true, adapterGlobalOid: null })
    ).toThrow('missing its adapter binding');
  });
});
