import { getAvatarUrl, Paths } from '@metorial/frontend-config';
import { Avatar, Badge, Datalist, Flex, Text } from '@metorial/ui';
import { Link } from 'react-router-dom';
import type { InstanceContext } from '../../lib/dataList';
import { WithInfo } from './info';
import { withQuery, type AgentTrackingRangePreset } from './range';
import { memberName } from './spendSummary';

let unknownMemberDescription = 'API key or Bedrock usage, no email';

let wrapAnywhere = { overflowWrap: 'anywhere' } as const;

type Member = {
  id: string;
  name: string | null;
  email: string | null;
  matched: boolean;
};

type MemberWithDetails = Member & { emails: string[]; needsReview: boolean };

export let memberListLimit = 1000;

export let memberWindowDays = 400;

let rangePhrases: Record<AgentTrackingRangePreset, string> = {
  today: 'today',
  last_7_days: 'in the last 7 days',
  last_30_days: 'in the last 30 days',
  month_to_date: 'this month',
  last_month: 'last month'
};

export let lastActivePhrase = (range: AgentTrackingRangePreset | undefined) =>
  range ? rangePhrases[range] : `in the last ${memberWindowDays} days`;

export let memberPath = (
  ctx: InstanceContext,
  memberId: string,
  range?: AgentTrackingRangePreset
) =>
  withQuery(
    Paths.instance.agentTracking.member(ctx.organization, ctx.project, ctx.instance, memberId),
    { range }
  );

export let MemberIdentity = ({
  member,
  showEmail = true,
  wrap = false
}: {
  member: Member | null;
  showEmail?: boolean;
  wrap?: boolean;
}) => {
  let name = memberName(member);
  let secondary = member ? (member.name ? member.email : null) : unknownMemberDescription;
  let textStyle = wrap ? wrapAnywhere : undefined;

  return (
    <Flex align={wrap ? 'start' : 'center'} gap={10} style={{ minWidth: 0 }}>
      <Avatar
        entity={{ name, imageUrl: member ? getAvatarUrl(member.id) : undefined }}
        size={26}
        noTooltip
      />

      <Flex
        direction="column"
        gap={2}
        style={{ minWidth: 0, maxWidth: wrap ? undefined : 240 }}
      >
        <Text
          as="span"
          size="2"
          weight="medium"
          color={member ? undefined : 'gray600'}
          truncate={!wrap}
          style={textStyle}
        >
          {name}
        </Text>

        {showEmail && secondary ? (
          <Text as="span" size="1" color="gray600" truncate={!wrap} style={textStyle}>
            {secondary}
          </Text>
        ) : null}
      </Flex>
    </Flex>
  );
};

export let memberEmails = (member: MemberWithDetails) =>
  [...new Set([member.email, ...member.emails])].filter((email): email is string => !!email);

export let MemberLinkBadge = ({ matched }: { matched: boolean }) =>
  matched ? (
    <Badge size="1" color="green">
      Linked
    </Badge>
  ) : (
    <WithInfo info="The email of this Claude account matches no member of this organization.">
      <Badge size="1" color="orange">
        Not Linked
      </Badge>
    </WithInfo>
  );

export let MemberReviewBadge = () => (
  <WithInfo info="Created after the daily limit of new members for an ingestion key. Check that this is a real person.">
    <Badge size="1" color="yellow">
      Needs Review
    </Badge>
  </WithInfo>
);

export let MemberDetails = ({
  member,
  href
}: {
  member: MemberWithDetails | null;
  href?: string;
}) => {
  if (!member) {
    return (
      <Datalist
        items={[
          {
            label: 'Member',
            value: (
              <WithInfo info="Usage through an API key or Bedrock carries no email, so it cannot be tied to a person.">
                Unknown
              </WithInfo>
            )
          }
        ]}
      />
    );
  }

  let identity = <MemberIdentity member={member} showEmail={false} wrap />;
  let emails = memberEmails(member);
  let namedByEmail = !member.name && emails.length == 1;

  return (
    <Datalist
      items={[
        { label: 'Member', value: href ? <Link to={href}>{identity}</Link> : identity },
        ...(namedByEmail
          ? []
          : [
              {
                label: emails.length > 1 ? 'Emails' : 'Email',
                value: <span style={wrapAnywhere}>{emails.join(', ') || '—'}</span>
              }
            ]),
        {
          label: 'Metorial',
          value: <MemberLinkBadge matched={member.matched} />
        },
        ...(member.needsReview
          ? [
              {
                label: 'Review',
                value: <MemberReviewBadge />
              }
            ]
          : [])
      ]}
    />
  );
};
