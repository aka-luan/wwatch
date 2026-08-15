import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyConnectError,
  emptyAddSiteValues,
  validateAddSite,
} from "./add-site-form.ts";

test("validateAddSite requires URL, username, and application password", () => {
  assert.deepEqual(validateAddSite(emptyAddSiteValues()), {
    origin: "Enter the site URL.",
    username: "Enter your WordPress login username.",
    applicationPassword: "Enter the Application Password.",
  });
});

test("validateAddSite rejects URLs without a scheme", () => {
  const errors = validateAddSite({
    ...emptyAddSiteValues(),
    origin: "bakery.example",
    username: "admin",
    applicationPassword: "abcd efgh",
  });
  assert.equal(errors.origin, "Enter a full URL starting with https://.");
  assert.equal(errors.username, undefined);
  assert.equal(errors.applicationPassword, undefined);
});

test("validateAddSite accepts http and https origins", () => {
  assert.deepEqual(
    validateAddSite({
      name: "Bakery",
      origin: "https://bakery.example",
      username: "admin",
      applicationPassword: "abcd",
    }),
    {},
  );
  assert.deepEqual(
    validateAddSite({
      name: "",
      origin: "http://localhost:8080",
      username: "admin",
      applicationPassword: "abcd",
    }),
    {},
  );
});

test("classifyConnectError maps origin and credential failures", () => {
  assert.deepEqual(classifyConnectError("Origin must be https"), {
    field: "origin",
    form: "Origin must be https",
  });
  assert.deepEqual(classifyConnectError("Already connected: https://bakery.example"), {
    field: "origin",
    form: "Already connected: https://bakery.example",
  });
  assert.deepEqual(classifyConnectError("WordPress did not see the Application Password"), {
    field: "applicationPassword",
    form: "WordPress did not see the Application Password",
  });
  assert.deepEqual(classifyConnectError("Application Password was rejected"), {
    field: "applicationPassword",
    form: "Application Password was rejected",
  });
  assert.deepEqual(classifyConnectError("Username and application password are required"), {
    form: "Username and application password are required",
  });
  assert.deepEqual(classifyConnectError(""), { form: "Could not connect." });
});
