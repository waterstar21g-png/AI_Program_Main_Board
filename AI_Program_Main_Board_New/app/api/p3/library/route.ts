import { NextRequest, NextResponse } from 'next/server';
import {
  addPathsToLibrary,
  annotateLibrary,
  defaultBrowseRoots,
  loadLibrary,
  removePathFromLibrary,
  setLastSelected,
} from '@/lib/p3-excel-library';

export const dynamic = 'force-dynamic';

/** GET — 보관 목록(리스트박스) + 기본 검색 폴더 */
export async function GET() {
  const { library, items } = annotateLibrary(loadLibrary());
  return NextResponse.json({
    ok: true,
    items,
    lastSelected: library.lastSelected ?? items[0]?.path ?? '',
    roots: defaultBrowseRoots(),
  });
}

/**
 * POST actions:
 * - add: { action: 'add', paths: string[] }
 * - remove: { action: 'remove', path: string }
 * - select: { action: 'select', path: string }
 */
export async function POST(req: NextRequest) {
  let body: { action?: string; paths?: string[]; path?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON 본문이 필요합니다.' }, { status: 400 });
  }

  const action = (body.action ?? '').trim();

  if (action === 'add') {
    const paths = Array.isArray(body.paths) ? body.paths.map(String) : [];
    if (!paths.length) {
      return NextResponse.json({ ok: false, message: '추가할 파일 경로가 없습니다.' }, { status: 400 });
    }
    const lib = addPathsToLibrary(paths);
    if (paths[0]) setLastSelected(paths[0]);
    const { items } = annotateLibrary(loadLibrary());
    return NextResponse.json({
      ok: true,
      items,
      lastSelected: loadLibrary().lastSelected ?? '',
      added: lib.entries.length,
    });
  }

  if (action === 'remove') {
    const path = (body.path ?? '').trim();
    if (!path) {
      return NextResponse.json({ ok: false, message: '삭제할 경로가 없습니다.' }, { status: 400 });
    }
    removePathFromLibrary(path);
    const { items } = annotateLibrary(loadLibrary());
    return NextResponse.json({
      ok: true,
      items,
      lastSelected: loadLibrary().lastSelected ?? '',
    });
  }

  if (action === 'select') {
    const path = (body.path ?? '').trim();
    if (!path) {
      return NextResponse.json({ ok: false, message: '선택할 경로가 없습니다.' }, { status: 400 });
    }
    setLastSelected(path);
    const { items } = annotateLibrary(loadLibrary());
    return NextResponse.json({
      ok: true,
      items,
      lastSelected: loadLibrary().lastSelected ?? '',
    });
  }

  return NextResponse.json(
    { ok: false, message: 'action 은 add | remove | select 중 하나여야 합니다.' },
    { status: 400 },
  );
}
