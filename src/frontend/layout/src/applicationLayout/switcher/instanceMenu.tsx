import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, Menu, theme } from '@metorial/ui';
import { RiArrowDownSLine } from '@remixicon/react';
import React, { useLayoutEffect, useRef, useState } from 'react';
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
  position: sticky;
  flex-direction: column;
  position: sticky;
  top: 0;
  z-index: 10;
  background: ${theme.colors.background};
`;

let HeaderBar = styled('div')`
  display: flex;
  height: ${HEIGHT}px;
  align-items: center;
  padding: 0px 10px;
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
`;

let InstanceBar = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 24px 8px 12px;
  border-bottom: 1px solid ${theme.colors.gray300};
  gap: 15px;
  justify-content: space-between;
  flex-shrink: 0;
`;

let RestrictedWrapper = styled('div')`
  &[data-state='active'] {
    height: calc(100% - ${HEIGHT}px);
    overflow: hidden;

    & > * {
      height: 100%;
    }
  }
`;

export let InstanceMenuLayout = ({ children }: { children: React.ReactNode }) => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let org = useCurrentOrganization();

  let [restrictHeight, setRestrictHeight] = useState(false);
  let restrictHeightRef = useRef(false);

  useLayoutEffect(() => {
    let applyRestrictHeight = (value: boolean) => {
      if (restrictHeightRef.current === value) return;
      restrictHeightRef.current = value;
      setRestrictHeight(value);
    };

    (window as any).metorial_setRestrictHeight = applyRestrictHeight;
    return () => {
      if ((window as any).metorial_setRestrictHeight === applyRestrictHeight) {
        delete (window as any).metorial_setRestrictHeight;
      }
    };
  }, []);

  let navigate = useNavigate();
  let [selectorOpen, setSelectorOpen] = useState(false);

  let color = !instance.data
    ? ('white' as const)
    : instance.data.type == 'production'
      ? ('blue' as const)
      : ('orange' as const);

  if (!instance.data || instance.data.type === 'production') return <>{children}</>;

  let productionInstance = project.data?.instances.find(i => i.type === 'production');
  let devInstances = project.data?.instances.filter(i => i.type === 'development') ?? [];

  return (
    <Wrapper
      style={{
        height: restrictHeight ? '100%' : undefined
      }}
    >
      <Header>
        <HeaderBar
          style={{
            background: theme.colors[`${color}700`]
          }}
        >
          <HeaderMarker data-state={selectorOpen ? 'open' : 'closed'}>
            <div style={{ background: theme.colors[`${color}700`] }}>
              <div></div>
            </div>
          </HeaderMarker>
        </HeaderBar>

        <InstanceBar>
          <Menu
            setIsOpen={setSelectorOpen}
            title="Select Sandbox"
            items={[
              ...devInstances.map(instance => ({
                id: instance.slug,
                label: instance.name
              })),
              ...(devInstances.length
                ? [
                    {
                      type: 'separator' as const
                    }
                  ]
                : []),
              ...(productionInstance
                ? [
                    {
                      id: productionInstance.slug,
                      label: 'Exit Sandbox'
                    }
                  ]
                : [
                    {
                      id: '__new_instance__',
                      label: 'Create Sandbox'
                    }
                  ])
            ]}
            onItemClick={async id => {
              if (id == '__new_instance__') {
                // @ts-ignore
                await window.metorial_enterprise?.beforeCreateInstance?.();
                createInstance(project.data!);
              } else {
                let foundInstance = project.data?.instances.find(
                  i => i.slug == id || i.id == id
                );
                if (!foundInstance) return;

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
            <Button iconRight={<RiArrowDownSLine />} size="2" variant="outline">
              {instance.data?.name}
            </Button>
          </Menu>

          {productionInstance && (
            <Button
              size="2"
              variant="outline"
              onClick={() => {
                navigate(
                  Paths.instance(
                    org.data!,
                    project.data!,
                    productionInstance
                    // afterPath
                  )
                );
              }}
            >
              Exit Sandbox
            </Button>
          )}
        </InstanceBar>
      </Header>

      <RestrictedWrapper data-state={restrictHeight ? 'active' : 'closed'}>
        {children}
      </RestrictedWrapper>
    </Wrapper>
  );
};

export let SandboxButton = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let org = useCurrentOrganization();

  let productionInstance = project.data?.instances.find(i => i.type === 'production');
  let devInstances = project.data?.instances.filter(i => i.type === 'development') ?? [];

  let navigate = useNavigate();

  if (!productionInstance) return null;

  return (
    <Menu
      title="Select Sandbox"
      items={[
        ...devInstances.map(instance => ({
          id: instance.slug,
          label: instance.name
        })),
        ...(devInstances.length
          ? [
              {
                type: 'separator' as const
              }
            ]
          : []),
        {
          id: '__manage_sandboxes__',
          label: 'Manage Sandboxes'
        },
        ...(instance.data?.type === 'development'
          ? [
              {
                id: productionInstance.slug,
                label: 'Exit Sandbox'
              }
            ]
          : [
              {
                id: '__new_instance__',
                label: 'Create Sandbox'
              }
            ])
      ]}
      onItemClick={async id => {
        if (id == '__manage_sandboxes__') {
          navigate(Paths.organization.project(org.data!, project.data!, 'environments'));
          return;
        } else if (id == '__new_instance__') {
          // @ts-ignore
          await window.metorial_enterprise?.beforeCreateInstance?.();
          createInstance(project.data!);
        } else {
          let foundInstance = project.data?.instances.find(i => i.slug == id || i.id == id);
          if (!foundInstance) return;

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
      <Button size="2" color="gray400" shadow={false}>
        Sandboxes
      </Button>
    </Menu>
  );
};
