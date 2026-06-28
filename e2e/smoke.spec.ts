import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page).toHaveTitle(/OBBO iManage/);
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /send otp/i })).toBeVisible();
  });

  test('register page loads', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText(/account type/i)).toBeVisible();
  });

  test('login redirects authenticated user', async ({ page }) => {
    await page.goto('/admin/dashboard');
    // Without auth, should redirect to /login
    await expect(page).toHaveURL(/\/login/);
  });
});
