import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as XLSX from 'xlsx';
import { crawlSite } from '@/lib/site-crawler';
import { EXCEL_COL_FINAL_URL, EXCEL_COL_TOP_FINAL_LABEL } from '@/lib/excel-export';

export type SmokeStatus = 'pass' | 'fail' | 'warn';

export type SmokeCheck = {
  name: string;
  status: SmokeStatus;
  detail: string;
};

export type SmokeProjectResult = {
  id: 'p1' | 'p3';
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
  const name = 'P1_Category_Url_Extract';

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

    checks.push(
      check(
        '3) 데이터 검증 · URL',
        withUrl.length === rows.length && rows.length > 0 ? 'pass' : 'fail',
        `http(s) URL ${withUrl.length}/${rows.length}`,
      ),
    );
    checks.push(
      check(
        '3) 데이터 검증 · 상위최종라벨',
        withLabel.length === rows.length && rows.length > 0 ? 'pass' : 'fail',
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

/** P3: 실행(환경·구문) → 데이터 검증 */
async function smokeP3(): Promise<SmokeProjectResult> {
  const checks: SmokeCheck[] = [];
  const name = 'P3_Python_Item_Collector';
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
          ? '구문 검사 통과'
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
            read.ok ? `openpyxl ${read.out}행 읽기 완료` : read.out.slice(0, 200),
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
        pw.ok ? '모듈 로드 완료' : '미설치 — pip install -r python-collector/requirements.txt',
      ),
    );
  }

  checks.push(
    check(
      '4) 실제 더망고 수집',
      'warn',
      '로컬: python-collector/run.bat 에 엑셀 드래그',
    ),
  );

  return {
    id: 'p3',
    name,
    ok: checks.every(c => c.status !== 'fail'),
    checks,
  };
}

export type SmokeTarget = 'p1' | 'p3' | 'all';

export const INDEPENDENT_PROJECTS: SmokeTarget[] = ['p1', 'p3'];

export async function runProjectSmoke(target: SmokeTarget = 'all'): Promise<SmokeRunResult> {
  const results: SmokeProjectResult[] = [];
  const order: string[] = [];

  if (target === 'all') {
    for (const id of INDEPENDENT_PROJECTS) {
      order.push(id);
      if (id === 'p1') results.push(await smokeP1());
      if (id === 'p3') results.push(await smokeP3());
    }
  } else {
    order.push(target);
    if (target === 'p1') results.push(await smokeP1());
    if (target === 'p3') results.push(await smokeP3());
  }

  return {
    ok: results.every(r => r.ok),
    at: new Date().toISOString(),
    order,
    results,
  };
}
