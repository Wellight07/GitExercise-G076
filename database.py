import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).resolve().parent / "BudgetMate.db"

# 1. Connect database
def get_db():
    conn = sqlite3.connect(DB_PATH)
    return conn


# 2. Create Table
def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            age INTEGER NOT NULL,
            gender TEXT NOT NULL,
            password TEXT NOT NULL,
            student_id TEXT DEFAULT ''
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings(
            user_id INTEGER PRIMARY KEY,
            currency TEXT NOT NULL DEFAULT 'RM',
            dark_mode INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT,
            date TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    cursor.execute("PRAGMA table_info(transactions)")
    transaction_columns = [row[1] for row in cursor.fetchall()]
    if "user_id" not in transaction_columns:
        cursor.execute("ALTER TABLE transactions ADD COLUMN user_id INTEGER")

    cursor.execute("PRAGMA table_info(users)")
    user_columns = [row[1] for row in cursor.fetchall()]
    if "student_id" not in user_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN student_id TEXT DEFAULT ''")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS goals(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            target REAL NOT NULL,
            saved REAL NOT NULL DEFAULT 0,
            target_date TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    conn.commit()
    conn.close()
    print("Database & Table created successfully")


def row_to_user(row):
    if row is None:
        return None

    return {
        "id": str(row[0]),
        "name": row[1],
        "email": row[2],
        "age": row[3],
        "gender": row[4],
        "password": row[5],
        "studentId": row[6] or "",
    }


def create_user(name, email, age, gender, password, student_id=""):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO users (name, email, age, gender, password, student_id)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (name, email, age, gender, password, student_id))

    user_id = cursor.lastrowid
    cursor.execute("""
        INSERT OR IGNORE INTO settings (user_id, currency, dark_mode)
        VALUES (?, 'RM', 0)
    """, (user_id,))

    conn.commit()
    conn.close()
    return get_user_by_id(user_id)


def get_user_by_email(email):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, name, email, age, gender, password, student_id
        FROM users WHERE lower(email) = lower(?)
    """, (email,))
    row = cursor.fetchone()

    conn.close()
    return row_to_user(row)


def get_user_by_id(user_id):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, name, email, age, gender, password, student_id
        FROM users WHERE id = ?
    """, (user_id,))
    row = cursor.fetchone()

    conn.close()
    return row_to_user(row)


def update_user_profile(user_id, name, age, gender, student_id=""):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE users
        SET name = ?, age = ?, gender = ?, student_id = ?
        WHERE id = ?
    """, (name, age, gender, student_id, user_id))

    conn.commit()
    updated = cursor.rowcount
    conn.close()
    return updated


def update_user_password(user_id, password):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("UPDATE users SET password = ? WHERE id = ?", (password, user_id))

    conn.commit()
    updated = cursor.rowcount
    conn.close()
    return updated


def reset_password(email, password):
    user = get_user_by_email(email)

    if not user:
        return None

    update_user_password(user["id"], password)
    return get_user_by_id(user["id"])


def get_settings(user_id):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT OR IGNORE INTO settings (user_id, currency, dark_mode)
        VALUES (?, 'RM', 0)
    """, (user_id,))
    cursor.execute("SELECT currency, dark_mode FROM settings WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()

    conn.commit()
    conn.close()
    return {"currency": row[0], "darkMode": bool(row[1])}


def update_settings(user_id, currency, dark_mode):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO settings (user_id, currency, dark_mode)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            currency = excluded.currency,
            dark_mode = excluded.dark_mode
    """, (user_id, currency, int(bool(dark_mode))))

    conn.commit()
    conn.close()
    return get_settings(user_id)


# 3. Insert Data
def insert_data(type, name, amount, category, date, user_id=None):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO transactions (user_id, type, name, amount, category, date)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (user_id, type, name, amount, category, date))

    conn.commit()
    transaction_id = cursor.lastrowid
    conn.close()
    print("Data inserted successfully")
    return transaction_id


# 4. Fetch Data
def get_all_transactions(user_id=None):
    conn = get_db()
    cursor = conn.cursor()

    if user_id is None:
        cursor.execute("SELECT id, type, name, amount, category, date FROM transactions")
    else:
        cursor.execute("""
            SELECT id, type, name, amount, category, date
            FROM transactions
            WHERE user_id = ?
            ORDER BY id
        """, (user_id,))

    rows = cursor.fetchall()

    conn.close()
    return rows

# 5. Delete transactions
def delete_transactions(transaction_id, user_id=None):
    conn = get_db()
    cursor = conn.cursor()

    if user_id is None:
        cursor.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
    else:
        cursor.execute("""
            DELETE FROM transactions WHERE id = ? AND user_id = ?
        """, (transaction_id, user_id))

    conn.commit()
    deleted_count = cursor.rowcount
    conn.close()
    return deleted_count
    
# 6. view table
def view_table():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM transactions")
    rows = cursor.fetchall()

    conn.close()
    return rows


def row_to_goal(row):
    return {
        "id": row[0],
        "name": row[1],
        "target": row[2],
        "saved": row[3],
        "targetDate": row[4],
    }


def get_goals(user_id):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, name, target, saved, target_date
        FROM goals
        WHERE user_id = ?
        ORDER BY id
    """, (user_id,))
    rows = cursor.fetchall()

    conn.close()
    return [row_to_goal(row) for row in rows]


def create_goal(user_id, name, target, target_date):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO goals (user_id, name, target, saved, target_date)
        VALUES (?, ?, ?, 0, ?)
    """, (user_id, name, target, target_date))

    conn.commit()
    goal_id = cursor.lastrowid
    conn.close()
    return goal_id


def add_goal_savings(user_id, goal_id, amount):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE goals
        SET saved = min(saved + ?, target)
        WHERE id = ? AND user_id = ?
    """, (amount, goal_id, user_id))

    conn.commit()
    updated = cursor.rowcount
    conn.close()
    return updated


def delete_goal(user_id, goal_id):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM goals WHERE id = ? AND user_id = ?", (goal_id, user_id))

    conn.commit()
    deleted = cursor.rowcount
    conn.close()
    return deleted

init_db()
