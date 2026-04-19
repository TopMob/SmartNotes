import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const jsRoot = path.join(repoRoot, 'js');
const indexHtmlPath = path.join(repoRoot, 'index.html');

async function collectJsFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const resolvedPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return collectJsFiles(resolvedPath);
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      return [resolvedPath];
    }
    return [];
  }));
  return files.flat();
}

function toPosixRelative(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join(path.posix.sep);
}

function normalizeImportTarget(currentFile, importPath, moduleSet) {
  const currentDir = path.posix.dirname(currentFile);
  const normalizedBase = path.posix.normalize(path.posix.join(currentDir, importPath));
  if (moduleSet.has(normalizedBase)) {
    return normalizedBase;
  }
  const withJsExtension = normalizedBase.endsWith('.js') ? normalizedBase : `${normalizedBase}.js`;
  if (moduleSet.has(withJsExtension)) {
    return withJsExtension;
  }
  const withIndexJs = normalizedBase.endsWith('/index.js') ? normalizedBase : `${normalizedBase}/index.js`;
  if (moduleSet.has(withIndexJs)) {
    return withIndexJs;
  }
  return null;
}

function extractIndexScripts(indexHtml) {
  const scriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*>/g;
  const roots = new Set();
  let match;
  while ((match = scriptRegex.exec(indexHtml)) !== null) {
    const source = match[1].split('?')[0].replace(/^\.\//, '');
    if (source.startsWith('js/') && source.endsWith('.js')) {
      roots.add(source);
    }
  }
  return roots;
}


async function readOptionalFile(filePath) {
  try {
    await access(filePath);
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function extractDrawingLoaderRoots(loaderSource) {
  const out = [];
  const re = /loadScript\(\s*["']([^"']+\.js)/g;
  let match;
  while ((match = re.exec(loaderSource)) !== null) {
    const rel = match[1].split('?')[0].replace(/^\.\//, '');
    if (rel.startsWith('js/')) out.push(rel);
  }
  return out;
}

function extractImportedModules(fileContent) {
  const importRegex = /(?:import\s+(?:[^'";]+?\s+from\s+)?|import\()\s*["'](\.\.?\/[^"']+)["']/g;
  const importedPaths = [];
  let match;
  while ((match = importRegex.exec(fileContent)) !== null) {
    importedPaths.push(match[1]);
  }
  return importedPaths;
}

function resolveReachableModules(rootModules, importGraph) {
  const reachable = new Set(rootModules);
  const queue = [...rootModules];

  while (queue.length > 0) {
    const current = queue.shift();
    const dependencies = importGraph.get(current);
    if (!dependencies) {
      continue;
    }
    for (const dependency of dependencies) {
      if (!reachable.has(dependency)) {
        reachable.add(dependency);
        queue.push(dependency);
      }
    }
  }

  return reachable;
}

async function main() {
  const jsFilesAbs = await collectJsFiles(jsRoot);
  const jsFiles = jsFilesAbs.map(toPosixRelative);
  const modules = new Set(jsFiles);
  const importGraph = new Map(jsFiles.map((file) => [file, new Set()]));

  for (const file of jsFiles) {
    const filePath = path.join(repoRoot, file);
    const fileContent = await readFile(filePath, 'utf8');
    const importedModules = extractImportedModules(fileContent)
      .map((importPath) => normalizeImportTarget(file, importPath, modules))
      .filter(Boolean);

    for (const importedModule of importedModules) {
      importGraph.get(file).add(importedModule);
    }
  }

  const indexHtml = await readFile(indexHtmlPath, 'utf8');
  const drawingLoaderPath = path.join(repoRoot, 'js/editor/drawing-loader.js');
  const drawingLoaderSource = await readOptionalFile(drawingLoaderPath);
  const runtimeRoots = drawingLoaderSource ? extractDrawingLoaderRoots(drawingLoaderSource) : [];
  const rootModules = [...new Set([...extractIndexScripts(indexHtml), ...runtimeRoots])].filter((modulePath) => modules.has(modulePath));
  const reachableModules = resolveReachableModules(rootModules, importGraph);
  const unconnectedModules = jsFiles.filter((file) => !reachableModules.has(file));

  if (unconnectedModules.length > 0) {
    console.error('Detected unconnected JS modules:');
    for (const modulePath of unconnectedModules) {
      console.error(`- ${modulePath}`);
    }
    process.exit(1);
  }

  console.log(`All JS modules are connected to index.html startup graph (${jsFiles.length} files checked).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
