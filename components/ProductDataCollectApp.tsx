'use client';

import { useCallback, useRef, useState } from 'react';
import { APP_VERSION } from '@/lib/app-version';
import { WORKFLOW_STEPS, TMG_BULK_URL, TMG_MAIN_URL } from '@/lib/product-data-collect/steps';
import type { TmgCollectRow, WorkflowStepId, WorkflowStepLog } from '@/lib/product-data-collect/types';

const SITE_NAME = '더망고';

export function ProductDataCollectApp() {
  const [saveCount, setSaveCount] = useState(3);
  const [rows, setRows] = useState<TmgCollectRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [running, setRunning] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openMessage, setOpenMessage] = useState('');
  const [logs, setLogs] = useState<WorkflowStepLog[]>([]);
  const [activeStep, setActiveStep] = useState<WorkflowStepId | null>(null);
  const [error, setError] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  const openBrowser = async () => {
    setOpening(true);
    setError('');
    setOpenMessage('');
    try {
      const res = await fetch('/api/product-collect/open', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message ?? '브라우저 열기 실패');
        return;
      }
      setOpenMessage(data.message ?? '브라우저 준비 완료');
    } catch (e) {
      setError(e instanceof Error ? e.message : '요청 실패');
    } finally {
      setOpening(false);
    }
  };

  const onExcelPick = useCallback(async (file?: File | null) => {
    if (!file) return;
    setError('');
    try {
      // xlsx는 파일 선택할 때만 로드 (초기 컴파일 부담 제거)
      const { parseCategoryUrlExcel } = await import('@/lib/product-data-collect/excel-import');
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
          useExistingBrowser: true,
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
      <div className="panel__breadcrumb">
        상품데이터수집 → 수집용 엑셀 업로드 → 대량수집 로그인 → 스텝별 자동 수집 반복
      </div>
      <section className="panel panel--compact">
        <div className="panel__head">
          <h2 className="panel__title">1. 엑셀 업로드</h2>
          <p className="panel__hint">
            <strong>v{APP_VERSION}</strong> · 0.초기화 → 1.URL검색·팝업대기 → 2.모두저장·검색필터명·저장하기 → 3.팝업대기 → 4.→0
          </p>
        </div>
        <div className="form-grid form-grid--compact">
          <label className="field">
            <span className="field__label">사이트명</span>
            <input className="input" value={SITE_NAME} readOnly />
          </label>
          <label className="field">
            <span className="field__label">메인화면 URL (로그인 세션 있으면 자동 진입)</span>
            <input className="input" value={TMG_MAIN_URL} readOnly />
          </label>
          <label className="field">
            <span className="field__label">대량수집 URL (0.초기화 목적지)</span>
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
        {rows.length > 0 && (
          <div className="excel-preview" style={{ marginTop: '0.5rem', overflowX: 'auto' }}>
            <p className="panel__hint" style={{ marginBottom: '0.35rem' }}>
              엑셀 입력 필드값 확인 — 이 값이 그대로 망고 입력칸에 들어갑니다
            </p>
            <table className="data-table" style={{ fontSize: '0.8rem', width: '100%' }}>
              <thead>
                <tr>
                  <th>행</th>
                  <th>상위 최종 카테고리명 → 검색필터명</th>
                  <th>최종 카테고리 URL주소 → URL입력</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map(r => (
                  <tr key={r.rowIndex}>
                    <td>{r.rowIndex}</td>
                    <td>{r.topFinalLabel || '(비어있음)'}</td>
                    <td style={{ wordBreak: 'break-all' }}>{r.finalCategoryUrl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 8 && (
              <p className="panel__hint">… 외 {rows.length - 8}행</p>
            )}
          </div>
        )}
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
        <h2 className="panel__title">2. 실행 (메인 진입 후 0~4단계)</h2>
        <ol className="workflow-steps">
          {WORKFLOW_STEPS.map(s => (
            <li
              key={s.id}
              className={activeStep === s.id ? 'workflow-steps__item is-active' : 'workflow-steps__item'}
            >
              {s.label}
              {activeStep === s.id && <span className="workflow-steps__now"> ← 진행 중</span>}
            </li>
          ))}
        </ol>
        <div
          className="panel__footer panel__footer--compact"
          style={{ gap: '0.75rem', justifyContent: 'space-between' }}
        >
          <button
            type="button"
            className="btn btn--secondary"
            disabled={opening || running}
            onClick={() => void openBrowser()}
          >
            {opening ? '여는 중…' : '① 로그인→대량수집 자동'}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={running || !rows.length}
            onClick={() => void runCollect()}
          >
            {running ? '수집 중…' : '② 수집 시작'}
          </button>
        </div>
        {openMessage && <p className="panel__hint" style={{ marginTop: '0.5rem' }}>{openMessage}</p>}
      </section>

      {(running || logs.length > 0) && (
        <section className="panel panel--compact">
          <h2 className="panel__title">
            실행 로그 {running && <span className="badge badge--live">진행중</span>}
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
