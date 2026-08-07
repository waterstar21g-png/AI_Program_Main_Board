'use client';

import { useState } from 'react';
import { projectOkLabel, smokeStatusLabel, verifyResultLabel } from '@/lib/smoke-status-label';

type Check = { name: string; status: 'pass' | 'fail' | 'warn'; detail: string };
type Result = { id: string; name: string; ok: boolean; checks: Check[] };

type Action =
  | 'verify-p1'
  | 'verify-p2'
  | 'verify-p3'
  | 'verify-all'
  | 'sync'
  | 'clean';

export function BoardCommandPanel() {
  const [running, setRunning] = useState<Action | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [ok, setOk] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  const run = async (action: Action) => {
    setRunning(action);
    setError('');
    setLogs([]);
    setResults([]);
    setOk(null);
    try {
      const res = await fetch('/api/board-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      setLogs(data.logs ?? []);
      setResults(data.smoke?.results ?? []);
      setOk(Boolean(data.ok));
      if (!res.ok && data.logs?.length === 0) {
        setError(data.message ?? '실행 실패');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '실행 실패');
    } finally {
      setRunning(null);
    }
  };

  const busy = running !== null;

  return (
    <section className="board-cmd">
      <div className="board-cmd__block">
        <strong className="board-cmd__title">프로젝트별 독립 실행</strong>
        <p className="board-cmd__hint">
          P1·P2·P3 각각 따로 · 버튼마다 그 프로젝트의 명령 순서만 실행
        </p>
        <div className="board-cmd__actions">
          <button
            type="button"
            className="btn btn--sm btn--primary"
            disabled={busy}
            onClick={() => void run('verify-p1')}
            title="p1.bat / npm run p1"
          >
            {running === 'verify-p1' ? '…' : '① P1 독립 실행'}
          </button>
          <button
            type="button"
            className="btn btn--sm btn--primary"
            disabled={busy}
            onClick={() => void run('verify-p2')}
            title="p2.bat / npm run p2"
          >
            {running === 'verify-p2' ? '…' : '② P2 독립 실행'}
          </button>
          <button
            type="button"
            className="btn btn--sm btn--primary"
            disabled={busy}
            onClick={() => void run('verify-p3')}
            title="p3.bat / npm run p3"
          >
            {running === 'verify-p3' ? '…' : '③ P3 독립 실행'}
          </button>
        </div>
      </div>

      <div className="board-cmd__block">
        <strong className="board-cmd__title">로컬 명령 대체</strong>
        <p className="board-cmd__hint">명령창 없이 버튼으로 실행</p>
        <div className="board-cmd__actions">
          <button
            type="button"
            className="btn btn--sm btn--secondary"
            disabled={busy}
            onClick={() => void run('sync')}
            title=".\run.ps1 -Sync 대체"
          >
            {running === 'sync' ? '…' : '① 동기화'}
          </button>
          <button
            type="button"
            className="btn btn--sm btn--secondary"
            disabled={busy}
            onClick={() => void run('clean')}
            title=".\run.ps1 -Clean 대체"
          >
            {running === 'clean' ? '…' : '② 캐시정리'}
          </button>
          <button
            type="button"
            className="btn btn--sm btn--secondary"
            disabled={busy}
            onClick={() => void run('verify-all')}
            title="P1·P2·P3 각각 독립 실행 후 결과만 모음 (연쇄 아님)"
          >
            {running === 'verify-all' ? '…' : '③ 개별점검 묶음'}
          </button>
        </div>
      </div>

      {ok !== null && (
        <p className="board-cmd__summary">
          결과: <strong>{verifyResultLabel(ok)}</strong>
          {busy && ' · 실행 중…'}
        </p>
      )}

      {results.length > 0 && (
        <div className="board-cmd__results">
          {results.map(r => (
            <div key={r.id} className="smoke-panel__project">
              <div className="smoke-panel__project-title">
                {r.name}{' '}
                <span className={`badge${r.ok ? '' : ' badge--warn'}`}>
                  {projectOkLabel(r.ok)}
                </span>
              </div>
              <ul className="smoke-list">
                {r.checks.map((c, i) => (
                  <li key={i} className={`smoke-list__item is-${c.status}`}>
                    <span className="smoke-list__status">{smokeStatusLabel(c.status)}</span>
                    <span className="smoke-list__name">{c.name}</span>
                    <span className="smoke-list__detail">{c.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {logs.length > 0 && results.length === 0 && (
        <pre className="board-cmd__log">{logs.join('\n')}</pre>
      )}

      {error && <p className="notice notice--error">{error}</p>}
    </section>
  );
}
