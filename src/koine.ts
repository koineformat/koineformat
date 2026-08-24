#!/usr/bin/env node
/**
 * The `koine` CLI shell: parse argv, dispatch to a command, render the result
 * quietly (U8 — say exactly what changed, nothing more), and turn any KoineError
 * into `error: <cause>` + `→ <fix>` (U6). No stack traces reach users.
 */
import { createRequire } from "node:module";
import { isKoineError } from "./core/errors.js";
import { add } from "./commands/add.js";
import { install } from "./commands/install.js";
import { update } from "./commands/update.js";
import { verify } from "./commands/verify.js";
import { list } from "./commands/list.js";
import { remove } from "./commands/remove.js";
import { init } from "./commands/init.js";
import { seal } from "./commands/seal.js";

const VERSION = (() => {
  try {
    const require = createRequire(import.meta.url);
    return (require("../package.json") as { version: string }).version;
  } catch {
    return "0.0.0";
  }
})();

const USAGE = `koine — open knowledge packages for agents (v${VERSION})

Consumer:
  koine add <source> [--as <dir>]   vendor a package into ./knowledge/, write the lock
  koine install                     restore every package from the lockfile
  koine update [name] [--force]     re-resolve tracked sources; --force overrides local edits
  koine verify [name]               re-hash on-disk files vs manifest + lock (offline)
  koine list                        show installed packages and their status
  koine remove <name>               delete a package's directory and lock entry

Publisher:
  koine init [dir] [--name <n>] [--force]   scaffold a pin.json (--force overwrites)
  koine seal [dir]                          recompute contents[] hashes + provenance

Sources:
  github:owner/repo[/sub/path][#ref]      path:../local/folder

Docs: https://koineformat.com  ·  Spec: SPEC.md`;

interface Parsed {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

const VALUE_FLAGS = new Set(["as", "name"]);
const SHORT: Record<string, string> = { h: "help", f: "force", v: "version" };

function parseArgs(argv: string[]): Parsed {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq >= 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        if (VALUE_FLAGS.has(key)) flags[key] = argv[++i] ?? "";
        else flags[key] = true;
      }
    } else if (a.length > 1 && a.startsWith("-")) {
      flags[SHORT[a.slice(1)] ?? a.slice(1)] = true;
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

const log = (s = ""): void => console.log(s);
const short = (ref?: string): string => (ref && /^[0-9a-f]{40}$/i.test(ref) ? ref.slice(0, 7) : ref ?? "");
const str = (v: string | boolean | undefined): string | undefined => (typeof v === "string" ? v : undefined);

async function run(argv: string[]): Promise<number> {
  const { positionals, flags } = parseArgs(argv);
  const cmd = positionals[0];
  const cwd = process.cwd();

  if (flags["version"]) {
    log(VERSION);
    return 0;
  }
  // Asking for help is a success, whether or not a command came with it; only
  // being invoked with nothing to do is a usage error.
  if (flags["help"]) {
    log(USAGE);
    return 0;
  }
  if (!cmd) {
    log(USAGE);
    return 1;
  }

  switch (cmd) {
    case "add": {
      const source = positionals[1];
      if (!source) return usageError(`'koine add' needs a <source>.`);
      const r = await add({ cwd, source, ...(str(flags["as"]) ? { as: str(flags["as"]) } : {}) });
      if (r.alreadyUpToDate) log(`= ${r.name} already up to date (${r.version})`);
      else log(`+ added ${r.name} @ ${r.version}${r.ref ? ` (${short(r.ref)})` : ""} → ${r.dir}/  ·  ${r.fileCount} file(s)`);
      for (const w of r.warnings) log(`  ! ${w}`);
      return 0;
    }
    case "install": {
      const r = await install({ cwd });
      const restored = r.items.filter((i) => i.restored);
      for (const i of restored) log(`+ restored ${i.name} → ${i.dir}/`);
      if (r.items.length === 0) log(`nothing to install — the lockfile has no packages`);
      else log(`${restored.length} restored, ${r.items.length - restored.length} already current`);
      return 0;
    }
    case "update": {
      const r = await update({
        cwd,
        ...(positionals[1] ? { name: positionals[1] } : {}),
        ...(flags["force"] ? { force: true } : {}),
      });
      for (const i of r.items) {
        if (i.updated) log(`↑ updated ${i.name} ${i.from} → ${i.to}`);
        else log(`= ${i.name} already current (${i.to})`);
      }
      if (r.items.length === 0) log(`nothing to update`);
      return 0;
    }
    case "verify": {
      const r = await verify({ cwd, ...(positionals[1] ? { name: positionals[1] } : {}) });
      for (const i of r.items) {
        if (i.status === "ok") log(`✓ ${i.name} ok (${i.version})`);
        else {
          log(`✗ ${i.name} ${i.status}`);
          for (const issue of i.issues) log(`    ${issue}`);
        }
      }
      if (r.items.length === 0) log(`no packages installed`);
      else if (r.ok) log(`all ${r.items.length} package(s) verified`);
      return r.ok ? 0 : 1;
    }
    case "list": {
      const r = await list({ cwd });
      if (r.items.length === 0) {
        log(`no packages installed — 'koine add <source>' to add one`);
        return 0;
      }
      const w = Math.max(4, ...r.items.map((i) => i.name.length));
      for (const i of r.items) {
        const mark = i.status === "ok" ? "✓" : i.status === "missing" ? "?" : "✗";
        log(`${mark} ${i.name.padEnd(w)}  ${i.version.padEnd(12)}  ${i.status.padEnd(8)}  ${i.requested}`);
      }
      return 0;
    }
    case "remove": {
      const name = positionals[1];
      if (!name) return usageError(`'koine remove' needs a <name>.`);
      const r = await remove({ cwd, name });
      log(`- removed ${r.name} (${r.dir}/)`);
      return 0;
    }
    case "init": {
      const r = await init({
        cwd,
        ...(positionals[1] ? { dir: positionals[1] } : {}),
        ...(str(flags["name"]) ? { name: str(flags["name"]) } : {}),
        ...(flags["force"] ? { force: true } : {}),
      });
      log(`+ wrote ${r.path}  (${r.name} @ ${r.version})`);
      log(`  add your knowledge files, then run 'koine seal'`);
      return 0;
    }
    case "seal": {
      const r = await seal({ cwd, ...(positionals[1] ? { dir: positionals[1] } : {}) });
      if (r.migratedFromV0) log(`  migrated pin.json → koine.json (emit new, read old)`);
      log(`sealed ${r.path}: ${r.nodeCount} bodies mapped, one root hash  (${r.name} @ ${r.version})`);
      return 0;
    }
    // `koine help` is an alias for `--help`, nothing more: any extra words are
    // ignored, so `koine help add` prints the same usage rather than erroring on
    // per-command help this CLI does not have.
    case "help": {
      log(USAGE);
      return 0;
    }
    default:
      return usageError(`unknown command "${cmd}".`);
  }
}

function usageError(msg: string): number {
  console.error(`error: ${msg}`);
  console.error(`  → Run 'koine --help' for usage.`);
  return 1;
}

try {
  process.exitCode = await run(process.argv.slice(2));
} catch (e) {
  if (isKoineError(e)) {
    console.error(`error: ${e.message}`);
    console.error(`  → ${e.fix}`);
  } else {
    console.error(`error: ${(e as Error)?.message ?? String(e)}`);
    console.error(`  → Unexpected error. Please report it at https://github.com/koineformat/koineformat/issues`);
  }
  process.exitCode = 1;
}
