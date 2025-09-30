import { profileService } from '@metorial/module-community';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';
import { profilePresenter } from '../../presenters';

export let profileController = Controller.create(
  {
    name: 'Profile',
    description: 'Get and manage profile information'
  },
  {
    get: organizationGroup
      .get(
        Path('/dashboard/organizations/:organizationId/profile', 'organizations.profile.get'),
        {
          name: 'Get own profile',
          description: 'Get the profile for the current organization'
        }
      )
      .use(isDashboardGroup())
      .output(profilePresenter)
      .do(async ctx => {
        let profile = await profileService.ensureProfile({
          for: { type: 'organization', organization: ctx.organization }
        });

        return profilePresenter.present({ profile });
      }),

    update: organizationGroup
      .patch(
        Path(
          '/dashboard/organizations/:organizationId/profile',
          'organizations.profile.update'
        ),
        {
          name: 'Update own profile',
          description: 'Update the profile for the current organization'
        }
      )
      .use(isDashboardGroup())
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.nullable(v.string()))
        })
      )
      .output(profilePresenter)
      .do(async ctx => {
        let profile = await profileService.ensureProfile({
          for: { type: 'organization', organization: ctx.organization }
        });

        profile = await profileService.updateProfile({
          profile,
          input: {
            name: ctx.body.name,
            description: ctx.body.description
          },
          performedBy: ctx.actor
        });

        return profilePresenter.present({ profile });
      })
  }
);
