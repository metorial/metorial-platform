import SuperJSON from 'superjson';

export let serialize = {
  encode: (data: any) => {
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

    let { $$TYPES$$, ...rest } = data;

    if (typeof $$TYPES$$ != 'object' || !$$TYPES$$.__mode) return data;

    let { __mode, ...meta } = $$TYPES$$;
    let json = __mode == 'value' ? rest.data : rest;

    return SuperJSON.deserialize({ json, meta });
  }
};
