import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";
const script = readFileSync("railway/entrypoint.sh", "utf8");
// Exercise the actual serialization pipeline without touching Nginx or /usr.
const pipeline = script.slice(script.indexOf("jq -n"))
  .replace(/ > \/usr\/share\/nginx\/html\/settings\/env-config\.js\s*$/, "");
const hostile = 'key"; globalThis.injected = true; //\nquote"';
const result = spawnSync("sh", ["-c", pipeline], { encoding: "utf8",
  env: { ...process.env, API_URL: "https://api.example.test",
    RECAPTCHA_SITE_KEY: hostile, RPC_ENABLED: "false", SINGLE_TENANT_MODE: "true",
    DATABASE_URL: "never-public", ADMIN_API_KEY: "never-public" } });
assert.equal(result.status, 0, result.stderr);
const sandbox = { window: {} };
runInNewContext(result.stdout, sandbox);
assert.equal(sandbox.window._env_.API_URL, "https://api.example.test");
assert.equal(sandbox.window._env_.RECAPTCHA_SITE_KEY, hostile);
assert.equal(sandbox.window._env_.RPC_ENABLED, false);
assert.equal(sandbox.window._env_.SINGLE_TENANT_MODE, true);
assert.equal(sandbox.injected, undefined);
assert.ok(!result.stdout.includes("never-public"));
assert.ok(readFileSync("Dockerfile.railway", "utf8").includes("RUN yarn vite build"));
console.log("Frontend runtime configuration PASS (JSON types/escaping/public allowlist).");
