const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    title: 'Mindful Journal',
    show: false
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function getDataPath() {
  const desktopPath = path.join(os.homedir(), 'Desktop');
  return path.join(desktopPath, 'MindfulJournalData');
}

function getJournalEntryPath(entryType, entryId) {
  const journalFolder = path.join(getDataPath(), 'journal');
  const typeFolder = path.join(journalFolder, entryType);
  return path.join(typeFolder, `${entryId}.txt`);
}

function getAnalysisPath(analysisId) {
  const analysisFolder = path.join(getDataPath(), 'analysis');
  return path.join(analysisFolder, `${analysisId}.json`);
}

async function ensureDataFolder() {
  const dataPath = getDataPath();
  try {
    await fs.access(dataPath);
  } catch {
    await fs.mkdir(dataPath, { recursive: true });
  }
  
  const subfolders = ['active', 'completed', 'journal', 'analysis'];
  for (const folder of subfolders) {
    const folderPath = path.join(dataPath, folder);
    try {
      await fs.access(folderPath);
    } catch {
      await fs.mkdir(folderPath, { recursive: true });
    }
  }
}

// Existing IPC handlers for journal entries and todos...
ipcMain.handle('get-journal-entries', async () => {
  try {
    await ensureDataFolder();
    const journalFolder = path.join(getDataPath(), 'journal');
    
    const allEntries = [];
    
    try {
      const typeFolders = await fs.readdir(journalFolder);
      
      for (const entryType of typeFolders) {
        const typeFolder = path.join(journalFolder, entryType);
        const stat = await fs.stat(typeFolder);
        
        if (stat.isDirectory()) {
          try {
            const files = await fs.readdir(typeFolder);
            
            for (const filename of files) {
              if (filename.endsWith('.txt')) {
                const entryId = filename.slice(0, -4);
                const entryPath = path.join(typeFolder, filename);
                
                try {
                  const content = await fs.readFile(entryPath, 'utf-8');
                  const fileStat = await fs.stat(entryPath);
                  
                  allEntries.push({
                    id: entryId,
                    content: content,
                    type: entryType,
                    created: fileStat.birthtimeMs || fileStat.ctimeMs,
                    updated: fileStat.mtimeMs
                  });
                } catch (error) {
                  console.error(`Error reading ${entryPath}:`, error);
                }
              }
            }
          } catch (error) {
            console.error(`Error reading type folder ${typeFolder}:`, error);
          }
        }
      }
    } catch (error) {
      console.log('Journal folder not found, returning empty array');
    }
    
    allEntries.sort((a, b) => b.updated - a.updated);
    return { success: true, data: allEntries };
  } catch (error) {
    console.error('Error getting journal entries:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-journal-entry', async (event, entryData) => {
  try {
    await ensureDataFolder();
    
    const entryType = entryData.type || 'personal';
    const entryId = entryData.id || Date.now().toString();
    const content = entryData.content || '';
    
    const entryPath = getJournalEntryPath(entryType, entryId);
    
    await fs.mkdir(path.dirname(entryPath), { recursive: true });
    await fs.writeFile(entryPath, content, 'utf-8');
    
    if (entryData.updated) {
      const updatedTime = new Date(entryData.updated);
      await fs.utimes(entryPath, updatedTime, updatedTime);
    }
    
    return { 
      success: true, 
      id: entryId,
      message: 'Entry saved successfully',
      path: entryPath
    };
  } catch (error) {
    console.error('Error saving journal entry:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-journal-entry', async (event, entryId, entryType) => {
  try {
    const entryPath = getJournalEntryPath(entryType, entryId);
    
    try {
      await fs.unlink(entryPath);
      return { success: true, message: 'Entry deleted successfully' };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: false, error: 'Entry not found' };
      }
      throw error;
    }
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-data', async (event, dataType, status) => {
  try {
    await ensureDataFolder();
    const filePath = path.join(getDataPath(), status, `${dataType}.json`);
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return { success: true, data: JSON.parse(data) };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true, data: [] };
      }
      throw error;
    }
  } catch (error) {
    console.error(`Error loading ${dataType} data:`, error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-data', async (event, dataType, data, status) => {
  try {
    await ensureDataFolder();
    const filePath = path.join(getDataPath(), status, `${dataType}.json`);
    
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error(`Error saving ${dataType} data:`, error);
    return { success: false, error: error.message };
  }
});

// New IPC handler for saving analysis
ipcMain.handle('save-analysis', async (event, analysisData) => {
  try {
    await ensureDataFolder();
    
    const analysisId = `analysis_${Date.now()}`;
    const analysisPath = getAnalysisPath(analysisId);
    
    await fs.mkdir(path.dirname(analysisPath), { recursive: true });
    await fs.writeFile(analysisPath, JSON.stringify(analysisData, null, 2), 'utf-8');
    
    return { 
      success: true, 
      id: analysisId,
      message: 'Analysis saved successfully',
      path: analysisPath
    };
  } catch (error) {
    console.error('Error saving analysis:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-system-info', async () => {
  try {
    const dataPath = getDataPath();
    let totalSize = 0;
    let fileCount = 0;
    
    async function calculateSize(dirPath) {
      try {
        const items = await fs.readdir(dirPath);
        
        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const stat = await fs.stat(itemPath);
          
          if (stat.isDirectory()) {
            await calculateSize(itemPath);
          } else {
            totalSize += stat.size;
            fileCount += 1;
          }
        }
      } catch (error) {
        // Ignore errors for inaccessible directories
      }
    }
    
    await calculateSize(dataPath);
    
    return {
      success: true,
      data: {
        dataFolder: dataPath,
        totalSize: totalSize,
        fileCount: fileCount
      }
    };
  } catch (error) {
    console.error('Error getting system info:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});