import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { bootType } from '../types';
import { v1InstancePresenter } from './instance';
import { v1OrganizationPresenter } from './organization';
import { v1OrganizationMemberPresenter } from './organizationMember';
import { v1ProjectPresenter } from './project';
import { v1UserPresenter } from './user';

export let v1BootPresenter = Presenter.create(bootType)
  .presenter(async ({ user, organizations, instances, projects }, opts) => ({
    object: 'metorial.boot',

    user: await v1UserPresenter.present({ user }, opts).run(),
    organizations: await Promise.all(
      organizations.map(async organization => ({
        ...(await v1OrganizationPresenter.present({ organization }, opts).run()),
        member: await v1OrganizationMemberPresenter
          .present(
            { organizationMember: { ...organization.member, user, organization } },
            opts
          )
          .run()
      }))
    ),
    projects: await Promise.all(
      projects.map(async project => ({
        ...(await v1ProjectPresenter.present({ project }, opts).run()),
        organization: await v1OrganizationPresenter
          .present({ organization: project.organization }, opts)
          .run()
      }))
    ),
    instances: await Promise.all(
      instances.map(async instance => ({
        ...(await v1InstancePresenter.present({ instance }, opts).run()),
        organization: await v1OrganizationPresenter
          .present({ organization: instance.organization }, opts)
          .run()
      }))
    )
  }))
  .schema(
    v.object({
      object: v.literal('metorial.boot'),

      user: v1UserPresenter.schema,
      organizations: v.array(
        v.intersection([
          v1OrganizationPresenter.schema,
          v.object({
            member: v1OrganizationMemberPresenter.schema
          })
        ]),
        {
          name: 'organizations',
          description: `The user's organizations`
        }
      ),
      projects: v.array(
        v.intersection([
          v1ProjectPresenter.schema,
          v.object({
            organization: v1OrganizationPresenter.schema
          })
        ]),
        {
          name: 'projects',
          description: `The user's projects`
        }
      ),
      instances: v.array(
        v.intersection([
          v1InstancePresenter.schema,
          v.object({
            organization: v1OrganizationPresenter.schema
          })
        ]),
        {
          name: 'instances',
          description: `The user's instances`
        }
      )
    })
  )
  .build();
