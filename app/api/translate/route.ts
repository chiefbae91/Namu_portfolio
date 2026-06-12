import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { texts } = await req.json() as { texts: string[] };
  if (!texts?.length) return NextResponse.json({ error: 'No texts' }, { status: 400 });

  try {
    const translated = await Promise.all(
      texts.map(async (text) => {
        if (!text?.trim()) return '';
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ko`;
        const res = await fetch(url);
        const json = await res.json();
        return (json.responseData?.translatedText as string) ?? text;
      })
    );
    return NextResponse.json({ translated });
  } catch {
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
