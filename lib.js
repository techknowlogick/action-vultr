// Pure helpers shared by the action. Kept free of @actions/* imports so they
// can be unit tested directly.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const OS_ALIASES = {
  linux: ['linux'],
  darwin: ['darwin', 'macos'],
  win32: ['windows'],
};

const ARCH_ALIASES = {
  x64: ['amd64', 'x86_64', '64-bit', '64bit'],
  arm64: ['arm64', 'aarch64'],
};

// Universal macOS builds work on either architecture.
const DARWIN_UNIVERSAL = ['all', 'universal'];

const ARCHIVE_RE = /\.(tar\.gz|tgz|zip)$/i;
const CHECKSUM_RE = /(checksums?\.txt|sha256sums?(\.txt)?)$/i;

export function normalizeVersion(version) {
  return version.trim().replace(/^v/i, '');
}

function hasToken(name, token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[-_.])${escaped}([-_.]|$)`, 'i').test(name);
}

// Picks the release archive matching the runner's platform and architecture.
export function selectAsset(assets, platform, arch) {
  const osTokens = OS_ALIASES[platform];
  const archTokens = ARCH_ALIASES[arch];
  if (!osTokens || !archTokens) {
    throw new Error(`Unsupported platform/architecture: ${platform}/${arch}`);
  }

  const archives = assets.filter(a => ARCHIVE_RE.test(a.name) && osTokens.some(t => hasToken(a.name, t)));
  let matches = archives.filter(a => archTokens.some(t => hasToken(a.name, t)));
  if (matches.length === 0 && platform === 'darwin') {
    matches = archives.filter(a => DARWIN_UNIVERSAL.some(t => hasToken(a.name, t)));
  }
  if (matches.length === 0) {
    const names = assets.map(a => a.name).join(', ');
    throw new Error(`No release asset found for ${platform}/${arch}. Available assets: ${names}`);
  }

  // Prefer .zip on Windows and tarballs elsewhere when both exist.
  const preferZip = platform === 'win32';
  matches.sort((a, b) => Number(/\.zip$/i.test(b.name) === preferZip) - Number(/\.zip$/i.test(a.name) === preferZip));
  return matches[0];
}

export function findChecksumAsset(assets) {
  return assets.find(a => CHECKSUM_RE.test(a.name));
}

// Parses `sha256sum`-style output into a Map of file name -> lowercase hash.
export function parseChecksums(text) {
  const sums = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
    if (match) {
      sums.set(path.basename(match[2].trim()), match[1].toLowerCase());
    }
  }
  return sums;
}

export function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('error', reject)
      .on('data', chunk => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

// Returns the directory under `dir` that contains `binary`, searching recursively.
export async function findBinaryDir(dir, binary) {
  const entries = await readdir(dir, { withFileTypes: true });
  if (entries.some(e => e.isFile() && e.name === binary)) {
    return dir;
  }
  for (const entry of entries.filter(e => e.isDirectory())) {
    const found = await findBinaryDir(path.join(dir, entry.name), binary);
    if (found) {
      return found;
    }
  }
  return undefined;
}
