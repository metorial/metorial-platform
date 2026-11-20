import { getAvatarUrl } from '@metorial/frontend-config';
import { Avatar, Badge, Flex, InfoTooltip, Text } from '@metorial/ui';
import React from 'react';

let unknownMemberDescription = 'API key or Bedrock usage, no email';

let notLinkedExplanation =
  'This Claude account email matches no member of your Metorial organization, usually because someone signs in to Claude with another address. Its sessions and spend are counted under the email.';

type Member = {
  id: string;
  name: string | null;
  email: string | null;
  matched: boolean;
};

let stopClick = (event: React.MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

export let memberName = (member: { name: string | null; email: string | null } | null) =>
  member ? (member.name ?? member.email ?? 'Unknown Member') : 'Unknown Member';

export let NotLinkedBadge = () => (
  <Flex align="center" gap={2} style={{ flexShrink: 0 }}>
    <Badge size="1" color="orange" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
      Not Linked
    </Badge>

    <Flex onClick={stopClick}>
      <InfoTooltip size={18}>{notLinkedExplanation}</InfoTooltip>
    </Flex>
  </Flex>
);

export let MemberIdentity = ({
  member,
  otherEmails = [],
  showEmail = true,
  showLink = true
}: {
  member: Member | null;
  otherEmails?: string[];
  showEmail?: boolean;
  showLink?: boolean;
}) => {
  let name = memberName(member);
  let email = member?.name && member.email ? member.email : null;
  let secondary = member
    ? [email, ...otherEmails.filter(other => other != member.email && other != name)]
        .filter(Boolean)
        .join(', ')
    : unknownMemberDescription;
  let notLinked = showLink && !!member && !member.matched;
  let badgeBelow = notLinked && showEmail && !secondary;

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

        {badgeBelow ? <NotLinkedBadge /> : null}
      </Flex>

      {notLinked && !badgeBelow ? <NotLinkedBadge /> : null}
    </Flex>
  );
};
