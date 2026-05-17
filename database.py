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
        CREATE TABLE IF NOT EXISTS transactions(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT,
            date TEXT
        )
    """)

    conn.commit()
    conn.close()
    print("Database & Table created successfully")


# 3. Insert Data
def insert_data(type, name, amount, category, date):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO transactions (type, name, amount, category, date)
        VALUES (?, ?, ?, ?, ?)
    """, (type, name, amount, category, date))

    conn.commit()
    conn.close()
    print("Data inserted successfully")


# 4. Fetch Data
def get_all_transactions():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM transactions")
    rows = cursor.fetchall()

    conn.close()
    return rows

# 5. Delete transactions
def delete_transactions(transaction_id):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM transactions WHERE id = ?
    """, (transaction_id,))

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

init_db()
