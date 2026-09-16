/**
 * Load-time verification: Maestro ES modules must evaluate before game.i18n exists.
 * Foundry serves these files as ES modules; this repo's package.json is CommonJS,
 * so the runtime import is done from a temporary type:module copy.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { spawnSync } from "child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = [
    "maestro.js",
    "modules/config.js",
    "modules/foundry-compat.js",
    "modules/forms.js",
    "modules/playback.js",
    "modules/misc.js",
    "modules/hype-track.js",
    "modules/item-track.js",
    "modules/combat-track.js",
    "modules/settings.js"
];

for (const file of sourceFiles) {
    const src = fs.readFileSync(path.join(root, file), "utf8");
    const blocks = src.match(/static DEFAULT_OPTIONS = \{[\s\S]*?\n    \};/g) ?? [];
    for (const block of blocks) {
        if (block.includes("game.i18n")) {
            throw new Error(`${file} DEFAULT_OPTIONS evaluates game.i18n at import time`);
        }
    }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-verify-"));
fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ type: "module" }));
fs.mkdirSync(path.join(tmp, "modules"));
for (const file of sourceFiles) {
    fs.copyFileSync(path.join(root, file), path.join(tmp, file));
}

const runner = `
const registered = [];
const menus = [];
const hooks = [];

globalThis.foundry = {
    applications: {
        api: {
            ApplicationV2: class ApplicationV2 {
                static DEFAULT_OPTIONS = {};
                constructor(options = {}) { this.options = options; }
                async render() { return this; }
            }
        },
        ux: { Tabs: class Tabs { bind() {} } }
    },
    documents: { Playlist: { create: async () => ({}) } },
    utils: { mergeObject: (a, b) => Object.assign({}, a, b) }
};

globalThis.game = {
    settings: {
        register(ns, key) { registered.push(ns + "." + key); },
        registerMenu(ns, key) { menus.push(ns + "." + key); }
    }
};

globalThis.Hooks = {
    once(name, fn) { hooks.push({ name, fn }); },
    on(name, fn) { hooks.push({ name, fn }); }
};

globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };

await import("./maestro.js");

for (const hook of hooks) {
    if (hook.name === "init") hook.fn();
}

if (!registered.includes("maestro_pf2e.enableHypeTrack")) {
    throw new Error("Hype Track setting was not registered. Got: " + registered.join(", "));
}
if (!menus.includes("maestro_pf2e.maestroConfigMenu")) {
    throw new Error("Maestro Config menu was not registered. Got: " + menus.join(", "));
}
const visible = registered.filter((key) => key.includes("enableHypeTrack") || key.includes("enableCombatTrack") || key.includes("enableItemTrack"));
console.log("OK: loaded without game.i18n; registered " + registered.length + " settings and " + menus.length + " menus");
console.log(registered.join("\\n"));
console.log("visible flags: " + visible.join(", "));
`;

fs.writeFileSync(path.join(tmp, "run.mjs"), runner);
const result = spawnSync(process.execPath, [path.join(tmp, "run.mjs")], {
    encoding: "utf8",
    cwd: tmp
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
fs.rmSync(tmp, { recursive: true, force: true });
if (result.status !== 0) {
    process.exit(result.status || 1);
}
console.log("OK: no game.i18n in DEFAULT_OPTIONS");
