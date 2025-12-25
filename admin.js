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
function renderTable(data) {
  psvList.innerHTML = "";

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
<td>
  <button onclick="deletePSV(${psv.id})">❌</button>
</td>
      </tr>
    `;
  });

  totalCount.innerText = data.length;
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
