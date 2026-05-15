import fs from 'fs';
import path from 'path';
import GuideClient from './GuideClient';

export const metadata = { title: 'User Guide — Namu Portfolio' };

export default function GuidePage() {
  const mdPath = path.join(process.cwd(), '사용자_가이드.md');
  const content = fs.readFileSync(mdPath, 'utf-8');
  return <GuideClient content={content} />;
}
