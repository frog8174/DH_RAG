import sqlite3
import json
import datetime
from typing import List, Dict, Any, Optional

DB_NAME = "rag_logs.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Create logs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rag_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            query TEXT,
            params TEXT,
            prompt TEXT,
            response TEXT,
            raw_output TEXT,
            rating REAL,
            comment TEXT
        )
    """)
    
    # Create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user'
        )
    """)
    
    # Check if admin exists, if not create default admin/admin and user/user
    cursor.execute("SELECT * FROM users WHERE username = 'admin'")
    if not cursor.fetchone():
        cursor.execute("INSERT INTO users (username, password, role) VALUES ('admin', 'admin', 'admin')")
        cursor.execute("INSERT INTO users (username, password, role) VALUES ('user', 'user', 'user')")
        
    # Migrate: Add rating/comment columns if they don't exist (for existing DBs)
    try:
        cursor.execute("ALTER TABLE rag_logs ADD COLUMN rating REAL")
    except sqlite3.OperationalError:
        pass # Column likely exists
        
    try:
        cursor.execute("ALTER TABLE rag_logs ADD COLUMN comment TEXT")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE rag_logs ADD COLUMN refined_prompt TEXT")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE rag_logs ADD COLUMN username TEXT")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE rag_logs ADD COLUMN review_data TEXT")
    except sqlite3.OperationalError:
        pass

    conn.commit()
    conn.close()

def insert_log(query: str, params: Dict[str, Any], prompt: str, response: Any, raw_output: Optional[str], refined_prompt: Optional[str] = None, username: str = "anonymous", review_data: Optional[Any] = None):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    params_json = json.dumps(params, ensure_ascii=False)
    response_json = json.dumps(response, ensure_ascii=False) if isinstance(response, (dict, list)) else str(response)
    review_data_json = json.dumps(review_data, ensure_ascii=False) if review_data else None
    timestamp = datetime.datetime.now().isoformat()
    
    cursor.execute("""
        INSERT INTO rag_logs (timestamp, query, params, prompt, response, raw_output, refined_prompt, username, review_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (timestamp, query, params_json, prompt, response_json, raw_output, refined_prompt, username, review_data_json))
    
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return new_id

def update_feedback(log_id: int, rating: Optional[float], comment: Optional[str]):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    if rating is not None and comment is not None:
        cursor.execute("UPDATE rag_logs SET rating = ?, comment = ? WHERE id = ?", (rating, comment, log_id))
    elif rating is not None:
         cursor.execute("UPDATE rag_logs SET rating = ? WHERE id = ?", (rating, log_id))
    elif comment is not None:
         cursor.execute("UPDATE rag_logs SET comment = ? WHERE id = ?", (comment, log_id))
         
    conn.commit()
    conn.close()

# ... (update_feedback remains same) ...

def delete_log(log_id: int):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM rag_logs WHERE id = ?", (log_id,))
    conn.commit()
    conn.close()

def get_logs(limit: int = 50, username: Optional[str] = None, role: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if role == 'admin':
        cursor.execute("SELECT * FROM rag_logs ORDER BY id DESC LIMIT ?", (limit,))
    elif username:
        cursor.execute("SELECT * FROM rag_logs WHERE username = ? ORDER BY id DESC LIMIT ?", (username, limit))
    else:
        # Fallback for anonymous or public view (if desired, or empty)
        cursor.execute("SELECT * FROM rag_logs ORDER BY id DESC LIMIT ?", (limit,))
        
    rows = cursor.fetchall()
    
    logs = []
    for row in rows:
        try:
            response_parsed = json.loads(row["response"]) if row["response"] else None
        except (json.JSONDecodeError, TypeError):
            response_parsed = row["response"]
            
        review_data_parsed = None
        if "review_data" in row.keys() and row["review_data"]:
            try:
                review_data_parsed = json.loads(row["review_data"])
            except:
                review_data_parsed = row["review_data"]

        logs.append({
            "id": row["id"],
            "timestamp": row["timestamp"],
            "query": row["query"],
            "params": json.loads(row["params"]) if row["params"] else {},
            "prompt": row["prompt"],
            "refined_prompt": row["refined_prompt"] if "refined_prompt" in row.keys() else None,
            "response": response_parsed,
            "raw_output": row["raw_output"],
            "rating": row["rating"],
            "comment": row["comment"],
            "username": row["username"] if "username" in row.keys() else "anonymous",
            "review_data": review_data_parsed
        })
    
    conn.close()
    return logs

def get_stats(days: int = 30) -> Dict[str, Any]:
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 1. Total Count
    cursor.execute("SELECT COUNT(*) FROM rag_logs")
    total_count = cursor.fetchone()[0]
    
    # 2. Today Count
    today_str = datetime.datetime.now().strftime("%Y-%m-%d")
    cursor.execute("SELECT COUNT(*) FROM rag_logs WHERE timestamp LIKE ?", (f"{today_str}%",))
    today_count = cursor.fetchone()[0]
    
    # 3. Active Users (Today)
    cursor.execute("SELECT COUNT(DISTINCT username) FROM rag_logs WHERE timestamp LIKE ?", (f"{today_str}%",))
    active_users_today = cursor.fetchone()[0]
    
    # 4. Fetch recent logs for analysis (Limit 1000 for performance)
    cursor.execute("SELECT timestamp, params FROM rag_logs ORDER BY id DESC LIMIT 1000")
    rows = cursor.fetchall()
    
    subject_counts = {}
    topic_counts = {}
    daily_trend = {}
    
    # Initialize daily trend with 0 for last 'days' days
    for i in range(days):
        d = (datetime.datetime.now() - datetime.timedelta(days=i)).strftime("%Y-%m-%d")
        daily_trend[d] = 0
        
    for row in rows:
        ts = row["timestamp"][:10] # YYYY-MM-DD
        if ts in daily_trend:
            daily_trend[ts] += 1
            
        try:
            params = json.loads(row["params"]) if row["params"] else {}
            
            # Subject (Handle list or string)
            # Old data might be list, new is string or joined string
            subj = params.get("subject") or params.get("subjects")
            if subj:
                if isinstance(subj, list):
                    for s in subj:
                        subject_counts[s] = subject_counts.get(s, 0) + 1
                elif isinstance(subj, str):
                    # It might be "History, Civics" joined
                    for s in subj.replace("、", ",").split(","):
                        s_clean = s.strip()
                        if s_clean:
                            subject_counts[s_clean] = subject_counts.get(s_clean, 0) + 1
                            
            # Topic
            top = params.get("topic")
            if top:
                topic_counts[top] = topic_counts.get(top, 0) + 1
                
        except:
            pass
            
    conn.close()
    
    # Format for frontend
    return {
        "kpi": {
            "total_generations": total_count,
            "today_generations": today_count,
            "active_users_today": active_users_today
        },
        "charts": {
            "subject_distribution": [{"name": k, "value": v} for k, v in sorted(subject_counts.items(), key=lambda x: x[1], reverse=True)[:10]],
            "topic_cloud": [{"text": k, "value": v} for k, v in sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:20]],
            "daily_trend": [{"date": k, "count": v} for k, v in sorted(daily_trend.items())]
        }
    }

def verify_user(username, password):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT role FROM users WHERE username = ? AND password = ?", (username, password))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"username": username, "role": row[0]}
    return None

def get_users() -> List[Dict[str, str]]:
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT username, role FROM users")
    rows = cursor.fetchall()
    conn.close()
    return [{"username": r[0], "role": r[1]} for r in rows]

def add_user(username, password, role="user"):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", (username, password, role))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False # Already exists
    finally:
        conn.close()

def delete_user(username):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE username = ?", (username,))
    conn.commit()
    conn.close()