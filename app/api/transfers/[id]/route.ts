import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!await getAuthUser()) return unauthorized();
  const supabase = getAdminClient();
  await supabase.from('cash_flow').delete().eq('id', params.id);
  return NextResponse.json({ ok: true });
}
