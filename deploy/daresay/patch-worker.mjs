import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const baselinePath = process.argv[2]
const outPath = process.argv[3]
if (!baselinePath || !outPath) {
  console.error('usage: node deploy/daresay/patch-worker.mjs <baseline worker.js> <out worker.js>')
  process.exit(1)
}

const EXPECTED = '07e0604e77e79d0f2a0bf84b5e16bb8af1c1cf7f5ea0b97365857400e4b80cf8'
const baseline = readFileSync(baselinePath)
const sha = createHash('sha256').update(baseline).digest('hex')
if (sha !== EXPECTED) {
  console.error('baseline sha256 mismatch', sha)
  process.exit(1)
}

let src = baseline.toString('utf8')
const routes = readFileSync(new URL('./FILES_ROUTES.snapshot.txt', import.meta.url), 'utf8')
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean)

const card =
  '<a class=\\"card live\\" href=\\"/typewords/\\"><h3>单词打字练习</h3><div class=\\"sub\\">公开 · 独立页面 · 跟打词库</div><p>英语单词打字练习，词库在本站页面内加载。不替换现有课程、登录或其它入口。</p><span class=\\"badge\\">开始练习</span></a>'
// The homepage script is stored inside a JS string, so its newlines are the two characters \ n.
// The same course list is inlined in "/", "/read", and "/bible".
const cardAnchor = '<span class=\\"badge\\">中英对照</span></a>`}\\nasync function route(){const p=location.hash.replace'
const cardHits = src.split(cardAnchor).length - 1
if (cardHits !== 3) throw new Error('expected the course-card list 3 times, found ' + cardHits)
src = src.replaceAll(cardAnchor, card + cardAnchor)

const swAnchor =
  "self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/private')"
if (src.split(swAnchor).length !== 2) throw new Error('service worker anchor is not unique')
src = src.replace(
  swAnchor,
  swAnchor.replace(
    "u.pathname.startsWith('/private')",
    "u.pathname.startsWith('/private')||u.pathname==='/typewords'||u.pathname.startsWith('/typewords/')"
  )
)
if (src.split("const V='elh-v12'").length !== 2) throw new Error('service worker version is not unique')
src = src.replace("const V='elh-v12'", "const V='elh-v13'")

const fetchAnchor = 'async fetch(req,env,ctx){const u=new URL(req.url);let p=u.pathname;if(p==="/index.html")p="/";'
if (src.split(fetchAnchor).length !== 2) throw new Error('APP.fetch anchor is not unique')
const handler =
  'async fetch(req,env,ctx){const u=new URL(req.url);let p=u.pathname;if(p==="/index.html")p="/";' +
  'if(p==="/typewords"||p.startsWith("/typewords/"))return await serveTypewords(req,env,ctx,u,p);'
src = src.replace(fetchAnchor, handler)

const helper =
  readFileSync(new URL('./typewords-kv-handler.js', import.meta.url), 'utf8').trim() + '\nconst APP='
if (!src.includes('const APP={async scheduled')) throw new Error('APP object missing')
src = src.replace('const APP={async scheduled', helper + '{async scheduled')

for (const route of routes) {
  const key = JSON.stringify(route)
  if (!src.includes(key + ':')) {
    throw new Error('missing original FILES route ' + route)
  }
}
for (const keep of ['/daily900', '/kids', '/fau', '走遍美国', '少儿英语', '日常口语900句', 'admGate', 'keep_bindings']) {
  if (keep === 'keep_bindings') continue
  if (!src.includes(keep)) throw new Error('missing preserved text ' + keep)
}
const modsOld = "['/voa','voa','美国之音','82 节视频课 · L1–L2']];"
const modsNew =
  "['/voa','voa','美国之音','82 节视频课 · L1–L2'],['/typewords/','','单词打字练习','跟打词库 · 本地练习']];"
if (src.split(modsOld).length !== 2) throw new Error('MODS anchor is not unique')
src = src.replace(modsOld, modsNew)
const iconOld = "+'><span class=\\\"mi\\\">'+(m[4]?"
const iconNew = "+'>'+(m[1]?'<span class=\\\"mi\\\">'+(m[4]?"
if (src.split(iconOld).length !== 2) throw new Error('icon opener is not unique')
src = src.replace(iconOld, iconNew)
const iconCloseOld = ":ic(m[1]))+'</span><b>'"
const iconCloseNew = ":ic(m[1]))+'</span>':'')+'<b>'"
if (src.split(iconCloseOld).length !== 2) throw new Error('icon closer is not unique')
src = src.replace(iconCloseOld, iconCloseNew)
if (!src.includes("['/typewords/','','单词打字练习','跟打词库 · 本地练习']")) throw new Error('visible card missing')
if (!src.includes('单词打字练习')) throw new Error('card missing')
if (src.includes('.admin-login')) throw new Error('unexpected admin login path')

writeFileSync(outPath, src)
console.log(JSON.stringify({
  baselineBytes: baseline.length,
  patchedBytes: Buffer.byteLength(src),
  patchedSha256: createHash('sha256').update(src).digest('hex'),
  routesPreserved: routes.length,
}, null, 2))
