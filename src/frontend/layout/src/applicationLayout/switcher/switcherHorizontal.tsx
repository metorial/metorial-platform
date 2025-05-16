import { Paths } from '@metorial/frontend-config';
import {
  MetorialOrganization,
  MetorialProject,
  useBoot,
  useCurrentOrganization
} from '@metorial/state';
import { Avatar, LinkButton, Logo, Text, theme } from '@metorial/ui';
import * as Popover from '@radix-ui/react-popover';
import { RiArrowRightSLine } from '@remixicon/react';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { styled } from 'styled-components';
import { fadeIn, fadeOut } from '../animations';
import { createOrganization } from './actions/createOrganization';
import { createProject } from './actions/createProject';

let TriggerWrapper = styled.button`
  display: flex;
  height: 50px;
  padding: 5px 10px;
  transition: all 0.2s ease;
  border: none;
  background: transparent;
  outline: none;
  align-items: center;
  border-radius: 15px;
  width: fit-content;
  background: ${theme.colors.gray400};

  &[data-state='active'] {
    &:hover,
    &:focus {
      background: ${theme.colors.gray500};
    }
  }
`;

let TriggerInner = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  cursor: pointer;
`;

let TriggerEntityWrapper = styled.div`
  display: flex;
  max-width: min(180px, 100%);
  gap: 10px;
  align-items: center;
`;

let TriggerSectionEntityText = styled.p`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  flex-shrink: 1;
  flex-grow: 1;
  font-size: 12px;
  font-weight: 500;
  text-align: left;
`;

let TriggerEntity = ({
  entity,
  height = 40
}: {
  entity: {
    imageUrl?: string;
    name: string;
  };
  height?: number;
}) => {
  return (
    <TriggerEntityWrapper style={{ height }}>
      {entity.imageUrl && (
        <div style={{ flexShrink: 0 }}>
          <Avatar entity={entity} size={height * 0.85} noTooltip />
        </div>
      )}

      <TriggerSectionEntityText>{entity.name}</TriggerSectionEntityText>
    </TriggerEntityWrapper>
  );
};

let TriggerArrow = () => {
  return (
    <div
      style={{
        width: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.3
      }}
    >
      <RiArrowRightSLine size={16} />
    </div>
  );
};

let PopoverContent = styled(Popover.Content)`
  overflow: hidden;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.large};
  z-index: 999;
  max-height: 50vh;
  padding: 0;

  background: rgba(245, 245, 245, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  border: solid 1px ${theme.colors.gray400};

  &[data-state='open'] {
    animation: ${fadeIn} 0.3s;
  }

  &[data-state='closed'] {
    animation: ${fadeOut} 0.3s;
  }
`;

let PopoverHeader = styled('header')`
  border-bottom: 1px solid ${theme.colors.gray300};
  padding: 4px 9px;
  display: flex;
`;

let PopoverGrid = styled('main')`
  background: ${theme.colors.gray300};
  height: 350px;
  display: grid;
  gap: 1px;
`;

let PopoverPart = styled('section')`
  background: rgba(255, 255, 255, 0.5);
  width: 250px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

let PopoverItems = styled('div')`
  padding: 10px;
  overflow: auto;
  height: 400px;
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

let PopoverButton = styled('button')`
  padding: 0;
  border: none;
  background: none;
  outline: none;
  border-radius: 7px;
  padding: 5px 10px;

  &:hover,
  &:focus {
    background: ${theme.colors.gray300};
  }

  p {
    font-size: 14px !important;
    padding: 2px 0;
  }
`;

let PopoverSectionFooter = styled('footer')`
  position: sticky;
  bottom: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid ${theme.colors.gray300};
  padding: 10px;
`;

let LogoText = styled.p`
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.gray900};
  padding-right: 5px;
`;

let PopoverInner = ({
  triggerInner,
  currentOrg,
  currentProject,
  close
}: {
  triggerInner: React.ReactNode;
  currentOrg: MetorialOrganization;
  currentProject?: MetorialProject;
  close: () => void;
}) => {
  let boot = useBoot();
  let navigate = useNavigate();

  let [selectedOrg, setSelectedOrg] = useState<MetorialOrganization | null>(null);
  let [selectedProject, setSelectedProject] = useState<MetorialProject | null>(null);

  useEffect(() => {
    if (currentOrg) setSelectedOrg(currentOrg);
  }, [currentOrg]);

  useEffect(() => {
    if (currentProject) setSelectedProject(currentProject);
  }, [currentProject]);

  let selectOrg = (organization: MetorialOrganization) => {
    setSelectedOrg(organization);
    let projects = boot.data?.projects.filter(p => p.organizationId == organization.id) ?? [];
    let firstProject = projects[0];
    if (firstProject) {
      setSelectedProject(firstProject);
    } else {
      setSelectedProject(null);
    }
  };

  let selectProject = (project: MetorialProject) => {
    if (project.id == currentProject?.id) return;

    let organization = boot.data?.organizations.find(o => o.id == project.organizationId);
    if (!organization) return;

    let instances = boot.data?.instances.filter(i => i.project.id == project.id);
    let instance = instances?.find(i => i.type == 'development');
    if (!instance) instance = instances?.[0];

    if (!instance) return;

    navigate(Paths.instance(organization, instance.project, instance));
  };

  let projects = boot.data?.projects.filter(p => p.organizationId == selectedOrg?.id);

  let organizations = boot.data?.organizations;

  let doCreateProject = async () => {
    if (!selectedOrg) return;
    createProject(selectedOrg);
  };

  return (
    <>
      <PopoverHeader onClick={close}>{triggerInner}</PopoverHeader>

      <PopoverGrid
        style={{
          gridTemplateColumns: new Array(!currentProject ? 1 : 2).fill('1fr').join(' ')
        }}
      >
        {!currentProject ? (
          <PopoverPart style={{ width: 300 }}>
            <PopoverItems>
              {organizations?.map(organization => (
                <PopoverButton
                  onClick={() =>
                    navigate(
                      new URL(Paths.organization.settings(organization), window.location.href)
                        .pathname
                    )
                  }
                  key={organization.id}
                >
                  <TriggerEntity entity={organization} height={30} />
                </PopoverButton>
              ))}
            </PopoverItems>

            <PopoverSectionFooter>
              <PopoverButton
                onClick={() => {
                  createOrganization();
                }}
              >
                <TriggerEntity entity={{ name: 'Create Organization' }} height={30} />
              </PopoverButton>
            </PopoverSectionFooter>
          </PopoverPart>
        ) : (
          <>
            <PopoverPart>
              <PopoverItems>
                {organizations?.map(organization => (
                  <PopoverButton onClick={() => selectOrg(organization)} key={organization.id}>
                    <TriggerEntity entity={organization} />
                  </PopoverButton>
                ))}
              </PopoverItems>

              <PopoverSectionFooter>
                <PopoverButton
                  onClick={() => {
                    createOrganization();
                  }}
                >
                  <TriggerEntity entity={{ name: 'Create Organization' }} height={30} />
                </PopoverButton>
              </PopoverSectionFooter>
            </PopoverPart>

            <PopoverPart>
              <PopoverItems>
                {projects?.map(project => (
                  <PopoverButton onClick={() => selectProject(project)} key={project.id}>
                    <TriggerEntity entity={project} />
                  </PopoverButton>
                ))}

                {projects?.length === 0 && (
                  <Text size="2" weight="medium" color="gray600">
                    You don't have any projects in this workspace yet. Get started by{' '}
                    <LinkButton onClick={doCreateProject}>creating a project</LinkButton>.
                  </Text>
                )}
              </PopoverItems>

              <PopoverSectionFooter>
                <PopoverButton onClick={doCreateProject}>
                  <TriggerEntity entity={{ name: 'Create Project' }} height={30} />
                </PopoverButton>
              </PopoverSectionFooter>
            </PopoverPart>
          </>
        )}
      </PopoverGrid>
    </>
  );
};

export let SwitcherHorizontal = ({ enabled }: { enabled?: boolean }) => {
  let [open, setOpen] = useState(false);
  let { organizationId } = useParams();

  let { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  let currentOrg = useCurrentOrganization();
  let currentProject = currentOrg.data?.currentProject;

  let pageType = !currentOrg
    ? ('global' as const)
    : organizationId
      ? ('organization' as const)
      : ('project' as const);

  if (pageType == 'global' || !currentOrg.data || enabled === false)
    return (
      <TriggerWrapper as="div">
        <TriggerInner>
          <Logo />

          <LogoText>Metorial</LogoText>
        </TriggerInner>
      </TriggerWrapper>
    );

  let triggerInner = (
    <TriggerInner>
      <TriggerEntity entity={currentOrg.data} />

      {currentProject && (
        <>
          <TriggerArrow />

          <TriggerEntity entity={currentProject} />
        </>
      )}
    </TriggerInner>
  );

  return (
    <div>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <TriggerWrapper data-state="active">{triggerInner}</TriggerWrapper>
        </Popover.Trigger>

        <Popover.Portal>
          <PopoverContent side="bottom" align="start" sideOffset={-50}>
            <PopoverInner
              triggerInner={triggerInner}
              currentOrg={currentOrg.data}
              currentProject={currentProject ?? undefined}
              close={() => setOpen(false)}
            />
          </PopoverContent>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
};
