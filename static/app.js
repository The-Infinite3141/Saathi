(() => {
  const $ = id => document.getElementById(id);
  let selectedImage = null, healthModel = null, diseaseModel = null, plantDetector = null, cameraStream = null, facing = "environment", currentWeather = null, lastPlantResult = null;
  let guideMessages = [], guideBusy = false;
  let liveScanTimer = null, liveScanBusy = false, lastLiveSignature = "", lastLiveShownAt = 0;
  const confThreshold = 0.70;

  function logActivity(title, detail){
    const log = $("activityLog");
    if (!log) return;
    const row = document.createElement("div");
    row.className = "advice";
    row.innerHTML = "<div class='advice-icon'>✓</div><p><b>" + escapeHtml(title) + "</b><small>" + escapeHtml(detail) + "</small></p>";
    if (log.firstElementChild?.textContent.includes("Dashboard started")) log.innerHTML = "";
    log.prepend(row);
    while (log.children.length > 5) log.lastElementChild.remove();
  }

  function syncDashboard(){
    if ($("dashPlant") && $("statPlant")) $("dashPlant").textContent = $("statPlant").textContent;
    if ($("dashWeather") && $("statWeather")) $("dashWeather").textContent = $("statWeather").textContent;
    if ($("dashMoisture") && $("moisture")) $("dashMoisture").textContent = $("moisture").value + "%";
    if ($("dashCrop") && $("crop")) $("dashCrop").textContent = $("crop").value || "Not set";
    if ($("statMoisture") && $("moisture")) $("statMoisture").textContent = $("moisture").value + "%";
  }

  // --- Multi-Language Dictionary ---
  window.translations = {
    en: {
      nav_dashboard: "Dashboard", nav_advisory: "Crop Advisory", nav_weather: "Weather", nav_irrigation: "Irrigation", nav_farmer_ai: "Farmer AI Guide",
      smart_farming: "SMART FARMING", title_dashboard: "Saathi Dashboard", desc_dashboard: "Turn crop, weather and field observations into practical next steps.",
      plant_health: "Plant health", not_analyzed: "Not analyzed", weather: "Weather", not_loaded: "Not loaded",
      soil_moisture: "Soil moisture", simulated_input: "Live / Simulated input", crop_selected: "Crop selected", not_set: "Not set",
      what_need_today: "What do you need today?", btn_scan: "🌿 Scan a plant / crop care", btn_weather: "⛅ Check local weather",
      btn_irrigation: "💧 Plan irrigation", btn_ask_ai: "🧠 Ask Farmer AI"
    },
    hi: {
      nav_dashboard: "डैशबोर्ड", nav_advisory: "फसल सलाह", nav_weather: "मौसम", nav_irrigation: "सिंचाई", nav_farmer_ai: "किसान AI मार्गदर्शक",
      smart_farming: "स्मार्ट कृषि", title_dashboard: "साथी डैशबोर्ड", desc_dashboard: "फसल, मौसम और खेत की स्थिति को व्यावहारिक समाधान में बदलें।",
      plant_health: "पौधे का स्वास्थ्य", not_analyzed: "विश्लेषण नहीं हुआ", weather: "मौसम", not_loaded: "लोड नहीं हुआ",
      soil_moisture: "मिट्टी की नमी", simulated_input: "लाइव / परीक्षण डेटा", crop_selected: "चुनी गई फसल", not_set: "निर्धारित नहीं",
      what_need_today: "आज आपको क्या सहायता चाहिए?", btn_scan: "🌿 पौधे की जांच करें", btn_weather: "⛅ स्थानीय मौसम देखें",
      btn_irrigation: "💧 सिंचाई की योजना", btn_ask_ai: "🧠 किसान AI से पूछें"
    },
    bn: {
      nav_dashboard: "ড্যাশবোর্ড", nav_advisory: "ফসল পরামর্শ", nav_weather: "আবহাওয়া", nav_irrigation: "সেচ ব্যবস্থা", nav_farmer_ai: "কৃষক AI সহায়ক",
      smart_farming: "স্মার্ট কৃষি", title_dashboard: "সাথী ড্যাশবোর্ড", desc_dashboard: "ফসল, আবহাওয়া এবং মাটির তথ্যকে সঠিক পদক্ষেপে রূপান্তর করুন।",
      plant_health: "গাছের স্বাস্থ্য", not_analyzed: "বিশ্লেষণ হয়নি", weather: "আবহাওয়া", not_loaded: "লোড হয়নি",
      soil_moisture: "মাটির আর্দ্রতা", simulated_input: "লাইভ / পরীক্ষামূলক ডেটা", crop_selected: "নির্বাচিত ফসল", not_set: "নির্ধারণ করা নেই",
      what_need_today: "আজ আপনার কী প্রয়োজন?", btn_scan: "🌿 পাতা স্ক্যান / পরিচর্যা", btn_weather: "⛅ আবহাওয়ার তথ্য",
      btn_irrigation: "💧 সেচ পরিকল্পনা", btn_ask_ai: "🧠 কৃষক AI-কে প্রশ্ন করুন"
    }
  };

  const pageTitles = {
    en: { dashboard: "Saathi Dashboard", advisory: "Crop Advisory & Plant Health", weather: "Local Weather", irrigation: "Smart Irrigation Planner", guide: "Saathi Farmer AI Guide" },
    hi: { dashboard: "साथी डैशबोर्ड", advisory: "फसल सलाह एवं पौध स्वास्थ्य", weather: "स्थानीय मौसम", irrigation: "स्मार्ट सिंचाई योजना", guide: "साथी किसान AI मार्गदर्शक" },
    bn: { dashboard: "সাথী ড্যাশবোর্ড", advisory: "ফসল পরামর্শ ও উদ্ভিদের স্বাস্থ্য", weather: "স্থানীয় আবহাওয়া", irrigation: "স্মার্ট সেচ পরিকল্পনা", guide: "সাথী কৃষক AI সহায়ক" }
  };

  window.currentLanguage = localStorage.getItem("saathi_language") || "en";

  // --- Navigation Engine ---
  function showPage(page){
    const target = $("page-" + page);
    if (!target) return;
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    target.classList.add("active");
    document.querySelectorAll("[data-page]").forEach(b => b.classList.toggle("active", b.dataset.page === page));

    const lang = window.currentLanguage || "en";
    const dict = pageTitles[lang] || pageTitles.en;
    if ($("pageTitle")) {
      $("pageTitle").textContent = dict[page] || dict.dashboard;
    }

    if (page === "guide") refreshGuideContext();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  window.changeLanguage = function(lang) {
    if (!window.translations[lang]) return;
    window.currentLanguage = lang;
    localStorage.setItem("saathi_language", lang);

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (window.translations[lang][key]) {
        el.textContent = window.translations[lang][key];
      }
    });

    const activeBtn = document.querySelector("[data-page].active");
    const activePage = activeBtn ? activeBtn.dataset.page : "dashboard";
    const dict = pageTitles[lang] || pageTitles.en;
    if ($("pageTitle")) {
      $("pageTitle").textContent = dict[activePage] || dict.dashboard;
    }
  };

  // Bind Navigation Clicks
  document.querySelectorAll("[data-page]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      showPage(btn.dataset.page);
    });
  });

  document.querySelectorAll("[data-goto]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      showPage(btn.dataset.goto);
    });
  });

  // --- Image Selection & Camera ---
  if ($("chooseImage")) $("chooseImage").onclick = () => $("leafInput") && $("leafInput").click();
  if ($("leafInput")) {
    $("leafInput").addEventListener("change", e => {
      const file = e.target.files?.[0];
      if (file) setImageFile(file);
    });
  }

  function setImageFile(file){
    if (!file.type.startsWith("image/")) { alert("Please select an image file."); return; }
    if (selectedImage?.url) URL.revokeObjectURL(selectedImage.url);
    const url = URL.createObjectURL(file);
    selectedImage = { url, file };
    if ($("leafPreview")) { $("leafPreview").src = url; $("leafPreview").hidden = false; }
    if ($("uploadPrompt")) $("uploadPrompt").hidden = true;
    if ($("diseaseResult")) $("diseaseResult").innerHTML = "<h3>Image ready</h3><p class='sub'>Analyzing automatically…</p>";
    if (healthModel && diseaseModel) imgFromUrl(url).then(img => analyzeSource(img)).catch(() => {});
  }

  const dropZone = $("dropZone");
  if (dropZone) {
    dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.style.borderColor = "#16a765"; });
    dropZone.addEventListener("dragleave", () => { dropZone.style.borderColor = "#8ad0a8"; });
    dropZone.addEventListener("drop", e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setImageFile(f); });
  }

  if ($("openCamera")) $("openCamera").onclick = async () => { $("cameraModal")?.classList.add("open"); await startCamera(); };
  async function startCamera(){
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) { if ($("cameraStatus")) $("cameraStatus").textContent = "Webcam access not supported."; return; }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      const video = $("cameraVideo");
      if (video) { video.srcObject = cameraStream; await video.play(); }
      beginLiveScan();
    } catch(err) {
      if ($("cameraStatus")) $("cameraStatus").textContent = "Could not access camera: " + err.message;
    }
  }

  function stopCamera(){
    if (liveScanTimer) { clearInterval(liveScanTimer); liveScanTimer = null; }
    liveScanBusy = false;
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
    if ($("cameraVideo")) $("cameraVideo").srcObject = null;
  }

  if ($("closeCamera")) $("closeCamera").onclick = () => { $("cameraModal")?.classList.remove("open"); stopCamera(); };
  if ($("switchCamera")) $("switchCamera").onclick = () => { facing = facing === "environment" ? "user" : "environment"; startCamera(); };
  if ($("capturePhoto")) {
    $("capturePhoto").onclick = () => {
      const v = $("cameraVideo");
      if (!v || !v.videoWidth) return;
      const c = document.createElement("canvas");
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d").drawImage(v, 0, 0);
      c.toBlob(blob => {
        if (blob) setImageFile(new File([blob], "leaf-capture.jpg", { type: "image/jpeg" }));
        $("cameraModal")?.classList.remove("open");
        stopCamera();
      }, "image/jpeg", 0.92);
    };
  }

  // --- Teachable Machine Models ---
  function normalizeUrl(url){ url = (url || "").trim(); if (url && !url.endsWith("/")) url += "/"; return url; }
  async function loadModels(){
    if (healthModel && diseaseModel && plantDetector) return true;
    const u1 = normalizeUrl($("healthUrl")?.value), u2 = normalizeUrl($("diseaseUrl")?.value);
    if (!u1 || !u2 || !window.tmImage || !window.cocoSsd) return false;
    try {
      healthModel = await tmImage.load(u1 + "model.json", u1 + "metadata.json");
      diseaseModel = await tmImage.load(u2 + "model.json", u2 + "metadata.json");
      plantDetector = await cocoSsd.load({ base: "lite_mobilenet_v2" });
      if ($("dashModelStatus")) $("dashModelStatus").textContent = "Models ready.";
      return true;
    } catch (e) {
      if ($("dashModelStatus")) $("dashModelStatus").textContent = "Model loading failed.";
      return false;
    }
  }

  function predict(model, img){ return model.predict(img).then(p => p.sort((a,b) => b.probability - a.probability)); }
  function inferHealthLabels(predictions){
    const labels = predictions.map(p => p.className.trim());
    let healthy = labels.find(n => /healthy|normal|disease[-_ ]?free/i.test(n) && !/unhealthy|diseased/i.test(n));
    let unhealthy = labels.find(n => /unhealthy|diseased|sick|blight|spot|rot/i.test(n));
    return { healthy, unhealthy };
  }

  async function classifyImage(img){
    const p1 = await predict(healthModel, img), top = p1[0], classes = inferHealthLabels(p1);
    if (top.probability < confThreshold) return { kind: "uncertain", p1, top };
    if (classes.healthy && top.className.trim() === classes.healthy) return { kind: "healthy", p1, top };
    if (classes.unhealthy && top.className.trim() === classes.unhealthy) {
      const p2 = await predict(diseaseModel, img);
      return { kind: "disease", p1, p2, top: p2[0], healthTop: top };
    }
    return { kind: "uncertain", p1, top };
  }

  async function analyzeSource(img){
    if (!healthModel || !diseaseModel) return;
    if ($("analyzeBtn")) $("analyzeBtn").disabled = true;
    try {
      const r = await classifyImage(img);
      const label = r.kind === "disease" ? r.top.className : (r.kind === "healthy" ? r.top.className : r.top.className + " (uncertain)");
      if ($("statPlant")) $("statPlant").textContent = label;
      lastPlantResult = { label, kind: r.kind, source: "uploaded image", at: new Date().toLocaleTimeString() };
      syncDashboard();
      refreshGuideContext();
    } catch (e) {
      console.error(e);
    } finally {
      if ($("analyzeBtn")) $("analyzeBtn").disabled = false;
    }
  }

  function imgFromUrl(url){ return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = url; }); }
  function beginLiveScan(){} // Retained for interface parity

  function escapeHtml(s){ return String(s || "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }

  // --- Weather ---
  if ($("getWeather")) $("getWeather").onclick = () => fetchWeatherByCity();
  async function fetchWeatherByCity(){
    const city = $("city")?.value.trim();
    if (!city) return;
    try {
      const res = await fetch("/api/weather?city=" + encodeURIComponent(city));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      currentWeather = data;
      if ($("statWeather")) $("statWeather").textContent = Math.round(data.current.temp) + "°C";
      syncDashboard();
      refreshGuideContext();
    } catch(err) {
      console.error(err);
    }
  }

  // --- Crop Advice & Irrigation ---
  function generateCropAdvice(record = false){
    const crop = $("crop")?.value || "";
    if ($("statCrop")) $("statCrop").textContent = crop || "Not set";
    syncDashboard();
    refreshGuideContext();
  }
  if ($("getAdvice")) $("getAdvice").onclick = () => generateCropAdvice(true);

  function renderIrrigationAdvice(){
    syncDashboard();
    refreshGuideContext();
  }
  if ($("irrigateBtn")) $("irrigateBtn").onclick = renderIrrigationAdvice;

  // --- Reset All Button ---
  if ($("resetAll")) {
    $("resetAll").onclick = () => {
      if ($("crop")) $("crop").value = "";
      if ($("soil")) $("soil").value = "loamy";
      if ($("temp")) $("temp").value = "28";
      if ($("rain")) $("rain").value = "0";
      if ($("moisture")) { $("moisture").value = "50"; $("moistureLabel").textContent = "50%"; }
      if ($("statPlant")) $("statPlant").textContent = "Not analyzed";
      syncDashboard();
      generateCropAdvice(false);
    };
  }

  // --- AI Context & Guide ---
  function buildGuideContext(){
    return {
      crop: $("crop")?.value || "Not set",
      soil: $("soil")?.value || null,
      temperature_c: $("temp") ? Number($("temp").value) : null,
      soil_moisture_percent: $("moisture") ? Number($("moisture").value) : null,
      last_plant_result: lastPlantResult ? lastPlantResult.label : null
    };
  }

  function refreshGuideContext(){
    const holder = $("guideContextPreview");
    if (!holder) return;
    const ctx = buildGuideContext();
    holder.innerHTML = `<div class="context-row"><span>Crop</span><b>${escapeHtml(ctx.crop)}</b></div>` +
                       `<div class="context-row"><span>Moisture</span><b>${ctx.soil_moisture_percent}%</b></div>`;
  }

  function addGuideMessage(role, content){
    const log = $("guideChat");
    if (!log) return;
    const bubble = document.createElement("div");
    bubble.className = "guide-message " + (role === "user" ? "user" : "assistant");
    bubble.innerHTML = `<b>${role === "user" ? "You" : "Saathi"}</b><p>${escapeHtml(content)}</p>`;
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
  }

  async function sendGuideQuestion(override){
    if (guideBusy) return;
    const input = $("guideQuestion");
    const question = String(override || input?.value || "").trim();
    if (!question) return;
    guideBusy = true;
    if (input) input.value = "";
    addGuideMessage("user", question);

    try {
      const response = await fetch("/api/farmer-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          context: buildGuideContext(),
          history: guideMessages.slice(-8),
          language: window.currentLanguage || "en"
        })
      });
      const data = await response.json();
      addGuideMessage("assistant", data.answer || "No response received.");
      guideMessages.push({ role: "assistant", content: data.answer || "" });
    } catch(err) {
      addGuideMessage("assistant", "Farmer AI is currently unavailable.");
    } finally {
      guideBusy = false;
    }
  }

  async function runInlineAI(button){
    const target = $(button.dataset.aiTarget);
    if (!target || button.dataset.busy === "1") return;
    button.dataset.busy = "1";
    const original = button.textContent;
    button.textContent = "Preparing advice…";
    const question = String(button.dataset.aiPrompt || "Review current farm context.").trim();

    try {
      const response = await fetch("/api/farmer-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          language: window.currentLanguage || "en"
        })
      });
      const data = await response.json();
      target.textContent = data.answer || "No response received.";
    } catch(err) {
      target.textContent = "Farmer AI is unavailable right now.";
    } finally {
      button.textContent = original;
      delete button.dataset.busy;
    }
  }

  // --- Attach AI Event Listeners ---
  document.querySelectorAll("[data-ai-action]").forEach(btn => btn.addEventListener("click", () => runInlineAI(btn)));
  $("guideForm")?.addEventListener("submit", e => { e.preventDefault(); sendGuideQuestion(); });

  // --- Application Startup ---
  showPage("dashboard");
  const savedLang = localStorage.getItem("saathi_language") || "en";
  const selectElem = $("lang-select");
  if (selectElem) selectElem.value = savedLang;
  window.changeLanguage(savedLang);

  loadModels();
})();