import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFile, readdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/timeline/save', async (req, res) => {
  try {
    const { data, filename } = req.body;

    if (!data || !filename) {
      return res.status(400).json({ error: 'Missing data or filename' });
    }

    const safeFilename = filename.replace(/[^a-z0-9-_]/gi, '-');
    const filePath = join(__dirname, 'src', 'data', `${safeFilename}.js`);

    const fileContent = `export const ${safeFilename.replace(/-/g, '_')} = ${JSON.stringify(data, null, 2)};\n`;

    await writeFile(filePath, fileContent, 'utf8');

    res.json({
      success: true,
      message: 'Timeline saved successfully',
      path: filePath
    });
  } catch (error) {
    console.error('Error saving timeline:', error);
    res.status(500).json({
      error: 'Failed to save timeline',
      details: error.message
    });
  }
});

app.get('/api/timeline/list', async (req, res) => {
  try {
    const dataDir = join(__dirname, 'src', 'data');
    const files = await readdir(dataDir);
    const timelineFiles = files.filter(f => f.endsWith('.js') && f !== 'index.js');

    res.json({
      success: true,
      files: timelineFiles
    });
  } catch (error) {
    console.error('Error listing timelines:', error);
    res.status(500).json({
      error: 'Failed to list timelines',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Timeline API server running on http://localhost:${PORT}`);
});
