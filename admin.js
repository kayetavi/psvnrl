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
    service: service.value.trim()
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

  chartInstance = new Chart(chart, {
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

  unitChartInstance = new Chart(unitChart, {
  type: "bar",
  data: {
    labels: Object.keys(unitCount),
    datasets: [{
      data: Object.values(unitCount)
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    }
  }
});


  /* ---- STATUS SUMMARY ---- */
  let active = 0, dueSoon = 0, overdue = 0;

  data.forEach(psv => {
    if (psv.service?.toLowerCase().includes("flare")) overdue++;
    else if (psv.service?.toLowerCase().includes("hc")) dueSoon++;
    else active++;
  });

  if (statusChartInstance) statusChartInstance.destroy();

  statusChartInstance = new Chart(statusChart, {
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
      legend: {
        position: "bottom"
      }
    }
  }
});


  /* ---- ALERTS & DUE TABLE ---- */
  alertList.innerHTML = "";
  dueTable.innerHTML = "";

  data.forEach(psv => {
    if (!psv.tag_no) return;

    let status = "Active";
    if (psv.service?.toLowerCase().includes("flare")) status = "Overdue";
    else if (psv.service?.toLowerCase().includes("hc")) status = "Due Soon";

    if (status !== "Active") {
      alertList.innerHTML += `
        <li>⚠️ ${psv.tag_no} (${status})</li>
      `;

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
    }
  });
}

/* =====================
   INIT
===================== */
loadPSV();
loadChart();
loadDashboardSummary();
