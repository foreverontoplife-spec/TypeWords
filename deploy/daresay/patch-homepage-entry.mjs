import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const input = process.argv[2]
const output = process.argv[3]
if (!input || !output) {
  console.error('usage: node deploy/daresay/patch-homepage-entry.mjs <worker.js> <out.js>')
  process.exit(1)
}

const EXPECTED = '501d97d49490b8c0702e1cd7348bd40602c3bdba587918adcdd1ce75b5f9bfc6'
const baseline = readFileSync(input)
const sha = createHash('sha256').update(baseline).digest('hex')
if (sha !== EXPECTED) {
  console.error('expected deployed #227 sha, got', sha)
  process.exit(1)
}

let src = baseline.toString('utf8')
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

const routes = readFileSync(new URL('./FILES_ROUTES.snapshot.txt', import.meta.url), 'utf8')
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean)
for (const route of routes) {
  if (!src.includes(JSON.stringify(route) + ':')) throw new Error('missing route ' + route)
}
for (const keep of ['日常口语900句', '少儿英语', '走遍美国', 'TYPEWORDS_ASSETS', '更多板块', 'sx-gone']) {
  if (!src.includes(keep)) throw new Error('missing ' + keep)
}
if (src.includes('.admin-login')) throw new Error('unexpected admin login path')
if (!src.includes("['/typewords/','','单词打字练习','跟打词库 · 本地练习']")) {
  throw new Error('visible card missing')
}

writeFileSync(output, src)
console.log(JSON.stringify({
  bytes: Buffer.byteLength(src),
  sha256: createHash('sha256').update(src).digest('hex'),
  routes: routes.length,
}, null, 2))
