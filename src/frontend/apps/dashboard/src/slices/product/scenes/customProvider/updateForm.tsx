import { CustomProvidersGetOutput } from '@metorial/dashboard-sdk';
import {
  useCurrentInstance,
  useCustomProvider
} from '@metorial/state';
import { Input } from '@metorial/ui';
import { FormBox } from '../form/box';
import { Field } from '../form/field';
import { FormPage } from '../form/page';

export let CustomServerUpdateForm = (p: { customServer?: CustomProvidersGetOutput }) => {
  let instance = useCurrentInstance();
  let customServer = useCustomProvider(instance.data?.id, p.customServer?.id);

  let updateMutator = customServer.useUpdateMutator();

  return (
    <FormPage>
      <FormBox
        title="General"
        description="Update the details of your custom provider."
        schema={yup =>
          yup.object({
            name: yup.string().optional(),
            description: yup.string().optional()
          })
        }
        initialValues={{
          name: customServer.data?.name ?? '',
          description: customServer.data?.description ?? ''
        }}
        mutators={[updateMutator]}
        onSubmit={async values => {
          if (!instance.data) return;

          await updateMutator.mutate({
            name: values.name || undefined,
            description: values.description || undefined
          });
        }}
      >
        <Field field="name">
          {({ getFieldProps }) => <Input {...getFieldProps()} label="Name" />}
        </Field>

        <Field field="description">
          {({ getFieldProps }) => <Input {...getFieldProps()} label="Description" />}
        </Field>
      </FormBox>
    </FormPage>
  );
};
