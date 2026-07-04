// @ts-ignore
import SuperJSON from 'superjson';

export let serialize = {
  encode: (data: any) => {
    if (Array.isArray(data)) data = { items: data, $$MODE$$: 'array_envelope' };

    let sup = SuperJSON.serialize(data);

    if (sup.meta?.referentialEqualities) {
      delete sup.meta.referentialEqualities;
    }

    return JSON.stringify({
      $$TYPES$$: {
        __mode: typeof sup.json == 'object' ? 'object' : 'value',
        ...sup.meta
      },

      data: typeof sup.json != 'object' ? sup.json : undefined,

      ...(typeof sup.json == 'object' ? sup.json : {})
    });
  },

  decode: (data: any) => {
    if (typeof data == 'string') data = JSON.parse(data);

    if (typeof data != 'object') return data;

    let { $$TYPES$$, $$MODE$$, ...rest } = data;

    if (typeof $$TYPES$$ != 'object' || !$$TYPES$$.__mode) return data;

    let { __mode, ...meta } = $$TYPES$$;
    let json = __mode == 'value' ? rest.data : rest;

    let res = SuperJSON.deserialize({ json, meta });

    if (
      $$MODE$$ == 'array_envelope' &&
      typeof res == 'object' &&
      res != null &&
      'items' in res
    ) {
      return res.items;
    }

    return res;
  }
};
