import type { Index, Record } from '../../prisma/generated/client';

export abstract class Backend {
  abstract indexRecords(index: Index, records: Record[]): Promise<void>;
  abstract deleteRecordsById(index: Index, recordIds: string[]): Promise<void>;
  abstract searchRecords(
    index: Index,
    d: SearchParams
  ): Promise<{ records: { documentId: string }[] }>;
  abstract isEnabled(): boolean;
}

export interface SearchParams {
  query: string;
  filters?: { [key: string]: any };
  tenantOids?: bigint[];
}
