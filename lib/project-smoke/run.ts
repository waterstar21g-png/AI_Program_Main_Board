import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { crawlSite } from '@/lib/site-crawler';
import { WORKFLOW_STEPS, TMG_MAIN_URL } from '@/lib/product-data-collect/steps';
import { CATEGORY_EXCEL_HEADERS } from '@/lib/excel-export';

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
  results: SmokeProjectResult[];
};

function check(name: string, status: SmokeStatus, detail: string): SmokeCheck {
  return { name, status, detail };
}

async function smokeP1(): Promise<SmokeProjectResult> {
  const checks: SmokeCheck[] = [];
  const name = 'P1_Category_Url_Extract';

  try {
    const result = await crawlSite({
      siteName: 'ABC마트',
      siteUrl: 'https://abcmart.a-rt.com/?track=W0009',
      topCategories: ['MEN'],
    });
    if (!result.ok) {
      checks.push(
        check('카테고리 수집(API)', 'fail', result.errors[0] ?? '수집 실패'),
      );
    } else {
      const rows = result.rows?.length ?? 0;
      checks.push(
        check(
          '카테고리 수집(API)',
          rows > 0 ? 'pass' : 'fail',
          rows > 0
            ? `MEN 상위 기준 ${rows}행 수집 성공`
            : '수집은 됐지만 행이 0개입니다',
        ),
      );
    }
  } catch (e) {
    checks.push(
      check(
        '카테고리 수집(API)',
        'fail',
        e instanceof Error ? e.message : '알 수 없는 오류',
      ),
    );
  }

  return {
    id: 'p1',
    name,
    ok: checks.every(c => c.status !== 'fail'),
    checks,
  };
}

async function smokeP2(): Promise<SmokeProjectResult> {
  const checks: SmokeCheck[] = [];
  const name = 'P2_Product_Capture_App';

  try {
    const { parseCategoryUrlExcel } = await import(
      '@/lib/product-data-collect/excel-import'
    );
    checks.push(
      check(
        '엑셀 파서 모듈',
        typeof parseCategoryUrlExcel === 'function' ? 'pass' : 'fail',
        `헤더: ${CATEGORY_EXCEL_HEADERS.join(' | ')}`,
      ),
    );
  } catch (e) {
    checks.push(
      check(
        '엑셀 파서 모듈',
        'fail',
        e instanceof Error ? e.message : '모듈 로드 실패',
      ),
    );
  }

  checks.push(
    check(
      '워크플로 스텝',
      WORKFLOW_STEPS.length >= 5 ? 'pass' : 'fail',
      `${WORKFLOW_STEPS.length}단계 · 메인: ${TMG_MAIN_URL}`,
    ),
  );

  if (process.env.VERCEL) {
    checks.push(
      check(
        '브라우저 자동화',
        'warn',
        'Vercel에서는 불가 — 로컬 PC에서 ①/② 버튼으로 테스트하세요',
      ),
    );
  } else {
    try {
      await import('playwright');
      checks.push(
        check('Playwright 패키지', 'pass', 'playwright 로드 OK (CDP 연결용)'),
      );
    } catch (e) {
      checks.push(
        check(
          'Playwright 패키지',
          'fail',
          e instanceof Error ? e.message : 'playwright 없음',
        ),
      );
    }
    checks.push(
      check(
        '실제 수집 실행',
        'warn',
        'Chrome/Edge + 더망고 로그인이 필요 — 보드에서 ①→②로 수동 확인',
      ),
    );
  }

  return {
    id: 'p2',
    name,
    ok: checks.every(c => c.status !== 'fail'),
    checks,
  };
}

function runPython(code: string): { ok: boolean; out: string } {
  const r = spawnSync('python3', ['-c', code], {
    encoding: 'utf8',
    timeout: 15000,
  });
  if (r.error) return { ok: false, out: r.error.message };
  if (r.status !== 0) return { ok: false, out: (r.stderr || r.stdout || '').trim() };
  return { ok: true, out: (r.stdout || '').trim() };
}

async function smokeP3(): Promise<SmokeProjectResult> {
  const checks: SmokeCheck[] = [];
  const name = 'P3_Python_Item_Collector';
  const root = join(process.cwd(), 'python-collector');

  const needed = ['collect.py', 'run.bat', 'requirements.txt', 'README.md'];
  for (const f of needed) {
    const p = join(root, f);
    checks.push(
      check(`파일 ${f}`, existsSync(p) ? 'pass' : 'fail', p),
    );
  }

  const py = runPython('import sys; print(sys.version.split()[0])');
  checks.push(
    check(
      'Python3',
      py.ok ? 'pass' : 'fail',
      py.ok ? `python3 ${py.out}` : py.out || 'python3 없음',
    ),
  );

  if (py.ok) {
    const openpyxl = runPython('import openpyxl; print(openpyxl.__version__)');
    checks.push(
      check(
        'openpyxl',
        openpyxl.ok ? 'pass' : 'warn',
        openpyxl.ok
          ? `openpyxl ${openpyxl.out}`
          : '미설치 — python-collector에서 pip install -r requirements.txt',
      ),
    );
    const pw = runPython('import playwright; print("ok")');
    checks.push(
      check(
        'playwright(python)',
        pw.ok ? 'pass' : 'warn',
        pw.ok
          ? 'playwright import OK'
          : '미설치 — python-collector에서 pip install -r requirements.txt',
      ),
    );
  }

  checks.push(
    check(
      '실제 수집 실행',
      'warn',
      '로컬에서 python-collector/run.bat 에 엑셀을 드래그해 확인',
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

export async function runProjectSmoke(target: SmokeTarget = 'all'): Promise<SmokeRunResult> {
  const results: SmokeProjectResult[] = [];
  if (target === 'all' || target === 'p1') results.push(await smokeP1());
  if (target === 'all' || target === 'p2') results.push(await smokeP2());
  if (target === 'all' || target === 'p3') results.push(await smokeP3());
  return {
    ok: results.every(r => r.ok),
    at: new Date().toISOString(),
    results,
  };
}
