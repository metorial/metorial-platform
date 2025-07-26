import { input } from '@inquirer/prompts';
import fs from 'fs-extra';
import path from 'path';
import { Cases } from './case';
import { getEndpoints, getEndpointVersions, type IntrospectedType } from './fetch';

let args = process.argv.slice(2);
let url = args[0];
let rootOutputFolder = args[1];
let language = args[2];

if (!url) url = await input({ message: 'API URL' });
if (!rootOutputFolder) rootOutputFolder = await input({ message: 'Output folder' });
if (!language) {
  language = await input({ message: 'Language (typescript or python)' });
  if (!language) language = 'python';
}

let fileExtension: string;

if (language === 'typescript') {
  fileExtension = '.ts';
} else if (language === 'python') {
  fileExtension = '.py';
} else {
  throw new Error(`Unsupported language: ${language}`);
}

rootOutputFolder = path.join(process.cwd(), rootOutputFolder);

// Import Python utilities when needed
let toPyIdentifier: (name: string) => string;
let toPyFolderName: (name: string) => string;

if (language === 'python') {
  const pythonUtils = await import('./languages/python/utils');
  toPyIdentifier = pythonUtils.toPyIdentifier;
  toPyFolderName = pythonUtils.toPyFolderName;
}

let mapperModule = await import(`./languages/${language}/mapper`);
let typeModule = await import(`./languages/${language}/type`);
let endpointModule = await import(`./languages/${language}/endpoint`);

let urls = url.split(',');
let workingUrl = null;
for (let u of urls) {
  try {
    await fetch(u);
    workingUrl = u;
    break;
  } catch (e) {}
}

if (!workingUrl) {
  throw new Error('None of the provided URLs are reachable.');
}

let versions = await getEndpointVersions(workingUrl);

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
      await typeModule.generateTypeFromIntrospectedType(typeName, i.object)
    );

    await fs.appendFile(
      i.file,
      await mapperModule.generateMapper(mapperName, typeName, i.object)
    );

    typeIdToName.set(i.id, { typeName, mapperName });
  };

  let seenFiles = new Set<string>();

  for (let endpoint of endpoints) {
    for (let path of endpoint.allPaths) {
      let parts = path.sdkPath.split('.').map(Cases.toKebabCase);
      if (language === 'python') {
        parts = parts.map(toPyFolderName);
      }
      let methodName = parts.pop()!;

      let folder = `${resourcesFolder}/${parts.join('/')}`;

      await fs.ensureDir(folder);

      let file = `${folder}/${Cases.toKebabCase(methodName)}${fileExtension}`;

      await fs.ensureFile(file);

      if (!seenFiles.has(file)) {
        if (language === 'typescript') {
          await fs.appendFile(
            file,
            `import { mtMap } from '@metorial/util-resource-mapper';\n\n`
          );
        } else if (language === 'python') {
          // await fs.appendFile(file, `from metorial_util_resource_mapper import mtMap\n\n`);
        }
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
        let name = file.replace(fileExtension, '');
        if (language === 'python') {
          return `from .${toPyIdentifier(name)} import *`;
        } else {
          return `export * from './${name}';`;
        }
      })
      .join('\n');

    let indexFile: string;
    if (language === 'typescript') {
      indexFile = `${folder}/index.ts`;
    } else if (language === 'python') {
      indexFile = path.join(folder, '__init__.py');
    } else {
      throw new Error(`Unsupported language: ${language}`);
    }

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
    if (resourceParts.length == 0) continue;

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

    let controllerPath = resourceParts.map(Cases.toKebabCase);
    if (language === 'python') {
      controllerPath = controllerPath.map(toPyFolderName);
    }
    let source = await endpointModule.createController({
      endpoints: resourceEndpoints,
      controller,
      path: controllerPath,
      typeIdToName
    });

    let fileNameParts = resourceParts.map(Cases.toKebabCase);
    if (language === 'python') {
      fileNameParts = fileNameParts.map(toPyFolderName);
    }
    let file = `${endpointsDir}/${fileNameParts.join('_')}${fileExtension}`;

    await fs.writeFile(file, source);
  }

  let endpointsFiles = (await fs.readdir(endpointsDir)).filter(f => f.endsWith(fileExtension));
  let endpointsIndexContent = endpointsFiles
    .filter(file => {
      // Exclude index.ts or __init__.py itself
      if (language === 'typescript') return file !== 'index.ts';
      if (language === 'python') return file !== '__init__.py';
      return true;
    })
    .map(file => {
      let name = file.replace(fileExtension, '');
      if (language === 'python') {
        return `from .${toPyIdentifier(name)} import *`;
      } else {
        return `export * from './${name}';`;
      }
    })
    .join('\n');

  if (language === 'typescript') {
    await fs.writeFile(`${endpointsDir}/index.ts`, endpointsIndexContent);
  } else if (language === 'python') {
    await fs.writeFile(path.join(endpointsDir, '__init__.py'), endpointsIndexContent);
  }

  if (language === 'python') {
    await fs.writeFile(
      `${outputFolder}/__init__.py`,
      'from .resources import *\nfrom .endpoints import *\n'
    );
  } else {
    await fs.writeFile(
      `${outputFolder}/index.ts`,
      "export * from './resources';\nexport * from './endpoints';\n"
    );
  }
}
