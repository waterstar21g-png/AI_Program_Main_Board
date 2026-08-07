'use client';

import { useCallback, useEffect, useState } from 'react';
import { smokeStatusLabel, verifyResultLabel } from '@/lib/smoke-status-label';

type Check = { name: string; status: 'pass' | 'fail' | 'warn'; detail: string };

type LibraryItem = {
  path: string;
  name: string;
  addedAt: string;
  exists: boolean;
};

type BrowseFile = {
  path: string;
  name: string;
  mtimeMs: number;
};

export function PythonItemCollectorApp() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [selected, setSelected] = useState('');
  const [roots, setRoots] = useState<string[]>([]);
  const [browseDir, setBrowseDir] = useState('');
  const [browseQuery, setBrowseQuery] = useState('');
  const [found, setFound] = useState<BrowseFile[]>([]);
  const [pickPaths, setPickPaths] = useState<Set<string>>(new Set());

  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [runningCollect, setRunningCollect] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<Check[]>([]);
  const [ok, setOk] = useState<boolean | null>(null);

  const refreshLibrary = useCallback(async () => {
    const res = await fetch('/api/p3/library');
    const data = await res.json();
    if (!data.ok) throw new Error(data.message ?? '목록 로드 실패');
    setItems(data.items ?? []);
    setRoots(data.roots ?? []);
    const last = (data.lastSelected as string) || data.items?.[0]?.path || '';
    setSelected(prev => {
      if (prev && (data.items as LibraryItem[])?.some(i => i.path === prev)) return prev;
      return last;
    });
    setBrowseDir(prev => prev || data.roots?.[0] || '');
  }, []);

  useEffect(() => {
    void refreshLibrary().catch(e => setError(e instanceof Error ? e.message : '목록 로드 실패'));
  }, [refreshLibrary]);

  const runSearch = async () => {
    setSearching(true);
    setError('');
    setMessage('');
    setFound([]);
    setPickPaths(new Set());
    try {
      const qs = new URLSearchParams({ dir: browseDir.trim(), q: browseQuery.trim() });
      const res = await fetch(`/api/p3/browse?${qs}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.message ?? '검색 실패');
      setFound(data.files ?? []);
      setMessage(
        data.files?.length
          ? `${data.files.length}개 .xlsx 발견 (P1 출력 파일 우선 정렬)`
          : '해당 폴더에서 .xlsx 를 찾지 못했습니다.',
      );
      if (data.roots?.length) setRoots(data.roots);
    } catch (e) {
      setError(e instanceof Error ? e.message : '검색 실패');
    } finally {
      setSearching(false);
    }
  };

  const togglePick = (path: string) => {
    setPickPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const addPickedToLibrary = async () => {
    if (!pickPaths.size) {
      setError('검색 결과에서 추가할 파일을 선택하세요.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/p3/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', paths: [...pickPaths] }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message ?? '추가 실패');
      setItems(data.items ?? []);
      if (data.lastSelected) setSelected(data.lastSelected);
      setPickPaths(new Set());
      setMessage(`보관 목록에 ${pickPaths.size}개 추가됨 — 이후 실행은 리스트박스에서만 선택`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패');
    } finally {
      setBusy(false);
    }
  };

  const onSelectChange = async (path: string) => {
    setSelected(path);
    if (!path) return;
    try {
      await fetch('/api/p3/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'select', path }),
      });
    } catch {
      /* ignore */
    }
  };

  const removeSelected = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/p3/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', path: selected }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message ?? '삭제 실패');
      setItems(data.items ?? []);
      setSelected(data.lastSelected ?? '');
      setMessage('목록에서 제거했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    } finally {
      setBusy(false);
    }
  };

  const runCollect = async () => {
    if (!selected) {
      setError('리스트박스에서 P1 출력 엑셀을 선택하세요.');
      return;
    }
    setRunningCollect(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/p3/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selected }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message ?? '실행 실패');
      setMessage(data.message ?? '수집을 시작했습니다. (별도 창)');
    } catch (e) {
      setError(e instanceof Error ? e.message : '실행 실패');
    } finally {
      setRunningCollect(false);
    }
  };

  const runSmoke = async () => {
    setRunning(true);
    setError('');
    setChecks([]);
    setOk(null);
    try {
      const res = await fetch('/api/project-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: 'p3' }),
      });
      const data = await res.json();
      const p3 = data.results?.[0];
      setChecks(p3?.checks ?? []);
      setOk(Boolean(p3?.ok));
      if (!p3) setError('점검 결과를 받지 못했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '점검 실패');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="python-collector-app program-unit">
      <div className="panel__breadcrumb">
        P1 출력 엑셀 → P3 입력 · 로컬 검색으로 목록에 넣은 뒤, 재실행 시 리스트박스에서만 선택
      </div>

      {/* 1) 로컬 디렉터리 검색 → 목록에 추가 */}
      <section className="panel panel--compact">
        <div className="panel__head">
          <h2 className="panel__title">1. 로컬에서 P1 엑셀 찾아 추가</h2>
        </div>
        <p className="panel__hint">
          P1에서 저장한 <code>*카테고리URL_LIST*.xlsx</code> 를 폴더에서 검색한 뒤 보관 목록에 넣습니다.
          경로를 직접 입력해 수집하지 않습니다.
        </p>
        <div className="p3-browse-row">
          <label className="field field--grow">
            <span className="field__label">검색 폴더 (절대 경로)</span>
            <input
              className="input"
              value={browseDir}
              onChange={e => setBrowseDir(e.target.value)}
              placeholder="C:\Users\...\Downloads"
              list="p3-root-dirs"
            />
            <datalist id="p3-root-dirs">
              {roots.map(r => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span className="field__label">파일명 필터 (선택)</span>
            <input
              className="input"
              value={browseQuery}
              onChange={e => setBrowseQuery(e.target.value)}
              placeholder="카테고리URL"
            />
          </label>
          <div className="p3-browse-actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={searching || !browseDir.trim()}
              onClick={() => void runSearch()}
            >
              {searching ? '검색 중…' : '검색'}
            </button>
          </div>
        </div>

        {found.length > 0 && (
          <div className="p3-found">
            <p className="panel__hint">검색 결과 — 추가할 파일 선택 후 「목록에 추가」</p>
            <ul className="p3-found__list">
              {found.map(f => (
                <li key={f.path}>
                  <label className="p3-found__item">
                    <input
                      type="checkbox"
                      checked={pickPaths.has(f.path)}
                      onChange={() => togglePick(f.path)}
                    />
                    <span className="p3-found__name">{f.name}</span>
                    <span className="p3-found__path" title={f.path}>
                      {f.path}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="panel__footer panel__footer--compact">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={busy || pickPaths.size === 0}
                onClick={() => void addPickedToLibrary()}
              >
                목록에 추가 ({pickPaths.size})
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 2) 리스트박스 — 재실행 시 여기만 */}
      <section className="panel panel--compact">
        <div className="panel__head">
          <h2 className="panel__title">2. 보관 목록 (리스트박스)에서 선택 · 실행</h2>
        </div>
        <p className="panel__hint">
          재실행 시에는 아래 목록에서만 고릅니다. P1 출력 파일을 1번에서 먼저 추가하세요.
        </p>
        <label className="field">
          <span className="field__label">P3 입력 엑셀</span>
          <select
            className="input p3-listbox"
            size={Math.min(8, Math.max(3, items.length || 3))}
            value={selected}
            onChange={e => void onSelectChange(e.target.value)}
            disabled={items.length === 0}
          >
            {items.length === 0 ? (
              <option value="">(비어 있음 — 위에서 검색 후 추가)</option>
            ) : (
              items.map(it => (
                <option key={it.path} value={it.path} disabled={!it.exists}>
                  {it.exists ? '' : '[없음] '}
                  {it.name}
                </option>
              ))
            )}
          </select>
        </label>
        {selected && (
          <p className="p3-selected-path" title={selected}>
            {selected}
          </p>
        )}
        <div className="panel__footer panel__footer--compact p3-run-actions">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={runningCollect || !selected || items.length === 0}
            onClick={() => void runCollect()}
          >
            {runningCollect ? '시작 중…' : '선택 파일로 P3 수집 시작'}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={busy || !selected}
            onClick={() => void removeSelected()}
          >
            목록에서 제거
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={running}
            onClick={() => void runSmoke()}
          >
            {running ? '점검 중…' : '환경 점검'}
          </button>
        </div>
      </section>

      {message && (
        <section className="notice notice--ok">
          <p>{message}</p>
        </section>
      )}

      {error && (
        <section className="notice notice--error">
          <p>{error}</p>
        </section>
      )}

      {checks.length > 0 && (
        <section className="panel panel--compact">
          <h2 className="panel__title">
            점검 결과{' '}
            {ok === true && <span className="badge">{verifyResultLabel(true)}</span>}
            {ok === false && <span className="badge badge--warn">{verifyResultLabel(false)}</span>}
          </h2>
          <ul className="smoke-list">
            {checks.map((c, i) => (
              <li key={i} className={`smoke-list__item is-${c.status}`}>
                <span className="smoke-list__status">{smokeStatusLabel(c.status)}</span>
                <span className="smoke-list__name">{c.name}</span>
                <span className="smoke-list__detail">{c.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
