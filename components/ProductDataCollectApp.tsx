'use client';

import { useCallback, useRef, useState } from 'react';
import { parseCategoryUrlExcel } from '@/lib/product-data-collect/excel-import';
import { WORKFLOW_STEPS, TMG_BULK_URL, TMG_LOGIN_URL } from '@/lib/product-data-collect/steps';
import type { TmgCollectRow, WorkflowStepLog } from '@/lib/product-data-collect/types';

const PROGRAM_TITLE = '상품데이터 대량수집';
const SITE_NAME = '더망고';

export function ProductDataCollectApp() {
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [saveCount, setSaveCount] = useState(3);
  const [rows, setRows] = useState<TmgCollectRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<WorkflowStepLog[]>([]);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

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
    try {
      const res = await fetch('/api/product-collect/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginId,
          loginPw,
          siteName: SITE_NAME,
          rows,
          saveCount,
          headless: false,
        }),
      });
      const data = await res.json();
      setLogs(data.logs ?? []);
      if (!data.ok) setError(data.message ?? '수집 실패');
    } catch (e) {
      setError(e instanceof Error ? e.message : '요청 실패');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="category-app program-unit">
      <p className="program-unit__breadcrumb">상품데이터수집 › {PROGRAM_TITLE}</p>
      <section className="panel panel--compact">
        <div className="panel__head">
          <h2 className="panel__title">1. 로그인 · 엑셀</h2>
        </div>
        <div className="form-grid form-grid--compact">
          <label className="field">
            <span className="field__label">사이트명</span>
            <input className="input" value={SITE_NAME} readOnly />
          </label>
          <label className="field">
            <span className="field__label">로그인 URL</span>
            <input className="input" value={TMG_LOGIN_URL} readOnly />
          </label>
          <label className="field">
            <span className="field__label">대량수집 URL</span>
            <input className="input" value={TMG_BULK_URL} readOnly />
          </label>
          <label className="field">
            <span className="field__label">로그인 ID</span>
            <input
              className="input"
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="field">
            <span className="field__label">로그인 PW</span>
            <input
              className="input"
              type="password"
              value={loginPw}
              onChange={e => setLoginPw(e.target.value)}
              autoComplete="current-password"
            />
          </label>
        </div>
        <div className="panel__head" style={{ marginTop: '0.5rem' }}>
          <label className="field">
            <span className="field__label">카테고리 URL 엑셀 (.xlsx)</span>
            <input
              ref={fileRef}
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
        <h2 className="panel__title">2. 작업 흐름 (스텝 by 스텝)</h2>
        <ol className="workflow-steps">
          {WORKFLOW_STEPS.map((s, i) => (
            <li key={s.id}>
              {i + 1}. {s.label}
            </li>
          ))}
          <li>{WORKFLOW_STEPS.length + 1}. 다음 엑셀 행으로 1번 반복 (전체 행)</li>
        </ol>
        <div className="panel__footer panel__footer--compact">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={running || !rows.length || !loginId || !loginPw}
            onClick={() => void runCollect()}
          >
            {running ? '수집 실행 중… (브라우저 확인)' : '3. 자동 수집 시작'}
          </button>
        </div>
      </section>

      {error && (
        <section className="notice notice--error">
          <p>{error}</p>
        </section>
      )}

      {logs.length > 0 && (
        <section className="panel panel--compact">
          <h2 className="panel__title">실행 로그</h2>
          <div className="log-box">
            {logs.map((l, i) => (
              <div key={i} className="log-line">
                <span className="log-time">{l.at.slice(11, 19)}</span>
                {l.rowIndex != null && <span className="log-row">#{l.rowIndex}</span>}
                <span>{l.label}</span>
                {l.message && <span className="log-msg"> — {l.message}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
