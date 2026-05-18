// Hotlist hardening test suite.
//
// Runs the actual lib/hotlist, lib/ids, and lib/storage code (no mocks of
// the unit-under-test) and asserts invariants that protect against silent
// data loss. Polyfills a minimal window + localStorage so storage.ts can
// run in Node.
//
// Run with: node --experimental-strip-types scripts/test-hotlist.ts
//
// Exits non-zero on the first failing assertion.

// ---- Polyfills (must run before importing storage.ts) ----

class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return Array.from(this.map.keys())[i] ?? null;
  }
}

const memStorage = new MemStorage();

// @ts-expect-error polyfill
globalThis.window = {
  localStorage: memStorage,
  dispatchEvent: () => true,
};
// @ts-expect-error polyfill
globalThis.localStorage = memStorage;
// @ts-expect-error polyfill
globalThis.CustomEvent = class<T> {
  type: string;
  detail: T;
  constructor(type: string, init: { detail: T }) {
    this.type = type;
    this.detail = init.detail;
  }
};

// ---- Tiny assertion helpers ----

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(cond: unknown, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.error(`  ✗ ${msg}`);
  }
}

function eq<T>(actual: T, expected: T, msg: string) {
  ok(
    actual === expected,
    `${msg}\n      actual:   ${JSON.stringify(actual)}\n      expected: ${JSON.stringify(expected)}`,
  );
}

function section(name: string) {
  console.log(`\n— ${name}`);
}

// ---- Imports of the units under test ----

import { genId } from "../lib/ids.ts";
import {
  createMessage,
  createProspect,
  patchMessageById,
  patchProspectById,
  prependProspects,
  removeMessageById,
  removeProspectById,
} from "../lib/hotlist.ts";
import {
  createAccount,
  emptyAccountData,
  exportAppStateJson,
  listBackups,
  loadAppState,
  parseImportedAppState,
  restoreBackup,
  saveAppState,
} from "../lib/storage.ts";
import type { AppState, HotlistProspect } from "../lib/types.ts";

// ============================================================
// genId
// ============================================================

section("genId: monotonic and collision-free in tight loops");

{
  const ids = new Set<number>();
  let last = 0;
  for (let i = 0; i < 100_000; i++) {
    const id = genId();
    ok(id > last, `id ${id} should be strictly greater than previous ${last}`);
    last = id;
    ids.add(id);
  }
  eq(ids.size, 100_000, "100k genId() calls produce 100k unique ids");
}

// ============================================================
// createProspect / createMessage
// ============================================================

section("createProspect: assigns unique id and trims fields");

{
  const a = createProspect({ firstName: "  Paul  ", lastName: "Meninger" });
  const b = createProspect({ firstName: "  Paul  ", lastName: "Meninger" });
  ok(a.id !== b.id, "two prospects created in the same tick get different ids");
  eq(a.firstName, "Paul", "createProspect trims firstName");
  eq(a.priority, "high", "createProspect defaults priority to high");
  ok(Array.isArray(a.messages), "createProspect.messages is an array");
  eq(a.messages.length, 0, "createProspect.messages defaults to empty");
}

section("createMessage: assigns unique id");

{
  const m1 = createMessage({ channel: "Email", body: "Hi" });
  const m2 = createMessage({ channel: "Email", body: "Hi" });
  ok(m1.id !== m2.id, "two messages get different ids");
  eq(m1.response, "", "default response is empty string");
}

// ============================================================
// removeProspectById
// ============================================================

section("removeProspectById: removes exactly one when found");

{
  const a = createProspect({ firstName: "Alice" });
  const b = createProspect({ firstName: "Bob" });
  const c = createProspect({ firstName: "Carol" });
  const list = [a, b, c];
  const after = removeProspectById(list, b.id);
  eq(after.length, 2, "list shrinks by 1");
  ok(
    !after.some((p) => p.id === b.id),
    "removed prospect is gone",
  );
  ok(
    after.some((p) => p.id === a.id) && after.some((p) => p.id === c.id),
    "other prospects preserved",
  );
}

section("removeProspectById: returns same reference when id not found");

{
  const a = createProspect({ firstName: "Alice" });
  const list = [a];
  const origConsoleWarn = console.warn;
  let warned = false;
  console.warn = () => {
    warned = true;
  };
  const after = removeProspectById(list, 9999999);
  console.warn = origConsoleWarn;
  eq(after, list, "returns original list reference on miss (no-op)");
  ok(warned, "warns when id not found");
}

section("removeProspectById: handles empty list");

{
  const after = removeProspectById([], 123);
  eq(after.length, 0, "empty list stays empty");
}

section("removeProspectById: when id collides on multiple, removes all matching and warns");

{
  const a: HotlistProspect = { ...createProspect({ firstName: "Alice" }), id: 42 };
  const b: HotlistProspect = { ...createProspect({ firstName: "Bob" }), id: 42 };
  const c: HotlistProspect = { ...createProspect({ firstName: "Carol" }), id: 99 };
  const origConsoleWarn = console.warn;
  let warnCount = 0;
  console.warn = () => {
    warnCount++;
  };
  const after = removeProspectById([a, b, c], 42);
  console.warn = origConsoleWarn;
  eq(after.length, 1, "both collided prospects removed");
  ok(warnCount > 0, "warned about collision");
}

// ============================================================
// removeMessageById
// ============================================================

section("removeMessageById: removes one by id, no-op on miss");

{
  const m1 = createMessage({ channel: "Email", body: "one" });
  const m2 = createMessage({ channel: "Email", body: "two" });
  const after = removeMessageById([m1, m2], m1.id);
  eq(after.length, 1, "one message removed");
  eq(after[0].id, m2.id, "correct message remains");

  const origConsoleWarn = console.warn;
  console.warn = () => {};
  const single = [m2];
  const noop = removeMessageById(single, 999);
  console.warn = origConsoleWarn;
  ok(noop === single, "miss returns original list reference (===)");
  ok(noop[0].id === m2.id, "message preserved on miss");
}

// ============================================================
// patchProspectById / patchMessageById
// ============================================================

section("patchProspectById: applies patch, preserves untouched prospects");

{
  const a = createProspect({ firstName: "Alice" });
  const b = createProspect({ firstName: "Bob" });
  const after = patchProspectById([a, b], a.id, { notes: "VIP" });
  eq(after.length, 2, "no prospect dropped");
  eq(after.find((p) => p.id === a.id)?.notes, "VIP", "patch applied");
  eq(
    after.find((p) => p.id === b.id)?.firstName,
    "Bob",
    "untouched prospect unchanged",
  );
}

section("patchProspectById: returns original list on miss");

{
  const a = createProspect({ firstName: "Alice" });
  const orig = [a];
  const origConsoleWarn = console.warn;
  console.warn = () => {};
  const after = patchProspectById(orig, 9999, { notes: "x" });
  console.warn = origConsoleWarn;
  eq(after, orig, "miss returns original list ref");
}

section("patchMessageById: edits message inside prospect, preserves siblings");

{
  const m1 = createMessage({ channel: "Email", body: "one" });
  const m2 = createMessage({ channel: "Email", body: "two" });
  const a = { ...createProspect({ firstName: "Alice" }), messages: [m1, m2] };
  const b = createProspect({ firstName: "Bob" });
  const after = patchMessageById([a, b], a.id, m1.id, { response: "Yes" });
  const updated = after.find((p) => p.id === a.id)!;
  eq(updated.messages.length, 2, "no message dropped");
  eq(updated.messages.find((m) => m.id === m1.id)?.response, "Yes", "patch applied");
  eq(
    updated.messages.find((m) => m.id === m2.id)?.body,
    "two",
    "sibling message preserved",
  );
}

// ============================================================
// Storage round-trip
// ============================================================

section("Storage: save + load preserves hotlist exactly");

{
  memStorage.clear();
  const account = createAccount();
  const p1 = createProspect({ firstName: "Alice", company: "Acme" });
  const p2 = createProspect({ firstName: "Bob", company: "Acme" });
  account.accountData.hotlist = [p1, p2];
  const initial: AppState = {
    accounts: [account],
    currentAccountId: account.id,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
  };
  saveAppState(initial);
  const loaded = loadAppState();
  eq(loaded.accounts.length, 1, "1 account loaded");
  eq(
    loaded.accounts[0].accountData.hotlist.length,
    2,
    "both prospects loaded",
  );
  eq(
    loaded.accounts[0].accountData.hotlist[0].firstName,
    "Alice",
    "first prospect intact",
  );
  eq(
    loaded.accounts[0].accountData.hotlist[1].firstName,
    "Bob",
    "second prospect intact",
  );
  ok(
    loaded.accounts[0].accountData.hotlist[0].id === p1.id &&
      loaded.accounts[0].accountData.hotlist[1].id === p2.id,
    "ids preserved on round-trip",
  );
}

section("Storage: legacy prospects with no id get unique ids on load");

{
  memStorage.clear();
  const account = createAccount();
  // Stuff legacy prospects with no `id` field directly into raw storage.
  const raw: AppState = {
    accounts: [
      {
        ...account,
        accountData: {
          ...account.accountData,
          // @ts-expect-error testing legacy shape
          hotlist: [
            { firstName: "Old1", lastName: "A" },
            { firstName: "Old2", lastName: "B" },
            { firstName: "Old3", lastName: "C" },
          ],
        },
      },
    ],
    currentAccountId: account.id,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
  };
  memStorage.setItem("toptal-sdr-engine::app", JSON.stringify(raw));
  const loaded = loadAppState();
  const ids = loaded.accounts[0].accountData.hotlist.map((p) => p.id);
  const unique = new Set(ids);
  eq(unique.size, 3, "all 3 legacy prospects got unique ids");
  ok(
    ids.every((id) => typeof id === "number" && Number.isFinite(id)),
    "ids are finite numbers",
  );
}

section("Storage: duplicate ids get deduplicated on load");

{
  memStorage.clear();
  const account = createAccount();
  const raw = {
    accounts: [
      {
        ...account,
        accountData: {
          ...account.accountData,
          hotlist: [
            { id: 42, firstName: "Twin1" },
            { id: 42, firstName: "Twin2" },
            { id: 42, firstName: "Twin3" },
          ],
        },
      },
    ],
    currentAccountId: account.id,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
  };
  memStorage.setItem("toptal-sdr-engine::app", JSON.stringify(raw));
  const loaded = loadAppState();
  const ids = loaded.accounts[0].accountData.hotlist.map((p) => p.id);
  const unique = new Set(ids);
  eq(unique.size, 3, "duplicate ids reassigned -> all unique");
  eq(loaded.accounts[0].accountData.hotlist.length, 3, "no prospect lost");
}

// ============================================================
// Backup rotation
// ============================================================

section("Storage: rolling backups preserve previous saves");

{
  memStorage.clear();
  const account = createAccount();
  const stateV1: AppState = {
    accounts: [
      {
        ...account,
        accountData: {
          ...account.accountData,
          hotlist: [createProspect({ firstName: "V1" })],
        },
      },
    ],
    currentAccountId: account.id,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
  };
  saveAppState(stateV1);

  // Now save V2 — V1 should land in backup slot 0
  const stateV2 = JSON.parse(JSON.stringify(stateV1)) as AppState;
  stateV2.accounts[0].accountData.hotlist = [createProspect({ firstName: "V2" })];
  saveAppState(stateV2);

  const backups = listBackups();
  ok(backups.length >= 1, "at least one backup exists after second save");
  const slot0 = backups.find((b) => b.index === 0);
  eq(
    slot0?.state.accounts[0].accountData.hotlist[0].firstName,
    "V1",
    "backup slot 0 holds the V1 state (snapshot before the V2 save)",
  );
}

section("Storage: restoreBackup returns a usable state");

{
  // Continue from previous test setup.
  const backups = listBackups();
  if (backups.length > 0) {
    const restored = restoreBackup(backups[0].index);
    ok(restored !== null, "restoreBackup returns non-null");
    eq(
      restored?.accounts[0].accountData.hotlist.length,
      1,
      "restored state has the V1 hotlist",
    );
  } else {
    ok(false, "expected at least one backup slot for restore test");
  }
}

// ============================================================
// Export / Import round-trip
// ============================================================

section("Export/Import: hotlist preserved exactly across JSON round-trip");

{
  const account = createAccount();
  const p = createProspect({
    firstName: "Diana",
    lastName: "Prince",
    title: "CTO",
    company: "Themyscira",
    linkedinUrl: "https://linkedin.com/in/dprince",
    notes: "Met at conference",
    image: "data:image/png;base64,abc",
    messages: [
      createMessage({ channel: "Email", subject: "Hi", body: "Hello" }),
    ],
  });
  const state: AppState = {
    accounts: [
      {
        ...account,
        accountData: { ...account.accountData, hotlist: [p] },
      },
    ],
    currentAccountId: account.id,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
  };
  const json = exportAppStateJson(state);
  const restored = parseImportedAppState(json);
  const rp = restored.accounts[0].accountData.hotlist[0];
  eq(rp.firstName, "Diana", "firstName preserved");
  eq(rp.lastName, "Prince", "lastName preserved");
  eq(rp.title, "CTO", "title preserved");
  eq(rp.company, "Themyscira", "company preserved");
  eq(rp.linkedinUrl, "https://linkedin.com/in/dprince", "linkedinUrl preserved");
  eq(rp.notes, "Met at conference", "notes preserved");
  eq(rp.image, "data:image/png;base64,abc", "image preserved");
  eq(rp.messages.length, 1, "message preserved");
  eq(rp.messages[0].subject, "Hi", "message subject preserved");
}

// ============================================================
// Stress: prepend many prospects, verify all kept
// ============================================================

section("Stress: 5000 prepends preserve every prospect with unique ids");

{
  let list: HotlistProspect[] = [];
  for (let i = 0; i < 5000; i++) {
    list = prependProspects(list, [createProspect({ firstName: `P${i}` })]);
  }
  eq(list.length, 5000, "all 5000 prospects retained");
  const ids = new Set(list.map((p) => p.id));
  eq(ids.size, 5000, "all 5000 ids unique");
}

// ============================================================
// Final report
// ============================================================

console.log(`\n${"=".repeat(60)}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
process.exit(0);
