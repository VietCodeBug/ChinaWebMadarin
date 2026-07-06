'use strict';
'use server';

import { query } from '@/lib/db';
import { getCurrentUser, loginUser, registerUser, logout } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { Passage } from './types';

// Authentication Actions
export async function registerNewUser(email: string, password: string, displayName: string) {
  try {
    const user = await registerUser(email, password, displayName);
    revalidatePath('/');
    return { success: true, user };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to register" };
  }
}

export async function loginUserAction(email: string, password: string) {
  try {
    const user = await loginUser(email, password);
    revalidatePath('/');
    return { success: true, user };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to login" };
  }
}

export async function logoutUser() {
  await logout();
  revalidatePath('/');
  return { success: true };
}

// Course Dashboard & Global Stats
export async function getCourseList() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    // Get unique sheets and question counts
    const sheetsRes = await query(`
      SELECT sheet_name, COUNT(*) as total_count 
      FROM questions 
      GROUP BY sheet_name
      ORDER BY sheet_name
    `);

    // Get completed questions count per sheet for this user
    const progressRes = await query(`
      SELECT q.sheet_name, COUNT(up.id) as completed_count 
      FROM user_progress up
      JOIN questions q ON up.question_id = q.id
      WHERE up.user_id = $1::varchar
      GROUP BY q.sheet_name
    `, [user.id]);

    const progressMap = new Map(progressRes.rows.map(r => [r.sheet_name, parseInt(r.completed_count, 10)]));

    const courses = sheetsRes.rows.map(row => {
      const sheetName = row.sheet_name;
      const total = parseInt(row.total_count, 10);
      const completed = progressMap.get(sheetName) || 0;
      return {
        name: sheetName,
        total,
        completed
      };
    });

    // Get SRS due count
    const srsDueRes = await query(`
      SELECT COUNT(*) as due_count 
      FROM user_flashcards 
      WHERE user_id = $1::varchar AND next_review <= NOW()
    `, [user.id]);
    const srsDueCount = parseInt(srsDueRes.rows[0]?.due_count || '0', 10);

    // Get Personal Vocab Count
    const vocabRes = await query(`
      SELECT COUNT(*) as vocab_count 
      FROM user_vocab 
      WHERE user_id = $1::varchar
    `, [user.id]);
    const vocabCount = parseInt(vocabRes.rows[0]?.vocab_count || '0', 10);

    return { 
      success: true, 
      courses, 
      user, 
      stats: {
        srsDueCount,
        vocabCount
      } 
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Unit list actions
export async function getUnitList(sheetName: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    // Get unique units and question counts
    const unitsRes = await query(`
      SELECT unit_name, COUNT(*) as total_count 
      FROM questions 
      WHERE sheet_name = $1
      GROUP BY unit_name
      ORDER BY unit_name
    `, [sheetName]);

    // Get completed questions count per unit for this user
    const progressRes = await query(`
      SELECT q.unit_name, COUNT(up.id) as completed_count 
      FROM user_progress up
      JOIN questions q ON up.question_id = q.id
      WHERE up.user_id = $1::varchar AND q.sheet_name = $2
      GROUP BY q.unit_name
    `, [user.id, sheetName]);

    const progressMap = new Map(progressRes.rows.map(r => [r.unit_name, parseInt(r.completed_count, 10)]));

    const units = unitsRes.rows.map(row => {
      const unitName = row.unit_name;
      const total = parseInt(row.total_count, 10);
      const completed = progressMap.get(unitName) || 0;
      return {
        name: unitName,
        total,
        completed
      };
    });

    return { success: true, units, user };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Get practice questions
export async function getUnitQuestions(sheetName: string, unitName: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const res = await query(`
      SELECT id, sheet_name, unit_name, vi, zh, pinyin, vi_plus as "viPlus", type 
      FROM questions 
      WHERE sheet_name = $1 AND unit_name = $2
    `, [sheetName, unitName]);

    const progressRes = await query(`
      SELECT question_id 
      FROM user_progress 
      WHERE user_id = $1::varchar
    `, [user.id]);
    
    const completedIds = new Set(progressRes.rows.map(r => r.question_id));

    return { success: true, questions: res.rows, completedIds: Array.from(completedIds), user };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Save question progress & user stats
export async function saveQuestionCompletion(questionId: number) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    await query(`
      INSERT INTO user_progress (user_id, question_id) 
      VALUES ($1::varchar, $2)
      ON CONFLICT (user_id, question_id) DO NOTHING
    `, [user.id, questionId]);

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function saveLessonScore(expGained: number, maxCombo: number) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    await query(`
      UPDATE "user"
      SET exp = exp + $1,
          max_combo = GREATEST(max_combo, $2)
      WHERE id = $3::varchar
    `, [expGained, maxCombo, user.id]);

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Personal Vocab (Từ vựng cá nhân) Actions
export async function saveToVocab(word: string, pinyin: string, meaning: string, folderId?: number) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    await query(`
      INSERT INTO user_vocab (user_id, word, pinyin, meaning, folder_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, word) DO UPDATE
      SET pinyin = EXCLUDED.pinyin, meaning = EXCLUDED.meaning, folder_id = EXCLUDED.folder_id
    `, [user.id, word.trim(), pinyin.trim(), meaning.trim(), folderId || null]);
    
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getVocabList(folderId?: number) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    let q = `
      SELECT id, word, pinyin, meaning, status, folder_id as "folderId", created_at as "createdAt"
      FROM user_vocab
      WHERE user_id = $1::varchar
    `;
    const params: any[] = [user.id];
    
    if (folderId !== undefined && folderId !== null) {
      q += ` AND folder_id = $2`;
      params.push(folderId);
    }
    
    q += ` ORDER BY created_at DESC`;
    
    const res = await query(q, params);
    return { success: true, vocab: res.rows };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteFromVocab(vocabId: number) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    await query(`
      DELETE FROM user_vocab WHERE id = $1 AND user_id = $2::varchar
    `, [vocabId, user.id]);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Spaced Repetition (SRS) Flashcards Actions
export async function addFlashcard(zh: string, vi: string, pinyin: string, folderId?: number) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    await query(`
      INSERT INTO user_flashcards (user_id, zh, vi, pinyin, folder_id)
      VALUES ($1::varchar, $2, $3, $4, $5)
    `, [user.id, zh.trim(), vi.trim(), pinyin.trim(), folderId || null]);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getFlashcardsDue(folderId?: number) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    let q = `
      SELECT id, zh, vi, pinyin, interval_days as "intervalDays", ease_factor as "easeFactor", next_review as "nextReview", folder_id as "folderId"
      FROM user_flashcards
      WHERE user_id = $1::varchar AND next_review <= NOW()
    `;
    const params: any[] = [user.id];
    
    if (folderId !== undefined && folderId !== null) {
      q += ` AND folder_id = $2`;
      params.push(folderId);
    }
    
    q += ` ORDER BY next_review ASC`;
    
    const res = await query(q, params);
    return { success: true, cards: res.rows };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function recordFlashcardReview(cardId: number, score: number) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    // 1. Fetch current card parameters
    const res = await query(`
      SELECT id, interval_days, ease_factor FROM user_flashcards
      WHERE id = $1 AND user_id = $2::varchar
    `, [cardId, user.id]);
    
    if (res.rows.length === 0) return { success: false, error: "Card not found" };
    
    const card = res.rows[0];
    let interval = card.interval_days;
    let ease = card.ease_factor;
    
    // 2. Anki SM-2 SRS Algorithm
    if (score === 1) { // Forgot / Again
      interval = 1;
      ease = Math.max(1.3, ease - 0.2);
    } else if (score === 2) { // Good / Remembered
      interval = Math.max(1, Math.round(interval * ease));
    } else if (score === 3) { // Easy / Perfect
      interval = Math.max(1, Math.round(interval * ease * 1.5));
      ease = Math.min(3.5, ease + 0.15);
    }
    
    // 3. Update next review date
    await query(`
      UPDATE user_flashcards 
      SET interval_days = $1,
          ease_factor = $2,
          next_review = NOW() + INTERVAL '1 day' * $1
      WHERE id = $3 AND user_id = $4::varchar
    `, [interval, ease, cardId, user.id]);
    
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Preset Reading passages for HSK
export async function getReadingPassages() {
  try {
    const res = await query(`
      SELECT 
        id, 
        category, 
        group_name as "groupName", 
        chapter_number as "chapterNumber", 
        title, 
        zh, 
        vi 
      FROM passages
      ORDER BY category ASC, group_name ASC, chapter_number ASC, id ASC
    `);
    return { success: true, passages: res.rows as Passage[] };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── HSK Vocabulary Catalog Actions ───
export async function getHSK30Stats() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    // Per-level count
    const levelRes = await query(`
      SELECT level, COUNT(*) as cnt FROM hsk30_vocab GROUP BY level ORDER BY level
    `);
    const levelCounts: Record<string, number> = {};
    let totalCount = 0;
    for (const row of levelRes.rows) {
      levelCounts[row.level] = parseInt(row.cnt, 10);
      totalCount += parseInt(row.cnt, 10);
    }

    const addedRes = await query(`
      SELECT COUNT(DISTINCT zh) as cnt FROM user_flashcards WHERE user_id = $1::varchar
    `, [user.id]);
    const addedCount = parseInt(addedRes.rows[0]?.cnt || '0', 10);

    return { success: true, totalCount, addedCount, levelCounts };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getHSK30DeckWords(level: string, deckIndex: number) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const limit = 50;
    const offset = deckIndex * limit;

    const vocabRes = await query(`
      SELECT id, word, pinyin, word_type as "wordType", meaning,
             example_zh as "exampleZh", example_pinyin as "examplePinyin", example_vi as "exampleVi", level
      FROM hsk30_vocab
      WHERE level = $1
      ORDER BY id ASC
      LIMIT $2 OFFSET $3
    `, [level, limit, offset]);

    const addedRes = await query(`
      SELECT DISTINCT zh FROM user_flashcards WHERE user_id = $1::varchar
    `, [user.id]);
    const addedWords = new Set(addedRes.rows.map(r => r.zh.trim()));

    const words = vocabRes.rows.map(row => ({
      ...row,
      isAdded: addedWords.has(row.word.trim())
    }));

    return { success: true, words };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function addHSK30WordToFlashcards(wordId: number, folderId?: number) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const res = await query(`
      SELECT word, pinyin, meaning FROM hsk30_vocab WHERE id = $1
    `, [wordId]);
    if (res.rows.length === 0) return { success: false, error: "Word not found" };
    const word = res.rows[0];

    // Ignore duplicate
    await query(`
      INSERT INTO user_flashcards (user_id, zh, vi, pinyin, folder_id)
      VALUES ($1::varchar, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
    `, [user.id, word.word.trim(), word.meaning.trim(), word.pinyin.trim(), folderId || null]);

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Real-data daily activity for Dashboard chart (last 7 days EXP + questions answered)
export async function getDailyActivity() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    // Questions answered per day in last 7 days (localized to Vietnam timezone)
    const activityRes = await query(`
      SELECT
        TO_CHAR(completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as day,
        COUNT(*)::integer as questions_done
      FROM user_progress
      WHERE user_id = $1::varchar
        AND completed_at >= NOW() - INTERVAL '7 days'
      GROUP BY day
      ORDER BY day ASC
    `, [user.id]);

    // Build a map of day -> count for last 7 calendar days in Vietnam (UTC+7)
    const today = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const days: { label: string; value: number; date: string }[] = [];
    const dowLabels = ['CN','T2','T3','T4','T5','T6','T7'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - i);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const date = String(d.getUTCDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${date}`;
      const label = dowLabels[d.getUTCDay()];
      days.push({ label, value: 0, date: dateStr });
    }

    for (const row of activityRes.rows) {
      const entry = days.find(d => d.date === row.day);
      if (entry) entry.value = row.questions_done;
    }

    return { success: true, days };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// User Deck Study Progress Actions (for continue learning & Quizlet mode)
export async function saveDeckProgress(level: string, deckIndex: number, knownIds: number[], unknownIds: number[], isFinished: boolean) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    await query(`
      INSERT INTO user_deck_progress (user_id, level, deck_index, known_ids, unknown_ids, is_finished, updated_at)
      VALUES ($1::varchar, $2::varchar, $3, $4::integer[], $5::integer[], $6, NOW())
      ON CONFLICT (user_id, level, deck_index) DO UPDATE
      SET known_ids = EXCLUDED.known_ids,
          unknown_ids = EXCLUDED.unknown_ids,
          is_finished = EXCLUDED.is_finished,
          updated_at = NOW()
    `, [user.id, level, deckIndex, knownIds, unknownIds, isFinished]);
    
    // Only revalidate dashboard path when the deck is completed, to save network bandwidth and server CPU!
    if (isFinished) {
      revalidatePath('/');
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getInProgressDecks() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const res = await query(`
      SELECT id, level, deck_index as "deckIndex", known_ids as "knownIds", unknown_ids as "unknownIds", is_finished as "isFinished", updated_at as "updatedAt"
      FROM user_deck_progress
      WHERE user_id = $1::varchar AND is_finished = false
      ORDER BY updated_at DESC
    `, [user.id]);
    return { success: true, decks: res.rows };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getDeckProgress(level: string, deckIndex: number) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const res = await query(`
      SELECT level, deck_index as "deckIndex", known_ids as "knownIds", unknown_ids as "unknownIds", is_finished as "isFinished"
      FROM user_deck_progress
      WHERE user_id = $1::varchar AND level = $2 AND deck_index = $3
    `, [user.id, level, deckIndex]);
    
    if (res.rows.length > 0) {
      return { success: true, progress: res.rows[0] };
    }
    return { success: true, progress: null };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Folder/Topic Management actions
export async function createFolder(name: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const res = await query(`
      INSERT INTO user_folders (user_id, name)
      VALUES ($1::varchar, $2::varchar)
      RETURNING id, name
    `, [user.id, name.trim()]);
    return { success: true, folder: res.rows[0] };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getFolders() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const res = await query(`
      SELECT id, name, created_at as "createdAt"
      FROM user_folders
      WHERE user_id = $1::varchar
      ORDER BY name ASC
    `, [user.id]);
    return { success: true, folders: res.rows };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteFolder(folderId: number) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    await query(`
      DELETE FROM user_folders
      WHERE id = $1 AND user_id = $2::varchar
    `, [folderId, user.id]);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}




