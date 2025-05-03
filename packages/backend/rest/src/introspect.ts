import { EndpointDescriptor, Handler, IController } from './controller';

export let introspectApi = (version: {
  rootController: {
    handlers: IController<any>;
    descriptor: EndpointDescriptor;
  };
  displayVersion: string;
  version: string;
  isCurrent: boolean;
}) => {
  let idIndex = 0;

  let controllers: {
    id: string;
    name: string;
    description: string;
  }[] = [];

  let endpoints: any[] = [];

  // let types: {id: string, name: string, type: string}[] = [];
  let types = new Map<any, { id: string; name: string; type: string }>();

  let ensureType = (i: { type: any; name: string }) => {
    let existing = types.get(i.type);
    if (existing) return existing.id;

    let newType = {
      id: `type_${idIndex++}`,
      name: i.name,
      type: i.type
    };

    types.set(i.type, newType);

    return newType.id;
  };

  let resolveController = (i: {
    handlers: IController<any>;
    descriptor: EndpointDescriptor;
  }) => {
    let controller = {
      id: `controller_${idIndex++}`,
      name: i.descriptor.name,
      description: i.descriptor.description
    };

    controllers.push(controller);

    for (let inner of Object.values(i.handlers)) {
      if (inner instanceof Handler) {
        let out = inner.introspect({
          apiVersion: version.version
        });

        endpoints.push({
          id: `endpoint_${idIndex++}`,
          controllerId: controller.id,

          path: out.path,
          allPaths: out.allPaths,
          method: out.method,
          name: out.name,
          description: out.description,
          hideInDocs: !!out.hideInDocs,

          bodyId: out.body
            ? ensureType({
                type: out.body?.object,
                name: out.body?.name
              })
            : null,

          queryId: out.query
            ? ensureType({
                type: out.query?.object,
                name: out.query?.name
              })
            : null,

          outputId: ensureType({
            type: out.output.object,
            name: out.output.name
          })
        });
      } else {
        resolveController(inner);
      }
    }
  };

  // The root controller actually isn't a controller,
  // but a collection of controllers. So we need to resolve
  // all of them.
  for (let i of Object.values(version.rootController.handlers)) {
    if (!(i instanceof Handler)) {
      resolveController(i);
    }
  }

  return {
    version: version.displayVersion,
    controllers,
    endpoints,
    types: Array.from(types.values()).map(i => ({
      id: i.id,
      name: i.name,
      type: i.type
    }))
  };
};
