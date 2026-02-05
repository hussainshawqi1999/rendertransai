import pkg from 'stremio-addon-sdk';
const { addonBuilder } = pkg;

import express from 'express';
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || '';

const manifest = {
  id: "org.arabicsubtitles.userconfig",
  version: "1.0.0",
  name: "Arabic AI Subtitles",
  description: "ترجمات عربية ذكية - أضف مفاتيحك الخاصة",
  logo: "https://i.imgur.com/arabic.png",
  background: "https://i.imgur.com/bg.jpg",
  contactEmail: "your@email.com",
  types: ["movie", "series"],
  catalogs: [],
  resources: ["subtitles"],
  idPrefixes: ["tt"]
};

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
        label { display: block; margin: 20px 0 8px; }
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
            <div class="note">احصل على مفتاح مجاني من <a href="https://aistudio.google.com" style="color: #4CAF50;">aistudio.google.com</a></div>
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

// Express تطبيق
const app = express();

// صفحة الإعدادات
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(configPage);
});

app.get('/configure', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(configPage);
});

// manifest مع الإعدادات
app.get('/stremio/:config/manifest.json', (req, res) => {
  try {
    const config = JSON.parse(Buffer.from(req.params.config, 'base64').toString());
    const customManifest = {
      ...manifest,
      id: 'org.arabicsubtitles.' + Buffer.from(req.params.config).toString('hex').slice(0,8),
      name: 'Arabic AI Subtitles (' + config.provider + ')',
      behaviorHints: {
        config: config
      }
    };
    res.json(customManifest);
  } catch (e) {
    res.status(400).json({ error: 'Invalid config' });
  }
});

// الـ addon routes
const addonInterface = builder.getInterface();

// subtitles route مع config
app.get('/stremio/:config/subtitles/:type/:id/:extra?.json', async (req, res) => {
  try {
    const config = JSON.parse(Buffer.from(req.params.config, 'base64').toString());
    const args = {
      type: req.params.type,
      id: req.params.id,
      extra: req.query
    };
    
    const result = await builder.runSubtitlesHandler(args, { config });
    res.json(result);
  } catch (e) {
    res.status(400).json({ subtitles: [] });
  }
});

// default manifest بدون config
app.get('/manifest.json', (req, res) => {
  res.json(manifest);
});

// default subtitles (بدون config)
app.get('/subtitles/:type/:id/:extra?.json', async (req, res) => {
  const args = {
    type: req.params.type,
    id: req.params.id,
    extra: req.query
  };
  const result = await builder.runSubtitlesHandler(args, {});
  res.json(result);
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log('Addon on port ' + PORT);
  console.log('Configure: http://localhost:' + PORT + '/configure');
});
