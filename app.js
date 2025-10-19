// ===================== KIOSK APP (clock + weather + MQTT screens) =====================
// Screens chosen by MQTT topic; payloads are plain strings (filenames/text).
// Topics:
//   display/screen/standby       -> go to standby (payload ignored)
//   display/screen/image         -> payload = "filename.png" from images path
//   display/screen/video         -> payload = "filename.mp4" from videos path
//   display/banner               -> payload = "Text to show"  (JSON also supported)
//   display/clear                -> hide banner & return to standby
//   display/frame                -> payload = "filename.png" from frames path (or JSON {file,fit,opacity})
//   display/frame/clear          -> hide frame overlay
//   display/ticker               -> payload = "text to show" (JSON also supported) [IF ENABLED]
//   display/ticker/clear         -> hide ticker bar [IF ENABLED]
// --------------------------------------------------------------------------------------

// ---------- Load config.json ----------
let CFG = {};
async function loadConfig() {
  const res = await fetch('./config.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('config.json not found');
  CFG = await res.json();
  
  // Set default paths if not configured
  CFG.media_paths = CFG.media_paths || {
    images: "./images/",
    videos: "./videos/",
    frames: "./frames/"
  };
  
  // Set default file validation
  CFG.file_validation = CFG.file_validation || {
    enabled: false,
    allowed_extensions: {
      images: [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      videos: [".mp4", ".webm", ".ogg"],
      frames: [".png", ".jpg", ".jpeg", ".gif", ".webp"]
    }
  };
  
  // Set default cache busting
  CFG.cache_busting = CFG.cache_busting || {
    enabled: true,
    media_files: true,
    static_files: false
  };
  
  // Set default media validation
  CFG.media_validation = CFG.media_validation || {
    enabled: false,
    check_file_exists: false,
    ignore_missing_files: true
  };
}
const px = n => `${(n | 0)}px`;

// ---------- UI refs ----------
const sectStandby = document.getElementById('standby');
const sectImage   = document.getElementById('image');
const sectVideo   = document.getElementById('video');

const rightPane   = document.getElementById('right');
const rightVideo  = document.getElementById('right_video');

const imgPane     = document.getElementById('imgpane');
const vidPane     = document.getElementById('vidpane');

const overlay     = document.getElementById('overlay');
const obadge      = document.getElementById('obadge');
const otitle      = document.getElementById('otitle');
const obody       = document.getElementById('obody');

// New status bar refs
const mqttStatEl   = document.getElementById('mqttStatus');
const mqttStatText = document.getElementById('mqttStatText');
const weatherStatEl   = document.getElementById('weatherStatus');
const weatherStatText = document.getElementById('weatherStatText');

const clk1 = document.getElementById('clock_standby');
const clk2 = document.getElementById('clock_image');
const clk3 = document.getElementById('clock_video');

// Ticker refs (TV style)
const ticker       = document.getElementById('ticker');
const tickerText   = document.getElementById('tickerText');
const tickerTextDup= document.getElementById('tickerTextDup');

// ---- Frame overlay refs ----
const frameLayer = document.getElementById('frameLayer');
const frameImg   = document.getElementById('frameImg');

// ---------- Clock ----------
function tick() {
  const now = new Date();
  const txt = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  clk1.textContent = txt;
  clk2.textContent = txt;
  clk3.textContent = txt;
}
setInterval(tick, 1000);
tick();

// ---------- Icons for weather ----------
const icons = {
  sunny:`<circle cx="32" cy="32" r="12" fill="#FFD54F"/><g stroke="#FFD54F" stroke-width="4" stroke-linecap="round"><line x1="32" y1="4" x2="32" y2="16"/><line x1="32" y1="48" x2="32" y2="60"/><line x1="4" y1="32" x2="16" y2="32"/><line x1="48" y1="32" x2="60" y2="32"/><line x1="12" y1="12" x2="20" y2="20"/><line x1="44" y1="44" x2="52" y2="52"/><line x1="44" y1="20" x2="52" y2="12"/><line x1="12" y1="52" x2="20" y2="44"/></g>`,
  partly:`<circle cx="24" cy="22" r="10" fill="#FFD54F"/><path d="M18 40h24a10 10 0 0 0 0-20 14 14 0 0 0-27 4" fill="#B0BEC5"/><path d="M20 46h28a8 8 0 0 0 0-16" fill="#CFD8DC"/>`,
  cloudy:`<ellipse cx="26" cy="36" rx="14" ry="10" fill="#B0BEC5"/><ellipse cx="40" cy="36" rx="12" ry="9" fill="#CFD8DC"/>`,
  rain:`<ellipse cx="26" cy="30" rx="14" ry="10" fill="#B0BEC5"/><ellipse cx="40" cy="30" rx="12" ry="9" fill="#CFD8DC"/><g stroke="#00B0FF" stroke-width="4" stroke-linecap="round"><line x1="22" y1="44" x2="18" y2="56"/><line x1="32" y1="44" x2="28" y2="56"/><line x1="42" y1="44" x2="38" y2="56"/></g>`,
  storm:`<ellipse cx="26" cy="30" rx="14" ry="10" fill="#B0BEC5"/><ellipse cx="40" cy="30" rx="12" ry="9" fill="#CFD8DC"/><polygon points="30,40 22,56 32,52 26,64 42,46 32,50 38,40" fill="#FFEE58"/>`,
  snow:`<ellipse cx="26" cy="30" rx="14" ry="10" fill="#B0BEC5"/><ellipse cx="40" cy="30" rx="12" ry="9" fill="#CFD8DC"/><g stroke="#E0F7FA" stroke-width="3" stroke-linecap="round"><line x1="24" y1="44" x2="24" y2="56"/><line x1="20" y1="48" x2="28" y2="52"/><line x1="28" y1="48" x2="20" y2="52"/><line x1="36" y1="44" x2="36" y2="56"/><line x1="32" y1="48" x2="40" y2="52"/><line x1="40" y1="48" x2="32" y2="52"/></g>`,
  fog:`<rect x="8" y="24" width="48" height="6" fill="#B0BEC5"/><rect x="10" y="34" width="44" height="6" fill="#CFD8DC"/><rect x="6" y="44" width="52" height="6" fill="#90A4AE"/>`,
  wind:`<path d="M10 28h28a6 6 0 1 0-6-6" stroke="#B0BEC5" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M16 40h32a6 6 0 1 1-6 6" stroke="#CFD8DC" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  night:`<circle cx="28" cy="28" r="14" fill="#FFF59D"/><circle cx="36" cy="28" r="12" fill="#000"/>`,
  hail:`<ellipse cx="26" cy="30" rx="14" ry="10" fill="#B0BEC5"/><ellipse cx="40" cy="30" rx="12" ry="9" fill="#CFD8DC"/><g fill="#E0F7FA"><circle cx="20" cy="50" r="3"/><circle cx="30" cy="52" r="3"/><circle cx="40" cy="50" r="3"/></g>`
};
function pickIcon(s){
  s=(s||"").toLowerCase();
  if(s.includes("thunder")||s.includes("lightning"))return"storm";
  if(s.includes("rain")||s.includes("shower")||s.includes("pour"))return"rain";
  if(s.includes("snow"))return"snow";
  if(s.includes("hail"))return"hail";
  if(s.includes("fog")||s.includes("mist"))return"fog";
  if(s.includes("wind"))return"wind";
  if(s.includes("clear")&&s.includes("night"))return"night";
  if(s.includes("clear")||s.includes("sun"))return"sunny";
  if(s.includes("partly")||s.includes("few")||s.includes("broken"))return"partly";
  if(s.includes("cloud"))return"cloudy";
  return"cloudy";
}
function setIcon(svgEl, name){ svgEl.innerHTML = icons[name] || icons.cloudy; }

// ---------- Weather ----------
async function fetchWeather(){
  try{
    const r = await fetch(`${CFG.HA_BASE}/api/states/${CFG.WEATHER_ENTITY}`, {
      headers:{ Authorization:`Bearer ${CFG.HA_TOKEN}`, Accept:'application/json' }
    });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json(), a = d.attributes||{};
    const condRaw=(d.state||"").replace(/_/g," ");
    const cond = condRaw ? condRaw[0].toUpperCase()+condRaw.slice(1) : "—";
    const temp = Math.round(a.temperature ?? a.native_temperature ?? NaN);
    const unit = a.temperature_unit ?? a.native_temperature_unit ?? "°C";
    const hum  = a.humidity!=null?`${a.humidity}%`:null;

    // standby
    document.getElementById('wcond').textContent  = cond;
    document.getElementById('wtemp').textContent  = Number.isFinite(temp)?`${temp}${unit}`:`--${unit}`;
    document.getElementById('wmeta').textContent  = hum?`Humidity ${hum}`:"";
    setIcon(document.getElementById('wicon'), pickIcon(condRaw));

    // image
    document.getElementById('wcond2').textContent = cond;
    document.getElementById('wtemp2').textContent = Number.isFinite(temp)?`${temp}${unit}`:`--${unit}`;
    setIcon(document.getElementById('wicon2'), pickIcon(condRaw));

    // video
    document.getElementById('wcond3').textContent = cond;
    document.getElementById('wtemp3').textContent = Number.isFinite(temp)?`${temp}${unit}`:`--${unit}`;
    setIcon(document.getElementById('wicon3'), pickIcon(condRaw));

    setWeatherStatus('ok', `Weather OK @ ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
  }catch(e){
    setWeatherStatus('err', `Weather error: ${e.message}`);
  }
}
setInterval(fetchWeather, 60_000);

// ---------- Status ----------
// New functions for specific status updates
function setMqttStatus(level,text){
  mqttStatEl.className=`status ${level}`;
  mqttStatEl.innerHTML=`<span class="dot ${level}"></span><span>MQTT: ${text}</span>`;
}

function setWeatherStatus(level,text){
  weatherStatEl.className=`status ${level}`;
  weatherStatEl.innerHTML=`<span class="dot ${level}"></span><span>${text}</span>`;
}

// ---------- File Validation & Helpers ----------
function sanitizeFile(name){
  return (name||'').replace(/[^a-zA-Z0-9._-]/g,'').slice(0,128);
}

function validateFileExtension(filename, mediaType) {
  if (!CFG.file_validation?.enabled) return true;
  
  const ext = filename.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
  const allowedExts = CFG.file_validation.allowed_extensions?.[mediaType] || [];
  
  if (allowedExts.length === 0) return true; // No restrictions if no extensions defined
  return allowedExts.includes(ext);
}

function getCacheBuster(forMediaFile = true) {
  if (!CFG.cache_busting?.enabled) return '';
  
  if (forMediaFile && !CFG.cache_busting?.media_files) return '';
  if (!forMediaFile && !CFG.cache_busting?.static_files) return '';
  
  return `?v=${Date.now()}`;
}

function buildMediaUrl(mediaType, filename) {
  const basePath = CFG.media_paths?.[mediaType] || `'./${mediaType}/`;
  const cacheBuster = getCacheBuster(true);
  return `${basePath}${filename}${cacheBuster}`;
}

// Check if media file exists
async function checkFileExists(url) {
  try {
    // Remove cache buster for existence check to avoid unnecessary requests
    const checkUrl = url.replace(/\?v=\d+$/, '');
    const response = await fetch(checkUrl, { 
      method: 'HEAD',
      cache: 'no-cache'
    });
    return response.ok;
  } catch (error) {
    console.warn(`File check failed for ${url}:`, error);
    return false;
  }
}

let revertTimer = null;
function clearRevert(){ clearTimeout(revertTimer); revertTimer=null; }

function hideAll(){
  sectStandby.style.display='none'; sectStandby.setAttribute('aria-hidden','true');
  sectImage.style.display='none';   sectImage.setAttribute('aria-hidden','true');
  sectVideo.style.display='none';   sectVideo.setAttribute('aria-hidden','true');
  if (frameLayer) frameLayer.style.display='none';
  overlay.classList.remove('show');
  try{ vidPane.pause(); }catch{}
}

// ---- Frame controls ----
function applyFrameOptions({fit, opacity}={}){
  const defFit = CFG.frame?.fit || 'contain';
  const defOp  = (CFG.frame?.opacity ?? 1.0);
  frameImg.style.objectFit = (fit==='cover'||fit==='contain') ? fit : defFit;
  const op = Number.isFinite(opacity) ? opacity : defOp;
  frameImg.style.opacity = String(Math.max(0, Math.min(1, op)));
}

function showFrame(params){
  let file='', fit, opacity;
  if (typeof params === 'string') {
    file = params.trim();
  } else if (params && typeof params === 'object') {
    file    = params.file || params.name || params.filename || '';
    fit     = params.fit;
    opacity = params.opacity;
  }
  
  const fn = sanitizeFile(file);
  if (!fn) { 
    setWeatherStatus('err','FRAME: missing file'); 
    return; 
  }

  // Validate file extension
  if (!validateFileExtension(fn, 'frames')) {
    const allowedExts = CFG.file_validation.allowed_extensions?.frames || [];
    setWeatherStatus('err', `FRAME: invalid file type. Allowed: ${allowedExts.join(', ')}`);
    return;
  }

  const mediaUrl = buildMediaUrl('frames', fn);
  
  // Check if file exists before displaying
  if (CFG.media_validation?.enabled && CFG.media_validation?.check_file_exists) {
    checkFileExists(mediaUrl).then(exists => {
      if (!exists) {
        setWeatherStatus('warn', `FRAME: file not found: ${fn}`);
        return; // Stay on current screen, don't change display
      }
      
      // File exists, proceed with display
      applyFrameOptions({fit, opacity});
      frameImg.src = mediaUrl;
      frameLayer.style.display = 'block';
      setWeatherStatus('ok', `Frame: ${fn}`);
    }).catch(error => {
      setWeatherStatus('err', `FRAME: error checking file: ${error.message}`);
      return; // Stay on current screen
    });
  } else {
    // Skip file check, display directly
    applyFrameOptions({fit, opacity});
    frameImg.src = mediaUrl;
    frameLayer.style.display = 'block';
    setWeatherStatus('ok', `Frame: ${fn}`);
  }
}

function clearFrame(){
  frameLayer.style.display = 'none';
  frameImg.removeAttribute('src');
  setWeatherStatus('ok', 'Frame cleared');
}

// ---------- Screens ----------
function showStandby(){
  clearRevert(); hideAll();
  sectStandby.style.display='flex'; sectStandby.setAttribute('aria-hidden','false');
  document.getElementById('clock_standby').style.fontSize = px(CFG.standby?.clock_size_px ?? 220);
  document.querySelector('#standby .cond').style.fontSize = px(CFG.standby?.weather_cond_size_px ?? 56);
  document.querySelector('#standby .temp').style.fontSize = px(CFG.standby?.weather_temp_size_px ?? 110);
  setWeatherStatus('ok','Screen: STANDBY');
}

function showImage(params){
  const fn = sanitizeFile(params.file||params.filename||params.name||'');
  if(!fn){ 
    setWeatherStatus('err','IMAGE: missing file'); 
    return; 
  }

  // Validate file extension
  if (!validateFileExtension(fn, 'images')) {
    const allowedExts = CFG.file_validation.allowed_extensions?.images || [];
    setWeatherStatus('err', `IMAGE: invalid file type. Allowed: ${allowedExts.join(', ')}`);
    return;
  }

  const mediaUrl = buildMediaUrl('images', fn);
  
  // Check if file exists before displaying
  if (CFG.media_validation?.enabled && CFG.media_validation?.check_file_exists) {
    checkFileExists(mediaUrl).then(exists => {
      if (!exists) {
        setWeatherStatus('warn', `IMAGE: file not found: ${fn}`);
        return; // Stay on current screen, don't change display
      }
      
      // File exists, proceed with display
      clearRevert(); hideAll();
      sectImage.style.display='flex'; sectImage.setAttribute('aria-hidden','false');
      document.getElementById('clock_image').style.fontSize = px(CFG.image?.clock_size_px ?? 180);
      rightPane.style.width = px(CFG.image?.right_width_px ?? 900);
      
      imgPane.src = mediaUrl;
      setWeatherStatus('ok',`Screen: IMAGE (${fn})`);
      
      if (Number.isFinite(params.duration) && params.duration>0){
        revertTimer = setTimeout(showStandby, params.duration*1000);
      }
    }).catch(error => {
      setWeatherStatus('err', `IMAGE: error checking file: ${error.message}`);
      return; // Stay on current screen
    });
  } else {
    // Skip file check, display directly
    clearRevert(); hideAll();
    sectImage.style.display='flex'; sectImage.setAttribute('aria-hidden','false');
    document.getElementById('clock_image').style.fontSize = px(CFG.image?.clock_size_px ?? 180);
    rightPane.style.width = px(CFG.image?.right_width_px ?? 900);
    
    imgPane.src = mediaUrl;
    setWeatherStatus('ok',`Screen: IMAGE (${fn})`);
    
    if (Number.isFinite(params.duration) && params.duration>0){
      revertTimer = setTimeout(showStandby, params.duration*1000);
    }
  }
}

function showVideo(params){
  const fn = sanitizeFile(params.file||params.filename||params.name||'');
  if(!fn){ 
    setWeatherStatus('err','VIDEO: missing file'); 
    return; 
  }

  // Validate file extension
  if (!validateFileExtension(fn, 'videos')) {
    const allowedExts = CFG.file_validation.allowed_extensions?.videos || [];
    setWeatherStatus('err', `VIDEO: invalid file type. Allowed: ${allowedExts.join(', ')}`);
    return;
  }

  const mediaUrl = buildMediaUrl('videos', fn);
  
  // Check if file exists before displaying
  if (CFG.media_validation?.enabled && CFG.media_validation?.check_file_exists) {
    checkFileExists(mediaUrl).then(exists => {
      if (!exists) {
        setWeatherStatus('warn', `VIDEO: file not found: ${fn}`);
        return; // Stay on current screen, don't change display
      }
      
      // File exists, proceed with display
      clearRevert(); hideAll();
      sectVideo.style.display='flex'; sectVideo.setAttribute('aria-hidden','false');
      document.getElementById('clock_video').style.fontSize = px(CFG.video?.clock_size_px ?? 200);
      rightVideo.style.width = px(CFG.video?.right_width_px ?? 900);

      vidPane.muted      = (CFG.video?.muted ?? true);
      vidPane.autoplay = (CFG.video?.autoplay ?? true);
      vidPane.loop     = (CFG.video?.loop ?? true);
      vidPane.controls = (CFG.video?.controls ?? false);
      
      try{ vidPane.pause(); }catch{}
      vidPane.src = mediaUrl;
      vidPane.load();
      const p = vidPane.play?.();
      if (p && typeof p.then==='function') p.catch(()=>{ /* ignore autoplay block */ });

      setWeatherStatus('ok',`Screen: VIDEO (${fn})`);
      if (Number.isFinite(params.duration) && params.duration>0){
        revertTimer = setTimeout(showStandby, params.duration*1000);
      }
    }).catch(error => {
      setWeatherStatus('err', `VIDEO: error checking file: ${error.message}`);
      return; // Stay on current screen
    });
  } else {
    // Skip file check, display directly
    clearRevert(); hideAll();
    sectVideo.style.display='flex'; sectVideo.setAttribute('aria-hidden','false');
    document.getElementById('clock_video').style.fontSize = px(CFG.video?.clock_size_px ?? 200);
    rightVideo.style.width = px(CFG.video?.right_width_px ?? 900);

    vidPane.muted      = (CFG.video?.muted ?? true);
    vidPane.autoplay = (CFG.video?.autoplay ?? true);
    vidPane.loop     = (CFG.video?.loop ?? true);
    vidPane.controls = (CFG.video?.controls ?? false);
    
    try{ vidPane.pause(); }catch{}
    vidPane.src = mediaUrl;
    vidPane.load();
    const p = vidPane.play?.();
    if (p && typeof p.then==='function') p.catch(()=>{ /* ignore autoplay block */ });

    setWeatherStatus('ok',`Screen: VIDEO (${fn})`);
    if (Number.isFinite(params.duration) && params.duration>0){
      revertTimer = setTimeout(showStandby, params.duration*1000);
    }
  }
}

// ---------- Ticker (TV style) - WITH ENABLE/DISABLE CHECK ----------
function showTicker(text, speedPxPerSec = 120) {
  // Check if ticker is disabled in config
  if (!CFG.ticker_enabled) {
    setWeatherStatus('warn', 'Ticker disabled in config');
    return;
  }

  const msg = (text || '').toString().trim();
  if (!msg) { clearTicker(); return; }

  // Headline in both tracks (seamless loop)
  tickerText.textContent    = ` ${msg} `;
  tickerTextDup.textContent = ` ${msg} `;

  // Duration ~ based on text length
  const len = Math.max(1, tickerText.textContent.length);
  const pxPerChar = 16; // bold 34px ~ rough width/char
  const totalPx   = len * pxPerChar + window.innerWidth;
  const secs      = Math.max(10, Math.round(totalPx / (speedPxPerSec || 120)));

  // Random direction each time
  const dirClass = (Math.random() < 0.5) ? 'dir-left' : 'dir-right';
  ticker.classList.remove('dir-left','dir-right');
  ticker.classList.add(dirClass);

  // Push CSS var for animation duration
  tickerText.style.setProperty('--dur', `${secs}s`);
  tickerTextDup.style.setProperty('--dur', `${secs}s`);

  // start positions so they loop seamlessly
  tickerText.style.left      = '0%';
  tickerTextDup.style.left = '100%';

  // show + lift status bar
  ticker.style.display = 'block';
  const h = getComputedStyle(document.documentElement).getPropertyValue('--ticker-h').trim() || '70px';
  document.querySelector('.status-group').style.bottom = h;
}

function clearTicker() {
  // Always allow clearing, even if disabled
  ticker.style.display = 'none';
  tickerText.textContent = '';
  tickerTextDup.textContent = '';
  document.querySelector('.status-group').style.bottom = '0';
}

// ---------- Banner ----------
function hexToRgba(hex, a){
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)||[];
  const r=parseInt(m[1]||"00",16), g=parseInt(m[2]||"00",16), b=parseInt(m[3]||"00",16);
  return `rgba(${r},${g},${b},${a})`;
}
function showBanner({title="Announcement", body="", color="#00d1ff", icon="★", duration=6}={}){
  obadge.textContent=icon; otitle.textContent=title; obody.textContent=body;
  overlay.style.background = `linear-gradient(90deg, ${hexToRgba(color,.25)}, ${hexToRgba(color,.4)})`;
  overlay.classList.remove('show'); void overlay.offsetWidth; overlay.classList.add('show');
  setTimeout(()=>overlay.classList.remove('show'), (Number.isFinite(duration)?duration:6)*1000);
}

// ---------- MQTT ----------
let client;
function mqttConnect(){
  const id = "display-" + Math.random().toString(16).slice(2);
  client = mqtt.connect(CFG.MQTT_URL, {
    username: CFG.MQTT_USER, password: CFG.MQTT_PASS,
    keepalive: 30, reconnectPeriod: 3000, clientId: id, clean: true
  });

  client.on('connect', ()=>{
    setMqttStatus('ok','Connected');
    client.subscribe('display/screen/standby');
    client.subscribe('display/screen/image');
    client.subscribe('display/screen/video');
    client.subscribe('display/banner');
    client.subscribe('display/clear');
    client.subscribe('display/frame');
    client.subscribe('display/frame/clear');
    
    // Only subscribe to ticker topics if enabled
    if (CFG.ticker_enabled) {
      client.subscribe('display/ticker');
      client.subscribe('display/ticker/clear');
      setMqttStatus('ok','Connected (ticker enabled)');
    } else {
      setMqttStatus('ok','Connected (ticker disabled)');
    }
  });
  client.on('reconnect', ()=> setMqttStatus('warn','Reconnecting…'));
  client.on('close', ()=> setMqttStatus('err','Disconnected'));
  client.on('error', e=> setMqttStatus('err', `Error: ${e.message}`));

  client.on('message', (topic, payload)=>{
    const text = new TextDecoder().decode(payload || new Uint8Array()).trim();

    if (topic === 'display/clear') { overlay.classList.remove('show'); showStandby(); return; }
    if (topic === 'display/screen/standby') { showStandby(); return; }

    if (topic === 'display/screen/image') {
      if (text.startsWith('{')) { try { showImage(JSON.parse(text)||{}); } catch { showImage({file:text}); } }
      else { showImage({ file: text }); }
      return;
    }

    if (topic === 'display/screen/video') {
      if (text.startsWith('{')) { try { showVideo(JSON.parse(text)||{}); } catch { showVideo({file:text}); } }
      else { showVideo({ file: text }); }
      return;
    }

    if (topic === 'display/banner') {
      if (text.startsWith('{')) { try { showBanner(JSON.parse(text)||{}); } catch { showBanner({ title:text }); } }
      else { showBanner({ title: text }); }
      return;
    }

    if (topic === 'display/frame/clear') { clearFrame(); return; }
    if (topic === 'display/frame') {
      if (text.startsWith('{')) { try { showFrame(JSON.parse(text)||{}); } catch {} }
      else { showFrame(text); }
      return;
    }

    // Ticker topics - only process if enabled
    if (topic === 'display/ticker/clear') { 
      clearTicker(); 
      return; 
    }
    if (topic === 'display/ticker') {
      if (!CFG.ticker_enabled) {
        setWeatherStatus('warn', 'Ticker message ignored (disabled)');
        return;
      }
      
      if (text.startsWith('{')) {
        try { const o = JSON.parse(text)||{}; showTicker(o.text || '', Number(o.speed) || 120); }
        catch { showTicker(text); }
      } else {
        showTicker(text);
      }
      return;
    }
  });
}

// ---------- Boot ----------
(async function boot(){
  try{
    await loadConfig();

    // Log configuration status for debugging
    console.log(`Ticker functionality: ${CFG.ticker_enabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`File validation: ${CFG.file_validation?.enabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`Media validation: ${CFG.media_validation?.enabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`Cache busting: ${CFG.cache_busting?.enabled ? 'ENABLED' : 'DISABLED'}`);
    console.log('Media paths:', CFG.media_paths);

    // initial sizing
    document.getElementById('clock_standby').style.fontSize = px(CFG.standby?.clock_size_px ?? 220);
    document.getElementById('clock_image').style.fontSize   = px(CFG.image?.clock_size_px ?? 180);
    rightPane.style.width = px(CFG.image?.right_width_px ?? 900);

    document.getElementById('clock_video').style.fontSize   = px(CFG.video?.clock_size_px ?? 200);
    rightVideo.style.width = px(CFG.video?.right_width_px ?? 900);

    showStandby();
    fetchWeather(); // initial fetch
    mqttConnect();
  }catch(e){
    setWeatherStatus('err', 'Boot error: '+e.message);
    console.error(e);
  }
})()
