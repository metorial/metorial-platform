import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Input, Spacer } from '@metorial/ui';
import { useSearchFilter } from '../../../../../hooks/useSearchFilter';
import { IdentitiesTable } from '../../../scenes/identity/identitiesTable';

export let IdentitiesPage = () => {
  let instance = useCurrentInstance();
  let { search, setSearch, searchQuery } = useSearchFilter();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Input
        label="Search"
        hideLabel
        placeholder="Search identities..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <Spacer size={15} />

      <IdentitiesTable instanceId={instance.data.id} filters={{ search: searchQuery }} />
    </>
  ));
};
