import assert from 'node:assert/strict'
import { copyFile, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const { version } = JSON.parse(await readFile('package.json', 'utf8'))
const platform = process.platform
const target = platform === 'darwin' ? 'target/universal-apple-darwin/release' : 'target/release'
const bundle = path.resolve(target, 'bundle')
const output = path.resolve('artifacts/upload')
const extensions =
  platform === 'win32'
    ? ['.exe']
    : platform === 'darwin'
      ? ['.dmg', '.app.tar.gz']
      : ['.deb', '.AppImage']
const label =
  platform === 'win32' ? 'windows_x64' : platform === 'darwin' ? 'macos_universal' : 'linux_x64'

async function findFiles(directory) {
  const found = []
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, item.name)
    if (item.isDirectory()) {
      if (!item.name.endsWith('.app')) found.push(...(await findFiles(filename)))
    } else found.push(filename)
  }
  return found
}

const files = await findFiles(bundle)
await mkdir(output, { recursive: true })
for (const extension of extensions) {
  const matches = files.filter((file) => file.endsWith(extension))
  assert(matches.length === 1, `Expected exactly one ${extension} package, found: ${matches}`)
  const suffix = extension === '.exe' ? '-setup.exe' : extension
  const name = `wage_slave_motivator_${version}_${label}${suffix}`
  const destination = path.join(output, name)
  await copyFile(matches[0], destination)
  const result = spawnSync(
    'gh',
    ['release', 'upload', process.env.RELEASE_TAG, destination, '--clobber'],
    { stdio: 'inherit' },
  )
  assert.equal(result.status, 0, `Upload failed: ${name}`)
  console.log(`Uploaded ${name}`)
}
