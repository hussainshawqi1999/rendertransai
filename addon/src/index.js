import pkg from 'stremio-addon-sdk';
const { addonBuilder, serveHTTP } = pkg;

import axios from 'axios';
import http from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const manifest = JSON.parse(readFileSync(join(__dirname, 'manifest.json'), 'utf-8'));

const BACKEND_URL = process.env.BACKEND_URL;

// صفحة الإعدادات HTML
const configPage = `
<!DOCTYPE html>
<html dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إعدادات الترجمة العربية الذكية</title>
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); 
            color: #fff; 
            min-height: 100vh;
        }
        h1 { 
            color: #4CAF50; 
            text-align: center;
            margin-bottom: 10px;
        }
        .subtitle {
            text-align: center;
            color: #aaa;
            margin-bottom: 30px;
        }
        .section { 
            background: rgba(255,255,255,0.05); 
            padding: 25px; 
            margin: 20px 0; 
            border-radius: 12px; 
            border: 1px solid rgba(255,255,255,0.1);
        }
        .section h3 {
            margin-top: 0;
            color: #4CAF50;
        }
        label { 
            display: block; 
            margin: 20px 0 8px; 
            font-weight: 500;
        }
        input, select { 
            width: 100%; 
            padding: 14px; 
            background: rgba(0,0,0,0.3); 
            color: #fff; 
            border: 2px solid #333; 
            border-radius: 8px; 
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input:focus, select:focus {
            outline: none;
            border-color: #4CAF50;
        }
        button { 
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); 
            color: white; 
            padding: 18px 40px; 
            border: none; 
            border-radius: 8px; 
            cursor: pointer; 
            margin-top: 30px; 
            font-size: 18px; 
            width: 100%;
            font-weight: bold;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover { 
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(76, 175, 80, 0.3);
        }
        .note { 
            color: #888; 
            font-size: 0.85em; 
            margin-top: 8px; 
            line-height: 1.5;
        }
        .required { 
            color: #ff6b6b; 
        }
        .error {
            background: rgba(255, 107, 107, 0.1);
            border: 1px solid #ff6b6b;
            color: #ff6b6b;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            display: none;
        }
        .success {
            background: rgba(76, 175, 80, 0.1);
            border: 1px solid #4CAF50;
            color: #4CAF50;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            display: none;
        }
        a { color: #4CAF50; }
        .step {
            display: inline-block;
            background: #4CAF50;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            text-align: center;
            line-height: 30px;
            margin-left: 10px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <h1>🎯 الترجمة العربية الذكية</h1>
    <p class="subtitle">أضف مفاتيح API لتفعيل الإضافة</p>
    
    <div id="error" class="error"></div>
    <div id="success" class="success"></div>
    
    <form id="configForm">
        <div class="section">
            <h3><span class="step">1</span>🤖 مزود الذكاء الاصطناعي <span class="required">*</span></h3>
            
            <label>اختر المزود:</label>
            <select id="provider" required>
                <option value="gemini">Google Gemini (مجاني - موصى به)</option>
                <option value="openrouter">OpenRouter (يدعم Claude, GPT, إلخ)</option>
            </select>
            
            <label>مفتاح API:</label>
            <input type="password" id="aiKey" placeholder="ألصق مفتاح API هنا" required>
            <div class="note">
                💡 <strong>مجاني:</strong> احصل على مفتاح من 
                <a href="https://aistudio.google.com/app/apikey" target="_blank">aistudio.google.com</a>
                <br>لا يحتاج بطاقة بنكية!
            </div>
        </div>

        <div class="section">
            <h3><span class="step">2</span>📚 مصادر الترجمة (اختياري)</h3>
            
            <label>OpenSubtitles API Key:</label>
            <input type="password" id="osKey" placeholder="ترك فارغ = نتائج محدودة">
            <div class="note">
                من <a href="https://www.opensubtitles.com/en/consumers" target="_blank">opensubtitles.com</a>
                - يعطي نتائج أسرع وأدق
            </div>
            
            <label>SubDL API Key:</label>
            <input type="password" id="subdlKey" placeholder="ترك فارغ = تعطيل">
            <div class="note">
                من <a href="https://subdl.com/panel/api" target="_blank">subdl.com</a>
            </div>
        </div>

        <button type="submit">⚡ تفعيل الإضافة</button>
    </form>

    <script>
        function showError(msg) {
            const el = document.getElementById('error');
            el.textContent = '❌ ' + msg;
            el.style.display = 'block';
            document.getElementById('success').style.display = 'none';
        }
        
        function showSuccess(msg) {
            const el = document.getElementById('success');
            el.textContent = '✅ ' + msg;
            el.style.display = 'block';
            document.getElementById('error').style.display = 'none';
        }

        document.getElementById('configForm').onsubmit = function(e) {
            e.preventDefault();
            
            const aiKey = document.getElementById('aiKey').value.trim();
            
            if (!aiKey) {
                showError('مفتاح AI API مطلوب!');
                return;
            }
            
            const config = {
                provider: document.getElementById('provider').value,
                aiKey: aiKey,
                osKey: document.getElementById('osKey').value.trim(),
                subdlKey: document.getElementById('subdlKey').value.trim()
            };
            
            try {
                const encoded = btoa(JSON.stringify(config));
                const manifestUrl = window.location.origin + '/stremio/' + encoded + '/manifest.json';
                
                showSuccess('جاري التفعيل...');
                
                // فتح في Stremio
                setTimeout(() => {
                    window.location.href = 'stremio://' + manifestUrl.replace(/^https?:\\/\\//, '');
                }, 500);
                
                // نسخ للحافظة كاحتياط
                navigator.clipboard.writeText(manifestUrl);
                
            } catch (err) {
                showError('خطأ في التفعيل: ' + err.message);
            }
        };
    </script>
</body>
</html>
`;

// Builder
const builder = new addonBuilder(manifest);

function createFingerprint(args) {
  return `${args.type}_${args.id.replace(/:/g, '_')}`;
}

builder.defineSubtitlesHandler(async (args, extra) => {
  console.log('Request:', args.id, 'Config:', extra?.config ? 'yes' : 'no');
  
  const config = extra?.config || {};
  const fingerprint = createFingerprint(args);
  
  // التحقق من الإعدادات
  if (!config.aiKey) {
    return { 
      subtitles: [{
        id: 'no_config',
        lang: 'ara',
        url: 'data:text/plain;base64,4oCqINmE2YTYp9ix2KfYqiDYp9mE2KPYqNmK2YPYqiDYp9mE2KzYp9mF2YrYqSDYp9mE2YLYsdmK2Kkg2KfZhNin2YTZitmE2Kkg2KfZhNiq2YjZgtmK2Kk=',
        name: '⚠️ أكمل الإعدادات أولاً /configure',
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

// خادم مخصص مع مسارات إضافية
const PORT = process.env.PORT || 7000;

const server = http.createServer((req, res) => {
  const url = req.url;
  
  // صفحة الإعدادات الرئيسية
  if (url === '/' || url === '/configure') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(configPage);
    return;
  }
  
  // manifest مع الإعدادات
  const stremioMatch = url.match(/^\\/stremio\\/([^\\/]+)\\/manifest\\.json$/);
  if (stremioMatch) {
    try {
      const config = JSON.parse(Buffer.from(stremioMatch[1], 'base64').toString());
      const customManifest = {
        ...manifest,
        id: `org.arabicsubtitles.${Buffer.from(stremioMatch[1]).toString('hex').slice(0,8)}`,
        name: `Arabic AI Subtitles (${config.provider})`,
        behaviorHints: {
          configurable: false,
          configurationRequired: false
        }
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(customManifest, null, 2));
      return;
    } catch (e) {
      res.writeHead(400);
      res.end('Invalid config');
      return;
    }
  }
  
  // subtitle route مع الإعدادات
  const subMatch = url.match(/^\\/stremio\\/([^\\/]+)\\/subtitles\\//);
  if (subMatch) {
    try {
      const config = JSON.parse(Buffer.from(subMatch[1], 'base64').toString());
      // معالجة الطلب...
      req.url = url.replace(/^\\/stremio\\/[^\\/]+/, '');
      // تمرير الإعدادات للـ handler
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
  
  // الباقي لـ SDK
  const iface = builder.getInterface();
  iface(req, res);
});

server.listen(PORT, () => {
  console.log(`
🚀 Addon running on port ${PORT}

📋 روابط مهمة:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️  صفحة الإعدادات:
   http://localhost:${PORT}/

🔗 مثال بعد الإعدادات:
   http://localhost:${PORT}/stremio/[encoded-config]/manifest.json
   
💡 أرسل الرابط للمستخدم يكمل إعداداته أولاً!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});
