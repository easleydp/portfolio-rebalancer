import { test, expect } from '@playwright/test'

test('calculates trades and persists across page reloads', async ({ page }) => {
  await page.goto('/')

  // 1. Fill in two funds
  const fund0 = page.locator('.row').nth(0)
  await fund0.getByLabel('Fund name or ticker').fill('VWRL')
  await fund0.getByLabel('Quantity').fill('100')
  await fund0.getByLabel('Price (pence)').fill('1200') // 1,200p = £12.00
  await fund0.getByLabel('Target (%)').fill('60')

  const fund1 = page.locator('.row').nth(1)
  await fund1.getByLabel('Fund name or ticker').fill('VUAG')
  await fund1.getByLabel('Quantity').fill('50')
  await fund1.getByLabel('Price (pence)').fill('800') // 800p = £8.00
  await fund1.getByLabel('Target (%)').fill('40')

  // 2. Fill in platform total (£1,600)
  await page
    .getByLabel('Total portfolio value shown on your platform, in pounds')
    .fill('1600')

  // 3. Verify trade recommendations
  await expect(page.locator('.banner.act')).toContainText('Rebalancing is needed')
  await expect(page.locator('tbody tr').nth(0)).toContainText('Sell 20 shares')
  await expect(page.locator('tbody tr').nth(1)).toContainText('Buy 30 shares')

  // 4. Reload page (F5) to verify localStorage hydration
  await page.reload()

  // Verify inputs rehydrated with formatted values from storage
  await expect(fund0.getByLabel('Fund name or ticker')).toHaveValue('VWRL')
  await expect(fund0.getByLabel('Quantity')).toHaveValue('100')
  await expect(fund0.getByLabel('Price (pence)')).toHaveValue('1,200.00p')
  await expect(fund0.getByLabel('Target (%)')).toHaveValue('60')

  await expect(fund1.getByLabel('Fund name or ticker')).toHaveValue('VUAG')
  await expect(fund1.getByLabel('Quantity')).toHaveValue('50')
  await expect(fund1.getByLabel('Price (pence)')).toHaveValue('800.00p')
  await expect(fund1.getByLabel('Target (%)')).toHaveValue('40')

  // Results should still be visible and match
  await expect(page.locator('.banner.act')).toContainText('Rebalancing is needed')
  await expect(page.locator('tbody tr').nth(0)).toContainText('Sell 20 shares')
  await expect(page.locator('tbody tr').nth(1)).toContainText('Buy 30 shares')
})
