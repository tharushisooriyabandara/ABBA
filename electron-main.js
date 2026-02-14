const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createMainWindow();
});

// One-click silent print: receipt goes straight to default printer, no dialog, no popup
ipcMain.on('print-receipt', (event, html) => {
  if (!html || typeof html !== 'string') return;
  const printWindow = new BrowserWindow({
    width: 400,
    height: 600,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  printWindow.loadURL(dataUrl);
  printWindow.webContents.once('did-finish-load', () => {
    printWindow.webContents.print({ silent: true, printBackground: true }, () => {
      printWindow.close();
    });
  });
});
