const defaultSettings = {
  currency: "MYR",
  darkMode: false
};

let currentUser = null;
let currentSettings = Object.assign({}, defaultSettings);
let currentTransactions = [];
let currentGoals = [];
let supportedCurrencies = [
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "USD", name: "US Dollar" },
  { code: "SGD", name: "Singapore Dollar" }
];

async function apiRequest(url, options) {
  const response = await fetch(url, Object.assign({
    headers: {
      "Content-Type": "application/json"
    }
  }, options || {}));
  const data = await response.json().catch(function() {
    return {};
  });

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

async function enterApp(user, settings) {
  user = user || getCurrentUser();

  if (!user) {
    return;
  }

  currentUser = user;
  currentSettings = Object.assign({}, defaultSettings, settings || currentSettings);
  document.getElementById("home").style.display = "none";
  document.getElementById("appShell").classList.remove("app-hidden");
  setText("currentUserName", user.name);
  setText("currentUserEmail", user.email);
  setText("currentUserAvatar", user.name.charAt(0).toUpperCase());
  setText("currentUserDetails", (user.age || "-") + " years | " + (user.gender || "Not set"));
  setValue("settingsName", user.name);
  setValue("settingsStudentId", user.studentId || "");
  setValue("settingsSecurityQuestion", user.securityQuestion || "");
  setValue("settingsSecurityAnswer", "");
  setValue("settingsAge", user.age || "");
  setValue("settingsGender", user.gender || "Prefer not to say");
  applySettings();
  await refreshUserData();
  loadDashboard();
}

function showAuthForm(type) {
  const signingIn = type === "signin";
  const signingUp = type === "signup";
  document.getElementById("signInForm").classList.toggle("auth-hidden", !signingIn);
  document.getElementById("signUpForm").classList.toggle("auth-hidden", !signingUp);
  document.getElementById("forgotPasswordForm").classList.toggle("auth-hidden", type !== "forgot");
  document.getElementById("signInTab").classList.toggle("active", signingIn);
  document.getElementById("signUpTab").classList.toggle("active", signingUp);
  showAuthMessage("", "");
}

async function signUp(event) {
  event.preventDefault();
  const name = getValue("signUpName");
  const email = getValue("signUpEmail").toLowerCase();
  const studentId = getValue("signUpStudentId");
  const securityQuestion = getValue("signUpSecurityQuestion");
  const securityAnswer = getValue("signUpSecurityAnswer");
  const age = Number(getValue("signUpAge"));
  const gender = getValue("signUpGender");
  const password = getValue("signUpPassword");

  if (!name || !email || age < 13 || age > 100 || !gender || password.length < 4) {
    showAuthMessage("Complete all fields. Age must be 13-100 and password at least 4 characters.", "error");
    return;
  }

  try {
    const data = await apiRequest("/signup", {
      method: "POST",
      body: JSON.stringify({
        name: name,
        email: email,
        studentId: studentId,
        securityQuestion: securityQuestion,
        securityAnswer: securityAnswer,
        age: age,
        gender: gender,
        password: password
      })
    });
    await enterApp(data.user, data.settings);
  } catch (error) {
    showAuthMessage(error.message, "error");
  }
}

async function signIn(event) {
  event.preventDefault();
  const email = getValue("signInEmail").toLowerCase();
  const password = getValue("signInPassword");

  try {
    const data = await apiRequest("/signin", {
      method: "POST",
      body: JSON.stringify({ email: email, password: password })
    });
    await enterApp(data.user, data.settings);
  } catch (error) {
    showAuthMessage(error.message, "error");
  }
}

async function resetAccountPassword(event) {
  event.preventDefault();
  const name = getValue("resetName");
  const email = getValue("resetEmail").toLowerCase();
  const studentId = getValue("resetStudentId");
  const securityAnswer = getValue("resetSecurityAnswer");
  const password = getValue("resetPassword");

  if (!name || !email || !studentId || !securityAnswer) {
    showAuthMessage("Registered full name, email, student ID, and security answer are required.", "error");
    return;
  }

  if (password.length < 4) {
    showAuthMessage("New password must have at least 4 characters.", "error");
    return;
  }

  try {
    const data = await apiRequest("/reset-password", {
      method: "POST",
      body: JSON.stringify({
        name: name,
        email: email,
        studentId: studentId,
        securityAnswer: securityAnswer,
        password: password
      })
    });
    showAuthForm("signin");
    setValue("signInEmail", email);
    showAuthMessage(data.message, "success");
  } catch (error) {
    showAuthMessage(error.message, "error");
  }
}

function logout() {
  currentUser = null;
  currentTransactions = [];
  currentGoals = [];
  document.getElementById("appShell").classList.add("app-hidden");
  document.getElementById("home").style.display = "flex";
  setValue("signInPassword", "");
  showAuthForm("signin");
}

function getUsers() {
  return [];
}

function showAuthMessage(text, status) {
  const message = document.getElementById("authMessage");
  message.textContent = text;
  message.className = "auth-message " + status;
}

function getSettings() {
  return Object.assign({}, defaultSettings, currentSettings);
}

function normalizeCurrencyCode(currency) {
  return currency === "RM" ? "MYR" : (currency || "MYR");
}

function getCurrentUser() {
  return currentUser;
}

function applySettings() {
  const settings = getSettings();
  settings.currency = normalizeCurrencyCode(settings.currency);
  populateCurrencySelects();
  setValue("settingsCurrency", settings.currency);
  document.getElementById("settingsDarkMode").checked = settings.darkMode;
  document.body.classList.toggle("dark-mode", settings.darkMode);
}

async function loadCurrencies() {
  try {
    supportedCurrencies = await apiRequest("/currencies");
  } catch (error) {
    supportedCurrencies = [
      { code: "MYR", name: "Malaysian Ringgit" },
      { code: "USD", name: "US Dollar" },
      { code: "SGD", name: "Singapore Dollar" }
    ];
  }

  populateCurrencySelects();
}

function populateCurrencySelects() {
  const options = supportedCurrencies.map(function(currency) {
    return '<option value="' + escapeHtml(currency.code) + '">' +
      escapeHtml(currency.code + " - " + currency.name) + '</option>';
  }).join("");
  const ids = ["settingsCurrency", "incomeCurrency", "expenseCurrency", "convertFrom", "convertTo"];

  ids.forEach(function(id) {
    const element = document.getElementById(id);

    if (element && element.options.length !== supportedCurrencies.length) {
      element.innerHTML = options;
    }
  });

  const currency = normalizeCurrencyCode(getSettings().currency);
  setValue("incomeCurrency", currency);
  setValue("expenseCurrency", currency);
  setValue("convertFrom", "USD");
  setValue("convertTo", currency);
}

async function saveProfileSettings() {
  const user = getCurrentUser();
  const name = getValue("settingsName");
  const studentId = getValue("settingsStudentId");
  const securityQuestion = getValue("settingsSecurityQuestion");
  const securityAnswer = getValue("settingsSecurityAnswer");
  const age = Number(getValue("settingsAge"));
  const gender = getValue("settingsGender");

  if (!user || !name || age < 13 || age > 100 || !gender) {
    showFormStatus("profileMessage", "Enter a valid name, age from 13 to 100, and gender.", "error");
    return;
  }

  try {
    const data = await apiRequest("/profile/" + user.id, {
      method: "PUT",
      body: JSON.stringify({
        name: name,
        age: age,
        gender: gender,
        studentId: studentId,
        securityQuestion: securityQuestion,
        securityAnswer: securityAnswer
      })
    });
    currentUser = data.user;
    setText("currentUserName", currentUser.name);
    setText("currentUserAvatar", currentUser.name.charAt(0).toUpperCase());
    setText("currentUserDetails", currentUser.age + " years | " + currentUser.gender);
    setValue("settingsSecurityAnswer", "");
    showFormStatus("profileMessage", "Profile updated successfully.", "success");
  } catch (error) {
    showFormStatus("profileMessage", error.message, "error");
  }
}

function showFormStatus(id, text, status) {
  const message = document.getElementById(id);

  if (message) {
    message.textContent = text;
    message.className = "form-message " + status;
  }
}

async function savePreferenceSettings() {
  const user = getCurrentUser();
  const settings = getSettings();
  settings.currency = normalizeCurrencyCode(getValue("settingsCurrency"));
  settings.darkMode = document.getElementById("settingsDarkMode").checked;

  if (!user) {
    return;
  }

  try {
    currentSettings = await apiRequest("/settings/" + user.id, {
      method: "PUT",
      body: JSON.stringify(settings)
    });
    applySettings();
    await refreshUserData();
    loadDashboard();
  } catch (error) {
    showFormStatus("profileMessage", error.message, "error");
  }
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

function openDashboardPage() {
  const dashboardMenu = document.querySelector(".menu div");

  if (dashboardMenu) {
    showPage("dashboard", dashboardMenu);
  }
}

async function refreshUserData() {
  const user = getCurrentUser();

  if (!user) {
    currentTransactions = [];
    currentGoals = [];
    return;
  }

  const userId = encodeURIComponent(user.id);
  const currency = encodeURIComponent(normalizeCurrencyCode(getSettings().currency));
  const results = await Promise.all([
    apiRequest("/transactions?user_id=" + userId + "&currency=" + currency),
    apiRequest("/goals?user_id=" + userId),
    apiRequest("/settings/" + userId)
  ]);

  currentTransactions = results[0];
  currentGoals = results[1];
  currentSettings = Object.assign({}, defaultSettings, results[2]);
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
  renderCategoryChart(totals.categoryBreakdown);
  renderSmartSuggestions(totals);
  renderHistory(transactions);
  renderGoals();
}

async function createGoal() {
  const name = getValue("goalName");
  const target = Number(getValue("goalAmount"));
  const targetDate = getValue("goalDate");
  const user = getCurrentUser();

  if (!user || !name || target <= 0 || !targetDate) {
    showGoalMessage("Please enter a goal name, target amount, and target date.", "error");
    return;
  }

  const selectedDate = new Date(targetDate + "T23:59:59");

  if (selectedDate < new Date()) {
    showGoalMessage("Please choose a future target date.", "error");
    return;
  }

  try {
    await apiRequest("/goals", {
      method: "POST",
      body: JSON.stringify({
        user_id: user.id,
        name: name,
        target: target,
        targetDate: targetDate
      })
    });
    await refreshUserData();
    setValue("goalName", "");
    setValue("goalAmount", "");
    setValue("goalDate", "");
    showGoalMessage("Savings goal created successfully.", "success");
    renderGoals();
  } catch (error) {
    showGoalMessage(error.message, "error");
  }
}

async function addGoalSavings(id) {
  const amount = Number(getValue("goalContribution-" + id));
  const user = getCurrentUser();

  if (!user || amount <= 0) {
    showGoalMessage("Enter an amount greater than RM 0.", "error");
    return;
  }

  try {
    await apiRequest("/goals/" + id + "/savings", {
      method: "PUT",
      body: JSON.stringify({ user_id: user.id, amount: amount })
    });
    await refreshUserData();
    showGoalMessage("Savings progress updated.", "success");
    renderGoals();
  } catch (error) {
    showGoalMessage(error.message, "error");
  }
}

async function deleteGoal(id) {
  const user = getCurrentUser();

  if (!user) {
    return;
  }

  try {
    await apiRequest("/goals/" + id + "?user_id=" + encodeURIComponent(user.id), {
      method: "DELETE"
    });
    await refreshUserData();
    showGoalMessage("Goal deleted.", "success");
    renderGoals();
  } catch (error) {
    showGoalMessage(error.message, "error");
  }
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
  return currentGoals.slice();
}

function saveGoals(goals) {
  currentGoals = goals.slice();
}

function showGoalMessage(text, status) {
  const message = document.getElementById("goalMessage");

  if (!message) {
    return;
  }

  message.textContent = text;
  message.className = "form-message " + status;
}

async function addTransaction(type) {
  const isIncome = type === "income";
  const name = getValue(isIncome ? "incomeName" : "expenseName");
  const amount = Number(getValue(isIncome ? "incomeAmount" : "expenseAmount"));
  const currency = normalizeCurrencyCode(getValue(isIncome ? "incomeCurrency" : "expenseCurrency"));
  const date = getValue(isIncome ? "incomeDate" : "expenseDate");
  const category = getValue(isIncome ? "incomeCategory" : "expenseCategory");
  const user = getCurrentUser();

  if (!user || !name || !Number.isFinite(amount) || amount <= 0 || !date || !category || !currency) {
    showMessage("Please fill in name, amount greater than 0, currency, date, and category.", "error");
    return;
  }

  try {
    await apiRequest("/add", {
      method: "POST",
      body: JSON.stringify({
        user_id: user.id,
        type: type,
        name: name,
        amount: amount,
        currency: currency,
        displayCurrency: normalizeCurrencyCode(getSettings().currency),
        category: category,
        date: date
      })
    });
    await refreshUserData();
    clearTransactionForm(type);
    loadDashboard();
    const updatedTotals = calculateTotals(getTransactions());
    const updatedAmount = isIncome ? updatedTotals.income : updatedTotals.expense;
    showMessage(
      (isIncome ? "Income" : "Expense") + " added. Chart updated to " +
      formatMoney(updatedAmount) + ".",
      "success"
    );
    setText(
      "chartUpdateStatus",
      (isIncome ? "Income" : "Expense") + ": " + formatMoney(updatedAmount)
    );
    openDashboardPage();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function deleteTransaction(id) {
  const user = getCurrentUser();

  if (!user) {
    return;
  }

  try {
    await apiRequest("/delete/" + id + "?user_id=" + encodeURIComponent(user.id), {
      method: "DELETE"
    });
    await refreshUserData();
    showMessage("Transaction deleted.", "success");
    loadDashboard();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

function calculateTotals(transactions) {
  let income = 0;
  let expense = 0;
  const categoryTotals = {};
  const categoryBreakdown = {
    income: {},
    expense: {}
  };

  transactions.forEach(function(item) {
    const amount = Number(item.amount);

    if (!Number.isFinite(amount) || amount < 0) {
      return;
    }

    if (item.type === "income") {
      income += amount;
      const incomeCategory = item.category || "Income";
      categoryBreakdown.income[incomeCategory] = (categoryBreakdown.income[incomeCategory] || 0) + amount;
      return;
    }

    if (item.type !== "expense") {
      return;
    }

    expense += amount;
    const category = item.category || "Other";
    categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    categoryBreakdown.expense[category] = (categoryBreakdown.expense[category] || 0) + amount;
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
    categoryTotals: categoryTotals,
    categoryBreakdown: categoryBreakdown
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
  const chartScale = getChartScale(maxValue);

  chart.innerHTML = values.map(function(item) {
    const height = item.value > 0
      ? Math.max((item.value / chartScale) * 190, 10)
      : 0;

    return `
      <div class="bar-item">
        <div class="bar ${item.className}" style="height: ${height}px"></div>
        <div class="bar-label">${item.label}</div>
        <div class="bar-value">${formatMoney(item.value)}</div>
      </div>
    `;
  }).join("");
}

function renderCategoryChart(categoryBreakdown) {
  const chart = document.getElementById("categoryChart");

  if (!chart) {
    return;
  }

  const groups = [
    { key: "income", label: "Income", empty: "No income category data yet." },
    { key: "expense", label: "Expense", empty: "No expense category data yet." }
  ];

  const sections = groups.map(function(group) {
    const totals = (categoryBreakdown && categoryBreakdown[group.key]) || {};
    const entries = Object.keys(totals).map(function(category) {
      return {
        category: category,
        amount: totals[category],
        type: group.key
      };
    }).sort(function(a, b) {
      return b.amount - a.amount;
    });

    if (entries.length === 0) {
      return `
        <div class="category-section">
          <div class="category-section-title">${group.label}</div>
          <div class="empty-state">${group.empty}</div>
        </div>
      `;
    }

    const maxAmount = entries[0].amount || 1;
    const rows = entries.map(function(item) {
      const width = Math.max((item.amount / maxAmount) * 100, 5);

      return `
        <div class="category-row">
          <div class="category-name">
            <span class="category-type ${item.type}">${group.label}</span>
            ${escapeHtml(item.category)}
          </div>
          <div class="category-track">
            <div class="category-fill ${item.type}-category-fill" style="width: ${width}%"></div>
          </div>
          <div class="category-amount">${formatMoney(item.amount)}</div>
        </div>
      `;
    }).join("");

    return {
      amount: entries.reduce(function(total, item) {
        return total + item.amount;
      }, 0),
      html: `
        <div class="category-section">
          <div class="category-section-title">${group.label}</div>
          ${rows}
        </div>
      `
    };
  }).sort(function(a, b) {
    return b.amount - a.amount;
  });

  if (sections.every(function(section) { return section.amount === 0; })) {
    chart.innerHTML = '<div class="empty-state">No income or expense data yet.</div>';
    return;
  }

  chart.innerHTML = sections.map(function(section) {
    return section.html;
  }).join("");
}

function getChartScale(maxValue) {
  const scaleSteps = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
  const nextStep = scaleSteps.find(function(step) {
    return step > maxValue;
  });

  if (nextStep) {
    return nextStep;
  }

  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
  return Math.ceil((maxValue + 1) / magnitude) * magnitude;
}

function renderSmartSuggestions(totals) {
  const list = document.getElementById("adviceList");
  const status = document.getElementById("adviceStatus");

  if (!list || !status) {
    return;
  }

  showSmartSuggestions(buildSmartSuggestions(totals));

  const user = getCurrentUser();

  if (!user) {
    return;
  }

  apiRequest(
    "/smart-suggestions?user_id=" + encodeURIComponent(user.id) +
    "&currency=" + encodeURIComponent(getSettings().currency)
  ).then(function(data) {
    if (data.suggestions && data.suggestions.length > 0) {
      showSmartSuggestions(data.suggestions);
    }
  }).catch(function() {
    showSmartSuggestions(buildSmartSuggestions(totals));
  });
}

function showSmartSuggestions(suggestions) {
  const list = document.getElementById("adviceList");
  const status = document.getElementById("adviceStatus");

  if (!list || !status) {
    return;
  }

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
        <td class="${amountClass}">${sign} ${formatTransactionAmount(item)}</td>
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

    if (range === "today") {
      startDate.setHours(0, 0, 0, 0);
    } else if (range === "week") {
      startDate.setDate(today.getDate() - 6);
    } else if (range === "month") {
      startDate.setMonth(today.getMonth() - 1);
    } else if (range === "3months") {
      startDate.setMonth(today.getMonth() - 3);
    } else if (range === "6months") {
      startDate.setMonth(today.getMonth() - 6);
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

function getFilteredHistory() {
  return filterHistoryTransactions(getTransactions());
}

function exportHistoryCsv() {
  const transactions = getFilteredHistory();

  if (transactions.length === 0) {
    return;
  }

  const rows = [["Type", "Name", "Category", "Date", "Original Amount", "Converted Amount"]].concat(
    transactions.map(function(item) {
      return [
        item.type,
        item.name,
        item.category,
        item.date,
        formatOriginalMoney(item),
        formatMoney(item.amount)
      ];
    })
  );
  const csv = rows.map(function(row) {
    return row.map(function(value) {
      return '"' + String(value).replace(/"/g, '""') + '"';
    }).join(",");
  }).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "budgetmate-history-" + new Date().toISOString().slice(0, 10) + ".csv";
  link.click();
  URL.revokeObjectURL(url);
}

function printHistoryReport() {
  const transactions = getFilteredHistory();
  const totals = calculateTotals(transactions);
  const user = getCurrentUser();
  const report = window.open("", "_blank");

  if (!report) {
    return;
  }

  const rows = transactions.map(function(item) {
    return "<tr><td>" + escapeHtml(capitalize(item.type)) + "</td><td>" +
      escapeHtml(item.name) + "</td><td>" + escapeHtml(item.category) +
      "</td><td>" + escapeHtml(item.date) + "</td><td>" +
      escapeHtml(formatTransactionAmount(item)) + "</td></tr>";
  }).join("");

  report.document.write(
    "<!DOCTYPE html><html><head><title>BudgetMate Report</title>" +
    "<style>body{font-family:Arial;padding:35px;color:#1f2937}h1{color:#223161}" +
    ".summary{display:flex;gap:15px;margin:22px 0}.summary div{padding:14px 20px;background:#eef2ff;border-radius:10px}" +
    "table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}</style>" +
    "</head><body><h1>BudgetMate Financial Report</h1><p>" +
    escapeHtml(user ? user.name : "User") + " | Generated " + new Date().toLocaleDateString() +
    "</p><div class='summary'><div>Income<br><strong>" + formatMoney(totals.income) +
    "</strong></div><div>Expense<br><strong>" + formatMoney(totals.expense) +
    "</strong></div><div>Balance<br><strong>" + formatMoney(totals.balance) +
    "</strong></div></div><table><thead><tr><th>Type</th><th>Name</th><th>Category</th>" +
    "<th>Date</th><th>Amount</th></tr></thead><tbody>" + rows +
    "</tbody></table><script>window.onload=function(){window.print();}<\/script></body></html>"
  );
  report.document.close();
}

function getTransactions() {
  return currentTransactions.filter(function(item) {
    return item &&
      (item.type === "income" || item.type === "expense") &&
      Number.isFinite(Number(item.amount));
  }).map(function(item) {
    return {
      id: Number(item.id) || Date.now() + Math.random(),
      type: item.type,
      name: String(item.name || "Transaction"),
      amount: Number(item.amount),
      displayCurrency: normalizeCurrencyCode(item.displayCurrency || getSettings().currency),
      originalAmount: Number(item.originalAmount || item.amount),
      originalCurrency: normalizeCurrencyCode(item.originalCurrency || item.displayCurrency || getSettings().currency),
      exchangeRate: Number(item.exchangeRate || 1),
      category: String(item.category || (item.type === "income" ? "Income" : "Other")),
      date: String(item.date || "")
    };
  });
}

function saveTransactions(transactions) {
  currentTransactions = transactions.slice();
}

function clearTransactionForm(type) {
  if (type === "income") {
    setValue("incomeName", "");
    setValue("incomeAmount", "");
    setValue("incomeCurrency", normalizeCurrencyCode(getSettings().currency));
    setValue("incomeDate", "");
    setValue("incomeCategory", "Allowance");
  } else {
    setValue("expenseName", "");
    setValue("expenseAmount", "");
    setValue("expenseCurrency", normalizeCurrencyCode(getSettings().currency));
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

async function convertCurrencyPreview() {
  const amount = Number(getValue("convertAmount"));
  const fromCurrency = normalizeCurrencyCode(getValue("convertFrom"));
  const toCurrency = normalizeCurrencyCode(getValue("convertTo"));

  if (!Number.isFinite(amount) || amount <= 0 || !fromCurrency || !toCurrency) {
    showFormStatus("exchangeMessage", "Enter an amount greater than 0 and choose both currencies.", "error");
    return;
  }

  try {
    const data = await apiRequest(
      "/convert?amount=" + encodeURIComponent(amount) +
      "&from=" + encodeURIComponent(fromCurrency) +
      "&to=" + encodeURIComponent(toCurrency)
    );
    showFormStatus(
      "exchangeMessage",
      formatCurrencyAmount(data.amount, data.from) + " = " +
      formatCurrencyAmount(data.converted, data.to) +
      " (rate " + Number(data.rate).toFixed(6) + ")",
      "success"
    );
  } catch (error) {
    showFormStatus("exchangeMessage", error.message, "error");
  }
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
  const currency = normalizeCurrencyCode(getSettings().currency);
  return formatCurrencyAmount(value, currency);
}

function formatCurrencyAmount(value, currency) {
  currency = normalizeCurrencyCode(currency);
  const symbols = {
    MYR: "RM",
    USD: "$",
    SGD: "S$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
    AUD: "A$",
    CAD: "C$",
    THB: "฿",
    IDR: "Rp",
    KRW: "₩"
  };
  return (symbols[currency] || currency) + " " + Number(value).toFixed(2);
}

function formatOriginalMoney(item) {
  return formatCurrencyAmount(item.originalAmount || item.amount, item.originalCurrency || item.displayCurrency);
}

function formatTransactionAmount(item) {
  const converted = formatCurrencyAmount(item.amount, item.displayCurrency || getSettings().currency);
  const original = formatOriginalMoney(item);

  if (normalizeCurrencyCode(item.originalCurrency) === normalizeCurrencyCode(item.displayCurrency || getSettings().currency)) {
    return converted;
  }

  return original + " → " + converted;
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

document.addEventListener("DOMContentLoaded", async function() {
  await loadCurrencies();
  applySettings();
  const user = getCurrentUser();

  if (user) {
    enterApp(user);
  }
});
