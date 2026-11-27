import { repositoryLabel } from './sessionContext';
import { memberName, unknownRepositoryLabel } from './spendSummary';

let unknownProviderLabel = 'Unknown Provider';

export let providerLabel = (provider: { name: string | null }) =>
  provider.name ?? unknownProviderLabel;

export type ProviderCallGroup = 'repository' | 'member';

type Repository = Parameters<typeof repositoryLabel>[0] & { id: string };

type Member = Parameters<typeof memberName>[0];

type ProviderCallItem = {
  kind: string;
  key: string;
  repository: Repository | null;
  member: Member;
  calls: number;
  failed: number;
};

type ProviderCallRow = {
  key: string;
  label: string;
  href: string | null;
  count: number;
  errorCount: number;
};

export let providerCallRows = (
  items: ProviderCallItem[],
  d: {
    groupBy: ProviderCallGroup;
    repositoryHref: (repositoryId: string) => string;
    memberHref: (memberId: string) => string;
  }
): ProviderCallRow[] =>
  items.flatMap(item => {
    if (item.kind == 'other') return [];

    let figures = { key: item.key, count: item.calls, errorCount: item.failed };

    if (d.groupBy == 'repository') {
      return [
        {
          ...figures,
          label: item.repository ? repositoryLabel(item.repository) : unknownRepositoryLabel,
          href: item.kind == 'repository' ? d.repositoryHref(item.key) : null
        }
      ];
    }

    return [
      {
        ...figures,
        label: memberName(item.kind == 'member' ? item.member : null),
        href: item.kind == 'member' ? d.memberHref(item.key) : null
      }
    ];
  });
