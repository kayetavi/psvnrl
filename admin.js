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

/* =====================
   ADD PSV FORM TOGGLE
===================== */
function toggleAddPSV() {
  const form = document.getElementById("addPsvForm");
  if (!form) return;
  form.style.display = form.style.display === "block" ? "none" : "block";
}

/* =====================
   VIEW ALL PSV TOGGLE
===================== */
function togglePSVSection() {
  const section = document.getElementById("psvSection");
  if (!section) return;

  const isHidden =
    section.style.display === "none" || section.style.display === "";

  section.style.display = isHidden ? "block" : "none";

  if (isHidden) {
    // ✅ Normal view → ACTION dikhna chahiye
    renderTable(psvCache, false);

    setTimeout(() => {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }
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
    document.getElementById("last_inspection_date").value || null,

  inspection_frequency:
    document.getElementById("inspection_frequency").value || null
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

/* =====================
   EXCEL UPLOAD (BULK PSV)
===================== */
async function uploadExcel() {
  const fileInput = document.getElementById("excelUpload");
  if (!fileInput || !fileInput.files.length) return;

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) {
      alert("⚠️ Excel file empty hai");
      return;
    }

    /* OPTIONAL: clean data */
    const cleanRows = rows.map(r => ({
      unit: r.unit || "",
      tag_no: r.tag_no || "",
      set_pressure: r.set_pressure || null,
      cdsp: r.cdsp || null,
      bp: r.bp || null,
      orifice: r.orifice || "",
      type: r.type || "",
      service: r.service || ""
    }));

    const { error } = await supabaseClient
      .from("psv_data")
      .insert(cleanRows);

    if (error) {
      console.error(error);
      alert("❌ Excel upload failed");
      return;
    }

    alert(`✅ ${cleanRows.length} PSV uploaded successfully`);

    fileInput.value = "";      // reset file
    loadPSV();                 // refresh table
    loadChart();               // refresh charts
    loadDashboardSummary();    // refresh dashboard
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

  const payload = {
    unit: edit_unit.value,
    tag_no: edit_tag_no.value,
    set_pressure: edit_set_pressure.value,
    cdsp: edit_cdsp.value,
    bp: edit_bp.value,
    orifice: edit_orifice.value,
    type: edit_type.value,
    service: edit_service.value,
    last_inspection_date: edit_last_inspection_date.value || null,
    inspection_frequency: edit_inspection_frequency.value || null
  };

  const { error } = await supabaseClient
    .from("psv_data")
    .update(payload)
    .eq("id", id);

  if (error) {
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
  const keyword = searchInput.value.toLowerCase();

  const filtered = psvCache.filter(psv =>
    (psv.tag_no || "").toLowerCase().includes(keyword) ||
    (psv.service || "").toLowerCase().includes(keyword)
  );

  renderTable(filtered);
}

/* =====================
   SORT BY PRESSURE
===================== */
function sortByPressure() {
  const sorted = [...psvCache].sort((a, b) => {
    const aP = parseFloat(a.set_pressure) || 0;
    const bP = parseFloat(b.set_pressure) || 0;
    return sortDesc ? bP - aP : aP - bP;
  });

  sortDesc = !sortDesc;
  renderTable(sorted);
}

/* =====================
   FILTER BY STATUS (SUMMARY CARD CLICK kpi tab)
===================== */
function filterByStatus(status) {

  // 1️⃣ PSV List section open karo
  const section = document.getElementById("psvSection");
  if (section.style.display !== "block") {
    section.style.display = "block";
  }

  // 2️⃣ Smooth scroll to table
  setTimeout(() => {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 120);

  // 3️⃣ Filter logic
  let filteredData = [];

  if (status === "ALL") {
    filteredData = psvCache;
  } else {
    filteredData = psvCache.filter(
      psv => psv.inspection_status === status
    );
  }

  // 4️⃣ Render filtered table
  renderTable(filteredData);
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
      legend: {
        position: "bottom"
      }
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
  let activePSV = 0;
  let duePSV = 0;
  let overduePSV = 0;

  data.forEach(psv => {
    if (psv.inspection_status === "Overdue") {
      overduePSV++;
    } else if (psv.inspection_status === "Due") {
      duePSV++;
    } else if (psv.inspection_status === "OK") {
      activePSV++;
    }
  });

  // Update dashboard cards
  document.getElementById("qsTotal").innerText = totalPSV;
  document.getElementById("qsActive").innerText = activePSV;
  document.getElementById("qsDue").innerText = duePSV;
  document.getElementById("qsOverdue").innerText = overduePSV;

  /* ---- UNIT OVERVIEW ---- */
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
    responsive: false,          // 🔥 THIS STOPS STRETCH
    maintainAspectRatio: true,  // 🔥 IMPORTANT
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1 }
      }
    }
  }
});





  /* ---- STATUS SUMMARY ---- */
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
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: "bottom"
      }
    }
  }
});


  /* ---- ALERTS & DUE TABLE ---- */
  /* ---- ALERTS & DUE TABLE ---- */
alertList.innerHTML = "";
dueTable.innerHTML = "";

data.forEach(psv => {
  if (!psv.tag_no) return;

  const status = psv.inspection_status; // OK / Due / Overdue

  // Sirf Due & Overdue dikhana
  if (status !== "Due" && status !== "Overdue") return;

  // 🔔 Alerts list
  alertList.innerHTML += `
    <li>⚠️ ${psv.tag_no} (${status})</li>
  `;

  // 📋 Due / Overdue Table
  dueTable.innerHTML += `
    <tr>
      <td>${psv.tag_no}</td>
      <td>${psv.unit || "-"}</td>
      <td>${psv.set_pressure || "-"}</td>
      <td>${psv.service || "-"}</td>
      <td>
        <span class="badge ${status === "Overdue" ? "overdue" : "due"}">
          ${status}
        </span>
      </td>
    </tr>
  `;
});
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

  // 🔁 Same card pe dobara click → HIDE
  if (cardViewOpen && activeCardFilter === status) {
    section.style.display = "none";
    cardViewOpen = false;
    activeCardFilter = null;
    return;
  }

  // SHOW section
  section.style.display = "block";
  cardViewOpen = true;
  activeCardFilter = status;

  setTimeout(() => {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 120);

  let filteredData = [];

  if (status === "ALL") {
    filteredData = psvCache;
  } else {
    filteredData = psvCache.filter(
      psv => psv.inspection_status === status
    );
  }

  // ❌ Card view → ACTION HIDE
  renderTable(filteredData, true);
}
