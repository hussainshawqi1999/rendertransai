import { addonBuilder, serveHTTP } from 'stremio-addon-sdk';
import manifest from './manifest.json' assert { type: 'json' };
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL;

const builder = new addonBuilder(manifest);

// صفحة الإعدادات (HTML)
const configPage = `
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>إعدادات الترجمة العربية</title>
    <style>
        body { font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px; background: #1a1a1a; color: #fff; }
        h1 { color: #4CAF50; }
        .section { background: #2a2a2a; padding: 20px; margin: 20px 0; border-radius: 8px; }
        label { display: block; margin: 10px 0 5px; }
        input, select { width: 100%; padding: 10px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; }
        button { background: #4CAF50; color: white; padding: 15px 30px; border: none; border-radius: 4px; cursor: pointer; margin-top: 20px; }
        button:hover { background: #45a049; }
        .note { color: #aaa; font-size: 0.9em; margin-top: 5px; }
        .required { color: #ff6b6b; }
    </style>
</head>
<body>
    <h1>⚙️ إعدادات الترجمة العربية الذكية</h1>
    
    <form id="configForm">
        <div class="section">
            <h3>🤖 مزود الترجمة الذكية <span class="required">*</span></h3>
            <label>اختر المزود:</label>
            <select id="provider" required>
                <option value="gemini">Google Gemini (مجاني)</option>
                <option value="openrouter">OpenRouter (يدعم نماذج متعددة)</option>
            </select>
            
            <label>مفتاح API:</label>
            <input type="password" id="aiKey" placeholder="ألصق مفتاح API هنا" required>
            <div class="note">احصل على مفتاح من <a href="https://aistudio.google.com" target="_blank">aistudio.google.com</a> (مجاني)</div>
        </div>

        <div class="section">
            <h3>📚 مصادر الترجمة (اختياري)</h3>
            
            <label>OpenSubtitles API Key:</label>
            <input type="password" id="osKey" placeholder="ترك فارغ = نسخة محدودة">
            <div class="note">من <a href="https://www.opensubtitles.com" target="_blank">opensubtitles.com</a> - يعطي نتائج أفضل</div>
            
            <label>SubDL API Key:</label>
            <input type="password" id="subdlKey" placeholder="ترك فارغ = تعطيل">
            <div class="note">من <a href="https://subdl.com" target="_blank">subdl.com</a></div>
        </div>

        <button type="submit">💾 حفظ الإعدادات</button>
    </form>

    <script>
        document.getElementById('configForm').onsubmit = function(e) {
            e.preventDefault();
            const config = {
                provider: document.getElementById('provider').value,
                aiKey: document.getElementById('aiKey').value,
                sources: {
                    opensubtitles: { apiKey: document.getElementById('osKey').value },
                    subdl: { apiKey: document.getElementById('subdlKey').value }
                }
            };
            
            // إرسال للأب (Stremio)
            if (window.parent) {
                window.parent.postMessage({ type: 'stremio-config', config }, '*');
            }
            
            // أو حفظ في URL للاستخدام المباشر
            const encoded = btoa(JSON.stringify(config));
            window.location.href = '/configure/' + encoded + '/manifest.json';
        };
    </script>
</body>
</html>
`;

// صفحة الإعدادات
builder.defineConfigHandler(() => {
  return {
    key: 'arabic-subtitles-config',
    title: 'إعدادات الترجمة العربية',
    components: [
      {
        type: 'text',
        name: 'مزود الترجمة',
        key: 'provider',
        default: 'gemini',
        options: [
          { value: 'gemini', label: 'Google Gemini' },
          { value: 'openrouter', label: 'OpenRouter' }
        ]
      },
      {
        type: 'password',
        name: 'مفتاح AI API',
        key: 'aiKey',
        required: true
      },
      {
        type: 'password',
        name: 'OpenSubtitles API (اختياري)',
        key: 'osKey'
      },
      {
        type: 'password',
        name: 'SubDL API (اختياري)',
        key: 'subdlKey'
      }
    ]
  };
});

function createFingerprint(args) {
  return `${args.type}_${args.id.replace(/:/g, '_')}`;
}

builder.defineSubtitlesHandler(async (args, extra) => {
  console.log('Request:', args.id);
  
  // جلب الإعدادات من extra.config
  const config = extra?.config || {};
  const fingerprint = createFingerprint(args);
  
  if (!config.aiKey) {
    console.log('No API key provided');
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

// مسار إضافي لصفحة الإعدادات
const express = (await import('express')).default;
const app = express();

app.get('/configure', (req, res) => {
  res.send(configPage);
});

// دمج الإضافة مع Express
const addonInterface = builder.getInterface();
app.use(addonInterface);

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`Addon on ${PORT}`);
  console.log(`Config page: http://localhost:${PORT}/configure`);
});
