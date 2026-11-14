import { SubjectAvatar } from '@metorial/access-ui';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  usePortalConsumerGroups
} from '@metorial/state';
import { Combobox, Select, Switch, Text, confirm, theme } from '@metorial/ui';
import { RiGroupLine, RiInformationLine } from '@remixicon/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import {
  PortalShareTargetItem,
  displayConsumerGroupName,
  personalGroupEmail,
  usePortalShareTargets,
  type PortalShareTargetOption
} from './shareTargets';
import {
  useIntegrationShareTemplates,
  useResourcePortalShare,
  type PortalShareResource,
  type PortalShareTarget
} from './useResourcePortalShare';

export type PortalShareResourcePortal = { id: string; name: string };

let AddRow = styled.div`
  padding: 12px 16px;
`;

let RowList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 16px 8px 16px;
  max-height: 320px;
  overflow: auto;
`;

let Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
`;

let RowInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
`;

let RowName = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.foreground};
`;

let Truncate = styled.span`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

let Muted = styled.span`
  font-size: 12px;
  color: ${theme.colors.gray700};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

let Wrapping = styled(Muted)`
  white-space: normal;

  a {
    color: ${theme.colors.foreground};
    text-decoration: underline;
  }
`;

let GroupPill = styled.span`
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  background: ${theme.colors.gray200};
  color: ${theme.colors.gray800};
  font-size: 11px;
  font-weight: 600;
`;

let SelectWrap = styled.div`
  width: 132px;
  flex: 0 0 auto;
`;

let IconAvatar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: ${theme.colors.gray200};
  color: ${theme.colors.gray800};
  flex: 0 0 auto;
`;

let Section = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-top: 1px solid ${theme.colors.gray300};
`;

let ConnectionSection = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray100};
  color: ${theme.colors.gray700};

  svg {
    flex: 0 0 auto;
    margin-top: 1px;
  }
`;

let SectionTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${theme.colors.foreground};
`;

let EmptyState = styled.div`
  padding: 8px 0 12px 0;
`;

let grantLevelItems = [
  { id: 'use', label: 'Can use' },
  { id: 'none', label: 'Remove' }
];

let everyoneLevelItems = [
  { id: 'use', label: 'Can use' },
  { id: 'none', label: 'No access' }
];

let resourceNoun = (resource: PortalShareResource) =>
  resource.type == 'integration' ? 'integration' : 'Magic MCP server';

let ShareBody = (p: {
  instanceId: string;
  portal: PortalShareResourcePortal;
  resource: PortalShareResource;
  target: PortalShareTarget;
}) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let share = useResourcePortalShare({
    instanceId: p.instanceId,
    portalId: p.portal.id,
    resource: p.resource,
    target: p.target
  });
  let groups = usePortalConsumerGroups(p.instanceId, p.portal.id, {
    limit: 100,
    order: 'asc'
  });
  let [busyGroupId, setBusyGroupId] = useState<string | null>(null);

  let everyoneGroup = groups.data?.items.find(group => group.isDefault);
  let everyoneGrant = share.grants.find(grant => grant.consumerGroup.isDefault);
  let rows = share.grants.filter(grant => !grant.consumerGroup.isDefault);
  let grantedGroupIds = new Set(share.grants.map(grant => grant.consumerGroup.id));

  let withBusy = async (consumerGroupId: string, action: () => Promise<unknown>) => {
    setBusyGroupId(consumerGroupId);
    await action();
    setBusyGroupId(null);
  };

  let removeGrant = (grant: (typeof share.grants)[number]) =>
    confirm({
      title: 'Remove Access',
      description: `${displayConsumerGroupName(grant.consumerGroup.name)} will lose access to ${p.resource.name} in ${p.portal.name}.`,
      confirmText: 'Remove',
      onConfirm: () => withBusy(grant.consumerGroup.id, () => share.revoke(grant.id))
    });

  return renderWithLoader(share.loaders)(() => (
    <>
      <AddRow>
        <Combobox<PortalShareTargetOption>
          label="Add access groups or people"
          hideLabel
          size="2"
          placeholder="Add access groups or people…"
          disabled={share.isGranting}
          value={null}
          provider={({ searchQuery }) =>
            usePortalShareTargets({
              instanceId: p.instanceId,
              portalId: p.portal.id,
              searchQuery,
              excludeGroupIds: grantedGroupIds
            })
          }
          renderItem={item => <PortalShareTargetItem item={item} />}
          hideItemIndicator
          onChange={async (_, item) => {
            if (!item?.data) return;
            let consumerGroupId = item.data.consumerGroupId;
            await withBusy(consumerGroupId, () => share.grant(consumerGroupId));
          }}
        />
      </AddRow>

      <RowList>
        {rows.map(grant => {
          let email = personalGroupEmail(grant.consumerGroup.name);

          return (
            <Row key={grant.id}>
              <SubjectAvatar
                kind={email ? 'person' : 'group'}
                id={grant.consumerGroup.id}
                name={displayConsumerGroupName(grant.consumerGroup.name)}
                size={36}
              />
              <RowInfo>
                <RowName>
                  <Truncate>{displayConsumerGroupName(grant.consumerGroup.name)}</Truncate>
                  {!email && <GroupPill>Access Group</GroupPill>}
                </RowName>
                <Muted>
                  {email ? 'Person' : grant.consumerGroup.description || 'Access Group'}
                </Muted>
              </RowInfo>
              <SelectWrap>
                <Select
                  label="Access"
                  hideLabel
                  size="2"
                  value="use"
                  disabled={busyGroupId == grant.consumerGroup.id}
                  items={grantLevelItems}
                  onChange={value => {
                    if (value == 'none') removeGrant(grant);
                  }}
                />
              </SelectWrap>
            </Row>
          );
        })}

        {rows.length == 0 && (
          <EmptyState>
            <Text size="2" color="gray600">
              No access groups or people added yet.
            </Text>
          </EmptyState>
        )}
      </RowList>

      {everyoneGroup && (
        <Section>
          <IconAvatar>
            <RiGroupLine size={18} />
          </IconAvatar>
          <RowInfo>
            <RowName>
              <Truncate>Everyone at {p.portal.name}</Truncate>
            </RowName>
            <Muted>Anyone with a portal account</Muted>
          </RowInfo>
          <SelectWrap>
            <Select
              label="Access for everyone"
              hideLabel
              size="2"
              value={everyoneGrant ? 'use' : 'none'}
              disabled={busyGroupId == everyoneGroup.id || share.isGranting}
              items={everyoneLevelItems}
              onChange={value => {
                if (value == 'use' && !everyoneGrant) {
                  withBusy(everyoneGroup.id, () => share.grant(everyoneGroup.id));
                }
                if (value == 'none' && everyoneGrant) removeGrant(everyoneGrant);
              }}
            />
          </SelectWrap>
        </Section>
      )}

      <ConnectionSection>
        <RiInformationLine size={14} />
        {p.resource.type == 'integration' ? (
          <Wrapping>
            Each person connects with their own account. Want everyone to share one login?{' '}
            <Link
              to={Paths.instance.magicMcp.servers(
                organization.data,
                project.data,
                instance.data
              )}
            >
              Create a Magic MCP server
            </Link>{' '}
            and share that instead.
          </Wrapping>
        ) : (
          <Wrapping>
            Shared connection. Everyone with access uses the connection configured on this
            server.
          </Wrapping>
        )}
      </ConnectionSection>

      <Section>
        <RowInfo>
          <SectionTitle>Show in portal catalog</SectionTitle>
          <Wrapping>
            {!share.listing
              ? `Added to the ${p.portal.name} catalog when you first share it.`
              : share.listing.isDiscoverable
                ? `Everyone at ${p.portal.name} can find this ${resourceNoun(p.resource)} and request access.`
                : `Only people with access see this ${resourceNoun(p.resource)}.`}
          </Wrapping>
        </RowInfo>
        <Switch
          hideLabel
          label="Show in portal catalog"
          checked={share.listing ? share.listing.isDiscoverable : true}
          disabled={!share.listing || share.mutators.updateListing.isLoading}
          onCheckedChange={checked => share.setDiscoverable(!!checked)}
        />
      </Section>

      <div>
        <share.mutators.createTemplate.RenderError />
        <share.mutators.createAccess.RenderError />
        <share.mutators.deleteAccess.RenderError />
        <share.mutators.updateListing.RenderError />
      </div>
    </>
  ));
};

let IntegrationShareBody = (p: {
  instanceId: string;
  portal: PortalShareResourcePortal;
  resource: PortalShareResource;
}) => {
  let templates = useIntegrationShareTemplates(p.instanceId, p.resource);

  return renderWithLoader({ templates })(({ templates }) => (
    <ShareBody
      {...p}
      target={{
        type: 'provider_template',
        providerTemplateIds: templates.data.map(template => template.id)
      }}
    />
  ));
};

export let PortalResourceShareBody = (p: {
  instanceId: string;
  portal: PortalShareResourcePortal;
  resource: PortalShareResource;
}) =>
  p.resource.type == 'integration' ? (
    <IntegrationShareBody {...p} />
  ) : (
    <ShareBody {...p} target={{ type: 'magic_mcp_server', magicMcpServerId: p.resource.id }} />
  );
