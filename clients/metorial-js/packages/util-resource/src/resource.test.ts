import { describe, expect, it } from 'vitest';
import {
  AnyObject,
  createMetorialResource,
  createPaginatedMetorialResource,
  MetorialResource,
  MetorialResourceFactory
} from './resource';

describe('createMetorialResource', () => {
  type TestResource = { id: number; name: string };
  const attributeMappers = {
    id: (value: number) => value.toString(),
    name: (value: string) => value.toUpperCase()
  };

  const resourceFactory = createMetorialResource<TestResource>()({
    name: 'TestResource',
    attributes: { id: 'id', name: 'name' },
    attributeMappers
  });

  it('should create a resource with mapped attributes', () => {
    const input: AnyObject = { id: 1, name: 'test' };
    const resource = resourceFactory(input);

    expect(resource).toEqual({
      __typename: 'TestResource',
      id: '1',
      name: 'TEST'
    });
  });

  it('should handle missing attributes', () => {
    const input: AnyObject = { id: 1 };
    const resource = resourceFactory(input);

    expect(resource).toEqual({
      __typename: 'TestResource',
      id: '1',
      name: null
    });
  });
});

describe('createPaginatedMetorialResource', () => {
  type TestResource = MetorialResource<{ id: number }, 'TestResource'>;
  const resourceFactory: MetorialResourceFactory<TestResource> = createMetorialResource<{
    id: number;
  }>()({
    name: 'TestResource',
    attributes: { id: 'id' },
    attributeMappers: { id: (value: number) => value }
  });

  const paginatedResourceFactory = createPaginatedMetorialResource(resourceFactory);

  it('should create a paginated resource list', () => {
    const response = {
      items: [{ id: 1 }, { id: 2 }],
      pagination: {
        afterCursor: null,
        beforeCursor: null,
        hasMoreBefore: false,
        hasMoreAfter: false,
        pageSize: 5
      }
    };

    const paginatedResource = paginatedResourceFactory(response);

    expect(paginatedResource).toEqual({
      __typename: 'paginated_list',
      items: [
        { __typename: 'TestResource', id: 1 },
        { __typename: 'TestResource', id: 2 }
      ],
      pagination: {
        afterCursor: null,
        beforeCursor: null,
        hasMoreBefore: false,
        hasMoreAfter: false,
        pageSize: 5
      }
    });
  });
});
