import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { showSkillGroupFormModal } from '../../../scenes/skills/groupModal';
import { showSkillMarketplaceFormModal } from '../../../scenes/skills/marketplaceModal';
import { showSkillFormModal } from '../../../scenes/skills/modal';
import { showSkillPluginFormModal } from '../../../scenes/skills/pluginModal';
import { showSkillTemplateFormModal } from '../../../scenes/skills/templateModal';

export let SkillsListLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let navigate = useNavigate();
  let pathname = useLocation().pathname;

  let listPathParams = [organization.data, project.data, instance.data] as const;
  let createAction = () => {
    if (!instance.data) return null;

    if (pathname.endsWith('/templates')) {
      return {
        label: 'Create Template',
        onClick: () =>
          showSkillTemplateFormModal({
            instanceId: instance.data!.id,
            onCreate: skillTemplate => {
              navigate(Paths.instance.skillTemplate(...listPathParams, skillTemplate.id));
            }
          })
      };
    }

    if (pathname.endsWith('/groups')) {
      return {
        label: 'Create Group',
        onClick: () =>
          showSkillGroupFormModal({
            instanceId: instance.data!.id,
            onCreate: skillGroup => {
              navigate(Paths.instance.skillGroup(...listPathParams, skillGroup.id));
            }
          })
      };
    }

    if (pathname.endsWith('/marketplaces')) {
      return {
        label: 'Create Marketplace',
        onClick: () =>
          showSkillMarketplaceFormModal({
            instanceId: instance.data!.id,
            onCreate: marketplace => {
              navigate(Paths.instance.skillMarketplace(...listPathParams, marketplace.id));
            }
          })
      };
    }

    if (pathname.endsWith('/plugins')) {
      return {
        label: 'Create Plugin',
        onClick: () =>
          showSkillPluginFormModal({
            instanceId: instance.data!.id,
            onCreate: plugin => {
              navigate(Paths.instance.skillPlugin(...listPathParams, plugin.id));
            }
          })
      };
    }

    if (pathname.endsWith('/settings')) return null;

    return {
      label: 'Create Skill',
      onClick: () =>
        showSkillFormModal({
          instanceId: instance.data!.id,
          onCreate: skill => {
            navigate(Paths.instance.skill(...listPathParams, skill.id));
          }
        })
    };
  };
  let action = createAction();

  return (
    <ContentLayout>
      <PageHeader
        title="Magic Skills"
        description="Create reusable skills that can enable rich workflows across agents and teams."
        actions={
          action ? (
            <Button size="2" onClick={() => action.onClick()}>
              {action.label}
            </Button>
          ) : undefined
        }
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Skills',
            to: Paths.instance.skills(...listPathParams)
          },
          {
            label: 'Marketplaces',
            to: Paths.instance.skillMarketplaces(...listPathParams)
          },
          {
            label: 'Templates',
            to: Paths.instance.skillTemplates(...listPathParams)
          },
          {
            label: 'Groups',
            to: Paths.instance.skillGroups(...listPathParams)
          },
          {
            label: 'Settings',
            to: Paths.instance.skillSettings(...listPathParams)
          }
        ]}
      />

      <Outlet />
    </ContentLayout>
  );
};
