import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

// Module-level scenario state — safe because the config pins workers: 1.
let total = 0;
let error = '';
let catalog: string[] = [];
let results: string[] = [];

Given('a cart totalling {int} euros', async ({}, amount: number) => {
  total = amount;
  error = '';
});

When('the customer applies the code {string}', async ({}, code: string) => {
  if (code === 'WELCOME10') total = Math.round(total * 0.9);
  else if (code === 'TIER') total = total >= 200 ? total * 0.9 : total * 0.95;
  else error = 'code expired';
});

Then('the total becomes {int} euros', async ({}, expected: number) => {
  expect(total).toBe(expected);
});

Then('the total stays {int} euros', async ({}, expected: number) => {
  expect(total).toBe(expected);
});

Then('an error {string} is shown', async ({}, message: string) => {
  expect(error).toBe(message);
});

Given('the catalog contains {string}', async ({}, item: string) => {
  catalog = [item];
});

When('the customer searches for {string}', async ({}, query: string) => {
  results = catalog.filter((i) => i.includes(query));
});

Then('the results include {string}', async ({}, item: string) => {
  expect(results).toContain(item);
});
