import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Evaluate the actual JSX disabled expressions, without requests or email sends.
// `required` lists the per-page fields that must still block submit when empty.
const pages = {
  SignIn: { required: ["email", "password"] },
  ForgotPassword: { required: ["email"] },
  MFAuth: { required: ["mfaCode"] },
  ResetPassword: {
    required: ["password", "confirmPassword", "confirmationToken"],
    noCaptcha: true,
  },
};

let cases = 0;
for (const [page, { required, noCaptcha }] of Object.entries(pages)) {
  const path = `src/pages/${page}.tsx`;
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const expressions = [];
  const helpers = {};
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === "disabled") {
      assert.ok(node.initializer && ts.isJsxExpression(node.initializer));
      expressions.push(node.initializer.expression.getText(source));
    }
    // Collect local arrow helpers (e.g. allInputsValid) referenced by the guard.
    if (ts.isVariableDeclaration(node) && node.initializer &&
        ts.isArrowFunction(node.initializer)) {
      helpers[node.name.getText(source)] = node.initializer.getText(source);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.equal(expressions.length, 1, `${page}: expected one submit guard`);
  const expr = expressions[0];
  const preamble = Object.entries(helpers)
    .filter(([name]) => expr.includes(`${name}(`))
    .map(([name, fn]) => `const ${name} = ${fn};`).join("\n");

  const defaults = { SINGLE_TENANT_MODE: true, organizationName: "",
    email: "owner@example.test", password: "not-a-real-password",
    confirmPassword: "not-a-real-password", confirmationToken: "token",
    mfaCode: "123456", errorPassword: "", errorPasswordMatch: "",
    captcha: { isPending: false } };
  const disabled = (overrides = {}) => {
    cases++;
    return Boolean(runInNewContext(`${preamble}\n${expr}`, { ...defaults, ...overrides }));
  };

  assert.equal(disabled(), false, `${page}: fresh single-tenant session can submit`);
  assert.equal(disabled({ organizationName: "old-cached-tenant" }), false);
  assert.equal(disabled({ SINGLE_TENANT_MODE: false }), true, `${page}: multi-tenant org required`);
  assert.equal(disabled({ SINGLE_TENANT_MODE: false, organizationName: "organization" }), false);
  for (const field of required) {
    assert.equal(disabled({ [field]: "" }), true, `${page}: ${field} still required`);
  }
  if (!noCaptcha) {
    assert.equal(disabled({ captcha: { isPending: true } }), true, `${page}: captcha guard preserved`);
    assert.equal(disabled({ SINGLE_TENANT_MODE: false, organizationName: "organization",
      captcha: { isPending: true } }), true);
  } else {
    assert.equal(disabled({ errorPassword: "weak" }), true, `${page}: validation errors block`);
    assert.equal(disabled({ errorPasswordMatch: "mismatch" }), true);
  }
}
console.log(`SignIn/ForgotPassword/MFAuth/ResetPassword single-tenant guards PASS ` +
  `(${cases} cases; no API/email side effects).`);
