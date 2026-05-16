from flask import Flask, jsonify
import database

app = Flask(__name__)

@app.route("/")
def home():
    return "Hello, Flask is running!"

def calculate_balance():
    data = database.get_all_transactions()

    balance = 0

    for t in data:
        t_type = t[1]
        amount = float(t[2])

        if t_type == "income":
            balance += amount
        else:
            balance -= amount
    
    return balance

@app.route("/balance")
def get_balance():
    balance = calculate_balance
    return{"balance" : balance}

@app.route("/add", methods = ["POST"])
def add_transactions():
    data =request.json

    database.insert_data(
        data["type"],
        data["amount"],
        data["category"],
        data["date"],
    )

    return jsonify({"message": "Transactions added successfully"})

@app.route("/delete/<int:id>", methods=["DELETE"])
def delete(id):
    try:
        database.delete_transactions(id)
        return jsonify({"message":"Deleted successfully"})
    except:
        return jsonify({"error": "Delete failed"})
    
def view_transactions_table():
    database.view_table()

    rows = database.get_all_transactions()

    print("\n=== Transactions Table ===")

    for row in rows:
        print(row)

command = input("")

if command == "view":
    view_transactions_table()

if __name__ == "__main__":
    app.run(debug=True)
    