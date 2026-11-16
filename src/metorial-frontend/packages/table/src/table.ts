import {
  DataList,
  type TableActions,
  type TableStateProviderResult
} from '@metorial/data-list';

export class Table<
  StateProps extends object = {},
  Item extends { id: string } = any,
  HooksState = {},
  Actions extends TableActions<Item, HooksState> = {},
  StateResult extends TableStateProviderResult<Item> = any
> extends DataList<StateProps, Item, HooksState, Actions, StateResult> {
  constructor(name: string, opts?: { hasPagination?: boolean; customizable?: boolean }) {
    super(name, opts);
    this.layouts(['table']);
  }
}
