// Hotlist hardening test suite.
//
// Runs the actual lib/hotlist, lib/ids, lib/storage, and lib/imageStore
// code (no mocks of the unit-under-test) and asserts invariants that
// protect against silent data loss. Polyfills window + localStorage and
// uses fake-indexeddb so the IDB-backed image store can run in Node.
//
// Run with: npm run test:hotlist
//
// Exits non-zero on the first failing assertion.

// Polyfill IndexedDB before importing anything that uses it.
import "fake-indexeddb/auto";

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
  clearAllBackups,
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
// Message save flow
// ============================================================

section("Messages: createMessage assigns unique ids in tight loops");

{
  const ids = new Set<number>();
  for (let i = 0; i < 1000; i++) {
    const m = createMessage({ channel: "Email", body: `body-${i}` });
    ids.add(m.id);
  }
  eq(ids.size, 1000, "1000 messages get unique ids");
}

section("Messages: addMessage preserves existing messages and prepends");

{
  const m1 = createMessage({ channel: "Email", body: "first" });
  const m2 = createMessage({ channel: "Email", body: "second" });
  const a = { ...createProspect({ firstName: "Alice" }), messages: [m1] };
  // Simulate parent addMessage: prepend new message
  const next = [a].map((p) =>
    p.id === a.id ? { ...p, messages: [m2, ...p.messages] } : p,
  );
  eq(next[0].messages.length, 2, "both messages present");
  eq(next[0].messages[0].body, "second", "newest first");
  eq(next[0].messages[1].body, "first", "older preserved");
}

section("Messages: patchMessageById preserves siblings and other prospects");

{
  const m1 = createMessage({ channel: "Email", body: "one" });
  const m2 = createMessage({ channel: "Email", body: "two" });
  const m3 = createMessage({ channel: "LinkedIn", body: "three" });
  const a = { ...createProspect({ firstName: "Alice" }), messages: [m1, m2] };
  const b = { ...createProspect({ firstName: "Bob" }), messages: [m3] };
  const after = patchMessageById([a, b], a.id, m1.id, { response: "Got it" });
  const aAfter = after.find((p) => p.id === a.id)!;
  const bAfter = after.find((p) => p.id === b.id)!;
  eq(aAfter.messages.length, 2, "Alice's message count unchanged");
  eq(
    aAfter.messages.find((m) => m.id === m1.id)?.response,
    "Got it",
    "patch applied",
  );
  eq(
    aAfter.messages.find((m) => m.id === m2.id)?.body,
    "two",
    "sibling message preserved",
  );
  eq(bAfter.messages.length, 1, "Bob's messages preserved");
  eq(bAfter.messages[0].body, "three", "other prospect's message intact");
}

section("Messages: removeMessageById no-ops on missing id");

{
  const m1 = createMessage({ channel: "Email", body: "keep me" });
  const origConsoleWarn = console.warn;
  console.warn = () => {};
  const after = removeMessageById([m1], 999999);
  console.warn = origConsoleWarn;
  eq(after.length, 1, "list unchanged on missing id");
  eq(after[0].body, "keep me", "message intact");
}

// ============================================================
// Pending compose draft (autosave)
// ============================================================

section("pendingDraft: round-trips through save + load with content");

{
  memStorage.clear();
  const account = createAccount();
  const prospect = createProspect({ firstName: "Alice" });
  prospect.pendingDraft = {
    channel: "Email",
    subject: "Re: Q3 plans",
    body: "Hey Alice, following up on our chat —",
    response: "",
  };
  const state: AppState = {
    accounts: [
      {
        ...account,
        accountData: { ...account.accountData, hotlist: [prospect] },
      },
    ],
    currentAccountId: account.id,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
  };
  saveAppState(state);
  const loaded = loadAppState();
  const loadedProspect = loaded.accounts[0].accountData.hotlist[0];
  ok(loadedProspect.pendingDraft !== undefined, "pendingDraft preserved");
  eq(
    loadedProspect.pendingDraft?.body,
    "Hey Alice, following up on our chat —",
    "draft body preserved",
  );
  eq(
    loadedProspect.pendingDraft?.subject,
    "Re: Q3 plans",
    "draft subject preserved",
  );
  eq(loadedProspect.pendingDraft?.channel, "Email", "draft channel preserved");
}

section("pendingDraft: empty draft is dropped on load to avoid storage clutter");

{
  memStorage.clear();
  const account = createAccount();
  const prospect = createProspect({ firstName: "Alice" });
  // @ts-expect-error testing legacy-style empty draft
  prospect.pendingDraft = { channel: "Email", subject: "", body: "", response: "" };
  const state: AppState = {
    accounts: [
      {
        ...account,
        accountData: { ...account.accountData, hotlist: [prospect] },
      },
    ],
    currentAccountId: account.id,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
  };
  saveAppState(state);
  const loaded = loadAppState();
  const loadedProspect = loaded.accounts[0].accountData.hotlist[0];
  eq(
    loadedProspect.pendingDraft,
    undefined,
    "empty draft cleared on load",
  );
}

section("pendingDraft: invalid channel coerces to Email on load");

{
  memStorage.clear();
  const account = createAccount();
  const prospect = createProspect({ firstName: "Alice" });
  // Force an invalid channel through the wire
  prospect.pendingDraft = {
    // @ts-expect-error testing coercion
    channel: "NotAValidChannel",
    subject: "",
    body: "Something",
    response: "",
  };
  const state: AppState = {
    accounts: [
      {
        ...account,
        accountData: { ...account.accountData, hotlist: [prospect] },
      },
    ],
    currentAccountId: account.id,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
  };
  saveAppState(state);
  const loaded = loadAppState();
  const draft = loaded.accounts[0].accountData.hotlist[0].pendingDraft;
  eq(draft?.channel, "Email", "invalid channel coerced to Email");
  eq(draft?.body, "Something", "body content preserved");
}

section("pendingDraft: survives a save -> backup -> restore round-trip");

{
  memStorage.clear();
  const account = createAccount();
  const prospect = createProspect({ firstName: "Alice" });
  prospect.pendingDraft = {
    channel: "LinkedIn",
    subject: "",
    body: "Long draft worth preserving",
    response: "",
  };
  const state: AppState = {
    accounts: [
      {
        ...account,
        accountData: { ...account.accountData, hotlist: [prospect] },
      },
    ],
    currentAccountId: account.id,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
  };
  saveAppState(state);

  // Save a second time with the draft erased -> the draft state goes into
  // backup slot 0.
  const stateV2 = JSON.parse(JSON.stringify(state)) as AppState;
  delete stateV2.accounts[0].accountData.hotlist[0].pendingDraft;
  saveAppState(stateV2);

  const restored = restoreBackup(0);
  ok(restored !== null, "backup slot 0 restorable");
  eq(
    restored?.accounts[0].accountData.hotlist[0].pendingDraft?.body,
    "Long draft worth preserving",
    "draft body recovered from backup",
  );
}

// ============================================================
// Quota recovery
// ============================================================

section("Storage: saveAppState drops backup slots and retries on quota error");

{
  memStorage.clear();
  const baseState: AppState = {
    accounts: [createAccount()],
    currentAccountId: null,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
  };
  // Seed all 3 backup slots with something to sacrifice.
  memStorage.setItem("toptal-sdr-engine::backup::0", JSON.stringify(baseState));
  memStorage.setItem("toptal-sdr-engine::backup::1", JSON.stringify(baseState));
  memStorage.setItem("toptal-sdr-engine::backup::2", JSON.stringify(baseState));

  // Wrap setItem to throw QuotaExceededError on the primary key until we've
  // dropped enough backups. We declare success after 2 drops.
  const realSetItem = memStorage.setItem.bind(memStorage);
  let attemptsBeforeAccept = 2;
  memStorage.setItem = (k: string, v: string) => {
    if (k === "toptal-sdr-engine::app" && attemptsBeforeAccept > 0) {
      attemptsBeforeAccept--;
      const err = new Error("quota exceeded (simulated)");
      err.name = "QuotaExceededError";
      throw err;
    }
    realSetItem(k, v);
  };

  // Track which events fire.
  let recoveredDroppedCount = -1;
  let failedFired = false;
  const origDispatch = globalThis.window.dispatchEvent;
  // @ts-expect-error polyfill stub
  globalThis.window.dispatchEvent = (e: Event) => {
    if (e.type === "toptal-sdr-engine:save-recovered") {
      recoveredDroppedCount =
        (e as CustomEvent<{ droppedBackups: number }>).detail
          ?.droppedBackups ?? -1;
    }
    if (e.type === "toptal-sdr-engine:save-failed") failedFired = true;
    return true;
  };

  saveAppState(baseState);

  // Restore.
  memStorage.setItem = realSetItem;
  globalThis.window.dispatchEvent = origDispatch;

  ok(!failedFired, "save did not surface as failed (recovery succeeded)");
  eq(recoveredDroppedCount, 2, "exactly 2 backups dropped to make room");
  ok(
    memStorage.getItem("toptal-sdr-engine::app") !== null,
    "primary state was actually saved",
  );
}

section("Storage: clearAllBackups removes every backup slot");

{
  memStorage.clear();
  memStorage.setItem("toptal-sdr-engine::backup::0", "{}");
  memStorage.setItem("toptal-sdr-engine::backup::1", "{}");
  const cleared = clearAllBackups();
  ok(cleared >= 2, "at least 2 backup slots cleared");
  eq(memStorage.getItem("toptal-sdr-engine::backup::0"), null, "slot 0 gone");
  eq(memStorage.getItem("toptal-sdr-engine::backup::1"), null, "slot 1 gone");
}

section("Storage: saveAppState surfaces failure when even cleared backups don't help");

{
  memStorage.clear();
  const baseState: AppState = {
    accounts: [createAccount()],
    currentAccountId: null,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
  };
  // No backups exist, and setItem always rejects with quota.
  const realSetItem = memStorage.setItem.bind(memStorage);
  memStorage.setItem = (k: string) => {
    if (k === "toptal-sdr-engine::app") {
      const err = new Error("quota exceeded (always)");
      err.name = "QuotaExceededError";
      throw err;
    }
    // allow other writes
  };
  let failedFired = false;
  const origDispatch = globalThis.window.dispatchEvent;
  // @ts-expect-error polyfill
  globalThis.window.dispatchEvent = (e: Event) => {
    if (e.type === "toptal-sdr-engine:save-failed") failedFired = true;
    return true;
  };
  saveAppState(baseState);
  memStorage.setItem = realSetItem;
  globalThis.window.dispatchEvent = origDispatch;
  ok(failedFired, "save-failed event fired when no recovery was possible");
}

// ============================================================
// Image store (IndexedDB) — async tests run inside main()
// ============================================================

import {
  _resetImageCacheForTests,
  deleteImage,
  IDB_PREFIX,
  inlineFromIdb,
  isIdbRef,
  isInlineDataUrl,
  loadImage,
  migrateInlineToIdb,
  putImage,
} from "../lib/imageStore.ts";
import {
  exportAppStateJsonAsync,
  migrateInlineImagesInState,
  parseImportedAppStateAsync,
} from "../lib/storage.ts";

const SAMPLE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=";

// ============================================================
// Goals & Benchmarks — date math and rollups
// ============================================================

import {
  appendLog,
  bucketLogsForChart,
  chartGranularityFor,
  createLog,
  defaultQuarterlyGoals,
  emptyGoalsState,
  findQuarterlyGoals,
  formatIsoDate,
  getQuarterOf,
  groupLogsByWeek,
  isWeekLocked,
  isWeekManuallySaved,
  removeLog,
  resolveViewPeriod,
  saveWeek,
  sumLogsInRange,
  toggleWeekUnlock,
  unsaveWeek,
  updateLog,
  upsertQuarterlyGoals,
  weekEndFor,
  weekStartFor,
} from "../lib/goals.ts";

section("goals: weekStartFor returns Monday 00:00 for a mid-week date");

{
  // Wed 2026-01-14 -> Monday 2026-01-12
  const wed = new Date(2026, 0, 14, 15, 30);
  const start = weekStartFor(wed);
  eq(formatIsoDate(start), "2026-01-12", "Wednesday resolves to preceding Monday");
  eq(start.getHours(), 0, "Monday is at 00:00");
  eq(start.getMinutes(), 0, "Monday is at 00:00");
}

section("goals: weekStartFor rolls back from Sunday to previous Monday");

{
  const sun = new Date(2026, 0, 18, 9, 0); // Sun 2026-01-18
  const start = weekStartFor(sun);
  eq(formatIsoDate(start), "2026-01-12", "Sunday resolves to previous Monday");
}

section("goals: weekEndFor returns Sunday 23:59:59");

{
  const wed = new Date(2026, 0, 14);
  const end = weekEndFor(wed);
  eq(formatIsoDate(end), "2026-01-18", "week ends on Sunday");
  eq(end.getHours(), 23, "end at 23:xx");
  eq(end.getMinutes(), 59, "end at 23:59");
}

section("goals: getQuarterOf identifies quarters correctly");

{
  eq(getQuarterOf(new Date(2026, 0, 15)).quarter, 1, "Jan is Q1");
  eq(getQuarterOf(new Date(2026, 3, 1)).quarter, 2, "Apr is Q2");
  eq(getQuarterOf(new Date(2026, 6, 1)).quarter, 3, "Jul is Q3");
  eq(getQuarterOf(new Date(2026, 9, 1)).quarter, 4, "Oct is Q4");
  eq(getQuarterOf(new Date(2026, 11, 31)).year, 2026, "year preserved");
}

section("goals: findQuarterlyGoals returns null when unset");

{
  const g = emptyGoalsState();
  eq(findQuarterlyGoals(g, 2026, 1), null, "empty state returns null");
}

section("goals: upsertQuarterlyGoals inserts and replaces by (year, quarter)");

{
  let g = emptyGoalsState();
  g = upsertQuarterlyGoals(g, {
    ...defaultQuarterlyGoals(2026, 1),
    dailyDialsGoal: 40,
  });
  const found = findQuarterlyGoals(g, 2026, 1);
  eq(found?.dailyDialsGoal, 40, "inserted goals found");

  g = upsertQuarterlyGoals(g, {
    ...defaultQuarterlyGoals(2026, 1),
    dailyDialsGoal: 50,
  });
  eq(g.quarterly.length, 1, "only one Q1 2026 entry after replace");
  eq(
    findQuarterlyGoals(g, 2026, 1)?.dailyDialsGoal,
    50,
    "value replaced",
  );
}

section("goals: appendLog / updateLog / removeLog preserve invariants");

{
  let g = emptyGoalsState();
  const entry = createLog("dial", 3, { note: " test note " });
  g = appendLog(g, entry);
  eq(g.logs.length, 1, "one log");
  eq(g.logs[0].count, 3, "count preserved");
  eq(g.logs[0].note, "test note", "note trimmed");

  g = updateLog(g, entry.id, { count: 5 });
  eq(g.logs[0].count, 5, "count updated");

  g = removeLog(g, entry.id);
  eq(g.logs.length, 0, "log removed");
}

section("goals: createLog rejects invalid counts");

{
  const zero = createLog("dial", 0);
  eq(zero.count, 1, "count 0 clamped to 1");
  const neg = createLog("dial", -5);
  eq(neg.count, 1, "negative clamped to 1");
  const frac = createLog("dial", 3.7);
  eq(frac.count, 3, "fractional floored");
}

section("goals: createLog carries optional accountId when provided");

{
  const tagged = createLog("prospect-added", 4, { accountId: "acct-1" });
  eq(tagged.accountId, "acct-1", "accountId preserved");
  const untagged = createLog("prospect-added", 2);
  ok(untagged.accountId === undefined, "no accountId when not passed");
  const empty = createLog("prospect-added", 2, { accountId: "" });
  ok(empty.accountId === undefined, "empty accountId dropped");
}

section("goals: updateLog can patch accountId");

{
  let g = emptyGoalsState();
  const entry = createLog("prospect-added", 2);
  g = appendLog(g, entry);
  g = updateLog(g, entry.id, { accountId: "acct-99" });
  eq(g.logs[0].accountId, "acct-99", "accountId patched onto entry");
}

section("goals: sumLogsInRange aggregates by kind within range");

{
  const now = new Date(2026, 0, 14, 12, 0); // Wed noon
  const g: import("../lib/types.ts").UserGoalsState = {
    quarterly: [],
    unlockedWeekStarts: [], manuallySavedWeekStarts: [],
    logs: [
      { id: 1, kind: "dial", timestamp: now.getTime() - 3600_000, count: 5 },
      { id: 2, kind: "dial", timestamp: now.getTime() - 60_000, count: 3 },
      { id: 3, kind: "prospect-added", timestamp: now.getTime(), count: 2 },
      { id: 4, kind: "dial", timestamp: now.getTime() - 8 * 24 * 3600_000, count: 100 }, // 8 days ago
    ],
  };
  const weekStart = weekStartFor(now).getTime();
  const weekEnd = weekEndFor(now).getTime();
  const roll = sumLogsInRange(g.logs, weekStart, weekEnd);
  eq(roll.dials, 8, "dials this week = 5 + 3, not 100 from 8 days ago");
  eq(roll.prospects, 2, "prospects this week = 2");
}

section("goals: groupLogsByWeek buckets entries by week, current always present");

{
  const now = new Date(2026, 0, 14, 12, 0);
  const g: import("../lib/types.ts").UserGoalsState = {
    quarterly: [],
    unlockedWeekStarts: [], manuallySavedWeekStarts: [],
    logs: [
      // This week
      { id: 1, kind: "dial", timestamp: now.getTime() - 3600_000, count: 5 },
      // Last week (Wed Jan 7)
      {
        id: 2,
        kind: "dial",
        timestamp: new Date(2026, 0, 7, 10).getTime(),
        count: 12,
      },
      // Last week (Sun Jan 11) — same bucket as above
      {
        id: 3,
        kind: "prospect-added",
        timestamp: new Date(2026, 0, 11, 20).getTime(),
        count: 4,
      },
    ],
  };
  const buckets = groupLogsByWeek(g, now);
  eq(buckets.length, 2, "two week buckets");
  ok(buckets[0].isCurrent, "first bucket (newest) is current week");
  eq(buckets[0].totals.dials, 5, "current week dials");
  eq(buckets[1].totals.dials, 12, "previous week dials");
  eq(buckets[1].totals.prospects, 4, "previous week prospects");
}

section("goals: groupLogsByWeek always includes current week even with no logs");

{
  const now = new Date(2026, 0, 14, 12, 0);
  const g = emptyGoalsState();
  const buckets = groupLogsByWeek(g, now);
  eq(buckets.length, 1, "one placeholder bucket for current week");
  ok(buckets[0].isCurrent, "it's the current week");
  eq(buckets[0].totals.dials, 0, "no dials");
  eq(buckets[0].logs.length, 0, "no entries");
}

section("goals: isWeekLocked — current week is always editable");

{
  const now = new Date(2026, 0, 14);
  const g = emptyGoalsState();
  ok(!isWeekLocked(g, now, now), "current week never locked");
}

section("goals: isWeekLocked — past week locked by default");

{
  const now = new Date(2026, 0, 14);
  const lastWeek = new Date(2026, 0, 7);
  const g = emptyGoalsState();
  ok(isWeekLocked(g, lastWeek, now), "past week is locked");
}

section("goals: toggleWeekUnlock unlocks and re-locks a past week");

{
  const now = new Date(2026, 0, 14);
  const lastWeek = new Date(2026, 0, 7);
  let g = emptyGoalsState();
  g = toggleWeekUnlock(g, lastWeek);
  ok(!isWeekLocked(g, lastWeek, now), "explicitly unlocked past week");
  g = toggleWeekUnlock(g, lastWeek);
  ok(isWeekLocked(g, lastWeek, now), "re-locked after second toggle");
}

section("goals: resolveViewPeriod produces sensible weeks count");

{
  const now = new Date(2026, 0, 14);
  const today = resolveViewPeriod("today", now);
  eq(today.label, "Today", "today label");
  ok(Math.abs(today.weeks - 1 / 7) < 1e-9, "today = 1/7 of a week");
  const thisWeek = resolveViewPeriod("this-week", now);
  eq(thisWeek.weeks, 1, "this-week = 1 week");
  const lastWeek = resolveViewPeriod("last-week", now);
  eq(lastWeek.weeks, 1, "last-week = 1 week");
  const allTime = resolveViewPeriod("all-time", now);
  eq(allTime.weeks, 1, "all-time uses weeks=1 (no cumulative multiplier)");
  const thisQuarter = resolveViewPeriod("this-quarter", now);
  ok(thisQuarter.weeks >= 1, "this-quarter weeks is at least 1");
}

section("goals: today period spans start-of-day to end-of-day");

{
  const noon = new Date(2026, 0, 14, 12, 0);
  const period = resolveViewPeriod("today", noon);
  const startDate = new Date(period.fromMs);
  const endDate = new Date(period.toMs);
  eq(startDate.getHours(), 0, "today starts at 00:00");
  eq(startDate.getMinutes(), 0, "today starts at 00:00");
  eq(endDate.getHours(), 23, "today ends at 23:xx");
  eq(endDate.getMinutes(), 59, "today ends at 23:59");
  eq(
    formatIsoDate(startDate),
    formatIsoDate(endDate),
    "start and end are the same calendar day",
  );
}

section("goals: saveWeek locks the current week manually");

{
  const now = new Date(2026, 0, 14);
  let g = emptyGoalsState();
  ok(!isWeekLocked(g, now, now), "current week is unlocked by default");
  g = saveWeek(g, now);
  ok(isWeekLocked(g, now, now), "current week is locked after saveWeek");
  ok(isWeekManuallySaved(g, now), "isWeekManuallySaved reports true");
}

section("goals: unsaveWeek reopens a manually saved week");

{
  const now = new Date(2026, 0, 14);
  let g = emptyGoalsState();
  g = saveWeek(g, now);
  g = unsaveWeek(g, now);
  ok(!isWeekLocked(g, now, now), "current week unlocked after unsaveWeek");
  ok(!isWeekManuallySaved(g, now), "isWeekManuallySaved reports false");
}

section("goals: saveWeek is idempotent");

{
  const now = new Date(2026, 0, 14);
  let g = emptyGoalsState();
  g = saveWeek(g, now);
  const before = g.manuallySavedWeekStarts.length;
  g = saveWeek(g, now);
  eq(g.manuallySavedWeekStarts.length, before, "no duplicate entry on re-save");
}

section("goals: toggleWeekUnlock overrides a manual save");

{
  const now = new Date(2026, 0, 14);
  let g = emptyGoalsState();
  g = saveWeek(g, now);
  ok(isWeekLocked(g, now, now), "locked after save");
  g = toggleWeekUnlock(g, now);
  ok(
    !isWeekLocked(g, now, now),
    "explicit unlock override wins over manual save",
  );
}

section("goals: saveWeek clears any explicit unlock override");

{
  const now = new Date(2026, 0, 14);
  let g = emptyGoalsState();
  g = toggleWeekUnlock(g, now); // explicitly unlock (weird for current week, but OK)
  eq(g.unlockedWeekStarts.length, 1, "unlock recorded");
  g = saveWeek(g, now);
  eq(g.unlockedWeekStarts.length, 0, "saveWeek clears the unlock override");
  ok(isWeekLocked(g, now, now), "week is now locked");
}

// ============================================================
// Meetings Tracker — storage round-trip
// ============================================================

section("meetings: loadAppState / export defaults to empty array");

{
  memStorage.clear();
  const loaded = loadAppState();
  ok(Array.isArray(loaded.meetings), "meetings is an array");
  eq(loaded.meetings.length, 0, "meetings is empty by default");
  eq(loaded.isMeetingsHeldSectionOpen, true, "held section defaults open");
}

section("meetings: save + load round-trips a booked meeting");

{
  memStorage.clear();
  const state: AppState = {
    accounts: [],
    currentAccountId: null,
    isSidebarOpen: true,
    isAccountsSectionOpen: true,
    isArchivedSectionOpen: false,
    isMeetingsHeldSectionOpen: true,
    engineCollapsed: { software: false, procurement: false, product: false },
    currentView: "meetings",
    goals: {
      quarterly: [],
      logs: [],
      unlockedWeekStarts: [],
      manuallySavedWeekStarts: [],
    },
    meetings: [
      {
        id: 42,
        firstName: "Sarah",
        lastName: "Kim",
        title: "Director of Eng",
        linkedinUrl: "linkedin.com/in/sarahkim",
        accountId: "acct-1",
        scheduledFor: "2026-11-14T14:30",
        notes: "Intro from Alex",
        status: "booked",
        createdAt: 1_700_000_000_000,
      },
    ],
  };
  saveAppState(state);
  const loaded = loadAppState();
  eq(loaded.meetings.length, 1, "one meeting loaded");
  eq(loaded.meetings[0].firstName, "Sarah", "firstName preserved");
  eq(loaded.meetings[0].status, "booked", "status preserved");
  eq(loaded.meetings[0].accountId, "acct-1", "accountId preserved");
  eq(loaded.meetings[0].scheduledFor, "2026-11-14T14:30", "date preserved");
  eq(loaded.currentView, "meetings", "meetings view route preserved");
}

section("meetings: save + load round-trips a held meeting with heldAt");

{
  memStorage.clear();
  const state: AppState = {
    accounts: [],
    currentAccountId: null,
    isSidebarOpen: true,
    isAccountsSectionOpen: true,
    isArchivedSectionOpen: false,
    isMeetingsHeldSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
    currentView: "account",
    goals: {
      quarterly: [],
      logs: [],
      unlockedWeekStarts: [],
      manuallySavedWeekStarts: [],
    },
    meetings: [
      {
        id: 43,
        firstName: "Paul",
        lastName: "Meninger",
        title: "Sr Director",
        linkedinUrl: "",
        scheduledFor: "2026-10-22T15:00",
        notes: "Discussed Q1 hiring",
        status: "held",
        createdAt: 1_700_000_000_000,
        heldAt: 1_700_500_000_000,
      },
    ],
  };
  saveAppState(state);
  const loaded = loadAppState();
  eq(loaded.meetings[0].status, "held", "status preserved");
  eq(loaded.meetings[0].heldAt, 1_700_500_000_000, "heldAt preserved");
  eq(loaded.isMeetingsHeldSectionOpen, false, "held section collapsed persisted");
}

section("meetings: cleanMeetings drops malformed entries and unknown statuses");

{
  memStorage.clear();
  const raw = {
    meetings: [
      // Missing id — dropped
      { firstName: "Nope", createdAt: 1 },
      // Unknown status → coerced to "booked"
      {
        id: 1,
        firstName: "Ok",
        lastName: "",
        title: "",
        linkedinUrl: "",
        scheduledFor: "",
        notes: "",
        status: "unknown-status",
        createdAt: 1,
      },
      // Valid held
      {
        id: 2,
        firstName: "Held",
        lastName: "",
        title: "",
        linkedinUrl: "",
        scheduledFor: "",
        notes: "",
        status: "held",
        createdAt: 2,
        heldAt: 3,
      },
    ],
  };
  memStorage.setItem("toptal-sdr-engine::app", JSON.stringify(raw));
  const loaded = loadAppState();
  eq(loaded.meetings.length, 2, "malformed entry dropped");
  eq(loaded.meetings[0].status, "booked", "unknown status coerced");
  eq(loaded.meetings[1].status, "held", "valid held preserved");
}

section("meetings: cleanMeetings preserves image ref when present");

{
  memStorage.clear();
  const raw = {
    meetings: [
      {
        id: 5,
        firstName: "A",
        lastName: "B",
        title: "",
        linkedinUrl: "",
        scheduledFor: "",
        notes: "",
        status: "booked",
        createdAt: 1,
        image: "idb:abc-123",
      },
      {
        id: 6,
        firstName: "C",
        lastName: "D",
        title: "",
        linkedinUrl: "",
        scheduledFor: "",
        notes: "",
        status: "booked",
        createdAt: 2,
        image: "",
      },
    ],
  };
  memStorage.setItem("toptal-sdr-engine::app", JSON.stringify(raw));
  const loaded = loadAppState();
  eq(loaded.meetings[0].image, "idb:abc-123", "image ref preserved");
  ok(loaded.meetings[1].image === undefined, "empty image dropped");
}

section("meetings: cleanMeetings drops accountId when it's not a non-empty string");

{
  memStorage.clear();
  const raw = {
    meetings: [
      {
        id: 1,
        firstName: "A",
        lastName: "B",
        title: "",
        linkedinUrl: "",
        scheduledFor: "",
        notes: "",
        status: "booked",
        createdAt: 1,
        accountId: "",
      },
    ],
  };
  memStorage.setItem("toptal-sdr-engine::app", JSON.stringify(raw));
  const loaded = loadAppState();
  ok(
    loaded.meetings[0].accountId === undefined,
    "empty accountId dropped",
  );
}

section("meetings: cleanMeetings preserves valid prospectResponse and drops invalid");

{
  memStorage.clear();
  const raw = {
    meetings: [
      {
        id: 10,
        firstName: "A",
        lastName: "B",
        title: "",
        linkedinUrl: "",
        scheduledFor: "",
        notes: "",
        status: "booked",
        createdAt: 1,
        prospectResponse: "accepted",
      },
      {
        id: 11,
        firstName: "C",
        lastName: "D",
        title: "",
        linkedinUrl: "",
        scheduledFor: "",
        notes: "",
        status: "booked",
        createdAt: 2,
        prospectResponse: "declined",
      },
      {
        id: 12,
        firstName: "E",
        lastName: "F",
        title: "",
        linkedinUrl: "",
        scheduledFor: "",
        notes: "",
        status: "booked",
        createdAt: 3,
        prospectResponse: "not-a-real-value",
      },
    ],
  };
  memStorage.setItem("toptal-sdr-engine::app", JSON.stringify(raw));
  const loaded = loadAppState();
  eq(loaded.meetings[0].prospectResponse, "accepted", "accepted preserved");
  eq(loaded.meetings[1].prospectResponse, "declined", "declined preserved");
  ok(
    loaded.meetings[2].prospectResponse === undefined,
    "invalid value dropped",
  );
}

section("goals: chartGranularityFor picks per-day for weekly views, per-week for larger ranges");

{
  eq(chartGranularityFor("today"), "week", "today (unused) defaults to week");
  eq(chartGranularityFor("this-week"), "day", "this-week -> day");
  eq(chartGranularityFor("last-week"), "day", "last-week -> day");
  eq(chartGranularityFor("this-quarter"), "week", "this-quarter -> week");
  eq(chartGranularityFor("all-time"), "week", "all-time -> week");
}

section("goals: bucketLogsForChart week views produce 7 daily buckets");

{
  const now = new Date(2026, 0, 14, 12); // Wed
  const period = resolveViewPeriod("this-week", now);
  const logs = [
    // Mon
    { id: 1, kind: "dial" as const, timestamp: new Date(2026, 0, 12, 10).getTime(), count: 5 },
    // Tue
    { id: 2, kind: "dial" as const, timestamp: new Date(2026, 0, 13, 11).getTime(), count: 3 },
    // Wed (current)
    { id: 3, kind: "dial" as const, timestamp: new Date(2026, 0, 14, 9).getTime(), count: 7 },
    // Prospect on Mon — should not affect dial bucketing
    { id: 4, kind: "prospect-added" as const, timestamp: new Date(2026, 0, 12, 10).getTime(), count: 2 },
  ];
  const dialBuckets = bucketLogsForChart(logs, period, "dial", now);
  eq(dialBuckets.length, 7, "7 daily bars");
  eq(dialBuckets[0].count, 5, "Mon dial count");
  eq(dialBuckets[1].count, 3, "Tue dial count");
  eq(dialBuckets[2].count, 7, "Wed dial count");
  eq(dialBuckets[3].count, 0, "Thu empty");
  eq(dialBuckets[6].count, 0, "Sun empty");
  ok(dialBuckets[2].isCurrent, "Wednesday marked as current bucket");
  ok(!dialBuckets[0].isCurrent, "Monday not marked as current");
}

section("goals: bucketLogsForChart filters by kind");

{
  const now = new Date(2026, 0, 14, 12);
  const period = resolveViewPeriod("this-week", now);
  const logs = [
    { id: 1, kind: "dial" as const, timestamp: new Date(2026, 0, 12, 10).getTime(), count: 5 },
    { id: 2, kind: "prospect-added" as const, timestamp: new Date(2026, 0, 12, 10).getTime(), count: 8 },
  ];
  const dials = bucketLogsForChart(logs, period, "dial", now);
  const prospects = bucketLogsForChart(logs, period, "prospect-added", now);
  eq(dials[0].count, 5, "dial bucket only counts dials");
  eq(prospects[0].count, 8, "prospect bucket only counts prospects");
}

section("goals: bucketLogsForChart this-quarter uses weekly bars from quarter start");

{
  // Wed 2026-02-04 -> Q1 (started 2026-01-01)
  const now = new Date(2026, 1, 4, 12);
  const period = resolveViewPeriod("this-quarter", now);
  const buckets = bucketLogsForChart([], period, "dial", now);
  ok(buckets.length >= 5, "several weekly buckets from Jan through Feb 4");
  ok(
    buckets[buckets.length - 1].isCurrent,
    "final bucket contains 'now'",
  );
}

section("goals: bucketLogsForChart all-time renders last 12 weekly buckets");

{
  const now = new Date(2026, 0, 14);
  const period = resolveViewPeriod("all-time", now);
  const buckets = bucketLogsForChart([], period, "dial", now);
  eq(buckets.length, 12, "12 weekly buckets");
  ok(
    buckets[buckets.length - 1].isCurrent,
    "last bucket contains 'now' (current week)",
  );
}

section("goals: bucketLogsForChart labels are natural for each granularity");

{
  const now = new Date(2026, 0, 14);
  const week = resolveViewPeriod("this-week", now);
  const dayBuckets = bucketLogsForChart([], week, "dial", now);
  ok(
    /^[A-Za-z]{3}/.test(dayBuckets[0].label),
    `daily label looks like weekday abbrev (${dayBuckets[0].label})`,
  );
  const quarter = resolveViewPeriod("this-quarter", now);
  const weekBuckets = bucketLogsForChart([], quarter, "dial", now);
  ok(
    /[A-Za-z]/.test(weekBuckets[0].label),
    `weekly label contains a month name (${weekBuckets[0].label})`,
  );
}

// ============================================================
// CSV: permissive LinkedIn URL column matching
// ============================================================

import {
  mapCsvRowsToPreview as csvMap,
  parseCsv as csvParse,
  pickLinkedinUrl,
} from "../lib/csv.ts";

section("CSV: parseCsv lowercases headers and parses quoted commas");

{
  const csv = `First Name,Last Name,Title,Company,"LinkedIn Link"
Alice,Smith,CTO,"Acme, Inc.",https://linkedin.com/in/alicesmith
Bob,Jones,VP Eng,"Globex",https://linkedin.com/in/bobjones`;
  const rows = csvParse(csv);
  eq(rows.length, 2, "two rows parsed");
  eq(rows[0]["first name"], "Alice", "header lowercased");
  eq(rows[0]["company"], "Acme, Inc.", "quoted commas preserved");
  eq(
    rows[0]["linkedin link"],
    "https://linkedin.com/in/alicesmith",
    "header normalized",
  );
}

section("CSV: pickLinkedinUrl finds 'LinkedIn Link' header");

{
  const url = pickLinkedinUrl({
    "first name": "Alice",
    "linkedin link": "https://linkedin.com/in/alice",
  });
  eq(url, "https://linkedin.com/in/alice", "header containing 'linkedin' is picked");
}

section("CSV: pickLinkedinUrl finds 'LinkedIn URL' header");

{
  const url = pickLinkedinUrl({
    "linkedin url": "https://linkedin.com/in/bob",
  });
  eq(url, "https://linkedin.com/in/bob", "exact 'linkedin url' header is picked");
}

section("CSV: pickLinkedinUrl finds 'Person Linkedin Url' (Sales Nav style)");

{
  const url = pickLinkedinUrl({
    "person linkedin url": "https://linkedin.com/in/carol",
    company: "Acme",
  });
  eq(url, "https://linkedin.com/in/carol", "any header containing 'linkedin' matches");
}

section("CSV: pickLinkedinUrl finds 'LinkedIn Contact Profile URL'");

{
  const url = pickLinkedinUrl({
    "first name": "Pat",
    "linkedin contact profile url": "https://linkedin.com/in/pat",
    company: "Acme",
  });
  eq(
    url,
    "https://linkedin.com/in/pat",
    "verbose 'linkedin contact profile url' header matches",
  );
}

section("CSV: pickLinkedinUrl finds 'Profile URL' header");

{
  const url = pickLinkedinUrl({
    "profile url": "https://linkedin.com/in/dan",
  });
  eq(url, "https://linkedin.com/in/dan", "profile url fallback matches");
}

section("CSV: pickLinkedinUrl falls back to value scan when header is unknown");

{
  const url = pickLinkedinUrl({
    name: "Eve",
    other: "https://linkedin.com/in/eve",
    note: "Met at conference",
  });
  eq(
    url,
    "https://linkedin.com/in/eve",
    "last-resort: scan cells for a linkedin.com URL",
  );
}

section("CSV: pickLinkedinUrl returns empty when nothing matches");

{
  const url = pickLinkedinUrl({
    name: "Frank",
    title: "Engineer",
    company: "Globex",
  });
  eq(url, "", "no linkedin column or URL anywhere -> empty string");
}

section("CSV: end-to-end mapCsvRowsToPreview captures LinkedIn link");

{
  const csv = `First Name,Last Name,Title,Company,LinkedIn Link
Alice,Smith,CTO,Acme,https://linkedin.com/in/alicesmith
Bob,Jones,VP,Globex,https://linkedin.com/in/bobjones`;
  const rows = csvParse(csv);
  const preview = csvMap(rows);
  eq(preview.length, 2, "both rows turn into preview entries");
  eq(
    preview[0].linkedinUrl,
    "https://linkedin.com/in/alicesmith",
    "Alice's LinkedIn link captured",
  );
  eq(
    preview[1].linkedinUrl,
    "https://linkedin.com/in/bobjones",
    "Bob's LinkedIn link captured",
  );
}

async function runAsyncImageTests() {

section("imageStore: putImage returns a ref string and loadImage retrieves it");

{
  _resetImageCacheForTests();
  const ref = await putImage(SAMPLE_DATA_URL);
  ok(ref.startsWith(IDB_PREFIX), "ref has idb: prefix");
  ok(isIdbRef(ref), "isIdbRef accepts the new ref");
  const loaded = await loadImage(ref);
  eq(loaded, SAMPLE_DATA_URL, "loadImage returns the original data URL");
}

section("imageStore: putImage produces unique refs for repeat calls");

{
  const refs = new Set<string>();
  for (let i = 0; i < 50; i++) {
    refs.add(await putImage(SAMPLE_DATA_URL));
  }
  eq(refs.size, 50, "50 puts produce 50 distinct refs");
}

section("imageStore: loadImage passes inline data URLs through unchanged");

{
  const result = await loadImage(SAMPLE_DATA_URL);
  eq(result, SAMPLE_DATA_URL, "inline data URL returned as-is");
  ok(isInlineDataUrl(SAMPLE_DATA_URL), "isInlineDataUrl recognizes it");
}

section("imageStore: loadImage returns null for missing refs");

{
  const missing = `${IDB_PREFIX}does-not-exist`;
  const result = await loadImage(missing);
  eq(result, null, "missing ref returns null, not a thrown error");
}

section("imageStore: deleteImage removes from store");

{
  const ref = await putImage(SAMPLE_DATA_URL);
  await deleteImage(ref);
  const after = await loadImage(ref);
  eq(after, null, "image is gone after delete");
}

section("imageStore: migrateInlineToIdb moves data URL into IDB");

{
  const ref = await migrateInlineToIdb(SAMPLE_DATA_URL);
  ok(ref !== null, "migration returned a non-null ref");
  ok(isIdbRef(ref!), "result is an idb: ref");
  const loaded = await loadImage(ref);
  eq(loaded, SAMPLE_DATA_URL, "bytes preserved through migration");
}

section("imageStore: migrateInlineToIdb is idempotent for existing refs");

{
  const ref = await putImage(SAMPLE_DATA_URL);
  const same = await migrateInlineToIdb(ref);
  eq(same, ref, "an existing ref passes through unchanged");
}

section("imageStore: inlineFromIdb expands a ref back to a data URL");

{
  const ref = await putImage(SAMPLE_DATA_URL);
  const inlined = await inlineFromIdb(ref);
  eq(inlined, SAMPLE_DATA_URL, "data URL recovered from ref");
}

// ============================================================
// State-level image migration
// ============================================================

section("State migration: inline images on hotlist prospects move to IDB");

{
  memStorage.clear();
  const account = createAccount();
  const prospect = createProspect({ firstName: "Alice" });
  prospect.image = SAMPLE_DATA_URL;
  const state: AppState = {
    accounts: [
      {
        ...account,
        accountData: { ...account.accountData, hotlist: [prospect] },
      },
    ],
    currentAccountId: account.id,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
  };
  const didMigrate = await migrateInlineImagesInState(state);
  ok(didMigrate, "migration reports that something changed");
  const finalImage = state.accounts[0].accountData.hotlist[0].image;
  ok(isIdbRef(finalImage), "hotlist prospect now holds an IDB ref");
  const recovered = await loadImage(finalImage);
  eq(recovered, SAMPLE_DATA_URL, "bytes preserved end-to-end");
}

section("State migration: every engine image field moves to IDB");

{
  memStorage.clear();
  const account = createAccount();
  account.accountData.softwareEngine.contact.liImage = SAMPLE_DATA_URL;
  account.accountData.procurementEngine.leaderImage = SAMPLE_DATA_URL;
  account.accountData.productEngine.contact.image = SAMPLE_DATA_URL;
  account.accountData.messagingLiImage = SAMPLE_DATA_URL;
  const state: AppState = {
    accounts: [account],
    currentAccountId: account.id,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
  };
  const didMigrate = await migrateInlineImagesInState(state);
  ok(didMigrate, "migration reports changes across engines");
  const ad = state.accounts[0].accountData;
  ok(isIdbRef(ad.softwareEngine.contact.liImage), "software engine migrated");
  ok(isIdbRef(ad.procurementEngine.leaderImage), "procurement engine migrated");
  ok(isIdbRef(ad.productEngine.contact.image), "product engine migrated");
  ok(isIdbRef(ad.messagingLiImage), "messagingLiImage migrated");
}

section("State migration: idempotent — running twice migrates nothing the second time");

{
  memStorage.clear();
  const account = createAccount();
  const prospect = createProspect({ firstName: "Alice" });
  prospect.image = SAMPLE_DATA_URL;
  const state: AppState = {
    accounts: [
      {
        ...account,
        accountData: { ...account.accountData, hotlist: [prospect] },
      },
    ],
    currentAccountId: account.id,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
  };
  const first = await migrateInlineImagesInState(state);
  ok(first, "first run migrated");
  const second = await migrateInlineImagesInState(state);
  ok(!second, "second run found nothing to migrate (idempotent)");
}

// ============================================================
// Export / Import async paths
// ============================================================

section("Export async: inlines IDB-backed images into the JSON file");

{
  const ref = await putImage(SAMPLE_DATA_URL);
  const account = createAccount();
  const prospect = createProspect({ firstName: "Alice" });
  prospect.image = ref;
  const state: AppState = {
    accounts: [
      {
        ...account,
        accountData: { ...account.accountData, hotlist: [prospect] },
      },
    ],
    currentAccountId: account.id,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
  };
  const json = await exportAppStateJsonAsync(state);
  // The exported JSON must contain the inline bytes, not the ref, so the
  // file is portable to a machine that doesn't have this IDB.
  ok(json.includes(SAMPLE_DATA_URL), "exported JSON contains inline data URL");
  ok(!json.includes(ref), "exported JSON does not contain the IDB ref");
}

section("Import async: inline images in JSON land in IDB on import");

{
  // Build a portable export envelope manually with an inline image.
  const account = createAccount();
  const prospect = createProspect({ firstName: "Bob" });
  prospect.image = SAMPLE_DATA_URL;
  const state: AppState = {
    accounts: [
      {
        ...account,
        accountData: { ...account.accountData, hotlist: [prospect] },
      },
    ],
    currentAccountId: account.id,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
  };
  const envelope = {
    app: "toptal-sdr-engine",
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
  const imported = await parseImportedAppStateAsync(JSON.stringify(envelope));
  const importedImage = imported.accounts[0].accountData.hotlist[0].image;
  ok(isIdbRef(importedImage), "imported state holds an IDB ref, not bytes");
  const recovered = await loadImage(importedImage);
  eq(recovered, SAMPLE_DATA_URL, "bytes are in IDB and load back correctly");
}

section("Round-trip: export then import preserves images exactly");

{
  const ref = await putImage(SAMPLE_DATA_URL);
  const account = createAccount();
  const prospect = createProspect({ firstName: "Carol" });
  prospect.image = ref;
  const state: AppState = {
    accounts: [
      {
        ...account,
        accountData: { ...account.accountData, hotlist: [prospect] },
      },
    ],
    currentAccountId: account.id,
    isSidebarOpen: true,
    isArchivedSectionOpen: false,
    engineCollapsed: { software: false, procurement: false, product: false },
  };
  const json = await exportAppStateJsonAsync(state);
  const imported = await parseImportedAppStateAsync(json);
  const importedImage = imported.accounts[0].accountData.hotlist[0].image;
  const recovered = await loadImage(importedImage);
  eq(recovered, SAMPLE_DATA_URL, "image survived export -> import round-trip");
}

}

// Run async tests, then emit the final report.
runAsyncImageTests()
  .then(() => emitReport())
  .catch((err) => {
    console.error("Async test run failed:", err);
    process.exit(1);
  });

function emitReport() {
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
}
