import { input } from '@inquirer/prompts';
import fs from 'fs-extra';
import path from 'path';
import { Cases } from './case';
import { createController } from './endpoint';
import { getEndpoints, getEndpointVersions, type IntrospectedType } from './fetch';
import { generateTypescriptMapper } from './mapper';
import { generateTypescriptTypeFromIntrospectedType } from './type';

let args = process.argv.slice(2);
let url = args[0];
let rootOutputFolder = args[1];
if (!url) url = await input({ message: 'API URL' });
if (!rootOutputFolder) rootOutputFolder = await input({ message: 'Output folder' });

rootOutputFolder = path.join(process.cwd(), rootOutputFolder);

let versions = await getEndpointVersions(url);

// let currentVersion = versions.versions.find(v => v.isCurrent)?.version;

for (let version of versions.versions) {
  let { endpoints, types, controllers } = await getEndpoints(url, version.version);

  let outputFolder = path.join(rootOutputFolder, 'src', version.version);

  await fs.ensureDir(outputFolder);

  let resourcesFolder = `${outputFolder}/resources`;

  await fs.ensureDir(outputFolder);
  await fs.emptyDir(outputFolder);
  await fs.emptyDir(outputFolder);
  await fs.ensureDir(resourcesFolder);

  let resourceFolders = new Set<string>();

  let typeIdToName = new Map<
    string,
    {
      typeName: string;
      mapperName: string;
    }
  >();

  let appendTypes = async (i: {
    id: string;
    file: string;
    type: string;
    parts: string[];
    methodName: string;
    object: IntrospectedType;
  }) => {
    let typeName = Cases.toPascalCase([...i.parts, i.methodName, i.type].join('_'));
    let mapperName = Cases.toCamelCase(['map', ...i.parts, i.methodName, i.type].join('_'));

    await fs.appendFile(
      i.file,
      await generateTypescriptTypeFromIntrospectedType(typeName, i.object)
    );

    await fs.appendFile(
      i.file,
      await generateTypescriptMapper(mapperName, typeName, i.object)
    );

    typeIdToName.set(i.id, { typeName, mapperName });
  };

  let seenFiles = new Set<string>();

  for (let endpoint of endpoints) {
    for (let path of endpoint.allPaths) {
      let parts = path.sdkPath.split('.').map(Cases.toKebabCase);
      let methodName = parts.pop()!;

      let folder = `${resourcesFolder}/${parts.join('/')}`;

      await fs.ensureDir(folder);

      let file = `${folder}/${Cases.toKebabCase(methodName)}.ts`;

      await fs.ensureFile(file);

      if (!seenFiles.has(file)) {
        await fs.appendFile(
          file,
          `import { mtMap } from '@metorial/util-resource-mapper';\n\n`
        );
      }

      seenFiles.add(file);

      await appendTypes({
        file,
        parts,
        methodName,
        type: 'output',
        id: endpoint.outputId,
        object: types.find(t => t.id === endpoint.outputId)!.type
      });

      if (endpoint.bodyId) {
        await appendTypes({
          file,
          parts,
          methodName,
          type: 'body',
          id: endpoint.bodyId,
          object: types.find(t => t.id === endpoint.bodyId)!.type
        });
      }

      if (endpoint.queryId) {
        await appendTypes({
          file,
          parts,
          methodName,
          type: 'query',
          id: endpoint.queryId,
          object: types.find(t => t.id === endpoint.queryId)!.type
        });
      }

      for (let i = 1; i < parts.length; i++) {
        let part = parts.slice(0, i).join('/');
        resourceFolders.add(`${resourcesFolder}/${part}`);
      }

      resourceFolders.add(folder);
    }
  }

  for (let folder of [...resourceFolders, resourcesFolder]) {
    let files = (await fs.readdir(folder)).sort();
    let imports = files
      .map(file => {
        let name = file.replace('.ts', '');
        return `export * from './${name}';`;
      })
      .join('\n');

    let indexFile = `${folder}/index.ts`;
    await fs.writeFile(indexFile, imports);
  }

  let endpointsDir = `${outputFolder}/endpoints`;

  await fs.ensureDir(endpointsDir);

  let resources = new Set<string>();
  for (let endpoint of endpoints) {
    for (let path of endpoint.allPaths) {
      resources.add(path.sdkPath.split('.').slice(0, -1).join('.'));
    }
  }

  // for (let controller of controllers) {
  //   let controllerEndpoints = endpoints.filter(e => e.controllerId === controller.id);

  //   let string = createController({
  //     controller,
  //     endpoints: controllerEndpoints
  //   });

  //   let file = `${endpointsDir}/${Cases.toCamelCase(controller.name)}.ts`;
  //   await fs.writeFile(file, string);
  // }

  for (let resource of resources) {
    let resourceParts = resource.split('.');

    let resourceEndpoints = endpoints
      .map(e => {
        let path = e.allPaths.find(
          p =>
            p.sdkPath.startsWith(resource) &&
            p.sdkPath.split('.').length === resourceParts.length + 1
        );
        if (!path) return undefined!;

        return {
          ...e,
          path
        };
      })
      .filter(Boolean);

    if (!resourceEndpoints.length) continue;

    let controller = controllers.find(c => c.id == resourceEndpoints[0].controllerId);
    if (!controller) continue;

    let source = await createController({
      endpoints: resourceEndpoints,
      controller,
      path: resourceParts,
      typeIdToName
    });

    let file = `${endpointsDir}/${Cases.toKebabCase(resourceParts.join('_'))}.ts`;

    await fs.writeFile(file, source);
  }

  let endpointsFiles = await fs.readdir(endpointsDir);
  let endpointsImports = endpointsFiles
    .map(file => {
      let name = file.replace('.ts', '');
      return `export * from './${name}';`;
    })
    .join('\n');

  await fs.writeFile(`${endpointsDir}/index.ts`, endpointsImports);

  await fs.writeFile(
    `${outputFolder}/index.ts`,
    "export * from './resources';\nexport * from './endpoints';\n"
  );
}
