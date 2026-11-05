# Deploy TypeWords on english-learning-hub

This is an additive deploy of the live Worker `english-learning-hub` version #226
(`c5d5e554-e3ac-4bfc-a71e-1b554712a3e4`). It does not replace the site.

Do not upload unless `worker.js` still has SHA256
`07e0604e77e79d0f2a0bf84b5e16bb8af1c1cf7f5ea0b97365857400e4b80cf8`
before the patch. Do not use the November 2 disk baseline.

## What is preserved

- Every existing `FILES` key and route
- Auth, admin gate, Turnstile, D1, KV, AI, and R2 bindings
- Binding values already stored on Cloudflare (`keep_bindings`)
- R2 bucket `english-zbmg` is not read or written
- Workers `aurora-8a6f4c`, `falling-butterfly-5ed1`, `noisy-scene-f2a3`, and `bible-zh-en` are not used

## Why static assets

The current module is about 3.9 MB. The TypeWords browser build, including the CET-4 dictionary, is larger than that. Inlining it into `FILES` would push Worker startup (1 second parse limit) and make later edits of the learning site rewrite a huge module.

Workers Static Assets are available on the free plan. Asset requests are not billed as Worker requests. The patched module only adds the homepage card and a `/typewords` handler. Existing requests never call `env.ASSETS`.

`compatibility_date` stays `2026-10-01`. Files are stored under the `/typewords/` prefix inside the asset manifest, so `base_path` stays `/`.

`run_worker_first` stays false. Requests that match a file under `/typewords/` are served as static assets and do not spend a Worker invocation. Every other path, including the current site and `/typewords` client routes that have no file, still enters the existing Worker. The manifest contains no `/` or `/index.html`, so the homepage in `FILES["/"]` is unchanged.

## Build

From this repository:

```bash
node deploy/daresay/build-subpath.mjs
node deploy/daresay/patch-worker.mjs /path/to/v226/worker.js /tmp/english-learning-hub.worker.js
node --check /tmp/english-learning-hub.worker.js
```

`dist-typewords/typewords/` is the asset directory.
`dist-typewords/assets-manifest.json` lists Cloudflare asset hashes: SHA-256 of the raw bytes, first 32 hex characters, paths such as `/typewords/index.html`.

## Upload

Account API token needs Workers Scripts write. No new paid plan.

1. `POST /accounts/{account_id}/workers/scripts/english-learning-hub/assets-upload-session`
   with body `{ "manifest": <dist-typewords/assets-manifest.json> }`.
2. For each hash bucket in the response, `POST /accounts/{account_id}/workers/assets/upload?base64=true`
   using the session JWT as `Authorization: Bearer`. Each part name is the hash and the part body is standard base64 of the raw file. The last response returns the completion JWT (valid 1 hour).
3. `PUT /accounts/{account_id}/workers/scripts/english-learning-hub`
   as `multipart/form-data`:

```json
{
  "main_module": "worker.js",
  "compatibility_date": "2026-10-01",
  "keep_bindings": ["secret_text", "plain_text", "r2_bucket", "d1", "kv_namespace", "ai"],
  "bindings": [{ "type": "assets", "name": "ASSETS" }],
  "assets": {
    "jwt": "<completion jwt>",
    "config": {
      "html_handling": "none",
      "not_found_handling": "none",
      "run_worker_first": false
    }
  }
}
```

Attach the patched script as the `worker.js` part (`Content-Type: application/javascript+module`).

`keep_bindings` retains the existing secret, plain text, R2, D1, KV, and AI values. Do not resend those values. The only new binding is `ASSETS`. Do not set `base_path`.

Later script-only uploads must send `keep_assets: true` and keep the `ASSETS` binding, or this page loses its files.

Confirm the new version is at 100% traffic. Check:

- `https://daresay.app/` still lists 日常口语900句, 少儿英语, and 走遍美国, and adds 单词打字练习
- `https://daresay.app/typewords/` loads the practice app
- `https://daresay.app/typewords/list/word.json` and `.../dicts/en/word/CET4_T.json` return JSON
- An existing route such as `/daily900` and login still behave as before

## License

TypeWords is GPL-3.0. This modified version's corresponding source is
https://github.com/foreverontoplife-spec/TypeWords
The served app links to that repository, `LICENSE.txt`, and `DATA-NOTICES.txt`.
New Concept English lesson text and audio are not in the static bundle.
