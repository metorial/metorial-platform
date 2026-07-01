import {
  ActionType,
  BaseState,
  EntityRequest,
  IAction,
  IEntity,
  MergeEntities,
  MethodType,
  ParentEntities,
  methodToType
} from '../types';
import { EntityProvider } from './entityProvider';

export class Entity<
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
> {
  constructor(
    public provider: EntityProvider<State, Request>,
    public parent: Entity<Parent, string, any, Request, State, {}> | undefined,
    public entity: IEntity<Parent, ID, EntityType, Request, State, Actions>
  ) {}

  subEntity<SubID extends string, SubEntityType>({
    id,
    name,
    provider
  }: {
    id: SubID;
    name: string;
    provider: any;
  }) {
    return this.provider.entity<SubID, SubEntityType, typeof this.entity>({
      id,
      name,
      provider,
      parent: this as any
    });
  }

  action<
    ActionKey extends string,
    Type extends ActionType,
    Input,
    Value,
    NeedsProvider extends boolean
  >(
    actionKey: ActionKey,
    action: IAction<
      MergeEntities<Parent, ID, EntityType>,
      ParentEntities<Parent>,
      Type,
      State,
      Input,
      NeedsProvider,
      Value,
      Request
    >
  ) {
    return new Entity<
      Parent,
      ID,
      EntityType,
      Request,
      State,
      Actions & { [key in ActionKey]: typeof action }
    >(this.provider, this.parent, {
      ...this.entity,
      actions: {
        ...this.entity.actions,
        [actionKey]: action
      }
    } as any);
  }

  public retrieve(
    rawPath: string[],
    method: MethodType,
    rawIDs: Record<string, string>
  ):
    | {
        entity: IEntity<any, any, any, any, any, any>;
        action: IAction<any, any, any, any, any, any, any, any> | null;
        path: string[];
        needsProvider: boolean;
        ids: Record<string, string | undefined>;
      }[]
    | null {
    let { entity, parent } = this;

    let parentRes = parent?.retrieve(rawPath, method, rawIDs) ?? [];
    let res = parent ? parentRes : [{ ids: rawIDs, path: rawPath }];

    if (!res || !res.length) return null;

    let { ids, path } = res[res.length - 1];
    if (!path.length || path[0] != entity.id) return null;

    if (path.length == 1) {
      let actionTypes = methodToType[method];
      let action = Object.values(entity.actions).find(
        action => actionTypes.includes(action.type) && !action.needsProvider
      );

      if (action) {
        return [
          ...parentRes,
          {
            entity,
            action: action as any,
            needsProvider: false,
            path: [],
            ids
          }
        ];
      }

      return null;
    }

    if (path.length == 2) {
      let action: any = entity.actions[path[1]];

      let noDirectCall = !action || action.type != 'special' || action.needsProvider;
      if (noDirectCall) {
        let actionTypes = methodToType[method];
        action = Object.values(entity.actions).find(
          action => actionTypes.includes(action.type) && action.needsProvider
        );
      }

      if (action) {
        return [
          ...parentRes,
          {
            entity,
            action: action as any,
            path: [],
            needsProvider: noDirectCall,
            ids: {
              ...ids,
              [`${entity.id}Id`]: noDirectCall ? path[1] : undefined
            }
          }
        ];
      }

      return null;
    }

    if (path.length == 3) {
      let action = entity.actions[path[2]];
      if (action && action.type == 'special' && action.needsProvider) {
        return [
          ...parentRes,
          {
            entity,
            action: action as any,
            path: [],
            needsProvider: true,
            ids: {
              ...ids,
              [`${entity.id}Id`]: path[1]
            }
          }
        ];
      }

    }

    return [
      ...parentRes,
      {
        entity,
        action: null,
        path: path.slice(1),
        needsProvider: true,
        ids: {
          ...ids,
          [`${entity.id}Id`]: path[1]
        }
      }
    ];
  }
}
