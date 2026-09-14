import { expect, type Locator } from "@playwright/test";

/**
 * Prove a client:load island has hydrated by toggling its "Show password" control and confirming
 * the resulting DOM change, retrying the click if hydration hasn't attached its handlers yet.
 *
 * client:load islands hydrate asynchronously under Vite dev (the island's JS module graph is
 * requested and executed after the initial page load, not before). Filling a field before that
 * finishes cannot be caught by re-reading the field's own DOM value afterward: `.fill()` sets the
 * DOM value directly, so a check like `expect(await locator.inputValue()).toBe(value)` trivially
 * passes whether or not React's onChange listener was attached to actually receive it — the DOM
 * can look right while React's own controlled state silently stays at its initial empty value
 * (confirmed while writing this test: fields checked "correct" this way, then submit failed
 * validation as if they'd never been typed into at all). A probe that depends on React producing a
 * real effect — here, the password field's `type` attribute flipping when its toggle button is
 * clicked — is the only reliable way to know hydration is done before trusting subsequent fills.
 *
 * Where a page fetches data on mount instead (see `seed.spec.ts`'s wait for the vehicle-profiles /
 * goods-item-templates requests), prefer that: it proves hydration via the app's own real behavior
 * rather than a synthetic probe.
 */
export async function waitForFormHydration(passwordInput: Locator, toggleButton: Locator): Promise<void> {
  await expect(async () => {
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute("type", "text", { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

/**
 * Click a trigger and confirm it produced the expected visible effect, retrying the click itself
 * if not — the same class of race `waitForFormHydration` guards against can also swallow a click
 * that lands before an island's event handlers are attached.
 */
export async function clickUntilVisible(trigger: Locator, expectVisible: Locator): Promise<void> {
  await expect(async () => {
    await trigger.click();
    await expect(expectVisible).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
}
