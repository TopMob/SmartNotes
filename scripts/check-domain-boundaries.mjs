import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()
const jsRoot = path.join(repoRoot, 'js')

const boundaryRules = [
  { from: 'core', forbidden: ['notes', 'editor', 'ui'], reason: 'core must stay independent from higher domains' },
  { from: 'notes', forbidden: ['editor', 'ui'], reason: 'notes must not depend on editor/ui layers' },
  { from: 'editor', forbidden: ['ui'], reason: 'editor must not depend on ui layer' }
]

const collectJsFiles = async (dirPath) => {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const chunks = await Promise.all(entries.map(async (entry) => {
    const resolvedPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      return collectJsFiles(resolvedPath)
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      return [resolvedPath]
    }
    return []
  }))
  return chunks.flat()
}

const toPosixRelative = (filePath) => path.relative(repoRoot, filePath).split(path.sep).join(path.posix.sep)

const resolveImportTarget = (sourceFile, importPath) => {
  const sourceDir = path.posix.dirname(sourceFile)
  const normalizedBase = path.posix.normalize(path.posix.join(sourceDir, importPath))
  if (normalizedBase.endsWith('.js')) return normalizedBase
  return `${normalizedBase}.js`
}

const getDomain = (filePath) => {
  const parts = filePath.split('/')
  if (parts[0] !== 'js') return ''
  return parts[1] || ''
}

const extractLocalImports = (fileContent) => {
  const importRegex = /(?:import\s+(?:[^'";]+?\s+from\s+)?|import\()\s*["'](\.\.?\/[^"']+)["']/g
  const imports = []
  let match
  while ((match = importRegex.exec(fileContent)) !== null) {
    imports.push(match[1])
  }
  return imports
}

const main = async () => {
  const jsFiles = (await collectJsFiles(jsRoot)).map(toPosixRelative)
  const violations = []

  for (const file of jsFiles) {
    const sourceDomain = getDomain(file)
    if (!sourceDomain) continue
    const boundaryRule = boundaryRules.find((rule) => rule.from === sourceDomain)
    if (!boundaryRule) continue

    const sourceText = await readFile(path.join(repoRoot, file), 'utf8')
    const localImports = extractLocalImports(sourceText)

    for (const importPath of localImports) {
      const targetFile = resolveImportTarget(file, importPath)
      const targetDomain = getDomain(targetFile)
      if (!targetDomain) continue
      if (!boundaryRule.forbidden.includes(targetDomain)) continue
      violations.push({
        file,
        target: targetFile,
        sourceDomain,
        targetDomain,
        reason: boundaryRule.reason
      })
    }
  }

  if (violations.length > 0) {
    console.error('Detected domain boundary violations:')
    for (const violation of violations) {
      console.error(`- ${violation.file} -> ${violation.target} (${violation.sourceDomain} -> ${violation.targetDomain}): ${violation.reason}`)
    }
    process.exit(1)
  }

  console.log(`Domain boundaries are valid (${jsFiles.length} JS files checked).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
