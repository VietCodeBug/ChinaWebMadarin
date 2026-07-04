'use client';

import React, { useState, useEffect } from 'react';
import { getReadingPassages, saveToVocab } from '../actions';
import { Passage } from '../types';

interface Props {
  speak: (text: string) => void;
  showToast: (msg: string) => void;
  onVocabSaved: () => void;
}

// Segment Chinese text into clickable words
function SegmentedText({ text, onWordClick }: { text: string; onWordClick: (word: string, e: React.MouseEvent) => void }) {
  const segments: string[] = text.includes('|')
    ? text.split('|')
    : ('Segmenter' in Intl
        ? [...(new (Intl as any).Segmenter('zh', { granularity: 'word' })).segment(text)].map((s: any) => s.segment)
        : text.split(''));

  return (
    <>
      {segments.map((seg, i) => {
        const isChinese = /[\u4e00-\u9fff]/.test(seg);
        if (isChinese) {
          return (
            <span key={i} className="zh-word" onClick={e => onWordClick(seg.trim(), e)}>
              {seg}
            </span>
          );
        }
        return <span key={i}>{seg}</span>;
      })}
    </>
  );
}

export default function ReadingTab({ speak, showToast, onVocabSaved }: Props) {
  const [passages, setPassages] = useState<Passage[]>([]);
  const [selected, setSelected] = useState<Passage | null>(null);
  const [popup, setPopup] = useState<{ word: string; pos: { x: number; y: number } } | null>(null);
  const [popupPy, setPopupPy] = useState('');
  const [popupMeaning, setPopupMeaning] = useState('');
  const [popupLoading, setPopupLoading] = useState(false);

  useEffect(() => {
    getReadingPassages().then(r => {
      if (r.success && r.passages) {
        setPassages(r.passages);
        setSelected(r.passages[0] || null);
      }
    });
    const dismiss = () => setPopup(null);
    document.addEventListener('click', dismiss);
    return () => document.removeEventListener('click', dismiss);
  }, []);

  const handleWordClick = async (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopup({ word, pos: { x: rect.left + rect.width / 2, y: rect.top } });
    setPopupPy(''); setPopupMeaning(''); setPopupLoading(true);

    // Get pinyin
    try {
      const { pinyin } = await import('pinyin-pro');
      setPopupPy(pinyin(word, { toneType: 'symbol', type: 'string' }));
    } catch (_) {}

    // Translate
    try {
      const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=vi&dt=t&q=${encodeURIComponent(word)}`);
      const d = await r.json();
      setPopupMeaning((d?.[0]?.[0]?.[0]) || '(Không có nghĩa)');
    } catch (_) {
      setPopupMeaning('(Lỗi dịch)');
    }
    setPopupLoading(false);
  };

  const saveWord = async () => {
    if (!popup) return;
    const r = await saveToVocab(popup.word, popupPy, popupMeaning);
    if (r.success) {
      showToast(`Đã lưu "${popup.word}" vào sổ tay!`);
      onVocabSaved();
      setPopup(null);
    }
  };

  return (
    <div>
      {/* Passage tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5" style={{ scrollbarWidth: 'none' }}>
        {passages.map(p => (
          <button
            key={p.id}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all"
            style={selected?.id === p.id
              ? { background: 'var(--primary)', color: 'var(--on-primary-text)', border: '1.5px solid var(--primary)' }
              : { background: 'var(--card-bg)', color: 'var(--text-muted)', border: '1.5px solid var(--card-border)' }}
            onClick={() => setSelected(p)}
          >
            {p.level} · {p.title.split(' ').slice(0, 3).join(' ')}
          </button>
        ))}
      </div>

      {selected && (
        <div className="passage-card">
          <div className="passage-title-row">
            <span className="passage-title">{selected.title}</span>
            <span className="passage-level">{selected.level}</span>
          </div>
          <div className="passage-body">
            <SegmentedText text={selected.zh} onWordClick={handleWordClick} />
          </div>
          <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.5rem' }}>
            Bản dịch
          </div>
          <div className="passage-translation">{selected.vi}</div>
        </div>
      )}

      {/* Word popup (fixed position on screen) */}
      {popup && (
        <div
          className="word-popup"
          style={{
            position: 'fixed',
            left: popup.pos.x,
            top: popup.pos.y - 10,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="popup-header">
            <span className="popup-hanzi zh">{popup.word}</span>
            <div className="flex gap-2">
              <button className="btn-popup-speak" onClick={() => speak(popup.word)}>🔊</button>
              <button className="btn-save-vocab" onClick={saveWord} title="Lưu vào sổ tay">+</button>
            </div>
          </div>
          {popupPy && <div className="popup-pinyin">{popupPy}</div>}
          {popupMeaning && <div className="popup-meaning">{popupMeaning}</div>}
          {popupLoading && <div className="popup-loading">Đang tra cứu...</div>}
        </div>
      )}
    </div>
  );
}
