# ABBA Receipt Print — Chrome extension

Use this extension when you open ABBA in Chrome (e.g. https://tharushisooriyabandara.github.io/ABBA/). When you click the printer icon, the receipt is opened in a new tab and the print dialog is shown (no popup blocker).

## Install (Chrome)

1. Open Chrome and go to `chrome://extensions/`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the **extension** folder (this folder).
5. The extension is now active on the ABBA site.

## How it works

- On the ABBA site, when you click the printer icon (after placing an order or in order view), the page calls `window.__abbaPrintReceipt(html)` if the extension is installed.
- The extension opens the receipt in a new tab and triggers the browser print dialog so you can print or save as PDF.

## One-click silent print

For printing **without** the dialog (straight to the default printer), use the **Electron app** instead: from the project root run `npm install` then `npm start`.
