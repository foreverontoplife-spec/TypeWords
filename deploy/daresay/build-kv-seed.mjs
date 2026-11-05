import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const siteRoot = process.argv[2] || join(root, 'dist-typewords', 'typewords')
const outDir = process.argv[3] || join(root, 'dist-typewords', 'kv')
const maxBatchBytes = 8_000_000

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.map': 'application/json; charset=utf-8',
}

function contentType(path) {
  const dot = path.lastIndexOf('.')
  return types[dot >= 0 ? path.slice(dot).toLowerCase() : ''] || 'application/octet-stream'
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, acc)
    else acc.push(path)
  }
  return acc
}

const entries = walk(siteRoot)
  .map(file => {
    const body = readFileSync(file)
    const rel = relative(siteRoot, file).split('\\').join('/')
    const key = `typewords/${rel}`
    if (Buffer.byteLength(key) > 512) throw new Error('KV key too long: ' + key)
    if (body.length > 25 * 1024 * 1024) throw new Error('KV value too large: ' + key)
    const item = {
      key,
      value: body.toString('base64'),
      base64: true,
      metadata: { contentType: contentType(rel) },
    }
    return {
      item,
      record: {
        key,
        size: body.length,
        sha256: createHash('sha256').update(body).digest('hex'),
        contentType: item.metadata.contentType,
      },
    }
  })
  .sort((a, b) => a.record.key.localeCompare(b.record.key))

mkdirSync(outDir, { recursive: true })
const batches = []
let current = []
let currentBytes = 2
for (const entry of entries) {
  const encoded = JSON.stringify(entry.item)
  const nextBytes = currentBytes + encoded.length + 1
  if (current.length && nextBytes > maxBatchBytes) {
    batches.push(current)
    current = []
    currentBytes = 2
  }
  current.push(entry)
  currentBytes += encoded.length + 1
}
if (current.length) batches.push(current)

const files = []
batches.forEach((batch, index) => {
  const name = `typewords-kv-bulk-${String(index + 1).padStart(3, '0')}.json`
  const body = JSON.stringify(batch.map(entry => entry.item))
  if (Buffer.byteLength(body) > 100 * 1024 * 1024) throw new Error(name + ' exceeds the 100 MB bulk limit')
  writeFileSync(join(outDir, name), body)
  files.push({
    file: name,
    keys: batch.length,
    bytes: Buffer.byteLength(body),
    writes: batch.length,
  })
  for (const entry of batch) entry.record.batch = name
})

const manifest = {
  namespaceTitle: 'TYPEWORDS_ASSETS',
  binding: 'TYPEWORDS_ASSETS',
  api: 'PUT /accounts/{account_id}/storage/kv/namespaces/{namespace_id}/bulk',
  contentType: 'application/json',
  base64: true,
  keyPrefix: 'typewords/',
  files: entries.length,
  rawBytes: entries.reduce((sum, entry) => sum + entry.record.size, 0),
  writes: entries.length,
  batches: files,
  keys: entries.map(entry => entry.record),
}
writeFileSync(join(outDir, 'typewords-kv-manifest.json'), JSON.stringify(manifest, null, 2))
console.log(JSON.stringify({
  files: manifest.files,
  rawBytes: manifest.rawBytes,
  batches: files,
  largest: entries.reduce((max, entry) => Math.max(max, entry.record.size), 0),
}, null, 2))
