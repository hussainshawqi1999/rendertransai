import { addonBuilder, serveHTTP } from 'stremio-addon-sdk';
import manifest from './manifest.json' assert { type: 'json' };
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL;
const PROVIDER = process.env.TRANSLATION_PROVIDER || 'gemini';
const API_KEY = process.env.AI_API_KEY;

const builder = new addonBuilder(manifest);

function createFingerprint(args) {
  return `${args.type}_${args.id.replace(/:/g, '_')}`;
}

builder.defineSubtitlesHandler(async (args) => {
  console.log('Request:', args.id);
  
  const fingerprint = createFingerprint(args);
  
  try {
    const response = await axios.post(`${BACKEND_URL}/translate`, {
      videoMetadata: {
        fingerprint,
        filename: args.extra?.filename || args.id,
        type: args.type
      },
      provider: {
        name: PROVIDER,
        apiKey: API_KEY,
        model: PROVIDER === 'gemini' ? 'gemini-pro' : 'anthropic/claude-3-haiku-20240307'
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
          name: '🇦🇪 عربي ذكي',
          ext: 'srt'
        }]
      };
    }
  } catch (error) {
    console.error('Error:', error.message);
  }

  return { subtitles: [] };
});

const PORT = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: PORT });
console.log(`Addon running on ${PORT}`);
