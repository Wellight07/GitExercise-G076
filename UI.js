const API_BASE_URL = "";

function enterApp() {
  document.getElementById("home").style.display = "none";
  document.getElementById("appShell").classList.remove("app-hidden");
  loadDashboard();
}

function showPage(pageId, menuItem) {
  let pages = document.querySelectorAll(".page");
  let menuItems = document.querySelectorAll(".menu div");

  pages.forEach(function(page) {
    page.classList.remove("active");
  });

  menuItems.forEach(function(item) {
    item.classList.remove("active-menu");
  });

  document.getElementById(pageId).classList.add("active");
  menuItem.classList.add("active-menu");

  if (pageId === "dashboard" || pageId === "analysis" || pageId === "history") {
    loadDashboard();
  }
}

async function loadDashboard() {
  try {
    const response = await fetch(API_BASE_URL + "/transactions");
    const transactions = await response.json();
    const totals = calculateTotals(transactions);

    setText("balanceValue", formatMoney(totals.balance));
    setText("incomeValue", formatMoney(totals.income));
    setText("expenseValue", formatMoney(totals.expense));
    setText("savingsValue", formatMoney(totals.balance));

    setText("analysisIncomeValue", formatMoney(totals.income));
    setText("analysisExpenseValue", formatMoney(totals.expense));
    setText("analysisSavingsValue", formatMoney(totals.balance));
    setText("topCategoryValue", totals.topCategory);

    renderHistory(transactions);
  } catch (error) {
    showMessage("Cannot connect to backend. Run python backend.py first.", "error");
  }
}

async function addTransaction(type) {
  const isIncome = type === "income";
  const name = getValue(isIncome ? "incomeName" : "expenseName");
  const amount = getValue(isIncome ? "incomeAmount" : "expenseAmount");
  const date = getValue(isIncome ? "incomeDate" : "expenseDate");
  const category = isIncome ? "Income" : getValue("expenseCategory");

  if (!name || !amount || !date) {
    showMessage("Please fill in name, amount, and date.", "error");
    return;
  }

  try {
    const response = await fetch(API_BASE_URL + "/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: type,
        name: name,
        amount: Number(amount),
        category: category,
        date: date
      })
    });

    const result = await response.json();

    if (!response.ok) {
      showMessage(result.error || "Transaction failed.", "error");
      return;
    }

    clearTransactionForm(type);
    showMessage(result.message, "success");
    loadDashboard();
  } catch (error) {
    showMessage("Cannot add transaction. Check that Flask is running.", "error");
  }
}

async function deleteTransaction(id) {
  try {
    const response = await fetch(API_BASE_URL + "/delete/" + id, {
      method: "DELETE"
    });
    const result = await response.json();

    if (!response.ok) {
      showMessage(result.error || "Delete failed.", "error");
      return;
    }

    showMessage(result.message, "success");
    loadDashboard();
  } catch (error) {
    showMessage("Cannot delete transaction. Check that Flask is running.", "error");
  }
}

function calculateTotals(transactions) {
  let income = 0;
  let expense = 0;
  let categoryTotals = {};

  transactions.forEach(function(item) {
    const amount = Number(item.amount);

    if (item.type === "income") {
      income += amount;
      return;
    }

    expense += amount;
    categoryTotals[item.category] = (categoryTotals[item.category] || 0) + amount;
  });

  let topCategory = "None";
  let topAmount = 0;

  Object.keys(categoryTotals).forEach(function(category) {
    if (categoryTotals[category] > topAmount) {
      topCategory = category;
      topAmount = categoryTotals[category];
    }
  });

  return {
    income: income,
    expense: expense,
    balance: income - expense,
    topCategory: topCategory
  };
}

function renderHistory(transactions) {
  const body = document.getElementById("historyBody");

  if (!body) {
    return;
  }

  body.innerHTML = "";

  if (transactions.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">No transactions yet.</td>
      </tr>
    `;
    return;
  }

  transactions.forEach(function(item) {
    const isIncome = item.type === "income";
    const sign = isIncome ? "+" : "-";
    const tagClass = isIncome ? "income-tag" : "expense-tag";
    const amountClass = isIncome ? "income-text" : "expense-text";

    body.innerHTML += `
      <tr>
        <td><span class="tag ${tagClass}">${capitalize(item.type)}</span></td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.date)}</td>
        <td class="${amountClass}">${sign} ${formatMoney(item.amount)}</td>
        <td><button class="delete-btn" onclick="deleteTransaction(${item.id})">Delete</button></td>
      </tr>
    `;
  });
}

function clearTransactionForm(type) {
  if (type === "income") {
    setValue("incomeName", "");
    setValue("incomeAmount", "");
    setValue("incomeDate", "");
  } else {
    setValue("expenseName", "");
    setValue("expenseAmount", "");
    setValue("expenseDate", "");
  }
}

function showMessage(text, status) {
  const message = document.getElementById("formMessage");

  if (!message) {
    return;
  }

  message.textContent = text;
  message.className = "form-message " + status;
}

function getValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function setValue(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.value = value;
  }
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function formatMoney(value) {
  return "RM " + Number(value).toFixed(2);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", loadDashboard);
