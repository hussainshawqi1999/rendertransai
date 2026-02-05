export interface VideoMetadata {
  fingerprint: string;
  filename: string;
  duration?: number;
  filehash?: string;
  type?: 'movie' | 'series';
}

export interface SubtitleCandidate {
  id: string;
  source: string;
  downloadUrl: string;
  filename: string;
  language: string;
  releaseName?: string;
  downloads?: number;
}

export interface TranslationProvider {
  name: 'gemini' | 'openrouter';
  apiKey: string;
  model?: string;
}

export interface UserSources {
  opensubtitles?: { apiKey: string };
  subdl?: { apiKey: string };
}
