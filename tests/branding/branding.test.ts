// A client's look from /branding/me: anything missing or malformed falls back
// to the defaults, so a half-answer never paints the console wrong.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ASSISTANT_NAME, DEFAULT_BRANDING, sanitize } from "../../src/branding/branding.ts";

test("nothing from the server is the OLIWA defaults", () => {
  assert.deepEqual(sanitize(undefined), DEFAULT_BRANDING);
  assert.deepEqual(sanitize("not json"), DEFAULT_BRANDING);
  assert.equal(sanitize({}).assistant_name, DEFAULT_ASSISTANT_NAME);
});

test("a client's own look is kept", () => {
  const b = sanitize({
    brand_color: "#1D4ED8", accent_color: "#38BDF8", on_accent: "#111B21",
    assistant_name: "Kato", can_edit: true, allow_colors: true,
    customised: { brand_color: true, accent_color: true, assistant_name: true },
  });
  assert.equal(b.brand_color, "#1D4ED8");
  assert.equal(b.assistant_name, "Kato");
  assert.equal(b.can_edit, true);
  assert.equal(b.customised.assistant_name, true);
});

test("malformed colours and names fall back one by one", () => {
  const b = sanitize({ brand_color: "blue", accent_color: "#38BDF8", assistant_name: "   " });
  assert.equal(b.brand_color, DEFAULT_BRANDING.brand_color);
  assert.equal(b.accent_color, "#38BDF8");
  assert.equal(b.assistant_name, DEFAULT_ASSISTANT_NAME);
});

test("editing is off unless the server says so", () => {
  const b = sanitize({ can_edit: "yes", enabled: 1 });
  assert.equal(b.can_edit, false);
  assert.equal(b.enabled, false);
});

test("a long name is cut to 24 characters", () => {
  assert.equal(sanitize({ assistant_name: "K".repeat(40) }).assistant_name.length, 24);
});
