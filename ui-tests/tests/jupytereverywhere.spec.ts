import { test, expect, Page } from '@playwright/test';
import path from 'path';
import type { JupyterLab } from '@jupyterlab/application';
import type { JSONObject } from '@lumino/coreutils';

import { SharingService } from '../../src/sharing-service';

declare global {
  interface Window {
    jupyterapp: JupyterLab;
  }
}

declare global {
  interface Window {
    sharingService?: SharingService;
  }
}

async function runCommand(page: Page, command: string, args: JSONObject = {}) {
  await page.evaluate(
    async ({ command, args }) => {
      await window.jupyterapp.commands.execute(command, args);
    },
    { command, args }
  );
}

async function dismissKernelSelectDialog(page: Page) {
  const kernelDialogHeader = page.locator('.jp-Dialog .jp-Dialog-header', {
    hasText: 'Select Kernel'
  });

  if ((await kernelDialogHeader.count()) === 0) {
    return;
  }

  const selectButtonLabel = kernelDialogHeader.locator(
    'xpath=../../..//div[@aria-label="Select Kernel"]'
  );

  if (await selectButtonLabel.count()) {
    await selectButtonLabel.first().click();
  }
}

async function getSharedNotebookID(page: Page) {
  return new URL(page.url()).searchParams.get('notebook');
}

test.beforeEach(async ({ page }) => {
  await page.goto('lab/index.html?kernel=python');
  await page.waitForSelector('.jp-LabShell');

  // Clear token before each test
  await page.evaluate(() => {
    window.sharingService?.resetToken();
  });
});

test.describe('General', () => {
  test('Should load a notebook', async ({ page }) => {
    await page.waitForTimeout(1000);
    expect(
      await page.locator('.jp-LabShell').screenshot({
        mask: [page.locator('.jp-KernelStatus')],
        maskColor: '#888888'
      })
    ).toMatchSnapshot('application-shell.png');
  });

  test('Dialog windows should shade the notebook area only', async ({ page }) => {
    await dismissKernelSelectDialog(page);
    const firstCell = page.locator('.jp-Cell');
    await firstCell
      .getByRole('textbox')
      .fill('The shaded area should cover the notebook content, but not the toolbar.');
    const promise = runCommand(page, 'notebook:restart-kernel');
    await dismissKernelSelectDialog(page);
    const dialog = page.locator('.jp-Dialog');

    expect(
      await dialog.screenshot({
        mask: [dialog.locator('.jp-Dialog-content'), page.locator('.jp-KernelStatus')],
        maskColor: '#fff'
      })
    ).toMatchSnapshot('empty-dialog-over-notebook.png');

    // Close dialog
    await dialog.press('Escape');
    await promise;
  });

  test('Should load a view-only notebook', async ({ page }) => {
    await runCommand(page, 'jupytereverywhere:share-notebook');

    const notebookId = await getSharedNotebookID(page);
    expect(notebookId).not.toBeNull();

    await page.goto(`lab/index.html?notebook=${notebookId}&kernel=python`);
    dismissKernelSelectDialog(page);

    expect(
      await page.locator('.jp-NotebookPanel').screenshot({
        mask: [page.locator('.jp-KernelStatus')],
        maskColor: '#888888'
      })
    ).toMatchSnapshot('read-only-notebook.png');
  });

  test('Should open files page', async ({ page }) => {
    await page.locator('.jp-SideBar').getByTitle('Files').click();
    await dismissKernelSelectDialog(page);
    expect(await page.locator('#je-files').screenshot()).toMatchSnapshot('files.png');
  });
});

test.describe('Sharing', () => {
  test('Should open share dialog in interactive notebook', async ({ page }) => {
    await runCommand(page, 'jupytereverywhere:share-notebook');
    const dialog = page.locator('.jp-Dialog-content');
    expect(await dialog.screenshot()).toMatchSnapshot('share-dialog.png');
  });

  test('Should open share dialog in view-only mode', async ({ page }) => {
    // Load view-only (shared) notebook
    await runCommand(page, 'jupytereverywhere:share-notebook');
    const notebookId = await getSharedNotebookID(page);
    expect(notebookId).not.toBeNull();

    // Re-share it as a new notebook
    await page.goto(`lab/index.html?notebook=${notebookId}&kernel=python`);
    dismissKernelSelectDialog(page);

    const dialog = page.locator('.jp-Dialog-content');
    await expect(dialog).toHaveCount(0);
    await runCommand(page, 'jupytereverywhere:share-notebook');
    await expect(dialog).toHaveCount(1);
  });
});

test.describe('Download', () => {
  test('Should open download Menu', async ({ page }) => {
    const downloadButton = page.locator('.je-DownloadButton');
    await downloadButton.click();
    expect(await page.locator('.je-DownloadDropdownButton-menu').screenshot()).toMatchSnapshot(
      'download-menu.png'
    );
  });

  test('Should download a notebook as IPyNB and PDF', async ({ page, context }) => {
    dismissKernelSelectDialog(page);
    await runCommand(page, 'jupytereverywhere:share-notebook');
    await getSharedNotebookID(page);
    dismissKernelSelectDialog(page);

    const ipynbDownload = page.waitForEvent('download');
    await runCommand(page, 'jupytereverywhere:download-notebook');
    const ipynbPath = await (await ipynbDownload).path();
    expect(ipynbPath).not.toBeNull();

    const pdfDownload = page.waitForEvent('download');
    await runCommand(page, 'jupytereverywhere:download-pdf');
    const pdfPath = await (await pdfDownload).path();
    expect(pdfPath).not.toBeNull();
  });

  test('Should download view-only notebook as IPyNB and PDF', async ({ page }) => {
    await runCommand(page, 'jupytereverywhere:share-notebook');
    const notebookId = await getSharedNotebookID(page);
    expect(notebookId).not.toBeNull();

    await page.goto(`lab/index.html?notebook=${notebookId}&kernel=python`);
    dismissKernelSelectDialog(page);

    // Wait until view-only notebook loads, and assert it is a view-only notebook.
    await page.locator('.jp-NotebookPanel').waitFor();
    await expect(page.locator('.je-ViewOnlyHeader')).toBeVisible();

    const ipynbDownload = page.waitForEvent('download');
    await runCommand(page, 'jupytereverywhere:download-notebook');
    const ipynbPath = await (await ipynbDownload).path();
    expect(ipynbPath).not.toBeNull();

    const pdfDownload = page.waitForEvent('download');
    await runCommand(page, 'jupytereverywhere:download-pdf');
    const pdfPath = await (await pdfDownload).path();
    expect(pdfPath).not.toBeNull();
  });
});

test.describe('Files', () => {
  test('Should upload two files and display their thumbnails', async ({ page }) => {
    await page.goto('lab/index.html?kernel=python');
    await page.waitForSelector('.jp-LabShell');

    await page.locator('.jp-SideBar').getByTitle('Files').click();

    await page.locator('.je-FileTile').first().click(); // the first tile will always be the "add new" one

    const jpgPath = path.resolve(__dirname, '../test-files/a-image.jpg');
    const csvPath = path.resolve(__dirname, '../test-files/b-dataset.csv');

    await page.setInputFiles('input[type="file"]', [jpgPath, csvPath]);

    // Wait some time for thumbnails to appear as the files
    // are being uploaded to the contents manager
    await page
      .locator('.je-FileTile-label', { hasText: 'a-image.jpg' })
      .waitFor({ state: 'visible' });
    await page
      .locator('.je-FileTile-label', { hasText: 'b-dataset.csv' })
      .waitFor({ state: 'visible' });

    expect(await page.locator('.je-FilesApp-grid').screenshot()).toMatchSnapshot(
      'uploaded-files-grid.png'
    );

    await expect(page.locator('.je-FileTile-label', { hasText: 'a-image.jpg' })).toBeVisible();
    await expect(page.locator('.je-FileTile-label', { hasText: 'b-dataset.csv' })).toBeVisible();
  });
});

test('Should remove View Only banner when the Create Copy button is clicked', async ({ page }) => {
  await runCommand(page, 'jupytereverywhere:share-notebook');
  const notebookId = await getSharedNotebookID(page);
  expect(notebookId).not.toBeNull();

  // Open view-only notebook
  await page.goto(`lab/index.html?notebook=${notebookId}&kernel=python`);
  await expect(page.locator('.je-ViewOnlyHeader')).toBeVisible();

  await runCommand(page, 'jupytereverywhere:create-copy-notebook');
  await expect(page.locator('.je-ViewOnlyHeader')).toBeHidden({
    timeout: 10000
  });

  // Check toolbar items typical of an editable notebook are present
  await expect(page.locator('.jp-NotebookPanel-toolbar [data-jp-item-name="save"]')).toBeVisible();
  await expect(
    page.locator('.jp-NotebookPanel-toolbar [data-jp-item-name="insert"]')
  ).toBeVisible();
});

test.describe('Landing page', () => {
  test('Should render the landing page as expected', async ({ page }) => {
    await page.goto('index.html');
    await page.waitForSelector('.je-hero');

    // Find the scroll height because the landing page is long and we want to
    // capture the full page screenshot without the rest of it being empty; as
    // we use a viewport to handle the hero section.
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);

    // Override the hero section's height so that we don't get blank sections
    // after the viewport.
    await page.addStyleTag({
      content: '.je-hero { min-height: auto !important; height: auto !important; }'
    });

    await page.setViewportSize({
      width: 1440,
      height: scrollHeight
    });

    const screenshot = await page.screenshot({
      fullPage: true
    });

    expect(screenshot).toMatchSnapshot('landing-page.png');
  });
});
