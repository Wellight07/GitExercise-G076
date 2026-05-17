from pathlib import Path
from threading import Thread
from flask import Flask, jsonify, request, send_from_directory

import database

BASE_DIR = Path(__file__).resolve().parent

app = Flask(__name__)


def get_all_transactions():
    rows = database.get_all_transactions()

    return [
        {
            "id": row[0],
            "type": row[1],
            "name": row[2],
            "amount": row[3],
            "category": row[4],
            "date": row[5],
        }
        for row in rows
    ]


def calculate_balance():
    balance = 0

    for transaction in get_all_transactions():
        amount = float(transaction["amount"])

        if transaction["type"] == "income":
            balance += amount
        else:
            balance -= amount

    return balance


@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "UI.html")


@app.route("/UI.css")
def css():
    return send_from_directory(BASE_DIR, "UI.css")


@app.route("/UI.js")
def js():
    return send_from_directory(BASE_DIR, "UI.js")


@app.route("/balance")
def get_balance():
    return jsonify({"balance": calculate_balance()})


@app.route("/transactions")
def transactions():
    return jsonify(get_all_transactions())


@app.route("/add", methods=["POST"])
def add_transaction():
    data = request.get_json(silent=True) or {}
    required_fields = ["type", "name", "amount", "category", "date"]

    for field in required_fields:
        if field not in data or data[field] in ["", None]:
            return jsonify({"error": f"{field} is required"}), 400

    if data["type"] not in ["income", "expense"]:
        return jsonify({"error": "type must be income or expense"}), 400

    database.insert_data(
        data["type"],
        data["name"],
        float(data["amount"]),
        data["category"],
        data["date"],
    )

    return jsonify({"message": "Transaction added successfully"})


@app.route("/delete/<int:transaction_id>", methods=["DELETE"])
def delete_transaction(transaction_id):
    deleted_count = database.delete_transactions(transaction_id)

    if deleted_count == 0:
        return jsonify({"error": "Transaction not found"}), 404

    return jsonify({"message": "Transaction deleted successfully"})

def view_transactions_table():
    conn = database.get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM transactions")
    rows = cursor.fetchall()

    conn.close()

    print("\n=== Transactions Table ===")

    if not rows:
        print("No transactions found.")
        return

    print("ID | Type | Name | Amount | Category | Date")
    print("-" * 60)

    for row in rows:
        print(f"{row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]}")

def run_flask():
    app.run(debug=False, use_reloader=False)


def terminal_commands():
    while True:
        command = input("\nType command: ").strip().lower()

        if command == "view":
            view_transactions_table()

        elif command == "exit":
            print("Exit command mode.")
            break

        else:
            print("Unknown command. Type 'view' to see transactions table.")


if __name__ == "__main__":
    database.init_db()

flask_thread = Thread(target=run_flask)
flask_thread.daemon = True
flask_thread.start()

print("Flask is running at http://127.0.0.1:5000")
print("Type 'view' to see transactions table.")

terminal_commands()