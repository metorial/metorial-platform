import type {
  DashboardInstanceAgentTrackingSettingsGetOutput,
  DashboardOrganizationsConfigureAgentTrackingGetOutput,
  DashboardProjectsConfigureAgentTrackingGetOutput
} from '@metorial/dashboard-sdk';
import { renderWithLoader, useForm } from '@metorial/data-hooks';
import {
  useAgentTrackingInstanceSettings,
  useAgentTrackingOrganizationSettings,
  useAgentTrackingProjectSettings
} from '@metorial/state';
import { Button, Callout, Flex, NumberInput, Switch, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import React from 'react';
import { useAgentTrackingSettingsAccess } from './access';
import { agentTrackingErrorStatus, AgentTrackingErrorState, notSetUpText } from './errorState';
import { WithInfo } from './info';

let minGroupUsersRange = { min: 3, max: 100 };

let retentionDaysRange = { min: 1, max: 3650 };

type OrganizationSettings = DashboardOrganizationsConfigureAgentTrackingGetOutput;
type ProjectSettings = DashboardProjectsConfigureAgentTrackingGetOutput;
type InstanceSettings = DashboardInstanceAgentTrackingSettingsGetOutput;

let SettingsSection = ({
  title,
  description,
  form,
  update,
  canWrite,
  readOnlyText,
  children
}: {
  title: string;
  description: string;
  readOnlyText: string;
  form: {
    handleSubmit: (event?: React.FormEvent<HTMLFormElement>) => void;
    canSubmit: boolean;
  };
  update: {
    isLoading: boolean;
    isSuccess: boolean;
    RenderError: () => React.ReactElement | null;
  };
  canWrite: boolean;
  children: React.ReactNode;
}) => (
  <Box title={<WithInfo info={description}>{title}</WithInfo>}>
    <form onSubmit={form.handleSubmit}>
      <Flex direction="column" gap={18}>
        {children}

        {canWrite ? (
          <Button
            size="2"
            type="submit"
            style={{ alignSelf: 'flex-start' }}
            disabled={!form.canSubmit}
            loading={update.isLoading}
            success={update.isSuccess}
          >
            Save
          </Button>
        ) : (
          <Text size="2" color="gray600">
            {readOnlyText}
          </Text>
        )}
        <update.RenderError />
      </Flex>
    </form>
  </Box>
);

let PrivacySection = ({
  settings,
  canWrite
}: {
  settings: OrganizationSettings;
  canWrite: boolean;
}) => {
  let update = useAgentTrackingOrganizationSettings(
    settings.organizationId
  ).useUpdateMutator();
  let form = useForm({
    initialValues: {
      hideIndividuals: settings.privacy.hideIndividuals,
      minGroupUsers: settings.privacy.minGroupUsers as number | null
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await update.mutate({
        privacy: {
          hideIndividuals: values.hideIndividuals,
          minGroupUsers: values.minGroupUsers ?? undefined
        }
      });
    },
    schema: yup =>
      yup.object({
        hideIndividuals: yup.boolean(),
        minGroupUsers: yup
          .number()
          .nullable()
          .typeError('Enter a number')
          .integer('Enter a whole number')
          .min(minGroupUsersRange.min, `At least ${minGroupUsersRange.min} people`)
          .max(minGroupUsersRange.max, `At most ${minGroupUsersRange.max} people`)
          .when('hideIndividuals', {
            is: true,
            then: schema => schema.required('Enter a group size')
          })
      })
  });

  return (
    <SettingsSection
      title="Privacy"
      description="Applies to every project and environment of this organization."
      form={form}
      update={update}
      canWrite={canWrite}
      readOnlyText="Only organization admins can change these settings."
    >
      <Switch
        label={
          <WithInfo info="Shows only daily totals of whole UTC days, without sessions, members, filters or breakdowns, while the data is still stored per person.">
            Hide Individuals
          </WithInfo>
        }
        checked={form.values.hideIndividuals}
        disabled={!canWrite}
        onCheckedChange={checked => form.setFieldValue('hideIndividuals', checked)}
      />

      <NumberInput
        label={
          <WithInfo info="With Hide Individuals, days with fewer people than this are hidden.">
            Minimum Group Size
          </WithInfo>
        }
        unit="people"
        min={minGroupUsersRange.min}
        max={minGroupUsersRange.max}
        value={form.values.minGroupUsers}
        disabled={!canWrite || !form.values.hideIndividuals}
        onChange={value => form.setFieldValue('minGroupUsers', value)}
        onBlur={() => form.setFieldTouched('minGroupUsers', true)}
      />
      <form.RenderError field="minGroupUsers" />
    </SettingsSection>
  );
};

let retentionFields = [
  {
    id: 'recordDays',
    defaultId: 'defaultRecordDays',
    label: 'Raw Records',
    description: 'The events agents send'
  },
  {
    id: 'usageDays',
    defaultId: 'defaultUsageDays',
    label: 'Sessions and Usage',
    description: 'What Spend and Sessions show'
  }
] as const;

let RetentionSection = ({
  settings,
  canWrite
}: {
  settings: ProjectSettings;
  canWrite: boolean;
}) => {
  let update = useAgentTrackingProjectSettings(
    settings.organizationId,
    settings.projectId
  ).useUpdateMutator();
  let form = useForm({
    initialValues: {
      recordDays: settings.retention.recordDays,
      usageDays: settings.retention.usageDays
    },
    updateInitialValues: true,
    onSubmit: async retention => {
      await update.mutate({ retention });
    },
    schema: yup => {
      let days = yup
        .number()
        .nullable()
        .typeError('Enter a number')
        .integer('Enter a whole number')
        .min(retentionDaysRange.min, `At least ${retentionDaysRange.min} day`)
        .max(retentionDaysRange.max, `At most ${retentionDaysRange.max} days`);

      return yup.object({ recordDays: days, usageDays: days });
    }
  });

  return (
    <SettingsSection
      title="Retention"
      description="Applies to every environment of this project, for data that arrives after a change."
      form={form}
      update={update}
      canWrite={canWrite}
      readOnlyText="Only members who can manage projects can change these settings."
    >
      {retentionFields.map(field => (
        <Flex key={field.id} direction="column" gap={4}>
          <NumberInput
            label={
              <WithInfo
                info={`${field.description}, ${settings.retention[field.defaultId]} days by default.`}
              >
                {field.label}
              </WithInfo>
            }
            unit="days"
            min={retentionDaysRange.min}
            max={retentionDaysRange.max}
            placeholder={`Default (${settings.retention[field.defaultId]})`}
            value={form.values[field.id]}
            disabled={!canWrite}
            onChange={value => form.setFieldValue(field.id, value)}
            onBlur={() => form.setFieldTouched(field.id, true)}
          />
          <form.RenderError field={field.id} />
        </Flex>
      ))}
    </SettingsSection>
  );
};

let ClassificationSection = ({
  settings,
  environmentName,
  canWrite
}: {
  settings: InstanceSettings;
  environmentName: string;
  canWrite: boolean;
}) => {
  let update = useAgentTrackingInstanceSettings(settings.instanceId).useUpdateMutator();
  let form = useForm({
    initialValues: {
      deterministicEnabled: settings.classification.deterministicEnabled,
      aiEnabled: settings.classification.aiEnabled
    },
    updateInitialValues: true,
    onSubmit: async classification => {
      await update.mutate({ classification });
    }
  });

  return (
    <SettingsSection
      title="Classification"
      description={`Applies to the selected environment, ${environmentName}: how its sessions are matched to your projects, teams and cost centers.`}
      form={form}
      update={update}
      canWrite={canWrite}
      readOnlyText="Only organization admins can change these settings."
    >
      <Switch
        label={
          <WithInfo info="Matches sessions by ticket references such as ENG-123 and by earlier matches of the same repository, without external calls.">
            Rule-Based Classification
          </WithInfo>
        }
        checked={form.values.deterministicEnabled}
        disabled={!canWrite}
        onCheckedChange={checked => form.setFieldValue('deterministicEnabled', checked)}
      />

      <Switch
        label={
          <WithInfo info="Sends session context, such as repository, branch, ticket references and team names to a hosted model that may run outside your organization's region.">
            Hosted Model Classification
          </WithInfo>
        }
        checked={form.values.aiEnabled}
        disabled={!canWrite}
        onCheckedChange={checked => form.setFieldValue('aiEnabled', checked)}
      />
    </SettingsSection>
  );
};

let serviceStatusText = {
  pending:
    'Agent Usage has not received these settings yet and applies the previous ones until it does.',
  unknown: 'Agent Usage could not confirm these settings, so it may still apply earlier ones.'
};

export let AgentTrackingSettings = ({
  organizationId,
  projectId,
  instanceId,
  environmentName
}: {
  organizationId: string;
  projectId: string;
  instanceId: string;
  environmentName: string;
}) => {
  let organization = useAgentTrackingOrganizationSettings(organizationId);
  let project = useAgentTrackingProjectSettings(organizationId, projectId);
  let instance = useAgentTrackingInstanceSettings(instanceId);
  let access = useAgentTrackingSettingsAccess();

  let levels = [organization, project, instance];
  let statuses = levels.map(level => level.data?.serviceStatus);
  let serviceStatus: keyof typeof serviceStatusText | null = statuses.includes('pending')
    ? 'pending'
    : statuses.includes('unknown')
      ? 'unknown'
      : null;

  let errorState = (level: (typeof levels)[number]) => ({
    error: (error: any) => <AgentTrackingErrorState error={error} onRetry={level.refetch} />
  });

  if (levels.some(level => agentTrackingErrorStatus(level.error) == 404)) {
    return (
      <Callout color="gray">
        {notSetUpText} Its settings become available once Metorial enables it.
      </Callout>
    );
  }

  return (
    <Flex direction="column" gap={20}>
      {serviceStatus ? (
        <Callout
          color="orange"
          action={
            <Button
              size="2"
              variant="outline"
              onClick={() => levels.forEach(level => level.refetch())}
            >
              Check Again
            </Button>
          }
        >
          {serviceStatusText[serviceStatus]}
        </Callout>
      ) : null}

      {renderWithLoader(
        { organization },
        errorState(organization)
      )(({ organization }) => (
        <PrivacySection settings={organization.data} canWrite={access.privacy} />
      ))}
      {renderWithLoader(
        { project },
        errorState(project)
      )(({ project }) => (
        <RetentionSection settings={project.data} canWrite={access.retention} />
      ))}
      {renderWithLoader(
        { instance },
        errorState(instance)
      )(({ instance }) => (
        <ClassificationSection
          settings={instance.data}
          environmentName={environmentName}
          canWrite={access.instance}
        />
      ))}
    </Flex>
  );
};
