import { NextRequest, NextResponse } from 'next/server';
import {
  BOARD_ACTIONS,
  runBoardAction,
  type BoardAction,
} from '@/lib/board-actions/run';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let action: BoardAction = 'verify-all';
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const raw = (body.action ?? 'verify-all').trim().toLowerCase();
    if (BOARD_ACTIONS.includes(raw as BoardAction)) action = raw as BoardAction;
  } catch {
    action = 'verify-all';
  }

  const result = await runBoardAction(action);
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
