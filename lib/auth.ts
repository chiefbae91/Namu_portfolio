import { createServerSupabase } from './supabase-server';
import { NextResponse } from 'next/server';

export async function getAuthUser() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export const unauthorized = () =>
  NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
