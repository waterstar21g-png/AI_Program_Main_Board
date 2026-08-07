import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as XLSX from 'xlsx';
import { crawlSite } from '@/lib/site-crawler';
import { WORKFLOW_STEPS, TMG_MAIN_URL } from '@/lib/product-data-collect/steps';
import {
  CATEGORY_EXCEL_HEADERS,
  EXCEL_COL_FINAL_URL,
  EXCEL_COL_TOP_FINAL_LABEL,
} from '@/lib/excel-export';

export type SmokeStatus = 'pass' | 'fail' | 'warn';

export type SmokeCheck = {
  name: string;
  status: SmokeStatus;
  detail: string;
};

export type SmokeProjectResult = {
  id: 'p1' | 'p2' | 'p3';
  name: string;
  ok: boolean;
  checks: SmokeCheck[];
};

export type SmokeRunResult = {
  ok: boolean;
  at: string;
  order: string[];
  results: SmokeProjectResult[];
};

function check(name: string, status: SmokeStatus, detail: string): SmokeCheck {
  return { name, status, detail };
}

/** P1: 실행(수집) → 데이터 검증 */
async function smokeP1(): Promise<SmokeProjectResult> {
  const checks: SmokeCheck[] = [];
  const name = 'P1 · 카테고리 URL 추출';

  try {
    checks.push(check('1) 실행', 'pass', 'ABC마트 · 상위 MEN 카테고리 수집 시작'));
    const result = await crawlSite({
      siteName: 'ABC마트',
      siteUrl: 'https://abcmart.a-rt.com/?track=W0009',
      topCategories: ['MEN'],
    });

    if (!result.ok) {
      checks.push(check('2) 수집 결과', 'fail', result.errors[0] ?? '수집 실패'));
      return { id: 'p1', name, ok: false, checks };
    }

    const rows = result.rows ?? [];
    checks.push(
      check(
        '2) 수집 결과',
        rows.length > 0 ? 'pass' : 'fail',
        rows.length > 0 ? `${rows.length}행 수집` : '행 0개',
      ),
    );

    const withUrl = rows.filter(r => /^https?:\/\//i.test(r.finalCategoryUrl || ''));
    const withLabel = rows.filter(r => (r.topFinalLabel || '').trim().length > 0);
    const urlOk = withUrl.length === rows.length && rows.length > 0;
    const labelOk = withLabel.length === rows.length && rows.length > 0;

    checks.push(
      check(
        '3) 데이터 검증 · URL',
        urlOk ? 'pass' : 'fail',
        `http(s) URL ${withUrl.length}/${rows.length}`,
      ),
    );
    checks.push(
      check(
        '3) 데이터 검증 · 상위최종라벨',
        labelOk ? 'pass' : 'fail',
        `라벨 ${withLabel.length}/${rows.length}`,
      ),
    );

    const sample = rows[0];
    if (sample) {
      checks.push(
        check(
          '3) 데이터 검증 · 샘플',
          'pass',
          `${sample.topFinalLabel} → ${sample.finalCategoryUrl.slice(0, 80)}`,
        ),
      );
    }
  } catch (e) {
    checks.push(
      check('실행·검증', 'fail', e instanceof Error ? e.message : '알 수 없는 오류'),
    );
  }

  return {
    id: 'p1',
    name,
    ok: checks.every(c => c.status !== 'fail'),
    checks,
  };
}

/** P2: 실행(파서·모듈) → 샘플 엑셀 데이터 검증 */
async function smokeP2(): Promise<SmokeProjectResult> {
  const checks: SmokeCheck[] = [];
  const name = 'P2 · 상품 대량수집';

  try {
    checks.push(check('1) 실행', 'pass', '엑셀 파서·워크플로·Playwright 점검'));

    const { parseCategoryUrlExcel } = await import(
      '@/lib/product-data-collect/excel-import'
    );

    // 샘플 엑셀 생성 → 파싱 → 필드 검증 (데이터 검증 순서)
    const aoa = [
      [...CATEGORY_EXCEL_HEADERS],
      ['MEN', '신발', '스니커즈', '운동화', 'MEN 운동화', 'https://example.com/cat/1'],
      ['WOMEN', '가방', '토트', '토트백', 'WOMEN 토트백', 'https://example.com/cat/2'],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, '카테고리표');
    const nodeBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const copy = new Uint8Array(nodeBuf.byteLength);
    copy.set(nodeBuf);
    const parsed = parseCategoryUrlExcel(copy.buffer);

    checks.push(
      check(
        '2) 엑셀 파싱',
        parsed.length === 2 ? 'pass' : 'fail',
        `샘플 2행 → 파싱 ${parsed.length}행 · 열: ${EXCEL_COL_TOP_FINAL_LABEL} / ${EXCEL_COL_FINAL_URL}`,
      ),
    );

    const labelsOk = parsed.every(r => r.topFinalLabel && !/^https?:/i.test(r.topFinalLabel));
    const urlsOk = parsed.every(r => /^https?:\/\//i.test(r.finalCategoryUrl));
    checks.push(
      check(
        '3) 데이터 검증 · 필드',
        labelsOk && urlsOk ? 'pass' : 'fail',
        labelsOk && urlsOk
          ? `라벨/URL 분리 OK — 예: ${parsed[0]?.topFinalLabel}`
          : '라벨·URL 필드 검증 실패',
      ),
    );

    checks.push(
      check(
        '2) 워크플로',
        WORKFLOW_STEPS.length >= 5 ? 'pass' : 'fail',
        `${WORKFLOW_STEPS.length}단계 · ${TMG_MAIN_URL}`,
      ),
    );

    if (process.env.VERCEL) {
      checks.push(
        check('4) 브라우저 수집', 'warn', 'Vercel 불가 — 로컬에서 ①→② 버튼으로 실행'),
      );
    } else {
      try {
        await import('playwright');
        checks.push(check('2) Playwright', 'pass', 'playwright 로드 OK'));
      } catch (e) {
        checks.push(
          check('2) Playwright', 'fail', e instanceof Error ? e.message : '없음'),
        );
      }
      checks.push(
        check(
          '4) 실제 더망고 수집',
          'warn',
          '보드 P2에서 엑셀 업로드 후 ① 로그인→대량수집 → ② 수집 시작',
        ),
      );
    }
  } catch (e) {
    checks.push(
      check('실행·검증', 'fail', e instanceof Error ? e.message : '모듈 로드 실패'),
    );
  }

  return {
    id: 'p2',
    name,
    ok: checks.every(c => c.status !== 'fail'),
    checks,
  };
}

function resolvePython(): string {
  for (const cmd of ['python3', 'python', 'py']) {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
    if (!r.error && r.status === 0) return cmd;
  }
  return 'python3';
}

function runPython(code: string): { ok: boolean; out: string } {
  const py = resolvePython();
  const r = spawnSync(py, ['-c', code], { encoding: 'utf8', timeout: 20000 });
  if (r.error) return { ok: false, out: r.error.message };
  if (r.status !== 0) return { ok: false, out: (r.stderr || r.stdout || '').trim() };
  return { ok: true, out: (r.stdout || '').trim() };
}

/** P3: 실행(환경·구문) → 데이터 검증(샘플 엑셀 읽기) */
async function smokeP3(): Promise<SmokeProjectResult> {
  const checks: SmokeCheck[] = [];
  const name = 'P3 · 파이썬 독립수집';
  const root = join(process.cwd(), 'python-collector');
  const collectPy = join(root, 'collect.py');

  checks.push(check('1) 실행', 'pass', 'python-collector 환경·구문·샘플엑셀 점검'));

  for (const f of ['collect.py', 'run.bat', 'requirements.txt', 'README.md']) {
    const p = join(root, f);
    checks.push(check(`2) 파일 ${f}`, existsSync(p) ? 'pass' : 'fail', p));
  }

  const pyCmd = resolvePython();
  const py = runPython('import sys; print(sys.version.split()[0])');
  checks.push(
    check(
      '2) Python',
      py.ok ? 'pass' : 'fail',
      py.ok ? `${pyCmd} ${py.out}` : py.out || 'Python 없음',
    ),
  );

  if (py.ok && existsSync(collectPy)) {
    const compile = spawnSync(pyCmd, ['-m', 'py_compile', collectPy], {
      encoding: 'utf8',
      timeout: 20000,
    });
    checks.push(
      check(
        '2) collect.py 구문',
        compile.status === 0 ? 'pass' : 'fail',
        compile.status === 0
          ? 'py_compile OK'
          : (compile.stderr || compile.stdout || 'compile 실패').trim().slice(0, 200),
      ),
    );

    const openpyxl = runPython('import openpyxl; print(openpyxl.__version__)');
    checks.push(
      check(
        '2) openpyxl',
        openpyxl.ok ? 'pass' : 'warn',
        openpyxl.ok
          ? `openpyxl ${openpyxl.out}`
          : '미설치 — pip install -r python-collector/requirements.txt',
      ),
    );

    // 샘플 엑셀을 만들어 openpyxl로 읽어 데이터 검증
    if (openpyxl.ok) {
      const samplePath = join(root, '_smoke_sample.xlsx');
      try {
        const aoa = [
          [EXCEL_COL_TOP_FINAL_LABEL, EXCEL_COL_FINAL_URL],
          ['MEN 운동화', 'https://example.com/p3/1'],
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Sheet1');
        writeFileSync(samplePath, Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })));

        const readCode = `
import openpyxl
wb = openpyxl.load_workbook(r"${samplePath.replace(/\\/g, '/')}")
ws = wb.active
rows = list(ws.iter_rows(values_only=True))
assert rows[0][0] and rows[0][1]
assert rows[1][0] == "MEN 운동화"
assert str(rows[1][1]).startswith("http")
print(f"{len(rows)-1}")
`;
        const read = runPython(readCode);
        checks.push(
          check(
            '3) 데이터 검증 · 샘플엑셀',
            read.ok ? 'pass' : 'fail',
            read.ok ? `openpyxl ${read.out}행 읽기 OK` : read.out.slice(0, 200),
          ),
        );
      } finally {
        try {
          unlinkSync(samplePath);
        } catch {
          /* ignore */
        }
      }
    }

    const pw = runPython('import playwright; print("ok")');
    checks.push(
      check(
        '2) playwright(python)',
        pw.ok ? 'pass' : 'warn',
        pw.ok ? 'import OK' : '미설치 — pip install -r python-collector/requirements.txt',
      ),
    );
  }

  checks.push(
    check(
      '4) 실제 더망고 수집',
      'warn',
      '로컬: python-collector/run.bat 에 엑셀 드래그 (보드 버튼③ 환경검증 후)',
    ),
  );

  return {
    id: 'p3',
    name,
    ok: checks.every(c => c.status !== 'fail'),
    checks,
  };
}

export type SmokeTarget = 'p1' | 'p2' | 'p3' | 'all';

/**
 * 개별점검 묶음용 목록 — 연쇄 파이프라인 아님.
 * 각 항목은 서로 독립적으로 실행·검증한다.
 */
export const INDEPENDENT_PROJECTS: SmokeTarget[] = ['p1', 'p2', 'p3'];

export async function runProjectSmoke(target: SmokeTarget = 'all'): Promise<SmokeRunResult> {
  const results: SmokeProjectResult[] = [];
  const order: string[] = [];

  if (target === 'all') {
    // 각각 독립 실행 후 결과만 모음 (P1 결과가 P2 입력이 되지 않음)
    for (const id of INDEPENDENT_PROJECTS) {
      order.push(id);
      if (id === 'p1') results.push(await smokeP1());
      if (id === 'p2') results.push(await smokeP2());
      if (id === 'p3') results.push(await smokeP3());
    }
  } else {
    order.push(target);
    if (target === 'p1') results.push(await smokeP1());
    if (target === 'p2') results.push(await smokeP2());
    if (target === 'p3') results.push(await smokeP3());
  }

  return {
    ok: results.every(r => r.ok),
    at: new Date().toISOString(),
    order,
    results,
  };
}
