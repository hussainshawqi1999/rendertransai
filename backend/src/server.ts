import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const cache = new Map();

app.get('/health', (req, res) => {
  res.json({ status: 'alive', timestamp: Date.now() });
});

app.post('/translate', async (req, res) => {
  req.setTimeout(90000);
  res.setHeader('Content-Type', 'application/json');
  
  const { videoMetadata, provider } = req.body;
  const key = videoMetadata.fingerprint;

  if (cache.has(key)) {
    return res.json({ status: 'completed', subtitle: cache.get(key) });
  }

  try {
    console.log(`Processing: ${videoMetadata.filename}`);
    
    const { OpenSubtitlesSource } = await import('./subtitle-sources/opensubtitles.js');
    const { SubtitleRanker } = await import('./ranking/algorithm.js');
    const { AITranslator } = await import('./translation/ai-translator.js');

    const sources = [new OpenSubtitlesSource()];
    let candidates: any[] = [];
    
    for (const src of sources) {
      try {
        const found = await src.search(videoMetadata);
        candidates.push(...found);
      } catch(e) { console.log('Source failed:', e); }
    }

    if (candidates.length === 0) {
      return res.status(404).json({ error: 'No subtitles found' });
    }

    const ranker = new SubtitleRanker();
    const best = ranker.getBestCandidate(candidates, videoMetadata);
    
    if (!best) {
      return res.status(404).json({ error: 'No suitable subtitle' });
    }

    const source = sources.find(s => s.constructor.name.toLowerCase().includes(best.source));
    const original = await source!.download(best);

    console.log('Translating...');
    const translator = new AITranslator(provider);
    const translated = await translator.translate(original, { title: videoMetadata.filename });

    const result = {
      content: translated,
      source: best.source,
      generatedAt: new Date().toISOString()
    };
    
    cache.set(key, result);
    setTimeout(() => cache.delete(key), 5 * 60 * 1000);

    res.json({ status: 'completed', subtitle: result });

  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Processing failed', msg: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
