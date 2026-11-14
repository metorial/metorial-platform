import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { accessGroupService } from '../../../services/accessGroup';
import { adminService } from '../../../services/admin';
import { adminApp } from '../middleware/admin';
import { accessGroupPresenter } from '../presenters';

export let accessGroupController = adminApp.controller({
  list: adminApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          appId: v.string()
        })
      )
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.appId });
      let paginator = await accessGroupService.list({ app });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, accessGroupPresenter);
    }),

  get: adminApp
    .handler()
    .input(
      v.object({
        id: v.string()
      })
    )
    .do(async ({ input }) => {
      let accessGroup = await accessGroupService.get({ accessGroupId: input.id });
      return accessGroupPresenter(accessGroup);
    }),

  create: adminApp
    .handler()
    .input(
      v.object({
        appId: v.string(),
        name: v.string(),
        rules: v.array(
          v.object({
            type: v.string(),
            value: v.string()
          })
        )
      })
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.appId });
      let accessGroup = await accessGroupService.create({
        app,
        input: { name: input.name, rules: input.rules }
      });
      return accessGroupPresenter(accessGroup);
    }),

  update: adminApp
    .handler()
    .input(
      v.object({
        id: v.string(),
        name: v.optional(v.string()),
        rules: v.optional(
          v.array(
            v.object({
              type: v.string(),
              value: v.string()
            })
          )
        )
      })
    )
    .do(async ({ input }) => {
      let accessGroup = await accessGroupService.get({ accessGroupId: input.id });
      let updated = await accessGroupService.update({
        accessGroup,
        input: { name: input.name, rules: input.rules }
      });
      return accessGroupPresenter(updated);
    }),

  delete: adminApp
    .handler()
    .input(
      v.object({
        id: v.string()
      })
    )
    .do(async ({ input }) => {
      let accessGroup = await accessGroupService.get({ accessGroupId: input.id });
      await accessGroupService.delete({ accessGroup });
      return { success: true };
    }),

  assignToApp: adminApp
    .handler()
    .input(
      v.object({
        accessGroupId: v.string(),
        appId: v.string()
      })
    )
    .do(async ({ input }) => {
      let accessGroup = await accessGroupService.get({ accessGroupId: input.accessGroupId });
      let app = await adminService.getApp({ appId: input.appId });
      await accessGroupService.assignToApp({ accessGroup, app });
      return { success: true };
    }),

  unassign: adminApp
    .handler()
    .input(
      v.object({
        assignmentId: v.string()
      })
    )
    .do(async ({ input }) => {
      await accessGroupService.unassign({ assignmentId: input.assignmentId });
      return { success: true };
    }),

  listAppAssignments: adminApp
    .handler()
    .input(
      v.object({
        appId: v.string()
      })
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.appId });
      let assignments = await accessGroupService.listAssignmentsForApp({ app });
      return assignments.map(a => ({
        id: a.id,
        accessGroup: {
          id: a.accessGroup.id,
          name: a.accessGroup.name,
          counts: { rules: a.accessGroup._count.rules }
        },
        createdAt: a.createdAt
      }));
    })
});
