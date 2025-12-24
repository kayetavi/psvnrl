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

  // Basic required validation
  if (!payload.tag_no || !payload.set_pressure || !payload.service) {
    alert("⚠️ Tag No, Set Pressure and Service are required");
    return;
  }

  const { error } = await supabaseClient
    .from("psv_data")
    .insert(payload);

  if (error) {
    console.error(error);
    alert("❌ " + error.message);
    return;
  }

  alert("✅ PSV Added Successfully");

  // Clear all fields
  unit.value = "";
  tag_no.value = "";
  set_pressure.value = "";
  cdsp.value = "";
  bp.value = "";
  orifice.value = "";
  type.value = "";
  service.value = "";

  loadPSV();
  loadChart();
}

/* =====================
   LOAD PSV (MAIN)
===================== */
async function loadPSV() {
  const { data, error } = await supabaseClient
    .from("psv_data")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error(error);
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
        <td>${psv.unit ?? "-"}</td>
        <td>${psv.tag_no ?? "-"}</td>
        <td>${psv.set_pressure ?? "-"}</td>
        <td>${psv.cdsp ?? "-"}</td>
        <td>${psv.bp ?? "-"}</td>
        <td>${psv.orifice ?? "-"}</td>
        <td>${psv.type ?? "-"}</td>
        <td>${psv.service ?? "-"}</td>
        <td>
          <button onclick="deletePSV(${psv.id})">❌</button>
        </td>
      </tr>
    `;
  });

  document.getElementById("totalCount").innerText = data.length;
}


/* =====================
   SEARCH
===================== */
function filterPSV() {
  const keyword = searchInput.value.toLowerCase();

  const filtered = psvCache.filter(psv =>
    psv.tag_no.toLowerCase().includes(keyword) ||
    psv.service.toLowerCase().includes(keyword)
  );

  renderTable(filtered);
}

/* =====================
   SORT BY PRESSURE
===================== */
function sortByPressure() {
  const sorted = [...psvCache].sort((a, b) => {
    const aP = parseFloat(a.set_pressure);
    const bP = parseFloat(b.set_pressure);
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
}

/* =====================
   CHART
===================== */
async function loadChart() {
  const { data } = await supabaseClient
    .from("psv_data")
    .select("service");

  const counts = {};
  (data || []).forEach(row => {
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
      maintainAspectRatio: false
    }
  });
}

/* =====================
   INIT
===================== */
loadPSV();
loadChart();
