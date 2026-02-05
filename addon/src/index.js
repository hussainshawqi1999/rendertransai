import pkg from 'stremio-addon-sdk';
const { addonBuilder } = pkg;

import axios from 'axios';
import http from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const manifest = JSON.parse(readFileSync(join(__dirname, 'manifest.json'), 'utf-8'));

const BACKEND_URL = process.env.BACKEND_URL || '';

const configPage = `
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>إعدادات الترجمة العربية الذكية</title>
    <style>
        body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; background: #1a1a2e; color: #fff; }
        h1 { color: #4CAF50; text-align: center; }
        .section { background: rgba(255,255,255,0.05); padding: 25px; margin: 20px 0; border-radius: 12px; }
        label { display: block; margin: 20px 0 8px; font-weight: 500; }
        input, select { width: 100%; padding: 14px; background: rgba(0,0,0,0.3); color: #fff; border: 2px solid #333; border-radius: 8px; }
        button { background: #4CAF50; color: white; padding: 18px; border: none; border-radius: 8px; cursor: pointer; margin-top: 20px; font-size: 18px; width: 100%; }
        .note { color: #888; font-size: 0.85em; margin-top: 8px; }
        .required { color: #ff6b6b; }
    </style>
</head>
<body>
    <h1>🎯 الترجمة العربية الذكية</h1>
    
    <form id="configForm">
        <div class="section">
            <h3>🤖 مزود الذكاء الاصطناعي <span class="required">*</span></h3>
            <label>اختر المزود:</label>
            <select id="provider" required>
                <option value="gemini">Google Gemini (مجاني)</option>
                <option value="openrouter">OpenRouter</option>
            </select>
            
            <label>مفتاح API:</label>
            <input type="password" id="aiKey" placeholder="ألصق مفتاح API هنا" required>
            <div class="note">احصل على مفتاح مجاني من <a href="https://aistudio.google.com" target="_blank" style="color: #4CAF50;">aistudio.google.com</a></div>
        </div>

        <div class="section">
            <h3>📚 مصادر الترجمة (اختياري)</h3>
            <label>OpenSubtitles API Key:</label>
            <input type="password" id="osKey" placeholder="ترك فارغ = نتائج محدودة">
            <label>SubDL API Key:</label>
            <input type="password" id="subdlKey" placeholder="ترك فارغ = تعطيل">
        </div>

        <button type="submit">⚡ تفعيل الإضافة</button>
    </form>

    <script>
        document.getElementById('configForm').onsubmit = function(e) {
            e.preventDefault();
            const aiKey = document.getElementById('aiKey').value.trim();
            if (!aiKey) { alert('مفتاح AI API مطلوب!'); return; }
            
            const config = {
                provider: document.getElementById('provider').value,
                aiKey: aiKey,
                osKey: document.getElementById('osKey').value.trim(),
                subdlKey: document.getElementById('subdlKey').value.trim()
            };
            
            const encoded = btoa(JSON.stringify(config));
            const manifestUrl = window.location.origin + '/stremio/' + encoded + '/manifest.json';
            
            window.location.href = 'stremio://' + manifestUrl.replace(/^https?:\/\//, '');
        };
    </script>
</body>
</html>
`;

const builder = new addonBuilder(manifest);

function createFingerprint(args) {
  return args.type + '_' + args.id.replace(/:/g, '_');
}

builder.defineSubtitlesHandler(async (args, extra) => {
  const config = extra?.config || {};
  const fingerprint = createFingerprint(args);
  
  if (!config.aiKey) {
    return { 
      subtitles: [{
        id: 'no_config',
        lang: 'ara',
        url: 'data:text/plain;base64,ERROR',
        name: '⚠️ أكمل الإعدادات أولاً /configure',
        ext: 'txt'
      }]
    };
  }

  try {
    const response = await axios.post(BACKEND_URL + '/translate', {
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
          id: 'ar_' + fingerprint,
          lang: 'ara',
          url: 'data:text/srt;base64,' + base64,
          name: '🇦🇪 عربي ذكي (' + config.provider + ')',
          ext: 'srt'
        }]
      };
    }

  } catch (error) {
    return {
      subtitles: [{
        id: 'error',
        lang: 'ara',
        url: 'data:text/plain;base64,ERROR',
        name: '❌ فشلت الترجمة',
        ext: 'txt'
      }]
    };
  }

  return { subtitles: [] };
});

const PORT = process.env.PORT || 7000;

const server = http.createServer((req, res) => {
  const url = req.url;
  
  if (url === '/' || url === '/configure') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(configPage);
    return;
  }
  
  const stremioMatch = url.match(/\/stremio\/([^\/]+)\/manifest\.json$/);
  if (stremioMatch) {
    try {
      const config = JSON.parse(Buffer.from(stremioMatch[1], 'base64').toString());
      const customManifest = {
        ...manifest,
        id: 'org.arabicsubtitles.' + Buffer.from(stremioMatch[1]).toString('hex').slice(0,8),
        name: 'Arabic AI Subtitles (' + config.provider + ')'
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(customManifest));
      return;
    } catch (e) {
      res.writeHead(400);
      res.end('Invalid config');
      return;
    }
  }
  
  const subMatch = url.match(/\/stremio\/([^\/]+)\/subtitles\//);
  if (subMatch) {
    try {
      const config = JSON.parse(Buffer.from(subMatch[1], 'base64').toString());
      req.url = url.replace(/\/stremio\/[^\/]+/, '');
      req.stremioConfig = config;
      
      const iface = builder.getInterface();
      iface(req, res);
      return;
    } catch (e) {
      res.writeHead(400);
      res.end('Invalid config');
      return;
    }
  }
  
  const iface = builder.getInterface();
  iface(req, res);
});

server.listen(PORT, () => {
  console.log('Addon on port ' + PORT);
});
