from pathlib import Path
from threading import Thread
from  flask import Flask , jsonify, request, send_from_directory

import database

try:
    import pandas as pd
except ImportError:
    pd = None

BASE_DIR = Path(__file__).resolve().parent

app = Flask(__name__)


def get_all_transactions():
    user_id = request.args.get("user_id")
    rows = database.get_all_transactions(user_id)

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


def row_to_transaction(row):
    return {
        "id": row[0],
        "type": row[1],
        "name": row[2],
        "amount": row[3],
        "category": row[4],
        "date": row[5],
    }


def get_transaction_totals(transactions):
    if pd is not None and transactions:
        frame = pd.DataFrame(transactions)
        frame["amount"] = pd.to_numeric(frame["amount"], errors="coerce").fillna(0)
        income = frame.loc[frame["type"] == "income", "amount"].sum()
        expense_frame = frame.loc[frame["type"] == "expense"].copy()
        expense = expense_frame["amount"].sum()
        category_totals = expense_frame.groupby("category")["amount"].sum().to_dict()
    else:
        income = 0
        expense = 0
        category_totals = {}

        for transaction in transactions:
            amount = float(transaction.get("amount") or 0)

            if transaction.get("type") == "income":
                income += amount
            elif transaction.get("type") == "expense":
                expense += amount
                category = transaction.get("category") or "Other"
                category_totals[category] = category_totals.get(category, 0) + amount

    return {
        "income": float(income),
        "expense": float(expense),
        "balance": float(income - expense),
        "categoryTotals": category_totals,
    }


def make_suggestion(level, title, message):
    return {"level": level, "title": title, "message": message}


def format_money(value, currency):
    symbols = {"RM": "RM", "USD": "$", "SGD": "S$"}
    return symbols.get(currency, currency) + " " + format(value, ".2f")


def build_decision_tree_suggestions(transactions, currency="RM"):
    totals = get_transaction_totals(transactions)
    income = totals["income"]
    expense = totals["expense"]
    balance = totals["balance"]
    category_totals = totals["categoryTotals"]
    suggestions = []

    if income <= 0:
        suggestions.append(make_suggestion(
            "warning",
            "Decision tree: add income first",
            "Pandas needs at least one income record before it can compare your spending pattern.",
        ))
        return suggestions

    expense_rate = (expense / income) * 100
    savings_rate = (balance / income) * 100

    if expense > income:
        suggestions.append(make_suggestion(
            "danger",
            "Decision tree: spending is over income",
            "You spent " + format_money(expense - income, currency) +
            " more than your income. Reduce optional spending immediately.",
        ))
    elif expense_rate >= 80:
        suggestions.append(make_suggestion(
            "warning",
            "Decision tree: high spending risk",
            "Expenses use " + format(expense_rate, ".0f") +
            "% of your income. Keep at least 20% for savings.",
        ))
    elif expense_rate >= 60:
        suggestions.append(make_suggestion(
            "warning",
            "Decision tree: watch spending",
            "Expenses use " + format(expense_rate, ".0f") +
            "% of your income. Review non-essential purchases.",
        ))
    else:
        suggestions.append(make_suggestion(
            "success",
            "Decision tree: spending is healthy",
            "Expenses use " + format(expense_rate, ".0f") +
            "% of your income, leaving " + format_money(max(balance, 0), currency) + " available.",
        ))

    if category_totals and expense > 0:
        top_category = max(category_totals, key=category_totals.get)
        top_amount = category_totals[top_category]
        category_rate = (top_amount / expense) * 100

        if category_rate >= 40:
            suggestions.append(make_suggestion(
                "warning",
                "Decision tree: " + top_category + " dominates",
                top_category + " is " + format(category_rate, ".0f") +
                "% of your expense total. Try bringing it closer to 30%.",
            ))
        else:
            suggestions.append(make_suggestion(
                "success",
                "Decision tree: balanced categories",
                "Your largest category is " + top_category + " at " +
                format(category_rate, ".0f") + "% of total expenses.",
            ))

    if savings_rate >= 20:
        suggestions.append(make_suggestion(
            "success",
            "Decision tree: strong savings rate",
            "You are saving " + format(savings_rate, ".0f") +
            "% of income. Consider adding some to a savings goal.",
        ))
    elif balance > 0:
        target_gap = (income * 0.2) - balance
        suggestions.append(make_suggestion(
            "warning",
            "Decision tree: savings below target",
            "Your savings rate is " + format(savings_rate, ".0f") +
            "%. Save another " + format_money(max(target_gap, 0), currency) + " to reach 20%.",
        ))

    return suggestions


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


@app.route("/signup", methods=["POST"])
def sign_up():
    data = request.get_json(silent=True) or {}
    required_fields = ["name", "email", "age", "gender", "password"]

    for field in required_fields:
        if field not in data or data[field] in ["", None]:
            return jsonify({"error": f"{field} is required"}), 400

    if database.get_user_by_email(data["email"]):
        return jsonify({"error": "An account with this email already exists"}), 409

    if int(data["age"]) < 13 or int(data["age"]) > 100:
        return jsonify({"error": "Age must be from 13 to 100"}), 400

    if len(data["password"]) < 4:
        return jsonify({"error": "Password must have at least 4 characters"}), 400

    user = database.create_user(
        data["name"],
        data["email"].lower(),
        int(data["age"]),
        data["gender"],
        data["password"],
        data.get("studentId", ""),
    )

    return jsonify({"user": user, "settings": database.get_settings(user["id"])})


@app.route("/signin", methods=["POST"])
def sign_in():
    data = request.get_json(silent=True) or {}
    user = database.get_user_by_email(data.get("email", ""))

    if not user or user["password"] != data.get("password", ""):
        return jsonify({"error": "Email or password is incorrect"}), 401

    return jsonify({"user": user, "settings": database.get_settings(user["id"])})


@app.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    email = data.get("email", "")
    password = data.get("password", "")

    if not name:
        return jsonify({"error": "Registered full name is required"}), 400

    if len(password) < 4:
        return jsonify({"error": "New password must have at least 4 characters"}), 400

    user = database.get_user_by_email(email)

    if not user:
        return jsonify({"error": "No account was found for this email"}), 404

    if user["name"].strip().lower() != name.lower():
        return jsonify({"error": "Full name does not match this registered email"}), 403

    database.update_user_password(user["id"], password)

    return jsonify({"message": "Password reset. You can sign in now."})


@app.route("/profile/<int:user_id>", methods=["PUT"])
def update_profile(user_id):
    data = request.get_json(silent=True) or {}
    name = data.get("name", "")
    age = int(data.get("age", 0))
    gender = data.get("gender", "")

    if not name or age < 13 or age > 100 or not gender:
        return jsonify({"error": "Enter a valid name, age from 13 to 100, and gender"}), 400

    updated = database.update_user_profile(
        user_id,
        name,
        age,
        gender,
        data.get("studentId", ""),
    )

    if updated == 0:
        return jsonify({"error": "User not found"}), 404

    return jsonify({"user": database.get_user_by_id(user_id)})


@app.route("/change-password/<int:user_id>", methods=["PUT"])
def change_password(user_id):
    data = request.get_json(silent=True) or {}
    user = database.get_user_by_id(user_id)

    if not user or user["password"] != data.get("currentPassword", ""):
        return jsonify({"error": "Current password is incorrect"}), 401

    if len(data.get("newPassword", "")) < 4:
        return jsonify({"error": "New password must have at least 4 characters"}), 400

    database.update_user_password(user_id, data["newPassword"])
    return jsonify({"message": "Password updated."})


@app.route("/settings/<int:user_id>", methods=["GET", "PUT"])
def settings(user_id):
    if request.method == "GET":
        return jsonify(database.get_settings(user_id))

    data = request.get_json(silent=True) or {}
    settings_data = database.update_settings(
        user_id,
        data.get("currency", "RM"),
        bool(data.get("darkMode", False)),
    )
    return jsonify(settings_data)


@app.route("/transactions")
def transactions():
    return jsonify(get_all_transactions())


@app.route("/smart-suggestions")
def smart_suggestions():
    user_id = request.args.get("user_id")
    currency = request.args.get("currency", "RM")
    rows = database.get_all_transactions(user_id)
    transactions = [row_to_transaction(row) for row in rows]

    return jsonify({
        "engine": "pandas decision tree" if pd is not None else "python decision tree",
        "pandasAvailable": pd is not None,
        "suggestions": build_decision_tree_suggestions(transactions, currency),
    })


@app.route("/add", methods=["POST"])
def add_transaction():
    data = request.get_json(silent=True) or {}
    required_fields = ["user_id", "type", "name", "amount", "category", "date"]

    for field in required_fields:
        if field not in data or data[field] in ["", None]:
            return jsonify({"error": f"{field} is required"}), 400

    if data["type"] not in ["income", "expense"]:
        return jsonify({"error": "type must be income or expense"}), 400

    transaction_id = database.insert_data(
        data["type"],
        data["name"],
        float(data["amount"]),
        data["category"],
        data["date"],
        data["user_id"],
    )

    return jsonify({"message": "Transaction added successfully", "id": transaction_id})


@app.route("/delete/<int:transaction_id>", methods=["DELETE"])
def delete_transaction(transaction_id):
    user_id = request.args.get("user_id")
    deleted_count = database.delete_transactions(transaction_id, user_id)

    if deleted_count == 0:
        return jsonify({"error": "Transaction not found"}), 404

    return jsonify({"message": "Transaction deleted successfully"})


@app.route("/goals")
def goals():
    user_id = request.args.get("user_id")

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    return jsonify(database.get_goals(user_id))


@app.route("/goals", methods=["POST"])
def add_goal():
    data = request.get_json(silent=True) or {}
    required_fields = ["user_id", "name", "target", "targetDate"]

    for field in required_fields:
        if field not in data or data[field] in ["", None]:
            return jsonify({"error": f"{field} is required"}), 400

    goal_id = database.create_goal(
        data["user_id"],
        data["name"],
        float(data["target"]),
        data["targetDate"],
    )

    return jsonify({"message": "Savings goal created successfully", "id": goal_id})


@app.route("/goals/<int:goal_id>/savings", methods=["PUT"])
def update_goal_savings(goal_id):
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    amount = float(data.get("amount", 0))

    if not user_id or amount <= 0:
        return jsonify({"error": "user_id and a positive amount are required"}), 400

    updated = database.add_goal_savings(user_id, goal_id, amount)

    if updated == 0:
        return jsonify({"error": "Goal not found"}), 404

    return jsonify({"message": "Savings progress updated"})


@app.route("/goals/<int:goal_id>", methods=["DELETE"])
def remove_goal(goal_id):
    user_id = request.args.get("user_id")

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    deleted = database.delete_goal(user_id, goal_id)

    if deleted == 0:
        return jsonify({"error": "Goal not found"}), 404

    return jsonify({"message": "Goal deleted"})

def view_transactions_table():
    conn = database.get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, type, name, amount, category, date FROM transactions")
    rows = cursor.fetchall()

    conn.close()

    print("\n=== Transactions Table ===")

    if not rows:
        print("No transactions found.")
        return

    print("ID | Type | Name | Amount | Category | Date")
    print("-" * 60)

    for row in rows:
        print(f"{row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]} | {row[5]}")

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
