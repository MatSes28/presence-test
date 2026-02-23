import { test, expect } from '@playwright/test';

const E2E_EMAIL = process.env.E2E_USER_EMAIL ?? 'admin@example.com';
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? 'password';

test.describe('Login and Dashboard', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/(login)?$/);
    await expect(page.getByRole('heading', { name: /CLIRDEC|Sign in|Log in/i })).toBeVisible();
  });

  test('user can log in and see dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(E2E_EMAIL);
    await page.getByLabel(/password/i).fill(E2E_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/dashboard|sessions|home/i).first()).toBeVisible({ timeout: 10000 });
  });
});
