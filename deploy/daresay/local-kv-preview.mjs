import { createServer } from 'node:http'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const siteRoot = process.argv[2] || join(here, '../../dist-typewords/typewords')
const port = Number(process.argv[3] || 8765)
const store = new Map()

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, acc)
    else acc.push(path)
  }
  return acc
}

for (const file of walk(siteRoot)) {
  const rel = relative(siteRoot, file).split('\\').join('/')
  store.set('typewords/' + rel, readFileSync(file))
}

const cache = new Map()
const sandbox = {
  Response,
  Request,
  URL,
  caches: {
    default: {
      async match(request) {
        const hit = cache.get(request.url)
        return hit ? new Response(hit.body, { status: hit.status, headers: hit.headers }) : undefined
      },
      async put(request, response) {
        const body = await response.arrayBuffer()
        cache.set(request.url, { body, status: response.status, headers: Object.fromEntries(response.headers) })
      },
    },
  },
}
sandbox.globalThis = sandbox
vm.createContext(sandbox)
vm.runInContext(readFileSync(join(here, 'typewords-kv-handler.js'), 'utf8'), sandbox)

const env = {
  TYPEWORDS_ASSETS: {
    async get(key, options) {
      const value = store.get(key)
      if (!value) return null
      if (options && options.type === 'arrayBuffer') return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
      return value.toString('utf8')
    },
  },
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  const request = new Request(url, { method: req.method, headers: req.headers })
  const ctx = { waitUntil(promise) { return promise } }
  const response = await sandbox.serveTypewords(request, env, ctx, url, url.pathname)
  const body = Buffer.from(await response.arrayBuffer())
  const headers = Object.fromEntries(response.headers)
  res.writeHead(response.status, headers)
  res.end(req.method === 'HEAD' ? undefined : body)
}).listen(port, '127.0.0.1', () => {
  console.log(JSON.stringify({ port, keys: store.size, url: pathToFileURL(siteRoot).href }))
})
