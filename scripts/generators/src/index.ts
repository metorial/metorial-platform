import { input } from '@inquirer/prompts';
import fs from 'fs-extra';
import path from 'path';
import { Cases } from './case';
import { getEndpoints, getEndpointVersions, type IntrospectedType } from './fetch';

// Generate type exports for Python packages
let generateTypeExports = (typeIdToName: Map<string, { typeName: string; mapperName: string }>, version: string): string => {
  let typeNames = Array.from(typeIdToName.values()).map(t => t.typeName);
  let mapperNames = Array.from(typeIdToName.values()).map(t => t.mapperName);
  
  // Sort for consistent output
  typeNames.sort();
  mapperNames.sort();
  
  let exports = [
    '# Generated type exports',
    '# These types are automatically exported for better IDE support',
    '',
    '# Type classes',
    ...typeNames.map(name => `# ${name}`),
    '',
    '# Mapper classes', 
    ...mapperNames.map(name => `# ${name}`),
    '',
    '# All types and mappers are available via:',
    '# from .resources import *',
    '# from .endpoints import *',
    ''
  ];
  
  return exports.join('\n');
};

// Update the main public API to include generated types
let updateMainPublicAPI = async (typeIdToName: Map<string, { typeName: string; mapperName: string }>, version: string, rootOutputFolder: string) => {
  // Find the main public API file
  let mainApiPath = path.join(rootOutputFolder, '..', '..', '..', 'packages', 'metorial', 'src', 'metorial', '__init__.py');
  
  try {
    if (await fs.pathExists(mainApiPath)) {
      let currentContent = await fs.readFile(mainApiPath, 'utf-8');
      
      // Generate import statements for the generated types
      let typeNames = Array.from(typeIdToName.values()).map(t => t.typeName);
      let mapperNames = Array.from(typeIdToName.values()).map(t => t.mapperName);
      
      // Create import statement for the generated package
      let generatedImport = `from metorial_generated.${version} import *`;
      
      // Check if the import already exists
      if (!currentContent.includes(generatedImport)) {
        // Add the import after the existing imports
        let lines = currentContent.split('\n');
        let insertIndex = lines.findIndex(line => line.startsWith('__version__'));
        
        if (insertIndex > 0) {
          lines.splice(insertIndex, 0, '', '    # Generated types from API', generatedImport);
          await fs.writeFile(mainApiPath, lines.join('\n'));
        }
      }
    }
  } catch (error) {
    console.warn('Could not update main public API:', error);
  }
};

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
let toPyIdentifier: (name: string) => string = (name: string) => name;
let toPyFolderName: (name: string) => string = (name: string) => name;

if (language === 'python') {
  let pythonUtils = await import('./languages/python/utils');
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

  // Track types per file to consolidate imports
  let fileTypes = new Map<string, Array<{
    id: string;
    typeName: string;
    mapperName: string;
    object: IntrospectedType;
  }>>();

  let collectTypes = async (i: {
    id: string;
    file: string;
    type: string;
    parts: string[];
    methodName: string;
    object: IntrospectedType;
  }) => {
    let typeName = Cases.toPascalCase([...i.parts, i.methodName, i.type].join('_'));
    let mapperName = Cases.toCamelCase(['map', ...i.parts, i.methodName, i.type].join('_'));

    if (!fileTypes.has(i.file)) {
      fileTypes.set(i.file, []);
    }
    fileTypes.get(i.file)!.push({
      id: i.id,
      typeName,
      mapperName,
      object: i.object
    });

    typeIdToName.set(i.id, { typeName, mapperName });
  };

  let generateFileTypes = async (file: string, types: Array<{
    id: string;
    typeName: string;
    mapperName: string;
    object: IntrospectedType;
  }>) => {
    if (types.length === 0) return;

    // Generate all types for this file
    let fileContent = '';
    
    // Add imports only once at the top
    if (language === 'python') {
      fileContent += 'from dataclasses import dataclass\nfrom typing import Any, Dict, List, Optional, Union\nfrom datetime import datetime\nimport dataclasses\n\n';
    } else if (language === 'typescript') {
      fileContent += `import { mtMap } from '@metorial/util-resource-mapper';\n\n`;
    }

    // Generate all types and mappers
    for (let typeInfo of types) {
      fileContent += await typeModule.generateTypeFromIntrospectedType(typeInfo.typeName, typeInfo.object);
      fileContent += await mapperModule.generateMapper(typeInfo.mapperName, typeInfo.typeName, typeInfo.object);
    }

    await fs.writeFile(file, fileContent);
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

      let fileName = Cases.toKebabCase(methodName);
      if (language === 'python') {
        fileName = toPyFolderName(fileName);
      }
      let file = `${folder}/${fileName}${fileExtension}`;

      await fs.ensureFile(file);

      if (!seenFiles.has(file)) {
        // File will be generated later with consolidated imports
      }

      seenFiles.add(file);

      await collectTypes({
        file,
        parts,
        methodName,
        type: 'output',
        id: endpoint.outputId,
        object: types.find(t => t.id === endpoint.outputId)!.type
      });

      if (endpoint.bodyId) {
        await collectTypes({
          file,
          parts,
          methodName,
          type: 'body',
          id: endpoint.bodyId,
          object: types.find(t => t.id === endpoint.bodyId)!.type
        });
      }

      if (endpoint.queryId) {
        await collectTypes({
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

  // Generate all files with consolidated imports
  for (let [file, types] of fileTypes) {
    await generateFileTypes(file, types);
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
      typeIdToName,
      types
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
    // Generate comprehensive type exports for the generated package
    let typeExports = generateTypeExports(typeIdToName, version.version);
    
    await fs.writeFile(
      `${outputFolder}/__init__.py`,
      `from .resources import *\nfrom .endpoints import *\n\n# Type exports for better discoverability\n${typeExports}`
    );
    
    // Also update the main public API to include generated types
    await updateMainPublicAPI(typeIdToName, version.version, rootOutputFolder);
  } else {
    await fs.writeFile(
      `${outputFolder}/index.ts`,
      "export * from './resources';\nexport * from './endpoints';\n"
    );
  }
}
