(() => {
 const $ = id => document.getElementById(id);
 let selectedImage = null, healthModel = null, diseaseModel = null, cameraStream = null, facing = "environment", currentWeather = null;
 const confThreshold = 0.70;
 const modelStatus = (s) => $("modelStatus").textContent = s;
 function logActivity(title, detail){const log=$("activityLog");if(!log)return;const row=document.createElement("div");row.className="advice";row.innerHTML="<div class='advice-icon'>✓</div><p><b>"+escapeHtml(title)+"</b><small>"+escapeHtml(detail)+"</small></p>";if(log.firstElementChild?.textContent.includes("Dashboard started"))log.innerHTML="";log.prepend(row);while(log.children.length>5)log.lastElementChild.remove();}
 function syncDashboard(){if($("dashPlant"))$("dashPlant").textContent=$("statPlant").textContent;if($("dashWeather"))$("dashWeather").textContent=$("statWeather").textContent;if($("dashMoisture"))$("dashMoisture").textContent=$("moisture").value+"%";if($("dashCrop"))$("dashCrop").textContent=$("crop").value;}

 // Navigation
 document.querySelectorAll("[data-page]").forEach(btn => btn.addEventListener("click", () => showPage(btn.dataset.page)));
 document.querySelectorAll("[data-goto]").forEach(btn => btn.addEventListener("click", () => showPage(btn.dataset.goto)));
 function showPage(page){document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));$("page-"+page).classList.add("active");document.querySelectorAll("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));$("pageTitle").textContent=({dashboard:"Saathi Dashboard",overview:"AI Smart Agriculture",disease:"AI Crop Disease Detection",advisory:"Smart Crop Advisory",weather:"Weather & Irrigation"})[page]||"Saathi Dashboard";window.scrollTo({top:0,behavior:"smooth"});}
 $("quickSearch").addEventListener("keydown",e=>{if(e.key==="Enter"){const q=e.target.value.toLowerCase();showPage(q.includes("weather")||q.includes("water")||q.includes("irrig")?"weather":q.includes("disease")||q.includes("leaf")?"disease":q.includes("crop")||q.includes("soil")?"advisory":q.includes("overview")?"overview":"dashboard");}});
 // Image selection
 $("chooseImage").onclick=()=>$("leafInput").click();
 $("leafInput").addEventListener("change",e=>{const file=e.target.files?.[0];if(file) setImageFile(file);});
 function setImageFile(file){
   if(!file.type.startsWith("image/")){alert("Please select an image file.");return;}
   if(selectedImage?.url) URL.revokeObjectURL(selectedImage.url);
   const url=URL.createObjectURL(file);selectedImage={url,file};
   $("leafPreview").src=url;$("leafPreview").hidden=false;$("uploadPrompt").hidden=true;
   $("diseaseResult").innerHTML="<h3>Image ready</h3><p class='sub'>Click Analyze with AI to run Model 1 and, if indicated, Model 2.</p>";
 }
 $("dropZone").addEventListener("dragover",e=>{e.preventDefault();$("dropZone").style.borderColor="#16a765";});
 $("dropZone").addEventListener("dragleave",()=>{$("dropZone").style.borderColor="#8ad0a8";});
 $("dropZone").addEventListener("drop",e=>{e.preventDefault();const f=e.dataTransfer.files?.[0];if(f)setImageFile(f);});
 // Camera
 $("openCamera").onclick=async()=>{ $("cameraModal").classList.add("open"); await startCamera(); };
 async function startCamera(){
   stopCamera(); if(!navigator.mediaDevices?.getUserMedia){$("cameraStatus").textContent="This browser does not support webcam access.";return;}
   try{cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing},audio:false});$("cameraVideo").srcObject=cameraStream;$("cameraStatus").textContent="Camera ready. Position a leaf in good light.";}
   catch(err){$("cameraStatus").textContent="Could not access camera. Allow permission and use localhost or HTTPS. "+err.message;}
 }
 function stopCamera(){if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;}}
 $("closeCamera").onclick=()=>{$("cameraModal").classList.remove("open");stopCamera();};
 $("switchCamera").onclick=()=>{facing=facing==="environment"?"user":"environment";startCamera();};
 $("capturePhoto").onclick=()=>{const v=$("cameraVideo");if(!v.videoWidth){$("cameraStatus").textContent="Camera is not ready yet.";return;}const c=document.createElement("canvas");c.width=v.videoWidth;c.height=v.videoHeight;c.getContext("2d").drawImage(v,0,0);c.toBlob(blob=>{if(blob)setImageFile(new File([blob],"leaf-capture.jpg",{type:"image/jpeg"}));$("cameraModal").classList.remove("open");stopCamera();},"image/jpeg",.92);};
 // Model loading
 function normalizeUrl(url){url=url.trim();if(url&&!url.endsWith("/"))url+="/";return url;}
 $("loadModels").onclick=loadModels;
 async function loadModels(){
   const u1 = window.location.origin + "/static/model1/";
   const u2 = window.location.origin + "/static/model2/";
   $("loadModels").disabled=true;$("setupStatus").textContent="Loading both models…";
   try{
     healthModel = await tmImage.load(u1 + "model.json", u1 + "metadata.json");
     diseaseModel = await tmImage.load(u2 + "model.json", u2 + "metadata.json");
     $("setupStatus").textContent="Both models loaded successfully. Ready to analyze.";
     modelStatus("Both trained models are ready.");if($("dashModelStatus"))$("dashModelStatus").textContent="Both trained models loaded successfully.";logActivity("AI models loaded","Both Teachable Machine models are ready.");
   }catch(e){healthModel=null;diseaseModel=null;$("setupStatus").textContent="Could not load model(s). Check that each URL is a valid Teachable Machine share link and internet is available.";modelStatus("Model loading failed. Check the setup URLs.");if($("dashModelStatus"))$("dashModelStatus").textContent="Could not load models; check the URLs and internet connection.";}
   finally{$("loadModels").disabled=false;}
 }
 async function predict(model,img){const p=await model.predict(img);return p.sort((a,b)=>b.probability-a.probability);}
 $("analyzeBtn").onclick=async()=>{
   if(!selectedImage){$("diseaseResult").innerHTML="<h3>No image selected</h3><p class='sub'>Upload an image or capture one with the webcam first.</p>";return;}
   if(!healthModel||!diseaseModel){$("diseaseResult").innerHTML="<h3>Models not ready</h3><p class='sub'>Paste both Teachable Machine model URLs in Model Setup, then click Load Models.</p>";return;}
   $("analyzeBtn").disabled=true;$("diseaseResult").innerHTML="<h3>Analyzing…</h3><p class='sub'>Running the first model.</p>";
   try{
     const img=new Image();img.src=selectedImage.url;await img.decode();
     const p1=await predict(healthModel,img);const top=p1[0];const healthyLabel=$("healthyClass").value.trim().toLowerCase();const unhealthyLabel=$("unhealthyClass").value.trim().toLowerCase();
     const isHealthy=top.className.trim().toLowerCase()===healthyLabel;
     const isUnhealthy=top.className.trim().toLowerCase()===unhealthyLabel;
     let html="";
     if(top.probability<confThreshold){html="<h3>⚠️ Uncertain health result</h3><p class='sub'>Model 1 is not confident enough to continue automatically.</p>"+predictionRows(p1);}
     else if(isHealthy){html="<h3>🌿 Model 1: "+escapeHtml(top.className)+"</h3><p class='sub'>The first model classified this leaf as healthy. Model 2 was not run.</p>"+predictionRows(p1);}
     else if(isUnhealthy){
       html="<h3>⚠️ Model 1: "+escapeHtml(top.className)+"</h3><p class='sub'>Running Model 2 to identify a possible disease category…</p>";$("diseaseResult").innerHTML=html;
       const p2=await predict(diseaseModel,img);const d=p2[0];
       html="<h3>🔎 Possible category: "+escapeHtml(d.className)+"</h3><p class='sub'>Model 1 detected an unhealthy class; Model 2 predicted this category.</p>"+predictionRows(p1,"Model 1 · health") + predictionRows(p2,"Model 2 · disease")+"<div class='notice'>This is an image-model prediction, not a confirmed diagnosis. Do not choose treatment based on this result alone.</div>";
     }else{html="<h3>⚠️ Class name mismatch</h3><p class='sub'>Model 1 predicted '"+escapeHtml(top.className)+"'. Update the exact healthy and unhealthy labels in Model Setup.</p>"+predictionRows(p1);}
     $("diseaseResult").innerHTML=html;$("statPlant").textContent=top.className;syncDashboard();logActivity("Leaf image analyzed", "Model 1 result: "+top.className);
   }catch(e){$("diseaseResult").innerHTML="<h3>Prediction error</h3><p class='sub'>Could not analyze the image. Check model URLs, internet and image file.</p>";}
   finally{$("analyzeBtn").disabled=false;}
 };
 function predictionRows(ps,title){let h=title?"<div class='result-line'><b>"+escapeHtml(title)+"</b><span>Confidence</span></div>":"";ps.slice(0,Math.min(4,ps.length)).forEach(p=>{const pct=(p.probability*100);h+="<div class='result-line'><span>"+escapeHtml(p.className)+"</span><b>"+pct.toFixed(1)+"%</b></div><div class='meter'><span style='width:"+Math.max(0,Math.min(100,pct))+"%'></span></div>";});return h;}
 function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
 // Weather is requested through Flask so the API key remains server-side.
 $("getWeather").onclick=fetchWeather;
 async function fetchWeather(){
   const city=$("city").value.trim();if(!city){$("weatherStatus").textContent="Enter a city or town.";return;}
   $("getWeather").disabled=true;$("weatherStatus").textContent="Fetching current weather through Flask…";
   try{
     const response=await fetch("/api/weather?city="+encodeURIComponent(city));
     const data=await response.json();
     if(!response.ok)throw new Error(data.error||"Weather request failed");
     currentWeather=data;
     renderWeather(data);
     $("weatherStatus").textContent="Updated from OpenWeather • "+(data.current.observed_at||"current conditions");
     $("statWeather").textContent=Math.round(data.current.temp)+"°C";
     $("statLocation").textContent=data.location.name+(data.location.state?", "+data.location.state:"");
     $("irrigationRain").value=Number(data.rain_next_24h_mm||0).toFixed(1);
     $("rain").value=Number(data.rain_1h_mm||0).toFixed(1);
     $("temp").value=data.current.temp;
     $("getAdvice").click();$("irrigateBtn").click();
     if($("dashApiStatus"))$("dashApiStatus").textContent="Connected to Flask backend; current weather loaded for "+data.location.name+".";
     syncDashboard();logActivity("Weather updated",data.location.name+": "+Math.round(data.current.temp)+"°C");
   }catch(e){
     $("weatherStatus").textContent="Weather unavailable: "+e.message+" Check the Flask server, API key configuration and internet.";
     if($("dashApiStatus"))$("dashApiStatus").textContent="Weather service unavailable. Check Flask server and API key.";
   }finally{$("getWeather").disabled=false;}
 }
 function weatherDescription(text){return text||"Current conditions";}
 function renderWeather(d){
   const c=d.current;
   $("weatherDisplay").innerHTML="<div class='weather-row'><div><div class='sub'>"+escapeHtml(d.location.name+(d.location.country?", "+d.location.country:""))+"</div><div class='weather-temp'>"+Math.round(c.temp)+"°C</div><div class='sub'>"+escapeHtml(weatherDescription(c.description))+"</div></div><div style='font-size:42px'>"+escapeHtml(c.icon_emoji||"🌦️")+"</div></div><div class='weather-metrics'><div class='weather-metric'><small>Humidity</small><b>"+c.humidity+"%</b></div><div class='weather-metric'><small>Rain (last hour)</small><b>"+Number(d.rain_1h_mm||0).toFixed(1)+" mm</b></div><div class='weather-metric'><small>Wind</small><b>"+Number(c.wind_speed_kmh||0).toFixed(1)+" km/h</b></div><div class='weather-metric'><small>Forecast rain (next 24h)</small><b>"+Number(d.rain_next_24h_mm||0).toFixed(1)+" mm</b></div><div class='weather-metric'><small>Weather source</small><b>OpenWeather</b></div><div class='weather-metric'><small>Updated</small><b>"+escapeHtml(c.observed_at||"Now")+"</b></div></div>";
 }
 // Rule-based crop advice
 $("getAdvice").onclick=()=>{
   const crop=$("crop").value,soil=$("soil").value,temp=Number($("temp").value),rain=Number($("rain").value);
   const a=[];
   if(!Number.isFinite(temp)||!Number.isFinite(rain)||$("temp").value===""||$("rain").value===""){ $("cropAdvice").innerHTML="<div class='advice'><div class='advice-icon'>⚠️</div><p>Please enter valid temperature and rainfall values.</p></div>";return;}
   if(temp>=35)a.push(["🌡️","High temperature entered","Check crop heat stress and local advisories; irrigation timing depends on crop and soil."]);
   else if(temp<=10)a.push(["❄️","Cool conditions entered","Check the crop's temperature requirements and local frost/cold warnings."]);
   else a.push(["🌤️","Moderate temperature entered","Compare the temperature with the selected crop's local growing requirements."]);
   if(rain>=20)a.push(["🌧️","Recent rainfall is high in this scenario","Check drainage and soil saturation before irrigation."]);
   else if(rain<=2)a.push(["💧","Little recent rainfall entered","Inspect actual soil moisture; rainfall alone cannot determine watering needs."]);
   else a.push(["🌦️","Some recent rainfall entered","Consider soil type and field moisture before the next irrigation."]);
   const soilAdvice={loamy:"Loamy soil often balances drainage and water retention; check actual field conditions.",clay:"Clay soil can hold water longer; avoid assuming the surface appearance reflects root-zone moisture.",sandy:"Sandy soil often drains faster; monitor moisture more frequently.",silty:"Silty soil may retain moisture; check drainage and field conditions.",unknown:"If soil type is unknown, observe the field or seek a local soil test."};
   a.push(["🌱",crop+" • "+soil+" soil",soilAdvice[soil]]);
   $("cropAdvice").innerHTML=a.map(x=>"<div class='advice'><div class='advice-icon'>"+x[0]+"</div><p><b>"+escapeHtml(x[1])+"</b><small>"+escapeHtml(x[2])+"</small></p></div>").join("");
   $("statCrop").textContent=crop;syncDashboard();logActivity("Crop advice generated",crop+" with "+soil+" soil inputs.");
 };
 // Irrigation simulator
 $("moisture").addEventListener("input",()=>{$("moistureLabel").textContent=$("moisture").value+"%";$("statMoisture").textContent=$("moisture").value+"%";syncDashboard();});
 $("irrigateBtn").onclick=()=>{
   const m=Number($("moisture").value),rain=Number($("irrigationRain").value),stage=$("stage").value;let title,body,icon;
   if(rain>=10){title="Check before irrigating";body="The entered forecast suggests meaningful rainfall. Verify the local forecast and root-zone soil moisture before deciding to water.";icon="🌧️";}
   else if(m<30){title="Soil marked dry";body="Check the crop's root-zone moisture and stage. Irrigation may be needed, but confirm with actual field conditions and local guidance.";icon="💧";}
   else if(m<60){title="Monitor soil moisture";body="Recheck the soil and crop condition soon. Whether to irrigate depends on crop, growth stage, soil and local weather.";icon="🌱";}
   else{title="Watering may not be needed now";body="The simulated moisture is relatively high. Check drainage and actual root-zone moisture before adding water.";icon="✅";}
   if(stage==="flowering")body+=" Flowering/fruiting can be a sensitive stage for some crops; avoid water stress and follow crop-specific advice.";
   $("irrigationResult").innerHTML="<h3>"+icon+" "+title+"</h3><p>"+escapeHtml(body)+"</p><p class='sub'>Demo inputs: "+m+"% simulated moisture • "+rain+" mm forecast rain • "+escapeHtml(stage)+" stage.</p>";syncDashboard();logActivity("Irrigation advice checked",title);
 };
 $("resetAll").onclick=()=>{ $("crop").value="Tomato";$("soil").value="loamy";$("temp").value=28;$("rain").value=0;$("moisture").value=50;$("moistureLabel").textContent="50%";$("statMoisture").textContent="50%";$("irrigationRain").value=0;$("stage").value="growth";$("city").value="New Delhi";$("cropAdvice").innerHTML="<div class='advice'><div class='advice-icon'>🌱</div><p>Inputs reset. Generate advice when ready.</p></div>";$("irrigationResult").innerHTML="<h3>Recommendation pending</h3><p class='sub'>Adjust the simulated value, then check the advice.</p>";};
 // Initial demo calculations use sample values only.
 $("getAdvice").click();$("irrigateBtn").click();syncDashboard();showPage("dashboard");
})();
window.addEventListener("DOMContentLoaded", () => {
  loadModels();
});
// --- Connect Header Search Bar to Gemini Backend ---
document.addEventListener("DOMContentLoaded", () => {
  // Select the top search input
  const aiSearchInput = document.querySelector('input[placeholder*="Ask AI"]');

  if (!aiSearchInput) {
    console.warn("AI search input bar not found in DOM.");
    return;
  }

  aiSearchInput.addEventListener("keydown", async (event) => {
    // Trigger on Enter key
    if (event.key === "Enter") {
      event.preventDefault();
      const question = aiSearchInput.value.trim();

      if (!question) return;

      const originalPlaceholder = aiSearchInput.placeholder;
      aiSearchInput.disabled = true;
      aiSearchInput.value = "";
      aiSearchInput.placeholder = "Saathi AI is thinking...";

      try {
        const response = await fetch("/api/ask-ai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: question }),
        });

        const data = await response.json();

        if (response.ok && data.answer) {
          // Display the response (using browser alert or custom UI popup)
          alert(`🌾 Saathi AI Advisory:\n\n${data.answer}`);
        } else {
          alert(`⚠️ Advisory Notice: ${data.error || "Unable to retrieve advice."}`);
        }
      } catch (err) {
        alert(`❌ Connection error: ${err.message}`);
      } finally {
        aiSearchInput.disabled = false;
        aiSearchInput.placeholder = originalPlaceholder;
        aiSearchInput.focus();
      }
    }
  });
});