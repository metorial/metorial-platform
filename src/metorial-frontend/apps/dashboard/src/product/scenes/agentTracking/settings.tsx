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
import { Button, Callout, Flex, Input, NumberInput, Switch, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import React from 'react';
import styled from 'styled-components';
import { isHttpUrl } from '../../lib/isHttpUrl';
import { useAgentTrackingSettingsAccess } from './access';
import { classificationUpdate, hostedModelPromptText } from './classification';
import { agentTrackingErrorStatus, AgentTrackingErrorState, notSetUpText } from './errorState';
import { WithInfo } from './info';

let minGroupUsersRange = { min: 3, max: 100 };

let retentionDaysRange = { min: 1, max: 3650 };

let historyImportDaysRange = { min: 1, max: 365 };

let ticketUrlTemplateKey = '{key}';

let DependentOption = styled.div`
  padding-left: 24px;
`;

type OrganizationSettings = DashboardOrganizationsConfigureAgentTrackingGetOutput;
type ProjectSettings = DashboardProjectsConfigureAgentTrackingGetOutput;
type InstanceSettings = DashboardInstanceAgentTrackingSettingsGetOutput;

let desktopSwitches = [
  {
    id: 'toolDetails',
    label: 'Detailed Tool Reporting',
    description:
      'When on, Agent Usage keeps MCP server and tool names, skill names, and custom command and agent names. Tool inputs, outputs and error text are kept only as a size and a fingerprint by default. When off, all of these are removed; built-in tool names such as Bash and Read are kept.'
  },
  {
    id: 'sessionContext',
    label: 'Session Context',
    description:
      'Keeps the repository, branch, commits, ticket keys and working folder of each agent session, and its pull requests from Metorial Desktop. By default the folder is not kept as its full path, and code and commit messages are never part of it.'
  },
  {
    id: 'sessionTitles',
    label: 'Session Titles',
    description:
      'Keeps the titles Claude Code gives its sessions. Claude Code writes them from what was typed, so they can contain details of the work.'
  },
  {
    id: 'historyImport',
    label: 'History Import',
    description:
      "Imports the Claude Code and Codex sessions already on a member's computer when this is turned on, from the session files those tools keep."
  }
] as const;

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
    onSubmit: async values => {
      await update.mutate({ classification: classificationUpdate(values) });
    }
  });

  return (
    <SettingsSection
      title="Classification"
      description={`Applies to the selected environment, ${environmentName}: assigns its agent sessions to projects and cost centers. Assignments are not shown in the dashboard yet.`}
      form={form}
      update={update}
      canWrite={canWrite}
      readOnlyText="Only organization admins can change these settings."
    >
      <Switch
        label={
          <WithInfo info="Assigns each session to a project or cost center from its ticket keys, such as ENG-123, and from earlier assignments in the same workspace or repository, without sending anything outside Metorial.">
            Assign Sessions Automatically
          </WithInfo>
        }
        checked={form.values.deterministicEnabled}
        disabled={!canWrite}
        onCheckedChange={checked => form.setFieldValue('deterministicEnabled', checked)}
      />

      <DependentOption>
        <Switch
          label={
            <WithInfo
              info={`With Assign Sessions Automatically, sessions the rules cannot assign go to a hosted model that may run outside your organization's region. It receives the repository, branch, ticket keys, workspace name, session tags, AI tool, MCP server names, tool call counts and the member's team names, with your projects and cost centers to choose from. ${hostedModelPromptText(settings.content.mode)}`}
            >
              Hosted Model for Unmatched Sessions
            </WithInfo>
          }
          checked={form.values.deterministicEnabled && form.values.aiEnabled}
          disabled={!canWrite || !form.values.deterministicEnabled}
          onCheckedChange={checked => form.setFieldValue('aiEnabled', checked)}
        />
      </DependentOption>
    </SettingsSection>
  );
};

let DesktopSection = ({
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
      ...settings.desktop,
      historyImportDays: settings.desktop.historyImportDays as number | null
    },
    updateInitialValues: true,
    onSubmit: async desktop => {
      await update.mutate({
        desktop: { ...desktop, historyImportDays: desktop.historyImportDays ?? undefined }
      });
    },
    schema: yup =>
      yup.object({
        historyImportDays: yup
          .number()
          .nullable()
          .typeError('Enter a number')
          .integer('Enter a whole number')
          .min(historyImportDaysRange.min, `At least ${historyImportDaysRange.min} day`)
          .max(historyImportDaysRange.max, `At most ${historyImportDaysRange.max} days`)
          .required('Enter a number of days')
      })
  });

  return (
    <SettingsSection
      title="Collected Data"
      description="These switches decide what Agent Usage keeps for this organization, across every project and environment. Detailed Tool Reporting and Session Context apply to every AI tool that reports to Metorial; Session Titles and History Import need Metorial Desktop on the member's computer."
      form={form}
      update={update}
      canWrite={canWrite}
      readOnlyText="Only organization admins can change these settings."
    >
      {desktopSwitches.map(desktopSwitch => (
        <Switch
          key={desktopSwitch.id}
          label={<WithInfo info={desktopSwitch.description}>{desktopSwitch.label}</WithInfo>}
          checked={form.values[desktopSwitch.id]}
          disabled={!canWrite}
          onCheckedChange={checked => form.setFieldValue(desktopSwitch.id, checked)}
        />
      ))}

      {form.values.historyImport ? (
        <DependentOption>
          <Flex direction="column" gap={4}>
            <NumberInput
              label={
                <WithInfo info="How far back History Import reads session files, never further than the Raw Records retention of a project.">
                  Import Window
                </WithInfo>
              }
              unit="days"
              min={historyImportDaysRange.min}
              max={historyImportDaysRange.max}
              value={form.values.historyImportDays}
              disabled={!canWrite}
              onChange={value => form.setFieldValue('historyImportDays', value)}
              onBlur={() => form.setFieldTouched('historyImportDays', true)}
            />
            <form.RenderError field="historyImportDays" />
          </Flex>
        </DependentOption>
      ) : null}
    </SettingsSection>
  );
};

let LinksSection = ({
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
    initialValues: { ticketUrlTemplate: settings.links.ticketUrlTemplate ?? '' },
    updateInitialValues: true,
    onSubmit: async values => {
      await update.mutate({
        links: { ticketUrlTemplate: values.ticketUrlTemplate.trim() || null }
      });
    },
    schema: yup =>
      yup.object({
        ticketUrlTemplate: yup
          .string()
          .test(
            'ticket-url-template',
            `Enter an http or https URL with ${ticketUrlTemplateKey} in its path or query`,
            value => {
              let template = value?.trim();
              if (!template) return true;

              return (
                template.includes(ticketUrlTemplateKey) &&
                isHttpUrl(template.replaceAll(ticketUrlTemplateKey, 'KEY-1'))
              );
            }
          )
      })
  });

  return (
    <SettingsSection
      title="Links"
      description="Applies to every project and environment of this organization: where agent usage links out to."
      form={form}
      update={update}
      canWrite={canWrite}
      readOnlyText="Only organization admins can change these settings."
    >
      <Flex direction="column" gap={4}>
        <Input
          label={
            <WithInfo
              info={`Link ticket keys to your tracker. Use ${ticketUrlTemplateKey} where the ticket key goes.`}
            >
              Ticket Link
            </WithInfo>
          }
          placeholder={`https://linear.app/acme/issue/${ticketUrlTemplateKey}`}
          disabled={!canWrite}
          {...form.getFieldProps('ticketUrlTemplate')}
        />
        <form.RenderError field="ticketUrlTemplate" />
      </Flex>
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
        <Flex direction="column" gap={20}>
          <PrivacySection settings={organization.data} canWrite={access.organization} />
          <DesktopSection settings={organization.data} canWrite={access.organization} />
          <LinksSection settings={organization.data} canWrite={access.organization} />
        </Flex>
      ))}
      {renderWithLoader(
        { project },
        errorState(project)
      )(({ project }) => (
        <RetentionSection settings={project.data} canWrite={access.retention} />
      ))}
      {/* {renderWithLoader({ instance }, errorState(instance))(({ instance }) => <ClassificationSection settings={instance.data} environmentName={environmentName} canWrite={access.instance} />)} */}
    </Flex>
  );
};
