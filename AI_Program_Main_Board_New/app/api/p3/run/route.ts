import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { isPathInLibrary, loadLibrary, setLastSelected } from '@/lib/p3-excel-library';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function resolvePython(): string | null {
  for (const cmd of process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python']) {
    const args = cmd === 'py' ? ['-3', '--version'] : ['--version'];
    const r = spawnSync(cmd, args, { encoding: 'utf8' });
    if (!r.error && r.status === 0) return cmd === 'py' ? 'py -3' : cmd;
  }
  return null;
}

/**
 * POST { path } — 리스트박스에 있는 엑셀만 허용.
 * 로컬 PC에서 python-collector 를 새 창으로 실행.
 */
export async function POST(req: NextRequest) {
  if (process.env.VERCEL) {
    return NextResponse.json(
      {
        ok: false,
        message:
          'P3 수집은 로컬 PC에서만 실행됩니다.\nAI_Program_Main_Board_New 에서 run.bat 실행 후 사용하세요.',
      },
      { status: 400 },
    );
  }

  let body: { path?: string; saveCount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 본문이 필요합니다.' }, { status: 400 });
  }

  const excelPath = (body.path ?? '').trim();
  if (!excelPath) {
    return NextResponse.json({ ok: false, message: '리스트박스에서 엑셀을 선택하세요.' }, { status: 400 });
  }

  if (!isPathInLibrary(excelPath)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          '보관 목록(리스트박스)에 없는 파일입니다. 로컬 검색으로 추가한 뒤 목록에서만 선택하세요.',
      },
      { status: 400 },
    );
  }

  if (!existsSync(excelPath)) {
    return NextResponse.json({ ok: false, message: `파일 없음: ${excelPath}` }, { status: 404 });
  }

  const collectPy = join(process.cwd(), 'python-collector', 'collect.py');
  const runBat = join(process.cwd(), 'python-collector', 'run.bat');
  if (!existsSync(collectPy)) {
    return NextResponse.json({ ok: false, message: 'python-collector/collect.py 없음' }, { status: 500 });
  }

  setLastSelected(excelPath);
  const saveCount = Number(body.saveCount);
  const countArg =
    Number.isFinite(saveCount) && saveCount > 0 ? String(Math.floor(saveCount)) : undefined;

  try {
    if (process.platform === 'win32' && existsSync(runBat)) {
      const args = ['/c', 'start', 'P3_Python_Item_Collector', 'cmd', '/k', runBat, excelPath];
      spawn('cmd', args, {
        cwd: join(process.cwd(), 'python-collector'),
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      }).unref();
    } else {
      const py = resolvePython();
      if (!py) {
        return NextResponse.json({ ok: false, message: 'Python 없음' }, { status: 500 });
      }
      const pyParts = py.split(' ');
      const cmd = pyParts[0];
      const baseArgs = pyParts.slice(1);
      const args = [...baseArgs, collectPy, excelPath];
      if (countArg) args.push(countArg);
      spawn(cmd, args, {
        cwd: join(process.cwd(), 'python-collector'),
        detached: true,
        stdio: 'ignore',
      }).unref();
    }

    return NextResponse.json({
      ok: true,
      message: `수집 시작: ${excelPath}`,
      path: excelPath,
      lastSelected: loadLibrary().lastSelected,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : '실행 실패' },
      { status: 500 },
    );
  }
}
