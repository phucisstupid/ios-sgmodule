#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const DEFAULT_SHADOWROCKET_OUT = "shadowrocket.conf";
const DEFAULT_SURGE_OUT = "module.sgmodule";

function parseArgs(argv) {
  const args = {
    sourceUrl: null,
    shadowrocketOut: DEFAULT_SHADOWROCKET_OUT,
    surgeOut: DEFAULT_SURGE_OUT,
    input: null,
    name: "Converted Egern",
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--url") {
      args.sourceUrl = next;
      index += 1;
    } else if (arg === "--input") {
      args.input = next;
      index += 1;
    } else if (arg === "--shadowrocket-out") {
      args.shadowrocketOut = next;
      index += 1;
    } else if (arg === "--surge-out") {
      args.surgeOut = next;
      index += 1;
    } else if (arg === "--name") {
      args.name = next;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

async function readSource(args) {
  if (args.input) {
    return fs.readFileSync(args.input, "utf8");
  }

  if (!args.sourceUrl) {
    throw new Error("Provide --url <https://...> or --input <file>");
  }

  const response = await fetch(args.sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${args.sourceUrl}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function stripYamlValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEgernYaml(yaml) {
  const lines = yaml.replace(/\r\n/g, "\n").split("\n");
  const result = {
    mitmHosts: [],
    headerDeletes: [],
    scripts: [],
  };

  let section = "";
  let currentHeaderDelete = null;
  let currentScript = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) continue;

    const topLevel = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*$/);
    if (topLevel) {
      section = topLevel[1];
      currentHeaderDelete = null;
      currentScript = null;
      continue;
    }

    if (section === "mitm") {
      const host = line.match(/^\s*-\s+(.+)$/);
      if (host) result.mitmHosts.push(stripYamlValue(host[1]));
      continue;
    }

    if (section === "header_rewrites") {
      if (/^-\s+delete:\s*$/.test(line)) {
        currentHeaderDelete = {};
        result.headerDeletes.push(currentHeaderDelete);
        continue;
      }

      const property = line.match(/^\s+([A-Za-z_][A-Za-z0-9_]*):\s*(.+)$/);
      if (property && currentHeaderDelete) {
        currentHeaderDelete[property[1]] = stripYamlValue(property[2]);
      }
      continue;
    }

    if (section === "scriptings") {
      const scriptStart = line.match(/^-\s+(http_request|http_response):\s*$/);
      if (scriptStart) {
        currentScript = { type: scriptStart[1] };
        result.scripts.push(currentScript);
        continue;
      }

      const property = line.match(/^\s+([A-Za-z_][A-Za-z0-9_]*):\s*(.+)$/);
      if (property && currentScript) {
        currentScript[property[1]] = stripYamlValue(property[2]);
      }
    }
  }

  return result;
}

function uniqueScriptNames(scripts) {
  const counts = new Map();
  return scripts.map((script) => {
    const baseName = script.name || "Script";
    const count = counts.get(baseName) || 0;
    counts.set(baseName, count + 1);
    return {
      ...script,
      outputName: count === 0 ? baseName : `${baseName}_${count + 1}`,
    };
  });
}

function unique(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function patternToHost(pattern) {
  let normalized = pattern
    .replace(/\\\//g, "/")
    .replace(/\\\./g, ".")
    .replace(/^\^/, "");

  const urlHost = normalized.match(/https?:\/\/([^/\\^$()|?*+\[\]{}]+)/i);
  if (urlHost) return urlHost[1];

  const bareHost = normalized.match(/([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+)/);
  return bareHost ? bareHost[1] : null;
}

function collectMitmHosts(parsed) {
  return unique([
    ...parsed.mitmHosts,
    ...parsed.scripts.map((script) => patternToHost(script.match || "")),
  ]);
}

function headerRewriteLines(parsed) {
  return parsed.headerDeletes
    .filter((item) => item.type === "request" && item.match && item.name)
    .map((item) => `http-request ${item.match} header-del ${item.name}`);
}

function scriptLine(script, options = {}) {
  const type = script.type === "http_request" ? "http-request" : "http-response";
  const parts = [
    `type=${type}`,
    `pattern=${script.match}`,
    `requires-body=${script.body_required === "true" || script.body_required === true ? "true" : "false"}`,
    "max-size=-1",
    "timeout=60",
  ];

  if (script.update_interval) {
    parts.push(`script-update-interval=${script.update_interval}`);
  }

  parts.push(`script-path=${script.script_url}`);

  if (options.shadowrocket) {
    parts.push("enable=true");
  }

  return `${script.outputName} = ${parts.join(",")}`;
}

function renderShadowrocket(parsed, sourceUrl, name) {
  const scripts = uniqueScriptNames(parsed.scripts);
  const mitmHosts = collectMitmHosts({ ...parsed, scripts });
  const sourceText = sourceUrl || "local input";
  return [
    `#!name = ${name}`,
    `#!desc = Converted from ${sourceText} for Shadowrocket.`,
    ...(sourceUrl ? [`#!homepage = ${sourceUrl}`] : []),
    "",
    "[Header Rewrite]",
    ...headerRewriteLines(parsed),
    "",
    "[Script]",
    ...scripts.map((script) => scriptLine(script, { shadowrocket: true })),
    "",
    "[MITM]",
    `hostname = %APPEND% ${mitmHosts.join(", ")}`,
    "",
  ].join("\n");
}

function renderSurge(parsed, sourceUrl, name) {
  const scripts = uniqueScriptNames(parsed.scripts);
  const mitmHosts = collectMitmHosts({ ...parsed, scripts });
  const sourceText = sourceUrl || "local input";
  return [
    `#!name=${name}`,
    `#!desc=Converted from ${sourceText} for Surge.`,
    ...(sourceUrl ? [`#!homepage=${sourceUrl}`] : []),
    "",
    "[Header Rewrite]",
    ...headerRewriteLines(parsed),
    "",
    "[Script]",
    ...scripts.map((script) => scriptLine(script)),
    "",
    "[MITM]",
    `hostname = %APPEND% ${mitmHosts.join(", ")}`,
    "",
  ].join("\n");
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

function validate(parsed) {
  if (parsed.scripts.length === 0) throw new Error("No scriptings entries found");

  for (const script of parsed.scripts) {
    for (const key of ["name", "match", "script_url", "type"]) {
      if (!script[key]) throw new Error(`Script entry is missing ${key}: ${JSON.stringify(script)}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const yaml = await readSource(args);
  const parsed = parseEgernYaml(yaml);
  validate(parsed);

  const shadowrocket = renderShadowrocket(parsed, args.sourceUrl, args.name);
  const surge = renderSurge(parsed, args.sourceUrl, args.name);

  ensureParentDir(args.shadowrocketOut);
  ensureParentDir(args.surgeOut);
  fs.writeFileSync(args.shadowrocketOut, shadowrocket);
  fs.writeFileSync(args.surgeOut, surge);

  const scriptCount = parsed.scripts.length;
  const hostCount = collectMitmHosts(parsed).length;
  console.log(`Converted ${scriptCount} scripts and ${hostCount} MITM hosts`);
  console.log(`Wrote ${args.shadowrocketOut}`);
  console.log(`Wrote ${args.surgeOut}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
