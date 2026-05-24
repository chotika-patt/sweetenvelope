import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Letter } from '@/types';

// GET /api/letters?to=1  หรือ  GET /api/letters?sentBy=1
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const to     = searchParams.get('to');
  const sentBy = searchParams.get('sentBy');

  try {
    let query: FirebaseFirestore.Query = adminDb.collection('letters');

    if (to)     query = query.where('to', '==', Number(to));
    if (sentBy) query = query.where('sentByPersonId', '==', Number(sentBy));

    query = query.orderBy('createdAt', 'desc');

    const snap = await query.get();
    const letters: Letter[] = snap.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<Letter, 'id'>),
    }));

    return NextResponse.json({ letters });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch letters' }, { status: 500 });
  }
}

// POST /api/letters  — ส่งจดหมายใหม่
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, from, anon, letterBody, date, sentByPersonId, imageUrl } = body;

    if (!to || !from || !letterBody) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const letter = {
      to:             Number(to),
      from,
      anon:           Boolean(anon),
      body:           String(letterBody).slice(0, 2000),
      date,
      read:           false,
      sentByPersonId: sentByPersonId ?? null,
      createdAt:      Date.now(),
      imageUrl: imageUrl ?? null,
    };

    const ref = await adminDb.collection('letters').add(letter);
    return NextResponse.json({ id: ref.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to send letter' }, { status: 500 });
  }
}
