export type GmailShortcut = {
  id: string;
  label: string;
  url: string;
  email: string;
  password: string;
};

/** Gmail 바로가기 5개 — URL·ID·비밀번호를 여기서 수정 */
export const GMAIL_SHORTCUTS: GmailShortcut[] = [
  {
    id: 'gmail-1',
    label: 'Gmail 1',
    url: 'https://mail.google.com/mail/u/0/#inbox',
    email: '',
    password: '',
  },
  {
    id: 'gmail-2',
    label: 'Gmail 2',
    url: 'https://mail.google.com/mail/u/1/#inbox',
    email: '',
    password: '',
  },
  {
    id: 'gmail-3',
    label: 'Gmail 3',
    url: 'https://mail.google.com/mail/u/2/#inbox',
    email: '',
    password: '',
  },
  {
    id: 'gmail-4',
    label: 'Gmail 4',
    url: 'https://mail.google.com/mail/u/3/#inbox',
    email: '',
    password: '',
  },
  {
    id: 'gmail-5',
    label: 'Gmail 5',
    url: 'https://mail.google.com/mail/u/4/#inbox',
    email: '',
    password: '',
  },
];

export const GMAIL_SHORTCUTS_STORAGE_KEY = 'ai-board-gmail-shortcuts-v1';

export function loginUrlForEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return 'https://accounts.google.com/signin/v2/identifier';
  return `https://accounts.google.com/v3/signin/identifier?Email=${encodeURIComponent(trimmed)}&continue=${encodeURIComponent('https://mail.google.com/mail/')}`;
}

export function openUrl(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}
