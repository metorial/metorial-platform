import { getAvatarUrl, Paths } from '@metorial/frontend-config';
import { Avatar, Badge, Datalist, Flex, Text } from '@metorial/ui';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { InstanceContext } from '../../lib/dataList';
import { WithInfo } from './info';
import { withQuery, type AgentTrackingRangePreset } from './range';

let unknownMemberDescription = 'API key or Bedrock usage, no email';

type Member = {
  id: string;
  name: string | null;
  email: string | null;
  matched: boolean;
};

type MemberWithDetails = Member & { emails: string[]; needsReview: boolean };

export let memberName = (member: { name: string | null; email: string | null } | null) =>
  member ? (member.name ?? member.email ?? 'Unknown Member') : 'Unknown Member';

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
  showEmail = true
}: {
  member: Member | null;
  showEmail?: boolean;
}) => {
  let name = memberName(member);
  let secondary = member ? (member.name ? member.email : null) : unknownMemberDescription;

  return (
    <Flex align="center" gap={10} style={{ minWidth: 0 }}>
      <Avatar
        entity={{ name, imageUrl: member ? getAvatarUrl(member.id) : undefined }}
        size={26}
        noTooltip
      />

      <Flex direction="column" gap={2} style={{ minWidth: 0, maxWidth: 240 }}>
        <Text
          as="span"
          size="2"
          weight="medium"
          color={member ? undefined : 'gray600'}
          truncate
        >
          {name}
        </Text>

        {showEmail && secondary ? (
          <Text as="span" size="1" color="gray600" truncate>
            {secondary}
          </Text>
        ) : null}
      </Flex>
    </Flex>
  );
};

let Explained = ({ label, text }: { label: ReactNode; text: string }) => (
  <WithInfo info={text}>{label}</WithInfo>
);

export let memberEmails = (member: MemberWithDetails) =>
  [...new Set([member.email, ...member.emails])].filter((email): email is string => !!email);

export let MemberLinkBadge = ({ matched }: { matched: boolean }) =>
  matched ? (
    <Badge size="1" color="green">
      Linked
    </Badge>
  ) : (
    <Explained
      label={
        <Badge size="1" color="orange">
          Not Linked
        </Badge>
      }
      text="The email of this Claude account matches no member of this organization."
    />
  );

export let MemberReviewBadge = () => (
  <Explained
    label={
      <Badge size="1" color="yellow">
        Needs Review
      </Badge>
    }
    text="Created after the daily limit of new members for an ingestion key. Check that this is a real person."
  />
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
              <Explained
                label="Unknown"
                text="Usage through an API key or Bedrock carries no email, so it cannot be tied to a person."
              />
            )
          }
        ]}
      />
    );
  }

  let identity = <MemberIdentity member={member} showEmail={false} />;
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
                value: emails.join(', ') || '—'
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
