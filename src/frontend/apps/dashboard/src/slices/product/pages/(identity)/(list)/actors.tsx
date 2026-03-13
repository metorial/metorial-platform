import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Input, Spacer } from '@metorial/ui';
import { useSearchFilter } from '../../../../../hooks/useSearchFilter';
import { IdentityActorsTable } from '../../../scenes/identity/actorsTable';

export let IdentityActorsPage = () => {
  let instance = useCurrentInstance();
  let { search, setSearch, searchQuery } = useSearchFilter();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Input
        label="Search"
        hideLabel
        placeholder="Search identity actors..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <Spacer size={15} />

      <IdentityActorsTable instanceId={instance.data.id} filters={{ search: searchQuery }} />
    </>
  ));
};
