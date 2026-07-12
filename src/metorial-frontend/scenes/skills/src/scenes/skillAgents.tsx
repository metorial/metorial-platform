import { renderWithPagination, useForm } from '@metorial/data-hooks';
import { PageHeader } from '@metorial/layout';
import {
  type SkillAgent,
  useCreateSkillAgent,
  useDeleteSkillAgent,
  useSkillAgents,
  useUpdateSkillAgent
} from '@metorial/state';
import {
  Badge,
  Button,
  Dialog,
  Input,
  Menu,
  Spacer,
  Text,
  confirm,
  showModal
} from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { RiAddLine, RiMore2Line } from '@remixicon/react';
import { useEffect } from 'react';
import styled from 'styled-components';
import { forceFileTreeRefetch, useCurrentStoreHash } from './skillStoreFileViewer';

let EmptyState = styled.div`
  line-height: 1.6;
  padding: 8px 0;
`;

let AgentName = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 5px 0;
`;

let Actions = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
`;

let normalizeOptionalString = (value: string | undefined | null) => {
  let trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export let showSkillAgentFormModal = (p: {
  mode: 'create' | 'edit';
  instanceId: string;
  skillId: string;
  agent?: SkillAgent;
  onComplete: () => Promise<void> | void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createSkillAgent = useCreateSkillAgent();
    let updateSkillAgent = useUpdateSkillAgent();

    let isCreate = p.mode === 'create';
    let form = useForm({
      initialValues: {
        name: p.agent?.name ?? '',
        description: p.agent?.description ?? '',
        content: ''
      },
      onSubmit: async values => {
        if (isCreate) {
          let [result] = await createSkillAgent.mutate({
            instanceId: p.instanceId,
            skillId: p.skillId,
            name: values.name.trim(),
            description: normalizeOptionalString(values.description),
            content: normalizeOptionalString(values.content)
          });

          if (!result) return;
          forceFileTreeRefetch();
        } else {
          if (!p.agent) return;

          let [result] = await updateSkillAgent.mutate({
            instanceId: p.instanceId,
            skillId: p.skillId,
            skillAgentId: p.agent.id,
            name: values.name.trim(),
            description: normalizeOptionalString(values.description)
          });

          if (!result) return;
        }

        await p.onComplete();
        close();
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Enter a name'),
          description: yup.string(),
          content: yup.string()
        }) as any
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={560}>
        <Dialog.Title>{isCreate ? 'Create Skill Agent' : 'Edit Skill Agent'}</Dialog.Title>
        <Dialog.Description>
          Skill agents define sub-agent behavior and are stored with this skill.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer height={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          {isCreate && (
            <>
              <Spacer height={15} />

              <Input
                label="Initial Content"
                as="textarea"
                minRows={5}
                {...form.getFieldProps('content')}
              />
              <form.RenderError field="content" />
            </>
          )}

          <Spacer height={20} />

          <Dialog.Actions>
            <Button variant="soft" type="button" onClick={close} size="2">
              Cancel
            </Button>
            <Button
              size="2"
              type="submit"
              loading={isCreate ? createSkillAgent.isLoading : updateSkillAgent.isLoading}
              success={isCreate ? createSkillAgent.isSuccess : updateSkillAgent.isSuccess}
            >
              {isCreate ? 'Create Agent' : 'Save Agent'}
            </Button>
          </Dialog.Actions>

          <createSkillAgent.RenderError />
          <updateSkillAgent.RenderError />
        </form>
      </Dialog.Wrapper>
    );
  });

let getSkillAgentTableRow = (p: {
  agent: SkillAgent;
  isDeleting: boolean;
  getDocumentPath: (documentId: string) => string;
  onEdit: (agent: SkillAgent) => void;
  onDelete: (agent: SkillAgent) => void;
}) => {
  let documentPath = p.getDocumentPath(p.agent.documentId);

  return {
    href: documentPath,
    data: [
      <AgentName>
        <Text size="2" weight="strong">
          {p.agent.name}
        </Text>
        {p.agent.description && (
          <Text color="gray600" size="1">
            {p.agent.description}
          </Text>
        )}
      </AgentName>,
      <Badge color={p.agent.status === 'active' ? 'green' : 'gray'} size="1">
        {p.agent.status}
      </Badge>,
      <Text color={p.agent.path ? 'gray800' : 'gray500'} size="2">
        {p.agent.path ?? p.agent.documentId}
      </Text>,
      <Actions onClick={e => e.stopPropagation()}>
        <Menu
          items={[
            { id: 'edit', label: 'Edit' },
            { id: 'delete', label: 'Delete' }
          ]}
          onItemClick={item => {
            if (item === 'edit') p.onEdit(p.agent);
            if (item === 'delete') {
              confirm({
                title: `Delete ${p.agent.name}?`,
                description:
                  'This will archive the skill agent and remove its linked store item.',
                confirmText: 'Delete',
                onConfirm: async () => p.onDelete(p.agent)
              });
            }
          }}
        >
          <Button
            size="1"
            variant="outline"
            iconRight={<RiMore2Line />}
            loading={p.isDeleting}
            title="Skill agent options"
          />
        </Menu>
      </Actions>
    ]
  };
};

export let SkillAgentsScene = (p: {
  instanceId: string | null | undefined;
  skillId: string | null | undefined;
  getDocumentPath: (documentId: string) => string;
}) => {
  let skillAgents = useSkillAgents(p.instanceId, p.skillId, { order: 'asc' });
  let deleteSkillAgent = useDeleteSkillAgent();

  let storeHash = useCurrentStoreHash();
  useEffect(() => {
    skillAgents.refetch();
  }, [storeHash]);

  let openCreateModal = () => {
    if (!p.instanceId || !p.skillId) return;

    showSkillAgentFormModal({
      mode: 'create',
      instanceId: p.instanceId,
      skillId: p.skillId,
      onComplete: () => skillAgents.refetch()
    });
  };

  let openEditModal = (agent: SkillAgent) => {
    if (!p.instanceId || !p.skillId) return;

    showSkillAgentFormModal({
      mode: 'edit',
      instanceId: p.instanceId,
      skillId: p.skillId,
      agent,
      onComplete: () => skillAgents.refetch()
    });
  };

  let deleteAgent = async (agent: SkillAgent) => {
    if (!p.instanceId || !p.skillId) return;

    let [result] = await deleteSkillAgent.mutate({
      instanceId: p.instanceId,
      skillId: p.skillId,
      skillAgentId: agent.id
    });

    if (!result) return;
    await skillAgents.refetch();
  };

  return (
    <>
      <PageHeader
        size="6"
        title="Skill Agents"
        description="Create and manage sub-agents attached to this skill."
        actions={
        <Button
          size="2"
          variant="outline"
          iconLeft={<RiAddLine />}
          disabled={!p.instanceId || !p.skillId}
          onClick={openCreateModal}
        >
          Create Agent
        </Button>
        }
      />
      {renderWithPagination(skillAgents)(skillAgents => (
        <>
          {skillAgents.data.items.length === 0 ? (
            <EmptyState>
              <Text color="gray600" size="2">
                No skill agents have been created for this skill yet.
              </Text>
            </EmptyState>
          ) : (
            <Table
              headers={['Name', 'Status', 'Document', '']}
              data={skillAgents.data.items.map(agent =>
                getSkillAgentTableRow({
                  agent,
                  isDeleting: deleteSkillAgent.isLoading,
                  getDocumentPath: p.getDocumentPath,
                  onEdit: openEditModal,
                  onDelete: deleteAgent
                })
              )}
            />
          )}

          <deleteSkillAgent.RenderError />
        </>
      ))}
    </>
  );
};
