import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, normalize, resolve, sep } from 'node:path';

export type P3ExcelEntry = {
  /** 절대 경로 */
  path: string;
  /** 파일명 */
  name: string;
  /** 목록에 넣은 시각 (ISO) */
  addedAt: string;
};

export type P3ExcelLibrary = {
  version: 1;
  /** 마지막에 고른 경로 (리스트박스 기본 선택) */
  lastSelected?: string;
  entries: P3ExcelEntry[];
};

const DATA_DIR = join(process.cwd(), '.data');
const LIBRARY_FILE = join(DATA_DIR, 'p3-excel-library.json');

export function libraryFilePath(): string {
  return LIBRARY_FILE;
}

export function emptyLibrary(): P3ExcelLibrary {
  return { version: 1, entries: [] };
}

export function loadLibrary(): P3ExcelLibrary {
  try {
    if (!existsSync(LIBRARY_FILE)) return emptyLibrary();
    const raw = JSON.parse(readFileSync(LIBRARY_FILE, 'utf8')) as P3ExcelLibrary;
    if (!raw || !Array.isArray(raw.entries)) return emptyLibrary();
    return {
      version: 1,
      lastSelected: typeof raw.lastSelected === 'string' ? raw.lastSelected : undefined,
      entries: raw.entries
        .filter(e => e && typeof e.path === 'string' && e.path.trim())
        .map(e => ({
          path: e.path.trim(),
          name: (e.name || e.path.split(/[/\\]/).pop() || e.path).trim(),
          addedAt: e.addedAt || new Date().toISOString(),
        })),
    };
  } catch {
    return emptyLibrary();
  }
}

export function saveLibrary(lib: P3ExcelLibrary): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(LIBRARY_FILE, JSON.stringify(lib, null, 2), 'utf8');
}

/** 경로가 존재하는지 + 라이브러리 엔트리 보강 */
export function annotateLibrary(lib: P3ExcelLibrary): {
  library: P3ExcelLibrary;
  items: Array<P3ExcelEntry & { exists: boolean }>;
} {
  const items = lib.entries.map(e => ({
    ...e,
    exists: existsSync(e.path),
  }));
  return { library: lib, items };
}

export function addPathsToLibrary(paths: string[]): P3ExcelLibrary {
  const lib = loadLibrary();
  const seen = new Set(lib.entries.map(e => normalize(e.path).toLowerCase()));
  const now = new Date().toISOString();
  for (const raw of paths) {
    const path = resolve(raw.trim());
    if (!path || !existsSync(path)) continue;
    const key = normalize(path).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const name = path.split(/[/\\]/).pop() || path;
    lib.entries.push({ path, name, addedAt: now });
  }
  saveLibrary(lib);
  return lib;
}

export function removePathFromLibrary(path: string): P3ExcelLibrary {
  const lib = loadLibrary();
  const key = normalize(path).toLowerCase();
  lib.entries = lib.entries.filter(e => normalize(e.path).toLowerCase() !== key);
  if (lib.lastSelected && normalize(lib.lastSelected).toLowerCase() === key) {
    lib.lastSelected = lib.entries[0]?.path;
  }
  saveLibrary(lib);
  return lib;
}

export function setLastSelected(path: string): P3ExcelLibrary {
  const lib = loadLibrary();
  const hit = lib.entries.find(
    e => normalize(e.path).toLowerCase() === normalize(path).toLowerCase(),
  );
  if (hit) {
    lib.lastSelected = hit.path;
    saveLibrary(lib);
  }
  return lib;
}

/** 검색에 쓸 기본 후보 폴더 (존재할 때만) */
export function defaultBrowseRoots(): string[] {
  const home = homedir();
  const candidates = [
    join(process.cwd()),
    join(home, 'Downloads'),
    join(home, '다운로드'),
    join(home, 'Desktop'),
    join(home, '바탕 화면'),
    join(home, 'Documents'),
    join(home, '문서'),
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const p = resolve(c);
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    if (!existsSync(p)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/**
 * 로컬 디렉터리에서 .xlsx 검색 (깊이 제한).
 * P1 출력 파일명 패턴(*카테고리URL*, *URL_LIST* 등)을 우선 정렬.
 */
export function searchExcelFiles(
  dir: string,
  opts?: { maxDepth?: number; maxFiles?: number; query?: string },
): {
  ok: boolean;
  dir: string;
  files: Array<{ path: string; name: string; mtimeMs: number }>;
  message?: string;
} {
  const maxDepth = opts?.maxDepth ?? 3;
  const maxFiles = opts?.maxFiles ?? 200;
  const query = (opts?.query ?? '').trim().toLowerCase();

  if (!dir || !dir.trim()) {
    return { ok: false, dir: '', files: [], message: '검색할 폴더 경로를 입력하세요.' };
  }
  if (!isAbsolute(dir) && !/^[A-Za-z]:[\\/]/.test(dir)) {
    return {
      ok: false,
      dir,
      files: [],
      message: '절대 경로를 입력하세요. (예: C:\\Users\\...\\Downloads)',
    };
  }

  const root = resolve(dir);
  if (!existsSync(root)) {
    return { ok: false, dir: root, files: [], message: `폴더 없음: ${root}` };
  }

  const files: Array<{ path: string; name: string; mtimeMs: number }> = [];

  function walk(current: string, depth: number) {
    if (files.length >= maxFiles) return;
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (files.length >= maxFiles) break;
      const name = ent.name;
      if (name.startsWith('.') || name === 'node_modules' || name === '.git') continue;
      const full = join(current, name);
      try {
        if (ent.isDirectory()) {
          walk(full, depth + 1);
        } else if (ent.isFile() && /\.xlsx$/i.test(name) && !name.startsWith('~$')) {
          if (query && !name.toLowerCase().includes(query) && !full.toLowerCase().includes(query)) {
            continue;
          }
          const st = statSync(full);
          files.push({ path: full, name, mtimeMs: st.mtimeMs });
        }
      } catch {
        /* skip */
      }
    }
  }

  walk(root, 0);

  files.sort((a, b) => {
    const score = (n: string) => {
      const u = n.toUpperCase();
      if (u.includes('카테고리URL') || u.includes('URL_LIST')) return 0;
      if (u.includes('카테고리') || u.includes('CATEGORY')) return 1;
      return 2;
    };
    const d = score(a.name) - score(b.name);
    if (d !== 0) return d;
    return b.mtimeMs - a.mtimeMs;
  });

  return { ok: true, dir: root, files };
}

/** 라이브러리에 있는 경로인지 (실행 시 검증) */
export function isPathInLibrary(path: string): boolean {
  const lib = loadLibrary();
  const key = normalize(resolve(path)).toLowerCase();
  return lib.entries.some(e => normalize(e.path).toLowerCase() === key);
}

export function pathSep(): string {
  return sep;
}
