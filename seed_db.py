import json
import psycopg2
import psycopg2.extras
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

conn_str = "postgres://neondb_owner:npg_qprDB3awj6QT@ep-fragrant-heart-atksytee-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
json_file = "dictation_data.json"
schema_file = "schema.sql"

def main():
    # 1. Connect to Neon DB
    print("Connecting to Neon PostgreSQL...")
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    
    # Drop existing tables to ensure schema modifications are applied
    print("Dropping existing tables to re-apply schema...")
    cur.execute("DROP TABLE IF EXISTS user_progress CASCADE;")
    cur.execute("DROP TABLE IF EXISTS questions CASCADE;")
    cur.execute("DROP TABLE IF EXISTS users CASCADE;")
    conn.commit()
    
    # 2. Run schema.sql
    print(f"Creating tables using {schema_file}...")
    with open(schema_file, 'r', encoding='utf-8') as f:
        schema_sql = f.read()
    cur.execute(schema_sql)
    conn.commit()
    print("Tables created successfully!")

    # 4. Load dictation_data.json
    print(f"Loading {json_file}...")
    with open(json_file, 'r', encoding='utf-8') as f:
        all_data = json.load(f)
        
    # 5. Prepare batch insert array
    insert_records = []
    for sheet_name, items in all_data.items():
        for item in items:
            insert_records.append((
                sheet_name,
                item.get("unit", "Chung"),
                item.get("vi", ""),
                item.get("zh", ""),
                item.get("pinyin", ""),
                item.get("viPlus", ""),
                item.get("type", "free")
            ))
            
    print(f"Seeding {len(insert_records)} questions to database...")
    
    # Execute batch insert using execute_values
    insert_query = """
        INSERT INTO questions (sheet_name, unit_name, vi, zh, pinyin, vi_plus, type) 
        VALUES %s
    """
    
    # Use execute_values for extreme performance (reduces roundtrips)
    psycopg2.extras.execute_values(
        cur, 
        insert_query, 
        insert_records, 
        template="(%s, %s, %s, %s, %s, %s, %s)",
        page_size=1000
    )
    conn.commit()
    
    # Verification
    cur.execute("SELECT COUNT(*) FROM questions")
    count = cur.fetchone()[0]
    print(f"Seeding verified. Row count in database: {count}")
    
    cur.close()
    conn.close()
    print("SUCCESS: Database seeding completed successfully!")

if __name__ == "__main__":
    main()
