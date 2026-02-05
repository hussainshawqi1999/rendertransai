import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const cache = new Map();

app.get('/health', (req, res) => {
  res.json({ status: 'alive' });
});

// الترجمة مع مفاتيح اليوزر
app.post('/translate', async (req, res) => {
  req.setTimeout(90000);
  
  const { videoMetadata, provider, sources } = req.body;
  const key = videoMetadata.fingerprint;

  if (cache.has(key)) {
    return res.json({ status: 'completed', subtitle: cache.get(key) });
  }

  try {
    console.log(`Processing: ${videoMetadata.filename}`);
    
    const { OpenSubtitlesSource } = await import('./subtitle-sources/opensubtitles.js');
    const { SubDLSource } = await import('./subtitle-sources/subdl.js');
    const { SubtitleRanker } = await import('./ranking/algorithm.js');
    const { AITranslator } = await import('./translation/ai-translator.js');

    // بناء المصادر حسب مفاتيح اليوزر
    const sourceInstances: any[] = [];
    
    if (sources?.opensubtitles?.apiKey) {
      sourceInstances.push(new OpenSubtitlesSource(sources.opensubtitles.apiKey));
    }
    
    if (sources?.subdl?.apiKey) {
      sourceInstances.push(new SubDLSource(sources.subdl.apiKey));
    }

    // إذا مافيه ولا مصدر، نستخدم OpenSubtitles بدون API (محدود)
    if (sourceInstances.length === 0) {
      sourceInstances.push(new OpenSubtitlesSource(''));
    }

    let candidates: any[] = [];
    
    for (const src of sourceInstances) {
      try {
        const found = await src.search(videoMetadata);
        candidates.push(...found);
      } catch(e) { console.log('Source failed:', e.message); }
    }

    if (candidates.length === 0) {
      return res.status(404).json({ error: 'No subtitles found. Check your API keys.' });
    }

    const ranker = new SubtitleRanker();
    const best = ranker.getBestCandidate(candidates, videoMetadata);
    
    if (!best) {
      return res.status(404).json({ error: 'No suitable subtitle found' });
    }

    const source = sourceInstances.find(s => 
      s.constructor.name.toLowerCase().includes(best.source)
    );
    
    const original = await source!.download(best);

    // الترجمة
    console.log('Translating with:', provider.name);
    const translator = new AITranslator(provider);
    const translated = await translator.translate(original, { title: videoMetadata.filename });

    const result = {
      content: translated,
      source: best.source,
      generatedAt: new Date().toISOString()
    };
    
    cache.set(key, result);
    setTimeout(() => cache.delete(key), 10 * 60 * 1000); // 10 دقائق

    res.json({ status: 'completed', subtitle: result });

  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Processing failed', msg: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
