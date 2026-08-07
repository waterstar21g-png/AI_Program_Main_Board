'use client';

import { useState } from 'react';
import { smokeStatusLabel, verifyResultLabel } from '@/lib/smoke-status-label';

type Check = { name: string; status: 'pass' | 'fail' | 'warn'; detail: string };

export function PythonItemCollectorApp() {
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<Check[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState<boolean | null>(null);

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
        P2와 동일 작업 · 웹앱 없이 python-collector/ 폴더만으로 실행
      </div>

      <section className="panel panel--compact">
        <div className="panel__head">
          <h2 className="panel__title">실행 방법 (로컬 PC)</h2>
          <p className="panel__hint">
            웹앱·npm 없이 <code>python-collector/run.bat</code> 만 사용합니다.
          </p>
        </div>
        <ol className="workflow-steps">
          <li className="workflow-steps__item">파이썬 설치 (환경변수 PATH에 추가)</li>
          <li className="workflow-steps__item">
            수집 엑셀을 <strong>run.bat</strong> 위에 드래그 앤 드롭
          </li>
          <li className="workflow-steps__item">
            Chrome/Edge가 더망고에 연결되어 요건 0~4 자동 반복
          </li>
        </ol>
        <p className="panel__hint" style={{ marginTop: '0.75rem' }}>
          폴더: <code>python-collector/</code> · 스크립트: <code>collect.py</code>
        </p>
        <div className="panel__footer panel__footer--compact">
          <button
            type="button"
            className="btn btn--secondary"
            disabled={running}
            onClick={() => void runSmoke()}
          >
            {running ? '점검 중…' : 'P3 환경 점검'}
          </button>
        </div>
      </section>

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

      {error && (
        <section className="notice notice--error">
          <p>{error}</p>
        </section>
      )}
    </div>
  );
}
