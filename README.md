# iOS sgmodule

Convert the AppTesters Egern config into iOS proxy-client formats:

- Shadowrocket config
- Surge `.sgmodule`

Default source:

```text
https://apptesters.org/egern.yaml
```

The converter is dependency-free and runs with Node.js 20 or newer. It reads the Egern YAML, converts script rules, header rewrites, and MITM hostnames, then writes Shadowrocket and Surge-compatible output files.

## Usage

Run the default AppTesters conversion:

```bash
node tools/convert-egern.js \
  --url https://apptesters.org/egern.yaml \
  --name "AppTesters" \
  --shadowrocket-out shadowrocket.conf \
  --surge-out module.sgmodule
```

Convert a local Egern YAML file:

```bash
node tools/convert-egern.js \
  --input ./egern.yaml \
  --name "Example Module" \
  --shadowrocket-out shadowrocket.conf \
  --surge-out module.sgmodule
```

Generated files:

- `shadowrocket.conf`: import into Shadowrocket.
- `module.sgmodule`: import into Surge.

## GitHub Action

The included workflow can be run manually from the Actions tab.

Inputs:

- `source_url`: Egern YAML URL to convert. Defaults to `https://apptesters.org/egern.yaml`.
- `module_name`: display name used in generated config metadata. Defaults to `AppTesters`.

The workflow writes the generated Shadowrocket and Surge files to the project root, commits them back to `main`, and uploads the same files as an artifact named `converted-egern-configs`.

To use it:

1. Open the repository on GitHub.
2. Go to `Actions`.
3. Select `Convert Egern Config`.
4. Click `Run workflow`.
5. Leave the defaults for AppTesters, or provide another Egern YAML URL.
6. Use `shadowrocket.conf` or `module.sgmodule` from the repository root, or download the `converted-egern-configs` artifact after the run completes.

## Supported Egern Sections

The converter currently handles the Egern fields used by AppTesters-style scripting modules:

- `mitm.hostnames`
- `header_rewrites` with request header deletion
- `scriptings` with `http_request` and `http_response`

Duplicate script names are made unique by appending `_2`, `_3`, and so on.

## Script Behavior

Converted script entries keep the original remote `script_url` values from the Egern config. The generated files do not bundle JavaScript source code; Shadowrocket or Surge downloads the remote script URLs when the matching request or response rule runs.

For these scripts to run in Shadowrocket or Surge:

- enable the generated module/config
- install and trust the app's MITM certificate
- enable MITM for the generated hostnames
- make sure the target traffic is routed through the proxy app
- reopen the target app after enabling the config

Some apps use certificate pinning or traffic patterns that prevent HTTPS interception. In those cases, a converted script rule may not run even when the config syntax is valid.

## Notes

Only convert and publish configs you own or are authorized to redistribute. Generated scripts and MITM rules can affect app traffic and should be reviewed before use.
