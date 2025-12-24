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
    .select(`
      unit,
      tag_no,
      set_pressure,
      cdsp,
      bp,
      orifice,
      type,
      service
    `)
    .order("id", { ascending: false });

  if (error) {
    alert(error.message);
    return;
  }

  allPSVData = data || [];

  /* ===== TOTAL PSV ===== */
  const psvCountEl = document.getElementById("psvCount");
  if (psvCountEl) {
    psvCountEl.innerText = allPSVData.length;
  }

  /* ===== UNIQUE UNITS ===== */
  const units = new Set(allPSVData.map(p => p.unit));
  const unitCountEl = document.getElementById("unitCount");
  if (unitCountEl) {
    unitCountEl.innerText = units.size;
  }

  // Default load → all PSV
  showAllPSV();
}

/* ============================
   CARD CLICK FUNCTIONS
============================ */
function showAllPSV() {
  renderTable(allPSVData);
}

function showAllUnits() {
  // unique unit rows
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
        <td colspan="8" style="text-align:center;">No data found</td>
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
        <td>${psv.cdsp ?? "-"}</td>
        <td>${psv.bp ?? "-"}</td>
        <td>${psv.orifice ?? "-"}</td>
        <td>${psv.type ?? "-"}</td>
        <td>${psv.service ?? "-"}</td>
      </tr>
    `;
  });
}

/* ============================
   COLUMN-WISE SEARCH
============================ */

let filteredData = [];

document.addEventListener("input", function (e) {
  if (e.target.classList.contains("col-search")) {
    applyColumnFilter();
  }
});

function applyColumnFilter() {
  const inputs = document.querySelectorAll(".col-search");

  filteredData = allPSVData.filter(row => {
    return Array.from(inputs).every(input => {
      const col = input.dataset.col;
      const val = input.value.toLowerCase().trim();

      if (!val) return true;

      return String(row[col] ?? "")
        .toLowerCase()
        .includes(val);
    });
  });

  renderTable(filteredData);
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
