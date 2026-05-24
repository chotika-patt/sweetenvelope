import { NextRequest, NextResponse } from 'next/server';
import { ACCOUNTS } from '@/lib/data';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  const account = ACCOUNTS.find(
    a => a.username === username && a.password === password
  );
  if (!account) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
  // ส่ง personId กลับไป (ไม่ส่ง password)
  return NextResponse.json({ personId: account.personId, username: account.username });
}
