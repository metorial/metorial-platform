import { Dialog } from '@metorial/ui';
import { useMemo } from 'react';
import styled from 'styled-components';
import { Avatar } from '../components/Avatar';
import type { SharedPerson } from './HeaderActions';

interface PageInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: SharedPerson[];
  wordCount: number;
  charCount: number;
}

type PersonTimestamp = Date | string | number | null | undefined;

function toDate(value: PersonTimestamp): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  let d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatRelative(date: Date): string {
  let diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return date.toLocaleDateString();
  let sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'Just now';
  let min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  let hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  let day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function describePersonActivity(person: SharedPerson): string {
  let edited = toDate(person.lastEditedAt);
  if (edited) return `Edited ${formatRelative(edited)}`;
  let viewed = toDate(person.lastViewedAt);
  if (viewed) return `Viewed ${formatRelative(viewed)}`;
  return 'Never viewed';
}

let Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

let Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

let SectionTitle = styled.h3`
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme.color.textSubtle};
`;

let StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
`;

let StatCard = styled.div`
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: 10px;
  background: ${({ theme }) => theme.color.bgAlt};
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;

  & > .label {
    font-size: 11px;
    color: ${({ theme }) => theme.color.textSubtle};
  }

  & > .value {
    font-size: 17px;
    font-weight: 700;
    color: ${({ theme }) => theme.color.text};
  }
`;

let PeopleList = styled.div`
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: 10px;
  overflow: hidden;
`;

let PersonRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: ${({ theme }) => theme.color.bg};

  &:not(:first-child) {
    border-top: 1px solid ${({ theme }) => theme.color.border};
  }
`;

let PersonInfo = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: 1px;

  & > .name {
    font-size: 13px;
    font-weight: 500;
    color: ${({ theme }) => theme.color.text};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  & > .email {
    font-size: 11.5px;
    color: ${({ theme }) => theme.color.textSubtle};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

let PersonActivity = styled.span`
  flex-shrink: 0;
  font-size: 11px;
  color: ${({ theme }) => theme.color.textMuted};
  white-space: nowrap;
`;

let EmptyState = styled.div`
  border: 1px dashed ${({ theme }) => theme.color.border};
  border-radius: 10px;
  padding: 12px;
  font-size: 12px;
  color: ${({ theme }) => theme.color.textMuted};
  text-align: center;
`;

function PeopleSection({ people }: { people: SharedPerson[] }) {
  if (people.length === 0) return <EmptyState>No people yet.</EmptyState>;

  return (
    <PeopleList>
      {people.map(p => (
        <PersonRow key={p.email}>
          <Avatar name={p.name} imageUrl={p.imageUrl} email={p.email} size={28} noTooltip />
          <PersonInfo>
            <span className="name">{p.name}</span>
            <span className="email">{p.email}</span>
          </PersonInfo>
          <PersonActivity>{describePersonActivity(p)}</PersonActivity>
        </PersonRow>
      ))}
    </PeopleList>
  );
}

export function PageInfoDialog({
  open,
  onOpenChange,
  people,
  wordCount,
  charCount
}: PageInfoDialogProps) {
  let editors = useMemo(() => people.filter(p => p.role === 'editor'), [people]);
  let viewers = useMemo(() => people.filter(p => p.role === 'viewer'), [people]);

  return (
    <Dialog.Wrapper isOpen={open} onOpenChange={onOpenChange} width={560}>
      <Dialog.Title>Page Info</Dialog.Title>
      <Body>
        <Section>
          <SectionTitle>General</SectionTitle>
          <StatsGrid>
            <StatCard>
              <span className="label">Words</span>
              <span className="value">{wordCount.toLocaleString()}</span>
            </StatCard>
            <StatCard>
              <span className="label">Characters</span>
              <span className="value">{charCount.toLocaleString()}</span>
            </StatCard>
          </StatsGrid>
        </Section>

        <Section>
          <SectionTitle>Editors</SectionTitle>
          <PeopleSection people={editors} />
        </Section>

        <Section>
          <SectionTitle>Viewers</SectionTitle>
          <PeopleSection people={viewers} />
        </Section>
      </Body>
    </Dialog.Wrapper>
  );
}
