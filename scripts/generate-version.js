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
    return 'c' + Math.floor(100000 + Math.random() * 900000).toString(16);
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
const pkgVersion = readPackageVersion();

const versionData = {
  version: pkgVersion,
  buildTime,
  gitCommit,
  gitBranch,
  schemaVersion: 2,
  environment: process.env.NODE_ENV === 'production' ? 'production' : (process.env.CF_PAGES_BRANCH ? 'staging' : 'development'),
  releaseName: `KeepPass v${pkgVersion} (${gitCommit})`,
  changelog: [
    'سیستم استقرار دو مرحله‌ای Staging و Production فعال شد',
    'پایش خودکار و اعلان به‌روزرسانی برای مدیر سامانه',
    'موتور مایگریشن مصون‌ساز داده‌های کاربران (Idempotent)',
    'پشتیبانی کامل از ارزیابی کلودفلر Workers و Pages'
  ]
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
