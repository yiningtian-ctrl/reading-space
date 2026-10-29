// Canonical account browser checks now require verified email.
process.env.QA_URL ||= "http://127.0.0.1:8789";
await import("./qa-email.mjs");
