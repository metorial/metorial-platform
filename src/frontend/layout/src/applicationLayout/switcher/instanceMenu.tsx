import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useInstances
} from '@metorial/state';
import { Menu, theme } from '@metorial/ui';
import { RiArrowDownSLine } from '@remixicon/react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { createInstance } from './actions';

let HEIGHT = 5;

let Wrapper = styled('div')`
  min-height: 100%;
  display: flex;
  flex-direction: column;
`;

let Header = styled('header')`
  display: flex;
  height: ${HEIGHT}px;
  align-items: center;
  padding: 0px 10px;
  position: sticky;
  top: 0;
  z-index: 10;
  flex-shrink: 0;
  transition: background 0.2s;
`;

let HeaderMarker = styled('div')`
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  transition: all 0.2s;
  padding-bottom: 15px;
  z-index: 11;

  & > div {
    height: 10px;
    min-width: 100px;
    max-width: 100px;
    border-radius: 5px;
    transition: all 0.2s;

    display: flex;
    align-items: center;
    justify-content: center;

    & > div {
      opacity: 0;
      pointer-events: none;
      transition: all 0.2s;
      padding: 0px;
    }
  }

  &:hover,
  &:focus,
  &:active,
  &:focus-within,
  &[data-state='open'] {
    padding-top: 10px;

    & > div {
      border-radius: 100px;
      width: auto;
      height: 30px;
      min-width: 30px;
      max-width: 500px;

      & > div {
        opacity: 1;
        pointer-events: all;
      }
    }
  }
`;

let TitleButton = styled('button')`
  background: none;
  border: none;
  color: ${theme.colors.gray900};
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  padding: 0px 7px 0px 9px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.2s;
  border-radius: 60px;
  outline: none;
  height: 30px;

  &:focus,
  &:active {
    background: rgba(0, 0, 0, 0.05);
  }
`;

export let InstanceMenuLayout = ({ children }: { children: React.ReactNode }) => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let org = useCurrentOrganization();
  let projects = useInstances(instance.data?.organizationId);

  let navigate = useNavigate();
  let [selectorOpen, setSelectorOpen] = useState(false);

  let createInstanceMutator = projects.createMutator();

  let color = !instance.data
    ? ('white' as const)
    : instance.data.type == 'production'
      ? ('blue' as const)
      : ('orange' as const);

  return (
    <Wrapper>
      <Header
        style={{
          background: theme.colors[`${color}700`]
        }}
      >
        <HeaderMarker data-state={selectorOpen ? 'open' : 'closed'}>
          <div style={{ background: theme.colors[`${color}700`] }}>
            <div>
              <Menu
                setIsOpen={setSelectorOpen}
                title="Select Instance"
                items={[
                  ...(project.data?.instances.map(instance => ({
                    id: instance.slug,
                    label: instance.name
                  })) ?? []),
                  ...(!project.data?.instances.some(i => i.type == 'production')
                    ? [
                        {
                          id: '__production_instance__',
                          label: 'Production'
                        }
                      ]
                    : []),
                  { type: 'separator' },
                  {
                    id: '__new_instance__',
                    label: 'Create Instance'
                  }
                ]}
                onItemClick={async id => {
                  if (id == '__production_instance__') {
                    let [res] = await createInstanceMutator.mutate({
                      name: 'Production',
                      type: 'production',
                      projectId: project.data?.id!
                    });
                    if (res) navigate(Paths.instance(org.data!, project.data!, res));
                  } else if (id == '__new_instance__') {
                    createInstance(project.data!);
                  } else {
                    let foundInstance = project.data?.instances.find(
                      i => i.slug == id || i.id == id
                    );
                    if (!foundInstance) return;

                    let currentBasePath = Paths.instance(
                      org.data!,
                      project.data!,
                      instance.data!
                    );
                    let afterPath = location.pathname.replace(currentBasePath, '');

                    navigate(
                      Paths.instance(
                        org.data!,
                        project.data!,
                        foundInstance
                        // afterPath
                      )
                    );
                  }
                }}
              >
                <TitleButton>
                  <span>{instance.data?.name}</span>

                  <RiArrowDownSLine size={16} />
                </TitleButton>
              </Menu>
            </div>
          </div>
        </HeaderMarker>
      </Header>

      {children}
    </Wrapper>
  );
};
