import { readFile } from 'node:fs/promises';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import { HttpClient } from '@actions/http-client';
import {
  findBinaryDir,
  findChecksumAsset,
  normalizeVersion,
  parseChecksums,
  selectAsset,
  sha256File,
} from './lib.js';

const TOOL = {
  name: 'vultr-cli',
  repo: 'vultr/vultr-cli',
  tokenEnv: 'VULTR_API_KEY',
  verifyArgs: ['account'],
};

async function getRelease(version, githubToken) {
  const client = new HttpClient(`action-${TOOL.name}`);
  const headers = { Accept: 'application/vnd.github+json' };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  const base = `https://api.github.com/repos/${TOOL.repo}/releases`;
  const urls = version === 'latest'
    ? [`${base}/latest`]
    : [`${base}/tags/v${version}`, `${base}/tags/${version}`];
  for (const url of urls) {
    const response = await client.getJson(url, headers);
    if (response.result) {
      return response.result;
    }
  }
  throw new Error(`No ${TOOL.name} release found for version "${version}" in ${TOOL.repo}`);
}

async function verifyChecksum(assets, asset, archivePath) {
  const checksumAsset = findChecksumAsset(assets);
  if (!checksumAsset) {
    core.warning(`Release has no checksum file; skipping integrity check of ${asset.name}`);
    return;
  }
  const checksumPath = await tc.downloadTool(checksumAsset.browser_download_url);
  const expected = parseChecksums(await readFile(checksumPath, 'utf8')).get(asset.name);
  if (!expected) {
    throw new Error(`${checksumAsset.name} has no entry for ${asset.name}`);
  }
  const actual = await sha256File(archivePath);
  if (actual !== expected) {
    throw new Error(`Checksum mismatch for ${asset.name}: expected ${expected}, got ${actual}`);
  }
  core.info(`Verified SHA-256 checksum of ${asset.name}`);
}

async function download(release, version) {
  const asset = selectAsset(release.assets, process.platform, process.arch);
  core.info(`Downloading ${asset.browser_download_url}`);
  const archivePath = await tc.downloadTool(asset.browser_download_url);
  await verifyChecksum(release.assets, asset, archivePath);

  const extracted = /\.zip$/i.test(asset.name)
    ? await tc.extractZip(archivePath)
    : await tc.extractTar(archivePath);
  const binary = process.platform === 'win32' ? `${TOOL.name}.exe` : TOOL.name;
  const binDir = await findBinaryDir(extracted, binary);
  if (!binDir) {
    throw new Error(`Could not find ${binary} in ${asset.name}`);
  }
  return tc.cacheDir(binDir, TOOL.name, version, process.arch);
}

async function run() {
  try {
    const token = core.getInput('token');
    if (token) {
      core.setSecret(token);
    }
    const githubToken = core.getInput('github-token');

    const requested = normalizeVersion(core.getInput('version') || 'latest');
    const isLatest = requested.toLowerCase() === 'latest';

    let version = isLatest ? undefined : requested;
    let toolPath = version && tc.find(TOOL.name, version, process.arch);
    if (!toolPath) {
      const release = await getRelease(isLatest ? 'latest' : requested, githubToken);
      version = normalizeVersion(release.tag_name);
      toolPath = tc.find(TOOL.name, version, process.arch) || await download(release, version);
    }
    core.addPath(toolPath);
    core.setOutput('version', version);
    core.info(`>>> ${TOOL.name} v${version} installed to ${toolPath}`);

    if (!token) {
      core.info(`>>> No token given; skipping API key check and ${TOOL.tokenEnv} export`);
      return;
    }
    // Exported so the token is also available to later steps in the job.
    core.exportVariable(TOOL.tokenEnv, token);
    await exec.exec(TOOL.name, TOOL.verifyArgs);
    core.info(`>>> Successfully installed ${TOOL.name} and confirmed API key`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
