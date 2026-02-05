import { addonBuilder, serveHTTP } from 'stremio-addon-sdk';
import axios from 'axios';
import express from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// قراءة manifest.json يدوياً
const manifest = JSON.parse(readFileSync(join(__dirname, 'manifest.json'), 'utf-8'));

const BACKEND_URL = process.env.BACKEND_URL;

const builder = new addonBuilder(manifest);

function createFingerprint(args) {
  return `${args.type}_${args.id.replace(/:/g, '_')}`;
}

builder.defineSubtitlesHandler(async (args, extra) => {
  console.log('Request:', args.id);
  
  const config = extra?.config || {};
  const fingerprint = createFingerprint(args);
  
  if (!config.aiKey) {
    return { 
      subtitles: [{
        id: 'error',
        lang: 'ara',
        url: 'data:text/plain;base64,4oCqINmE2YTYp9ix2KfYqiDYp9mE2KPYqNmK2YPYqiDYp9mE2KzYp9mF2YrYqSDYp9mE2YLYsdmK2Kkg2KfZhNin2YTZitmE2Kkg2KfZhNiq2YjZgtmK2Kk=',
        name: '❌ أضف مفتاح API من الإعدادات',
        ext: 'txt'
      }]
    };
  }

  try {
    const response = await axios.post(`${BACKEND_URL}/translate`, {
      videoMetadata: {
        fingerprint,
        filename: args.extra?.filename || args.id,
        type: args.type
      },
      provider: {
        name: config.provider || 'gemini',
        apiKey: config.aiKey,
        model: config.provider === 'gemini' ? 'gemini-pro' : 'anthropic/claude-3-haiku-20240307'
      },
      sources: {
        opensubtitles: config.osKey ? { apiKey: config.osKey } : undefined,
        subdl: config.subdlKey ? { apiKey: config.subdlKey } : undefined
      }
    }, { timeout: 90000 });

    if (response.data.status === 'completed') {
      const content = response.data.subtitle.content;
      const base64 = Buffer.from(content).toString('base64');
      
      return {
        subtitles: [{
          id: `ar_${fingerprint}`,
          lang: 'ara',
          url: `data:text/srt;base64,${base64}`,
          name: `🇦🇪 عربي ذكي (${config.provider})`,
          ext: 'srt'
        }]
      };
    }

  } catch (error) {
    console.error('Error:', error.message);
    let errorMsg = 'فشلت الترجمة';
    
    if (error.response?.data?.error) {
      errorMsg = error.response.data.error;
    }
    
    return {
      subtitles: [{
        id: 'error',
        lang: 'ara',
        url: `data:text/plain;base64,${Buffer.from(errorMsg).toString('base64')}`,
        name: `❌ ${errorMsg}`,
        ext: 'txt'
      }]
    };
  }

  return { subtitles: [] };
});

const app = express();
const addonInterface = builder.getInterface();

app.get('/health', (req, res) => {
  res.json({ status: 'addon alive', backend: BACKEND_URL });
});

app.use(addonInterface);

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`Addon on ${PORT}`);
});
