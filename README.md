# iOS sgmodule

Convert the AppTesters Egern config into iOS proxy-client formats:

- Shadowrocket config
- Surge `.sgmodule`

Shadowrocket config:

```text
https://raw.githubusercontent.com/phucisstupid/ios-sgmodule/refs/heads/main/shadowrocket.conf
```
Surge config:

```text
https://raw.githubusercontent.com/phucisstupid/ios-sgmodule/refs/heads/main/module.sgmodule
```

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
