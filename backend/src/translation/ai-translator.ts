import axios from 'axios';
import { TranslationProvider } from '../types.js';

interface Line {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

export class AITranslator {
  private provider: TranslationProvider;

  constructor(provider: TranslationProvider) {
    this.provider = provider;
  }

  async translate(content: string, context?: any): Promise<string> {
    const lines = this.parseSRT(content);
    const translated: Line[] = [];

    for (let i = 0; i < lines.length; i += 25) {
      const batch = lines.slice(i, i + 25);
      const result = await this.translateBatch(batch, context);
      translated.push(...result);
      if (i + 25 < lines.length) await new Promise(r => setTimeout(r, 300));
    }

    return this.buildSRT(translated);
  }

  private parseSRT(content: string): Line[] {
    const lines: Line[] = [];
    const blocks = content.trim().split(/\n\s*\n/);

    for (const block of blocks) {
      const parts = block.split('\n');
      if (parts.length >= 3) {
        const times = parts[1].split(' --> ');
        lines.push({
          index: parseInt(parts[0]),
          startTime: times[0].trim(),
          endTime: times[1].trim(),
          text: parts.slice(2).join('\n').replace(/<[^>]+>/g, '')
        });
      }
    }
    return lines;
  }

  private async translateBatch(lines: Line[], context?: any): Promise<Line[]> {
    const texts = lines.map(l => l.text);
    
    const prompt = `أنت مترجم أفلام محترف. ترجم إلى العربية الفصحى الطبيعية.

⚠️ قواعد أساسية:
1. **التفريق بين الذكر والأنثى**: 
   - رجل: "أنتَ"، "كنتَ"، "ذهبتَ"، "لكَ"
   - امرأة: "أنتِ"، "كنتِ"، "ذهبتِ"، "لكِ"
   - استخدم السياق (he/she) لتحديد الجنس

2. الأعداد: 1-2 (واحد/اثنان)، 3-10 (خمسة)، 11+ (15)
3. صرف الأفعال صحيحًا حسب الزمن
4. انقل العاطفة والسخرية بدقة
5. لا تدمج الأسطر
6. احتفظ بـ [تنهد]، [ضحك] فقط

النصوص:
${texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}

أعد الترجمة بنفس الترتيب:`;

    const translated = await this.callAI(prompt);
    
    return lines.map((line, i) => ({
      ...line,
      text: translated[i] || line.text
    }));
  }

  private async callAI(prompt: string): Promise<string[]> {
    const { name, apiKey, model } = this.provider;

    if (name === 'gemini') {
      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-pro'}:generateContent?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
        },
        { timeout: 30000 }
      );
      return this.parseResponse(res.data.candidates[0].content.parts[0].text);
    } else {
      const res = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: model || 'anthropic/claude-3-haiku-20240307',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2
        },
        {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'HTTP-Referer': 'https://stremio.com' },
          timeout: 30000
        }
      );
      return this.parseResponse(res.data.choices[0].message.content);
    }
  }

  private parseResponse(text: string): string[] {
    return text.split('\n')
      .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(l => l.length > 0);
  }

  private buildSRT(lines: Line[]): string {
    return lines.map(l => `${l.index}\n${l.startTime} --> ${l.endTime}\n${l.text}\n`).join('\n');
  }
}
