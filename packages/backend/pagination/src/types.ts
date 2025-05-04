export interface PaginatedList<T> {
  items: T[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    beforeCursor: string | null;
    afterCursor: string | null;
  };
}
