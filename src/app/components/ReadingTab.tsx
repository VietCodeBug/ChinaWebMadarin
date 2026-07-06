'use client';

import React, { useState, useEffect } from 'react';
import { getReadingPassages, saveToVocab } from '../actions';
import { Passage } from '../types';
import { ArrowLeft, BookOpen, Tag, GraduationCap, Eye, EyeOff, Volume2, Plus, HelpCircle } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'hsk' | 'topic' | 'novel'>('hsk');
  
  // Filtering states
  const [selectedHskLevel, setSelectedHskLevel] = useState('HSK 1');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedNovel, setSelectedNovel] = useState<string | null>(null);

  // Active reading state
  const [activePassage, setActivePassage] = useState<Passage | null>(null);
  const [revealedParagraphs, setRevealedParagraphs] = useState<Set<number>>(new Set());

  // Popup states
  const [popup, setPopup] = useState<{ word: string; pos: { x: number; y: number } } | null>(null);
  const [popupPy, setPopupPy] = useState('');
  const [popupMeaning, setPopupMeaning] = useState('');
  const [popupLoading, setPopupLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getReadingPassages().then(r => {
      if (r.success && r.passages) {
        setPassages(r.passages);
        
        // Pick first topic as default if available
        const topics = Array.from(new Set(r.passages.filter(p => p.category === 'topic').map(p => p.groupName)));
        if (topics.length > 0) setSelectedTopic(topics[0]);
      }
      setLoading(false);
    });

    const dismiss = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.zh-word') || target.closest('.word-popup')) {
        return;
      }
      setPopup(null);
    };
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

  // Group metadata
  const hskLevels = Array.from(new Set(passages.filter(p => p.category === 'hsk').map(p => p.groupName))).sort();
  const topics = Array.from(new Set(passages.filter(p => p.category === 'topic').map(p => p.groupName))).sort();
  const novels = Array.from(new Set(passages.filter(p => p.category === 'novel').map(p => p.groupName))).sort();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: 'var(--primary)' }}>
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="font-bold text-sm">Đang tải thư viện bài đọc...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ─── READER MODE (Active reading view) ────────────────────────────────── */}
      {activePassage ? (
        <div className="flex flex-col gap-4 animate-fade-in">
          {/* Header toolbar */}
          <div className="flex justify-between items-center border-b dark:border-slate-800 pb-3 flex-wrap gap-2">
            <button
              className="btn-ghost flex items-center gap-1.5 text-xs font-extrabold text-slate-500 hover:text-primary transition-all"
              onClick={() => setActivePassage(null)}
            >
              <ArrowLeft size={14} /> Quay lại thư viện
            </button>
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
              {activePassage.category === 'hsk' ? activePassage.groupName : (activePassage.category === 'novel' ? `Truyện` : `Chủ đề`)}
            </span>
          </div>

          {/* Title */}
          <div className="py-2">
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{activePassage.title}</h2>
            {activePassage.category === 'novel' && activePassage.chapterNumber && (
              <span className="text-xs font-bold text-slate-400 block mt-1">Chương {activePassage.chapterNumber} · {activePassage.groupName}</span>
            )}
          </div>

          {/* Helper alert */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-start gap-2">
            <HelpCircle size={16} className="shrink-0 mt-0.5" />
            <span>Mẹo: Nhấn vào bất kỳ từ chữ Hán nào để tra cứu Pinyin, phát âm hoặc lưu trực tiếp vào sổ tay cá nhân của bạn. Nhấn vào biểu tượng con mắt để xem bản dịch của từng đoạn văn.</span>
          </div>

          {/* Paragraphs body */}
          <div className="flex flex-col gap-6 mt-4">
            {activePassage.zh.split('\n').map((zhPara, idx) => {
              const viParas = activePassage.vi.split('\n');
              const isRevealed = revealedParagraphs.has(idx);
              
              return (
                <div 
                  key={idx} 
                  className="p-5 rounded-3xl bg-white dark:bg-slate-900 border dark:border-slate-800 shadow-sm transition-all hover:shadow-md flex flex-col gap-4"
                  style={{ border: '1px solid var(--card-border)' }}
                >
                  <p className="passage-body leading-loose text-lg font-medium text-slate-800 dark:text-slate-200">
                    <SegmentedText text={zhPara} onWordClick={handleWordClick} />
                  </p>
                  
                  <div className="flex justify-between items-center pt-3.5 border-t border-dashed border-slate-100 dark:border-slate-800/80">
                    <button
                      className={`text-xs font-black flex items-center gap-1.5 transition-all px-3 py-1.5 rounded-xl ${
                        isRevealed 
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' 
                          : 'bg-primary/10 text-primary hover:bg-primary/15'
                      }`}
                      onClick={() => {
                        setRevealedParagraphs(prev => {
                          const next = new Set(prev);
                          if (next.has(idx)) next.delete(idx);
                          else next.add(idx);
                          return next;
                        });
                      }}
                    >
                      {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                      <span>{isRevealed ? 'Ẩn bản dịch' : 'Dịch đoạn này'}</span>
                    </button>
                    
                    <button
                      className="text-xs font-bold text-slate-400 hover:text-primary flex items-center gap-1.5 transition-all px-2.5 py-1.5"
                      onClick={() => speak(zhPara.replace(/\|/g, ''))}
                    >
                      <Volume2 size={15} />
                      <span>Nghe đọc</span>
                    </button>
                  </div>

                  {isRevealed && (
                    <div className="p-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium border border-emerald-500/10 animate-fade-in leading-relaxed">
                      {viParas[idx] || '(Chưa có bản dịch cho đoạn này)'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        // ─── CATALOG / LIBRARY SELECTOR MODE ─────────────────────────────────
        <div className="flex flex-col gap-6">
          {/* Main Category Tab Switcher */}
          <div className="flex gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border dark:border-slate-800" style={{ border: '1px solid var(--card-border)' }}>
            <button
              className="flex-1 py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              style={activeCategory === 'hsk'
                ? { background: 'var(--primary)', color: 'var(--on-primary-text)' }
                : { color: 'var(--text-muted)' }}
              onClick={() => { setActiveCategory('hsk'); setSelectedNovel(null); }}
            >
              <GraduationCap size={15} /> Luyện HSK
            </button>
            <button
              className="flex-1 py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              style={activeCategory === 'topic'
                ? { background: 'var(--primary)', color: 'var(--on-primary-text)' }
                : { color: 'var(--text-muted)' }}
              onClick={() => { setActiveCategory('topic'); setSelectedNovel(null); }}
            >
              <Tag size={15} /> Theo chủ đề
            </button>
            <button
              className="flex-1 py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              style={activeCategory === 'novel'
                ? { background: 'var(--primary)', color: 'var(--on-primary-text)' }
                : { color: 'var(--text-muted)' }}
              onClick={() => { setActiveCategory('novel'); }}
            >
              <BookOpen size={15} /> Truyện dài tập
            </button>
          </div>

          {/* Sub-Filters / Pills */}
          {activeCategory === 'hsk' && hskLevels.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {hskLevels.map(lv => (
                <button
                  key={lv}
                  className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-extrabold border transition-all"
                  style={selectedHskLevel === lv
                    ? { background: 'var(--primary)', color: 'var(--on-primary-text)', borderColor: 'var(--primary)' }
                    : { background: 'var(--card-bg)', color: 'var(--text-muted)', borderColor: 'var(--card-border)' }}
                  onClick={() => setSelectedHskLevel(lv)}
                >
                  {lv}
                </button>
              ))}
            </div>
          )}

          {activeCategory === 'topic' && topics.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {topics.map(tp => (
                <button
                  key={tp}
                  className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-extrabold border transition-all"
                  style={selectedTopic === tp
                    ? { background: 'var(--primary)', color: 'var(--on-primary-text)', borderColor: 'var(--primary)' }
                    : { background: 'var(--card-bg)', color: 'var(--text-muted)', borderColor: 'var(--card-border)' }}
                  onClick={() => setSelectedTopic(tp)}
                >
                  {tp}
                </button>
              ))}
            </div>
          )}

          {/* ─── Display Lists based on filters ─── */}
          
          {/* HSK readings list */}
          {activeCategory === 'hsk' && (
            <div className="grid grid-cols-1 gap-4">
              {passages.filter(p => p.category === 'hsk' && p.groupName === selectedHskLevel).map(p => (
                <div 
                  key={p.id} 
                  className="p-5 rounded-3xl bg-white dark:bg-slate-900 border dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex justify-between items-center gap-4 cursor-pointer"
                  style={{ border: '1px solid var(--card-border)' }}
                  onClick={() => { setActivePassage(p); setRevealedParagraphs(new Set()); }}
                >
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 mb-1">{p.title}</h4>
                    <span className="text-xs text-slate-400 font-semibold">{p.zh.split('\n')[0].substring(0, 45)}...</span>
                  </div>
                  <span className="text-xs font-black text-primary shrink-0">Đọc bài →</span>
                </div>
              ))}
            </div>
          )}

          {/* Topic readings list */}
          {activeCategory === 'topic' && (
            <div className="grid grid-cols-1 gap-4">
              {passages.filter(p => p.category === 'topic' && p.groupName === selectedTopic).map(p => (
                <div 
                  key={p.id} 
                  className="p-5 rounded-3xl bg-white dark:bg-slate-900 border dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex justify-between items-center gap-4 cursor-pointer"
                  style={{ border: '1px solid var(--card-border)' }}
                  onClick={() => { setActivePassage(p); setRevealedParagraphs(new Set()); }}
                >
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 mb-1">{p.title}</h4>
                    <span className="text-xs text-slate-400 font-semibold">{p.zh.split('\n')[0].substring(0, 45)}...</span>
                  </div>
                  <span className="text-xs font-black text-primary shrink-0">Đọc bài →</span>
                </div>
              ))}
            </div>
          )}

          {/* Serialized Novels section */}
          {activeCategory === 'novel' && (
            <div>
              {selectedNovel ? (
                // ─── CHAPTER LIST VIEW inside selected novel ───
                <div className="flex flex-col gap-4 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <button 
                      className="btn-ghost flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      onClick={() => setSelectedNovel(null)}
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div>
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">Danh sách chương</span>
                      <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{selectedNovel}</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 mt-2">
                    {passages
                      .filter(p => p.category === 'novel' && p.groupName === selectedNovel)
                      .sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0))
                      .map(ch => (
                        <div
                          key={ch.id}
                          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex justify-between items-center gap-4 cursor-pointer"
                          style={{ border: '1px solid var(--card-border)' }}
                          onClick={() => { setActivePassage(ch); setRevealedParagraphs(new Set()); }}
                        >
                          <div>
                            <span className="text-[10px] font-black text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wider block w-max mb-1.5">
                              Chương {ch.chapterNumber}
                            </span>
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">{ch.title}</h4>
                          </div>
                          <span className="text-xs font-black text-slate-400 shrink-0">Bắt đầu đọc →</span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                // ─── NOVELS GRID VIEW (Shows cover cards) ───
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {novels.map(nv => {
                    const chaptersCount = passages.filter(p => p.category === 'novel' && p.groupName === nv).length;
                    return (
                      <div 
                        key={nv} 
                        className="p-6 rounded-[28px] bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between min-h-[140px] gap-4"
                        onClick={() => setSelectedNovel(nv)}
                      >
                        <div>
                          <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
                            Truyện Dịch
                          </span>
                          <h4 className="font-black text-base text-slate-800 dark:text-slate-100 mt-2.5 leading-snug">{nv}</h4>
                        </div>
                        <div className="flex justify-between items-center border-t border-slate-200/50 dark:border-slate-800/80 pt-3 text-xs font-bold text-slate-400">
                          <span>{chaptersCount} chương</span>
                          <span className="text-primary">Mở xem →</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Word popup (fixed position on screen) */}
      {popup && (
        <div
          className="word-popup backdrop-blur-md bg-white/95 dark:bg-slate-900/95 shadow-xl border dark:border-slate-800 p-4 rounded-2xl"
          style={{
            position: 'fixed',
            left: popup.pos.x,
            top: popup.pos.y - 10,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="popup-header flex items-center justify-between gap-3 mb-2">
            <span className="popup-hanzi zh text-xl font-bold text-slate-800 dark:text-slate-100">{popup.word}</span>
            <div className="flex gap-1.5">
              <button 
                className="btn-popup-speak bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 p-2 rounded-xl text-xs transition-all" 
                onClick={() => speak(popup.word)}
              >
                🔊
              </button>
              <button 
                className="btn-save-vocab bg-primary text-white hover:brightness-105 p-2 rounded-xl text-xs transition-all font-bold" 
                onClick={saveWord} 
                title="Lưu vào sổ tay"
              >
                +
              </button>
            </div>
          </div>
          {popupPy && <div className="popup-pinyin text-xs font-bold text-amber-500 mb-1">{popupPy}</div>}
          {popupMeaning && <div className="popup-meaning text-xs font-semibold text-slate-600 dark:text-slate-300 leading-normal">{popupMeaning}</div>}
          {popupLoading && <div className="popup-loading text-xs text-slate-400">Đang tra cứu...</div>}
        </div>
      )}
    </div>
  );
}
