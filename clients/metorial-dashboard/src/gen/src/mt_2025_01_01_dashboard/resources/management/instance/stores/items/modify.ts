import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceStoresItemsModifyOutput = {
  object: 'list(store.item)';
  items: {
    object: 'store.item';
    id: string;
    kind: 'file' | 'document' | 'directory';
    path: string;
    storeId: string;
    directoryId: string | null;
    file: {
      object: 'file';
      id: string;
      status: 'active' | 'deleted';
      fileName: string;
      fileSize: number;
      fileType: string;
      title: string;
      purpose: string;
      createdBy: {
        type: 'organization_actor' | 'consumer' | 'unknown';
        name: string;
        imageUrl: string | null;
        email: string | null;
        organizationActor: {
          object: 'organization.actor';
          id: string;
          type: 'member' | 'machine_access';
          organizationId: string;
          name: string;
          email: string | null;
          imageUrl: string;
          teams: {
            id: string;
            name: string;
            slug: string;
            assignmentId: string;
            createdAt: Date;
            updatedAt: Date;
          }[];
          createdAt: Date;
          updatedAt: Date;
        } | null;
        consumer: {
          object: 'consumer';
          id: string;
          name: string;
          email: string;
          imageUrl: string;
          createdAt: Date;
          updatedAt: Date;
        } | null;
      } | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    document: {
      object: 'document';
      id: string;
      status: 'active' | 'deleted';
      title: string;
      content: string;
      fileId: string;
      parentDocumentId: string | null;
      currentVersionId: string | null;
      createdBy: {
        type: 'organization_actor' | 'consumer' | 'unknown';
        name: string;
        imageUrl: string | null;
        email: string | null;
        organizationActor: {
          object: 'organization.actor';
          id: string;
          type: 'member' | 'machine_access';
          organizationId: string;
          name: string;
          email: string | null;
          imageUrl: string;
          teams: {
            id: string;
            name: string;
            slug: string;
            assignmentId: string;
            createdAt: Date;
            updatedAt: Date;
          }[];
          createdAt: Date;
          updatedAt: Date;
        } | null;
        consumer: {
          object: 'consumer';
          id: string;
          name: string;
          email: string;
          imageUrl: string;
          createdAt: Date;
          updatedAt: Date;
        } | null;
      } | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
};

export let mapManagementInstanceStoresItemsModifyOutput =
  mtMap.object<ManagementInstanceStoresItemsModifyOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          kind: mtMap.objectField('kind', mtMap.passthrough()),
          path: mtMap.objectField('path', mtMap.passthrough()),
          storeId: mtMap.objectField('store_id', mtMap.passthrough()),
          directoryId: mtMap.objectField('directory_id', mtMap.passthrough()),
          file: mtMap.objectField(
            'file',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              fileName: mtMap.objectField('file_name', mtMap.passthrough()),
              fileSize: mtMap.objectField('file_size', mtMap.passthrough()),
              fileType: mtMap.objectField('file_type', mtMap.passthrough()),
              title: mtMap.objectField('title', mtMap.passthrough()),
              purpose: mtMap.objectField('purpose', mtMap.passthrough()),
              createdBy: mtMap.objectField(
                'created_by',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                  email: mtMap.objectField('email', mtMap.passthrough()),
                  organizationActor: mtMap.objectField(
                    'organization_actor',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      type: mtMap.objectField('type', mtMap.passthrough()),
                      organizationId: mtMap.objectField(
                        'organization_id',
                        mtMap.passthrough()
                      ),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      email: mtMap.objectField('email', mtMap.passthrough()),
                      imageUrl: mtMap.objectField(
                        'image_url',
                        mtMap.passthrough()
                      ),
                      teams: mtMap.objectField(
                        'teams',
                        mtMap.array(
                          mtMap.object({
                            id: mtMap.objectField('id', mtMap.passthrough()),
                            name: mtMap.objectField(
                              'name',
                              mtMap.passthrough()
                            ),
                            slug: mtMap.objectField(
                              'slug',
                              mtMap.passthrough()
                            ),
                            assignmentId: mtMap.objectField(
                              'assignment_id',
                              mtMap.passthrough()
                            ),
                            createdAt: mtMap.objectField(
                              'created_at',
                              mtMap.date()
                            ),
                            updatedAt: mtMap.objectField(
                              'updated_at',
                              mtMap.date()
                            )
                          })
                        )
                      ),
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date())
                    })
                  ),
                  consumer: mtMap.objectField(
                    'consumer',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      email: mtMap.objectField('email', mtMap.passthrough()),
                      imageUrl: mtMap.objectField(
                        'image_url',
                        mtMap.passthrough()
                      ),
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date())
                    })
                  )
                })
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          document: mtMap.objectField(
            'document',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              title: mtMap.objectField('title', mtMap.passthrough()),
              content: mtMap.objectField('content', mtMap.passthrough()),
              fileId: mtMap.objectField('file_id', mtMap.passthrough()),
              parentDocumentId: mtMap.objectField(
                'parent_document_id',
                mtMap.passthrough()
              ),
              currentVersionId: mtMap.objectField(
                'current_version_id',
                mtMap.passthrough()
              ),
              createdBy: mtMap.objectField(
                'created_by',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                  email: mtMap.objectField('email', mtMap.passthrough()),
                  organizationActor: mtMap.objectField(
                    'organization_actor',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      type: mtMap.objectField('type', mtMap.passthrough()),
                      organizationId: mtMap.objectField(
                        'organization_id',
                        mtMap.passthrough()
                      ),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      email: mtMap.objectField('email', mtMap.passthrough()),
                      imageUrl: mtMap.objectField(
                        'image_url',
                        mtMap.passthrough()
                      ),
                      teams: mtMap.objectField(
                        'teams',
                        mtMap.array(
                          mtMap.object({
                            id: mtMap.objectField('id', mtMap.passthrough()),
                            name: mtMap.objectField(
                              'name',
                              mtMap.passthrough()
                            ),
                            slug: mtMap.objectField(
                              'slug',
                              mtMap.passthrough()
                            ),
                            assignmentId: mtMap.objectField(
                              'assignment_id',
                              mtMap.passthrough()
                            ),
                            createdAt: mtMap.objectField(
                              'created_at',
                              mtMap.date()
                            ),
                            updatedAt: mtMap.objectField(
                              'updated_at',
                              mtMap.date()
                            )
                          })
                        )
                      ),
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date())
                    })
                  ),
                  consumer: mtMap.objectField(
                    'consumer',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      email: mtMap.objectField('email', mtMap.passthrough()),
                      imageUrl: mtMap.objectField(
                        'image_url',
                        mtMap.passthrough()
                      ),
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date())
                    })
                  )
                })
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    )
  });

export type ManagementInstanceStoresItemsModifyBody = {
  operations: {
    type?: 'add' | 'modify' | 'remove' | undefined;
    itemId?: string | undefined;
    fileId?: string | undefined;
    documentId?: string | undefined;
    path?: string | undefined;
  }[];
};

export let mapManagementInstanceStoresItemsModifyBody =
  mtMap.object<ManagementInstanceStoresItemsModifyBody>({
    operations: mtMap.objectField(
      'operations',
      mtMap.array(
        mtMap.object({
          type: mtMap.objectField('type', mtMap.passthrough()),
          itemId: mtMap.objectField('itemId', mtMap.passthrough()),
          fileId: mtMap.objectField('fileId', mtMap.passthrough()),
          documentId: mtMap.objectField('documentId', mtMap.passthrough()),
          path: mtMap.objectField('path', mtMap.passthrough())
        })
      )
    )
  });

