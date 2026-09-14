import { test, expect } from "@playwright/test";
import { clickUntilVisible } from "./utils";

// seed.spec.ts — the reference E2E test every other spec in this project is modeled on.
// Risk: context/foundation/test-plan.md §2 Risk #5 — "The entire form UI flow — selecting a
// saved profile/template, submitting, displaying validation errors — breaks without detection."
// This test covers the save → persist-across-reload → select-and-prefill slice of that risk.
//
// Conventions demonstrated (see CLAUDE.md's E2E Testing Rules for the full list):
// - getByRole/getByLabel as the default locator strategy
// - waiting for state (network response, visible text, retried actions) instead of a fixed delay
// - a unique identifier in the test data so parallel/repeated runs never collide
// - cleanup of everything the test created, in the same test
//
// Auth: this project depends on the "setup" project (tests/e2e/auth.setup.ts), which logs in once
// and shares its storageState — this test never logs in through the UI itself.

// GoodsFitForm fetches these two endpoints from a mount effect. Waiting for both responses is a
// real proof that the component has mounted and hydrated (React's onChange handlers are attached
// as part of the same commit that schedules the effect) — unlike re-reading a filled input's own
// DOM value afterward, which stays "correct" even when React's handler was never there to receive
// the fill in the first place. Both listeners are registered *before* navigating so a very fast
// mount can't resolve them before the test starts watching.
function waitForFormMount(page: import("@playwright/test").Page) {
  return Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/vehicle-profiles") && r.request().method() === "GET"),
    page.waitForResponse((r) => r.url().includes("/api/goods-item-templates") && r.request().method() === "GET"),
  ]);
}

test("saved vehicle profile persists after reload and correctly prefills the form", async ({ page }) => {
  // /fit-check hasn't been visited by the setup project, so this is its first compile under Vite
  // dev — can take 10-20s on a freshly-spawned webServer, on top of the rest of the flow.
  test.setTimeout(90_000);

  const profileLabel = `E2E Vehicle ${Date.now()}`;

  const mounted = waitForFormMount(page);
  await page.goto("/fit-check");
  await mounted;

  await page.getByLabel("Length (cm)").fill("250");
  await page.getByLabel("Width (cm)").fill("160");
  await page.getByLabel("Height (cm)").fill("135");
  await page.getByLabel("Max payload (kg)").fill("800");
  await page.getByLabel("Save current as profile").fill(profileLabel);

  const saveResponse = page.waitForResponse(
    (response) => response.url().includes("/api/vehicle-profiles") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save profile" }).click();
  await saveResponse;

  const presetCombobox = page.getByRole("combobox").first();
  const savedOption = page.getByRole("option", { name: profileLabel });
  await clickUntilVisible(presetCombobox, savedOption);
  await page.keyboard.press("Escape");

  // The saved profile must survive a real page reload, not just live in component state. Reload
  // re-triggers the same mount effect, so re-arm the same wait before reloading.
  const remounted = waitForFormMount(page);
  await page.reload();
  await remounted;
  await clickUntilVisible(presetCombobox, savedOption);

  // Selecting it must prefill the vehicle fields with exactly what was saved.
  await savedOption.click();
  await expect(page.getByLabel("Length (cm)")).toHaveValue("250");
  await expect(page.getByLabel("Width (cm)")).toHaveValue("160");
  await expect(page.getByLabel("Height (cm)")).toHaveValue("135");
  await expect(page.getByLabel("Max payload (kg)")).toHaveValue("800");

  // Cleanup: delete the profile this test created so repeated runs never accumulate data.
  // Selecting the option above closed the dropdown, so reopen it to reach the delete control.
  await clickUntilVisible(presetCombobox, page.getByRole("button", { name: `Delete ${profileLabel}` }));
  const deleteResponse = page.waitForResponse(
    (response) => response.url().includes("/api/vehicle-profiles/") && response.request().method() === "DELETE",
  );
  // The delete button stops propagation so it doesn't also trigger a selection — the dropdown
  // stays open after this click, so the option's disappearance can be asserted directly below.
  await page.getByRole("button", { name: `Delete ${profileLabel}` }).click();
  const deleteResult = await deleteResponse;
  // waitForResponse resolves on ANY matching response regardless of status — assert success
  // explicitly so a server-side failure surfaces here, not as a confusing UI-state mismatch below.
  expect(deleteResult.ok(), `DELETE /api/vehicle-profiles/:id returned ${deleteResult.status()}`).toBe(true);
  await expect(savedOption).toHaveCount(0, { timeout: 15_000 });
});
