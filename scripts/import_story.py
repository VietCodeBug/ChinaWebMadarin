import os
import sys
import re
import argparse
import json
import urllib.parse
import requests
from bs4 import BeautifulSoup
import psycopg2

# Support UTF-8 output on Windows terminal
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def load_db_url():
    """Load DATABASE_URL from .env.local file in the project root."""
    # Look for .env.local in the current directory or parent directory
    paths = [".env.local", "../.env.local"]
    for path in paths:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith("DATABASE_URL="):
                        val = line.split("=", 1)[1].strip()
                        # Strip optional quotes
                        if val.startswith('"') and val.endswith('"'):
                            val = val[1:-1]
                        elif val.startswith("'") and val.endswith("'"):
                            val = val[1:-1]
                        return val
    return None

def translate_to_vietnamese(text):
    """Translate Chinese text to Vietnamese using Google Translate free web API."""
    try:
        url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=vi&dt=t&q={urllib.parse.quote(text)}"
        res = requests.get(url, timeout=10)
        data = res.json()
        translated = "".join([part[0] for part in data[0] if part[0]])
        return translated
    except Exception as e:
        print(f"Translation warning for '{text[:20]}...':", e)
        return ""

def scrape_hsk_story(url):
    """Scrape a chapter from hskstory.com."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    print(f"Fetching story page from: {url}...")
    r = requests.get(url, headers=headers)
    if r.status_code != 200:
        raise Exception(f"Failed to fetch URL, HTTP Status: {r.status_code}")
        
    soup = BeautifulSoup(r.text, 'html.parser')
    
    # Extract Title
    title_tag = soup.find('title')
    title_text = ""
    if title_tag:
        # Title usually is "Chapter Title - Story Name | HSKStory"
        title_text = title_tag.get_text().split(" - ")[0].strip()
        
    article = soup.find('article', {'data-testid': 'reader-content'})
    if not article:
        raise Exception("Could not find story article structure (<article data-testid='reader-content'>). Make sure it is a valid HSKStory chapter URL.")
        
    paragraphs_zh = []
    paragraphs_vi = []
    
    p_tags = article.find_all('p')
    print(f"Found {len(p_tags)} paragraphs. Translating to Vietnamese...")
    for idx, p in enumerate(p_tags):
        # Remove pinyin pronunciation tags (<rt>)
        for rt in p.find_all('rt'):
            rt.decompose()
        # Get clean Chinese characters
        zh_text = p.get_text().strip()
        zh_text = re.sub(r'\s+', '', zh_text) # strip spaces inside Chinese sentences
        if zh_text:
            paragraphs_zh.append(zh_text)
            vi_text = translate_to_vietnamese(zh_text)
            paragraphs_vi.append(vi_text)
            print(f"  [{idx+1}/{len(p_tags)}] Translated paragraph.")
            
    zh_full = "\n".join(paragraphs_zh)
    vi_full = "\n".join(paragraphs_vi)
    
    return title_text, zh_full, vi_full

def insert_passage(conn, category, group_name, chapter_number, title, zh, vi):
    """Insert or update a passage inside the PostgreSQL passages table."""
    cur = conn.cursor()
    
    # Check if entry already exists to avoid duplication
    cur.execute("""
        SELECT id FROM passages 
        WHERE category = %s AND group_name = %s AND chapter_number = %s AND title = %s
    """, (category, group_name, chapter_number, title))
    existing = cur.fetchone()
    
    if existing:
        print(f"Updating existing passage (ID: {existing[0]})...")
        cur.execute("""
            UPDATE passages 
            SET zh = %s, vi = %s
            WHERE id = %s
        """, (zh, vi, existing[0]))
    else:
        print("Inserting new passage...")
        cur.execute("""
            INSERT INTO passages (category, group_name, chapter_number, title, zh, vi)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (category, group_name, chapter_number, title, zh, vi))
        
    conn.commit()
    cur.close()
    print("Database sync completed successfully!")

def main():
    parser = argparse.ArgumentParser(description="Scholar Story Importer CLI Tool")
    parser.add_argument("--url", help="URL of the chapter to scrape from hskstory.com")
    parser.add_argument("--file", help="Path to a local JSON file containing story details")
    parser.add_argument("--category", default="novel", help="Category: 'novel' (default), 'hsk', or 'topic'")
    parser.add_argument("--group", help="Story name / Group name (required for URL scrape mode)")
    parser.add_argument("--chapter", type=int, help="Chapter number (required for URL scrape mode)")
    
    args = parser.parse_args()
    
    if not args.url and not args.file:
        parser.print_help()
        sys.exit(1)
        
    db_url = load_db_url()
    if not db_url:
        print("Error: DATABASE_URL not found in .env.local. Please make sure the file exists and is populated.")
        sys.exit(1)
        
    print("Connecting to database...")
    conn = psycopg2.connect(db_url)
    
    try:
        if args.url:
            if not args.group or args.chapter is None:
                print("Error: When using --url, you must also provide --group (e.g. 'The Running Partner (公园里的微笑)') and --chapter (e.g. 1).")
                sys.exit(1)
                
            title, zh, vi = scrape_hsk_story(args.url)
            insert_passage(conn, args.category, args.group, args.chapter, title, zh, vi)
            
        elif args.file:
            print(f"Reading JSON file: {args.file}...")
            with open(args.file, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            # Can be a single story object or a list of stories
            stories = data if isinstance(data, list) else [data]
            
            for idx, story in enumerate(stories):
                print(f"\nProcessing story {idx+1}/{len(stories)}: {story.get('title')}...")
                category = story.get("category", args.category)
                group_name = story.get("group_name")
                chapter_number = story.get("chapter_number")
                title = story.get("title")
                zh = story.get("zh")
                vi = story.get("vi")
                
                if not group_name or not title or not zh or not vi:
                    print("Error: JSON objects must contain 'group_name', 'title', 'zh', and 'vi' fields. Skipping.")
                    continue
                    
                insert_passage(conn, category, group_name, chapter_number, title, zh, vi)
                
    except Exception as e:
        print("\nAn error occurred:")
        print(e)
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
