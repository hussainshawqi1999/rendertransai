import pkg from 'stremio-addon-sdk';
const { addonBuilder } = pkg;

import axios from 'axios';
import express from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const manifest = JSON.parse(readFileSync(join(__dirname, 'manifest.json'), 'utf-8'));

const BACKEND_URL = process.env.BACKEND_URL;

const builder = new addonBuilder(manifest);

// استخراج الإعدادات من URL
function getConfigFromUrl(url) {
  try {
    const match = url.match(/\/configure\/([^\/]+)/);
    if (match) {
      return JSON.parse(Buffer.from(match[1], 'base64').toString());
    }
  } catch (e) {}
  return {};
}

function createFingerprint(args) {
  return `${args.type}_${args.id.replace(/:/g, '_')}`;
}

builder.defineSubtitlesHandler(async (args, extra) => {
  console.log('Request:', args.id);
  
  // جرب نجيب الإعدادات من extra أو من URL
  let config = extra?.config || {};
  
  // إذا مافي إعدادات، جرب من الـ referer
  if (!config.aiKey && extra?.referer) {
    config = getConfigFromUrl(extra.referer);
  }
  
  const fingerprint = createFingerprint(args);
  
  if (!config.aiKey) {
    return { 
      subtitles: [{
        id: 'error',
        lang: 'ara',
        url: 'data:text/plain;base64,4oCqINmE2YTYp9ix2KfYqiDYp9mE2KPYqNmK2YPYqiDYp9mE2KzYp9mF2YrYqSDYp9mE2YLYsdmK2Kkg2KfZhNin2YTZitmE2Kkg2KfZhNiq2YjZgtmK2Kk=',
        name: '❌ أضف مفتاح API - انقر هنا للإعدادات',
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

// صفحة الإعدادات
app.get('/configure', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>إعدادات الترجمة العربية</title>
    <style>
        body { font-family: system-ui; max-width: 500px; margin: 50px auto; padding: 20px; background: #1a1a1a; color: #fff; }
        h1 { color: #4CAF50; }
        .section { background: #2a2a2a; padding: 20px; margin: 20px 0; border-radius: 8px; }
        label { display: block; margin: 15px 0 5px; }
        input, select { width: 100%; padding: 12px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; box-sizing: border-box; }
        button { background: #4CAF50; color: white; padding: 15px 30px; border: none; border-radius: 4px; cursor: pointer; margin-top: 20px; font-size: 16px; }
        button:hover { background: #45a049; }
        .note { color: #aaa; font-size: 0.85em; margin-top: 5px; }
        .required { color: #ff6b6b; }
    </style>
</head>
<body>
    <h1>⚙️ إعدادات الترجمة العربية الذكية</h1>
    
    <div class="section">
        <h3>🤖 مزود الترجمة الذكية <span class="required">*</span></h3>
        <label>اختر المزود:</label>
        <select id="provider">
            <option value="gemini">Google Gemini (مجاني)</option>
            <option value="openrouter">OpenRouter</option>
        </select>
        
        <label>مفتاح API:</label>
        <input type="password" id="aiKey" placeholder="ألصق مفتاح API هنا">
        <div class="note">احصل على مفتاح مجاني من <a href="https://aistudio.google.com" target="_blank" style="color: #4CAF50;">aistudio.google.com</a></div>
    </div>

    <div class="section">
        <h3>📚 مصادر الترجمة (اختياري)</h3>
        
        <label>OpenSubtitles API Key:</label>
        <input type="password" id="osKey" placeholder="ترك فارغ = نسخة محدودة">
        
        <label>SubDL API Key:</label>
        <input type="password" id="subdlKey" placeholder="ترك فارغ = تعطيل">
    </div>

    <button onclick="saveConfig()">💾 حفظ واستخدام الإضافة</button>

    <script>
        function saveConfig() {
            const config = {
                provider: document.getElementById('provider').value,
                aiKey: document.getElementById('aiKey').value.trim(),
                osKey: document.getElementById('osKey').value.trim(),
                subdlKey: document.getElementById('subdlKey').value.trim()
            };
            
            if (!config.aiKey) {
                alert('❌ مفتاح AI API مطلوب!');
                return;
            }
            
            const encoded = btoa(JSON.stringify(config));
            const manifestUrl = window.location.origin + '/' + encoded + '/manifest.json';
            
            // في Stremio، نفتح الرابط مباشرة
            window.location.href = 'stremio://' + manifestUrl.replace(/^https?:\\/\\//, '');
            
            // أو إذا كان في المتصفح
            setTimeout(() => {
                alert('✅ تم الحفظ!\\n\\nرابط الإضافة:\\n' + manifestUrl);
            }, 100);
        }
    </script>
</body>
</html>
  `);
});

// رابط الإضافة مع الإعدادات
app.get('/:config/manifest.json', (req, res) => {
  try {
    const config = JSON.parse(Buffer.from(req.params.config, 'base64').toString());
    // نضيف الإعدادات للـ manifest
    const customManifest = {
      ...manifest,
      behaviorHints: {
        config: config
      }
    };
    res.json(customManifest);
  } catch {
    res.json(manifest);
  }
});

const addonInterface = builder.getInterface();
app.use(addonInterface);

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`Addon on ${PORT}`);
  console.log(`Configure: http://localhost:${PORT}/configure`);
});
