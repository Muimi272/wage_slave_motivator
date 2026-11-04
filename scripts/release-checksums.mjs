import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const directory = path.resolve('artifacts/release')
const files = (await readdir(directory)).filter((name) => name !== 'SHA256SUMS.txt').sort()
for (const extension of ['.exe', '.dmg', '.app.tar.gz', '.deb', '.AppImage']) {
  assert(
    files.some((name) => name.endsWith(extension)),
    `Missing release package: ${extension}`,
  )
}
const checksums = []
for (const name of files) {
  const bytes = await readFile(path.join(directory, name))
  assert(bytes.length > 0, `Empty release asset: ${name}`)
  checksums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`)
}
await writeFile(path.join(directory, 'SHA256SUMS.txt'), `${checksums.join('\n')}\n`)
console.log(`Verified ${files.length} assets across Windows, macOS, and Linux.`)
