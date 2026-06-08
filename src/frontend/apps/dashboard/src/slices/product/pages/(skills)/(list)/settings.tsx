import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { useCurrentInstance, useDefaultSkillConfiguration } from '@metorial/state';
import { Button, Spacer, Switch, TextArrayInput } from '@metorial/ui';
import { Box } from '@metorial/ui-product';

export let SkillConfigurationSettingsPage = () => {
  let instance = useCurrentInstance();
  let skillConfiguration = useDefaultSkillConfiguration(instance.data?.id);
  let updateMutator = skillConfiguration.updateMutator();

  let form = useForm({
    initialValues: {
      allowScripts: skillConfiguration.data?.allowScripts ?? false,
      allowAllFileExtensions:
        (skillConfiguration.data?.allowedFileExtensions ?? []).length === 0,
      allowedFileExtensions: skillConfiguration.data?.allowedFileExtensions ?? [],
      allowNonStandardDirectories:
        skillConfiguration.data?.allowNonStandardDirectories ?? false
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateMutator.mutate({
        allowScripts: values.allowScripts,
        allowedFileExtensions: values.allowAllFileExtensions
          ? null
          : values.allowedFileExtensions
              .map((extension: string) => extension.trim())
              .filter(Boolean),
        allowNonStandardDirectories: values.allowNonStandardDirectories
      });
    },
    schema: yup =>
      yup.object({
        allowScripts: yup.boolean().required(),
        allowAllFileExtensions: yup.boolean().required(),
        allowedFileExtensions: yup.array().of(yup.string()).required(),
        allowNonStandardDirectories: yup.boolean().required()
      })
  });

  return renderWithLoader({ instance, skillConfiguration })(() => (
    <Box
      title="Default Skill Configuration"
      description="Configure the default execution policy used by skills in this instance."
    >
      <form onSubmit={form.handleSubmit}>
        <Switch
          label="Allow scripts"
          description="Allow skills to include and execute script files."
          checked={form.values.allowScripts}
          onCheckedChange={checked => form.setFieldValue('allowScripts', checked)}
        />
        <form.RenderError field="allowScripts" />

        <Spacer size={15} />

        <Switch
          label="Allow non-standard directories"
          description="Allow skill files to live outside the standard skill directory structure."
          checked={form.values.allowNonStandardDirectories}
          onCheckedChange={checked =>
            form.setFieldValue('allowNonStandardDirectories', checked)
          }
        />
        <form.RenderError field="allowNonStandardDirectories" />

        <Spacer size={15} />

        <Switch
          label="Allow all file extensions"
          description="Allow skill files with any extension. Disable this to restrict uploads to a specific list."
          checked={form.values.allowAllFileExtensions}
          onCheckedChange={checked => form.setFieldValue('allowAllFileExtensions', checked)}
        />
        <form.RenderError field="allowAllFileExtensions" />

        {!form.values.allowAllFileExtensions && (
          <>
            <Spacer size={15} />

            <TextArrayInput
              label="Allowed file extensions"
              description="Restrict skill files to these extensions. Include .md for skill markdown files."
              placeholder=".md"
              value={form.values.allowedFileExtensions}
              onChange={value => form.setFieldValue('allowedFileExtensions', value)}
            />
            <form.RenderError field="allowedFileExtensions" />
          </>
        )}

        <Spacer size={15} />

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="2"
            type="submit"
            loading={updateMutator.isLoading}
            success={updateMutator.isSuccess}
          >
            Save
          </Button>
        </div>

        <updateMutator.RenderError />
      </form>
    </Box>
  ));
};
