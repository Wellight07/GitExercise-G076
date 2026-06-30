from pathlib import Path
from threading import Thread
import json
import time
from urllib.error import URLError
from urllib.request import urlopen

from  flask import Flask , jsonify, request, send_from_directory

import pandas as pd
from sklearn.tree import DecisionTreeClassifier
import database

BASE_DIR = Path(__file__).resolve().parent

app = Flask(__name__)

TREE_FEATURES = ["expense_rate", "savings_rate", "top_category_rate"]
FX_CACHE_SECONDS = 3600
FX_CACHE = {}
SUPPORTED_CURRENCIES = {
    "MYR": "Malaysian Ringgit",
    "USD": "US Dollar",
    "SGD": "Singapore Dollar",
    "EUR": "Euro",
    "GBP": "British Pound",
    "JPY": "Japanese Yen",
    "CNY": "Chinese Yuan",
    "AUD": "Australian Dollar",
    "CAD": "Canadian Dollar",
    "THB": "Thai Baht",
    "IDR": "Indonesian Rupiah",
    "KRW": "South Korean Won",
}


def normalize_currency(currency):
    currency = (currency or "MYR").strip().upper()
    if currency == "RM":
        return "MYR"
    return currency


def get_exchange_rates(base_currency):
    base_currency = normalize_currency(base_currency)

    if base_currency not in SUPPORTED_CURRENCIES:
        raise ValueError("Unsupported base currency")

    cached = FX_CACHE.get(base_currency)
    now = time.time()

    if cached and now - cached["timestamp"] < FX_CACHE_SECONDS:
        return cached

    url = "https://open.er-api.com/v6/latest/" + base_currency

    try:
        with urlopen(url, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (OSError, URLError, json.JSONDecodeError) as error:
        if cached:
            return cached
        raise RuntimeError("Unable to fetch live exchange rates") from error

    if payload.get("result") != "success" or "rates" not in payload:
        if cached:
            return cached
        raise RuntimeError("Exchange rate service returned an invalid response")

    rates = payload["rates"]
    rates[base_currency] = 1
    data = {
        "base": base_currency,
        "rates": rates,
        "timestamp": now,
        "lastUpdate": payload.get("time_last_update_utc", ""),
        "nextUpdate": payload.get("time_next_update_utc", ""),
    }
    FX_CACHE[base_currency] = data
    return data


def convert_currency(amount, from_currency, to_currency):
    from_currency = normalize_currency(from_currency)
    to_currency = normalize_currency(to_currency)
    amount = float(amount)

    if amount < 0:
        raise ValueError("amount must not be negative")

    if from_currency == to_currency:
        return amount, 1

    rates_data = get_exchange_rates(from_currency)
    rate = rates_data["rates"].get(to_currency)

    if rate is None:
        raise ValueError("Unsupported target currency")

    return amount * float(rate), float(rate)


def train_financial_decision_tree():
    training_data = pd.DataFrame([
        {"expense_rate": 110, "savings_rate": -10, "top_category_rate": 45, "label": "danger"},
        {"expense_rate": 100, "savings_rate": 0, "top_category_rate": 50, "label": "danger"},
        {"expense_rate": 90, "savings_rate": 10, "top_category_rate": 42, "label": "warning"},
        {"expense_rate": 80, "savings_rate": 20, "top_category_rate": 38, "label": "warning"},
        {"expense_rate": 65, "savings_rate": 35, "top_category_rate": 35, "label": "warning"},
        {"expense_rate": 55, "savings_rate": 45, "top_category_rate": 28, "label": "success"},
        {"expense_rate": 40, "savings_rate": 60, "top_category_rate": 25, "label": "success"},
        {"expense_rate": 30, "savings_rate": 70, "top_category_rate": 20, "label": "success"},
    ])
    model = DecisionTreeClassifier(max_depth=3, random_state=42)
    model.fit(training_data[TREE_FEATURES], training_data["label"])
    return model


FINANCIAL_DECISION_TREE = train_financial_decision_tree()


def get_all_transactions():
    user_id = request.args.get("user_id")
    display_currency = normalize_currency(request.args.get("currency", "MYR"))
    rows = database.get_all_transactions(user_id)
    transactions = []

    for row in rows:
        original_amount = row[6] if len(row) > 6 and row[6] is not None else row[3]
        original_currency = normalize_currency(row[7] if len(row) > 7 else "MYR")
        exchange_rate = row[8] if len(row) > 8 and row[8] is not None else 1
        converted_amount = row[3]
        live_rate = exchange_rate

        try:
            converted_amount, live_rate = convert_currency(original_amount, original_currency, display_currency)
        except (RuntimeError, ValueError):
            if original_currency != display_currency:
                converted_amount = row[3]

        transactions.append({
            "id": row[0],
            "type": row[1],
            "name": row[2],
            "amount": converted_amount,
            "displayCurrency": display_currency,
            "originalAmount": original_amount,
            "originalCurrency": original_currency,
            "exchangeRate": live_rate,
            "category": row[4],
            "date": row[5],
        })

    return transactions


def calculate_balance():
    balance = 0

    for transaction in get_all_transactions():
        amount = float(transaction["amount"])

        if transaction["type"] == "income":
            balance += amount
        else:
            balance -= amount

    return balance


def validate_reset_identity(data):
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    student_id = data.get("studentId", "").strip()
    security_answer = data.get("securityAnswer", "").strip()

    if not name or not email or not student_id or not security_answer:
        return None, "Full name, email, student ID, and security answer are required", 400

    user = database.get_user_by_email(email)

    if not user:
        return None, "No account was found for this email", 404

    if user["name"].strip().lower() != name.lower():
        return None, "Full name does not match this registered email", 403

    if not user.get("studentId"):
        return None, "Student ID is not set for this account", 403

    if user["studentId"].strip().lower() != student_id.lower():
        return None, "Student ID does not match this account", 403

    if not user.get("securityAnswer"):
        return None, "Security answer is not set for this account", 403

    if user["securityAnswer"].strip().lower() != security_answer.lower():
        return None, "Security answer is incorrect", 403

    return user, "", 200


def row_to_transaction(row):
    return {
        "id": row[0],
        "type": row[1],
        "name": row[2],
        "amount": row[3],
        "category": row[4],
        "date": row[5],
        "originalAmount": row[6] if len(row) > 6 else row[3],
        "originalCurrency": row[7] if len(row) > 7 else "MYR",
        "exchangeRate": row[8] if len(row) > 8 else 1,
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
    currency = normalize_currency(currency)
    symbols = {
        "MYR": "RM",
        "USD": "$",
        "SGD": "S$",
        "EUR": "€",
        "GBP": "£",
        "JPY": "¥",
        "CNY": "¥",
        "AUD": "A$",
        "CAD": "C$",
        "THB": "฿",
        "IDR": "Rp",
        "KRW": "₩",
    }
    return symbols.get(currency, currency) + " " + format(value, ".2f")


def predict_financial_status(expense_rate, savings_rate, top_category_rate):
    features = pd.DataFrame([{
        "expense_rate": expense_rate,
        "savings_rate": savings_rate,
        "top_category_rate": top_category_rate,
    }])
    return FINANCIAL_DECISION_TREE.predict(features[TREE_FEATURES])[0]


def build_decision_tree_suggestions(transactions, currency="RM"):
    totals = get_transaction_totals(transactions)
    income = totals["income"]
    expense = totals["expense"]
    balance = totals["balance"]
    category_totals = totals["categoryTotals"]
    suggestions = []
    top_category = None
    category_rate = 0

    if income <= 0:
        suggestions.append(make_suggestion(
            "warning",
            "Decision tree: add income first",
            "Add at least one income record before the model compares your spending pattern.",
        ))
        return suggestions

    expense_rate = (expense / income) * 100
    savings_rate = (balance / income) * 100

    if category_totals and expense > 0:
        top_category = max(category_totals, key=category_totals.get)
        top_amount = category_totals[top_category]
        category_rate = (top_amount / expense) * 100

    decision_level = predict_financial_status(expense_rate, savings_rate, category_rate)

    if decision_level == "danger":
        suggestions.append(make_suggestion(
            "danger",
            "Decision tree: high risk",
            "The model classified this account as high risk. Expenses use " +
            format(expense_rate, ".0f") + "% of income and savings are " +
            format(savings_rate, ".0f") + "%.",
        ))
    elif decision_level == "warning":
        suggestions.append(make_suggestion(
            "warning",
            "Decision tree: needs attention",
            "The model classified this account as needing attention. Expenses use " +
            format(expense_rate, ".0f") + "% of income.",
        ))
    else:
        suggestions.append(make_suggestion(
            "success",
            "Decision tree: healthy pattern",
            "The model classified this account as healthy. Expenses use " + format(expense_rate, ".0f") +
            "% of your income, leaving " + format_money(max(balance, 0), currency) + " available.",
        ))

    if top_category:
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
        data.get("securityQuestion", ""),
        data.get("securityAnswer", ""),
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
    password = data.get("password", "")

    user, error, status = validate_reset_identity(data)

    if error:
        return jsonify({"error": error}), status

    if len(password) < 4:
        return jsonify({"error": "New password must have at least 4 characters"}), 400

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
        data.get("securityQuestion", ""),
        data.get("securityAnswer", ""),
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


@app.route("/currencies")
def currencies():
    return jsonify([
        {"code": code, "name": name}
        for code, name in SUPPORTED_CURRENCIES.items()
    ])


@app.route("/exchange-rates")
def exchange_rates():
    base = normalize_currency(request.args.get("base", "MYR"))

    try:
        rates = get_exchange_rates(base)
    except (RuntimeError, ValueError) as error:
        return jsonify({"error": str(error)}), 502

    return jsonify({
        "base": rates["base"],
        "rates": {
            code: rates["rates"].get(code)
            for code in SUPPORTED_CURRENCIES
            if code in rates["rates"]
        },
        "lastUpdate": rates["lastUpdate"],
        "nextUpdate": rates["nextUpdate"],
        "cacheSeconds": FX_CACHE_SECONDS,
    })


@app.route("/convert")
def convert():
    try:
        amount = float(request.args.get("amount", 0))
        from_currency = normalize_currency(request.args.get("from", "MYR"))
        to_currency = normalize_currency(request.args.get("to", "MYR"))
        converted, rate = convert_currency(amount, from_currency, to_currency)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except RuntimeError as error:
        return jsonify({"error": str(error)}), 502

    return jsonify({
        "amount": amount,
        "from": from_currency,
        "to": to_currency,
        "converted": converted,
        "rate": rate,
    })


@app.route("/transactions")
def transactions():
    return jsonify(get_all_transactions())


@app.route("/smart-suggestions")
def smart_suggestions():
    currency = request.args.get("currency", "RM")
    transactions = get_all_transactions()

    return jsonify({
        "engine": "scikit-learn DecisionTreeClassifier",
        "pandasAvailable": True,
        "scikitLearnAvailable": True,
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

    try:
        original_amount = float(data["amount"])
    except (TypeError, ValueError):
        return jsonify({"error": "amount must be a valid number"}), 400

    if original_amount <= 0:
        return jsonify({"error": "amount must be greater than 0"}), 400

    original_currency = normalize_currency(data.get("currency", data.get("originalCurrency", "MYR")))
    display_currency = normalize_currency(data.get("displayCurrency", data.get("currency", "MYR")))

    try:
        converted_amount, exchange_rate = convert_currency(original_amount, original_currency, display_currency)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except RuntimeError as error:
        return jsonify({"error": str(error)}), 502

    transaction_id = database.insert_data(
        data["type"],
        data["name"],
        converted_amount,
        data["category"],
        data["date"],
        data["user_id"],
        original_amount,
        original_currency,
        exchange_rate,
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
