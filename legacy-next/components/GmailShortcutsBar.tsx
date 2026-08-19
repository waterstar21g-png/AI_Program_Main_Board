'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  GMAIL_SHORTCUTS,
  GMAIL_SHORTCUTS_STORAGE_KEY,
  loginUrlForEmail,
  openUrl,
  type GmailShortcut,
} from '@/lib/gmail-shortcuts';

function loadShortcuts(): GmailShortcut[] {
  if (typeof window === 'undefined') return GMAIL_SHORTCUTS;
  try {
    const raw = localStorage.getItem(GMAIL_SHORTCUTS_STORAGE_KEY);
    if (!raw) return GMAIL_SHORTCUTS;
    const parsed = JSON.parse(raw) as GmailShortcut[];
    if (!Array.isArray(parsed) || parsed.length !== GMAIL_SHORTCUTS.length) {
      return GMAIL_SHORTCUTS;
    }
    return GMAIL_SHORTCUTS.map((base, index) => ({
      ...base,
      ...parsed[index],
      id: base.id,
    }));
  } catch {
    return GMAIL_SHORTCUTS;
  }
}

export function GmailShortcutsBar() {
  const [shortcuts, setShortcuts] = useState<GmailShortcut[]>(GMAIL_SHORTCUTS);
  const [editing, setEditing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    setShortcuts(loadShortcuts());
  }, []);

  const persist = useCallback((next: GmailShortcut[]) => {
    setShortcuts(next);
    localStorage.setItem(GMAIL_SHORTCUTS_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  };

  const copyCredentials = async (item: GmailShortcut) => {
    const text = [`ID: ${item.email}`, `PW: ${item.password}`].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${item.label} ID·비밀번호 복사됨`);
    } catch {
      showToast('클립보드 복사 실패 — 아래 설정에서 직접 확인');
    }
  };

  const openShortcut = async (item: GmailShortcut) => {
    setActiveId(item.id);
    const targetUrl = item.email.trim() ? loginUrlForEmail(item.email) : item.url;
    openUrl(targetUrl);
    if (item.email || item.password) {
      await copyCredentials(item);
    } else {
      showToast(`${item.label} 열기`);
    }
  };

  const updateField = (
    index: number,
    field: keyof Pick<GmailShortcut, 'label' | 'url' | 'email' | 'password'>,
    value: string,
  ) => {
    const next = shortcuts.map((item, i) =>
      i === index ? { ...item, [field]: value } : item,
    );
    persist(next);
  };

  const resetDefaults = () => {
    localStorage.removeItem(GMAIL_SHORTCUTS_STORAGE_KEY);
    setShortcuts(GMAIL_SHORTCUTS);
    showToast('기본값으로 초기화');
  };

  return (
    <section className="gmail-shortcuts" aria-label="Gmail 바로가기">
      <div className="gmail-shortcuts__head">
        <strong className="gmail-shortcuts__title">Gmail 바로가기</strong>
        <button
          type="button"
          className="gmail-shortcuts__edit-btn"
          onClick={() => setEditing(prev => !prev)}
        >
          {editing ? '닫기' : '설정'}
        </button>
      </div>

      <div className="gmail-shortcuts__grid">
        {shortcuts.map(item => (
          <button
            key={item.id}
            type="button"
            className={`gmail-shortcuts__item${activeId === item.id ? ' is-active' : ''}`}
            title={`${item.label}\n${item.email || '이메일 미설정'}`}
            onClick={() => void openShortcut(item)}
          >
            <span className="gmail-shortcuts__icon" aria-hidden="true">
              G
            </span>
            <span className="gmail-shortcuts__label">{item.label}</span>
            {item.email ? (
              <span className="gmail-shortcuts__email">{item.email}</span>
            ) : (
              <span className="gmail-shortcuts__email is-empty">미설정</span>
            )}
          </button>
        ))}
      </div>

      {editing && (
        <div className="gmail-shortcuts__panel">
          <p className="gmail-shortcuts__hint">
            URL·ID·비밀번호를 입력해 두면 아이콘 클릭 시 Gmail이 열리고 ID·비밀번호가 복사됩니다.
          </p>
          {shortcuts.map((item, index) => (
            <fieldset key={item.id} className="gmail-shortcuts__fieldset">
              <legend>{item.label}</legend>
              <label className="gmail-shortcuts__field">
                <span>URL</span>
                <input
                  className="input"
                  value={item.url}
                  onChange={e => updateField(index, 'url', e.target.value)}
                  placeholder="https://mail.google.com/mail/u/0/#inbox"
                />
              </label>
              <label className="gmail-shortcuts__field">
                <span>ID (이메일)</span>
                <input
                  className="input"
                  type="email"
                  value={item.email}
                  onChange={e => updateField(index, 'email', e.target.value)}
                  placeholder="example@gmail.com"
                  autoComplete="username"
                />
              </label>
              <label className="gmail-shortcuts__field">
                <span>비밀번호</span>
                <input
                  className="input"
                  type="password"
                  value={item.password}
                  onChange={e => updateField(index, 'password', e.target.value)}
                  placeholder="비밀번호"
                  autoComplete="current-password"
                />
              </label>
            </fieldset>
          ))}
          <div className="gmail-shortcuts__panel-actions">
            <button type="button" className="btn btn--sm btn--ghost" onClick={resetDefaults}>
              기본값 초기화
            </button>
          </div>
        </div>
      )}

      {toast && <p className="gmail-shortcuts__toast" role="status">{toast}</p>}
    </section>
  );
}
