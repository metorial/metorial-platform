import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { useCurrentInstance, useProtoGuardConfig } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';

let parseOptionalNumber = (value: unknown) => {
  let stringValue = String(value ?? '').trim();
  return stringValue === '' ? null : Number(stringValue);
};

let ThresholdForm = ({ config }: { config: ReturnType<typeof useProtoGuardConfig> }) => {
  let mutator = config.setAlertFilterCountThresholdMutator();
  let form = useForm({
    initialValues: {
      threshold: String(config.data?.alertFilterCountThreshold ?? '')
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await mutator.mutate({
        threshold: parseOptionalNumber(values.threshold)
      });
    },
    schema: yup =>
      yup.object({
        threshold: yup.string()
      })
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <Input
        label="Alert filter count threshold"
        type="number"
        min={0}
        placeholder="Number of matching filters"
        {...form.getFieldProps('threshold')}
      />
      <form.RenderError field="threshold" />

      <Spacer height={15} />

      <Button type="submit" size="2" loading={mutator.isLoading} success={mutator.isSuccess}>
        Save
      </Button>
      <mutator.RenderError />
    </form>
  );
};

export let ProtoGuardSettingsPage = () => {
  let instance = useCurrentInstance();
  let config = useProtoGuardConfig(instance.data?.id);

  return renderWithLoader({ config })(({ config: loadedConfig }) => (
    <Box
      title="Alert threshold"
      description={`Create an alert when this many filters match. Current value: ${
        loadedConfig.data.alertFilterCountThreshold ?? 'not configured'
      }.`}
    >
      <ThresholdForm config={config} />
    </Box>
  ));
};
