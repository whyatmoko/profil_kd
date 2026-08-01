const sidebar = document.querySelector(".sidebar");

const sidebarItems = [
  { href: "progress.html", icon: "trend", label: "IGI : Kualitas Data" },
  { href: "kpi-nik.html", icon: "minus", label: "KPI : NIK Invalid Pengurang" },
  { type: "group", label: "Profiling" },
  { href: "index.html", icon: "summary", label: "Summary", group: "profiling" },
  { href: "pkbu.html", icon: "building", label: "PKBU", group: "profiling" },
  { href: "tk.html", icon: "userCheck", label: "TK Aktif", group: "profiling" },
  { href: "tk-na.html", icon: "userMinus", label: "TK NA", group: "profiling" },
];

if (sidebar) {
  renderSidebarMenu();
  bindSidebarToggle();
  bindProfilingDropdown();
}

function renderSidebarMenu() {
  const nav = sidebar.querySelector("nav");
  if (!nav) return;
  const currentPage = location.pathname.split("/").pop() || "index.html";
  nav.innerHTML = sidebarItems.map((item) => {
    if (item.type === "group") return `<div class="nav-group">${item.label}</div>`;
    const active = item.href === currentPage ? " active" : "";
    return `<a class="${active}" href="${item.href}" data-group="${item.group ?? ""}"><span class="nav-icon">${iconSvg(item.icon)}</span>${item.label}</a>`;
  }).join("");
}

function iconSvg(name) {
  const icons = {
    summary: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7"></rect><rect x="13" y="4" width="7" height="7"></rect><rect x="4" y="13" width="7" height="7"></rect><rect x="13" y="13" width="7" height="7"></rect></svg>`,
    trend: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16"></path><path d="M5 15l4-4 4 2 6-7"></path><path d="M15 6h4v4"></path></svg>`,
    minus: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M8 12h8"></path></svg>`,
    building: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V5h10v15"></path><path d="M15 9h4v11"></path><path d="M8 8h4M8 12h4M8 16h4"></path></svg>`,
    userCheck: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="4"></circle><path d="M3 20c1-4 4-6 8-6"></path><path d="M15 17l2 2 4-5"></path></svg>`,
    userMinus: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="4"></circle><path d="M3 20c1-4 4-6 8-6"></path><path d="M15 17h6"></path></svg>`,
  };
  return icons[name] ?? icons.summary;
}

function bindSidebarToggle() {
  const toggle = document.createElement("button");
  toggle.className = "sidebar-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Tampilkan atau sembunyikan sidebar");
  toggle.title = "Tampilkan / sembunyikan sidebar";
  toggle.textContent = "Menu";

  const eyebrow = document.querySelector(".topbar .eyebrow");
  if (eyebrow) {
    eyebrow.prepend(toggle);
    eyebrow.classList.add("with-sidebar-toggle");
  } else {
    document.body.appendChild(toggle);
  }

  const applyState = () => {
    const hidden = localStorage.getItem("kualitasData.sidebarHidden") === "1";
    document.body.classList.toggle("sidebar-hidden", hidden);
    toggle.setAttribute("aria-expanded", String(!hidden));
  };

  toggle.addEventListener("click", () => {
    const nextHidden = !document.body.classList.contains("sidebar-hidden");
    localStorage.setItem("kualitasData.sidebarHidden", nextHidden ? "1" : "0");
    applyState();
  });

  applyState();
}

function bindProfilingDropdown() {
  const profilingGroup = sidebar.querySelector(".nav-group");
  if (!profilingGroup) return;

  const links = [...sidebar.querySelectorAll('a[data-group="profiling"]')];
  const button = document.createElement("button");
  button.className = "nav-group-toggle";
  button.type = "button";
  button.innerHTML = `<span>v</span>Profiling`;
  profilingGroup.replaceWith(button);

  const applyProfilingState = () => {
    const activeChild = links.some((link) => link.classList.contains("active"));
    const collapsed = localStorage.getItem("kualitasData.profilingCollapsed") === "1" && !activeChild;
    button.classList.toggle("collapsed", collapsed);
    button.setAttribute("aria-expanded", String(!collapsed));
    links.forEach((link) => {
      link.hidden = collapsed;
    });
  };

  button.addEventListener("click", () => {
    const nextCollapsed = !button.classList.contains("collapsed");
    localStorage.setItem("kualitasData.profilingCollapsed", nextCollapsed ? "1" : "0");
    applyProfilingState();
  });

  applyProfilingState();
}
