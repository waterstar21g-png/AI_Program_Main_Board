'use client';

import { useCallback, useMemo, useState } from 'react';
import { downloadHierarchyExcel } from '@/lib/excel-export';
import { MAX_TOP_CATEGORIES } from '@/lib/types';
import type { CrawlResult, HierarchyRow } from '@/lib/types';

const DEFAULT_SITE = {
  siteName: 'ABC마트',
  siteUrl: 'https://abcmart.a-rt.com/?track=W0009',
};

const DEFAULT_TOP_CATEGORIES = ['MEN', 'WOMEN', 'KIDS'];

function newTopId(): string {
  return `top-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeTopRows(values: string[]): { id: string; value: string }[] {
  const rows = values.map(v => ({ id: newTopId(), value: v }));
  if (!rows.length) rows.push({ id: newTopId(), value: '' });
  return rows;
}

export function CategoryExtractorApp() {
  const [siteName, setSiteName] = useState(DEFAULT_SITE.siteName);
  const [siteUrl, setSiteUrl] = useState(DEFAULT_SITE.siteUrl);
  const [topRows, setTopRows] = useState(() => makeTopRows(DEFAULT_TOP_CATEGORIES));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [error, setError] = useState('');

  const filledTopCount = useMemo(
    () => topRows.filter(r => r.value.trim()).length,
    [topRows],
  );

  const updateTop = useCallback((id: string, value: string) => {
    setTopRows(prev => prev.map(r => (r.id === id ? { ...r, value } : r)));
  }, []);

  const addTopRow = () => {
    if (topRows.length >= MAX_TOP_CATEGORIES) return;
    setTopRows(prev => [...prev, { id: newTopId(), value: '' }]);
  };

  const removeTopRow = (id: string) => {
    setTopRows(prev => (prev.length <= 1 ? prev : prev.filter(r => r.id !== id)));
  };

  const loadAbcDefaults = () => {
    setSiteName(DEFAULT_SITE.siteName);
    setSiteUrl(DEFAULT_SITE.siteUrl);
    setTopRows(makeTopRows(DEFAULT_TOP_CATEGORIES));
  };

  const runCrawl = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    const topCategories = topRows.map(r => r.value.trim()).filter(Boolean);
    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName: siteName.trim(),
          siteUrl: siteUrl.trim(),
          topCategories,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message ?? '수집 실패');
      setResult(data as CrawlResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : '수집 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result?.rows.length) return;
    downloadHierarchyExcel(result.rows, siteName.trim() || '사이트');
  };

  const rows: HierarchyRow[] = result?.rows ?? [];
  const canSubmit = siteName.trim() && siteUrl.trim() && filledTopCount > 0;

  return (
    <div className="app">
      <header className="app__header">
        <p className="app__eyebrow">웹 · 계층 카테고리 · 엑셀 저장</p>
        <h1 className="app__title">카테고리별 상품목록 URL LIST 추출</h1>
        <p className="app__desc">
          사이트명·URL과 <strong>상위 카테고리</strong>를 지정하면, 해당 상위만 골라 중위→하위→최종
          카테고리와 <strong>최종 카테고리 클릭 URL</strong>을 엑셀로 저장합니다.
        </p>
      </header>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">1. 사이트 입력</h2>
          <button type="button" className="btn btn--ghost" onClick={loadAbcDefaults}>
            ABC마트 기본값
          </button>
        </div>
        <div className="form-grid">
          <label className="field">
            <span className="field__label">사이트명</span>
            <input
              className="input"
              value={siteName}
              onChange={e => setSiteName(e.target.value)}
              placeholder="예: ABC마트"
            />
          </label>
          <label className="field field--wide">
            <span className="field__label">사이트 URL</span>
            <input
              className="input"
              value={siteUrl}
              onChange={e => setSiteUrl(e.target.value)}
              placeholder="https://abcmart.a-rt.com/?track=W0009"
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">
            상위 카테고리 지정 <span className="badge">{filledTopCount}/{MAX_TOP_CATEGORIES}</span>
          </h2>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={addTopRow}
            disabled={topRows.length >= MAX_TOP_CATEGORIES}
          >
            + 항목 추가
          </button>
        </div>
        <p className="panel__hint">
          입력한 상위만 추출됩니다. ABC마트 예: MEN, WOMEN, KIDS
        </p>
        <ul className="top-list">
          {topRows.map((row, idx) => (
            <li key={row.id} className="top-list__item">
              <span className="top-list__num">{idx + 1}</span>
              <input
                className="input"
                value={row.value}
                onChange={e => updateTop(row.id, e.target.value)}
                placeholder="예: MEN"
              />
              <button
                type="button"
                className="btn btn--icon"
                onClick={() => removeTopRow(row.id)}
                disabled={topRows.length <= 1}
                aria-label="삭제"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="panel__footer">
          <button
            type="button"
            className="btn btn--primary"
            disabled={loading || !canSubmit}
            onClick={runCrawl}
          >
            {loading ? '수집 중…' : '2. 카테고리 수집 시작'}
          </button>
        </div>
      </section>

      {error && (
        <section className="notice notice--error">
          <p>{error}</p>
        </section>
      )}

      {result && (
        <>
          <section className="summary">
            <p>
              <strong>{result.platform}</strong> · 상위 [{result.appliedTopCategories.join(', ')}] ·
              카테고리 {result.totalCategories}건
            </p>
            {result.warnings.map((w, i) => (
              <p key={i} className="summary__warn">
                {w}
              </p>
            ))}
          </section>

          <section className="panel">
            <div className="panel__head">
              <h2>계층화된 카테고리표 ({rows.length}행)</h2>
              <button type="button" className="btn btn--primary" onClick={handleDownload}>
                엑셀 로컬 저장 (.xlsx)
              </button>
            </div>
            <p className="panel__hint">
              엑셀 양식: 상위 · 중위 · 하위 · 최종 · 상위+최종 · 최종 카테고리 URL
            </p>
            <div className="table-wrap">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>상위</th>
                    <th>중위</th>
                    <th>하위</th>
                    <th>최종</th>
                    <th>상위+최종</th>
                    <th>최종 카테고리 URL</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 150).map((r, i) => (
                    <tr key={i}>
                      <td>{r.top}</td>
                      <td>{r.mid || '—'}</td>
                      <td>{r.low || '—'}</td>
                      <td>{r.final}</td>
                      <td>{r.topFinalLabel}</td>
                      <td className="url-cell">
                        <a href={r.finalCategoryUrl} target="_blank" rel="noreferrer">
                          {r.finalCategoryUrl}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 150 && (
                <p className="more">… 외 {rows.length - 150}행 (엑셀에 전체 포함)</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
