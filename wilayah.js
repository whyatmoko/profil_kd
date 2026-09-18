const SHEET_ID = "2PACX-1vQtw4zahkq1MPDzwQJDjWRDdUN4ffG8O4aokdiIBvxh_YKvxnQ6-hNpTQXkQoidX8TrHZ0bku-VJE4K";
const PROGRES_GID = "282540056";
const FOCUS_WILAYAH = "905";

const wilayahMetrics = [
  { key: "nilai", label: "Total Score", field: "Total Bobot" },
  { key: "dup_na", label: "DUP NA", field: "Bobot Duplikasi TK Non Aktif", burden: "Sisa Duplikasi TK Non Aktif" },
  { key: "kel_tk_aktif", label: "Kelengkapan TK Aktif", field: "Bobot Kelengkapan TK Aktif", burden: "Sisa Kelengkapan TK Aktif" },
  { key: "kel_tk_na", label: "Kelengkapan TK NA", field: "Bobot Kelengkapan TK Non Aktif", burden: "Sisa Kelengkapan TK Non Aktif" },
  { key: "kel_pkbu", label: "Kelengkapan PKBU", field: "Bobot Kelengkapan PKBU", burden: "Sisa Kelengkapan PKBU" },
];

const wilayahState = {
  rows: [],
  snapshots: [],
  branchSnapshots: [],
  metric: "nilai",
  competitors: ["ALL"],
  rankSort: { key: "nilai", direction: "desc" },
  dailySort: null,
  branchSort: { metricKey: "nilai", part: "score", direction: "desc" },
  branchCategory: "all",
};

const wilayahEls = {
  sourceNote: document.querySelector("#wilayahSourceNote"),
  meta: document.querySelector("#wilayahMeta"),
  metricFilter: document.querySelector("#wilayahMetricFilter"),
  competitorDropdown: document.querySelector("#wilayahCompetitorDropdown"),
  competitorSummary: document.querySelector("#wilayahCompetitorSummary"),
  competitorOptions: document.querySelector("#wilayahCompetitorOptions"),
  cards: document.querySelector("#wilayahCards"),
  trendSubtitle: document.querySelector("#wilayahTrendSubtitle"),
  trendChart: document.querySelector("#wilayahTrendChart"),
  insightSubtitle: document.querySelector("#wilayahInsightSubtitle"),
  insight: document.querySelector("#wilayahInsight"),
  dailySubtitle: document.querySelector("#wilayahDailySubtitle"),
  dailyDownloadJpg: document.querySelector("#downloadDailyJpg"),
  dailyHead: document.querySelector("#wilayahDailyHead"),
  dailyBody: document.querySelector("#wilayahDailyBody"),
  rankSubtitle: document.querySelector("#wilayahRankSubtitle"),
  rankHead: document.querySelector("#wilayahRankHead"),
  rankBody: document.querySelector("#wilayahRankBody"),
  branchSubtitle: document.querySelector("#wilayahBranchSubtitle"),
  branchDownloadJpg: document.querySelector("#downloadBranchJpg"),
  branchCategoryFilter: document.querySelector("#wilayahBranchCategoryFilter"),
  branchHead: document.querySelector("#wilayahBranchHead"),
  branchBody: document.querySelector("#wilayahBranchBody"),
  toast: document.querySelector("#toast"),
};

const wilayahFmtNumber = new Intl.NumberFormat("id-ID");
const wilayahFmtDecimal = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const wilayahMonthShort = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const wilayahColors = ["#2563eb", "#dc2626", "#0f766e", "#d97706", "#7c3aed", "#0891b2", "#be123c", "#4d7c0f", "#9333ea", "#ea580c", "#475569"];

function progresCsvUrl() {
  return `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?gid=${PROGRES_GID}&single=true&output=csv`;
}

async function loadWilayahInsight() {
  try {
    wilayahEls.meta.textContent = "Memuat sheet Progres...";
    const response = await fetch(progresCsvUrl(), { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    wilayahState.rows = parseCsv(await response.text());
    wilayahState.snapshots = buildWilayahSnapshots(wilayahState.rows);
    wilayahState.branchSnapshots = buildCabangSnapshots(wilayahState.rows);
    renderFilters();
    renderWilayahPage();
  } catch (error) {
    wilayahEls.meta.textContent = "Gagal membaca sheet Progres.";
    showWilayahToast(`Gagal membaca sheet Progres: ${error.message}`);
    renderWilayahEmpty(error.message);
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = String(text ?? "").replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === "\"") {
      if (quoted && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value ?? "").trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => String(value ?? "").trim())) rows.push(row);
  const headers = rows[0]?.map((header) => header.trim()) ?? [];
  return rows.slice(1)
    .filter((values) => values.some((value) => String(value ?? "").trim()))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function buildWilayahSnapshots(rows) {
  const wilayahRows = rows
    .filter((row) => String(readField(row, "Kategori") ?? "").trim().toUpperCase() === "WIL")
    .filter((row) => normalizeCode(readField(row, "Kode Kantor")));
  return buildOfficeSnapshots(wilayahRows);
}

function buildCabangSnapshots(rows) {
  const cabangRows = rows
    .filter((row) => normalizeCode(readField(row, "Kode Kantor")).startsWith("L"));
  return buildOfficeSnapshots(cabangRows);
}

function buildOfficeSnapshots(rows) {
  const groups = new Map();
  for (const row of rows) {
    const date = String(readField(row, "tgl_data") ?? "").trim();
    const code = normalizeCode(readField(row, "Kode Kantor"));
    if (!date || !code) continue;
    groups.set(`${date}|${code}`, row);
  }
  return [...groups.values()]
    .map((row) => {
      const code = normalizeCode(readField(row, "Kode Kantor"));
      return {
        date: String(readField(row, "tgl_data") ?? "").trim(),
        blth: "",
        code,
        name: String(readField(row, "Nama Kantor") ?? "").trim() || code,
        scores: Object.fromEntries(wilayahMetrics.map((metric) => [metric.key, parseNumber(readField(row, metric.field))])),
        burdens: Object.fromEntries(wilayahMetrics.filter((metric) => metric.burden).map((metric) => [metric.key, parseNumber(readField(row, metric.burden))])),
      };
    })
    .sort((a, b) => parseDate(a.date) - parseDate(b.date) || a.code.localeCompare(b.code, "id", { numeric: true }));
}

function renderFilters() {
  setOptions(wilayahEls.metricFilter, wilayahMetrics.map((metric) => ({ value: metric.key, label: metric.label })), wilayahState.metric);
  const latestRows = latestWilayahRows();
  const competitorOptions = [
    { value: "ALL", label: "Semua Wilayah" },
    { value: "JABAR", label: "Jabar / Jawa Barat" },
    ...latestRows
    .filter((row) => row.code !== FOCUS_WILAYAH)
    .map((row) => ({ value: row.code, label: `${row.code} - ${row.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label, "id", { numeric: true })),
  ];
  renderCompetitorChecklist(competitorOptions);
}

function renderWilayahPage() {
  const latestDate = latestDateValue();
  const latestRows = latestWilayahRows();
  const focus = latestRows.find((row) => row.code === FOCUS_WILAYAH);
  const competitors = selectedCompetitors(latestRows, focus);
  const competitor = competitors[0] ?? pickCompetitor(latestRows, focus);
  const metric = currentMetric();
  const metricRankRows = latestRows
    .slice()
    .sort((a, b) => metricValue(b, metric) - metricValue(a, metric) || a.code.localeCompare(b.code, "id", { numeric: true }));

  wilayahEls.sourceNote.textContent = `Sheet Progres: ${wilayahFmtNumber.format(wilayahState.rows.length)} baris, ${wilayahFmtNumber.format(uniqueValues(wilayahState.snapshots, "code").length)} wilayah terbaca.`;
  wilayahEls.meta.textContent = `Update terakhir ${formatFullDate(latestDate)}. Indikator aktif: ${metric.label}.`;
  wilayahEls.trendSubtitle.textContent = `${focus ? focus.name : "Kanwil 905"} dibanding ${competitors.length ? `${competitors.length} wilayah terpilih` : "pesaing terdekat belum tersedia"}.`;
  wilayahEls.insightSubtitle.textContent = latestRows.length > 1
    ? `Analisis gap dan risiko tersalip berdasarkan ${metric.label}.`
    : "Sheet Progres saat ini belum memuat wilayah pembanding.";
  renderCards(focus, competitor, metricRankRows, metric);
  renderTrend(focus, competitors, metric);
  renderInsight(focus, competitor, latestRows, metric);
  renderDailyComparison(focus, competitors);
  renderBranchTable(rankedLatestBranchRows());
}

function renderCards(focus, competitor, latestRows, metric) {
  const rank = focus ? latestRows.findIndex((row) => row.code === focus.code) + 1 : 0;
  const gap = focus && competitor ? metricValue(focus, metric) - metricValue(competitor, metric) : null;
  const delta = focus ? scoreDelta(focus.code, metric.key, focus.date) : null;
  const signal = gap === null
    ? "Belum ada kompetitor"
    : gap < 0
      ? "Sudah tertinggal"
      : gap <= 0.25
        ? "Rawan tersalip"
        : "Masih unggul";
  wilayahEls.cards.innerHTML = `
    ${renderExecutiveCard("Peringkat 905", rank ? `#${rank}` : "-", latestRows.length ? `dari ${wilayahFmtNumber.format(latestRows.length)} wilayah` : "data pembanding belum ada", rank <= 3 && rank > 0 ? "good" : rank ? "warn" : "neutral")}
    ${renderExecutiveCard(metric.label, focus ? wilayahFmtDecimal.format(metricValue(focus, metric)) : "-", delta === null ? "progress belum tersedia" : `${formatSignedDecimal(delta)} poin dari update sebelumnya`, delta === null ? "neutral" : delta >= 0 ? "good" : "bad")}
    ${renderExecutiveCard("Gap Kompetitor", gap === null ? "-" : formatSignedDecimal(gap), competitor ? `vs ${competitor.code} - ${competitor.name}` : "pesaing belum tersedia", gap === null ? "neutral" : gap > 0 ? "good" : "bad")}
    ${renderExecutiveCard("Sinyal", signal, latestRows.length > 1 ? "pantau tiap update sheet Progres" : "tambahkan wilayah lain untuk monitoring", signal === "Rawan tersalip" || signal === "Sudah tertinggal" ? "bad" : "good")}
  `;
}

function renderExecutiveCard(label, value, note, tone) {
  return `
    <article class="summary-card wilayah-card ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `;
}

function renderTrend(focus, competitors, metric) {
  if (!wilayahState.snapshots.length || !focus) {
    wilayahEls.trendChart.innerHTML = `<p class="summary-empty">Belum ada data trend wilayah.</p>`;
    return;
  }
  const dates = uniqueValues(wilayahState.snapshots, "date").sort((a, b) => parseDate(a) - parseDate(b));
  const series = [
    buildTrendSeries(focus.code, focus.name, dates, metric, wilayahColors[0]),
    ...competitors.map((competitor, index) => buildTrendSeries(competitor.code, competitor.name, dates, metric, wilayahColors[(index + 1) % wilayahColors.length])),
  ].filter((item) => item.values.some((point) => point.value !== null));
  const values = series.flatMap((item) => item.values.map((point) => point.value).filter((value) => value !== null));
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const width = 880;
  const height = 300;
  const left = 54;
  const right = 26;
  const top = 28;
  const bottom = 48;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const yScale = (value) => top + plotHeight - ((value - minValue) / Math.max(1, maxValue - minValue)) * plotHeight;
  const xScale = (index) => left + (index / Math.max(1, dates.length - 1)) * plotWidth;
  wilayahEls.trendChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Trend posisi wilayah">
      <line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" class="chart-axis"></line>
      <line x1="${left}" y1="${top + plotHeight}" x2="${left + plotWidth}" y2="${top + plotHeight}" class="chart-axis"></line>
      <line x1="${left}" y1="${yScale(maxValue / 2)}" x2="${left + plotWidth}" y2="${yScale(maxValue / 2)}" class="chart-grid"></line>
      ${series.map((item, seriesIndex) => {
        const points = item.values.map((point, index) => point.value === null ? null : { ...point, x: xScale(index), y: yScale(point.value) }).filter(Boolean);
        return `
          <polyline points="${points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")}" fill="none" stroke="${item.color}" stroke-width="2.2"></polyline>
          ${points.map((point, index) => `
            <circle cx="${point.x}" cy="${point.y}" r="3.2" fill="${item.color}"></circle>
            ${renderTrendPointLabel(point, points[index - 1], item.color, seriesIndex)}
          `).join("")}
        `;
      }).join("")}
      ${dates.map((date, index) => `<text x="${xScale(index)}" y="${height - 16}" text-anchor="middle" class="chart-xlabel">${escapeHtml(formatTrendDate(date, dates))}</text>`).join("")}
      <text x="${left - 10}" y="${top + 4}" text-anchor="end" class="chart-ylabel">${wilayahFmtDecimal.format(maxValue)}</text>
      <text x="${left - 10}" y="${top + plotHeight}" text-anchor="end" class="chart-ylabel">${wilayahFmtDecimal.format(minValue)}</text>
    </svg>
    <div class="wilayah-legend">
      ${series.map((item) => `<span><i style="background:${item.color}"></i>${escapeHtml(item.code)} - ${escapeHtml(item.name)}</span>`).join("")}
    </div>
  `;
}

function renderTrendPointLabel(point, previousPoint, color, seriesIndex) {
  const valueY = seriesIndex === 0 ? point.y - 13 : point.y + 18;
  const deltaY = seriesIndex === 0 ? point.y - 2 : point.y + 30;
  const delta = previousPoint ? point.value - previousPoint.value : null;
  const deltaText = delta === null ? "" : `(${formatSignedDecimal(delta)})`;
  const deltaClass = delta === null || Math.abs(delta) < 0.005 ? "neutral" : delta > 0 ? "good" : "bad";
  return `
    <text x="${point.x}" y="${Math.max(12, Math.min(286, valueY))}" text-anchor="middle" class="chart-label" fill="${color}">${wilayahFmtDecimal.format(point.value)}</text>
    ${deltaText ? `<text x="${point.x}" y="${Math.max(18, Math.min(292, deltaY))}" text-anchor="middle" class="chart-delta ${deltaClass}">${escapeHtml(deltaText)}</text>` : ""}
  `;
}

function buildTrendSeries(code, name, dates, metric, color) {
  const byDate = new Map(wilayahState.snapshots.filter((row) => row.code === code).map((row) => [row.date, row]));
  return {
    code,
    name,
    color,
    values: dates.map((date) => {
      const row = byDate.get(date);
      return { date, value: row ? metricValue(row, metric) : null };
    }),
  };
}

function renderInsight(focus, competitor, latestRows, metric) {
  if (!focus) {
    wilayahEls.insight.innerHTML = `<p class="summary-empty">Data Kanwil 905 belum ditemukan pada sheet Progres.</p>`;
    return;
  }
  if (latestRows.length <= 1) {
    wilayahEls.insight.innerHTML = `
      <div class="wilayah-alert warn">
        <strong>Data pembanding belum tersedia.</strong>
        <p>Sheet Progres yang terbaca saat ini baru memuat Kanwil 905. Halaman monitoring sudah siap, tetapi risiko tersalip Jabar baru bisa dihitung setelah data wilayah lain ikut masuk ke sheet ini.</p>
      </div>
      ${renderFocusParameterInsight(focus)}
    `;
    return;
  }
  const gap = competitor ? metricValue(focus, metric) - metricValue(competitor, metric) : null;
  const jabar = latestRows.find((row) => isJabar(row));
  const topRisk = latestRows.filter((row) => row.code !== FOCUS_WILAYAH && metricValue(row, metric) < metricValue(focus, metric))
    .sort((a, b) => metricValue(focus, metric) - metricValue(a, metric) - (metricValue(focus, metric) - metricValue(b, metric)))[0];
  const driver = weakestParameter(focus);
  wilayahEls.insight.innerHTML = `
    <div class="wilayah-alert ${gap !== null && gap <= 0.25 ? "bad" : "good"}">
      <strong>${gap !== null && gap < 0 ? "905 sudah di bawah pesaing terpilih." : gap !== null && gap <= 0.25 ? "905 rawan tersalip." : "905 masih punya jarak aman."}</strong>
      <p>
        Pada indikator <b>${escapeHtml(metric.label)}</b>, Kanwil 905 berada di nilai
        <b>${wilayahFmtDecimal.format(metricValue(focus, metric))}</b>${competitor ? `, dibanding <b>${escapeHtml(competitor.code)} - ${escapeHtml(competitor.name)}</b> di <b>${wilayahFmtDecimal.format(metricValue(competitor, metric))}</b>` : ""}.
        ${gap === null ? "Belum ada pesaing pembanding." : `Gap saat ini <b>${formatSignedDecimal(gap)} poin</b>.`}
      </p>
    </div>
    <div class="wilayah-priority">
      <h3>Kerjakan Dulu</h3>
      <p>Prioritas 905 adalah <b>${escapeHtml(driver.label)}</b>, karena menjadi parameter dengan nilai paling rendah dan sisa beban masih <b>${wilayahFmtNumber.format(driver.burden)}</b>.</p>
      ${jabar ? `<p>Sinyal Jabar: <b>${wilayahFmtDecimal.format(metricValue(jabar, metric))}</b>. Pantau gap terhadap Jabar setiap update agar Jateng DIY tidak tersalip.</p>` : `<p>Data Jabar belum terbaca di sheet Progres. Begitu muncul, sistem akan menampilkan Jabar sebagai kompetitor otomatis.</p>`}
      ${topRisk ? `<p>Pesaing terdekat dari bawah adalah <b>${escapeHtml(topRisk.code)} - ${escapeHtml(topRisk.name)}</b>; jika gap terus mengecil, kantor ini perlu masuk watchlist.</p>` : ""}
    </div>
    ${renderFocusParameterInsight(focus)}
  `;
}

function renderFocusParameterInsight(focus) {
  const items = wilayahMetrics
    .filter((metric) => metric.burden)
    .map((metric) => ({ ...metric, score: metricValue(focus, metric), burden: focus.burdens[metric.key] ?? 0 }))
    .sort((a, b) => a.score - b.score || b.burden - a.burden);
  return `
    <div class="wilayah-param-list">
      <h3>Parameter 905 yang Perlu Dijaga</h3>
      ${items.map((item) => `
        <p><b>${escapeHtml(item.label)}</b>: nilai <b>${wilayahFmtDecimal.format(item.score)}</b>, sisa beban <b>${wilayahFmtNumber.format(item.burden)}</b>.</p>
      `).join("")}
    </div>
  `;
}

function renderRankingTable(latestRows, metric) {
  wilayahEls.rankSubtitle.textContent = `Update ${formatFullDate(latestDateValue())}; klik nama parameter untuk sort.`;
  wilayahEls.rankHead.innerHTML = `
    <tr>
      <th>Peringkat</th>
      <th>Wilayah</th>
      ${wilayahMetrics.map((item) => `
        <th class="num">
          <button type="button" class="sort-btn ${wilayahState.rankSort.key === item.key ? "active" : ""}" data-rank-sort="${escapeHtml(item.key)}">
            <span class="sort-title">${escapeHtml(item.label)}</span>
            <small>${item.burden ? "Sisa | Score | Progres" : "Score | +/-"}</small>
            <span>${wilayahState.rankSort.key === item.key ? wilayahState.rankSort.direction === "asc" ? "▲" : "▼" : "↕"}</span>
          </button>
        </th>
      `).join("")}
    </tr>
  `;
  wilayahEls.rankBody.innerHTML = latestRows.map((row, index) => {
    return `
      <tr class="${row.code === FOCUS_WILAYAH ? "focus-row" : ""}">
        <td>#${index + 1}</td>
        <td><strong>${escapeHtml(row.code)}</strong> - ${escapeHtml(row.name)}</td>
        ${wilayahMetrics.map((item) => renderRankMetricCell(row, item)).join("")}
      </tr>
    `;
  }).join("");
}

function renderBranchTable(latestRows) {
  const filteredRows = sortRowsBySubMetric(filterBranchRows(latestRows), wilayahState.branchSort);
  const categoryLabel = wilayahState.branchCategory === "cabang"
    ? "Cabang Induk L00-L11"
    : wilayahState.branchCategory === "kcp"
      ? "KCP L12-L34"
      : "Semua cabang kode L";
  wilayahEls.branchSubtitle.textContent = `Periode update ${formatFullDate(firstBranchDateValue())} s.d. ${formatFullDate(latestBranchDateValue())}; ${categoryLabel}.`;
  wilayahEls.branchHead.innerHTML = `
    <tr>
      <th>Peringkat</th>
      <th>Cabang</th>
      ${wilayahMetrics.map((item) => `
        ${renderSortableMetricHeader(item, "branch")}
      `).join("")}
    </tr>
  `;
  if (!filteredRows.length) {
    wilayahEls.branchBody.innerHTML = `<tr><td colspan="${wilayahMetrics.length + 2}">Data cabang kode L belum tersedia pada sheet Progres.</td></tr>`;
    return;
  }
  wilayahEls.branchBody.innerHTML = filteredRows.map((row, index) => `
    <tr>
      <td>#${index + 1}</td>
      <td><strong>${escapeHtml(row.code)}</strong> - ${escapeHtml(row.name)}</td>
      ${wilayahMetrics.map((item) => renderRankMetricCell(row, item)).join("")}
    </tr>
  `).join("");
}

function filterBranchRows(rows) {
  if (wilayahState.branchCategory === "cabang") {
    return rows.filter((row) => branchNumber(row.code) >= 0 && branchNumber(row.code) <= 11);
  }
  if (wilayahState.branchCategory === "kcp") {
    return rows.filter((row) => branchNumber(row.code) >= 12 && branchNumber(row.code) <= 34);
  }
  return rows;
}

function renderDailyComparison(focus, competitors) {
  const latest = latestDateValue();
  const previous = previousDateValue(latest);
  const baseRows = [focus, ...competitors].filter(Boolean);
  const comparisonRows = wilayahState.dailySort ? sortRowsBySubMetric(baseRows, wilayahState.dailySort) : baseRows;
  wilayahEls.dailySubtitle.textContent = previous
    ? `Update ${formatFullDate(previous)} ke ${formatFullDate(latest)}; menampilkan ${wilayahFmtNumber.format(comparisonRows.length)} wilayah. Progres = sisa terakhir - sisa sebelumnya, + beban bertambah dan - beban berkurang.`
    : `Update ${formatFullDate(latest)}; perubahan harian belum tersedia.`;
  wilayahEls.dailyHead.innerHTML = `
    <tr>
      <th>Nama Wilayah</th>
      ${wilayahMetrics.map((metric) => renderSortableMetricHeader(metric, "daily")).join("")}
    </tr>
  `;
  if (!comparisonRows.length) {
    wilayahEls.dailyBody.innerHTML = `<tr><td colspan="6">Belum ada data wilayah untuk dibandingkan.</td></tr>`;
    return;
  }
  wilayahEls.dailyBody.innerHTML = comparisonRows.map((row) => `
    <tr class="${row.code === FOCUS_WILAYAH ? "focus-row" : ""}">
      <td><strong>${escapeHtml(row.code)}</strong> - ${escapeHtml(row.name)}</td>
      ${wilayahMetrics.map((metric) => renderDailyMetricCell(row, metric)).join("")}
    </tr>
  `).join("");
}

function renderRankMetricCell(row, metric) {
  const value = metricValue(row, metric);
  if (!metric.burden) {
    const delta = scoreDelta(row.code, metric.key, row.date);
    const tone = delta === null || Math.abs(delta) < 0.005 ? "neutral" : delta > 0 ? "good" : "bad";
    return `
      <td class="num">
        <div class="daily-metric rank-score">
          <strong>${wilayahFmtDecimal.format(value)}</strong>
          <span class="tag ${tone}">${delta === null ? "-" : formatSignedDecimal(delta)}</span>
        </div>
      </td>
    `;
  }
  return renderDailyMetricCell(row, metric);
}

function renderDailyMetricCell(row, metric) {
  const value = metricValue(row, metric);
  const delta = scoreDelta(row.code, metric.key, row.date);
  const tone = delta === null || Math.abs(delta) < 0.005 ? "neutral" : delta > 0 ? "good" : "bad";
  if (metric.burden) {
    const burdenMove = burdenDelta(row.code, metric.key, row.date);
    const burdenTone = burdenMove === null || Math.abs(burdenMove) < 0.5 ? "neutral" : burdenMove < 0 ? "good" : "bad";
    const burden = parseNumber(row.burdens[metric.key]);
    return `
      <td class="num">
        <div class="daily-metric stacked">
          <div><strong>${wilayahFmtNumber.format(burden)}</strong></div>
          <div><strong>${wilayahFmtDecimal.format(value)}</strong></div>
          <div><em class="tag ${burdenTone}">${burdenMove === null ? "-" : formatSignedNumber(burdenMove)}</em></div>
        </div>
      </td>
    `;
  }
  return `
    <td class="num">
      <div class="daily-metric">
        <strong>${wilayahFmtDecimal.format(value)}</strong>
        <span class="tag ${tone}">${delta === null ? "-" : formatSignedDecimal(delta)}</span>
      </div>
    </td>
  `;
}

function renderSortableMetricHeader(metric, table) {
  const activeSort = table === "branch" ? wilayahState.branchSort : wilayahState.dailySort;
  const subParts = metric.burden
    ? [
      { key: "sisa", label: "Sisa" },
      { key: "score", label: "Score" },
      { key: "progres", label: "Progres" },
    ]
    : [
      { key: "score", label: "Score" },
      { key: "delta", label: "+/-" },
    ];
  return `
    <th class="num">
      <div class="metric-head">
        <strong>${escapeHtml(metric.label)}</strong>
        <span class="sub-sort-row">
          ${subParts.map((part) => {
            const active = activeSort?.metricKey === metric.key && activeSort?.part === part.key;
            const icon = active ? activeSort.direction === "asc" ? "▲" : "▼" : "↕";
            return `<button type="button" class="sub-sort-btn ${active ? "active" : ""}" data-sort-table="${table}" data-sort-metric="${escapeHtml(metric.key)}" data-sort-part="${part.key}">${part.label} ${icon}</button>`;
          }).join("")}
        </span>
      </div>
    </th>
  `;
}

function renderWilayahEmpty(message) {
  wilayahEls.cards.innerHTML = "";
  wilayahEls.trendChart.innerHTML = `<p class="summary-empty">${escapeHtml(message)}</p>`;
  wilayahEls.insight.innerHTML = "";
  wilayahEls.dailyHead.innerHTML = "";
  wilayahEls.dailyBody.innerHTML = "";
  if (wilayahEls.rankHead) wilayahEls.rankHead.innerHTML = "";
  if (wilayahEls.rankBody) wilayahEls.rankBody.innerHTML = "";
  wilayahEls.branchHead.innerHTML = "";
  wilayahEls.branchBody.innerHTML = "";
}

function rankedLatestRows() {
  const sortMetric = wilayahMetrics.find((metric) => metric.key === wilayahState.rankSort.key) ?? currentMetric();
  const direction = wilayahState.rankSort.direction === "asc" ? 1 : -1;
  return latestWilayahRows()
    .sort((a, b) => (metricValue(a, sortMetric) - metricValue(b, sortMetric)) * direction || a.code.localeCompare(b.code, "id", { numeric: true }));
}

function latestWilayahRows() {
  const latest = latestDateValue();
  return wilayahState.snapshots.filter((row) => row.date === latest);
}

function rankedLatestBranchRows() {
  return latestBranchRows();
}

function latestBranchRows() {
  const latest = latestBranchDateValue();
  return wilayahState.branchSnapshots.filter((row) => row.date === latest);
}

function latestDateValue() {
  return uniqueValues(wilayahState.snapshots, "date").sort((a, b) => parseDate(a) - parseDate(b)).at(-1) ?? "";
}

function latestBranchDateValue() {
  return uniqueValues(wilayahState.branchSnapshots, "date").sort((a, b) => parseDate(a) - parseDate(b)).at(-1) ?? "";
}

function firstBranchDateValue() {
  return uniqueValues(wilayahState.branchSnapshots, "date").sort((a, b) => parseDate(a) - parseDate(b))[0] ?? "";
}

function previousDateValue(date) {
  const dates = uniqueValues(wilayahState.snapshots, "date").sort((a, b) => parseDate(a) - parseDate(b));
  const index = dates.indexOf(date);
  return index > 0 ? dates[index - 1] : "";
}

function currentMetric() {
  return wilayahMetrics.find((metric) => metric.key === wilayahState.metric) ?? wilayahMetrics[0];
}

function pickCompetitor(latestRows, focus) {
  if (!focus) return null;
  const focusValue = metricValue(focus, currentMetric());
  return latestRows
    .filter((row) => row.code !== focus.code)
    .sort((a, b) => Math.abs(metricValue(a, currentMetric()) - focusValue) - Math.abs(metricValue(b, currentMetric()) - focusValue))[0] ?? null;
}

function selectedCompetitors(latestRows, focus) {
  if (wilayahState.competitors.includes("ALL")) {
    return latestRows
      .filter((row) => row.code !== focus?.code)
      .sort((a, b) => metricValue(b, currentMetric()) - metricValue(a, currentMetric()) || a.code.localeCompare(b.code, "id", { numeric: true }));
  }
  const selected = wilayahState.competitors.flatMap((value) => {
    if (value === "JABAR") return latestRows.find((row) => isJabar(row)) ?? [];
    return latestRows.find((row) => row.code === value) ?? [];
  });
  const unique = new Map(selected.filter((row) => row && row.code !== focus?.code).map((row) => [row.code, row]));
  if (!unique.size) {
    const fallback = pickCompetitor(latestRows, focus);
    if (fallback) unique.set(fallback.code, fallback);
  }
  return [...unique.values()];
}

function sortRowsBySubMetric(rows, sort) {
  if (!sort) return rows;
  const direction = sort.direction === "asc" ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const valueA = sortableSubValue(a, sort);
    const valueB = sortableSubValue(b, sort);
    return (valueA - valueB) * direction || a.code.localeCompare(b.code, "id", { numeric: true });
  });
}

function sortableSubValue(row, sort) {
  const metric = wilayahMetrics.find((item) => item.key === sort.metricKey) ?? wilayahMetrics[0];
  if (sort.part === "sisa") return parseNumber(row.burdens?.[metric.key]);
  if (sort.part === "progres") return parseNumber(burdenDelta(row.code, metric.key, row.date));
  if (sort.part === "delta") return parseNumber(scoreDelta(row.code, metric.key, row.date));
  return metricValue(row, metric);
}

function renderCompetitorChecklist(options) {
  if (!wilayahEls.competitorOptions) return;
  const selected = new Set(wilayahState.competitors);
  wilayahEls.competitorOptions.innerHTML = options.map((option) => `
    <label class="checkbox-option">
      <input type="checkbox" value="${escapeHtml(option.value)}" ${selected.has(option.value) ? "checked" : ""} />
      <span>${escapeHtml(option.label)}</span>
    </label>
  `).join("");
  updateCompetitorSummary(options);
}

function updateCompetitorSummary(options) {
  if (!wilayahEls.competitorSummary) return;
  const selectedLabels = options
    .filter((option) => wilayahState.competitors.includes(option.value))
    .map((option) => option.label);
  wilayahEls.competitorSummary.textContent = selectedLabels.length
    ? wilayahState.competitors.includes("ALL") ? "Semua Wilayah" : selectedLabels.length === 1 ? selectedLabels[0] : `${selectedLabels.length} wilayah dipilih`
    : "Pesaing Terdekat";
}

function weakestParameter(row) {
  return wilayahMetrics
    .filter((metric) => metric.burden)
    .map((metric) => ({ ...metric, score: metricValue(row, metric), burden: row.burdens[metric.key] ?? 0 }))
    .sort((a, b) => a.score - b.score || b.burden - a.burden)[0] ?? wilayahMetrics[0];
}

function metricValue(row, metric) {
  return parseNumber(row?.scores?.[metric.key]);
}

function scoreDelta(code, metricKey, date) {
  const snapshots = snapshotsForCode(code);
  const dates = uniqueValues(snapshots, "date").sort((a, b) => parseDate(a) - parseDate(b));
  const index = dates.indexOf(date);
  if (index <= 0) return null;
  const previous = snapshots.find((row) => row.code === code && row.date === dates[index - 1]);
  const current = snapshots.find((row) => row.code === code && row.date === date);
  if (!previous || !current) return null;
  return parseNumber(current.scores[metricKey]) - parseNumber(previous.scores[metricKey]);
}

function burdenDelta(code, metricKey, date) {
  const snapshots = snapshotsForCode(code);
  const dates = uniqueValues(snapshots, "date").sort((a, b) => parseDate(a) - parseDate(b));
  const index = dates.indexOf(date);
  if (index <= 0) return null;
  const previous = snapshots.find((row) => row.code === code && row.date === dates[index - 1]);
  const current = snapshots.find((row) => row.code === code && row.date === date);
  if (!previous || !current) return null;
  return parseNumber(current.burdens[metricKey]) - parseNumber(previous.burdens[metricKey]);
}

function snapshotsForCode(code) {
  const normalized = normalizeCode(code);
  return normalized.startsWith("L") ? wilayahState.branchSnapshots : wilayahState.snapshots;
}

function isJabar(row) {
  const text = `${row.code} ${row.name}`.toUpperCase();
  return text.includes("JABAR") || text.includes("JAWA BARAT");
}

function setOptions(select, options, selected) {
  if (!select) return;
  select.innerHTML = options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("");
  select.value = selected;
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))];
}

function normalizeCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function branchNumber(code) {
  const match = normalizeCode(code).match(/^L(\d{2})$/);
  return match ? Number(match[1]) : -1;
}

function readField(row, field) {
  if (!row || !field) return "";
  if (field in row) return row[field];
  const normalizedField = normalizeHeader(field);
  const key = Object.keys(row).find((item) => normalizeHeader(item) === normalizedField);
  return key ? row[key] : "";
}

function normalizeHeader(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function parseNumber(value) {
  const raw = String(value ?? "").trim().replace(/\s*%\s*$/, "");
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9,.-]/g, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;
  if (hasComma && hasDot) {
    normalized = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    normalized = /^-?\d{1,3}(,\d{3})+$/.test(cleaned)
      ? cleaned.replace(/,/g, "")
      : cleaned.replace(",", ".");
  } else if (hasDot && /^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "");
  }
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value) {
  const [day, month, year] = String(value ?? "").split("-").map(Number);
  if (!day || !month || !year) return 0;
  return new Date(year, month - 1, day).getTime();
}

function formatFullDate(value) {
  const [day, month, year] = String(value ?? "").split("-");
  if (!day || !month || !year) return value || "-";
  return `${day}-${month}-${year}`;
}

function formatTrendDate(value, dates) {
  const [day, month, year] = String(value ?? "").split("-").map(Number);
  if (!day || !month || !year) return value || "-";
  const latest = dates.at(-1);
  const [, latestMonth, latestYear] = String(latest ?? "").split("-").map(Number);
  return month === latestMonth && year === latestYear
    ? `${String(day).padStart(2, "0")}-${wilayahMonthShort[month - 1]}`
    : wilayahMonthShort[month - 1];
}

function formatSignedDecimal(value) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${wilayahFmtDecimal.format(value)}`;
}

function formatSignedNumber(value) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${wilayahFmtNumber.format(value)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function showWilayahToast(message) {
  if (!wilayahEls.toast) return;
  wilayahEls.toast.textContent = message;
  wilayahEls.toast.hidden = false;
  window.clearTimeout(showWilayahToast.timer);
  showWilayahToast.timer = window.setTimeout(() => {
    wilayahEls.toast.hidden = true;
  }, 3600);
}

async function downloadTableAsJpg(tableSelector, title, filenamePrefix) {
  const target = document.querySelector(tableSelector);
  const table = target?.tagName === "TABLE" ? target : target?.closest("table");
  if (!table || table.querySelectorAll("tr").length <= 1) {
    showWilayahToast("Tabel belum tersedia untuk didownload.");
    return;
  }

  try {
    const padding = 10;
    const clone = table.cloneNode(true);
    inlineComputedStyles(table, clone);
    clone.style.margin = "0";
    clone.style.width = `${Math.ceil(table.scrollWidth || table.getBoundingClientRect().width)}px`;
    clone.style.background = "#ffffff";

    const shell = document.createElement("div");
    shell.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    shell.style.display = "inline-block";
    shell.style.padding = `${padding}px`;
    shell.style.background = "#ffffff";
    shell.style.color = "#10213f";
    shell.style.fontFamily = "Inter, Arial, sans-serif";
    shell.appendChild(clone);
    document.body.appendChild(shell);
    shell.style.position = "fixed";
    shell.style.left = "-100000px";
    shell.style.top = "0";

    const width = Math.ceil(shell.scrollWidth);
    const height = Math.ceil(shell.scrollHeight);
    const serialized = new XMLSerializer().serializeToString(shell);
    shell.remove();

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">${serialized}</foreignObject>
      </svg>
    `;
    const image = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    context.scale(scale, scale);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    URL.revokeObjectURL(url);

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/jpeg", 0.94);
    link.download = `${filenamePrefix}-${latestDateValue() || "update"}.jpg`;
    link.click();
    showWilayahToast("Tabel berhasil dicapture sebagai JPG.");
  } catch (error) {
    showWilayahToast(`Gagal capture tabel: ${error.message}`);
  }
}

function inlineComputedStyles(source, clone) {
  const sourceElements = [source, ...source.querySelectorAll("*")];
  const cloneElements = [clone, ...clone.querySelectorAll("*")];
  sourceElements.forEach((element, index) => {
    const target = cloneElements[index];
    if (!target) return;
    const computed = getComputedStyle(element);
    target.style.cssText = computed.cssText;
    if (target.tagName === "BUTTON") {
      target.style.minWidth = computed.minWidth;
      target.style.minHeight = computed.minHeight;
    }
  });
}

wilayahEls.metricFilter?.addEventListener("change", (event) => {
  wilayahState.metric = event.target.value;
  renderWilayahPage();
});

wilayahEls.competitorOptions?.addEventListener("change", (event) => {
  const target = event.target;
  if (target?.value === "ALL" && target.checked) {
    wilayahEls.competitorOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = input.value === "ALL";
    });
  } else if (target?.value !== "ALL" && target?.checked) {
    const allInput = wilayahEls.competitorOptions.querySelector('input[value="ALL"]');
    if (allInput) allInput.checked = false;
  }
  const checked = [...wilayahEls.competitorOptions.querySelectorAll("input[type='checkbox']:checked")];
  wilayahState.competitors = checked.map((input) => input.value);
  if (wilayahEls.competitorSummary) {
    wilayahEls.competitorSummary.textContent = checked.length
      ? wilayahState.competitors.includes("ALL") ? "Semua Wilayah" : checked.length === 1 ? checked[0].closest("label")?.querySelector("span")?.textContent ?? checked[0].value : `${checked.length} wilayah dipilih`
      : "Pesaing Terdekat";
  }
  renderWilayahPage();
});

wilayahEls.dailyDownloadJpg?.addEventListener("click", () => {
  downloadTableAsJpg(".wilayah-daily-wrap table", "Perbandingan Progres Harian", "perbandingan-progres-wilayah");
});

wilayahEls.branchDownloadJpg?.addEventListener("click", () => {
  downloadTableAsJpg("#wilayahBranchHead", "Progress Cabang Jateng DIY", "progress-cabang-jateng-diy");
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-sort-table][data-sort-metric][data-sort-part]");
  if (!button) return;
  const targetKey = button.dataset.sortTable === "branch" ? "branchSort" : "dailySort";
  const current = wilayahState[targetKey];
  const next = {
    metricKey: button.dataset.sortMetric,
    part: button.dataset.sortPart,
    direction: current?.metricKey === button.dataset.sortMetric && current?.part === button.dataset.sortPart && current?.direction === "desc" ? "asc" : "desc",
  };
  wilayahState[targetKey] = next;
  renderWilayahPage();
});

wilayahEls.branchCategoryFilter?.addEventListener("change", (event) => {
  wilayahState.branchCategory = event.target.value;
  renderWilayahPage();
});

loadWilayahInsight();
