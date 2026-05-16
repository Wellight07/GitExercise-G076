function enterApp() {
  document.getElementById("home").style.display = "none";
  document.getElementById("appShell").classList.remove("app-hidden");
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
}