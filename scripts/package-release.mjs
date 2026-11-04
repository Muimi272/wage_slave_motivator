import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const { version } = JSON.parse(await readFile('package.json', 'utf8'))
const output = path.resolve('artifacts/release')
await mkdir(output, { recursive: true })
const files = [
  {
    source: `target/release/bundle/nsis/牛马鼓励器_${version}_x64-setup.exe`,
    name: `wage_slave_motivator_${version}_x64-setup.exe`,
  },
  { source: 'target/release/wage_slave_motivator.exe', name: 'wage_slave_motivator.exe' },
]
const checksums = []
for (const { source, name } of files) {
  const contents = await readFile(source)
  await copyFile(source, path.join(output, name))
  const hash = createHash('sha256').update(contents).digest('hex')
  checksums.push(`${hash}  ${name}`)
  console.log(`${name} (${(contents.length / 1024 / 1024).toFixed(2)} MB)`)
}
await copyFile('LICENSE', path.join(output, 'LICENSE'))
await copyFile('RELEASE.md', path.join(output, 'RELEASE.md'))
await writeFile(path.join(output, 'SHA256SUMS.txt'), `${checksums.join('\n')}\n`)
console.log(output)
