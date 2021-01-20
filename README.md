# GitHub Actions for Vultr

This action enables you to interact with [vultr](https://www.vultr.com/) services by installing [the `vultr-cli` command-line client](https://github.com/vultr/vultr-cli).

## Usage

To install the latest version of `vultr-cli` and use it in GitHub Actions workflows, add the following step:

```yaml
    - name: Install vultr-cli
      uses: techknowlogick/action-vultr@v2
      with:
        token: ${{ secrets.VULTR_API_KEY }}
```

`vultr-cli` will now be available in the virtual environment and can be used directly in following steps. 

### Arguments

- `token` – (**Required**) A Vultr API Key
- `version` – (Optional) The version of `vultr-cli` to install. If excluded, the latest release will be used.

## Contributing

To install the needed dependencies, run `npm install`. The resulting `node_modules/` directory _is not_ checked in to Git.

Before submitting a pull request, run `npm run package` to package the code [using `ncc`](https://github.com/zeit/ncc#ncc). Packaging assembles the code including dependencies into one file in the `dist/` directory that is checked in to Git.

Pull requests should be made against the `v2` branch.

## License

This GitHub Action and associated scripts and documentation in this project are released under the [MIT License](LICENSE).

## Credits

Forked from DigitalOcean's doctl action
