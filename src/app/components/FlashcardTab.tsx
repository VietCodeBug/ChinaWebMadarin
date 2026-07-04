'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Check, Plus, RotateCcw, ChevronLeft, ChevronRight, BookOpen, Star } from 'lucide-react';
import { Flashcard, HSKWord, HSK_LEVELS } from '../types';
import {
  getFlashcardsDue, addFlashcard, recordFlashcardReview,
  getHSK30Stats, getHSK30DeckWords, addHSK30WordToFlashcards
} from '../actions';

interface Props {
  speak: (text: string) => void;
  onDueCountChange: (n: number) => void;
  showToast: (msg: string) => void;
}

// ─── SRS Review Component ─────────────────────────────────────────────────────
function SRSReview({ speak, onDueCountChange, showToast }: Props) {
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newZh, setNewZh] = useState('');
  const [newVi, setNewVi] = useState('');
  const [newPy, setNewPy] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const r = await getFlashcardsDue();
    if (r.success && r.cards) {
      setDueCards(r.cards);
      setCardIdx(0);
      setFlipped(false);
      onDueCountChange(r.cards.length);
    }
    setLoading(false);
  };

  const rate = async (score: number) => {
    if (!dueCards.length) return;
    const card = dueCards[cardIdx];
    setFlipped(false);
    const r = await recordFlashcardReview(card.id, score);
    if (r.success) {
      setTimeout(() => {
        if (cardIdx < dueCards.length - 1) {
          setCardIdx(i => i + 1);
        } else {
          setDueCards([]);
          onDueCountChange(0);
          try { (window as any).confetti?.({ particleCount: 80, spread: 60 }); } catch (_) {}
        }
      }, 200);
    }
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZh || !newVi) return;
    const r = await addFlashcard(newZh, newVi, newPy);
    if (r.success) {
      showToast('Đã tạo flashcard!');
      setNewZh(''); setNewVi(''); setNewPy('');
      setShowAdd(false);
      load();
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16" style={{ color: 'var(--primary)' }}>
      <span className="animate-pulse font-bold">Đang tải thẻ...</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Ôn tập Spaced Repetition</div>
          <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>Lật thẻ → tự đánh giá mức độ nhớ</div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={load} title="Tải lại"><RotateCcw size={14} /></button>
          <button className="btn-primary" onClick={() => setShowAdd(p => !p)}>
            <Plus size={14} />{showAdd ? 'Hủy' : 'Tạo thẻ'}
          </button>
        </div>
      </div>

      {/* Add card form */}
      {showAdd && (
        <form className="jade-card p-5 flex flex-col gap-3 max-w-lg" onSubmit={submitNew}>
          <div style={{ fontWeight: 700 }}>Tạo flashcard mới</div>
          <div className="form-group">
            <label className="form-label">Chữ Hán (mặt trước)</label>
            <input className="form-input" placeholder="你好" value={newZh} onChange={e => setNewZh(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Nghĩa tiếng Việt (mặt sau)</label>
            <input className="form-input" placeholder="Xin chào" value={newVi} onChange={e => setNewVi(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Pinyin (tự điền nếu bỏ trống)</label>
            <input className="form-input" placeholder="nǐ hǎo" value={newPy} onChange={e => setNewPy(e.target.value)} />
          </div>
          <button type="submit" className="btn-submit">Lưu thẻ nhớ</button>
        </form>
      )}

      {/* Card arena */}
      {dueCards.length > 0 ? (
        <div className="flex flex-col items-center gap-4 w-full max-w-xl mx-auto">
          {/* Progress */}
          <div className="w-full flex items-center gap-3">
            <span style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
              {cardIdx + 1} / {dueCards.length}
            </span>
            <div className="quizlet-progress-bar flex-1">
              <div className="quizlet-progress-fill" style={{ width: `${(cardIdx / dueCards.length) * 100}%` }} />
            </div>
          </div>

          {/* Flip card */}
          <div
            className={`quizlet-card-container w-full ${flipped ? 'flipped' : ''}`}
            onClick={() => setFlipped(f => !f)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === ' ' && setFlipped(f => !f)}
          >
            <div className="quizlet-card-inner">
              {/* Front */}
              <div className="quizlet-card-face">
                <span className="qcard-label">Chữ Hán – Nhấp để xem đáp án</span>
                <div className="qcard-hz zh">{dueCards[cardIdx].zh}</div>
                <button
                  className="qcard-speak-btn"
                  onClick={e => { e.stopPropagation(); speak(dueCards[cardIdx].zh); }}
                >
                  <Volume2 size={14} /> Phát âm
                </button>
              </div>
              {/* Back */}
              <div className="quizlet-card-face back">
                <span className="qcard-label">Đáp án</span>
                <div className="qcard-py">{dueCards[cardIdx].pinyin}</div>
                <div className="qcard-vi">{dueCards[cardIdx].vi}</div>
                <button
                  className="qcard-speak-btn"
                  onClick={e => { e.stopPropagation(); speak(dueCards[cardIdx].zh); }}
                >
                  <Volume2 size={14} /> Phát âm
                </button>
              </div>
            </div>
          </div>

          {/* SRS Rating buttons – always visible but prompt to flip first */}
          <div className="w-full">
            {!flipped ? (
              <div className="text-center py-3" style={{ fontSize: '.85rem', color: 'var(--text-faint)' }}>
                👆 Nhấp vào thẻ để lật xem đáp án, sau đó chấm điểm
              </div>
            ) : (
              <div>
                <div className="text-center mb-3" style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  BẠN NHỚ BÀI NÀY NHƯ THẾ NÀO?
                </div>
                <div className="srs-rating-row">
                  <button className="btn-srs again" onClick={() => rate(1)}>
                    <span>Quên rồi</span>
                    <span className="btn-srs-interval">1 phút</span>
                  </button>
                  <button className="btn-srs hard" onClick={() => rate(2)}>
                    <span>Khó nhớ</span>
                    <span className="btn-srs-interval">2 ngày</span>
                  </button>
                  <button className="btn-srs good" onClick={() => rate(2)}>
                    <span>Nhớ tốt</span>
                    <span className="btn-srs-interval">4 ngày</span>
                  </button>
                  <button className="btn-srs easy" onClick={() => rate(3)}>
                    <span>Dễ</span>
                    <span className="btn-srs-interval">7 ngày</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="jade-card p-12 text-center max-w-sm mx-auto">
          <div style={{ fontSize: '3rem' }}>🎉</div>
          <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.1rem', marginTop: '.5rem' }}>
            Xong tất cả thẻ hôm nay!
          </div>
          <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginTop: '.35rem' }}>
            Sang Tab <strong>Thư viện HSK</strong> để nạp thêm từ mới vào deck.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Deck Study Mode ──────────────────────────────────────────────────────────
function DeckStudyMode({ words, deckLabel, speak, onBack }: {
  words: HSKWord[];
  deckLabel: string;
  speak: (text: string) => void;
  onBack: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [unknown, setUnknown] = useState<Set<number>>(new Set());
  const [finished, setFinished] = useState(false);

  const card = words[idx];

  const next = () => {
    if (idx < words.length - 1) { setIdx(i => i + 1); setFlipped(false); }
    else setFinished(true);
  };
  const prev = () => { if (idx > 0) { setIdx(i => i - 1); setFlipped(false); } };

  const markKnown = () => { setKnown(s => new Set(s).add(card.id)); next(); };
  const markUnknown = () => { setUnknown(s => new Set(s).add(card.id)); next(); };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); setFlipped(f => !f); }
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft')  prev();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [idx, flipped]);

  if (finished) return (
    <div className="jade-card p-10 text-center max-w-sm mx-auto flex flex-col gap-4">
      <div style={{ fontSize: '3rem' }}>🏆</div>
      <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--primary)' }}>Xong {deckLabel}!</div>
      <div className="flex justify-center gap-6">
        <div className="text-center">
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success-color)' }}>{known.size}</div>
          <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Đã nhớ ✓</div>
        </div>
        <div className="text-center">
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--error-color)' }}>{unknown.size}</div>
          <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Cần ôn lại</div>
        </div>
      </div>
      <div className="flex flex-col gap-2 mt-2">
        <button className="btn-primary w-full" onClick={() => { setIdx(0); setFlipped(false); setFinished(false); setKnown(new Set()); setUnknown(new Set()); }}>
          <RotateCcw size={14} /> Học lại từ đầu
        </button>
        <button className="btn-ghost w-full" onClick={onBack}><ChevronLeft size={14} />Về danh sách</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 w-full max-w-xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <button className="btn-ghost" onClick={onBack}><ChevronLeft size={14} />Quay lại</button>
        <div style={{ flex: 1 }}>
          <div className="quizlet-progress-bar">
            <div className="quizlet-progress-fill" style={{ width: `${((idx) / words.length) * 100}%` }} />
          </div>
        </div>
        <span style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
          {idx + 1}/{words.length}
        </span>
      </div>

      {/* Card */}
      <div
        className={`quizlet-card-container w-full ${flipped ? 'flipped' : ''}`}
        onClick={() => setFlipped(f => !f)}
        role="button" tabIndex={0}
        onKeyDown={e => e.key === ' ' && setFlipped(f => !f)}
      >
        <div className="quizlet-card-inner">
          <div className="quizlet-card-face">
            <span className="qcard-label">{deckLabel} · Chữ Hán</span>
            <div className="qcard-hz zh">{card.word}</div>
            <span className="qcard-type">{card.wordType}</span>
            <button className="qcard-speak-btn" onClick={e => { e.stopPropagation(); speak(card.word); }}>
              <Volume2 size={14} /> Phát âm
            </button>
            <span className="qcard-hint">Nhấp / Space để xem nghĩa</span>
          </div>
          <div className="quizlet-card-face back">
            <span className="qcard-label">Đáp án</span>
            <div className="qcard-py">{card.pinyin}</div>
            <div className="qcard-vi">{card.meaning}</div>
            {card.exampleZh && (
              <div className="qcard-example">
                <div className="qcard-example-zh zh">{card.exampleZh}</div>
                <div className="qcard-example-py">{card.examplePinyin}</div>
                <div className="qcard-example-vi">{card.exampleVi}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nav + rating */}
      <div className="flex items-center gap-3 justify-center">
        <button className="btn-ghost px-4" onClick={prev} disabled={idx === 0}>
          <ChevronLeft size={16} />
        </button>
        {flipped ? (
          <>
            <button
              className="flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all"
              style={{ background: 'var(--error-bg)', color: 'var(--error-text)', borderColor: 'var(--error-color)' }}
              onClick={markUnknown}
            >
              😵 Chưa nhớ
            </button>
            <button
              className="flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all"
              style={{ background: 'var(--success-bg)', color: 'var(--success-text)', borderColor: 'var(--success-color)' }}
              onClick={markKnown}
            >
              ✓ Đã nhớ
            </button>
          </>
        ) : (
          <button className="btn-primary flex-1 py-3" onClick={() => setFlipped(true)}>
            Xem nghĩa
          </button>
        )}
        <button className="btn-ghost px-4" onClick={next}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Keyboard hint */}
      <div className="text-center" style={{ fontSize: '.72rem', color: 'var(--text-faint)' }}>
        Space = lật · ← → = điều hướng
      </div>
    </div>
  );
}

// ─── HSK Library Component ────────────────────────────────────────────────────
function HSKLibrary({ speak, showToast, onSrsDueChange }: {
  speak: (text: string) => void;
  showToast: (msg: string) => void;
  onSrsDueChange: (delta: number) => void;
}) {
  const [hskStats, setHskStats] = useState({ totalCount: 0, addedCount: 0, levelCounts: {} as Record<string, number> });
  const [selLevel, setSelLevel] = useState('HSK1');
  const [deckIdx, setDeckIdx] = useState<number | null>(null);
  const [deckWords, setDeckWords] = useState<HSKWord[]>([]);
  const [deckLoading, setDeckLoading] = useState(false);
  const [studyMode, setStudyMode] = useState(false);

  useEffect(() => { refreshStats(); }, []);

  const refreshStats = async () => {
    const r = await getHSK30Stats();
    if (r.success) setHskStats({ totalCount: r.totalCount || 0, addedCount: r.addedCount || 0, levelCounts: r.levelCounts || {} });
  };

  const openDeck = async (idx: number) => {
    setDeckIdx(idx); setDeckLoading(true); setStudyMode(false);
    const r = await getHSK30DeckWords(selLevel, idx);
    setDeckLoading(false);
    if (r.success && r.words) setDeckWords(r.words);
  };

  const addToSRS = async (w: HSKWord) => {
    const r = await addHSK30WordToFlashcards(w.id);
    if (r.success) {
      showToast(`Đã thêm "${w.word}" vào SRS!`);
      setDeckWords(prev => prev.map(x => x.id === w.id ? { ...x, isAdded: true } : x));
      setHskStats(prev => ({ ...prev, addedCount: prev.addedCount + 1 }));
      onSrsDueChange(1);
    } else {
      showToast(r.error || 'Lỗi thêm từ');
    }
  };

  const deckCount = (lv: string) => hskStats.levelCounts[lv] || 0;
  const decksFor  = (lv: string) => Math.max(1, Math.ceil(deckCount(lv) / 50));

  // Study mode
  if (studyMode && deckIdx !== null) return (
    <DeckStudyMode
      words={deckWords}
      deckLabel={`${selLevel} · Nhóm ${deckIdx + 1}`}
      speak={speak}
      onBack={() => setStudyMode(false)}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Stats */}
      <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
        Tổng thư viện: <strong style={{ color: 'var(--primary)' }}>{hskStats.totalCount}</strong> từ ·
        Đã thêm vào SRS: <strong style={{ color: 'var(--primary)' }}>{hskStats.addedCount}</strong> từ
      </div>

      {/* Level tabs */}
      <div className="hsk-level-tabs">
        {HSK_LEVELS.map(lv => (
          <button key={lv} className={`hsk-level-tab ${selLevel === lv ? 'active' : ''}`}
            onClick={() => { setSelLevel(lv); setDeckIdx(null); setStudyMode(false); }}>
            {lv} ({deckCount(lv)})
          </button>
        ))}
      </div>

      {deckIdx === null ? (
        /* Deck list */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {Array.from({ length: decksFor(selLevel) }).map((_, i) => {
            const s = i * 50 + 1;
            const e = Math.min((i + 1) * 50, deckCount(selLevel) || 50);
            return (
              <div key={i} className="jade-card p-4 cursor-pointer flex flex-col gap-2" onClick={() => openDeck(i)}>
                <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-faint)' }}>Nhóm {i + 1}</div>
                <div style={{ fontWeight: 700, fontSize: '.9rem' }}>Từ {s}–{e}</div>
                <div className="flex gap-1 mt-auto">
                  <div style={{ fontSize: '.68rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '.2rem' }}>
                    <BookOpen size={11} /> Học ngay
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Word list inside deck */
        <div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <button className="btn-ghost" onClick={() => setDeckIdx(null)}>
              <ChevronLeft size={14} /> Quay lại
            </button>
            <span style={{ fontSize: '.8rem', fontWeight: 700, background: 'var(--primary-light)', color: 'var(--primary)', padding: '.2rem .75rem', borderRadius: '999px' }}>
              {selLevel} · Nhóm {deckIdx + 1}
            </span>
            {!deckLoading && deckWords.length > 0 && (
              <button className="btn-primary ml-auto" onClick={() => setStudyMode(true)}>
                <BookOpen size={14} /> Học mode
              </button>
            )}
          </div>

          {deckLoading ? (
            <div className="text-center py-10 animate-pulse" style={{ color: 'var(--primary)', fontWeight: 700 }}>
              Đang tải danh sách từ...
            </div>
          ) : (
            <div className="vocab-grid">
              {deckWords.map(w => (
                <div key={w.id} className="vocab-item">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="vocab-item-hz zh">{w.word}</div>
                      <div className="vocab-item-py">{w.pinyin}</div>
                    </div>
                    <span className="vocab-item-type">{w.wordType}</span>
                  </div>
                  <div className="vocab-item-meaning">{w.meaning}</div>
                  {w.exampleZh && (
                    <div className="vocab-item-example">
                      <div className="zh" style={{ fontWeight: 700, fontSize: '.82rem' }}>{w.exampleZh}</div>
                      <div style={{ color: 'var(--text-faint)', fontSize: '.74rem', fontStyle: 'italic' }}>{w.exampleVi}</div>
                    </div>
                  )}
                  <div className="flex gap-2 mt-2 justify-end">
                    <button className="btn-ghost p-1.5" onClick={() => speak(w.word)}><Volume2 size={13} /></button>
                    {w.isAdded ? (
                      <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg"
                        style={{ background: 'var(--success-bg)', color: 'var(--success-text)' }}>
                        <Check size={12} /> Đang học
                      </span>
                    ) : (
                      <button className="btn-primary text-xs" onClick={() => addToSRS(w)}>
                        <Plus size={12} /> Thêm SRS
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main FlashcardTab Component ──────────────────────────────────────────────
export default function FlashcardTab({ speak, showToast, onSrsDueChange }: {
  speak: (text: string) => void;
  showToast: (msg: string) => void;
  onSrsDueChange: (delta: number) => void;
}) {
  const [subTab, setSubTab] = useState<'review' | 'library'>('review');
  const [dueCount, setDueCount] = useState(0);

  return (
    <div className="flex flex-col gap-5">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <button
          className="flex-1 py-2 rounded-lg font-bold text-sm transition-all"
          style={subTab === 'review'
            ? { background: 'var(--primary)', color: 'var(--on-primary-text)' }
            : { color: 'var(--text-muted)' }}
          onClick={() => setSubTab('review')}
        >
          🎴 Ôn tập SRS {dueCount > 0 && `(${dueCount})`}
        </button>
        <button
          className="flex-1 py-2 rounded-lg font-bold text-sm transition-all"
          style={subTab === 'library'
            ? { background: 'var(--primary)', color: 'var(--on-primary-text)' }
            : { color: 'var(--text-muted)' }}
          onClick={() => setSubTab('library')}
        >
          📚 Thư viện HSK 1-6
        </button>
      </div>

      {subTab === 'review' && (
        <SRSReview
          speak={speak}
          showToast={showToast}
          onDueCountChange={n => { setDueCount(n); onSrsDueChange(n); }}
        />
      )}
      {subTab === 'library' && (
        <HSKLibrary
          speak={speak}
          showToast={showToast}
          onSrsDueChange={delta => { setDueCount(c => c + delta); onSrsDueChange(delta); }}
        />
      )}
    </div>
  );
}
