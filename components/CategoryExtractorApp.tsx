'use client';

import { useCallback, useMemo, useState } from 'react';
import { DEFAULT_CATEGORIES, parseCatId, resolveCategoryUrl } from '@/lib/category-url';
import { downloadExcel } from '@/lib/excel-export';
import type { CategoryInput, ExtractResult, ProductUrlRow } from '@/lib/types';

function newId(): string {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyRow(): CategoryInput {
  return { id: newId(), name: '', catId: '', listUrl: '', count: 20 };
}

export function CategoryExtractorApp() {
  const [categories, setCategories] = useState<CategoryInput[]>([emptyRow()]);
  const [rows, setRows] = useState<ProductUrlRow[]>([]);
  const [errors, setErrors] = useState<ExtractResult['errors']>([]);
  const [usedNaverApi, setUsedNaverApi] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const validCount = useMemo(() => categories.filter(c => c.name.trim()).length, [categories]);

  const updateRow = useCallback((id: string, patch: Partial<CategoryInput>) => {
    setCategories(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const addRow = () => setCategories(prev => [...prev, emptyRow()]);

  const removeRow = (id: string) => {
    setCategories(prev => (prev.length <= 1 ? prev : prev.filter(c => c.id !== id)));
  };

  const loadDefaults = () => {
    setCategories(
      DEFAULT_CATEGORIES.map(d => ({
        id: newId(),
        name: d.name,
        catId: d.catId,
        listUrl: '',
        count: 20,
      })),
    );
  };

  const applyBulk = () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    if (!lines.length) return;

    const parsed: CategoryInput[] = lines.map(line => {
      const parts = line.split(/[\t,|]/).map(p => p.trim());
      const name = parts[0] ?? '';
      const second = parts[1] ?? '';
      const count = Number(parts[2]) || 20;
      const catId = parseCatId(second) ?? (/^\d+$/.test(second) ? second : '');
      const listUrl = catId ? '' : second;
      return { id: newId(), name, catId, listUrl, count };
    });

    setCategories(parsed);
  };

  const runExtract = async () => {
    setLoading(true);
    setErrors([]);
    try {
      const payload = categories.filter(c => c.name.trim());
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: payload }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message ?? '추출 실패');
      setRows(data.rows ?? []);
      setErrors(data.errors ?? []);
      setUsedNaverApi(data.usedNaverApi ?? false);
    } catch (e) {
      setErrors([{ category: '-', message: e instanceof Error ? e.message : '추출 실패' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!rows.length) return;
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    downloadExcel(rows, `카테고리별_상품URL_LIST_${stamp}.xlsx`);
  };

  return (
    <div className="app">
      <header className="app__header">
        <p className="app__eyebrow">웹 · 엑셀보내기</p>
        <h1 className="app__title">카테고리별 상품목록 URL LIST 추출</h1>
        <p className="app__desc">
          카테고리명·catId(또는 목록 URL)를 입력하면 카테고리 대표 URL과 상품 URL을 모아 엑셀 파일로
          저장합니다. 네이버 검색 API 키가 있으면 카테고리별 상품 URL까지 추출합니다.
        </p>
      </header>

      <section className="panel">
        <div className="panel__head">
          <h2>카테고리 입력</h2>
          <div className="panel__actions">
            <button type="button" className="btn btn--ghost" onClick={loadDefaults}>
              대분류 10개 불러오기
            </button>
            <button type="button" className="btn btn--ghost" onClick={addRow}>
              + 행 추가
            </button>
          </div>
        </div>

        <div className="bulk">
          <label className="bulk__label" htmlFor="bulk-input">
            일괄 붙여넣기 (한 줄: <code>카테고리명, catId 또는 URL, 추출개수</code>)
          </label>
          <textarea
            id="bulk-input"
            className="bulk__input"
            rows={3}
            placeholder={'식품, 50000006, 30\n화장품/미용, https://search.shopping.naver.com/search/category?catId=50000002'}
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
          />
          <button type="button" className="btn btn--ghost" onClick={applyBulk}>
            일괄 적용
          </button>
        </div>

        <div className="table-wrap">
          <table className="cat-table">
            <thead>
              <tr>
                <th>카테고리명</th>
                <th>catId</th>
                <th>목록 URL (선택)</th>
                <th>추출 수</th>
                <th>대표 URL 미리보기</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <tr key={cat.id}>
                  <td>
                    <input
                      className="input"
                      value={cat.name}
                      placeholder="예: 식품"
                      onChange={e => updateRow(cat.id, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="input input--sm"
                      value={cat.catId ?? ''}
                      placeholder="50000006"
                      onChange={e => updateRow(cat.id, { catId: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      value={cat.listUrl ?? ''}
                      placeholder="catId 없을 때 URL"
                      onChange={e => updateRow(cat.id, { listUrl: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="input input--xs"
                      type="number"
                      min={1}
                      max={100}
                      value={cat.count}
                      onChange={e => updateRow(cat.id, { count: Number(e.target.value) || 20 })}
                    />
                  </td>
                  <td className="preview-url">
                    {cat.name.trim()
                      ? resolveCategoryUrl(cat.name, cat.catId, cat.listUrl)
                      : '—'}
                  </td>
                  <td>
                    <button type="button" className="btn btn--icon" onClick={() => removeRow(cat.id)} aria-label="삭제">
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel__footer">
          <button type="button" className="btn btn--primary" disabled={loading || validCount === 0} onClick={runExtract}>
            {loading ? '추출 중…' : `URL 추출 실행 (${validCount}개 카테고리)`}
          </button>
        </div>
      </section>

      {(errors.length > 0 || usedNaverApi === false) && (
        <section className="notice notice--warn">
          {usedNaverApi === false && (
            <p>
              <strong>네이버 API 키 미설정:</strong> 카테고리 대표 URL만 엑셀에 포함됩니다.{' '}
              <code>.env.local</code>에 <code>NAVER_CLIENT_ID</code>, <code>NAVER_CLIENT_SECRET</code>을 설정하세요.
            </p>
          )}
          {errors.map((err, i) => (
            <p key={i}>
              <strong>{err.category}:</strong> {err.message}
            </p>
          ))}
        </section>
      )}

      {rows.length > 0 && (
        <section className="panel">
          <div className="panel__head">
            <h2>추출 결과 ({rows.length}건)</h2>
            <button type="button" className="btn btn--primary" onClick={handleDownload}>
              엑셀 다운로드 (.xlsx)
            </button>
          </div>
          <div className="table-wrap table-wrap--result">
            <table className="result-table">
              <thead>
                <tr>
                  <th>카테고리</th>
                  <th>순번</th>
                  <th>상품명</th>
                  <th>상품 URL</th>
                  <th>가격</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={`${r.category}-${r.rank}-${i}`}>
                    <td>{r.category}</td>
                    <td>{r.rank || '—'}</td>
                    <td className="ellipsis" title={r.title}>
                      {r.title}
                    </td>
                    <td className="ellipsis">
                      <a href={r.productUrl} target="_blank" rel="noreferrer">
                        {r.productUrl}
                      </a>
                    </td>
                    <td>{r.price > 0 ? r.price.toLocaleString('ko-KR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 200 && <p className="more">… 외 {rows.length - 200}건 (엑셀에 전체 포함)</p>}
          </div>
        </section>
      )}
    </div>
  );
}
