export const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi;

const PROVIDER_MAP: Record<string, string> = {
  'figma.com': 'Figma',
  'github.com': 'GitHub',
  'gitlab.com': 'GitLab',
  'notion.so': 'Notion',
  'notion.site': 'Notion',
  'docs.google.com': 'Google Docs',
  'drive.google.com': 'Google Drive',
  'sheets.google.com': 'Google Sheets',
  'slides.google.com': 'Google Slides',
  'meet.google.com': 'Google Meet',
  'jira.atlassian.com': 'Jira',
  'trello.com': 'Trello',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  'twitter.com': 'X/Twitter',
  'x.com': 'X/Twitter',
  'linkedin.com': 'LinkedIn',
  'linkedin.be': 'LinkedIn',
  'dribbble.com': 'Dribbble',
  'behance.net': 'Behance',
  'codepen.io': 'CodePen',
  'codesandbox.io': 'CodeSandbox',
  'miro.com': 'Miro',
  'canva.com': 'Canva',
  'dropbox.com': 'Dropbox',
  'slack.com': 'Slack',
  'discord.com': 'Discord',
  'spotify.com': 'Spotify',
  'medium.com': 'Medium',
  'substack.com': 'Substack',
  'dev.to': 'DEV',
  'stackoverflow.com': 'Stack Overflow',
  'npmjs.com': 'npm',
  'vercel.app': 'Vercel',
  'netlify.app': 'Netlify',
};

export function detectProvider(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    for (const [domain, name] of Object.entries(PROVIDER_MAP)) {
      if (hostname === domain || hostname.endsWith('.' + domain)) return name;
    }
    return hostname;
  } catch {
    return '';
  }
}

export function getFaviconUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return '';
  }
}

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  return [...new Set(matches.map(u => u.replace(/[.,;:!?)\]]+$/, '')))];
}
