import { test as setup, expect } from "@playwright/test";
import { waitForFormHydration } from "./utils";

// Fixed, idempotent test account — the "setup" project runs once per test run and shares its
// storageState with every test in the "chromium" project, per Playwright's dependency projects
// pattern. Individual tests never log in through the UI themselves (see E2E rules in CLAUDE.md).
const TEST_EMAIL = "e2e-seed@example.com";
const TEST_PASSWORD = "E2eSeedPass123";
const authFile = "tests/e2e/.auth/user.json";

setup("authenticate", async ({ page }) => {
  // This test navigates twice against a dev server webServer may have just spawned fresh — each
  // route's first compile under Vite dev can itself take 10-20s, comfortably exceeding the default
  // 30s test timeout once both are added together. Neither wait below is a hydration issue; give
  // the whole test enough room for two cold navigations before either timeout matters.
  setup.setTimeout(90_000);

  // Sign-up is best-effort: a prior run already created this account. Either way, the explicit
  // sign-in below is what actually establishes a usable session (signup redirects to a
  // confirm-email page, not into the app).
  await page.goto("/auth/signup");
  await waitForFormHydration(
    page.getByLabel("Password", { exact: true }),
    page.getByRole("button", { name: "Show password" }).first(),
  );
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel("Confirm password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/auth\/(confirm-email|signup)/);

  await page.goto("/auth/signin");
  await waitForFormHydration(
    page.getByLabel("Password", { exact: true }),
    page.getByRole("button", { name: "Show password" }),
  );
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Sign-in redirects to "/". The first hit to this route on a cold dev server can be slow
  // (route compilation + a real Supabase round trip) — observed exceeding 20s when webServer has
  // just spawned a fresh process, so wait for the navigation explicitly with real headroom rather
  // than relying on the default assertion timeout.
  await page.waitForURL("/", { timeout: 40_000 });
  await expect(page.getByText(TEST_EMAIL)).toBeVisible();

  await page.context().storageState({ path: authFile });
});
