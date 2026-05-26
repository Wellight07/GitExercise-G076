const STORAGE_KEY = "budgetmate_transactions";

const starterTransactions = [
  { id: 1, type: "income", name: "Allowance", amount: 500, category: "Income", date: "2026-05-13" },
  { id: 2, type: "expense", name: "Lunch", amount: 25, category: "Food", date: "2026-05-13" },
  { id: 3, type: "expense", name: "Train", amount: 18, category: "Transport", date: "2026-05-14" },
  { id: 4, type: "expense", name: "Notebook", amount: 32, category: "Education", date: "2026-05-15" }
];

function enterApp() {
  document.getElementById("home").style.display = "none";
  document.getElementById("appShell").classList.remove("app-hidden");
  loadDashboard();
}

function showPage(pageId, menuItem) {
  const pages = document.querySelectorAll(".page");
  const menuItems = document.querySelectorAll(".menu div");

  pages.forEach(function(page) {
    page.classList.remove("active");
  });

  menuItems.forEach(function(item) {
    item.classList.remove("active-menu");
  });

  document.getElementById(pageId).classList.add("active");
  menuItem.classList.add("active-menu");
  loadDashboard();
}

function loadDashboard() {
  const transactions = getTransactions();
  const totals = calculateTotals(transactions);

  setText("balanceValue", formatMoney(totals.balance));
  setText("incomeValue", formatMoney(totals.income));
  setText("expenseValue", formatMoney(totals.expense));
  setText("savingsValue", formatMoney(totals.balance));
  setText("analysisIncomeValue", formatMoney(totals.income));
  setText("analysisExpenseValue", formatMoney(totals.expense));
  setText("analysisSavingsValue", formatMoney(totals.balance));
  setText("topCategoryValue", totals.topCategory);

  renderSummaryChart(totals);
  renderCategoryChart(totals.categoryTotals);
  renderHistory(transactions);
}

function addTransaction(type) {
  const isIncome = type === "income";
  const name = getValue(isIncome ? "incomeName" : "expenseName");
  const amount = Number(getValue(isIncome ? "incomeAmount" : "expenseAmount"));
  const date = getValue(isIncome ? "incomeDate" : "expenseDate");
  const category = isIncome ? "Income" : getValue("expenseCategory");

  if (!name || !amount || !date) {
    showMessage("Please fill in name, amount, and date.", "error");
    return;
  }

  const transactions = getTransactions();
  transactions.push({
    id: Date.now(),
    type: type,
    name: name,
    amount: amount,
    category: category,
    date: date
  });

  saveTransactions(transactions);
  clearTransactionForm(type);
  showMessage("Transaction added successfully.", "success");
  loadDashboard();
}

function deleteTransaction(id) {
  const transactions = getTransactions().filter(function(item) {
    return item.id !== id;
  });

  saveTransactions(transactions);
  showMessage("Transaction deleted.", "success");
  loadDashboard();
}

function calculateTotals(transactions) {
  let income = 0;
  let expense = 0;
  const categoryTotals = {};

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
    topCategory: topCategory,
    categoryTotals: categoryTotals
  };
}

function renderSummaryChart(totals) {
  const chart = document.getElementById("summaryChart");

  if (!chart) {
    return;
  }

  const values = [
    { label: "Income", value: totals.income, className: "income-bar" },
    { label: "Expense", value: totals.expense, className: "expense-bar" },
    { label: "Savings", value: Math.max(totals.balance, 0), className: "savings-bar" }
  ];
  const maxValue = Math.max.apply(null, values.map(function(item) {
    return item.value;
  })) || 1;

  chart.innerHTML = values.map(function(item) {
    const height = Math.max((item.value / maxValue) * 190, 10);

    return `
      <div class="bar-item">
        <div class="bar ${item.className}" style="height: ${height}px"></div>
        <div class="bar-label">${item.label}</div>
        <div class="bar-value">${formatMoney(item.value)}</div>
      </div>
    `;
  }).join("");
}

function renderCategoryChart(categoryTotals) {
  const chart = document.getElementById("categoryChart");

  if (!chart) {
    return;
  }

  const entries = Object.keys(categoryTotals).map(function(category) {
    return {
      category: category,
      amount: categoryTotals[category]
    };
  }).sort(function(a, b) {
    return b.amount - a.amount;
  });

  if (entries.length === 0) {
    chart.innerHTML = '<div class="empty-state">No expense data yet.</div>';
    return;
  }

  const maxAmount = entries[0].amount || 1;

  chart.innerHTML = entries.map(function(item) {
    const width = Math.max((item.amount / maxAmount) * 100, 5);

    return `
      <div class="category-row">
        <div class="category-name">${escapeHtml(item.category)}</div>
        <div class="category-track">
          <div class="category-fill" style="width: ${width}%"></div>
        </div>
        <div class="category-amount">${formatMoney(item.amount)}</div>
      </div>
    `;
  }).join("");
}

function renderHistory(transactions) {
  const body = document.getElementById("historyBody");

  if (!body) {
    return;
  }

  const filteredTransactions = filterHistoryTransactions(transactions);
  renderHistorySummary(filteredTransactions);

  if (filteredTransactions.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">No transactions found for this period.</td>
      </tr>
    `;
    return;
  }

  body.innerHTML = filteredTransactions.map(function(item) {
    const isIncome = item.type === "income";
    const sign = isIncome ? "+" : "-";
    const tagClass = isIncome ? "income-tag" : "expense-tag";
    const amountClass = isIncome ? "income-text" : "expense-text";

    return `
      <tr>
        <td><span class="tag ${tagClass}">${capitalize(item.type)}</span></td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.date)}</td>
        <td class="${amountClass}">${sign} ${formatMoney(item.amount)}</td>
        <td><button class="delete-btn" onclick="deleteTransaction(${item.id})">Delete</button></td>
      </tr>
    `;
  }).join("");
}

function filterHistoryTransactions(transactions) {
  const range = getValue("historyRange") || "all";
  const search = getValue("historySearch").toLowerCase();
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  return transactions.filter(function(item) {
    const itemDate = new Date(item.date + "T00:00:00");
    const matchesSearch = !search ||
      item.name.toLowerCase().includes(search) ||
      item.category.toLowerCase().includes(search) ||
      item.type.toLowerCase().includes(search);

    if (!matchesSearch) {
      return false;
    }

    if (range === "all") {
      return true;
    }

    const startDate = new Date(today);

    if (range === "week") {
      startDate.setDate(today.getDate() - 6);
    } else if (range === "month") {
      startDate.setMonth(today.getMonth() - 1);
    } else if (range === "year") {
      startDate.setFullYear(today.getFullYear() - 1);
    }

    startDate.setHours(0, 0, 0, 0);
    return itemDate >= startDate && itemDate <= today;
  });
}

function renderHistorySummary(transactions) {
  const summary = document.getElementById("historySummary");

  if (!summary) {
    return;
  }

  const totals = calculateTotals(transactions);

  summary.innerHTML = `
    <div class="history-stat">
      <span>Records</span>
      <strong>${transactions.length}</strong>
    </div>
    <div class="history-stat">
      <span>Income</span>
      <strong>${formatMoney(totals.income)}</strong>
    </div>
    <div class="history-stat">
      <span>Expense</span>
      <strong>${formatMoney(totals.expense)}</strong>
    </div>
  `;
}

function getTransactions() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    saveTransactions(starterTransactions);
    return starterTransactions.slice();
  }

  return JSON.parse(saved);
}

function saveTransactions(transactions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
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
