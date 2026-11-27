import { EmptyState } from '@metorial/empty-state';
import { CallbacksList } from '../../../scenes/callbacks/callbacksTable';

export let CallbacksPage = () => (
  <CallbacksList
    emptyState={{
      initial: () => (
        <EmptyState
          extra="Callbacks"
          title="Enable callbacks for an integration"
          description="Callbacks let providers notify your application when interesting events happen, like new messages or status changes."
        />
      ),
      filtered: 'No callbacks match your filters.'
    }}
  />
);
