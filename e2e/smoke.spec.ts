import { test, expect } from '@playwright/test';

const E2E_EMAIL = process.env.E2E_USER_EMAIL ?? 'admin@example.com';
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? 'password';

test.describe('Smoke: Admin navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(E2E_EMAIL);
    await page.getByLabel(/password/i).fill(E2E_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('Dashboard shows active sessions section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByText(/active sessions|sessions currently/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Sessions page loads', async ({ page }) => {
    await page.goto('/sessions');
    await expect(page).toHaveURL('/sessions');
    await expect(page.getByText(/sessions|active|recent/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Users page loads', async ({ page }) => {
    await page.goto('/users');
    await expect(page).toHaveURL('/users');
    await expect(page.getByText(/users|students|all users/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Attendance report page loads for invalid id shows error or empty', async ({ page }) => {
    await page.goto('/attendance/00000000-0000-0000-0000-000000000000');
    await expect(page).toHaveURL(/\/attendance\/.+/);
    await expect(page.getByText(/attendance|report|session|no .* found/i).first()).toBeVisible({ timeout: 5000 });
  });
});
