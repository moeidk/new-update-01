#!/usr/bin/env node
/**
 * scripts/ensure-kv.mjs <staging|production>
 *
 * Runs in GitHub Actions right before `wrangler deploy`. Makes sure the KV namespace that stores
 * encrypted cloud backups exists for the target environment (creating it on the first deploy),
 * then writes its id into wrangler.toml in place of the __KV_ID_<ENV>__ placeholder.
 *
 * Needs CLOUDFLARE_API_TOKEN (permissions: Workers Scripts Edit + Workers KV Storage Edit).
 * CLOUDFLARE_ACCOUNT_ID is optional when the token can see exactly one account.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const env = process.argv[2];
if (env !== 'staging' && env !== 'production') {
  console.error('Usage: node scripts/ensure-kv.mjs <staging|production>');
  process.exit(1);
}

const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  console.error('CLOUDFLARE_API_TOKEN is not set.');
  process.exit(1);
}

const API = 'https://api.cloudflare.com/client/v4';
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function cf(pathname, init = {}) {
  const res = await fetch(`${API}${pathname}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const msg = (body.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ') || res.statusText;
    throw new Error(`Cloudflare API ${pathname} failed (${res.status}): ${msg}`);
  }
  return body;
}

async function resolveAccountId() {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) return process.env.CLOUDFLARE_ACCOUNT_ID.trim();
  const { result } = await cf('/accounts?per_page=50');
  if (!result?.length) throw new Error('No Cloudflare account is visible to this API token.');
  if (result.length > 1) {
    throw new Error('The API token can see several accounts; set the CLOUDFLARE_ACCOUNT_ID secret.');
  }
  return result[0].id;
}

const title = `keeppass-vaults-${env}`;
const accountId = await resolveAccountId();

let namespaceId = null;
for (let page = 1; page <= 20 && !namespaceId; page++) {
  const { result, result_info } = await cf(`/accounts/${accountId}/storage/kv/namespaces?per_page=100&page=${page}`);
  namespaceId = result.find((ns) => ns.title === title)?.id ?? null;
  if (!result_info || page >= result_info.total_pages) break;
}

if (namespaceId) {
  console.log(`KV namespace "${title}" exists (${namespaceId}).`);
} else {
  const { result } = await cf(`/accounts/${accountId}/storage/kv/namespaces`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  namespaceId = result.id;
  console.log(`Created KV namespace "${title}" (${namespaceId}).`);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tomlPath = path.join(root, 'wrangler.toml');
const placeholder = `__KV_ID_${env.toUpperCase()}__`;
const toml = fs.readFileSync(tomlPath, 'utf8');
if (!toml.includes(placeholder)) {
  console.log(`Placeholder ${placeholder} not found in wrangler.toml (already set?).`);
} else {
  fs.writeFileSync(tomlPath, toml.replace(placeholder, namespaceId));
  console.log(`wrangler.toml: ${placeholder} → ${namespaceId}`);
}

if (process.env.GITHUB_ENV && !process.env.CLOUDFLARE_ACCOUNT_ID) {
  fs.appendFileSync(process.env.GITHUB_ENV, `CLOUDFLARE_ACCOUNT_ID=${accountId}\n`);
}
