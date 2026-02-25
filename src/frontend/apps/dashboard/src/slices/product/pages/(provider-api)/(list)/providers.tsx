import { useForm } from '@metorial/data-hooks';
import { Input, Spacer } from '@metorial/ui';
import { useDebounced } from '../../../../../hooks/useDebounced';
import { ServersGrid } from '../../../scenes/servers/grid';

export let ProvidersPage = () => {
  let form = useForm({
    initialValues: {
      search: ''
    },
    onSubmit: async () => {},
    schema: yup =>
      yup.object({
        search: yup.string().defined()
      })
  });
  let searchDebounced = useDebounced(form.values.search, 500);

  return (
    <>
      <Input
        label="Search"
        hideLabel
        placeholder="Search for providers..."
        {...form.getFieldProps('search')}
      />

      <Spacer size={15} />

      <ServersGrid search={searchDebounced} limit={21} />
    </>
  );
};
