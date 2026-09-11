import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  OUTPOST_SERVICES,
  outpostAccessService,
  outpostCredentialService,
  outpostService
} from '@metorial/module-outpost';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import {
  organizationGroup,
  organizationManagementPath
} from '../../../middleware/organizationGroup';
import {
  outpostAccessPresenter,
  outpostCredentialPresenter,
  outpostPresenter
} from '@metorial/presenters';

export let outpostManagementController = Controller.create(
  {
    name: 'Outpost',
    description: 'Read and write outposts, their access grants, and credentials'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('outposts', 'outposts.list'), {
        name: 'List outposts',
        description: "List every outpost in the organization's account family"
      })
      .use(checkAccess({ possibleScopes: ['organization.outpost:read'] }))
      .use(hasFlags(['outposts']))
      .outputList(outpostPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await outpostService.listOutpostsInFamily({
          organization: ctx.organization
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, outpost => outpostPresenter.present({ outpost }));
      }),

    get: organizationGroup
      .get(organizationManagementPath('outposts/:outpostId', 'outposts.get'), {
        name: 'Get outpost',
        description: "Get any outpost in the organization's account family"
      })
      .use(checkAccess({ possibleScopes: ['organization.outpost:read'] }))
      .use(hasFlags(['outposts']))
      .output(outpostPresenter)
      .do(async ctx => {
        let outpost = await outpostService.getOutpostInFamily({
          organization: ctx.organization,
          outpostId: ctx.params.outpostId
        });

        return outpostPresenter.present({ outpost });
      }),

    create: organizationGroup
      .post(organizationManagementPath('outposts', 'outposts.create'), {
        name: 'Create outpost',
        description: 'Create a new outpost owned by this organization'
      })
      .use(checkAccess({ possibleScopes: ['organization.outpost:write'] }))
      .use(hasFlags(['outposts']))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string())
        })
      )
      .output(outpostPresenter)
      .do(async ctx => {
        let outpost = await outpostService.createOutpost({
          organization: ctx.organization,
          input: { name: ctx.body.name, description: ctx.body.description },
          auditScope: ctx.auditScope
        });

        return outpostPresenter.present({ outpost });
      }),

    update: organizationGroup
      .post(organizationManagementPath('outposts/:outpostId', 'outposts.update'), {
        name: 'Update outpost',
        description: 'Update the information of an outpost owned by this organization'
      })
      .use(checkAccess({ possibleScopes: ['organization.outpost:write'] }))
      .use(hasFlags(['outposts']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string())
        })
      )
      .output(outpostPresenter)
      .do(async ctx => {
        let outpost = await outpostService.getOwnedOutpostById({
          organization: ctx.organization,
          outpostId: ctx.params.outpostId
        });

        outpost = await outpostService.updateOutpost({
          outpost,
          organization: ctx.organization,
          input: { name: ctx.body.name, description: ctx.body.description },
          auditScope: ctx.auditScope
        });

        return outpostPresenter.present({ outpost });
      }),

    disable: organizationGroup
      .post(organizationManagementPath('outposts/:outpostId/disable', 'outposts.disable'), {
        name: 'Disable outpost',
        description:
          'Disable an outpost owned by this organization. An outpost must be disabled before it can be deleted.'
      })
      .use(checkAccess({ possibleScopes: ['organization.outpost:write'] }))
      .use(hasFlags(['outposts']))
      .output(outpostPresenter)
      .do(async ctx => {
        let outpost = await outpostService.getOwnedOutpostById({
          organization: ctx.organization,
          outpostId: ctx.params.outpostId
        });

        outpost = await outpostService.disableOutpost({
          outpost,
          organization: ctx.organization,
          auditScope: ctx.auditScope
        });

        return outpostPresenter.present({ outpost });
      }),

    enable: organizationGroup
      .post(organizationManagementPath('outposts/:outpostId/enable', 'outposts.enable'), {
        name: 'Enable outpost',
        description: 'Enable a disabled outpost owned by this organization'
      })
      .use(checkAccess({ possibleScopes: ['organization.outpost:write'] }))
      .use(hasFlags(['outposts']))
      .output(outpostPresenter)
      .do(async ctx => {
        let outpost = await outpostService.getOwnedOutpostById({
          organization: ctx.organization,
          outpostId: ctx.params.outpostId
        });

        outpost = await outpostService.enableOutpost({
          outpost,
          organization: ctx.organization,
          auditScope: ctx.auditScope
        });

        return outpostPresenter.present({ outpost });
      }),

    delete: organizationGroup
      .delete(organizationManagementPath('outposts/:outpostId', 'outposts.delete'), {
        name: 'Delete outpost',
        description: 'Delete a disabled outpost owned by this organization'
      })
      .use(checkAccess({ possibleScopes: ['organization.outpost:write'] }))
      .use(hasFlags(['outposts']))
      .output(outpostPresenter)
      .do(async ctx => {
        let outpost = await outpostService.getOwnedOutpostById({
          organization: ctx.organization,
          outpostId: ctx.params.outpostId
        });

        outpost = await outpostService.deleteOutpost({
          outpost,
          organization: ctx.organization,
          auditScope: ctx.auditScope
        });

        return outpostPresenter.present({ outpost });
      }),

    setAccess: organizationGroup
      .post(organizationManagementPath('outposts/:outpostId/access', 'outposts.access.set'), {
        name: 'Set outpost access',
        description:
          "Replace this organization's access grants on an outpost with the given list of instance/service grants"
      })
      .use(checkAccess({ possibleScopes: ['organization.outpost:write'] }))
      .use(hasFlags(['outposts']))
      .body(
        'default',
        v.object({
          grants: v.array(
            v.object({
              instance_id: v.string(),
              services: v.array(v.enumOf(OUTPOST_SERVICES))
            })
          )
        })
      )
      .outputList(outpostAccessPresenter)
      .do(async ctx => {
        let outpost = await outpostService.getOutpostInFamily({
          organization: ctx.organization,
          outpostId: ctx.params.outpostId
        });

        let access = await outpostAccessService.setAccessForOrganization({
          outpost,
          organization: ctx.organization,
          grants: ctx.body.grants.map(grant => ({
            instanceId: grant.instance_id,
            services: grant.services
          })),
          auditScope: ctx.auditScope
        });

        return Paginator.present(
          { items: access, pagination: { hasNextPage: false, hasPreviousPage: false } },
          item => outpostAccessPresenter.present({ access: item })
        );
      }),

    listAccess: organizationGroup
      .get(organizationManagementPath('outposts/:outpostId/access', 'outposts.access.list'), {
        name: 'List outpost access',
        description:
          'List the access grants on an outpost, optionally filtered by organization or instance'
      })
      .use(checkAccess({ possibleScopes: ['organization.outpost:read'] }))
      .use(hasFlags(['outposts']))
      .outputList(outpostAccessPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            organization_id: v.optional(v.string()),
            instance_id: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let outpost = await outpostService.getOutpostInFamily({
          organization: ctx.organization,
          outpostId: ctx.params.outpostId
        });

        let paginator = await outpostAccessService.listAccess({
          outpost,
          filter: {
            organizationId: ctx.query.organization_id,
            instanceId: ctx.query.instance_id
          }
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, access => outpostAccessPresenter.present({ access }));
      }),

    createCredential: organizationGroup
      .post(
        organizationManagementPath(
          'outposts/:outpostId/credentials',
          'outposts.credentials.create'
        ),
        {
          name: 'Create outpost credential',
          description:
            'Create a new enrollment credential for an outpost owned by this organization',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.outpost:write'] }))
      .use(hasFlags(['outposts']))
      .body(
        'default',
        v.object({
          name: v.string(),
          expires_at: v.optional(v.date())
        })
      )
      .output(outpostCredentialPresenter)
      .do(async ctx => {
        let outpost = await outpostService.getOwnedOutpostById({
          organization: ctx.organization,
          outpostId: ctx.params.outpostId
        });

        let { credential, envelope } = await outpostCredentialService.createCredential({
          outpost,
          organization: ctx.organization,
          input: { name: ctx.body.name, expiresAt: ctx.body.expires_at },
          auditScope: ctx.auditScope
        });

        return outpostCredentialPresenter.present({ outpost, credential, envelope });
      }),

    listCredentials: organizationGroup
      .get(
        organizationManagementPath(
          'outposts/:outpostId/credentials',
          'outposts.credentials.list'
        ),
        {
          name: 'List outpost credentials',
          description: 'List the credentials for an outpost owned by this organization'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.outpost:read'] }))
      .use(hasFlags(['outposts']))
      .outputList(outpostCredentialPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let outpost = await outpostService.getOwnedOutpostById({
          organization: ctx.organization,
          outpostId: ctx.params.outpostId
        });

        let paginator = await outpostCredentialService.listCredentials({ outpost });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, credential =>
          outpostCredentialPresenter.present({ outpost, credential })
        );
      }),

    getCredential: organizationGroup
      .get(
        organizationManagementPath(
          'outposts/:outpostId/credentials/:credentialId',
          'outposts.credentials.get'
        ),
        {
          name: 'Get outpost credential',
          description: 'Get a credential for an outpost owned by this organization'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.outpost:read'] }))
      .use(hasFlags(['outposts']))
      .output(outpostCredentialPresenter)
      .do(async ctx => {
        let outpost = await outpostService.getOwnedOutpostById({
          organization: ctx.organization,
          outpostId: ctx.params.outpostId
        });

        let credential = await outpostCredentialService.getCredentialById({
          outpost,
          credentialId: ctx.params.credentialId
        });

        return outpostCredentialPresenter.present({ outpost, credential });
      }),

    disableCredential: organizationGroup
      .post(
        organizationManagementPath(
          'outposts/:outpostId/credentials/:credentialId/disable',
          'outposts.credentials.disable'
        ),
        {
          name: 'Disable outpost credential',
          description:
            'Disable a credential for an outpost owned by this organization. A credential must be disabled before it can be deleted.'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.outpost:write'] }))
      .use(hasFlags(['outposts']))
      .output(outpostCredentialPresenter)
      .do(async ctx => {
        let outpost = await outpostService.getOwnedOutpostById({
          organization: ctx.organization,
          outpostId: ctx.params.outpostId
        });

        let credential = await outpostCredentialService.getCredentialById({
          outpost,
          credentialId: ctx.params.credentialId
        });

        credential = await outpostCredentialService.disableCredential({
          credential,
          outpost,
          organization: ctx.organization,
          auditScope: ctx.auditScope
        });

        return outpostCredentialPresenter.present({ outpost, credential });
      }),

    deleteCredential: organizationGroup
      .delete(
        organizationManagementPath(
          'outposts/:outpostId/credentials/:credentialId',
          'outposts.credentials.delete'
        ),
        {
          name: 'Delete outpost credential',
          description: 'Delete a disabled credential for an outpost owned by this organization'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.outpost:write'] }))
      .use(hasFlags(['outposts']))
      .output(outpostCredentialPresenter)
      .do(async ctx => {
        let outpost = await outpostService.getOwnedOutpostById({
          organization: ctx.organization,
          outpostId: ctx.params.outpostId
        });

        let credential = await outpostCredentialService.getCredentialById({
          outpost,
          credentialId: ctx.params.credentialId
        });

        credential = await outpostCredentialService.deleteCredential({
          credential,
          outpost,
          organization: ctx.organization,
          auditScope: ctx.auditScope
        });

        return outpostCredentialPresenter.present({ outpost, credential });
      })
  }
);
