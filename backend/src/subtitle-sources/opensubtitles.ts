import axios from 'axios';
import { SubtitleCandidate, VideoMetadata } from '../types.js';

const API_URL = 'https://api.opensubtitles.com/api/v1';

export class OpenSubtitlesSource {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENSUBTITLES_API_KEY || '';
  }

  async search(metadata: VideoMetadata): Promise<SubtitleCandidate[]> {
    try {
      const params = new URLSearchParams({
        languages: 'en',
        ...(metadata.filename && { query: metadata.filename.replace(/\.[^/.]+$/, '') })
      });

      const response = await axios.get(`${API_URL}/subtitles?${params}`, {
        headers: {
          'Api-Key': this.apiKey,
          'User-Agent': 'StremioArabic/1.0'
        },
        timeout: 10000
      });

      return response.data.data.map((item: any) => ({
        id: `os_${item.attributes.subtitle_id}`,
        source: 'opensubtitles',
        downloadUrl: item.attributes.url,
        filename: item.attributes.release || item.attributes.filename,
        language: item.attributes.language,
        releaseName: item.attributes.release,
        downloads: item.attributes.download_count || 0
      }));
    } catch (error) {
      console.error('OpenSubtitles error:', error);
      return [];
    }
  }

  async download(candidate: SubtitleCandidate): Promise<string> {
    const response = await axios.get(candidate.downloadUrl, {
      headers: {
        'Api-Key': this.apiKey,
        'User-Agent': 'StremioArabic/1.0'
      },
      responseType: 'arraybuffer',
      timeout: 15000
    });

    return Buffer.from(response.data).toString('utf-8');
  }
}
