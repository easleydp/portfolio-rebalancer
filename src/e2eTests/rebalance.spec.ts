import { test, expect, type Locator, type Page } from "@playwright/test";

async function expectInvalidField(input: Locator) {
  await expect(input).toHaveAttribute("aria-invalid", "true");
  const colours = await input.evaluate((element) => {
    const expected = document.createElement("div");
    expected.style.backgroundColor = "var(--badbg)";
    expected.style.borderColor = "var(--bad)";
    document.body.append(expected);
    const expectedStyle = getComputedStyle(expected);
    const inputStyle = getComputedStyle(element);
    const result = {
      background: inputStyle.backgroundColor,
      border: inputStyle.borderTopColor,
      expectedBackground: expectedStyle.backgroundColor,
      expectedBorder: expectedStyle.borderTopColor,
    };
    expected.remove();
    return result;
  });
  expect(colours.background).toBe(colours.expectedBackground);
  expect(colours.border).toBe(colours.expectedBorder);
}

async function expectValidField(input: Locator) {
  await expect(input).toHaveAttribute("aria-invalid", "false");
}

async function assertPageIsClear(page: Page) {
  const fundsSection = page.getByRole("region", { name: "1. Your funds" });
  const cashSection = page.getByRole("region", { name: "2. Cash to invest (optional)" });
  const numbersSection = page.getByRole("region", { name: "3. Check your numbers" });
  const actionsSection = page.getByRole("region", { name: "4. What to do" });

  await expect(fundsSection.locator(".row")).toHaveCount(3);
  for (const row of await fundsSection.locator(".row").all()) {
    await expect(row.getByLabel("Fund name or ticker")).toHaveValue("");
    await expect(row.getByLabel("Quantity")).toHaveValue("");
    await expect(row.getByLabel("Price (pence)")).toHaveValue("");
    await expect(row.getByLabel("Target (%)")).toHaveValue("");
  }
  await expect(fundsSection.locator(".total.bad")).toHaveText(
    "Targets add up to 0% – they need to add up to 100%",
  );

  const cashInput = cashSection.getByLabel("Cash available to invest in pounds");
  await expect(cashInput).toHaveValue("");
  await expect(cashInput).toHaveAttribute("placeholder", "0.00");
  await expect(cashSection.locator(".banner")).toHaveCount(0);

  const totalInput = numbersSection.getByLabel(
    "Total portfolio value shown on your platform, in pounds",
  );
  await expect(totalInput).toHaveValue("");
  await expect(totalInput).toHaveAttribute("placeholder", "0.00");
  await expect(numbersSection.locator(".banner")).toHaveCount(0);

  await expect(actionsSection.locator(".banner")).toHaveCount(1);
  await expect(actionsSection.locator(".banner.note")).toContainText("Waiting for your details");
  await expect(actionsSection.locator(".banner.note small")).toHaveText(
    "Enter at least two funds. Targets must add up to exactly 100%.",
  );
  await expect(actionsSection.locator("table")).toHaveCount(0);

  const settings = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Settings" }) });
  await expect(settings).toHaveJSProperty("open", false);
}

test("UI overall flow", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");

  /*
   * 1) Confirms the initial state of the page when no previous data is present in localStorage.
   */

  await assertPageIsClear(page);

  /*
   * 2) When one of the three provided fund rows is removed (using its "Remove" button) the
   * remaining two rows' "Remove" buttons are hidden.
   */

  const fundsSection = page.getByRole("region", { name: "1. Your funds" });
  await fundsSection
    .locator(".row")
    .first()
    .getByRole("button", { name: "Remove this fund" })
    .click();
  await expect(fundsSection.locator(".row")).toHaveCount(2);
  await expect(fundsSection.getByRole("button", { name: /^Remove/ })).toHaveCount(0);

  /*
   * 3) Enter the first fund
   */

  const firstFund = fundsSection.locator(".row").first();
  await firstFund.getByLabel("Fund name or ticker").fill("ONE");
  const actionsSection = page.getByRole("region", { name: "4. What to do" });
  await expect(actionsSection.locator(".banner.note")).toContainText("Waiting for your details");
  await expect(actionsSection.locator(".banner.note small")).toHaveText(
    "Every fund needs a name, quantity, a price and a target. Enter at least two funds. Targets must add up to exactly 100%.",
  );

  await firstFund.getByLabel("Quantity").fill("1");
  await firstFund.getByLabel("Price (pence)").fill("100");
  await firstFund.getByLabel("Target (%)").fill("60");
  await expect(fundsSection.locator(".total.bad")).toHaveText(
    "Targets add up to 60% – they need to add up to 100%",
  );
  await expect(actionsSection.locator(".banner.note")).toContainText("Waiting for your details");
  await expect(actionsSection.locator(".banner.note small")).toHaveText(
    "Enter at least two funds. Targets must add up to exactly 100%.",
  );

  /*
   * 4) Add a second fund
   */

  const secondFund = fundsSection.locator(".row").nth(1);
  await secondFund.getByLabel("Fund name or ticker").fill("TWO");
  await secondFund.getByLabel("Quantity").fill("2");
  await secondFund.getByLabel("Price (pence)").fill("110");
  await secondFund.getByLabel("Target (%)").fill("30");
  await expect(actionsSection.locator(".banner.note")).toHaveCount(1);
  await expect(actionsSection.locator(".banner.note")).toContainText("Waiting for your details");
  await expect(actionsSection.locator(".banner.note small")).toHaveText(
    "Targets must add up to exactly 100%.",
  );

  /*
   * 5) Use the "Add a fund" button to add a third fund
   */

  await fundsSection.getByRole("button", { name: "+ Add a fund" }).click();
  await expect(fundsSection.locator(".row")).toHaveCount(3);
  const thirdFund = fundsSection.locator(".row").nth(2);
  await thirdFund.getByLabel("Fund name or ticker").fill("THREE");
  await thirdFund.getByLabel("Quantity").fill("3");
  await thirdFund.getByLabel("Price (pence)").fill("120");
  await thirdFund.getByLabel("Target (%)").fill("10");

  await expect(fundsSection.locator(".total.ok")).toHaveText("Targets add up to 100% ✓");
  const numbersSection = page.getByRole("region", { name: "3. Check your numbers" });
  await expect(numbersSection.locator(".banner.note")).toHaveText("Waiting for the platform total");
  await expect(actionsSection.locator(".banner.note")).toContainText("Results are on hold");
  await expect(actionsSection.locator(".banner.note small")).toHaveText(
    "Type your platform’s total value in step 3 so the numbers can be checked.",
  );

  /*
   * 6) Set "Cash to invest" to £10
   */

  await page.getByLabel("Cash available to invest in pounds").fill("10");

  /*
   * 7) Test the "Check your numbers" section
   */

  const platformTotal = numbersSection.getByLabel(
    "Total portfolio value shown on your platform, in pounds",
  );
  await platformTotal.fill("1");
  await expect(numbersSection.locator(".banner.bad")).toContainText("The numbers don’t match");
  await expect(numbersSection.locator(".banner.bad small")).toHaveText(
    "Your funds and cash come to £16.80, but your platform says £1.00. Otherwise check each price and quantity.",
  );
  await expect(actionsSection.locator(".banner.note")).toContainText("Results are on hold");
  await expect(actionsSection.locator(".banner.note small")).toHaveText(
    "They will appear once the numbers above match.",
  );

  await platformTotal.fill("16");
  await expect(numbersSection.locator(".banner.bad")).toContainText("The numbers don’t match");
  await expect(numbersSection.locator(".banner.bad small")).toHaveText(
    "Your funds and cash come to £16.80, but your platform says £16.00. Otherwise check each price and quantity.",
  );

  await platformTotal.fill("16.01");
  await expect(numbersSection.locator(".banner.fine")).toContainText("The numbers match");
  await expect(numbersSection.locator(".banner.fine small")).toHaveText(
    "Your funds and cash come to £16.80; your platform says £16.01.",
  );

  /*
   * 8) Check the recommended actions
   */

  await expect(actionsSection.locator(".banner.act")).toHaveCount(1);
  await expect(actionsSection.locator(".banner.act")).toContainText("Rebalancing is needed");
  await expect(actionsSection.locator(".banner.act small")).toHaveText(
    "At least one fund has moved outside its acceptable range.",
  );

  const actionsTable = actionsSection.locator("table");
  await expect(actionsTable.locator("thead th")).toHaveText([
    "Fund",
    "Worth now",
    "Now",
    "Target",
    "Acceptable range",
    "What to do",
  ]);
  const actionRows = actionsTable.locator("tbody tr");
  await expect(actionRows).toHaveCount(3);

  const oneRow = actionRows.nth(0);
  await expect(oneRow.locator("td").nth(0)).toContainText("ONE");
  await expect(oneRow.locator(".flag")).toHaveText("Below its acceptable range");
  await expect(oneRow.locator("td").nth(1)).toHaveText("£1.00");
  await expect(oneRow.locator("td").nth(2)).toHaveText("14.7%");
  await expect(oneRow.locator("td").nth(3)).toHaveText("60%");
  await expect(oneRow.locator("td").nth(4)).toHaveText("55% – 65%");
  await expect(oneRow.locator("td").nth(5).locator(".buy")).toHaveText("Buy 9 shares");
  await expect(oneRow.locator("td").nth(5)).toContainText("about £9.00");
  await expect(oneRow.locator("td").nth(5).locator(".sell")).toHaveCount(0);

  const twoRow = actionRows.nth(1);
  await expect(twoRow.locator("td").nth(0)).toHaveText("TWO");
  await expect(twoRow.locator(".flag")).toHaveCount(0);
  await expect(twoRow.locator("td").nth(1)).toHaveText("£2.20");
  await expect(twoRow.locator("td").nth(2)).toHaveText("32.4%");
  await expect(twoRow.locator("td").nth(3)).toHaveText("30%");
  await expect(twoRow.locator("td").nth(4)).toHaveText("25% – 35%");
  await expect(twoRow.locator("td").nth(5).locator(".buy")).toHaveText("Buy 2 shares");
  await expect(twoRow.locator("td").nth(5)).toContainText("about £2.20");
  await expect(twoRow.locator("td").nth(5).locator(".sell")).toHaveCount(0);

  const threeRow = actionRows.nth(2);
  await expect(threeRow.locator("td").nth(0)).toContainText("THREE");
  await expect(threeRow.locator(".flag")).toHaveText("Above its acceptable range");
  await expect(threeRow.locator("td").nth(1)).toHaveText("£3.60");
  await expect(threeRow.locator("td").nth(2)).toHaveText("52.9%");
  await expect(threeRow.locator("td").nth(3)).toHaveText("10%");
  await expect(threeRow.locator("td").nth(4)).toHaveText("7.5% – 12.5%");
  await expect(threeRow.locator("td").nth(5).locator(".sell")).toHaveText("Sell 2 shares");
  await expect(threeRow.locator("td").nth(5)).toContainText("about £2.40");
  await expect(threeRow.locator("td").nth(5).locator(".buy")).toHaveCount(0);

  const actionFootnote = actionsSection.locator("p.foot");
  const actionFootnoteText = await actionFootnote.textContent();
  const normalisedFootnote = actionFootnoteText?.replace(/\s+/g, " ").trim();
  expect(
    normalisedFootnote?.startsWith(
      "Total in funds: £6.80 plus £10.00 cash. After these trades about £1.20 of cash would be left over (shares are rounded to whole numbers).",
    ),
  ).toBe(true);
});

test("calculates trades and persists across page reloads", async ({ page }) => {
  await page.goto("/");

  // 1. Fill in two funds
  const fund0 = page.locator(".row").nth(0);
  await fund0.getByLabel("Fund name or ticker").fill("VWRL");
  await fund0.getByLabel("Quantity").fill("100");
  await fund0.getByLabel("Price (pence)").fill("1200"); // 1,200p = £12.00
  await fund0.getByLabel("Target (%)").fill("60");

  const fund1 = page.locator(".row").nth(1);
  await fund1.getByLabel("Fund name or ticker").fill("VUAG");
  await fund1.getByLabel("Quantity").fill("50");
  await fund1.getByLabel("Price (pence)").fill("£8"); // Tolerates £s
  await fund1.getByLabel("Target (%)").fill("40");
  await expect(fund1.getByLabel("Price (pence)")).toHaveValue("800.00p"); // See format.test.ts for other flexible format tests

  // 2. Fill in platform total (£1,600)
  await page.getByLabel("Total portfolio value shown on your platform, in pounds").fill("1600");

  // 3. Verify trade recommendations
  await expect(page.locator(".banner.act")).toContainText("Rebalancing is needed");
  await expect(page.locator("tbody tr").nth(0)).toContainText("Sell 20 shares");
  await expect(page.locator("tbody tr").nth(1)).toContainText("Buy 30 shares");

  // 4. Reload page (F5) to verify localStorage hydration
  await page.reload();

  // Verify inputs rehydrated with formatted values from storage
  await expect(fund0.getByLabel("Fund name or ticker")).toHaveValue("VWRL");
  await expect(fund0.getByLabel("Quantity")).toHaveValue("100");
  await expect(fund0.getByLabel("Price (pence)")).toHaveValue("1,200.00p");
  await expect(fund0.getByLabel("Target (%)")).toHaveValue("60");

  await expect(fund1.getByLabel("Fund name or ticker")).toHaveValue("VUAG");
  await expect(fund1.getByLabel("Quantity")).toHaveValue("50");
  await expect(fund1.getByLabel("Price (pence)")).toHaveValue("800.00p");
  await expect(fund1.getByLabel("Target (%)")).toHaveValue("40");

  // Results should still be visible and match
  await expect(page.locator(".banner.act")).toContainText("Rebalancing is needed");
  await expect(page.locator("tbody tr").nth(0)).toContainText("Sell 20 shares");
  await expect(page.locator("tbody tr").nth(1)).toContainText("Buy 30 shares");
});

test("clears all entered data", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");

  await assertPageIsClear(page);

  const funds = page.locator(".row");
  const firstFund = funds.nth(0);
  await firstFund.getByLabel("Fund name or ticker").fill("ONE");
  await firstFund.getByLabel("Quantity").fill("6");
  await firstFund.getByLabel("Price (pence)").fill("1000");
  await firstFund.getByLabel("Target (%)").fill("60");

  const secondFund = funds.nth(1);
  await secondFund.getByLabel("Fund name or ticker").fill("TWO");
  await secondFund.getByLabel("Quantity").fill("4");
  await secondFund.getByLabel("Price (pence)").fill("1000");
  await secondFund.getByLabel("Target (%)").fill("40");

  await page.getByLabel("Cash available to invest in pounds").fill("0");
  await page.getByLabel("Total portfolio value shown on your platform, in pounds").fill("100");
  const actionsSection = page.getByRole("region", { name: "4. What to do" });
  await expect(actionsSection.locator(".banner.fine")).toContainText("No rebalancing needed");

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("This will delete everything you have entered. Continue?");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Clear everything" }).click();

  await assertPageIsClear(page);
});

test("marks invalid form fields accessibly and visually", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");

  const firstFund = page.locator(".row").first();
  const quantity = firstFund.getByLabel("Quantity");
  await quantity.fill("shares");
  await expectInvalidField(quantity);
  await quantity.fill("1.5");
  await expectInvalidField(quantity);
  await quantity.fill("2");
  await expectValidField(quantity);

  const price = firstFund.getByLabel("Price (pence)");
  await price.fill("12%");
  await expectInvalidField(price);
  await price.fill("£12");
  await price.blur();
  await expect(price).toHaveValue("1,200.00p");
  await expectValidField(price);
  await price.fill("1200p");
  await price.blur();
  await expect(price).toHaveValue("1,200.00p");
  await expectValidField(price);

  const target = firstFund.getByLabel("Target (%)");
  await target.fill("thirty");
  await expectInvalidField(target);
  await target.fill("30%");
  await expectValidField(target);

  const cash = page.getByLabel("Cash available to invest in pounds");
  await cash.fill("ten");
  await expectInvalidField(cash);
  await cash.fill("£10");
  await expectValidField(cash);

  const platform = page.getByLabel("Total portfolio value shown on your platform, in pounds");
  await platform.fill("total");
  await expectInvalidField(platform);
  await platform.fill("100");
  await expectValidField(platform);

  const settings = page.locator("section.noprint").last().locator("details");
  await settings.locator("summary").click();
  const allowedDrift = settings.getByLabel("Allowed drift, as a share of each fund’s target");
  await allowedDrift.fill("wide");
  await expectInvalidField(allowedDrift);
  await allowedDrift.fill("25%");
  await expectValidField(allowedDrift);

  const ceiling = settings.getByLabel("Ceiling in percentage points (optional)");
  await ceiling.fill("wide");
  await expectInvalidField(ceiling);
  await ceiling.fill("5");
  await expectValidField(ceiling);
  await ceiling.fill("");
  await expectValidField(ceiling);
});
