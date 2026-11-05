function safeTypewordsPath(pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch (e) {
    return null
  }
  if (decoded.includes('\\') || decoded.includes('\0')) return null
  decoded = decoded.replace(/\/{2,}/g, '/')
  if (!decoded.startsWith('/typewords/') && decoded !== '/typewords') return null
  if (decoded.includes('//')) return null
  const parts = decoded.split('/')
  if (parts.some(part => part === '.' || part === '..')) return null
  return decoded
}

function typewordsKey(pathname) {
  const safe = safeTypewordsPath(pathname)
  if (!safe || safe === '/typewords' || safe.endsWith('/')) return null
  return safe.slice(1)
}

function typewordsType(pathname) {
  const dot = pathname.lastIndexOf('.')
  const ext = dot >= 0 ? pathname.slice(dot).toLowerCase() : ''
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
  return types[ext] || 'application/octet-stream'
}

function typewordsCacheControl(pathname) {
  if (pathname.includes('/_nuxt/')) return 'public, max-age=31536000, immutable'
  if (pathname.endsWith('.html')) return 'no-cache'
  return 'public, max-age=86400'
}

async function typewordsRead(env, pathname) {
  const key = typewordsKey(pathname)
  if (!key || !env.TYPEWORDS_ASSETS) return null
  const ttl = pathname.includes('/_nuxt/') ? 86400 : 60
  const bytes = await env.TYPEWORDS_ASSETS.get(key, { type: 'arrayBuffer', cacheTtl: ttl })
  if (bytes == null) return null
  return bytes
}

async function serveTypewords(req, env, ctx, u, p) {
  const plain = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: Object.assign({ allow: 'GET, HEAD' }, plain) })
  }
  if (!env.TYPEWORDS_ASSETS || typeof env.TYPEWORDS_ASSETS.get !== 'function') {
    return new Response('TypeWords KV binding TYPEWORDS_ASSETS is not attached', { status: 503, headers: plain })
  }
  if (p === '/typewords') return Response.redirect(u.origin + '/typewords/', 302)
  const path = safeTypewordsPath(p)
  if (!path) return new Response('Not found', { status: 404, headers: plain })
  const accept = req.headers.get('accept') || ''
  const dest = req.headers.get('sec-fetch-dest') || ''
  const navigation = req.method === 'GET' && (dest === 'document' || accept.includes('text/html'))
  const candidates = [path]
  if (path.endsWith('/')) candidates.push(path + 'index.html')
  else candidates.push(path + '/index.html', path + '.html')
  let chosen = null
  let bytes = null
  for (const candidate of candidates) {
    bytes = await typewordsRead(env, candidate)
    if (bytes != null) {
      chosen = candidate
      break
    }
  }
  const exact = chosen != null
  if (!exact && navigation) {
    bytes = await typewordsRead(env, '/typewords/index.html')
    chosen = bytes != null ? '/typewords/index.html' : null
  }
  if (bytes == null || !chosen) return new Response('Not found', { status: 404, headers: plain })
  const headers = {
    'content-type': typewordsType(chosen),
    'cache-control': exact ? typewordsCacheControl(chosen) : 'no-cache',
    'x-content-type-options': 'nosniff',
    'content-length': String(bytes.byteLength),
  }
  if (req.method === 'HEAD') return new Response(null, { status: 200, headers })
  const response = new Response(bytes, { status: 200, headers })
  if (exact && ctx && caches && caches.default) {
    const cached = response.clone()
    const cacheRequest = new Request(new URL(chosen, u.origin).toString(), { method: 'GET' })
    ctx.waitUntil(caches.default.put(cacheRequest, cached).catch(() => {}))
  }
  return response
}
