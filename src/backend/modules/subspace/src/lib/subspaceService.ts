import { subspace } from './subspace';

export let normalizeArrayParam = <T>(param: T | T[] | undefined): T[] | undefined => {
  let items = (Array.isArray(param) ? param : [param!]).filter(Boolean);
  if (!items.length) return undefined;
  return items;
};

type ListFilters = {
  [key: string]: string | string[] | boolean | undefined;
};

type NormalizedFilters = {
  [key: string]: string[] | boolean | undefined;
};

export let normalizeFilters = (filters: ListFilters) => {
  let result: NormalizedFilters = {};
  for (let [key, value] of Object.entries(filters)) {
    if (typeof value === 'boolean') {
      result[key] = value;
    } else {
      result[key] = normalizeArrayParam(value);
    }
  }
  return result;
};

type CrudMethod = 'get' | 'list' | 'create' | 'update' | 'delete';

type ControllerWithMethods<TMethods extends readonly CrudMethod[]> = {
  [K in TMethods[number]]: (...args: any[]) => any;
};

export let createSubspaceService = <
  TController extends ControllerWithMethods<TMethods>,
  TMethods extends readonly CrudMethod[]
>(
  controller: TController,
  methods: TMethods,
  extra?: (client: typeof subspace) => Record<string, any>
) => {
  let service: Record<string, any> = {};

  for (let method of methods) {
    if (method in controller) {
      service[method] = (controller[method] as Function).bind(controller);
    }
  }

  if (extra) {
    Object.assign(service, extra(subspace));
  }

  return service as Pick<TController, TMethods[number]> &
    (typeof extra extends undefined ? {} : ReturnType<NonNullable<typeof extra>>);
};
