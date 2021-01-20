const core = require('@actions/core');
const exec = require('@actions/exec');
const tc = require('@actions/tool-cache');
const { Octokit } = require("@octokit/rest");

const baseDownloadURL = "https://github.com/vultr/vultr-cli/releases/download"
const fallbackVersion = "2.1.0"
const octokit = new Octokit();

async function downloadDoctl(version) {
    if (process.platform === 'win32') {
        const doctlDownload = await tc.downloadTool(`${baseDownloadURL}/v${version}/vultr-cli_${version}_windows_64-bit.zip`);
        return tc.extractZip(doctlDownload);
    }
    if (process.platform === 'darwin') {
        const doctlDownload = await tc.downloadTool(`${baseDownloadURL}/v${version}/vultr-cli_${version}_macOs_64-bit.tar.gz`);
        return tc.extractTar(doctlDownload);
    }
    const doctlDownload = await tc.downloadTool(`${baseDownloadURL}/v${version}/vultr-cli_${version}_linux_64-bit.tar.gz`);
    return tc.extractTar(doctlDownload);
}

async function run() {
  try { 
    var version = core.getInput('version');
    if ((!version) || (version.toLowerCase() === 'latest')) {
        version = await octokit.repos.getLatestRelease({
            owner: 'vultr',
            repo: 'vultr-cli'
        }).then(result => {
            return result.data.name;
        }).catch(error => {
            // GitHub rate-limits are by IP address and runners can share IPs.
            // This mostly effects macOS where the pool of runners seems limited.
            // Fallback to a known version if API access is rate limited.
            core.warning(`${error.message}

Failed to retrieve latest version; falling back to: ${fallbackVersion}`);
            return fallbackVersion;
        });
    }
    if (version.charAt(0) === 'v') {
        version = version.substr(1);
    }

    var path = tc.find("vultr-cli", version);
    if (!path) {
        const installPath = await downloadDoctl(version);
        path = await tc.cacheDir(installPath, 'vultr-cli', version);
    }
    core.addPath(path);
    core.info(`>>> vultr-cli version v${version} installed to ${path}`);

    var token = core.getInput('token', { required: true });
    process.env.VULTR_API_KEY = token;
    await exec.exec('vultr-cli account');
    core.info('>>> Successfully installed vultr-cli and confirmed API key');
  }
  catch (error) {
    core.setFailed(error.message);
  }
}

run();
