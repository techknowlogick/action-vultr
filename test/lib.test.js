import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  findBinaryDir,
  findChecksumAsset,
  normalizeVersion,
  parseChecksums,
  selectAsset,
  sha256File,
} from '../lib.js';

const asset = name => ({ name, browser_download_url: `https://example.com/${name}` });

// Naming schemes used by the Hetzner and Vultr CLIs across releases.
const hcloudAssets = [
  'checksums.txt',
  'hcloud-darwin-amd64.tar.gz',
  'hcloud-darwin-arm64.tar.gz',
  'hcloud-linux-amd64.tar.gz',
  'hcloud-linux-arm64.tar.gz',
  'hcloud-linux-armv7.tar.gz',
  'hcloud-windows-amd64.zip',
  'hcloud-windows-arm64.zip',
].map(asset);

const vultrAssets = [
  'vultr-cli_v3.0.0_checksums.txt',
  'vultr-cli_v3.0.0_linux_amd64.tar.gz',
  'vultr-cli_v3.0.0_linux_arm64.tar.gz',
  'vultr-cli_v3.0.0_macOs_amd64.tar.gz',
  'vultr-cli_v3.0.0_macOs_arm64.tar.gz',
  'vultr-cli_v3.0.0_windows_amd64.zip',
].map(asset);

const legacyAssets = [
  'hcloud-macos-amd64.zip',
  'vultr-cli_2.5.2_linux_64-bit.tar.gz',
  'vultr-cli_2.5.2_windows_64-bit.zip',
].map(asset);

test('normalizeVersion strips a leading v and whitespace', () => {
  assert.equal(normalizeVersion(' v1.2.3 '), '1.2.3');
  assert.equal(normalizeVersion('1.2.3'), '1.2.3');
  assert.equal(normalizeVersion('latest'), 'latest');
});

test('selectAsset matches every supported platform and architecture', () => {
  const cases = [
    [hcloudAssets, 'linux', 'x64', 'hcloud-linux-amd64.tar.gz'],
    [hcloudAssets, 'linux', 'arm64', 'hcloud-linux-arm64.tar.gz'],
    [hcloudAssets, 'darwin', 'x64', 'hcloud-darwin-amd64.tar.gz'],
    [hcloudAssets, 'darwin', 'arm64', 'hcloud-darwin-arm64.tar.gz'],
    [hcloudAssets, 'win32', 'x64', 'hcloud-windows-amd64.zip'],
    [hcloudAssets, 'win32', 'arm64', 'hcloud-windows-arm64.zip'],
    [vultrAssets, 'linux', 'x64', 'vultr-cli_v3.0.0_linux_amd64.tar.gz'],
    [vultrAssets, 'linux', 'arm64', 'vultr-cli_v3.0.0_linux_arm64.tar.gz'],
    [vultrAssets, 'darwin', 'arm64', 'vultr-cli_v3.0.0_macOs_arm64.tar.gz'],
    [vultrAssets, 'win32', 'x64', 'vultr-cli_v3.0.0_windows_amd64.zip'],
    [legacyAssets, 'darwin', 'x64', 'hcloud-macos-amd64.zip'],
    [legacyAssets, 'linux', 'x64', 'vultr-cli_2.5.2_linux_64-bit.tar.gz'],
    [legacyAssets, 'win32', 'x64', 'vultr-cli_2.5.2_windows_64-bit.zip'],
  ];
  for (const [assets, platform, arch, expected] of cases) {
    assert.equal(selectAsset(assets, platform, arch).name, expected, `${platform}/${arch}`);
  }
});

test('selectAsset falls back to universal macOS builds', () => {
  const assets = ['tool_darwin_all.tar.gz', 'tool_linux_amd64.tar.gz'].map(asset);
  assert.equal(selectAsset(assets, 'darwin', 'arm64').name, 'tool_darwin_all.tar.gz');
});

test('selectAsset prefers zip on Windows and tarballs elsewhere', () => {
  const assets = ['t_windows_amd64.tar.gz', 't_windows_amd64.zip', 't_linux_amd64.zip', 't_linux_amd64.tar.gz'].map(asset);
  assert.equal(selectAsset(assets, 'win32', 'x64').name, 't_windows_amd64.zip');
  assert.equal(selectAsset(assets, 'linux', 'x64').name, 't_linux_amd64.tar.gz');
});

test('selectAsset rejects unsupported or missing targets', () => {
  assert.throws(() => selectAsset(hcloudAssets, 'freebsd', 'x64'), /Unsupported/);
  assert.throws(() => selectAsset(hcloudAssets, 'linux', 'ia32'), /Unsupported/);
  assert.throws(() => selectAsset(legacyAssets, 'linux', 'arm64'), /No release asset/);
});

test('findChecksumAsset finds both naming schemes', () => {
  assert.equal(findChecksumAsset(hcloudAssets).name, 'checksums.txt');
  assert.equal(findChecksumAsset(vultrAssets).name, 'vultr-cli_v3.0.0_checksums.txt');
  assert.equal(findChecksumAsset(legacyAssets), undefined);
});

test('parseChecksums reads sha256sum output', () => {
  const a = 'a'.repeat(64);
  const b = 'B'.repeat(64);
  const sums = parseChecksums(`${a}  hcloud-linux-amd64.tar.gz\r\n${b} *dist/hcloud-windows-amd64.zip\n\ngarbage\n`);
  assert.equal(sums.get('hcloud-linux-amd64.tar.gz'), a);
  assert.equal(sums.get('hcloud-windows-amd64.zip'), 'b'.repeat(64));
  assert.equal(sums.size, 2);
});

test('sha256File and findBinaryDir work on real files', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'lib-test-'));
  const nested = path.join(root, 'pkg', 'bin');
  await mkdir(nested, { recursive: true });
  await writeFile(path.join(nested, 'tool'), 'hello');

  assert.equal(
    await sha256File(path.join(nested, 'tool')),
    '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
  );
  assert.equal(await findBinaryDir(root, 'tool'), nested);
  assert.equal(await findBinaryDir(root, 'missing'), undefined);
});
