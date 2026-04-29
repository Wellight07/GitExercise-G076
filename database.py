import sqlite3

# 1. Connect database
def get_db():
    conn = sqlite3.connect("BudgetMate.db")
    return conn


# 2. Create Table
def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT,
            date TEXT
        )
    """)

    conn.commit()
    conn.close()
    print("Database & Table created successfully")


# 3. Insert Data
def insert_data(type, amount, category, date):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO transactions (type, amount, category, date)
        VALUES (?, ?, ?, ?)
    """, (type, amount, category, date))

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

init_db()