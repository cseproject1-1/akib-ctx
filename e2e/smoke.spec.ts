import { test, expect } from '@playwright/test';

test.describe('CtxNote App Smoke Tests', () => {
  test('should load login page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CtxNote/);
    // Should see sign in button
    await expect(page.locator('button', { hasText: 'Sign In' })).toBeVisible();
  });

  test('should navigate to signup page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Sign up');
    await expect(page).toHaveURL(/.*signup/);
    // Should see create account button
    await expect(page.locator('button', { hasText: 'Create Account' })).toBeVisible();
  });

  test('should show login form with email and password fields', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should redirect unauthenticated user from workspace to login', async ({ page }) => {
    await page.goto('/workspace/some-id');
    await expect(page).toHaveURL(/.*login/);
  });

  test('should have responsive layout on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    // Login form should be visible and not overlapping
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    const box = await emailInput.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Input should be within viewport
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
      expect(box.y + box.height).toBeLessThanOrEqual(812);
    }
  });

  test('should have no overlapping menus on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    // If there is a hamburger menu, click it
    const menuButton = page.locator('button[aria-label="Menu"]');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      // Wait for menu to appear
      await page.waitForTimeout(500);
      // Check that menu is visible and not covering entire screen
      const menu = page.locator('nav >> visible=true');
      await expect(menu).toBeVisible();
      const menuBox = await menu.boundingBox();
      expect(menuBox).not.toBeNull();
      if (menuBox) {
        expect(menuBox.width).toBeLessThan(375);
      }
    }
  });

  test('should have no console errors on login page', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(consoleErrors).toHaveLength(0);
  });

  test('should have no JavaScript errors on login page', async ({ page }) => {
    const jsErrors: Error[] = [];
    page.on('pageerror', error => jsErrors.push(error));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(jsErrors).toHaveLength(0);
  });
});