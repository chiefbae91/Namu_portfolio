'use client';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  value: string; // MM/DD/YYYY
  onChange: (val: string) => void;
  error?: string;
  inputWidth?: number;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function parseDisplay(disp: string): Date | null {
  const p = disp.split('/');
  if (p.length !== 3) return null;
  const [m, d, y] = p.map(Number);
  if (!m || !d || !y || y < 1900 || y > 2100) return null;
  return new Date(y, m - 1, d);
}

export default function DatePickerInput({ value, onChange, error, inputWidth = 110 }: Props) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = parseDisplay(value);
    if (d) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const openCalendar = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(o => !o);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${m}/${d}/${viewYear}`);
    setOpen(false);
  };

  const selected = parseDisplay(value);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const today = new Date();

  return (
    <>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="MM/DD/YYYY"
          style={{ width: inputWidth, borderColor: error ? 'var(--red)' : undefined }}
        />
        <button ref={btnRef} type="button" onClick={openCalendar}
          style={{ background: 'var(--border)', color: 'var(--text)', padding: '6px 8px' }}>
          <CalendarDays size={14} />
        </button>
      </div>
      {error && <span style={{ color: 'var(--red)', fontSize: 11, display: 'block', marginTop: 2 }}>{error}</span>}

      {open && (
        <div ref={dropRef} style={{
          position: 'fixed',
          top: dropPos.top,
          left: dropPos.left,
          zIndex: 10000,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          minWidth: 230,
          userSelect: 'none',
        }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button type="button" onClick={prevMonth}
              style={{ background: 'none', color: 'var(--text)', padding: '2px 6px' }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth}
              style={{ background: 'none', color: 'var(--text)', padding: '2px 6px' }}>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#64748b', padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          {/* Days */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`pad-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSel = selected &&
                selected.getFullYear() === viewYear &&
                selected.getMonth() === viewMonth &&
                selected.getDate() === day;
              const isToday =
                today.getFullYear() === viewYear &&
                today.getMonth() === viewMonth &&
                today.getDate() === day;
              return (
                <button key={day} type="button" onClick={() => handleDay(day)} style={{
                  padding: '5px 2px',
                  textAlign: 'center',
                  fontSize: 12,
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: isSel ? '#6366f1' : isToday ? 'rgba(99,102,241,0.25)' : 'transparent',
                  color: isSel ? '#ffffff' : isToday ? 'var(--accent)' : 'var(--text)',
                  fontWeight: isSel || isToday ? 600 : 400,
                }}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
