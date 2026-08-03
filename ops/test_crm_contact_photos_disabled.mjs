import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../app/public/crm-whatsapp.html", import.meta.url), "utf8");

assert.doesNotMatch(
  html,
  /<script[^>]+crm-profile-photo-bridge\.js/i,
  "the official CRM must not load contact photos or their extra conversation refresh",
);
assert.match(
  html,
  /this\.avatar\(c\.ci,40\)/,
  "contact initials must remain available when profile photos are disabled",
);

console.log("crm-contact-photos-disabled-ok");
