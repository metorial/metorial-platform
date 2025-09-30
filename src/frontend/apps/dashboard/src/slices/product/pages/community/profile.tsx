import { renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { useCurrentOrganization, useProfile } from '@metorial/state';
import { Input } from '@metorial/ui';
import { FormBox } from '../../scenes/form/box';
import { Field } from '../../scenes/form/field';

export let CommunityProfilePage = () => {
  let org = useCurrentOrganization();
  let profile = useProfile(org.data?.id);
  let updateMutator = profile.useUpdateMutator();

  return (
    <ContentLayout>
      <PageHeader
        title="Profile"
        description="Edit your Metorial community profile. If you publish servers, this information will be visible to other Metorial users."
      />

      {renderWithLoader({
        profile
      })(({ profile }) => (
        <>
          <FormBox
            title="General Information"
            description="This information should describe your organization to other Metorial users."
            schema={yup =>
              yup.object({
                name: yup.string().optional(),
                description: yup.string().optional()
              })
            }
            initialValues={{
              name: profile.data?.name || '',
              description: profile.data?.description || ''
            }}
            mutators={[updateMutator]}
            onSubmit={async values => {
              await updateMutator.mutate({
                name: values.name,
                description: values.description
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
        </>
      ))}
    </ContentLayout>
  );
};
