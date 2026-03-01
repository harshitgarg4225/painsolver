(function docsPage(window, document) {
  var navLinks = Array.prototype.slice.call(document.querySelectorAll("#doc-nav-list a"));
  var sections = Array.prototype.slice.call(document.querySelectorAll(".docs-content section"));
  var searchInput = document.getElementById("doc-search");
  var copyButtons = Array.prototype.slice.call(document.querySelectorAll(".copy-btn"));

  function setActiveLink(hash) {
    navLinks.forEach(function (link) {
      var isActive = link.getAttribute("href") === hash;
      link.classList.toggle("active", isActive);
    });
  }

  function computeActiveSection() {
    var offset = window.scrollY + 120;
    var current = sections[0];

    sections.forEach(function (section) {
      if (section.offsetTop <= offset) {
        current = section;
      }
    });

    if (current && current.id) {
      setActiveLink("#" + current.id);
    }
  }

  function filterSections(query) {
    var value = String(query || "").trim().toLowerCase();

    sections.forEach(function (section) {
      var title = (section.getAttribute("data-title") || "").toLowerCase();
      var text = section.textContent ? section.textContent.toLowerCase() : "";
      var visible = !value || title.indexOf(value) >= 0 || text.indexOf(value) >= 0;
      section.style.display = visible ? "block" : "none";
    });

    navLinks.forEach(function (link) {
      var targetId = (link.getAttribute("href") || "").replace("#", "");
      var target = document.getElementById(targetId);
      link.style.display = target && target.style.display !== "none" ? "block" : "none";
    });
  }

  function copyCode(event) {
    var button = event.currentTarget;
    var code = button.parentElement && button.parentElement.querySelector("code");
    if (!code) {
      return;
    }

    var text = code.textContent || "";
    if (!text.trim()) {
      return;
    }

    window.navigator.clipboard
      .writeText(text)
      .then(function () {
        var original = button.textContent;
        button.textContent = "Copied";
        button.classList.add("copied");
        window.setTimeout(function () {
          button.textContent = original;
          button.classList.remove("copied");
        }, 1200);
      })
      .catch(function () {
        button.textContent = "Copy failed";
      });
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      filterSections(searchInput.value);
    });
  }

  copyButtons.forEach(function (button) {
    button.addEventListener("click", copyCode);
  });

  window.addEventListener("scroll", computeActiveSection, { passive: true });
  window.addEventListener("hashchange", function () {
    setActiveLink(window.location.hash || "#install");
  });

  setActiveLink(window.location.hash || "#install");
  computeActiveSection();
})(window, document);
