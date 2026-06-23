import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentOrganization, useCurrentProjects } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { useNavigate } from 'react-router-dom';

export let WelcomeCreateProjectScene = () => {
  let projects = useCurrentProjects();
  let org = useCurrentOrganization();
  let create = projects.createMutator();

  let navigate = useNavigate();

  let form = useForm({
    initialValues: {
      name: ''
    },
    onSubmit: async values => {
      let [res] = await create.mutate(values);
      if (res) navigate(Paths.project(org.data!, res));
    },
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required')
      })
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <Input label="Name" placeholder="My Cool Project" {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Spacer size={10} />

      <Button type="submit" loading={create.isLoading} success={create.isSuccess}>
        Continue
      </Button>

      <create.RenderError />
    </form>
  );
};
