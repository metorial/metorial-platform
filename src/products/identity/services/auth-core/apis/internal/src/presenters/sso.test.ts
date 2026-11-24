import type { SsoScimOperation } from '@mtsrc/auth-core-db';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mtsrc/auth-core-module-sso', () => ({ jackson: {} }));

import {
  ssoCatalogConnectionGroupPresenter,
  ssoCatalogConnectionRolePresenter,
  ssoCatalogDirectoryGroupPresenter,
  ssoCatalogDirectoryRolePresenter,
  ssoCatalogGroupPresenter,
  ssoCatalogRolePresenter,
  ssoScimLogPresenter
} from './sso';

let createdAt = new Date('2026-01-01');
let updatedAt = new Date('2026-01-02');

describe('catalog snapshot presenters', () => {
  it('flattens root groups and roles', () => {
    expect(
      ssoCatalogGroupPresenter({
        id: 'sgr_1',
        value: 'Engineering',
        displayName: 'Engineering',
        metadata: { source: 'saml' },
        createdAt,
        updatedAt
      } as any)
    ).toEqual({
      object: 'ares#ssoCatalogGroup',
      id: 'sgr_1',
      value: 'Engineering',
      displayName: 'Engineering',
      metadata: { source: 'saml' },
      createdAt,
      updatedAt
    });

    expect(
      ssoCatalogRolePresenter({
        id: 'sro_1',
        value: 'admin',
        displayName: null,
        metadata: null,
        createdAt,
        updatedAt
      } as any)
    ).toEqual({
      object: 'ares#ssoCatalogRole',
      id: 'sro_1',
      value: 'admin',
      displayName: null,
      metadata: null,
      createdAt,
      updatedAt
    });
  });

  it('flattens connection groups and roles including an unlinked root', () => {
    expect(
      ssoCatalogConnectionGroupPresenter({
        id: 'ssg_1',
        connection: { id: 'sco_1' },
        rootGroup: { id: 'sgr_1' },
        value: 'Engineering',
        displayName: null,
        metadata: null,
        createdAt,
        updatedAt
      } as any)
    ).toEqual({
      object: 'ares#ssoCatalogConnectionGroup',
      id: 'ssg_1',
      connectionId: 'sco_1',
      groupId: 'sgr_1',
      value: 'Engineering',
      displayName: null,
      metadata: null,
      createdAt,
      updatedAt
    });

    expect(
      ssoCatalogConnectionRolePresenter({
        id: 'ssr_1',
        connection: { id: 'sco_1' },
        rootRole: null,
        value: 'admin',
        displayName: null,
        metadata: null,
        createdAt,
        updatedAt
      } as any).roleId
    ).toBeNull();
  });

  it('flattens directory links to their connection-level parents', () => {
    expect(
      ssoCatalogDirectoryGroupPresenter({
        id: 'sdg_1',
        directory: { id: 'sdi_1' },
        group: { id: 'ssg_1' },
        createdAt,
        updatedAt
      } as any)
    ).toEqual({
      object: 'ares#ssoCatalogDirectoryGroup',
      id: 'sdg_1',
      directoryId: 'sdi_1',
      connectionGroupId: 'ssg_1',
      createdAt,
      updatedAt
    });

    expect(
      ssoCatalogDirectoryRolePresenter({
        id: 'sdrt_1',
        directory: { id: 'sdi_1' },
        role: { id: 'ssr_1' },
        createdAt,
        updatedAt
      } as any)
    ).toEqual({
      object: 'ares#ssoCatalogDirectoryRole',
      id: 'sdrt_1',
      directoryId: 'sdi_1',
      connectionRoleId: 'ssr_1',
      createdAt,
      updatedAt
    });
  });
});

it('renders historical SCIM errors without their original details or unauthorized payloads', () => {
  let log = ssoScimLogPresenter({
    statusCode: 401,
    errorMessage: 'Private diagnostic',
    requestBody: { userName: 'person' },
    query: { filter: 'private filter', count: 10 },
    responseBody: { detail: 'Private diagnostic' }
  } as SsoScimOperation);

  expect(log.errorMessage).toBe('Unauthorized');
  expect(log.query).toEqual({ filter: '[Redacted]', count: 10 });
  expect(log.requestBody).toBeNull();
  expect(log.responseBody).toMatchObject({ detail: 'Unauthorized', status: '401' });
});
