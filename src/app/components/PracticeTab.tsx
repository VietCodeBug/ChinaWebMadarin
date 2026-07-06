'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Volume2 } from 'lucide-react';
import { pinyin } from 'pinyin-pro';
import { Course, Unit, Question } from '../types';
import { getCourseList, getUnitList, getUnitQuestions, saveQuestionCompletion, saveLessonScore } from '../actions';

interface Props {
  initialCourses: Course[];
  speak: (text: string) => void;
  audioRate: number;
  setAudioRate: (r: number) => void;
  voices: SpeechSynthesisVoice[];
  voiceIdx: string;
  setVoiceIdx: (v: string) => void;
  showToast: (msg: string) => void;
  onExpGain: (xp: number) => void;
}

export default function PracticeTab({
  initialCourses, speak, audioRate, setAudioRate,
  voices, voiceIdx, setVoiceIdx, showToast, onExpGain
}: Props) {
  const [courses] = useState<Course[]>(initialCourses);
  const [selCourse, setSelCourse] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [selUnit, setSelUnit] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pool, setPool] = useState<Question[]>([]);
  const [history, setHistory] = useState<Question[]>([]);
  const [curIdx, setCurIdx] = useState(-1);
  const [practiceMode, setPracticeMode] = useState<'typing' | 'construction'>('typing');
  const [answer, setAnswer] = useState('');
  const [selBlocks, setSelBlocks] = useState<string[]>([]);
  const [poolBlocks, setPoolBlocks] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [resultChinese, setResultChinese] = useState<React.ReactNode[]>([]);
  const [resultPinyin, setResultPinyin] = useState('');
  const [exp, setExp] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isChinese = (c: string) => /[\u4e00-\u9fff]/u.test(c);

  const setupBlocks = useCallback((q: Question) => {
    const raw = q.zh;
    let segs: string[] = [];
    if (raw.includes('|')) {
      segs = raw.split('|').filter(s => s.trim() && isChinese(s));
    } else if ('Segmenter' in Intl) {
      segs = [...(new (Intl as any).Segmenter('zh', { granularity: 'word' })).segment(raw)]
        .map((s: any) => s.segment).filter((s: string) => s.trim() && isChinese(s));
    } else {
      segs = raw.split('').filter(s => isChinese(s));
    }
    const shuffled = [...segs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setPoolBlocks(shuffled); setSelBlocks([]);
  }, []);

  const segmentResult = (q: Question): React.ReactNode[] => {
    const parts = q.zh.includes('|') ? q.zh.split('|') : q.zh.split('');
    return parts.map((seg, i) =>
      isChinese(seg)
        ? <span key={i} className="zh-word" style={{ cursor: 'default' }}>{seg}</span>
        : <span key={i}>{seg}</span>
    );
  };

  const nextQuestion = useCallback((forceFirst = false) => {
    setReviewing(false); setShowResult(false); setAnswer(''); setSelBlocks([]);
    let nh = [...history], ni = curIdx;
    if (forceFirst) {
      if (pool.length === 0) return;
      const q = pool[Math.floor(Math.random() * pool.length)];
      nh = [q]; ni = 0; setHistory(nh); setCurIdx(ni); setupBlocks(q);
      setTimeout(() => inputRef.current?.focus(), 80); return;
    }
    if (ni >= nh.length - 1) {
      if (pool.length === 0) { saveLessonScore(exp, maxCombo); return; }
      const q = pool[Math.floor(Math.random() * pool.length)];
      nh = [...nh, q]; ni = nh.length - 1;
    } else { ni++; }
    setHistory(nh); setCurIdx(ni); setupBlocks(nh[ni]);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [history, curIdx, pool, exp, maxCombo, setupBlocks]);

  useEffect(() => {
    if (questions.length > 0 && curIdx === -1 && selUnit !== '') nextQuestion(true);
  }, [questions, curIdx, selUnit]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (selUnit === '') return;
      if (e.key === 'Enter') { e.preventDefault(); reviewing ? nextQuestion() : checkAnswer(); }
      if (e.key === 'Control') { e.preventDefault(); if (curIdx >= 0 && history[curIdx]) speak(history[curIdx].zh.replace(/\|/g, '')); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selUnit, reviewing, history, curIdx, practiceMode, selBlocks, answer]);

  const checkAnswer = async () => {
    if (curIdx < 0) return;
    const q = history[curIdx];
    const ua = (practiceMode === 'typing' ? answer : selBlocks.join('')).trim();
    const clean = (s: string) => s.toLowerCase().replace(/[.，。！？!?,;:'"|]/g, '').replace(/\s+/g, '');
    const ok = !!(clean(ua) === clean(q.zh) || (q.pinyin && q.pinyin !== '...' && clean(ua) === clean(q.pinyin)));
    setIsCorrect(ok); setShowResult(true); setReviewing(true);
    setResultChinese(segmentResult(q));
    try { setResultPinyin(q.pinyin && q.pinyin !== '...' ? q.pinyin : pinyin(q.zh.replace(/\|/g, ''), { toneType: 'symbol', type: 'string' })); } catch (_) {}
    if (ok) {
      const ne = exp + 10, nc = combo + 1;
      setExp(ne); setCombo(nc);
      if (nc > maxCombo) setMaxCombo(nc);
      onExpGain(10);
      await saveQuestionCompletion(q.id);
      const np = pool.filter(x => x.id !== q.id); setPool(np); setDoneCount(questions.length - np.length);
    } else {
      setCombo(0); setMistakes(m => m + 1);
      inputRef.current?.classList.add('shake');
      setTimeout(() => inputRef.current?.classList.remove('shake'), 400);
    }
    speak(q.zh.replace(/\|/g, ''));
  };

  const openCourse = async (name: string) => {
    setLoading(true);
    setSelCourse(name); setSelUnit('');
    const r = await getUnitList(name);
    if (r.success && r.units) setUnits(r.units);
    setLoading(false);
  };

  const startUnit = async (unit: string) => {
    setLoading(true);
    setSelUnit(unit);
    const r = await getUnitQuestions(selCourse, unit);
    if (r.success && r.questions) {
      setQuestions(r.questions);
      const done = new Set(r.completedIds || []);
      const p = r.questions.filter((q: Question) => !done.has(q.id));
      setPool(p.length ? p : [...r.questions]);
      setHistory([]); setCurIdx(-1); setDoneCount(r.questions.length - p.length);
      setExp(0); setCombo(0); setMaxCombo(0); setMistakes(0);
    }
    setLoading(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-primary">
      <div className="spinner" />
      <span className="font-extrabold text-sm">Đang tải nội dung...</span>
    </div>
  );

  // ─── Course selection ───────────────────────────────────────────────────
  if (selCourse === '') return (
    <div>
      <div style={{ fontWeight: 800, fontSize: '1.15rem', marginBottom: '.25rem' }}>Luyện phản xạ dịch câu</div>
      <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
        Nghe Việt → gõ Hán / ghép khối từ theo phản xạ
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {courses.map(c => {
          const pct = c.total > 0 ? Math.round(c.completed / c.total * 100) : 0;
          return (
            <div key={c.name} className="course-card jade-card" onClick={() => openCourse(c.name)}>
              <div className="flex justify-between items-start">
                <span className="course-card-title">{c.name}</span>
                <ChevronRight size={16} style={{ color: 'var(--text-faint)' }} />
              </div>
              <span className="course-card-meta">{c.total} câu · đã thuộc {c.completed}</span>
              <div className="mt-3">
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between" style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--primary)', marginTop: '.25rem' }}>
                  <span>Tiến trình</span><span>{pct}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─── Unit selection ─────────────────────────────────────────────────────
  if (selUnit === '') return (
    <div>
      <button className="btn-ghost mb-4" onClick={() => setSelCourse('')}><ChevronLeft size={14} />Các bộ chủ đề</button>
      <h1 style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--primary)', marginBottom: '.2rem' }}>{selCourse}</h1>
      <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Chọn bài học để bắt đầu</p>
      <div className="units-grid">
        {units.map(u => {
          const done = u.completed >= u.total && u.total > 0;
          return (
            <div key={u.name} className="unit-card" style={done ? { borderColor: 'var(--primary)' } : {}} onClick={() => startUnit(u.name)}>
              <span className="unit-card-title">{u.name}</span>
              <span className="unit-card-meta">{u.total} câu · đã thuộc {u.completed}/{u.total}</span>
              {done && <span className="unit-card-done"><CheckCircle2 size={13} />Hoàn thành</span>}
            </div>
          );
        })}
      </div>
    </div>
  );

  const cur = curIdx >= 0 ? history[curIdx] : null;
  const finished = pool.length === 0 && history.length > 0 && !reviewing;

  // ─── Victory ─────────────────────────────────────────────────────────────
  if (finished) return (
    <div className="jade-card p-10 text-center max-w-md mx-auto">
      <div style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--primary)' }}>Xong bài! 🎉</div>
      <div style={{ fontSize: '3rem', margin: '.75rem 0' }}>🏆</div>
      <div className="flex justify-center gap-8 mb-6">
        <div className="text-center">
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>+{exp}</div>
          <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>XP</div>
        </div>
        <div className="text-center" style={{ borderLeft: '1px solid var(--card-border)', paddingLeft: '2rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>{maxCombo}</div>
          <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Max combo</div>
        </div>
      </div>
      <button className="btn-primary w-full py-3 text-base" onClick={() => setSelUnit('')}>Quay lại bài học</button>
    </div>
  );

  // ─── Practice arena ───────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button className="btn-ghost" onClick={() => setSelUnit('')}><ChevronLeft size={14} />Bài học</button>
        <span style={{ fontSize: '.78rem', fontWeight: 700, background: 'var(--primary-light)', color: 'var(--primary)', padding: '.2rem .75rem', borderRadius: '999px' }}>
          {selCourse} · {selUnit}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Main */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {/* Prompt */}
          <div className="jade-card p-5 text-center">
            <div className="prompt-vi-label">Dịch sang tiếng Trung</div>
            {cur && <div className="prompt-vi-text">{cur.vi}</div>}
          </div>

          {/* Input */}
          {practiceMode === 'typing' ? (
            <input ref={inputRef} type="text" className="typing-input"
              placeholder="Gõ chữ Hán hoặc Pinyin..."
              value={answer} onChange={e => setAnswer(e.target.value)} disabled={reviewing} autoFocus />
          ) : (
            <div>
              <div className="construction-target">
                {selBlocks.map((b, i) => (
                  <div key={i} className="word-block in-target" onClick={() => {
                    setSelBlocks(p => p.filter((_, j) => j !== i));
                    setPoolBlocks(p => [...p, b]);
                  }}>{b}</div>
                ))}
                {!selBlocks.length && <span style={{ fontSize: '.82rem', color: 'var(--text-faint)' }}>Bấm từ bên dưới để ghép câu</span>}
              </div>
              <div className="construction-pool">
                {poolBlocks.map((b, i) => (
                  <div key={i} className="word-block" onClick={() => {
                    setPoolBlocks(p => p.filter((_, j) => j !== i));
                    setSelBlocks(p => [...p, b]);
                  }}>{b}</div>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {showResult && (
            <div className="result-box" style={{
              background: isCorrect ? 'var(--success-bg)' : 'var(--error-bg)',
              border: `1px solid ${isCorrect ? 'var(--success-color)' : 'var(--error-color)'}`,
            }}>
              <div className="result-status" style={{ color: isCorrect ? 'var(--success-color)' : 'var(--error-color)' }}>
                {isCorrect ? 'Chính xác! ✓' : 'Chưa chính xác!'}
              </div>
              <div className="result-chinese-sentence zh">{resultChinese}</div>
              {resultPinyin && <div className="result-pinyin-sentence">{resultPinyin}</div>}
            </div>
          )}

          {/* Controls */}
          <button className="btn-check-main" onClick={reviewing ? () => nextQuestion() : checkAnswer}>
            {reviewing ? 'Câu tiếp theo (Enter)' : 'Kiểm tra (Enter)'}
          </button>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button className="btn-audio-play" onClick={() => cur && speak(cur.zh.replace(/\|/g, ''))}>
                <Volume2 size={14} />
              </button>
              <select className="audio-speed-select" value={audioRate} onChange={e => setAudioRate(+e.target.value)}>
                <option value=".75">Chậm</option>
                <option value="1">Bình thường</option>
                <option value="1.25">Nhanh</option>
              </select>
              <select className="voice-select" value={voiceIdx} onChange={e => setVoiceIdx(e.target.value)}>
                <option value="">Giọng mặc định</option>
                {voices.map((v, i) => <option key={i} value={i}>{v.name.replace(/(Google|Microsoft|Apple|Desktop)/gi, '').trim()}</option>)}
              </select>
            </div>
            <select className="mode-select" value={practiceMode}
              onChange={e => { setPracticeMode(e.target.value as any); if (cur) setupBlocks(cur); }}
              disabled={reviewing}>
              <option value="typing">Nhập chữ</option>
              <option value="construction">Ghép khối</option>
            </select>
          </div>
        </div>

        {/* Stats sidebar */}
        <div className="flex flex-col gap-4">
          <div className="jade-card p-4">
            <div style={{ fontWeight: 700, fontSize: '.85rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '.5rem', marginBottom: '.75rem' }}>
              Tiến độ bài
            </div>
            <div className="progress-bar-container mb-2">
              <div className="progress-bar-fill" style={{ width: `${questions.length > 0 ? (doneCount / questions.length) * 100 : 0}%` }} />
            </div>
            <div className="flex flex-col gap-2">
              {[
                { lbl: 'EXP hôm nay', val: `+${exp}`, c: 'var(--primary)' },
                { lbl: 'Combo', val: `🔥 ${combo}`, c: 'orange' },
                { lbl: 'Sai', val: `❌ ${mistakes}`, c: 'var(--error-color)' },
                { lbl: 'Xong', val: `${doneCount}/${questions.length}`, c: '' },
              ].map(s => (
                <div key={s.lbl} className="flex justify-between items-center">
                  <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.lbl}</span>
                  <span style={{ fontSize: '.875rem', fontWeight: 700, color: s.c || 'var(--text-main)' }}>{s.val}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="jade-card p-4">
            <div style={{ fontWeight: 700, fontSize: '.82rem', marginBottom: '.4rem' }}>💡 Mẹo</div>
            <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Gõ Pinyin không dấu hoặc chữ Hán đều được. <br />
              Enter = kiểm tra / Ctrl = phát âm.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
