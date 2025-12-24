/* =====================
   SUPABASE CLIENT
===================== */
const supabaseClient = supabase.createClient(
  "https://qkpbggwaxnjwqdmqbbpz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcGJnZ3dheG5qd3FkbXFiYnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODA5MzksImV4cCI6MjA4MjA1NjkzOX0.qqHPESSXRgP0FECZBReJvKmJKigkzHoXbEU3s7XvJSA"
);

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
  const tag = tag_no.value.trim();
  const pressure = set_pressure.value.trim();
  const srv = service.value.trim();

  if (!tag || !pressure || !srv) {
    alert("Fill all fields");
    return;
  }

  const { error } = await supabaseClient
    .from("psv_data")
    .insert({
      tag_no: tag,
      set_pressure: pressure,
      service: srv
    });

  if (error) alert(error.message);
  else {
    alert("✅ PSV Added");
    tag_no.value = set_pressure.value = service.value = "";
    loadPSV();
    loadChart();
  }
}

/* =====================
   LOAD PSV
===================== */
async function loadPSV() {
  const { data } = await supabaseClient
    .from("psv_data")
    .select("*")
    .order("id", { ascending: false });

  psvList.innerHTML = "";

  data.forEach(psv => {
    psvList.innerHTML += `
      <tr>
        <td>${psv.tag_no}</td>
        <td>${psv.set_pressure}</td>
        <td>${psv.service}</td>
        <td>
          <button onclick="deletePSV(${psv.id})">❌</button>
        </td>
      </tr>
    `;
  });
}


/* =====================
   DELETE PSV
===================== */
async function deletePSV(id) {
  if (!confirm("Delete this PSV?")) return;
  await supabaseClient.from("psv_data").delete().eq("id", id);
  loadPSV();
  loadChart();
}

/* =====================
   CHART
===================== */
let chartInstance;

async function loadChart() {
  const { data } = await supabaseClient
    .from("psv_data")
    .select("service");

  const counts = {};
  data.forEach(row => {
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
    maintainAspectRatio: false   // ⭐ YAHI LINE IMPORTANT HAI
  }
});

}

/* INIT */
loadPSV();
loadChart();
