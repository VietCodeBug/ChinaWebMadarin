-- 1. Table to store Chinese dictation questions
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    sheet_name TEXT NOT NULL,
    unit_name TEXT NOT NULL,
    vi TEXT NOT NULL,
    zh TEXT NOT NULL,
    pinyin TEXT NOT NULL,
    vi_plus TEXT,
    type TEXT DEFAULT 'free'
);

-- 2. Table to store users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    exp INT DEFAULT 0,
    max_combo INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table to track user study progress
CREATE TABLE IF NOT EXISTS user_progress (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    question_id INT REFERENCES questions(id) ON DELETE CASCADE,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_question UNIQUE (user_id, question_id)
);
