# Egern Config Converter

Convert an Egern YAML module into:

- Shadowrocket config syntax
- Surge `.sgmodule` syntax

The converter is dependency-free and runs with Node.js 20 or newer.

## Usage

Convert a remote Egern YAML file:

```bash
node tools/convert-egern.js \
  --url https://example.com/egern.yaml \
  --name "Example Module" \
  --shadowrocket-out dist/shadowrocket.conf \
  --surge-out dist/module.sgmodule
```

Convert a local file:

```bash
node tools/convert-egern.js \
  --input ./egern.yaml \
  --name "Example Module" \
  --shadowrocket-out dist/shadowrocket.conf \
  --surge-out dist/module.sgmodule
```

## GitHub Action

The included workflow can be run manually from the Actions tab.

Inputs:

- `source_url`: Egern YAML URL to convert. Defaults to `https://apptesters.org/egern.yaml`.
- `module_name`: display name used in generated config metadata. Defaults to `AppTesters`.

The workflow uploads the generated Shadowrocket and Surge files as an artifact named `converted-egern-configs`.

## Supported Egern Sections

The converter currently handles the Egern fields used by simple scripting modules:

- `mitm.hostnames`
- `header_rewrites` with request header deletion
- `scriptings` with `http_request` and `http_response`

Duplicate script names are made unique by appending `_2`, `_3`, and so on.

## Notes

Only convert and publish configs you own or are authorized to redistribute. Generated scripts and MITM rules can affect app traffic and should be reviewed before use.
