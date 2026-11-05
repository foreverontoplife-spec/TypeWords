# Deploy TypeWords on english-learning-hub

Additive deploy of live Worker `english-learning-hub` version **#226**
(`c5d5e554-e3ac-4bfc-a71e-1b554712a3e4`). It does not replace the site.

Do not upload unless the unpacked `worker.js` still has SHA256
`07e0604e77e79d0f2a0bf84b5e16bb8af1c1cf7f5ea0b97365857400e4b80cf8`
before the patch. Do not use the November 2 disk baseline.

The Static Assets upload session is not used. This connector can create that
session but cannot send the session JWT to `assets/upload`. TypeWords is stored
in a new Workers KV namespace and read only through the `TYPEWORDS_ASSETS` binding.

## What is preserved

- Every existing `FILES` key and route
- Auth, admin gate, Turnstile, D1, the existing `KV` binding, AI, and R2 bindings
- Binding values already stored on Cloudflare (`keep_bindings`)
- R2 bucket `english-zbmg` is not read or written
- The existing KV namespace is not listed, read, or written
- Workers `aurora-8a6f4c`, `falling-butterfly-5ed1`, `noisy-scene-f2a3`, and `bible-zh-en` are not used

## Free-tier KV budget

Workers KV on the free plan, reset 00:00 UTC:

| Limit | This deploy |
| --- | --- |
| Stored data, 1 GB per account and per namespace | 11,116,233 bytes (about 10.6 MiB) |
| Value size, 25 MiB | Largest file is the CET-4 dictionary, 4,487,640 bytes |
| Writes to different keys, 1,000 per day | 175 keys, one write each |
| Bulk request, 10,000 pairs and 100 MB | Three PUT bodies, each under 8 MB |
| Reads, 100,000 per day | One read per uncached file. Hashed `/_nuxt/` files are cached |
| List requests, 1,000 per day | Not used. Do not list the namespace |
| Namespaces, 1,000 per account | One new namespace, title `TYPEWORDS_ASSETS` |

A retried full seed spends another 175 writes. Five full seeds in one UTC day stay under 1,000. Do not loop the upload. Writes to the same key are also limited to one per second; the batches write each key once.

Each `/typewords/` request still invokes the Worker, so it counts toward the Workers free daily request limit as well as a KV read when the Cache API misses. Repeat views of `/_nuxt/` files are served from `caches.default` and do not read KV again in that location.

## Order

1. Create the namespace. Do not upload the Worker yet.
2. PUT the three bulk files. Confirm each response has no keys to retry.
3. GET two known keys in the new namespace only.
4. Upload the patched Worker with `keep_bindings` and the new binding.

### 1. Create the namespace

`POST /accounts/{account_id}/storage/kv/namespaces`

```json
{ "title": "TYPEWORDS_ASSETS" }
```

Use the returned `result.id` as `namespace_id`. This is an empty namespace. Do not reuse the existing site KV id.

### 2. Write the files

For each `typewords-kv-bulk-00N.json`:

`PUT /accounts/{account_id}/storage/kv/namespaces/{namespace_id}/bulk`

`Content-Type: application/json`

The body is a JSON array. Each item is `{ "key", "value", "base64": true, "metadata": { "contentType" } }`. `value` is standard base64 of the raw file. The API decodes it before storing. Keys are `typewords/...` with no leading slash.

Official limits: at most 10,000 pairs and 100 MB per request. These batches are inside both.

### 3. Verify before the Worker upload

In the new namespace only:

- `GET /accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/typewords%2Findex.html`
- `GET /accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/typewords%2Fdicts%2Fen%2Fword%2FCET4_T.json`

Compare the body SHA256 with `typewords-kv-manifest.json`. Do not call the list API, and do not read the existing `KV` namespace.

### 4. Upload the Worker

`PUT /accounts/{account_id}/workers/scripts/english-learning-hub`

Multipart form:

- `metadata` from `worker-upload-metadata.json`, with `namespace_id` filled in
- `worker.js` = patched `english-learning-hub.worker.js` (`application/javascript+module`)

```json
{
  "main_module": "worker.js",
  "compatibility_date": "2026-10-01",
  "keep_bindings": ["secret_text", "plain_text", "r2_bucket", "d1", "kv_namespace", "ai"],
  "bindings": [
    { "type": "kv_namespace", "name": "TYPEWORDS_ASSETS", "namespace_id": "<new namespace id>" }
  ]
}
```

`keep_bindings` retains the existing secret, plain text, R2, D1, KV, and AI values. The bindings array adds only `TYPEWORDS_ASSETS`. Do not resend the existing `KV` namespace and do not send secret values.

Later script uploads must keep both `kv_namespace` in `keep_bindings` and must not drop `TYPEWORDS_ASSETS`.

## Build again

```bash
node deploy/daresay/build-subpath.mjs
node deploy/daresay/build-kv-seed.mjs
node deploy/daresay/patch-worker.mjs /path/to/v226/worker.js /tmp/english-learning-hub.worker.js
node --check /tmp/english-learning-hub.worker.js
```

## License

TypeWords is GPL-3.0. This modified version's corresponding source is
https://github.com/foreverontoplife-spec/TypeWords
The served app links to that repository, `LICENSE.txt`, and `DATA-NOTICES.txt`.
New Concept English lesson text and audio are not in the KV seed.
