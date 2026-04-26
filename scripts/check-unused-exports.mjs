import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()
const jsRoot = path.join(repoRoot, 'public/js')

const collectJsFiles = async (dirPath) => {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const chunks = await Promise.all(entries.map(async (entry) => {
    const resolvedPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) return collectJsFiles(resolvedPath)
    if (entry.isFile() && entry.name.endsWith('.js')) return [resolvedPath]
    return []
  }))
  return chunks.flat()
}

const toPosixRelative = (filePath) => path.relative(repoRoot, filePath).split(path.sep).join(path.posix.sep)

const exportPattern = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|export\s+const\s+([A-Za-z_$][\w$]*)/g

const main = async () => {
  const jsFiles = (await collectJsFiles(jsRoot)).map(toPosixRelative)
  const contents = new Map()
  for (const file of jsFiles) {
    contents.set(file, await readFile(path.join(repoRoot, file), 'utf8'))
  }

  const exportsList = []
  for (const [file, content] of contents.entries()) {
    let match
    while ((match = exportPattern.exec(content)) !== null) {
      const name = match[1] || match[2]
      if (!name) continue
      exportsList.push({ file, name })
    }
  }

  const unused = []
  for (const item of exportsList) {
    let references = 0
    const namePattern = new RegExp(`\\b${item.name}\\b`, 'g')
    for (const [, content] of contents.entries()) {
      const occurrences = content.match(namePattern)?.length || 0
      references += occurrences
      if (references > 1) break
    }
    if (references <= 1) {
      unused.push(item)
    }
  }

  if (unused.length > 0) {
    console.error('Detected unused named exports:')
    for (const entry of unused) {
      console.error(`- ${entry.file}: ${entry.name}`)
    }
    process.exit(1)
  }

  console.log(`No unused named exports detected (${exportsList.length} exports checked).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
