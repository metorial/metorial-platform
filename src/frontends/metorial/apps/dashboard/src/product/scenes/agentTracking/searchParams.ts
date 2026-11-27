import { useSearchParams } from 'react-router-dom';

// Shared by all callers so a write builds on one not yet rendered (a blur commit, then a click).
let latest = { rendered: '', params: new URLSearchParams() };

export let useLatestSearchParams = () => {
  let [params, setParams] = useSearchParams();
  let rendered = params.toString();
  if (latest.rendered != rendered) latest = { rendered, params };

  let read = () => new URLSearchParams(latest.params);

  let write = (next: URLSearchParams, opts: { push?: boolean } = {}) => {
    latest.params = next;
    setParams(next, { replace: !opts.push });
  };

  return { params, read, write };
};

export let useSearchParamWriter = () => {
  let { params, read, write } = useLatestSearchParams();

  let setParam = (name: string, value: string | undefined) => {
    let next = read();
    if (value === undefined) next.delete(name);
    else next.set(name, value);

    write(next);
  };

  return [params, setParam] as const;
};

export let useSearchParamOption = <Id extends string>(
  name: string,
  ids: readonly Id[],
  defaultId: Id
) => {
  let [params, setParam] = useSearchParamWriter();
  let value = params.get(name);
  let current = ids.find(id => id == value) ?? defaultId;

  let setCurrent = (next: Id) => setParam(name, next == defaultId ? undefined : next);

  return [current, setCurrent] as const;
};
