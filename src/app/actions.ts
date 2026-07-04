'use strict';
'use server';

import { query } from '@/lib/db';
import { getCurrentUser, loginUser, registerUser, logout } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

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
      WHERE up.user_id = $1
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
      WHERE user_id = $1 AND next_review <= NOW()
    `, [user.id]);
    const srsDueCount = parseInt(srsDueRes.rows[0]?.due_count || '0', 10);

    // Get Personal Vocab Count
    const vocabRes = await query(`
      SELECT COUNT(*) as vocab_count 
      FROM user_vocab 
      WHERE user_id = $1
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
      WHERE up.user_id = $1 AND q.sheet_name = $2
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
      WHERE user_id = $1
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
      VALUES ($1, $2)
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
      UPDATE users 
      SET exp = exp + $1,
          max_combo = GREATEST(max_combo, $2)
      WHERE id = $3
    `, [expGained, maxCombo, user.id]);

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Personal Vocab (Từ vựng cá nhân) Actions
export async function saveToVocab(word: string, pinyin: string, meaning: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    await query(`
      INSERT INTO user_vocab (user_id, word, pinyin, meaning)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, word) DO UPDATE
      SET pinyin = EXCLUDED.pinyin, meaning = EXCLUDED.meaning
    `, [user.id, word.trim(), pinyin.trim(), meaning.trim()]);
    
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getVocabList() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const res = await query(`
      SELECT id, word, pinyin, meaning, status, created_at as "createdAt"
      FROM user_vocab
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [user.id]);
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
      DELETE FROM user_vocab WHERE id = $1 AND user_id = $2
    `, [vocabId, user.id]);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Spaced Repetition (SRS) Flashcards Actions
export async function addFlashcard(zh: string, vi: string, pinyin: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    await query(`
      INSERT INTO user_flashcards (user_id, zh, vi, pinyin)
      VALUES ($1, $2, $3, $4)
    `, [user.id, zh.trim(), vi.trim(), pinyin.trim()]);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getFlashcardsDue() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const res = await query(`
      SELECT id, zh, vi, pinyin, interval_days as "intervalDays", ease_factor as "easeFactor", next_review as "nextReview"
      FROM user_flashcards
      WHERE user_id = $1 AND next_review <= NOW()
      ORDER BY next_review ASC
    `, [user.id]);
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
      WHERE id = $1 AND user_id = $2
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
      WHERE id = $3 AND user_id = $4
    `, [interval, ease, cardId, user.id]);
    
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Preset Reading passages for HSK
export async function getReadingPassages() {
  const passages = [
    {
      id: 1,
      level: "HSK1",
      title: "Lời chào và gia đình (Chào hỏi)",
      zh: "你好|！|我|叫|王明|。|我|家|有|三|口|人|，|爸爸|、|妈妈|和|我|。|我们|住在|北京|。|我|喜欢|喝|茶|，|妈妈|喜欢|喝|咖啡|。|你|家|有|几|口|人|？",
      vi: "Chào bạn! Tôi tên là Vương Minh. Nhà tôi có ba người, bố, mẹ và tôi. Chúng tôi sống ở Bắc Kinh. Tôi thích uống trà, mẹ thích uống cà phê. Nhà bạn có mấy người?",
    },
    {
      id: 2,
      level: "HSK2",
      title: "Thời tiết và kỳ nghỉ (Du lịch)",
      zh: "今天|天气|非常好|。|我和|朋友|打算|去|商店|买|一些|新|衣服|，|然后|去|公园|跑步|。|明天|是|星期六|，|我们|想|去|旅游|。|听说|明天|会|下雨|，|所以|我们|准备|带|雨伞|。|你|喜欢|下雨天|吗|？",
      vi: "Hôm nay thời tiết rất tốt. Tôi và bạn bè dự định đi cửa hàng mua một ít quần áo mới, sau đó đi công viên chạy bộ. Ngày mai là thứ Bảy, chúng tôi muốn đi du lịch. Nghe nói ngày mai trời sẽ mưa, nên chúng tôi chuẩn bị mang ô. Bạn có thích ngày mưa không?",
    },
    {
      id: 3,
      level: "HSK3",
      title: "Một ngày làm việc bận rộn (Công sở)",
      zh: "我|每天|早上|七点|起床|，|然后|坐|地铁|去|公司|上班|。|虽然|工作|很忙|，|但是|同事|们|都|非常|热情|，|经常|帮助|我|。|中午|我们|在|公司的|食堂|吃|午饭|。|下班|以后|，|我|喜欢|去|图书馆|看|一些|历史|书|。|只有|不断|学习|，|才能|提高|自己|的|能力|。",
      vi: "Mỗi ngày tôi dậy lúc bảy giờ sáng, sau đó đi tàu điện ngầm đến công ty làm việc. Mặc dù công việc rất bận rộn, nhưng các đồng nghiệp đều rất nhiệt tình, thường giúp đỡ tôi. Buổi trưa chúng tôi ăn trưa ở nhà ăn công ty. Sau khi tan làm, tôi thích đi thư viện đọc sách lịch sử. Chỉ có không ngừng học hỏi mới nâng cao được năng lực của bản thân.",
    }
  ];
  
  return { success: true, passages };
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
      SELECT COUNT(DISTINCT zh) as cnt FROM user_flashcards WHERE user_id = $1
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
      SELECT DISTINCT zh FROM user_flashcards WHERE user_id = $1
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

export async function addHSK30WordToFlashcards(wordId: number) {
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
      INSERT INTO user_flashcards (user_id, zh, vi, pinyin)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
    `, [user.id, word.word.trim(), word.meaning.trim(), word.pinyin.trim()]);

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
    // Questions answered per day in last 7 days
    const activityRes = await query(`
      SELECT
        DATE(completed_at) as day,
        COUNT(*) as questions_done
      FROM user_progress
      WHERE user_id = $1
        AND completed_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(completed_at)
      ORDER BY day ASC
    `, [user.id]);

    // Build a map of day -> count for last 7 calendar days
    const today = new Date();
    const days: { label: string; value: number; date: string }[] = [];
    const dowLabels = ['CN','T2','T3','T4','T5','T6','T7'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
      const label = dowLabels[d.getDay()];
      days.push({ label, value: 0, date: dateStr });
    }

    for (const row of activityRes.rows) {
      const rowDate = new Date(row.day).toISOString().split('T')[0];
      const entry = days.find(d => d.date === rowDate);
      if (entry) entry.value = parseInt(row.questions_done, 10);
    }

    return { success: true, days };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

