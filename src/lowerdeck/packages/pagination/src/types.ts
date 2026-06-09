export interface PaginatedList<T> {
  items: T[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
