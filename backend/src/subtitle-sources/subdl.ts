import axios from 'axios';
import { SubtitleCandidate, VideoMetadata } from '../types.js';

export class SubDLSource {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(metadata: VideoMetadata): Promise<SubtitleCandidate[]> {
    if (!this.apiKey) return [];

    try {
      const response = await axios.get(`https://api.subdl.com/api/v1/subtitles`, {
        params: {
          api_key: this.apiKey,
          film_name: metadata.filename.replace(/\.[^/.]+$/, ''),
          languages: 'en'
        },
        timeout: 10000
      });

      if (!response.data?.subtitles) return [];

      return response.data.subtitles.map((sub: any) => ({
        id: `subdl_${sub.id}`,
        source: 'subdl',
        downloadUrl: sub.url,
        filename: sub.release_name,
        language: sub.language,
        downloads: sub.downloads || 0
      }));
    } catch {
      return [];
    }
  }

  async download(candidate: SubtitleCandidate): Promise<string> {
    const response = await axios.get(candidate.downloadUrl, {
      responseType: 'text',
      timeout: 15000
    });
    return response.data;
  }
}
