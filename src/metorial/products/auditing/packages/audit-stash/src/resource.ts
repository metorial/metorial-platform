import { type ValidationType, type ValidationTypeValue } from '@lowerdeck/validation';
import { DeclaredPresenter, GetTypeOfPresentable, PresentableType } from '@metorial/presenter';

export type ResourcePresenter<
  Type extends PresentableType<any, any> = PresentableType<any, any>
> = Pick<DeclaredPresenter<Type>, 'type' | 'present'>;

export interface ResourceDefinition<
  ResourceName extends string,
  MainSchema extends ValidationType<any>,
  SubSchemas extends Record<string, ValidationType<any>>,
  Presenter extends ResourcePresenter | undefined
> {
  name: ResourceName;
  payload: MainSchema;
  presenter: Presenter;
  actions: {
    [key in keyof SubSchemas]: true | { validationType: SubSchemas[key] } | true;
  };
}

type IsEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type EnsurePresenterPayloadMatches<T extends ResourceDefinition<string, any, any, any>> =
  T extends { presenter: ResourcePresenter<infer PresenterType> }
    ? IsEqual<
        ValidationTypeValue<T['payload']>,
        GetTypeOfPresentable<PresenterType>
      > extends true
      ? unknown
      : { presenter: never }
    : unknown;

export type ResourceActions<T extends ResourceDefinition<string, any, any, any>> = {
  [key in keyof T['actions']]: T['actions'][key] extends { validationType: infer V }
    ? V
    : T['payload'];
};

export type ResourceActionNames<T extends ResourceDefinition<string, any, any, any>> =
  keyof T['actions'];

export type ResourcePayloadValidator<
  T extends ResourceDefinition<string, any, any, any>,
  A extends ResourceActionNames<T>
> = T['actions'][A] extends { validationType: infer V } ? V : T['payload'];

export type ResourcePayload<
  T extends ResourceDefinition<string, any, any, any>,
  A extends ResourceActionNames<T>
> = ValidationTypeValue<ResourcePayloadValidator<T, A>>;

export let resource = <T extends ResourceDefinition<string, any, any, any>>(
  definition: T & EnsurePresenterPayloadMatches<T>
) => definition;

export type ResourceSet<T extends Record<string, ResourceDefinition<string, any, any, any>>> =
  {
    [key in keyof T]: T[key];
  };

export type ResourceSetNames<
  T extends Record<string, ResourceDefinition<string, any, any, any>>
> = keyof T;

export type ResourceSetItemActionNames<
  T extends Record<string, ResourceDefinition<string, any, any, any>>,
  R extends ResourceSetNames<T>
> = ResourceActionNames<T[R]>;

export type ResourceSetItemPayload<
  T extends Record<string, ResourceDefinition<string, any, any, any>>,
  R extends ResourceSetNames<T>,
  A extends ResourceSetItemActionNames<T, R>
> = ResourcePayload<T[R], A>;

export let resourceSet = <T extends Record<string, ResourceDefinition<string, any, any, any>>>(
  resources: T
) => resources;

export let combineResourceSets = <
  T extends Record<string, ResourceDefinition<string, any, any, any>>
>(
  ...resourceSets: T[]
) => Object.assign({}, ...resourceSets) as T;
