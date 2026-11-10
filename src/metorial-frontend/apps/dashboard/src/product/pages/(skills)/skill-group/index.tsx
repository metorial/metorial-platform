import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { showSkillGroupSkillPicker } from '@metorial/scene-skills';
import {
  skillsLoader,
  useCreateSkillGroupItem,
  useCurrentInstance,
  useRemoveSkillFromSkillGroup,
  useSkillGroup,
  type SkillGroup
} from '@metorial/state';
import { Button, Menu, confirm } from '@metorial/ui';
import { RiAddLine, RiMore2Fill } from '@remixicon/react';
import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { styled } from 'styled-components';
import { showSkillGroupSettingsModal } from '../../../scenes/skills/groupSettingsModal';
import {
  CreateSkillButton,
  SkillsList,
  SkillsListItemMenuProvider,
  useSkillPathParams,
  type SkillsListItemMenu
} from '../../../scenes/skills/overview/skillsList';

let HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

let SkillGroupHeaderActions = (p: { instanceId: string; skillGroup: SkillGroup }) => {
  let navigate = useNavigate();
  let pathParams = useSkillPathParams();
  let createSkillGroupItem = useCreateSkillGroupItem();
  let deleteMutator = useSkillGroup(p.instanceId, p.skillGroup.id).deleteMutator();

  return (
    <HeaderActions>
      <Button
        size="2"
        variant="outline"
        iconLeft={<RiAddLine />}
        onClick={() =>
          showSkillGroupSkillPicker({
            instanceId: p.instanceId,
            excludeSkillIds: p.skillGroup.skills.map(skill => skill.id),
            onSelect: async skill => {
              let [item] = await createSkillGroupItem.mutate({
                instanceId: p.instanceId,
                skillGroupId: p.skillGroup.id,
                skillId: skill.id
              });
              if (item) skillsLoader.refetchAll();
            }
          })
        }
      >
        Add Skill
      </Button>

      <CreateSkillButton instanceId={p.instanceId} skillGroupId={p.skillGroup.id} />

      <Menu
        items={[
          {
            id: 'settings',
            label: 'Settings',
            onClick: () =>
              showSkillGroupSettingsModal({
                instanceId: p.instanceId,
                skillGroupId: p.skillGroup.id
              })
          },
          {
            id: 'delete',
            label: 'Delete',
            onClick: () =>
              confirm({
                title: `Delete ${p.skillGroup.name}?`,
                description:
                  'Are you sure you want to delete this skill group? The skills themselves will remain available.',
                confirmText: 'Delete',
                onConfirm: async () => {
                  let [result] = await deleteMutator.mutate(undefined as never);
                  if (result) navigate(Paths.instance.skills(...pathParams));
                }
              })
          }
        ]}
      >
        <Button
          size="2"
          variant="outline"
          icon={<RiMore2Fill />}
          title="More"
          aria-label="More"
        />
      </Menu>
    </HeaderActions>
  );
};

export let SkillGroupPage = () => {
  let instance = useCurrentInstance();
  let { skillGroupId } = useParams();
  let skillGroup = useSkillGroup(instance.data?.id, skillGroupId);
  let removeSkillFromGroup = useRemoveSkillFromSkillGroup();

  let instanceId = instance.data?.id;
  let getItemMenu: SkillsListItemMenu = useCallback(
    skill => [
      {
        label: 'Remove From Group',
        onClick: () =>
          confirm({
            title: `Remove ${skill.name}?`,
            description: 'Remove this skill from the group? The skill itself is not deleted.',
            confirmText: 'Remove',
            onConfirm: async () => {
              if (!instanceId || !skillGroupId) return;

              let [result] = await removeSkillFromGroup.mutate({
                instanceId,
                skillGroupId,
                skillId: skill.id
              });
              if (result) skillsLoader.refetchAll();
            }
          })
      }
    ],
    [instanceId, skillGroupId, removeSkillFromGroup]
  );

  return renderWithLoader({ instance, skillGroup })(({ instance, skillGroup }) => (
    <ContentLayout>
      <PageHeader
        title={skillGroup.data.name}
        description={skillGroup.data.description || 'Skills that belong to this group.'}
        actions={
          <SkillGroupHeaderActions
            instanceId={instance.data.id}
            skillGroup={skillGroup.data}
          />
        }
      />

      <SkillsListItemMenuProvider value={getItemMenu}>
        <SkillsList
          skillGroupId={skillGroup.data.id}
          emptyState={{
            initial: 'This group does not include any skills yet.',
            filtered: 'No skills in this group match your search.'
          }}
        />
      </SkillsListItemMenuProvider>
    </ContentLayout>
  ));
};
