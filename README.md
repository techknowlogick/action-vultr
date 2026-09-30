# GitHub Actions for Vultr

This action enables you to interact with [Vultr](https://www.vultr.com/) services by installing [the `vultr-cli` command-line client](https://github.com/vultr/vultr-cli).

## Usage

To install the latest version of `vultr-cli` and use it in GitHub Actions workflows, add the following step:

```yaml
    - name: Install vultr-cli
      uses: techknowlogick/action-vultr@v3
      with:
        token: ${{ secrets.VULTR_API_KEY }}

    - run: vultr-cli instance list
```

To install a specific version instead:

```yaml
    - name: Install vultr-cli
      uses: techknowlogick/action-vultr@v3
      with:
        token: ${{ secrets.VULTR_API_KEY }}
        version: 3.0.0
```

`vultr-cli` will now be available on the `PATH`, and the API key is exported as `VULTR_API_KEY`, so later steps in the same job can use `vultr-cli` directly. The API key is masked in logs. The action checks the API key by running `vultr-cli account`, and fails if the API key is invalid.

The action supports Linux, macOS and Windows runners on x64 and arm64. Each download is checked against the release's published SHA-256 checksums.

### Inputs

- `token` – (**Required**) A Vultr API key.
- `version` – (Optional) The version of `vultr-cli` to install, e.g. `3.0.0`. Defaults to the latest release.
- `github-token` – (Optional) Token used to look up `vultr-cli` releases on GitHub. Defaults to the workflow's `GITHUB_TOKEN` on github.com, which avoids the unauthenticated API rate limit.

### Outputs

- `version` – The version of `vultr-cli` that was installed.

## Contributing

To install the needed dependencies, run `npm ci`. The resulting `node_modules/` directory _is not_ checked in to Git.

Run `npm test` to lint the code and run the unit tests.

Before submitting a pull request, run `npm run package` to package the code [using `ncc`](https://github.com/vercel/ncc). Packaging assembles the code including dependencies into the `dist/` directory, which is checked in to Git.

Pull requests should be made against the `v2` branch.

## License

This GitHub Action and associated scripts and documentation in this project are released under the [MIT License](LICENSE).

## Credits

Forked from DigitalOcean's [doctl action](https://github.com/digitalocean/action-doctl).
