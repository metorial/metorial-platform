import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Input, Spacer } from '@metorial/ui';
import { useSearchFilter } from '@metorial/use-search-filter';
import { ChatConnectionsGrid } from '../../../scenes/chat/connectionsGrid';

export let ChatConnectionsPage = () => {
  let instance = useCurrentInstance();
  let { search, setSearch, searchQuery } = useSearchFilter(500);

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Input
        label="Search"
        hideLabel
        size="2"
        placeholder="Search chat connections..."
        value={search}
        onInput={setSearch}
      />

      <Spacer size={15} />

      <ChatConnectionsGrid instanceId={instance.data.id} search={searchQuery} />
    </>
  ));
};
