/* ============================
   SUPABASE CLIENT
============================ */
const supabaseClient = supabase.createClient(
  "https://qkpbggwaxnjwqdmqbbpz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcGJnZ3dheG5qd3FkbXFiYnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODA5MzksImV4cCI6MjA4MjA1NjkzOX0.qqHPESSXRgP0FECZBReJvKmJKigkzHoXbEU3s7XvJSA"
);

let allPSVData = [];

/* ============================
   PROTECT USER
============================ */
async function protectUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    location.href = "index.html";
    return;
  }
}
protectUser();

/* ============================
   LOAD PSV DATA
============================ */
async function loadPSV() {
  const { data, error } = await supabaseClient
    .from("psv_data")
    .select("unit, tag_no, set_pressure, service")
    .order("id", { ascending: false });

  if (error) {
    alert(error.message);
    return;
  }

  allPSVData = data || [];

  // ✅ TOTAL PSV COUNT
  const psvCountEl = document.getElementById("psvCount");
  if (psvCountEl) {
    psvCountEl.innerText = allPSVData.length;
  }

  // ✅ UNIQUE UNIT COUNT
  const units = new Set(allPSVData.map(p => p.unit));
  const unitCountEl = document.getElementById("unitCount");
  if (unitCountEl) {
    unitCountEl.innerText = units.size;
  }

  // Default view → show all PSV
  showAllPSV();
}

/* ============================
   SHOW FUNCTIONS (CARD CLICK)
============================ */
function showAllPSV() {
  renderTable(allPSVData);
}

function showAllUnits() {
  // one row per unit (unique)
  const uniqueUnitsData = Object.values(
    allPSVData.reduce((acc, cur) => {
      if (!acc[cur.unit]) {
        acc[cur.unit] = cur;
      }
      return acc;
    }, {})
  );

  renderTable(uniqueUnitsData);
}

/* ============================
   RENDER TABLE
============================ */
function renderTable(data) {
  const list = document.getElementById("psvList");
  if (!list) return;

  list.innerHTML = "";

  if (data.length === 0) {
    list.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;">No data found</td>
      </tr>
    `;
    return;
  }

  data.forEach(psv => {
    list.innerHTML += `
      <tr>
        <td>${psv.unit ?? "-"}</td>
        <td>${psv.tag_no ?? "-"}</td>
        <td>${psv.set_pressure ?? "-"}</td>
        <td>${psv.service ?? "-"}</td>
      </tr>
    `;
  });
}

/* ============================
   LOGOUT
============================ */
async function logout() {
  await supabaseClient.auth.signOut();
  location.href = "index.html";
}

/* ============================
   INIT
============================ */
loadPSV();
