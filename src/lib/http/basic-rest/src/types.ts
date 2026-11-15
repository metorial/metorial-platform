import type { ValidationType, ValidationTypeValue } from '@lowerdeck/validation';
import type { Entity } from './server/entity';

export type BaseState = Record<string, any>;

export type ActionType = 'get' | 'list' | 'create' | 'update' | 'delete' | 'special';

export type MethodType = 'get' | 'post' | 'put' | 'patch' | 'delete';

export let typeToMethod: Record<ActionType, MethodType> = {
  get: 'get',
  list: 'get',
  create: 'post',
  update: 'patch',
  delete: 'delete',
  special: 'post'
};

export let methodToType: Record<MethodType, ActionType[]> = {
  get: ['get', 'list'],
  post: ['create', 'special'],
  put: ['update'],
  patch: ['update'],
  delete: ['delete']
};

export type EntityRequest = {
  request: Request;
  url: URL;
  path: string[];
  method: MethodType;
  headers: Headers;
  query: Record<string, string>;
  rawBody: string;
  body: any;
  input: any;
};

export type IAction<
  FullEntityType extends {},
  ParentEntityType extends {},
  Type extends ActionType,
  State extends BaseState,
  Input,
  NeedsProvider extends boolean,
  Value = any,
  Request extends {} = {}
> = {
  type: Type;
  name: string;
  needsProvider: NeedsProvider;

  input: ValidationType<Input>;
  handler: (
    entity: NeedsProvider extends true ? FullEntityType : ParentEntityType,
    ctx: Omit<Request, 'state' | 'input'> & { state: State; input: Input }
  ) => Promise<Value> | Value;
};

export type IEntity<
  Parent extends IEntity<any, any, any, any, any, any> | undefined,
  ID extends string,
  EntityType,
  Request extends {} = {},
  State extends BaseState = {},
  Actions extends {
    [Key: string]: IAction<
      MergeEntities<Parent, ID, EntityType>,
      ParentEntities<Parent>,
      ActionType,
      State,
      any,
      boolean,
      any,
      Request
    >;
  } = {}
> = {
  id: ID;
  name: string;
  provider: (
    data: {
      [Key in `${ID}Id`]: string;
    } & ParentEntities<Parent>,
    ctx: Request & { state: State }
  ) => Promise<EntityType> | EntityType;
  actions: Actions;
  fullEntity: MergeEntities<Parent, ID, EntityType>;
  ids: {
    [Key in `${ID}Id`]: string;
  } & {
    [Key in keyof ParentEntities<Parent> & string as `${Key}Id`]: string;
  };
  parent: Parent;
};

export type MergeEntities<
  Parent extends IEntity<any, any, any, any, any, any> | undefined,
  ChildId extends string,
  ChildEntityType
> = {
  [Key in ChildId]: ChildEntityType;
} & ParentEntities<Parent>;

export type ParentEntities<Parent extends IEntity<any, any, any, any, any, any> | undefined> =
  Parent extends IEntity<any, any, any, any, any, any> ? Parent['fullEntity'] : {};

export type VoidIfNoProperties<T> = keyof T extends never ? never : T extends void ? never : T;

type NoNeverProperties<T> = { [P in keyof T as T[P] extends never ? never : P]: T[P] };

type InputPayload<Input> = [VoidIfNoProperties<Input>] extends [never]
  ? { input?: undefined }
  : { input: Input };

type RequestOptions = {
  headers?: Record<string, string>;
  query?: Record<string, string>;
};

type EntityClient<CurrentEntity extends Entity<any, any, any, any, any, any>> = {
  [EntityKey in CurrentEntity['entity']['id']]: {
    [ActionKey in keyof CurrentEntity['entity']['actions']]: (
      d: NoNeverProperties<
        InputPayload<
          ValidationTypeValue<CurrentEntity['entity']['actions'][ActionKey]['input']>
        > &
          (CurrentEntity['entity']['actions'][ActionKey]['needsProvider'] extends true
            ? CurrentEntity['entity']['ids']
            : CurrentEntity['parent'] extends Entity<any, any, any, any, any, any>
              ? CurrentEntity['parent']['entity']['ids']
              : {})
      >,
      opts?: RequestOptions
    ) => Promise<Awaited<ReturnType<CurrentEntity['entity']['actions'][ActionKey]['handler']>>>;
  };
};

type NestedEntityClientObject<
  CurrentEntity extends IEntity<any, any, any, any, any, any>,
  Value extends any = any
> = CurrentEntity['parent'] extends IEntity<any, any, any, any, any, any>
  ? NestedEntityClientObject<
      CurrentEntity['parent'],
      {
        [Key in CurrentEntity['parent']['id']]: Value;
      }
    >
  : Value;

type NestedEntityClient<CurrentEntity extends Entity<any, any, any, any, any, any>> =
  NestedEntityClientObject<CurrentEntity['entity'], EntityClient<CurrentEntity>>;

type ValuesOf<T> = T[keyof T];

type UnionToIntersection<Union> = (
  Union extends unknown ? (distributedUnion: Union) => void : never
) extends (mergedIntersection: infer Intersection) => void
  ? Intersection & Union
  : never;

export type CombinedNestedClient<Entities extends Entity<any, any, any, any, any, any>[]> =
  UnionToIntersection<
    ValuesOf<{
      [EntityKey in Entities[number]['entity']['id']]: NestedEntityClient<
        Extract<Entities[number], { entity: { id: EntityKey } }>
      >;
    }>
  >;
