import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/contact.js";

function post(body, ip) {
  return onRequestPost({
    request: new Request("https://pregnut.com/api/contact", {
      method: "POST",
      headers: {
        origin: "https://pregnut.com",
        "content-type": "application/json",
        "cf-connecting-ip": ip
      },
      body: JSON.stringify(body)
    }),
    env: {}
  });
}

const message = "Hello from the contact form, this is long enough.";

test("honeypot submissions are accepted quietly and not given an id", async function () {
  const res = await post({
    name: "A B",
    email: "a@example.com",
    topic: "General question",
    message,
    page: "/contact/",
    website: "https://spam.example",
    started_at: String(Date.now() - 10000)
  }, "203.0.113.10");
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.id, undefined);
});

test("a note submitted immediately is still quiet at the API", async function () {
  const res = await post({
    name: "A B",
    email: "a@example.com",
    topic: "General question",
    message,
    page: "/contact/",
    website: "",
    started_at: String(Date.now())
  }, "203.0.113.11");
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.equal("id" in body, false);
});

test("a slow valid note is not quietly dropped when mail is unconfigured", async function () {
  const res = await post({
    name: "A B",
    email: "a@example.com",
    topic: "General question",
    message,
    page: "/contact/",
    website: "",
    started_at: String(Date.now() - 10000)
  }, "203.0.113.12");
  const body = await res.json();
  assert.equal(res.status, 503);
  assert.equal(body.ok, false);
});

test("other sites cannot post the contact form", async function () {
  const res = await onRequestPost({
    request: new Request("https://pregnut.com/api/contact", {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      body: JSON.stringify({ email: "a@example.com", message, started_at: "1" })
    }),
    env: {}
  });
  assert.equal(res.status, 403);
});
