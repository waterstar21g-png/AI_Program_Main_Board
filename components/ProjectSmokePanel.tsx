'use client';

import { useState } from 'react';

type Check = { name: string; status: 'pass' | 'fail' | 'warn'; detail: string };
type Result = {
  id: string;
  name: string;
  ok: boolean;
  checks: Check[];
};

export function ProjectSmokePanel() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [ok, setOk] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [at, setAt] = useState('');

  const runAll = async (project: 'all' | 'p1' | 'p2' | 'p3' = 'all') => {
    setRunning(true);
    setError('');
    setResults([]);
    setOk(null);
    try {
      const res = await fetch('/api/project-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
      setOk(Boolean(data.ok));
      setAt(data.at ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : '점검 실패');
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="smoke-panel">
      <div className="smoke-panel__head">
        <strong>프로젝트 스모크 테스트</strong>
        <div className="smoke-panel__actions">
          <button
            type="button"
            className="btn btn--sm btn--secondary"
            disabled={running}
            onClick={() => void runAll('p1')}
          >
            P1
          </button>
          <button
            type="button"
            className="btn btn--sm btn--secondary"
            disabled={running}
            onClick={() => void runAll('p2')}
          >
            P2
          </button>
          <button
            type="button"
            className="btn btn--sm btn--secondary"
            disabled={running}
            onClick={() => void runAll('p3')}
          >
            P3
          </button>
          <button
            type="button"
            className="btn btn--sm btn--primary"
            disabled={running}
            onClick={() => void runAll('all')}
          >
            {running ? '점검 중…' : '전체 점검'}
          </button>
        </div>
      </div>

      {ok !== null && (
        <p className="smoke-panel__summary">
          결과: <strong>{ok ? 'PASS' : 'FAIL/WARN 포함'}</strong>
          {at && <span className="smoke-panel__at"> · {at.slice(11, 19)} UTC</span>}
        </p>
      )}

      {results.map(r => (
        <div key={r.id} className="smoke-panel__project">
          <div className="smoke-panel__project-title">
            {r.name}{' '}
            <span className={`badge${r.ok ? '' : ' badge--warn'}`}>
              {r.ok ? 'OK' : 'CHECK'}
            </span>
          </div>
          <ul className="smoke-list">
            {r.checks.map((c, i) => (
              <li key={i} className={`smoke-list__item is-${c.status}`}>
                <span className="smoke-list__status">{c.status.toUpperCase()}</span>
                <span className="smoke-list__name">{c.name}</span>
                <span className="smoke-list__detail">{c.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {error && <p className="notice notice--error">{error}</p>}
    </section>
  );
}
