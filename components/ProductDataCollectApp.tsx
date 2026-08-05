'use client';

import { useCallback, useRef, useState } from 'react';
import { parseCategoryUrlExcel } from '@/lib/product-data-collect/excel-import';
import { WORKFLOW_STEPS, TMG_BULK_URL } from '@/lib/product-data-collect/steps';
import type { TmgCollectRow, WorkflowStepId, WorkflowStepLog } from '@/lib/product-data-collect/types';

const SITE_NAME = '더망고';

export function ProductDataCollectApp() {
  const [saveCount, setSaveCount] = useState(3);
  const [rows, setRows] = useState<TmgCollectRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<WorkflowStepLog[]>([]);
  const [activeStep, setActiveStep] = useState<WorkflowStepId | null>(null);
  const [error, setError] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  const onExcelPick = useCallback(async (file?: File | null) => {
    if (!file) return;
    setError('');
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseCategoryUrlExcel(buf);
      setRows(parsed);
      setFileName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : '엑셀 읽기 실패');
      setRows([]);
      setFileName('');
    }
  }, []);

  const runCollect = async () => {
    setRunning(true);
    setError('');
    setLogs([]);
    setActiveStep(null);
    try {
      const res = await fetch('/api/product-collect/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName: SITE_NAME,
          rows,
          saveCount,
          headless: false,
          keepBrowserOpen: true,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? '수집 실패');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line) as {
            type: string;
            log?: WorkflowStepLog;
            ok?: boolean;
            message?: string;
          };
          if (msg.type === 'log' && msg.log) {
            setLogs(prev => [...prev, msg.log!]);
            setActiveStep(msg.log.step);
            logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          if (msg.type === 'done') {
            if (!msg.ok) setError(msg.message ?? '수집 실패');
            setActiveStep(null);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '요청 실패');
    } finally {
      setRunning(false);
      setActiveStep(null);
    }
  };

  return (
    <div className="product-data-collect-app program-unit">
      <section className="panel panel--compact">
        <div className="panel__head">
          <h2 className="panel__title">1. 엑셀 업로드</h2>
          <p className="panel__hint">
            <strong>로그인은 Chromium 창에서 직접</strong> 하세요. 프로그램은{' '}
            <strong>대량수집 메인 화면</strong>부터 자동 진행합니다.
          </p>
        </div>
        <div className="form-grid form-grid--compact">
          <label className="field">
            <span className="field__label">사이트명</span>
            <input className="input" value={SITE_NAME} readOnly />
          </label>
          <label className="field">
            <span className="field__label">대량수집 URL</span>
            <input className="input" value={TMG_BULK_URL} readOnly />
          </label>
        </div>
        <div className="panel__head" style={{ marginTop: '0.5rem' }}>
          <label className="field">
            <span className="field__label">수집 대상 엑셀 (.xlsx)</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="input"
              onChange={e => void onExcelPick(e.target.files?.[0])}
            />
          </label>
          {fileName && (
            <span className="badge">
              {fileName} · {rows.length}행
            </span>
          )}
        </div>
        <label className="field" style={{ maxWidth: '8rem', marginTop: '0.35rem' }}>
          <span className="field__label">검색결과상위 저장 수</span>
          <input
            className="input"
            type="number"
            min={1}
            max={99}
            value={saveCount}
            onChange={e => setSaveCount(Number(e.target.value) || 3)}
          />
        </label>
      </section>

      <section className="panel panel--compact">
        <h2 className="panel__title">2. 작업 흐름</h2>
        <p className="panel__hint">
          실행 → Chromium 열림 → <strong>창 닫지 말고</strong> 로그인 → 대량수집 화면 이동 (최대 5분) → 자동 진행
        </p>
        <ol className="workflow-steps">
          {WORKFLOW_STEPS.map((s, i) => (
            <li
              key={s.id}
              className={activeStep === s.id ? 'workflow-steps__item is-active' : 'workflow-steps__item'}
            >
              {i + 1}. {s.label}
              {activeStep === s.id && <span className="workflow-steps__now"> ← 진행 중</span>}
            </li>
          ))}
        </ol>
        <div className="panel__footer panel__footer--compact">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={running || !rows.length}
            onClick={() => void runCollect()}
          >
            {running ? '수집 실행 중…' : '3. 자동 수집 시작'}
          </button>
        </div>
      </section>

      {(running || logs.length > 0) && (
        <section className="panel panel--compact">
          <h2 className="panel__title">
            실행 로그 {running && <span className="badge badge--live">LIVE</span>}
          </h2>
          <div className="log-box">
            {logs.map((l, i) => (
              <div key={i} className="log-line">
                <span className="log-time">{l.at.slice(11, 19)}</span>
                {l.rowIndex != null && <span className="log-row">#{l.rowIndex}</span>}
                <span>{l.label}</span>
                {l.message && <span className="log-msg"> — {l.message}</span>}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
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
