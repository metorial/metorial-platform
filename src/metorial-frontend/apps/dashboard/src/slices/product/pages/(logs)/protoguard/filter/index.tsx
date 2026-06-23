import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { useCurrentInstance, useProtoGuardConfig } from '@metorial/state';
import { Button, Flex, Input, Switch } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { ProtoGuardSeverityBadge } from '../../../../scenes/monitoring/badges';

type ProtoGuardFilter = {
  id: string;
  issueType: string;
  severity: string;
  scoreWeight: number;
  alertConfidenceThreshold: number | null;
  defaultAlertConfidenceThreshold: number;
};

let PageWrapper = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

let SettingsForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 560px;
`;

let parseOptionalNumber = (value: unknown) => {
  let stringValue = String(value ?? '').trim();
  return stringValue === '' ? null : Number(stringValue);
};

export let ProtoGuardFilterSettingsPage = () => {
  let instance = useCurrentInstance();
  let config = useProtoGuardConfig(instance.data?.id);
  let updateFilter = config.updateFilterMutator();
  let { filterId } = useParams();
  let filter = config.data?.filters.find((item: ProtoGuardFilter) => item.id === filterId);

  let form = useForm({
    initialValues: {
      enabled: filter?.enabled ?? false,
      alertConfidenceThreshold: String(filter?.alertConfidenceThreshold ?? '')
    },
    updateInitialValues: true,
    onSubmit: async values => {
      if (!filterId) return;

      await updateFilter.mutate({
        filterId,
        enabled: values.enabled,
        alertConfidenceThreshold: parseOptionalNumber(values.alertConfidenceThreshold)
      });
    },
    schema: yup =>
      yup.object({
        enabled: yup.boolean().required(),
        alertConfidenceThreshold: yup.string()
      })
  });

  return renderWithLoader({ config })(({ config }) => {
    let filter = config.data.filters.find((item: ProtoGuardFilter) => item.id === filterId);
    if (!filter) return null;

    return (
      <PageWrapper>
        <Box
          title="Settings"
          description="Configure whether this filter can create ProtoGuard alerts and which confidence threshold it should use."
        >
          <SettingsForm onSubmit={form.handleSubmit}>
            <Switch
              label="Enabled"
              description="Enable this filter for ProtoGuard alert creation."
              checked={form.values.enabled}
              onCheckedChange={checked => form.setFieldValue('enabled', checked)}
            />
            <form.RenderError field="enabled" />

            <Input
              label="Alert confidence threshold"
              description="Leave empty to clear the override and use the default threshold."
              type="number"
              min={0}
              max={1}
              step="0.01"
              {...form.getFieldProps('alertConfidenceThreshold')}
            />
            <form.RenderError field="alertConfidenceThreshold" />

            <Flex>
              <Button
                type="submit"
                size="2"
                loading={updateFilter.isLoading}
                success={updateFilter.isSuccess}
              >
                Save filter
              </Button>
            </Flex>
            <updateFilter.RenderError />
          </SettingsForm>
        </Box>

        <Box title="Reference">
          <Table
            headers={[
              'Severity',
              'Issue type',
              'Current threshold',
              'Default threshold',
              'Weight'
            ]}
            data={[
              [
                <ProtoGuardSeverityBadge severity={filter.severity} />,
                filter.issueType,
                filter.alertConfidenceThreshold ?? 'Default',
                filter.defaultAlertConfidenceThreshold,
                filter.scoreWeight
              ]
            ]}
          />
        </Box>
      </PageWrapper>
    );
  });
};
