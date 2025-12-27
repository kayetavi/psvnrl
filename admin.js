/* =====================
   SUPABASE CLIENT
===================== */
const supabaseClient = supabase.createClient(
  "https://qkpbggwaxnjwqdmqbbpz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcGJnZ3dheG5qd3FkbXFiYnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODA5MzksImV4cCI6MjA4MjA1NjkzOX0.qqHPESSXRgP0FECZBReJvKmJKigkzHoXbEU3s7XvJSA"
);

/* =====================
   GLOBAL VARS
===================== */
let psvCache = [];
let sortDesc = true;
let chartInstance;
let unitChartInstance;
let statusChartInstance;

let activeCardFilter = null;   // ALL / OK / Due / Overdue
let cardViewOpen = false;     // toggle state

let activeUnitFilter = null;
let unitViewOpen = false;
let filteredCache = [];   // 🔥 active filtered data

/* =====================
   DASHBOARD SHOW / HIDE
===================== */
function hideDashboard() {
  const dash = document.getElementById("dashboardSections");
  if (dash) dash.style.display = "none";
}

function showDashboard() {
  const dash = document.getElementById("dashboardSections");
  if (dash) dash.style.display = "block";
}

/* =====================
   SETTINGS TOGGLE
===================== */
function toggleSettings() {
  const menu = document.getElementById("settingsMenu");
  if (!menu) return;

  menu.style.display =
    menu.style.display === "block" ? "none" : "block";
}

/* =====================
   ADMIN PROTECTION
===================== */
async function protectAdmin() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) location.href = "index.html";

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (error || data.role !== "admin") {
    alert("Access Denied");
    await supabaseClient.auth.signOut();
    location.href = "index.html";
  }
}
protectAdmin();

/* =====================
   LOGOUT
===================== */
async function logout() {
  await supabaseClient.auth.signOut();
  location.href = "index.html";
}

// ===============================
// DUE & OVERDUE COLUMN FILTER
// ===============================
function filterDueTable() {

  const rows = document.querySelectorAll("#dueTable tr");
  const filters = document.querySelectorAll(".filter-row input, .filter-row select");

  rows.forEach(row => {
    const cells = row.querySelectorAll("td");
    let show = true;

    filters.forEach(filter => {
      const col = Number(filter.dataset.col);
      const value = filter.value.trim().toLowerCase();
      if (!value) return;

      const cell = cells[col];
      if (!cell) return;

      let cellText = cell.innerText.trim().toLowerCase();

      // 📅 DATE — exact match
      if (filter.type === "date") {
        cellText = cellText.split(" ")[0];
        if (cellText !== value) show = false;
      }

      // 🔥 STATUS COLUMN — EXACT MATCH ONLY
      else if (col === 5) {
        if (cellText !== value) show = false;
      }

      // 🔍 TEXT FILTER — includes OK
      else {
        if (!cellText.includes(value)) show = false;
      }
    });

    row.style.display = show ? "" : "none";
  });
}

// ===============================
// TOGGLE DUE & OVERDUE FILTERS
// ===============================
function toggleDueFilters() {
  const inputs = document.querySelectorAll(
    "#dueFilterRow .due-filter-input"
  );

  if (!inputs.length) {
    console.error("❌ Due filter inputs not found");
    return;
  }

  inputs.forEach(input => {
    input.style.display =
      input.style.display === "none" ? "block" : "none";
  });
}


/* =====================
   ADD PSV FORM TOGGLE
===================== */
function openAddPSVModal() {
  hideDashboard();                        // optional
  document.getElementById("addPsvModal").style.display = "flex";
}

function closeAddPSVModal() {
  document.getElementById("addPsvModal").style.display = "none";
  showDashboard();                        // optional
}



/* =====================
   VIEW ALL PSV TOGGLE
===================== */
function togglePSVSection() {
  const section = document.getElementById("psvSection");
  if (!section) return;

  const isOpen = section.style.display === "block";

  // 🔁 Dubara click → CLOSE + dashboard wapas
  if (isOpen) {
    section.style.display = "none";
    showDashboard();              // ✅ overview back
    return;
  }

  // 🔥 First click → OPEN (cards jaisa)
  hideDashboard();
  section.style.display = "block";
  renderTable(psvCache, false);   // ACTION visible

  setTimeout(() => {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 120);
}



/* =====================
   ADD PSV
===================== */
async function addPSV() {
const payload = {
  unit: unit.value.trim(),
  tag_no: tag_no.value.trim(),
  set_pressure: set_pressure.value.trim(),
  cdsp: cdsp.value.trim(),
  bp: bp.value.trim(),
  orifice: orifice.value.trim(),
  type: type.value.trim(),
  service: service.value.trim(),

  last_inspection_date:
  toISODate(document.getElementById("last_inspection_date").value),


  inspection_frequency:
  Number(document.getElementById("inspection_frequency").value) || null

};

  if (!payload.tag_no || !payload.set_pressure || !payload.service) {
    alert("⚠️ Tag No, Set Pressure and Service are required");
    return;
  }

  const { error } = await supabaseClient
    .from("psv_data")
    .insert(payload);

  if (error) {
    alert("❌ " + error.message);
    return;
  }

  alert("✅ PSV Added Successfully");

  document.querySelectorAll("#addPsvForm input")
    .forEach(i => i.value = "");

  document.getElementById("addPsvForm").style.display = "none";

  loadPSV();
  loadChart();
  loadDashboardSummary();
}

closeAddPSVModal();


/* =====================
   DATE FORMAT HELPER
===================== */
function toISODate(value) {
  if (!value) return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // DD-MM-YYYY → YYYY-MM-DD
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split("-");
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

/* =====================
   EXCEL UPLOAD (BULK PSV)
===================== */

// 🔧 Excel serial date → YYYY-MM-DD
function excelDateToISO(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const date = new Date(utcValue * 1000);
  return date.toISOString().split("T")[0];
}

async function uploadExcel() {
  const fileInput = document.getElementById("excelUpload");
  if (!fileInput || !fileInput.files.length) return;

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (!rows.length) {
        alert("⚠️ Excel file empty hai");
        return;
      }

      const cleanRows = rows.map(r => {

        let lastDate = null;
        let nextInspection = null;

        /* ---------- DATE HANDLING ---------- */
        if (r.last_inspection_date) {

          // Excel number (45426)
          if (typeof r.last_inspection_date === "number") {
            lastDate = excelDateToISO(r.last_inspection_date);
          }
          // DD-MM-YYYY
          else if (r.last_inspection_date.toString().includes("-")) {
            const parts = r.last_inspection_date.toString().split("-");
            if (parts.length === 3 && parts[0].length === 2) {
              lastDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
            } else {
              lastDate = r.last_inspection_date;
            }
          }
        }

        /* ---------- NEXT INSPECTION ---------- */
        if (lastDate && r.inspection_frequency) {
          const d = new Date(lastDate);
          d.setMonth(d.getMonth() + Number(r.inspection_frequency));
          nextInspection = d.toISOString().split("T")[0];
        }

        return {
          unit: r.unit || "",
          tag_no: r.tag_no || "",
          set_pressure: r.set_pressure || null,
          cdsp: r.cdsp || null,
          bp: isNaN(r.bp) ? null : r.bp,
          orifice: r.orifice || "",
          type: r.type || "",
          service: r.service || "",

          last_inspection_date: lastDate,
          inspection_frequency: Number(r.inspection_frequency) || null,
          next_inspection_date: nextInspection
        };
      });

      const { error } = await supabaseClient
        .from("psv_data")
        .insert(cleanRows);

      if (error) {
        console.error(error);
        alert("❌ " + error.message);
        return;
      }

      alert(`✅ ${cleanRows.length} PSV uploaded successfully`);

      fileInput.value = "";
      loadPSV();
      loadChart();
      loadDashboardSummary();

    } catch (err) {
      console.error(err);
      alert("❌ Excel processing failed");
    }
  };

  reader.readAsArrayBuffer(file);
}




/* =====================
   LOAD PSV
===================== */
async function loadPSV() {
  const { data, error } = await supabaseClient
    .from("psv_data")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    alert("❌ Failed to load PSV data");
    return;
  }

  psvCache = data || [];
   populateFilterDropdowns(psvCache);   // ✅ YAHI ADD KARNA HAI
  renderTable(psvCache);
}

/* =====================
   RENDER TABLE
===================== */
function renderTable(data, hideAction = false) {
  psvList.innerHTML = "";

  // 🔥 ACTION HEADER SHOW / HIDE
  const actionHeader = document.getElementById("actionHeader");
  if (actionHeader) {
    actionHeader.style.display = hideAction ? "none" : "table-cell";
  }

  data.forEach(psv => {
    psvList.innerHTML += `
      <tr>
        <td>${psv.unit || "-"}</td>
        <td>${psv.tag_no || "-"}</td>
        <td>${psv.set_pressure || "-"}</td>
        <td>${psv.cdsp || "-"}</td>
        <td>${psv.bp || "-"}</td>
        <td>${psv.orifice || "-"}</td>
        <td>${psv.type || "-"}</td>
        <td>${psv.service || "-"}</td>
        <td>${psv.last_inspection_date || "-"}</td>
        <td>${psv.next_inspection_date || "-"}</td>
        <td>
          <span class="status ${psv.inspection_status?.toLowerCase()}">
            ${psv.inspection_status || "-"}
          </span>
        </td>

        ${
          hideAction
            ? ""
            : `<td>
                <button onclick="openEditModalById(${psv.id})">✏️</button>
                <button onclick="deletePSV(${psv.id})">❌</button>
              </td>`
        }
      </tr>
    `;
  });

  totalCount.innerText = data.length;
}

function openEditModalById(id) {
  const psv = psvCache.find(p => p.id === id);
  if (!psv) return;
  openEditModal(psv);
}

/* =====================
   editing model 
===================== */
function openEditModal(psv) {
  document.getElementById("editModal").style.display = "flex";

  edit_id.value = psv.id;
  edit_unit.value = psv.unit || "";
  edit_tag_no.value = psv.tag_no || "";
  edit_set_pressure.value = psv.set_pressure || "";
  edit_cdsp.value = psv.cdsp || "";
  edit_bp.value = psv.bp || "";
  edit_orifice.value = psv.orifice || "";
  edit_type.value = psv.type || "";
  edit_service.value = psv.service || "";

  edit_last_inspection_date.value =
    psv.last_inspection_date
      ? psv.last_inspection_date.split("T")[0]
      : "";

  edit_inspection_frequency.value =
    psv.inspection_frequency || "";
}


/* =====================
   editing save data
===================== */
async function saveEditPSV() {
  const id = edit_id.value;

  const lastInspectionRaw = edit_last_inspection_date.value;
  const freq = Number(edit_inspection_frequency.value) || null;

  const lastInspection = toISODate(lastInspectionRaw);

  let nextInspection = null;
  if (lastInspection && freq) {
    const d = new Date(lastInspection);
    d.setMonth(d.getMonth() + freq);
    nextInspection = d.toISOString().split("T")[0];
  }

  const payload = {
    unit: edit_unit.value || null,
    tag_no: edit_tag_no.value || null,
    set_pressure: edit_set_pressure.value || null,
    cdsp: edit_cdsp.value || null,
    bp: edit_bp.value || null,
    orifice: edit_orifice.value || null,
    type: edit_type.value || null,
    service: edit_service.value || null,

    last_inspection_date: lastInspection,
    inspection_frequency: freq,
    next_inspection_date: nextInspection
  };

  const { error } = await supabaseClient
    .from("psv_data")
    .update(payload)
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("❌ Update failed");
    return;
  }

  alert("✅ PSV Updated");
  closeEditModal();
  loadPSV();
  loadDashboardSummary();
}

function closeEditModal() {
  document.getElementById("editModal").style.display = "none";
}

/* =====================
   SEARCH
===================== */
function filterPSV() {
  applyFilters();   // 🔥 central filter call
}

/* =====================
   SORT BY PRESSURE
===================== */
function sortByPressure() {

  const base = filteredCache.length ? filteredCache : psvCache;

  const sorted = [...base].sort((a, b) => {
    const aP = parseFloat(a.set_pressure) || 0;
    const bP = parseFloat(b.set_pressure) || 0;
    return sortDesc ? bP - aP : aP - bP;
  });

  sortDesc = !sortDesc;
  renderTable(sorted);
}


/* =====================
   DELETE PSV
===================== */
async function deletePSV(id) {
  if (!confirm("Delete this PSV?")) return;

  await supabaseClient
    .from("psv_data")
    .delete()
    .eq("id", id);

  loadPSV();
  loadChart();
  loadDashboardSummary();
}

/* =====================
   SERVICE PIE CHART
===================== */
async function loadChart() {
  const { data } = await supabaseClient
    .from("psv_data")
    .select("service");

  const counts = {};
  (data || []).forEach(row => {
    if (!row.service) return;
    counts[row.service] = (counts[row.service] || 0) + 1;
  });

  if (chartInstance) chartInstance.destroy();

  const chartCanvas = document.getElementById("chart");
  if (!chartCanvas) return;

  chartInstance = new Chart(chartCanvas, {
    type: "pie",
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });
}


/* =====================
   DASHBOARD SUMMARY
===================== */
async function loadDashboardSummary() {
  const { data } = await supabaseClient
    .from("psv_data")
    .select("*");

  if (!data) return;

  /* ---- QUICK SUMMARY COUNTS ---- */
  let totalPSV = data.length;
  let activePSV = 0, duePSV = 0, overduePSV = 0;

  data.forEach(psv => {
    if (psv.inspection_status === "Overdue") overduePSV++;
    else if (psv.inspection_status === "Due") duePSV++;
    else if (psv.inspection_status === "OK") activePSV++;
  });

  qsTotal.innerText = totalPSV;
  qsActive.innerText = activePSV;
  qsDue.innerText = duePSV;
  qsOverdue.innerText = overduePSV;

  /* ---- UNIT OVERVIEW (BAR CHART) ---- */
  const unitCount = {};
  data.forEach(psv => {
    if (!psv.unit) return;
    unitCount[psv.unit] = (unitCount[psv.unit] || 0) + 1;
  });

  if (unitChartInstance) unitChartInstance.destroy();

  const unitCanvas = document.getElementById("unitChart");
  if (!unitCanvas) return;

  unitChartInstance = new Chart(unitCanvas, {
    type: "bar",
    data: {
      labels: Object.keys(unitCount),
      datasets: [{
        data: Object.values(unitCount),
        borderRadius: 6
      }]
    },
   options: {
  responsive: true,
  maintainAspectRatio: false,

  plugins: {
    legend: { display: false }
  },

  scales: {
    x: {
      ticks: {
        padding: 2
      },
      grid: {
        offset: true
      }
    },
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 1,
        padding: 2
      }
    }
  },

  onClick: (evt, elements) => {
    if (!elements.length) return;
    const index = elements[0].index;
    const unit = unitChartInstance.data.labels[index];
    filterByUnit(unit);
  }
}
 });

  /* ---- STATUS SUMMARY (PIE) ---- */
  let active = 0, dueSoon = 0, overdue = 0;

  data.forEach(psv => {
    if (psv.inspection_status === "Overdue") overdue++;
    else if (psv.inspection_status === "Due") dueSoon++;
    else if (psv.inspection_status === "OK") active++;
  });

  if (statusChartInstance) statusChartInstance.destroy();

  const statusCanvas = document.getElementById("statusChart");
  if (!statusCanvas) return;

  statusChartInstance = new Chart(statusCanvas, {
    type: "pie",
    data: {
      labels: ["Active", "Due Soon", "Overdue"],
      datasets: [{
        data: [active, dueSoon, overdue]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });


    /* ---- ALERTS & DUE TABLE ---- */
alertList.innerHTML = "";
dueTable.innerHTML = "";

data.forEach(psv => {
  if (!psv.tag_no) return;

  const status = psv.inspection_status;

  if (status !== "Due" && status !== "Overdue") return;

  // 🔔 Alerts
  alertList.innerHTML += `
    <li>⚠️ ${psv.tag_no} (${status})</li>
  `;

  // 📋 Customized Due & Overdue Table
  dueTable.innerHTML += `
    <tr>
      <td>${psv.tag_no}</td>
      <td>${psv.unit || "-"}</td>
      <td>${psv.set_pressure || "-"}</td>
      <td>${psv.last_inspection_date || "-"}</td>
      <td>${psv.next_inspection_date || "-"}</td>
      <td>
        <span class="badge ${status === "Overdue" ? "overdue" : "due"}">
          ${status}
        </span>
      </td>
    </tr>
  `;
});
}

function applyFilters() {

  const unit = document.getElementById("filterUnit")?.value || "";
  const service = document.getElementById("filterService")?.value || "";
  const status = document.getElementById("filterStatus")?.value || "";
  const minSP = document.getElementById("minPressure")?.value || "";
  const maxSP = document.getElementById("maxPressure")?.value || "";
  const search = document.getElementById("searchInput")?.value
    .toLowerCase() || "";

  // 🔥 DATE RANGE VALUES
  const lastFrom = document.getElementById("lastFrom")?.value;
  const lastTo   = document.getElementById("lastTo")?.value;
  const nextFrom = document.getElementById("nextFrom")?.value;
  const nextTo   = document.getElementById("nextTo")?.value;

  filteredCache = psvCache.filter(psv => {

    if (unit && psv.unit !== unit) return false;
    if (service && psv.service !== service) return false;
    if (status && psv.inspection_status !== status) return false;

    if (minSP && Number(psv.set_pressure) < Number(minSP)) return false;
    if (maxSP && Number(psv.set_pressure) > Number(maxSP)) return false;

    // 🔍 SEARCH
    if (
      search &&
      !(
        (psv.tag_no || "").toLowerCase().includes(search) ||
        (psv.service || "").toLowerCase().includes(search)
      )
    ) return false;

    // 📅 LAST INSPECTION RANGE
    if (lastFrom && (!psv.last_inspection_date ||
        new Date(psv.last_inspection_date) < new Date(lastFrom)))
      return false;

    if (lastTo && (!psv.last_inspection_date ||
        new Date(psv.last_inspection_date) > new Date(lastTo)))
      return false;

    // 📅 NEXT INSPECTION RANGE
    if (nextFrom && (!psv.next_inspection_date ||
        new Date(psv.next_inspection_date) < new Date(nextFrom)))
      return false;

    if (nextTo && (!psv.next_inspection_date ||
        new Date(psv.next_inspection_date) > new Date(nextTo)))
      return false;

    return true;
  });

  renderTable(filteredCache);
}

/* =====================
   INIT
===================== */
loadPSV();
loadChart();
loadDashboardSummary();


function filterByStatus(status) {
  const section = document.getElementById("psvSection");
  if (!section) return;

  // 🔁 Same card dobara click → dashboard wapas
  if (cardViewOpen && activeCardFilter === status) {
    section.style.display = "none";
    cardViewOpen = false;
    activeCardFilter = null;

    showDashboard(); // ✅
    return;
  }

  hideDashboard();               // 🔥 dashboard hide
  section.style.display = "block";

  cardViewOpen = true;
  activeCardFilter = status;

  setTimeout(() => {
    section.scrollIntoView({ behavior: "smooth" });
  }, 120);

  filteredCache =
  status === "ALL"
    ? psvCache
    : psvCache.filter(psv => psv.inspection_status === status);

renderTable(filteredCache, true); // action HIDE
}



   /* =====================
   FILTER BY UNIT (BAR CHART CLICK)
===================== */
function filterByUnit(unit) {

  const section = document.getElementById("psvSection");
  if (!section) return;

  // Dashboard hide + list show
  hideDashboard();
  section.style.display = "block";

  // 🔥 Unit dropdown me value set
  const unitSelect = document.getElementById("filterUnit");
  if (unitSelect) unitSelect.value = unit;

  // 🔥 Central filter call
  applyFilters();

  setTimeout(() => {
    section.scrollIntoView({ behavior: "smooth" });
  }, 120);
}

function resetFilters() {

  ["filterUnit","filterService","filterStatus",
 "minPressure","maxPressure",
 "lastFrom","lastTo","nextFrom","nextTo",
 "searchInput"]
     
  .forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  filteredCache = [];
  renderTable(psvCache);
}

function populateFilterDropdowns(data) {

  const unitSel = document.getElementById("filterUnit");
  const servSel = document.getElementById("filterService");
  if (!unitSel || !servSel) return;

  const units = new Set();
  const services = new Set();

  data.forEach(p => {
    if (p.unit) units.add(p.unit);
    if (p.service) services.add(p.service);
  });

  unitSel.innerHTML = `<option value="">All Units</option>`;
  servSel.innerHTML = `<option value="">All Services</option>`;

  [...units].sort().forEach(u =>
    unitSel.innerHTML += `<option value="${u}">${u}</option>`
  );

  [...services].sort().forEach(s =>
    servSel.innerHTML += `<option value="${s}">${s}</option>`
  );
}


/* =====================
   search BY alert list
===================== */
function filterAlerts() {
  const keyword = document
    .getElementById("alertSearch")
    .value
    .toLowerCase();

  const items = document.querySelectorAll("#alertList li");

  items.forEach(li => {
    li.style.display = li.innerText
      .toLowerCase()
      .includes(keyword)
      ? "list-item"
      : "none";
  });
}


/* =====================
   Export psv list
===================== */
function exportToExcel() {

  // 🔥 Agar filter laga hai to wahi export hoga
  const dataToExport =
    filteredCache.length ? filteredCache : psvCache;

  if (!dataToExport.length) {
    alert("No data to export");
    return;
  }

  // 🧹 Clean & readable columns
  const cleanData = dataToExport.map(psv => ({
    Unit: psv.unit || "",
    Tag_No: psv.tag_no || "",
    Set_Pressure: psv.set_pressure || "",
    CDSP: psv.cdsp || "",
    BP: psv.bp || "",
    Orifice: psv.orifice || "",
    Type: psv.type || "",
    Service: psv.service || "",
    Last_Inspection: psv.last_inspection_date || "",
    Next_Inspection: psv.next_inspection_date || "",
    Status: psv.inspection_status || ""
  }));

  // 📦 Sheet create
  const worksheet = XLSX.utils.json_to_sheet(cleanData);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "PSV_Data");

  // 📥 Download
  XLSX.writeFile(
    workbook,
    `PSV_Export_${new Date().toISOString().split("T")[0]}.xlsx`
  );
}

// 🧹 advance filter for pop up window
function openAdvancedFilter(){
  document.getElementById("advancedFilterModal").style.display = "flex";
}

function closeAdvancedFilter(){
  document.getElementById("advancedFilterModal").style.display = "none";
}
