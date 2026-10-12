import { expect, test } from '@playwright/test';

// Runs in the `chromium` project with video + trace on, so the generated
// report carries real media (no network: the page is set inline).

test('counter increments on click', async ({ page }) => {
  await page.setContent(`
    <main style="font-family: sans-serif; padding: 40px">
      <h1>Demo counter</h1>
      <p>Count: <output id="count">0</output></p>
      <button id="inc" type="button">Increment</button>
      <script>
        document.getElementById('inc').addEventListener('click', () => {
          const out = document.getElementById('count');
          out.textContent = String(Number(out.textContent) + 1);
        });
      </script>
    </main>
  `);
  const button = page.locator('#inc');
  await button.click();
  await button.click();
  await button.click();
  await expect(page.locator('#count')).toHaveText('3');
});

test('form validates an email address', async ({ page }) => {
  await page.setContent(`
    <form style="font-family: sans-serif; padding: 40px">
      <label>Email <input id="email" type="email" required /></label>
      <button id="submit" type="button">Subscribe</button>
      <p id="status" role="status"></p>
      <script>
        document.getElementById('submit').addEventListener('click', () => {
          const input = document.getElementById('email');
          document.getElementById('status').textContent =
            input.checkValidity() && input.value ? 'Subscribed!' : 'Enter a valid email';
        });
      </script>
    </form>
  `);
  await page.fill('#email', 'not-an-email');
  await page.click('#submit');
  await expect(page.locator('#status')).toHaveText('Enter a valid email');
  await page.fill('#email', 'tester@example.com');
  await page.click('#submit');
  await expect(page.locator('#status')).toHaveText('Subscribed!');
});
