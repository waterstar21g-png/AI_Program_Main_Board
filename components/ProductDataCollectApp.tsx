'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseCategoryUrlExcel } from '@/lib/product-data-collect/excel-import';
import { WORKFLOW_STEPS, TMG_BULK_URL, TMG_LOGIN_URL } from '@/lib/product-data-collect/steps';
import type { TmgCollectRow, WorkflowStepId, WorkflowStepLog } from '@/lib/product-data-collect/types';

const SITE_NAME = '더망고';
const LS_ID = 'tmg-login-id';
const LS_PW = 'tmg-login-pw';

export function ProductDataCollectApp() {
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [rememberLogin, setRememberLogin] = useState(true);
  const [saveCount, setSaveCount] = useState(3);
  const [rows, setRows] = useState<TmgCollectRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<WorkflowStepLog[]>([]);
  const [activeStep, setActiveStep] = useState<WorkflowStepId | null>(null);
  const [error, setError] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const id = localStorage.getItem(LS_ID);
      const pw = localStorage.getItem(LS_PW);
      if (id) setLoginId(id);
      if (pw) setLoginPw(pw);
    } catch {
      /* private mode 등 */
    }
  }, []);

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
    if (/^https?:\/\//i.test(loginId.trim())) {
      setError('로그인 ID에 URL이 들어가 있습니다. 더망고 아이디를 입력하세요.');
      return;
    }
    setRunning(true);
    setError('');
    setLogs([]);
    setActiveStep(null);
    if (rememberLogin) {
      try {
        localStorage.setItem(LS_ID, loginId.trim());
        localStorage.setItem(LS_PW, loginPw);
      } catch {
        /* ignore */
      }
    }
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
          <h2 className="panel__title">1. 로그인 · 엑셀</h2>
          <p className="panel__hint">
            <strong>여기서만</strong> ID/PW 입력 → 망고 Chromium 창에는 <strong>자동 입력</strong>됩니다. 망고 창에 직접 치지 마세요.
          </p>
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
              autoComplete="off"
              placeholder="더망고 아이디 (URL 아님)"
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
          <label className="field field--inline">
            <input
              type="checkbox"
              checked={rememberLogin}
              onChange={e => setRememberLogin(e.target.checked)}
            />
            <span className="field__label">로그인 정보 이 PC에 기억</span>
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
        <h2 className="panel__title">2. 작업 흐름 — Chromium 창에서 단계별 확인</h2>
        <p className="panel__hint">
          실행 시 더망고 Chromium 창이 열립니다. 작업·오류 확인 후 <strong>창을 직접 닫으세요</strong> (자동으로 안 닫힘).
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
            disabled={running || !rows.length || !loginId || !loginPw}
            onClick={() => void runCollect()}
          >
            {running ? '수집 실행 중… (Chromium + 아래 로그)' : '3. 자동 수집 시작'}
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
