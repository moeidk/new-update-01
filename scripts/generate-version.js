#!/usr/bin/env node
/**
 * scripts/generate-version.js
 * Generates version.json with build metadata before packaging
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function getGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: rootDir, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return (process.env.GITHUB_SHA || 'local').slice(0, 7);
  }
}

function getGitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return process.env.BRANCH || process.env.CF_PAGES_BRANCH || 'main';
  }
}

function getRecentChanges() {
  try {
    return execSync('git log -8 --no-merges --pretty=format:%s', { cwd: rootDir, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Version shown in the app: MAJOR.MINOR from package.json, PATCH = number of commits.
 * Every push therefore gets a new, higher version automatically (2.0.8, 2.0.9, ...).
 * For a bigger release, bump MAJOR or MINOR in package.json by hand (e.g. "2.1.0").
 */
function computeVersion(pkgVersion) {
  const [major = '1', minor = '0'] = String(pkgVersion).split('.');
  let build = null;
  try {
    const shallow = execSync('git rev-parse --is-shallow-repository', { cwd: rootDir, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (shallow !== 'true') {
      build = execSync('git rev-list --count HEAD', { cwd: rootDir, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
    }
  } catch {
    /* not a git checkout */
  }
  if (!build) build = process.env.GITHUB_RUN_NUMBER || '0';
  return `${major}.${minor}.${build}`;
}

function readPackageVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

const buildTime = new Date().toISOString();
const gitCommit = getGitCommit();
const gitBranch = getGitBranch();
const pkgVersion = computeVersion(readPackageVersion());

// DEPLOY_ENV is set by the GitHub Actions workflow (production / staging).
const environment = process.env.DEPLOY_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'development');

const versionData = {
  version: pkgVersion,
  buildTime,
  gitCommit,
  gitBranch: process.env.GITHUB_REF_NAME || gitBranch,
  schemaVersion: 3,
  environment,
  releaseName: `KeepPass v${pkgVersion} (${gitCommit})`,
  changelog: getRecentChanges(),
};

// Ensure public directory exists
const publicDir = path.join(rootDir, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write to public/version.json
const publicVersionPath = path.join(publicDir, 'version.json');
fs.writeFileSync(publicVersionPath, JSON.stringify(versionData, null, 2), 'utf8');
console.log(`[Version Generator] Generated ${publicVersionPath} (${versionData.releaseName})`);

// Also write to dist/version.json if dist exists
const distDir = path.join(rootDir, 'dist');
if (fs.existsSync(distDir)) {
  fs.writeFileSync(path.join(distDir, 'version.json'), JSON.stringify(versionData, null, 2), 'utf8');
}
