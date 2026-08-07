import { NextRequest, NextResponse } from 'next/server';
import { runProjectSmoke, type SmokeTarget } from '@/lib/project-smoke/run';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const ALLOWED: SmokeTarget[] = ['p1', 'p3', 'all'];

export async function POST(req: NextRequest) {
  let target: SmokeTarget = 'all';
  try {
    const body = (await req.json().catch(() => ({}))) as { project?: string };
    const raw = (body.project ?? 'all').trim().toLowerCase();
    if (ALLOWED.includes(raw as SmokeTarget)) target = raw as SmokeTarget;
  } catch {
    target = 'all';
  }

  const result = await runProjectSmoke(target);
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}

export async function GET(req: NextRequest) {
  const project = req.nextUrl.searchParams.get('project') ?? 'all';
  const target = ALLOWED.includes(project as SmokeTarget)
    ? (project as SmokeTarget)
    : 'all';
  const result = await runProjectSmoke(target);
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
