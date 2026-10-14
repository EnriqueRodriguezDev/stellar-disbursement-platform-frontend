import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const parse = (path) => ts.createSourceFile(path, readFileSync(path, "utf8"),
  ts.ScriptTarget.Latest, true, path.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const find = (source, predicate) => {
  let result;
  const visit = (node) => {
    if (!result && predicate(node)) result = node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(result, "Expected source contract exists");
  return result;
};
const hook = parse("src/hooks/useCaptcha.ts");
const token = find(hook, n => ts.isVariableDeclaration(n) && n.name.getText(hook) === "getToken");
const code = ts.transpileModule(`globalThis.handler = ${token.initializer.getText(hook)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText;
let executions = 0;
const context = { isCaptchaDisabled: false, captchaConfig: {}, siteKey: "public-key", isV3: true,
  recaptchaToken: "v2-token", executeRecaptchaV3: async () => { executions++; return "v3-token"; } };
const get = (overrides = {}) => {
  const sandbox = { ...context, ...overrides };
  runInNewContext(code, sandbox);
  return sandbox.handler("login");
};
assert.equal(await get({ isCaptchaDisabled: true, siteKey: "", captchaConfig: null }), "");
assert.equal(executions, 0);
await assert.rejects(get({ captchaConfig: null }), /configuration could not be loaded/);
await assert.rejects(get({ siteKey: "" }), /site key is missing/);
assert.equal(executions, 0, "Misconfiguration must not execute Google CAPTCHA");
assert.equal(await get(), "v3-token");
assert.equal(await get({ isV3: false }), "v2-token");

const account = parse("src/store/ducks/userAccount.ts");
const pending = find(account, n => ts.isCallExpression(n) &&
  n.arguments[0]?.getText(account) === "signInAction.pending");
const pendingCode = ts.transpileModule(`globalThis.handler = ${pending.arguments[1].getText(account)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText;
const sandbox = { initialState: {} };
runInNewContext(pendingCode, sandbox);
const state = { isSessionExpired: true, errorString: "old error", isAuthenticated: false };
sandbox.handler(state);
assert.equal(state.isSessionExpired, false);
assert.equal(state.errorString, undefined);
assert.equal(state.status, "PENDING");
assert.equal(state.isAuthenticated, false, "Retry must not grant authentication");
for (const page of ["SignIn", "ForgotPassword"]) {
  const text = readFileSync(`src/pages/${page}.tsx`, "utf8");
  assert.ok(text.includes("setCaptchaError(err instanceof Error"));
  assert.ok(text.includes('title="Verification unavailable"'));
}
assert.ok(!readFileSync("src/pages/SignIn.tsx", "utf8")
  .includes("!isSessionExpired && userAccount.errorString"));
console.log("Auth recovery PASS: captcha failures visible, retry clears stale notice, no auth bypass.");
