import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, Menu, Text, theme, Tooltip } from '@metorial/ui';
import { RiArrowDownSLine, RiFlaskLine } from '@remixicon/react';
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

let InstanceBar = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 20px;
  border-bottom: 1px solid ${theme.colors.gray300};
  gap: 15px;
  justify-content: space-between;
  flex-shrink: 0;
`;

let InstanceBarSide = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
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
        <InstanceBar
          style={{
            borderTop: `6px solid ${theme.colors[`${color}700`]}`
          }}
        >
          <InstanceBarSide>
            <Text size="2" weight="medium">
              You're in a sandbox. Changes won't affect production.
            </Text>
          </InstanceBarSide>

          <InstanceBarSide>
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
          </InstanceBarSide>
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
      lightMode
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
      {instance.data?.type === 'development' ? (
        <Button size="2" color="gray400" shadow={false}>
          Exit Sandbox
        </Button>
      ) : (
        <Tooltip content="Manage Sandboxes">
          <Button
            variant="ghost"
            size="3"
            iconLeft={
              <RiFlaskLine style={{ height: 16, width: 16, color: theme.colors.gray800 }} />
            }
            title="Manage Sandboxes"
          />
        </Tooltip>
      )}
    </Menu>
  );
};
