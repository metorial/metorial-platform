import { renderWithLoader } from '@metorial/data-hooks';
import { usePortals } from '@metorial/state';
import { Button, Menu, Popover, Text, theme } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { RiArrowDownSLine, RiCheckLine, RiLayoutTopLine, RiShareLine } from '@remixicon/react';
import { useState } from 'react';
import styled from 'styled-components';
import { PortalResourceShareBody, type PortalShareResourcePortal } from './sharePanel';
import type { PortalShareResource } from './useResourcePortalShare';

export type { PortalShareResource } from './useResourcePortalShare';

let portalListQuery = { limit: 50, order: 'asc' as const };

let PopoverContent = styled.div`
  display: flex;
  flex-direction: column;
  width: 450px;
  cursor: default;
`;

let PopoverHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 0 16px;
`;

let PortalChip = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px 0 10px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 999px;
  background: ${theme.colors.background};
  color: ${theme.colors.gray800};
  font-size: 12px;
  cursor: pointer;
  flex: 0 0 auto;

  &:hover {
    background: ${theme.colors.gray200};
  }
`;

let PortalSections = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

let resourceTitle = (resource: PortalShareResource) =>
  resource.type == 'integration' ? 'Integration' : 'Magic MCP Server';

let resourceNoun = (resource: PortalShareResource) =>
  resource.type == 'integration' ? 'integration' : 'Magic MCP server';

let SharePopoverPanel = (p: {
  instanceId: string;
  resource: PortalShareResource;
  portals: PortalShareResourcePortal[];
}) => {
  let [portalId, setPortalId] = useState(p.portals[0]?.id);
  let portal = p.portals.find(item => item.id == portalId) ?? p.portals[0];

  if (!portal) return null;

  return (
    <PopoverContent>
      <PopoverHeader>
        <Text size="2" weight="strong">
          Share {resourceTitle(p.resource)}
        </Text>

        {p.portals.length > 1 && (
          <Menu
            title="Share within portal"
            label="Change portal"
            items={p.portals.map(item => ({
              id: item.id,
              label: item.name,
              icon: item.id == portal.id ? <RiCheckLine size={14} /> : <span />
            }))}
            onItemClick={setPortalId}
          >
            <PortalChip type="button">
              <RiLayoutTopLine size={14} />
              <span>{portal.name}</span>
              <RiArrowDownSLine size={14} />
            </PortalChip>
          </Menu>
        )}
      </PopoverHeader>

      <PortalResourceShareBody
        key={portal.id}
        instanceId={p.instanceId}
        portal={portal}
        resource={p.resource}
      />
    </PopoverContent>
  );
};

export let ResourceSharePopover = (p: {
  instanceId: string | null | undefined;
  resource: PortalShareResource | null | undefined;
}) => {
  let portals = usePortals(p.instanceId, portalListQuery);
  let items = portals.data?.items ?? [];

  if (!p.instanceId || !p.resource || !items.length) return null;

  return (
    <Popover
      trigger={
        <Button type="button" size="2" variant="outline" iconLeft={<RiShareLine />}>
          Share
        </Button>
      }
      side="bottom"
      align="end"
      sideOffset={8}
      onOpenAutoFocus={event => event.preventDefault()}
    >
      <Popover.Content style={{ padding: 0, background: 'white', borderRadius: 9 }}>
        <SharePopoverPanel
          instanceId={p.instanceId}
          resource={p.resource}
          portals={items.map(item => ({ id: item.id, name: item.name }))}
        />
      </Popover.Content>
    </Popover>
  );
};

export let ResourcePortalAccess = (p: {
  instanceId: string;
  resource: PortalShareResource;
}) => {
  let portals = usePortals(p.instanceId, portalListQuery);

  return renderWithLoader({ portals })(({ portals }) =>
    portals.data.items.length ? (
      <PortalSections>
        {portals.data.items.map(portal => (
          <Box
            key={portal.id}
            noPadding
            title={portal.name}
            description={`Who can use this ${resourceNoun(p.resource)} in the ${portal.name} portal.`}
          >
            <PortalResourceShareBody
              instanceId={p.instanceId}
              portal={{ id: portal.id, name: portal.name }}
              resource={p.resource}
            />
          </Box>
        ))}
      </PortalSections>
    ) : (
      <Box title="Access">
        <Text size="2" color="gray600">
          Create a Workforce portal to share this {resourceNoun(p.resource)} with people in
          your organization.
        </Text>
      </Box>
    )
  );
};
