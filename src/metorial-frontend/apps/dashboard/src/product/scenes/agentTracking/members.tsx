import type { DashboardInstanceAgentTrackingMembersListOutput } from '@metorial/dashboard-sdk';
import { renderWithPagination } from '@metorial/data-hooks';
import { useAgentTrackingMembers } from '@metorial/state';
import { formatNumber } from '@metorial/chart';
import { Callout, Flex, RenderDate, Spacer, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { AgentTrackingErrorState } from './errorState';
import { MemberIdentity, NotLinkedBadge } from './member';
import { HintBadge } from './sessionParts';

let memberListLimit = 1000;

type Member = DashboardInstanceAgentTrackingMembersListOutput['items'][number];

let MemberLink = ({ member }: { member: Member }) => (
  <Flex align="center" gap={6}>
    {member.matched ? (
      <HintBadge
        label="Linked"
        color="green"
        size="1"
        hint={member.consumer ? `Linked to ${member.consumer.email}` : 'Linked'}
      />
    ) : (
      <NotLinkedBadge />
    )}

    {member.needsReview ? (
      <HintBadge
        label="Needs Review"
        color="yellow"
        size="1"
        hint="Created after the daily limit of new members for an ingestion key. Check that this is a real member."
      />
    ) : null}
  </Flex>
);

export let MembersList = ({ instanceId }: { instanceId: string }) => {
  let members = useAgentTrackingMembers(instanceId, { limit: 25 });

  return renderWithPagination(members, {
    emptyState: (
      <Text size="2" color="gray600">
        Nobody has sent data to this instance yet. Members show up here within a minute of
        their first session.
      </Text>
    ),
    error: error => <AgentTrackingErrorState error={error} onRetry={members.refetch} />
  })(members => (
    <>
      {members.data.items[0]?.listTruncated ? (
        <>
          <Callout color="gray">
            More than {formatNumber(memberListLimit)} people have sent data. Only the{' '}
            {formatNumber(memberListLimit)} most recently active are listed.
          </Callout>
          <Spacer height={12} />
        </>
      ) : null}

      <Table
        headers={['Member', 'Linked', 'Sessions', 'Last Seen']}
        data={members.data.items.map(member => [
          <MemberIdentity
            key="name"
            member={member}
            otherEmails={member.emails}
            showLink={false}
          />,
          <MemberLink key="link" member={member} />,
          formatNumber(member.sessions),
          <RenderDate key="lastSeen" date={member.lastSeenAt} />
        ])}
      />
    </>
  ));
};
