from flask import Flask

app = Flask(__name__)

@app.route("/")
def home():
    return "Hello, Flask is running!"

if __name__ == "__main__":
    app.run(debug=True)

#def calculate_balance():
 #   transactions = get_transactions()
#
 #   balance = 0
#
 #   for t in transactions:
  #      t_type = t[0]
   #     amount = t[1]
#
 #       if t_type == "income":
  #          balance += amount
   #     else:
    #        balance -= amount
    #
    #return balance