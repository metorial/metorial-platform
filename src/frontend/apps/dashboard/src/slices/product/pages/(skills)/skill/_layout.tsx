import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useCreateSkillExport,
  useDuplicateSkill,
  useSkill
} from '@metorial/state';
import { Button, Flex, LinkTabs, toast } from '@metorial/ui';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { showSkillCloneFormModal } from '../../../scenes/skills/cloneModal';

let downloadExport = (url: string, fileName: string) => {
  let link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export let SkillLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { skillId } = useParams();
  let skill = useSkill(instance.data?.id, skillId);
  let duplicateSkill = useDuplicateSkill();
  let createSkillExport = useCreateSkillExport();
  let navigate = useNavigate();
  let pathname = useLocation().pathname;

  let skillPathParams = [
    organization.data,
    project.data,
    instance.data,
    skill.data?.id ?? skillId
  ] as const;

  let duplicate = () => {
    if (!instance.data || !skill.data) return;

    showSkillCloneFormModal({
      title: 'Duplicate Skill',
      description: 'Choose a name and description for the duplicated skill.',
      submitLabel: 'Duplicate Skill',
      initialName: `Copy of ${skill.data.name}`,
      initialDescription: skill.data.description,
      onSubmit: async values => {
        let [duplicatedSkill] = await duplicateSkill.mutate({
          instanceId: instance.data!.id,
          skillId: skill.data!.id,
          name: values.name,
          description: values.description
        });

        if (!duplicatedSkill) return false;

        navigate(
          Paths.instance.skill(
            organization.data,
            project.data,
            instance.data,
            duplicatedSkill.id
          )
        );
      }
    });
  };

  let exportSkill = () => {
    if (!instance.data || !skill.data) return;

    toast.promise(
      async () => {
        let [skillExport, error] = await createSkillExport.mutate({
          instanceId: instance.data!.id,
          target: 'skill',
          skillId: skill.data!.id
        });

        if (error) throw error;
        if (!skillExport?.fileLink)
          throw new Error('Export completed without a download link');

        downloadExport(skillExport.fileLink!.url, `${skill.data!.slug}.zip`);
      },
      {
        loading: 'Exporting skill...',
        success: 'Skill export downloaded',
        error: 'Failed to export skill'
      }
    );
  };

  return (
    <ContentLayout>
      <PageHeader
        title={skill.data?.name ?? '...'}
        description={skill.data?.description ?? undefined}
        pagination={[
          {
            label: 'Skills',
            href: Paths.instance.skills(organization.data, project.data, instance.data)
          },
          {
            label: skill.data?.name ?? '...',
            href: Paths.instance.skill(...skillPathParams)
          }
        ]}
        actions={
          <Flex gap="8px">
            <Button size="2" disabled={!instance.data || !skill.data} onClick={duplicate}>
              Duplicate Skill
            </Button>

            <Button
              size="2"
              disabled={!instance.data || !skill.data}
              loading={createSkillExport.isLoading}
              success={createSkillExport.isSuccess}
              onClick={exportSkill}
            >
              Export Skill
            </Button>
          </Flex>
        }
      />

      {renderWithLoader({ skill })(() => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.skill(...skillPathParams)
              },
              {
                label: 'Participants',
                to: `${Paths.instance.skill(...skillPathParams)}/participants`
              },
              {
                label: 'Versions',
                to: `${Paths.instance.skill(...skillPathParams)}/versions`
              },
              {
                label: 'Settings',
                to: `${Paths.instance.skill(...skillPathParams)}/settings`
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
