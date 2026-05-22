import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

  const supabase = getAdminClient();
  const { data } = await supabase
    .from('user_settings')
    .select('value')
    .eq('user_id', user.id)
    .eq('key', key)
    .maybeSingle();

  return NextResponse.json({ key, value: data?.value ?? null });
}

export async function PUT(req: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const { key, value } = await req.json();
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

  const supabase = getAdminClient();
  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: user.id, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
