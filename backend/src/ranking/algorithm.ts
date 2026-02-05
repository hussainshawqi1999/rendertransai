import { SubtitleCandidate, VideoMetadata } from '../types.js';

export class SubtitleRanker {
  getBestCandidate(candidates: SubtitleCandidate[], metadata: VideoMetadata): SubtitleCandidate | null {
    const ranked = candidates.map(c => ({
      ...c,
      score: this.calculateScore(c, metadata)
    })).sort((a, b) => b.score - a.score);

    return ranked[0]?.score > 10 ? ranked[0] : null;
  }

  private calculateScore(candidate: SubtitleCandidate, metadata: VideoMetadata): number {
    let score = 0;
    const filename = metadata.filename.toLowerCase();
    const release = (candidate.releaseName || candidate.filename).toLowerCase();

    const cleanName = filename.replace(/\.[^/.]+$/, '');
    if (release.includes(cleanName) || cleanName.includes(release)) score += 50;

    const fileRes = filename.match(/(1080p|720p|480p)/)?.[0];
    const subRes = release.match(/(1080p|720p|480p)/)?.[0];
    if (fileRes && subRes && fileRes === subRes) score += 20;

    const ripTypes = ['bluray', 'web-dl', 'webrip', 'hdrip'];
    for (const type of ripTypes) {
      if (filename.includes(type) && release.includes(type)) {
        score += 15;
        break;
      }
    }

    score += Math.min((candidate.downloads || 0) / 100, 10);
    if (release.includes('forced')) score -= 10;

    return score;
  }
}
