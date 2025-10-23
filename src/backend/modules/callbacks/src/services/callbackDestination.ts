import { CallbackDestination, db, ID, Instance } from '@metorial/db';
import { badRequestError, notFoundError, ServiceError } from '@metorial/error';
import { generateCustomId } from '@metorial/id';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  callbacks: {
    where: { isSelected: true },
    include: { callback: true }
  }
};

class callbackDestinationServiceImpl {
  async getCallbackDestinationById(d: { instance: Instance; destinationId: string }) {
    let destination = await db.callbackDestination.findFirst({
      where: {
        id: d.destinationId,
        instanceOid: d.instance.oid
      },
      include
    });
    if (!destination)
      throw new ServiceError(notFoundError('callback.destination', d.destinationId));

    return destination;
  }

  async listCallbackDestinations(d: { callbackIds?: string[]; instance: Instance }) {
    let callbacks = d.callbackIds
      ? await db.callback.findMany({
          where: {
            id: { in: d.callbackIds },
            instanceOid: d.instance.oid
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.callbackDestination.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,
              status: 'active',

              ...(callbacks
                ? {
                    OR: [
                      { selectionType: 'all' },
                      {
                        callbacks: {
                          some: { callbackOid: { in: callbacks.map(c => c.oid) } }
                        }
                      }
                    ]
                  }
                : {})
            },
            include
          })
      )
    );
  }

  async createCallbackDestination(d: {
    instance: Instance;
    input: {
      name: string;
      description?: string;
      url: string;
      callbacks: { type: 'all' } | { type: 'selected'; callbackIds: string[] };
    };
  }) {
    let uniqueCallbackIds = new Set<string>(
      d.input.callbacks.type === 'selected' ? d.input.callbacks.callbackIds : []
    );
    let callbacks =
      d.input.callbacks.type == 'selected'
        ? await db.callback.findMany({
            where: {
              id: { in: d.input.callbacks.callbackIds },
              instanceOid: d.instance.oid
            }
          })
        : [];
    if (uniqueCallbackIds.size !== callbacks.length) {
      throw new ServiceError(
        badRequestError({
          message: 'One or more callback IDs are invalid'
        })
      );
    }

    let destination = await db.callbackDestination.create({
      data: {
        id: await ID.generateId('callbackDestination'),
        instanceOid: d.instance.oid,
        name: d.input.name,
        description: d.input.description,
        url: d.input.url,
        selectionType: d.input.callbacks.type === 'all' ? 'all' : 'selected',
        type: 'webhook_http',
        signingSecret: await generateCustomId('clb_sec_', 50),
        callbacks: {
          create: callbacks.map(c => ({
            isSelected: true,
            callbackOid: c.oid
          }))
        }
      },
      include
    });

    return destination;
  }

  async updateCallbackDestination(d: {
    destination: CallbackDestination;
    input: {
      name?: string;
      description?: string | null;
      url?: string;
    };
  }) {
    if (d.destination.status === 'inactive') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update an inactive callback destination'
        })
      );
    }

    let destination = await db.callbackDestination.update({
      where: { oid: d.destination.oid },
      data: {
        name: d.input.name ?? d.destination.name,
        description:
          d.input.description !== undefined ? d.input.description : d.destination.description,
        url: d.input.url ?? d.destination.url
      },
      include
    });

    return destination;
  }

  async deleteCallbackDestination(d: { destination: CallbackDestination }) {
    if (d.destination.status === 'inactive') {
      throw new ServiceError(
        badRequestError({
          message: 'Callback destination is already inactive'
        })
      );
    }

    return await db.callbackDestination.update({
      where: { oid: d.destination.oid },
      data: { status: 'inactive' },
      include
    });
  }
}

export let callbackDestinationService = Service.create(
  'callbackDestinationService',
  () => new callbackDestinationServiceImpl()
).build();
