import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Evaluate the actual JSX disabled expressions, without requests or email sends.
for (const page of ["SignIn", "ForgotPassword"]) {
  const path = `src/pages/${page}.tsx`;
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const expressions = [];
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === "disabled") {
      assert.ok(node.initializer && ts.isJsxExpression(node.initializer));
      expressions.push(node.initializer.expression.getText(source));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.equal(expressions.length, 1, `${page}: expected one submit guard`);
  const defaults = { SINGLE_TENANT_MODE: true, organizationName: "",
    email: "owner@example.test", password: "not-a-real-password", captcha: { isPending: false } };
  const disabled = (overrides = {}) => Boolean(runInNewContext(expressions[0], {
    ...defaults, ...overrides
  }));
  assert.equal(disabled(), false, `${page}: fresh single-tenant session can submit`);
  assert.equal(disabled({ organizationName: "old-cached-tenant" }), false);
  assert.equal(disabled({ email: "" }), true, `${page}: email still required`);
  assert.equal(disabled({ captcha: { isPending: true } }), true, `${page}: captcha guard preserved`);
  assert.equal(disabled({ SINGLE_TENANT_MODE: false }), true, `${page}: multi-tenant org required`);
  assert.equal(disabled({ SINGLE_TENANT_MODE: false, organizationName: "organization" }), false);
  assert.equal(disabled({ SINGLE_TENANT_MODE: false, organizationName: "organization",
    captcha: { isPending: true } }), true);
  if (page === "SignIn") assert.equal(disabled({ password: "" }), true);
}
console.log("SignIn/ForgotPassword single-tenant guards PASS (15 cases; no API/email side effects).");
