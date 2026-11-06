import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const outRoot = join(root, 'dist-typewords')
const siteRoot = join(outRoot, 'typewords')

const env = {
  ...process.env,
  TYPEWORDS_STATIC: '1',
  NUXT_APP_BASE_URL: '/typewords/',
  ORIGIN: 'https://daresay.app',
  HOST: 'daresay.app',
  NODE_ENV: 'production',
}

const generated = spawnSync('pnpm', ['exec', 'nuxt', 'generate'], {
  cwd: root,
  env,
  stdio: 'inherit',
})
if (generated.status !== 0) process.exit(generated.status ?? 1)

const nuxtPublic = join(root, '.output', 'public')
rmSync(outRoot, { recursive: true, force: true })
mkdirSync(siteRoot, { recursive: true })
cpSync(nuxtPublic, siteRoot, { recursive: true })

// Nuxt may already nest the build under public/typewords when baseURL is set.
const nested = join(siteRoot, 'typewords')
if (statSafe(join(nested, 'index.html'))) {
  const tmp = join(outRoot, 'nested-tmp')
  rmSync(tmp, { recursive: true, force: true })
  cpSync(nested, tmp, { recursive: true })
  rmSync(siteRoot, { recursive: true, force: true })
  cpSync(tmp, siteRoot, { recursive: true })
  rmSync(tmp, { recursive: true, force: true })
}

rmSync(join(siteRoot, '_redirects'), { force: true })
for (const tracker of ['libs/t.js', 'libs/51.js', 'libs/s.js', 'libs/lafiveone.js']) {
  rmSync(join(siteRoot, tracker), { force: true })
}
rmSync(join(siteRoot, 'sound', 'article'), { recursive: true, force: true })
rmSync(join(siteRoot, 'dicts', 'en', 'article'), { recursive: true, force: true })
writeFileSync(join(siteRoot, 'list', 'article.json'), '[]\n')
writeFileSync(join(siteRoot, 'list', 'recommend_article.json'), '[]\n')
cpSync(join(root, 'LICENSE'), join(siteRoot, 'LICENSE.txt'))
cpSync(join(root, 'NOTICE'), join(siteRoot, 'NOTICE.txt'))
if (!statSafe(join(siteRoot, 'DATA-NOTICES.txt'))) {
  cpSync(join(root, 'public', 'DATA-NOTICES.txt'), join(siteRoot, 'DATA-NOTICES.txt'))
}

const files = []
walk(siteRoot, file => files.push(file))
let bytes = 0
const manifest = {}
for (const file of files) {
  const body = readFileSync(file)
  bytes += body.length
  const rel = '/' + relative(siteRoot, file).split('\\').join('/')
  manifest['/typewords' + (rel === '/' ? '' : rel)] = {
    hash: createHash('sha256').update(body).digest('hex').slice(0, 32),
    size: body.length,
  }
}
writeFileSync(join(outRoot, 'assets-manifest.json'), JSON.stringify(manifest, null, 2))
const summary = {
  files: files.length,
  bytes,
  mebibytes: Math.round((bytes / 1024 / 1024) * 100) / 100,
  index: statSafe(join(siteRoot, 'index.html')),
  dictionary: statSafe(join(siteRoot, 'dicts', 'en', 'word', 'CET4_T.json')),
  wordList: statSafe(join(siteRoot, 'list', 'word.json')),
  nceArticleRemoved: !statSafe(join(siteRoot, 'dicts', 'en', 'article', 'NCE_1.json')),
  nceAudioRemoved: !statSafe(join(siteRoot, 'sound', 'article')),
}
writeFileSync(join(outRoot, 'build-summary.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))

function walk(dir, visit) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) walk(path, visit)
    else visit(path)
  }
}

function statSafe(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}
