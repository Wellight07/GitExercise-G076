const STORAGE_KEY = "budgetmate_transactions";
const GOALS_KEY = "budgetmate_goals";
const SETTINGS_KEY = "budgetmate_settings";

const defaultSettings = {
  currency: "RM",
  darkMode: false
};

const starterTransactions = [
  { id: 1, type: "income", name: "Allowance", amount: 500, category: "Income", date: "2026-05-13" },
  { id: 2, type: "expense", name: "Lunch", amount: 25, category: "Food", date: "2026-05-13" },
  { id: 3, type: "expense", name: "Train", amount: 18, category: "Transport", date: "2026-05-14" },
  { id: 4, type: "expense", name: "Notebook", amount: 32, category: "Education", date: "2026-05-15" }
];

function enterApp() {
  document.getElementById("home").style.display = "none";
  document.getElementById("appShell").classList.remove("app-hidden");
  applySettings();
  loadDashboard();
}

function getSettings() {
  try {
    return Object.assign({}, defaultSettings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {});
  } catch (error) {
    return Object.assign({}, defaultSettings);
  }
}

function getCurrentUser() {
  return { id: "local-user" };
}

function applySettings() {
  const settings = getSettings();
  setValue("settingsCurrency", settings.currency);
  document.getElementById("settingsDarkMode").checked = settings.darkMode;
  document.body.classList.toggle("dark-mode", settings.darkMode);
}

function saveProfileSettings() {
  return;
}

function savePreferenceSettings() {
  const settings = getSettings();
  settings.currency = getValue("settingsCurrency") || "RM";
  settings.darkMode = document.getElementById("settingsDarkMode").checked;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applySettings();
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
  renderSmartSuggestions(totals);
  renderHistory(transactions);
  renderGoals();
}

function createGoal() {
  const name = getValue("goalName");
  const target = Number(getValue("goalAmount"));
  const targetDate = getValue("goalDate");

  if (!name || target <= 0 || !targetDate) {
    showGoalMessage("Please enter a goal name, target amount, and target date.", "error");
    return;
  }

  const selectedDate = new Date(targetDate + "T23:59:59");

  if (selectedDate < new Date()) {
    showGoalMessage("Please choose a future target date.", "error");
    return;
  }

  const goals = getGoals();
  goals.push({
    id: Date.now(),
    name: name,
    target: target,
    saved: 0,
    targetDate: targetDate
  });

  saveGoals(goals);
  setValue("goalName", "");
  setValue("goalAmount", "");
  setValue("goalDate", "");
  showGoalMessage("Savings goal created successfully.", "success");
  renderGoals();
}

function addGoalSavings(id) {
  const amount = Number(getValue("goalContribution-" + id));

  if (amount <= 0) {
    showGoalMessage("Enter an amount greater than RM 0.", "error");
    return;
  }

  const goals = getGoals();
  const goal = goals.find(function(item) {
    return item.id === id;
  });

  if (!goal) {
    return;
  }

  goal.saved = Math.min(Number(goal.saved) + amount, Number(goal.target));
  saveGoals(goals);
  showGoalMessage("Savings progress updated.", "success");
  renderGoals();
}

function deleteGoal(id) {
  const goals = getGoals().filter(function(goal) {
    return goal.id !== id;
  });

  saveGoals(goals);
  showGoalMessage("Goal deleted.", "success");
  renderGoals();
}

function renderGoals() {
  const list = document.getElementById("goalList");

  if (!list) {
    return;
  }

  const goals = getGoals();
  const totalSaved = goals.reduce(function(total, goal) {
    return total + Number(goal.saved);
  }, 0);
  const totalTarget = goals.reduce(function(total, goal) {
    return total + Number(goal.target);
  }, 0);

  setText("activeGoalsValue", goals.filter(function(goal) {
    return Number(goal.saved) < Number(goal.target);
  }).length);
  setText("goalSavedValue", formatMoney(totalSaved));
  setText("goalTargetValue", formatMoney(totalTarget));

  if (goals.length === 0) {
    list.innerHTML = '<div class="panel empty-state">No savings goals yet. Create your first goal above.</div>';
    return;
  }

  list.innerHTML = goals.map(function(goal) {
    const percentage = Math.min((Number(goal.saved) / Number(goal.target)) * 100, 100);
    const completed = percentage >= 100;
    const deadline = getGoalDeadline(goal.targetDate, completed);
    const remaining = Math.max(Number(goal.target) - Number(goal.saved), 0);

    return `
      <article class="goal-card ${completed ? "completed" : ""}">
        <div class="goal-card-header">
          <div>
            <h3>${escapeHtml(goal.name)}</h3>
            <p class="goal-deadline">Target date: ${escapeHtml(goal.targetDate)}</p>
          </div>
          <span class="goal-badge ${deadline.overdue ? "overdue" : ""}">${escapeHtml(deadline.text)}</span>
        </div>
        <div class="goal-progress-track">
          <div class="goal-progress-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="goal-progress-text">
          <span>${formatMoney(goal.saved)} of ${formatMoney(goal.target)}</span>
          <span>${percentage.toFixed(0)}%</span>
        </div>
        <p class="goal-deadline">${completed ? "Goal achieved." : formatMoney(remaining) + " remaining."}</p>
        <div class="goal-actions">
          <input id="goalContribution-${goal.id}" type="number" min="0.01" step="0.01" placeholder="Add savings amount">
          <button class="goal-save-btn" type="button" onclick="addGoalSavings(${goal.id})">Add</button>
          <button class="goal-delete-btn" type="button" onclick="deleteGoal(${goal.id})">Delete Goal</button>
        </div>
      </article>
    `;
  }).join("");
}

function getGoalDeadline(targetDate, completed) {
  if (completed) {
    return { text: "Completed", overdue: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(targetDate + "T00:00:00");
  const days = Math.ceil((deadline - today) / 86400000);

  if (days < 0) {
    return { text: "Overdue", overdue: true };
  }

  if (days === 0) {
    return { text: "Due today", overdue: false };
  }

  return { text: days + " days left", overdue: false };
}

function getGoals() {
  const user = getCurrentUser();

  if (!user) {
    return [];
  }

  try {
    const allGoals = JSON.parse(localStorage.getItem(GOALS_KEY)) || {};
    return allGoals[user.id] || [];
  } catch (error) {
    return [];
  }
}

function saveGoals(goals) {
  const user = getCurrentUser();

  if (!user) {
    return;
  }

  let allGoals = {};

  try {
    allGoals = JSON.parse(localStorage.getItem(GOALS_KEY)) || {};
  } catch (error) {
    allGoals = {};
  }

  allGoals[user.id] = goals;
  localStorage.setItem(GOALS_KEY, JSON.stringify(allGoals));
}

function showGoalMessage(text, status) {
  const message = document.getElementById("goalMessage");

  if (!message) {
    return;
  }

  message.textContent = text;
  message.className = "form-message " + status;
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

function renderSmartSuggestions(totals) {
  const list = document.getElementById("adviceList");
  const status = document.getElementById("adviceStatus");

  if (!list || !status) {
    return;
  }

  const suggestions = buildSmartSuggestions(totals);
  const priority = suggestions.some(function(item) {
    return item.level === "danger";
  }) ? "danger" : suggestions.some(function(item) {
    return item.level === "warning";
  }) ? "warning" : "success";

  const statusLabels = {
    danger: "Action needed",
    warning: "Needs attention",
    success: "On track"
  };

  status.textContent = statusLabels[priority];
  status.className = "advice-status " + priority;
  list.innerHTML = suggestions.map(function(item) {
    return `
      <article class="advice-item ${item.level}">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.message)}</p>
      </article>
    `;
  }).join("");
}

function buildSmartSuggestions(totals) {
  if (totals.income <= 0) {
    return [{
      level: "warning",
      title: "Add income first",
      message: "Record your income so BudgetMate can compare your spending and give more accurate suggestions."
    }];
  }

  const suggestions = [];
  const expenseRate = (totals.expense / totals.income) * 100;
  const savingsRate = (totals.balance / totals.income) * 100;

  if (totals.expense > totals.income) {
    suggestions.push({
      level: "danger",
      title: "Spending is over your income",
      message: "You spent " + formatMoney(totals.expense - totals.income) +
        " more than your income. Pause non-essential purchases and set a weekly spending limit."
    });
  } else if (expenseRate >= 80) {
    suggestions.push({
      level: "warning",
      title: "Your spending is high",
      message: "Expenses use " + expenseRate.toFixed(0) +
        "% of your income. Try to keep at least 20% for savings."
    });
  } else if (expenseRate >= 60) {
    suggestions.push({
      level: "warning",
      title: "Watch your spending",
      message: "Expenses use " + expenseRate.toFixed(0) +
        "% of your income. Review optional purchases before adding new expenses."
    });
  } else {
    suggestions.push({
      level: "success",
      title: "Spending is under control",
      message: "You are using " + expenseRate.toFixed(0) +
        "% of your income and still have " + formatMoney(Math.max(totals.balance, 0)) + " available."
    });
  }

  const categoryEntries = Object.keys(totals.categoryTotals).map(function(category) {
    return { category: category, amount: totals.categoryTotals[category] };
  }).sort(function(a, b) {
    return b.amount - a.amount;
  });

  if (categoryEntries.length > 0 && totals.expense > 0) {
    const top = categoryEntries[0];
    const categoryRate = (top.amount / totals.expense) * 100;
    const suggestedLimit = totals.expense * 0.3;

    if (categoryRate >= 40) {
      suggestions.push({
        level: "warning",
        title: top.category + " is your highest expense",
        message: "It makes up " + categoryRate.toFixed(0) + "% of all spending. Try reducing it by " +
          formatMoney(Math.max(top.amount - suggestedLimit, 0)) + " to bring it closer to 30%."
      });
    } else {
      suggestions.push({
        level: "success",
        title: "Spending is well distributed",
        message: "Your largest category is " + top.category + " at " +
          categoryRate.toFixed(0) + "% of total expenses."
      });
    }
  }

  if (savingsRate >= 20) {
    suggestions.push({
      level: "success",
      title: "Good savings rate",
      message: "You are saving " + savingsRate.toFixed(0) +
        "% of your income. Consider moving part of it into your savings goal."
    });
  } else if (totals.balance > 0) {
    suggestions.push({
      level: "warning",
      title: "Build your savings",
      message: "Your savings rate is " + savingsRate.toFixed(0) +
        "%. Aim for 20% by saving another " + formatMoney((totals.income * 0.2) - totals.balance) + "."
    });
  }

  return suggestions;
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
  const currency = getSettings().currency;
  const symbols = { RM: "RM", USD: "$", SGD: "S$" };
  return symbols[currency] + " " + Number(value).toFixed(2);
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

document.addEventListener("DOMContentLoaded", function() {
  applySettings();
});
