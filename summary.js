const datasets = [
  {
    key: "pkbuProfiler.activeData.v1",
    title: "Kelengkapan PKBU",
    rowLabel: "NPP/perusahaan",
    storageLabel: "PKBU",
  },
  {
    key: "tkAktifProfiler.activeData.v1",
    title: "Kelengkapan TK Aktif",
    rowLabel: "TK aktif",
    storageLabel: "TK Aktif",
  },
  {
    key: "tkNaProfiler.activeData.v1",
    title: "Kelengkapan TK NA",
    rowLabel: "TK NA",
    storageLabel: "TK NA",
  },
];

const els = {
  sourceNote: document.querySelector("#summarySourceNote"),
  summaryMeta: document.querySelector("#summaryMeta"),
  refreshSummary: document.querySelector("#refreshSummary"),
  downloadPdf: document.querySelector("#downloadPdf"),
  summarySections: document.querySelector("#summarySections"),
};

const fmtNumber = new Intl.NumberFormat("id-ID");
const fmtPct = new Intl.NumberFormat("id-ID", { style: "percent", maximumFractionDigits: 1 });

const officeLookup = new Map([
  ["L00", "Semarang Pemuda"],
  ["L01", "Surakarta"],
  ["L02", "Cilacap"],
  ["L03", "Yogyakarta"],
  ["L04", "Pekalongan"],
  ["L05", "Kudus"],
  ["L06", "Magelang"],
  ["L07", "Tegal"],
  ["L08", "Klaten"],
  ["L09", "Purwokerto"],
  ["L10", "Ungaran"],
  ["L11", "Semarang Majapahit"],
  ["L12", "Sukoharjo Slamet Riyadi"],
  ["L13", "Sleman Godean"],
  ["L14", "Boyolali Randusari"],
  ["L15", "Purbalingga Ahmad Yani"],
  ["L16", "Bantul Ringin Harjo"],
  ["L17", "Gunung Kidul Wonosari"],
  ["L18", "Kulon Progo Wates"],
  ["L19", "Jepara Wahid Hasyim"],
  ["L20", "Pati Susanto"],
  ["L21", "Grobogan Purwodadi"],
  ["L22", "Karanganyar Triyagan"],
  ["L23", "Pemalang Perintis Kemerdekaan"],
  ["L24", "Sragen Sukowati"],
  ["L25", "Kebumen Pemuda"],
  ["L26", "Banjarnegara Pemuda"],
  ["L27", "Blora Ahmad Yani"],
  ["L28", "Batang Kauman"],
  ["L29", "Temanggung Kertosari"],
  ["L30", "Purworejo Tentara Pelajar"],
  ["L31", "Wonosobo Muntang"],
  ["L32", "Rembang Kartini"],
  ["L33", "Brebes Ahmad Yani"],
  ["L34", "Kendal Soekarno Hatta"],
  ["905", "Kanwil Jateng DIY"],
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function officeLabel(code) {
  const key = String(code ?? "").trim();
  const name = officeLookup.get(key);
  return name ? `${key} - ${name}` : key || "-";
}

function officeType(code) {
  const key = String(code ?? "").trim().toUpperCase();
  if (key === "905") return "Kanwil";
  const match = key.match(/^L(\d{2})$/);
  if (!match) return "Lainnya";
  const number = Number(match[1]);
  if (number <= 11) return "Cabang";
  if (number <= 34) return "KCP";
  return "Lainnya";
}

function parseNumber(value) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function openProfilerDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("qualityProfilerDb", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("datasets");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(key) {
  const db = await openProfilerDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("datasets", "readonly");
    const request = tx.objectStore("datasets").get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbDelete(key) {
  const db = await openProfilerDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("datasets", "readwrite");
    tx.objectStore("datasets").delete(key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function isStoredDataExpired(saved) {
  if (!saved?.savedAt) return true;
  return localDateKey(saved.savedAt) !== localDateKey();
}

function groupBy(rows, column, amountColumn) {
  const groups = new Map();
  for (const row of rows) {
    const name = String(row[column] ?? "Kosong").trim() || "Kosong";
    const current = groups.get(name) ?? { name, total: 0, rows: 0 };
    current.total += parseNumber(row[amountColumn]);
    current.rows += 1;
    groups.set(name, current);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}

function countProblemRows(rows) {
  const idColumn = rows.some((row) => row["Kode TK"]) ? "Kode TK" : "NPP";
  const unique = new Set(rows.map((row) => String(row[idColumn] ?? "").trim()).filter(Boolean));
  return unique.size || rows.length;
}

function summarizeDataset(config, data) {
  if (!data?.rows?.length) return { ...config, loaded: false };
  const rows = data.rows;
  const mapping = data.mapping;
  const amountColumn = mapping.amount;
  const total = rows.reduce((sum, row) => sum + parseNumber(row[amountColumn]), 0);
  const elementGroups = groupBy(rows, mapping.elemen, amountColumn);
  const branchGroups = groupBy(rows, mapping.cabang, amountColumn);
  const enrichBranch = (branch) => {
    const branchRows = rows.filter((row) => String(row[mapping.cabang] ?? "").trim() === branch.name);
    const topElement = groupBy(branchRows, mapping.elemen, amountColumn)[0];
    return {
      ...branch,
      officeType: officeType(branch.name),
      topElement: topElement?.name ?? "-",
      topElementTotal: topElement?.total ?? 0,
      share: total ? branch.total / total : 0,
    };
  };
  const enrichedBranches = branchGroups.map(enrichBranch);
  const topBranches = enrichedBranches.slice(0, 5);
  const topCabang = enrichedBranches.filter((branch) => branch.officeType === "Cabang").slice(0, 5);
  const topKcp = enrichedBranches.filter((branch) => branch.officeType === "KCP").slice(0, 5);

  return {
    ...config,
    loaded: true,
    rows,
    fileName: data.fileName ?? "-",
    savedAt: data.savedAt ?? null,
    total,
    problemRows: countProblemRows(rows),
    elementGroups,
    branchGroups,
    topBranches,
    topCabang,
    topKcp,
    topElement: elementGroups[0],
    topBranch: branchGroups[0],
  };
}

function barList(items, total, options = {}) {
  if (!items.length) return `<p class="empty">Belum ada data.</p>`;
  const max = Math.max(...items.map((item) => item.total), 1);
  return items.map((item) => {
    const width = Math.max(1, item.total / max * 100);
    const label = options.labelFn ? options.labelFn(item.name) : item.name;
    return `
      <div class="bar-row">
        <div class="bar-meta">
          <span title="${escapeHtml(label)}">${escapeHtml(label)}</span>
          <em>${fmtPct.format(total ? item.total / total : 0)}</em>
          <strong>${fmtNumber.format(item.total)} temuan</strong>
        </div>
        <div class="bar-track"><i style="--bar:${width.toFixed(2)}%"></i></div>
      </div>
    `;
  }).join("");
}

function paretoTable(items, emptyLabel) {
  if (!items.length) return `<p class="empty">${escapeHtml(emptyLabel)}</p>`;
  return `
    <div class="table-wrap summary-table-wrap">
      <table class="pivot-table">
        <thead>
          <tr>
            <th>Cabang</th>
            <th class="num">Total</th>
            <th class="num">Share</th>
            <th>Elemen</th>
            <th class="num">Temuan</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((branch) => `
            <tr>
              <td><strong>${escapeHtml(officeLabel(branch.name))}</strong></td>
              <td class="num">${fmtNumber.format(branch.total)}</td>
              <td class="num">${fmtPct.format(branch.share)}</td>
              <td>${escapeHtml(branch.topElement)}</td>
              <td class="num">${fmtNumber.format(branch.topElementTotal)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function improvementInsight(summary) {
  if (!summary.loaded) return ["Upload data pada halaman profiling terkait untuk menampilkan summary."];
  const top3Elements = summary.elementGroups.slice(0, 3);
  const topCabangShare = summary.topCabang.reduce((sum, item) => sum + item.total, 0) / Math.max(summary.total, 1);
  const topKcpShare = summary.topKcp.reduce((sum, item) => sum + item.total, 0) / Math.max(summary.total, 1);
  return [
    `Prioritas elemen: ${top3Elements.map((item) => `${item.name} (${fmtNumber.format(item.total)})`).join(", ")}.`,
    `Fokus Cabang: top 5 cabang menampung ${fmtPct.format(topCabangShare)} dari total temuan.`,
    `Fokus KCP: top 5 KCP menampung ${fmtPct.format(topKcpShare)} dari total temuan.`,
    `${officeLabel(summary.topBranch?.name)} menjadi target pertama; elemen terbesar di unit ini adalah ${summary.topBranches[0]?.topElement ?? "-"} (${fmtNumber.format(summary.topBranches[0]?.topElementTotal ?? 0)} temuan).`,
  ];
}

function insightList(summary) {
  return improvementInsight(summary).map((line) => `<i>${escapeHtml(line)}</i>`).join("");
}

function renderDatasetSection(summary) {
  if (!summary.loaded) {
    return `
      <article class="panel summary-section">
        <div class="panel-head">
          <div>
            <h2>${escapeHtml(summary.title)}</h2>
            <p>Belum ada data temporary.</p>
          </div>
        </div>
        <div class="summary-empty">Upload data di menu ${escapeHtml(summary.storageLabel)} terlebih dahulu.</div>
      </article>
    `;
  }

  return `
    <article class="panel summary-section">
      <div class="panel-head">
        <div>
          <h2>${escapeHtml(summary.title)}</h2>
          <p>${escapeHtml(summary.fileName)} | ${fmtNumber.format(summary.problemRows)} ${escapeHtml(summary.rowLabel)} bermasalah | ${fmtNumber.format(summary.total)} temuan</p>
        </div>
      </div>
      <div class="summary-grid">
        <section>
          <h3>Proporsi dan Total Temuan per Elemen</h3>
          <div class="bars">${barList(summary.elementGroups, summary.total)}</div>
        </section>
        <section>
          <h3>5 Cabang Beban Tertinggi</h3>
          ${paretoTable(summary.topCabang, "Tidak ada data Cabang.")}
          <h3 class="summary-subtitle">5 KCP Beban Tertinggi</h3>
          ${paretoTable(summary.topKcp, "Tidak ada data KCP.")}
        </section>
        <section class="summary-insight">
          <h3>Insight Perbaikan</h3>
          <span>${insightList(summary)}</span>
        </section>
      </div>
    </article>
  `;
}

function renderOverall(summaries) {
  const loaded = summaries.filter((summary) => summary.loaded);
  els.summaryMeta.textContent = loaded.length
    ? `${loaded.length} dari ${datasets.length} dataset sudah tersedia.`
    : "Belum ada dataset tersimpan. Upload data di halaman profiling terlebih dahulu.";
}

async function loadSummary() {
  els.summarySections.innerHTML = `<article class="panel"><div class="summary-empty">Memuat summary...</div></article>`;
  const summaries = [];
  for (const config of datasets) {
    const data = await idbGet(config.key).catch(() => null);
    if (isStoredDataExpired(data)) {
      if (data) await idbDelete(config.key).catch(() => {});
      summaries.push(summarizeDataset(config, null));
      continue;
    }
    summaries.push(summarizeDataset(config, data));
  }
  renderOverall(summaries);
  els.summarySections.innerHTML = summaries.map(renderDatasetSection).join("");
}

els.refreshSummary.addEventListener("click", loadSummary);
els.downloadPdf.addEventListener("click", () => {
  window.print();
});
loadSummary();
