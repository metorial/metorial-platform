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
import { Button, Callout, Flex, NumberInput, Select, Switch, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import React from 'react';
import { useAgentTrackingSettingsAccess } from './access';
import { AgentTrackingErrorState } from './errorState';

let minGroupUsersRange = { min: 3, max: 100 };

let retentionDaysRange = { min: 1, max: 3650 };

let contentModes = [
  {
    id: 'basic',
    label: 'Basic',
    text: 'Keeps only the length of prompts, responses and tool calls, and a keyed hash that tells repeats apart. No text is stored.'
  },
  {
    id: 'shape',
    label: 'Shape',
    text: 'Keeps what Basic keeps, plus a structured summary of each item without its values, such as which fields a tool call had.'
  },
  {
    id: 'full',
    label: 'Full',
    text: 'Keeps what Shape keeps, plus the text itself, encrypted, and the paths of workspaces. Stored text is deleted after the content retention.'
  }
] as const;

type OrganizationSettings = DashboardOrganizationsConfigureAgentTrackingGetOutput;
type ProjectSettings = DashboardProjectsConfigureAgentTrackingGetOutput;
type InstanceSettings = DashboardInstanceAgentTrackingSettingsGetOutput;

type UpdateMutator<Body> = {
  mutate: (body: Body) => Promise<unknown>;
  isLoading: boolean;
  isSuccess: boolean;
  RenderError: () => React.ReactElement | null;
};

type FormSchema<Values extends {}> = Extract<
  Parameters<typeof useForm<Values, any>>[0],
  { schema: unknown }
>['schema'];

let useSettingsForm = <Values extends {}, Body>(
  update: UpdateMutator<Body>,
  toBody: (values: Values) => Body,
  options: { initialValues: Values; schema?: FormSchema<Values> }
) =>
  useForm<Values, any>({
    initialValues: options.initialValues,
    schema: options.schema ?? (yup => yup.object({})),
    updateInitialValues: true,
    onSubmit: async values => {
      await update.mutate(toBody(values));
    }
  });

let SettingsSection = ({
  title,
  description,
  form,
  update,
  canWrite,
  children
}: {
  title: string;
  description: string;
  form: {
    handleSubmit: (event?: React.FormEvent<HTMLFormElement>) => void;
    canSubmit: boolean;
  };
  update: UpdateMutator<never>;
  canWrite: boolean;
  children: React.ReactNode;
}) => (
  <Box title={title} description={description}>
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
        ) : null}
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
  let form = useSettingsForm(
    update,
    values => ({
      privacy: {
        hideIndividuals: values.hideIndividuals,
        minGroupUsers: values.minGroupUsers ?? undefined
      }
    }),
    {
      initialValues: {
        hideIndividuals: settings.privacy.hideIndividuals,
        minGroupUsers: settings.privacy.minGroupUsers as number | null
      },
      schema: yup =>
        yup.object({
          hideIndividuals: yup.boolean(),
          minGroupUsers: yup
            .number()
            .typeError('Enter a number')
            .integer('Enter a whole number')
            .min(minGroupUsersRange.min, `At least ${minGroupUsersRange.min} people`)
            .max(minGroupUsersRange.max, `At most ${minGroupUsersRange.max} people`)
            .required('Enter a group size')
        })
    }
  );

  return (
    <SettingsSection
      title="Privacy"
      description="Applies to every project and instance of this organization."
      form={form}
      update={update}
      canWrite={canWrite}
    >
      <Switch
        label="Hide Individuals"
        description="Show agent usage only as daily totals of whole UTC days. The session list and details, the members seen, filters and the breakdown by member or model are no longer available to anyone. The data is still stored per person, and turning this off is audited."
        checked={form.values.hideIndividuals}
        disabled={!canWrite}
        onCheckedChange={checked => form.setFieldValue('hideIndividuals', checked)}
      />

      <NumberInput
        label="Minimum Group Size"
        description="With Hide Individuals, a day with fewer people with usage than this is shown as hidden instead of its figures. At least 3, as with two people either one could subtract their own usage."
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
    description: 'The events agents send, as they arrived.'
  },
  {
    id: 'contentDays',
    defaultId: 'defaultContentDays',
    label: 'Stored Content',
    description: 'Text and paths the content policy keeps.'
  },
  {
    id: 'usageDays',
    defaultId: 'defaultUsageDays',
    label: 'Sessions and Usage',
    description: 'The sessions and the figures Spend and Sessions show.'
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
  let form = useSettingsForm(update, retention => ({ retention }), {
    initialValues: {
      recordDays: settings.retention.recordDays,
      contentDays: settings.retention.contentDays,
      usageDays: settings.retention.usageDays
    },
    schema: yup => {
      let days = yup
        .number()
        .nullable()
        .typeError('Enter a number')
        .integer('Enter a whole number')
        .min(retentionDaysRange.min, `At least ${retentionDaysRange.min} day`)
        .max(retentionDaysRange.max, `At most ${retentionDaysRange.max} days`);

      return yup.object({ recordDays: days, contentDays: days, usageDays: days });
    }
  });

  return (
    <SettingsSection
      title="Retention"
      description="How long agent usage is kept, for every instance of this project. Applies to data that arrives after the change: data already stored keeps the expiry it was written with, so lowering a value deletes nothing now and raising it does not keep older data longer. Stored content never outlives its raw records. Leave a field empty to use the default."
      form={form}
      update={update}
      canWrite={canWrite}
    >
      {retentionFields.map(field => (
        <Flex key={field.id} direction="column" gap={4}>
          <NumberInput
            label={field.label}
            description={`${field.description} Default: ${settings.retention[field.defaultId]} days.`}
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

let ContentSection = ({
  settings,
  canWrite
}: {
  settings: InstanceSettings;
  canWrite: boolean;
}) => {
  let update = useAgentTrackingInstanceSettings(settings.instanceId).useUpdateMutator();
  let form = useSettingsForm(
    update,
    values => ({ content: { mode: values.mode as InstanceSettings['content']['mode'] } }),
    { initialValues: { mode: settings.content.mode as string } }
  );

  return (
    <SettingsSection
      title="Content"
      description="What this instance keeps of prompts, responses and tool calls, for data that arrives after the change. New keys follow this setting; keys created before it was available keep Basic and need to be created again to follow it."
      form={form}
      update={update}
      canWrite={canWrite}
    >
      <Select
        label="Content Policy"
        value={form.values.mode}
        disabled={!canWrite}
        onChange={value => form.setFieldValue('mode', value)}
        items={contentModes.map(mode => ({ id: mode.id, label: mode.label }))}
      />

      <Flex direction="column" gap={8}>
        {contentModes.map(mode => (
          <Text key={mode.id} size="2" color="gray700">
            <Text as="span" size="2" weight="strong" color="gray900">
              {mode.label}:
            </Text>{' '}
            {mode.text}
          </Text>
        ))}
      </Flex>
    </SettingsSection>
  );
};

let ClassificationSection = ({
  settings,
  canWrite
}: {
  settings: InstanceSettings;
  canWrite: boolean;
}) => {
  let update = useAgentTrackingInstanceSettings(settings.instanceId).useUpdateMutator();
  let form = useSettingsForm(update, classification => ({ classification }), {
    initialValues: {
      deterministicEnabled: settings.classification.deterministicEnabled,
      aiEnabled: settings.classification.aiEnabled
    }
  });

  return (
    <SettingsSection
      title="Classification"
      description="How sessions of this instance are matched to your projects, teams and cost centers."
      form={form}
      update={update}
      canWrite={canWrite}
    >
      <Switch
        label="Rule-Based Classification"
        description="Matches sessions from ticket references, such as ENG-123, and from earlier confirmed matches of the same repository. Makes no external calls."
        checked={form.values.deterministicEnabled}
        disabled={!canWrite}
        onCheckedChange={checked => form.setFieldValue('deterministicEnabled', checked)}
      />

      <Switch
        label="Hosted Model Classification"
        description="Off by default. Sends session context (repository, branch, ticket references, tool and file statistics, team names, and with the Full content policy the first prompt and the workspace path) to a hosted classification model, which may run outside your organization's region."
        checked={form.values.aiEnabled}
        disabled={!canWrite}
        onCheckedChange={checked => form.setFieldValue('aiEnabled', checked)}
      />
    </SettingsSection>
  );
};

let serviceStatusText = {
  pending:
    'Agent Usage does not hold these settings yet. A change that could not be sent is retried in the background, and the nightly sync sends the stored settings again; until they arrive, Agent Usage applies the settings it had before.',
  unknown:
    'Agent Usage could not be asked whether it holds these settings, so it may still apply earlier ones.'
};

export let AgentTrackingSettings = ({
  organizationId,
  projectId,
  instanceId
}: {
  organizationId: string;
  projectId: string;
  instanceId: string;
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

      {access.privacy && access.retention && access.instance ? null : (
        <Callout color="gray">
          Privacy needs organization admin access, retention project access and the rest Agent
          Usage access to this instance. Sections you cannot change are read-only.
        </Callout>
      )}

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
        <>
          <ContentSection settings={instance.data} canWrite={access.instance} />
          <ClassificationSection settings={instance.data} canWrite={access.instance} />
        </>
      ))}
    </Flex>
  );
};
