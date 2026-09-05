/**
 * player.js - Karaoke Audio Engine & LRC Sync Modulair
 */

const APP_SECRET_KEY = "MijnUniekeKaraokeSleutel2026!";
const NAS_INDEX_URL = "https://karaokenas.synology.me:8444/karaoke/index.php";

let audioCtx = null, musicBuffer = null, vocalBuffer = null;
let musicSource = null, vocalSource = null, musicGainNode = null, vocalGainNode = null;
let isPlaying = false, startTime = 0, pauseOffset = 0, animFrame = null;
let isTrackLoading = false;
let lyricsData = [], activeLineIndex = -1;

let playlist = [];
let currentTrackIndex = -1;
let currentCoverObjectUrl = null;

const savedOffset = localStorage.getItem('karaoke_userOffset');
let userOffset = savedOffset !== null ? parseFloat(savedOffset) : 0.0;
let isUserSeeking = false;

// DOM Elementen
let zipInput = document.getElementById('zipInput');
let btnOpenLocal = document.getElementById('btnOpenLocal');
let playBtn = document.getElementById('playBtn');
let stopBtn = document.getElementById('stopBtn');
let fsPlayBtn = document.getElementById('fsPlayBtn');
let fsStopBtn = document.getElementById('fsStopBtn');

let nextBtn = document.getElementById('nextBtn');
let prevBtn = document.getElementById('prevBtn');
let fsNextBtn = document.getElementById('fsNextBtn');
let fsPrevBtn = document.getElementById('fsPrevBtn');

let musicVol = document.getElementById('musicVol');
let vocalVol = document.getElementById('vocalVol');
let fsVocalVol = document.getElementById('fsVocalVol');
let musicVolVal = document.getElementById('musicVolVal');
let vocalVolVal = document.getElementById('vocalVolVal');
let fsVocalVolVal = document.getElementById('fsVocalVolVal');

let statusBar = document.getElementById('statusBar');
let seekSlider = document.getElementById('seekSlider');
let fsSeekSlider = document.getElementById('fsSeekSlider');
let currentTimeEl = document.getElementById('currentTime');
let durationTimeEl = document.getElementById('durationTime');
let fsCurrentTimeEl = document.getElementById('fsCurrentTime');
let fsDurationTimeEl = document.getElementById('fsDurationTime');

let lyricsContainer = document.getElementById('lyricsContainer');
let lyricsWrapper = document.getElementById('lyricsWrapper');
let offsetDisplay = document.getElementById('offsetDisplay');
let offsetSlider = document.getElementById('offsetSlider');

let fsPlayerOverlay = document.getElementById('fsPlayerOverlay');
let fsToggleBtn = document.getElementById('fsToggleBtn');

// Admin / Navigatie Elementen
let btnAdminNav = document.getElementById('btnAdminNav');
let adminNavLabel = document.getElementById('adminNavLabel');
let homeScreen = document.getElementById('homeScreen');
let playerScreen = document.getElementById('playerScreen');

function scrambleBuffer(arrayBuffer, key) {
  const uint8 = new Uint8Array(arrayBuffer);
  const keyLength = key.length;
  for (let i = 0; i < uint8.length; i++) {
    uint8[i] ^= key.charCodeAt(i % keyLength);
  }
  return uint8.buffer;
}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    musicGainNode = audioCtx.createGain();
    vocalGainNode = audioCtx.createGain();
    musicGainNode.connect(audioCtx.destination);
    vocalGainNode.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

async function decodeAudioArrayBuffer(arrayBuffer) {
  initAudio();
  return await audioCtx.decodeAudioData(arrayBuffer);
}

function getMaxDuration() {
  return Math.max(musicBuffer?.duration || 0, vocalBuffer?.duration || 0);
}

function formatTime(sec) {
  if (isNaN(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function toggleFullscreen() {
  const wrapper = lyricsWrapper || document.getElementById('lyricsWrapper') || document.documentElement;
  if (!document.fullscreenElement && !wrapper.classList.contains('fullscreen')) {
    if (wrapper.requestFullscreen) {
      wrapper.requestFullscreen().catch(() => wrapper.classList.add('fullscreen'));
    } else {
      wrapper.classList.add('fullscreen');
    }
  } else {
    if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen();
    wrapper.classList.remove('fullscreen');
  }
}

document.addEventListener('fullscreenchange', () => {
  const wrapper = lyricsWrapper || document.getElementById('lyricsWrapper');
  if (wrapper) {
    wrapper.classList.toggle('fullscreen', !!document.fullscreenElement);
  }
});

/* ==========================================================================
   ADMIN / SCHERM NAVIGATIE
   ========================================================================== */
function checkAdminAuth() {
  btnAdminNav = document.getElementById('btnAdminNav');
  const isAdmin = localStorage.getItem('role') === 'admin' || localStorage.getItem('isAdmin') === 'true';
  
  if (btnAdminNav) {
    if (isAdmin) {
      btnAdminNav.classList.remove('hidden');
      btnAdminNav.style.display = 'inline-flex';
    } else {
      btnAdminNav.classList.add('hidden');
      btnAdminNav.style.display = 'none';
    }
  }
}

function toggleAdminScreen() {
  homeScreen = document.getElementById('homeScreen');
  playerScreen = document.getElementById('playerScreen');
  adminNavLabel = document.getElementById('adminNavLabel');

  if (!homeScreen || !playerScreen) return;

  const isHomeVisible = !homeScreen.classList.contains('hidden') && homeScreen.style.display !== 'none';

  if (isHomeVisible) {
    homeScreen.classList.add('hidden');
    homeScreen.style.display = 'none';
    playerScreen.classList.remove('hidden');
    playerScreen.style.display = 'block';
    if (adminNavLabel) adminNavLabel.textContent = "Naar Home";
  } else {
    playerScreen.classList.add('hidden');
    playerScreen.style.display = 'none';
    homeScreen.classList.remove('hidden');
    homeScreen.style.display = 'block';
    if (adminNavLabel) adminNavLabel.textContent = "Naar Player";
  }
}
window.updateAdminNavStatus = checkAdminAuth;

/* ==========================================================================
   NAS & PLAYLIST LOGICA
   ========================================================================== */
async function loadLiedjesVanNAS() {
  try {
    if (statusBar) statusBar.textContent = "Verbinden met NAS...";
    const response = await fetch(NAS_INDEX_URL);
    if (!response.ok) throw new Error(`HTTP Fout: ${response.status}`);
    
    const bestanden = await response.json();

    bestanden.forEach(item => {
      let fileName = "";
      let fullUrl = "";

      if (typeof item === 'object' && item !== null) {
        fileName = item.filename || item.name || item.file || "";
        fullUrl = item.url || (NAS_INDEX_URL + "?file=" + encodeURIComponent(fileName));
      } else if (typeof item === 'string') {
        fileName = item;
        fullUrl = fileName.startsWith('http') ? fileName : (NAS_INDEX_URL + "?file=" + encodeURIComponent(fileName));
      }

      if (fileName && fileName.toLowerCase().endsWith('.kar')) {
        const cleanTitle = fileName.split('/').pop().replace(/\.kar$/i, '').replace(/_/g, ' ');
        if (!playlist.some(p => p.url === fullUrl)) {
          playlist.push({ name: fileName.split('/').pop(), title: cleanTitle, url: fullUrl, file: null });
        }
      }
    });

    updatePlaylistUI();
    if (playlist.length > 0) {
      if (statusBar) statusBar.textContent = `${playlist.length} nummers geladen van NAS.`;
      document.getElementById('playlistBody')?.classList.add('open');
    } else {
      if (statusBar) statusBar.textContent = "Geen .kar bestanden gevonden op NAS.";
    }
  } catch (err) {
    console.error("NAS ophaalfout:", err);
    if (statusBar) statusBar.textContent = "Fout bij ophalen lijst van NAS (CORS of netwerk).";
  }
}

async function getArrayBufferFromFileOrUrl(item) {
  if (item.file) {
    if (item.file.arrayBuffer) return await item.file.arrayBuffer();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(item.file);
    });
  } else if (item.url) {
    const res = await fetch(item.url);
    if (!res.ok) throw new Error(`Netwerkfout: ${res.statusText}`);
    return await res.arrayBuffer();
  }
  throw new Error("Geen geldige bron gevonden.");
}

function updatePlaylistUI() {
  const countEl = document.getElementById('playlistCount');
  if (countEl) countEl.textContent = playlist.length;
  renderPlaylistItems(playlist);
}

function renderPlaylistItems(items) {
  const listEl = document.getElementById('playlistList');
  if (!listEl) return;
  listEl.innerHTML = '';

  items.forEach((item) => {
    const originalIndex = playlist.indexOf(item);
    const li = document.createElement('li');
    li.className = `playlist-item ${originalIndex === currentTrackIndex ? 'active' : ''}`;
    li.onclick = () => loadTrackFromPlaylist(originalIndex, false);
    li.innerHTML = `
      <span class="playlist-item-title">${item.title}</span>
      ${originalIndex === currentTrackIndex ? '<span>▶</span>' : ''}
    `;
    listEl.appendChild(li);
  });
}

function filterPlaylist() {
  const query = document.getElementById('playlistSearch')?.value.toLowerCase() || '';
  const filtered = playlist.filter(item => item.title.toLowerCase().includes(query));
  renderPlaylistItems(filtered);
}

/* ==========================================================================
   TRACK LADEN & VERWERKEN
   ========================================================================== */
async function loadTrackFromPlaylist(index, autoStart = false) {
  if (index < 0 || index >= playlist.length) return;

  stopAudio();
  
  isTrackLoading = true;
  if (playBtn) playBtn.disabled = true;
  if (fsPlayBtn) fsPlayBtn.disabled = true;

  currentTrackIndex = index;
  const track = playlist[index];

  updatePlaylistUI();
  if (statusBar) statusBar.textContent = "Nummer ophalen & inladen...";
  
  const trackTitleEl = document.getElementById('trackTitle');
  if (trackTitleEl) trackTitleEl.textContent = track.title;
  
  const trackStatusEl = document.getElementById('trackStatus');
  if (trackStatusEl) trackStatusEl.textContent = "Pakket verwerken...";

  if (currentCoverObjectUrl) {
    URL.revokeObjectURL(currentCoverObjectUrl);
    currentCoverObjectUrl = null;
  }

  try {
    const rawBuffer = await getArrayBufferFromFileOrUrl(track);
    let zipBuffer = scrambleBuffer(rawBuffer.slice(0), APP_SECRET_KEY);
    let zip = null;

    try { zip = await JSZip.loadAsync(zipBuffer); } catch(err) {
      try { zip = await JSZip.loadAsync(rawBuffer); } catch(err2) { zip = null; }
    }

    musicBuffer = null; vocalBuffer = null; lyricsData = [];
    let extractedCoverUrl = null;

    if (zip) {
      // Cover-afbeelding opsporen
      for (const filename of Object.keys(zip.files)) {
        const lower = filename.toLowerCase();
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp')) {
          const imgData = await zip.files[filename].async('uint8array');
          const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
          extractedCoverUrl = `data:${mime};base64,` + bufferToBase64(imgData);
          break;
        }
      }

      const filenames = Object.keys(zip.files).sort();

      // LRC Songtekst opsporen
      for (const filename of filenames) {
        const zipEntry = zip.files[filename];
        if (zipEntry.dir) continue;
        const lowerName = filename.toLowerCase();
        if (lowerName.endsWith(".lrc") || lowerName.endsWith(".txt")) {
          const lrcText = await zipEntry.async('string');
          parseLRC(lrcText);
        }
      }

      // Audio opsporen
      for (const filename of filenames) {
        const zipEntry = zip.files[filename];
        if (zipEntry.dir) continue;
        const lowerName = filename.toLowerCase();
        const isAudio = lowerName.endsWith(".mp3") || lowerName.endsWith(".wav") || lowerName.endsWith(".ogg") || lowerName.endsWith(".m4a");

        if (isAudio) {
          const data = await zipEntry.async('arraybuffer');
          if (!extractedCoverUrl) extractedCoverUrl = parseID3Cover(new Uint8Array(data));

          if (lowerName.includes("vocal") || lowerName.includes("zang")) {
            vocalBuffer = await decodeAudioArrayBuffer(data);
          } else if (!musicBuffer) {
            musicBuffer = await decodeAudioArrayBuffer(data);
          } else if (!vocalBuffer) {
            vocalBuffer = await decodeAudioArrayBuffer(data);
          }
        }
      }
    }

    if (!extractedCoverUrl) extractedCoverUrl = parseEmbeddedImage(new Uint8Array(rawBuffer));

    const coverContainer = document.getElementById('coverContainer');
    if (coverContainer) {
      coverContainer.innerHTML = extractedCoverUrl ? `<img src="${extractedCoverUrl}" alt="Cover">` : "🎵";
    }

    // Songtekst direct weergeven op het scherm
    renderLyrics();

    isTrackLoading = false;
    checkReady();
    if (trackStatusEl) trackStatusEl.textContent = "Nummer geladen";
    if (statusBar) statusBar.textContent = "Klaar om af te spelen!";

    if (typeof window.updateUserHeroCard === "function") {
      window.updateUserHeroCard(track.title, extractedCoverUrl);
    }

    if (autoStart) {
      startAudio(0);
    }
  } catch (err) {
    console.error("Load Error:", err);
    isTrackLoading = false;
    if (statusBar) statusBar.textContent = "Fout bij inladen van KAR-bestand.";
    if (trackStatusEl) trackStatusEl.textContent = "Kan bestand niet verwerken";
  }
}

function nextTrack() {
  if (playlist.length === 0) return;
  let nextIndex = currentTrackIndex + 1;
  if (nextIndex >= playlist.length) nextIndex = 0;
  loadTrackFromPlaylist(nextIndex, isPlaying);
}

function prevTrack() {
  if (playlist.length === 0) return;
  let prevIndex = currentTrackIndex - 1;
  if (prevIndex < 0) prevIndex = playlist.length - 1;
  loadTrackFromPlaylist(prevIndex, isPlaying);
}

function parseID3Cover(bytes) {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null;
  let offset = 10;
  const totalSize = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);

  while (offset < totalSize && offset < bytes.length - 10) {
    const frameID = String.fromCharCode(bytes[offset], bytes[offset+1], bytes[offset+2], bytes[offset+3]);
    const frameSize = (bytes[offset+4] << 24) | (bytes[offset+5] << 16) | (bytes[offset+6] << 8) | bytes[offset+7];
    
    if (frameID === "APIC") {
      let imgStart = offset + 10;
      let mimeEnd = imgStart + 1;
      while (bytes[mimeEnd] !== 0 && mimeEnd < offset + 10 + frameSize) mimeEnd++;
      
      let mime = "image/jpeg";
      const mimeStr = String.fromCharCode(...bytes.subarray(imgStart + 1, mimeEnd));
      if (mimeStr.includes("png")) mime = "image/png";

      let pictureDataStart = mimeEnd + 2;
      while (bytes[pictureDataStart] !== 0 && pictureDataStart < offset + 10 + frameSize) pictureDataStart++;
      pictureDataStart++;

      const imgBuffer = bytes.subarray(pictureDataStart, offset + 10 + frameSize);
      return `data:${mime};base64,` + bufferToBase64(imgBuffer);
    }
    offset += 10 + frameSize;
  }
  return null;
}

function parseEmbeddedImage(bytes) {
  for (let i = 0; i < bytes.length - 3; i++) {
    if (bytes[i] === 0xFF && bytes[i+1] === 0xD8 && bytes[i+2] === 0xFF) {
      let end = -1;
      for (let j = i + 2; j < bytes.length - 1; j++) {
        if (bytes[j] === 0xFF && bytes[j+1] === 0xD9) { end = j + 2; break; }
      }
      if (end !== -1 && (end - i) > 2000) return 'data:image/jpeg;base64,' + bufferToBase64(bytes.subarray(i, end));
    }
  }
  return null;
}

function bufferToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}

/* ==========================================================================
   SONGTEKST & LYRICS LOGICA
   ========================================================================== */
function parseLRC(lrcText) {
  lyricsData = [];
  const lineTimeRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/;

  lrcText.split('\n').forEach(line => {
    const lineMatch = lineTimeRegex.exec(line.trim());
    if (lineMatch) {
      const time = parseInt(lineMatch[1], 10) * 60 + parseInt(lineMatch[2], 10) + parseInt(lineMatch[3].padEnd(3, '0'), 10) / 1000;
      const cleanText = lineMatch[4].replace(/\[.*?\]/g, '').trim();
      if (cleanText) lyricsData.push({ time, text: cleanText });
    }
  });

  lyricsData.sort((a, b) => a.time - b.time);
  renderLyrics();
}

function renderLyrics() {
  lyricsContainer = document.getElementById('lyricsContainer');
  if (!lyricsContainer) return;

  lyricsContainer.innerHTML = '';
  activeLineIndex = -1;

  if (lyricsData.length === 0) {
    lyricsContainer.innerHTML = '<div class="lyric-line">Geen songtekst aanwezig</div>';
    return;
  }

  lyricsData.forEach((line, index) => {
    const div = document.createElement('div');
    div.className = 'lyric-line';
    div.id = `line-${index}`;
    div.textContent = line.text;
    div.addEventListener('click', () => seekToTime(line.time - userOffset));
    lyricsContainer.appendChild(div);
  });
  
  updateLyricsDisplay(0);
}

function updateOffsetDisplay() {
  if (offsetDisplay) offsetDisplay.textContent = `${userOffset >= 0 ? '+' : ''}${userOffset.toFixed(1)}s`;
  if (offsetSlider) offsetSlider.value = userOffset;
  localStorage.setItem('karaoke_userOffset', userOffset);
  if (audioCtx) updateLyricsDisplay(isPlaying ? (audioCtx.currentTime - startTime) : pauseOffset);
}

function adjustOffset(delta) { userOffset = parseFloat((userOffset + delta).toFixed(1)); updateOffsetDisplay(); }
function setOffset(val) { userOffset = parseFloat(val); updateOffsetDisplay(); }

function updateLyricsDisplay(currentPos) {
  if (lyricsData.length === 0) return;
  const adjustedTime = currentPos - userOffset;
  let newLineIndex = -1;

  for (let i = 0; i < lyricsData.length; i++) {
    if (adjustedTime >= lyricsData[i].time) newLineIndex = i;
    else break;
  }

  if (newLineIndex !== activeLineIndex) {
    if (activeLineIndex !== -1) document.getElementById(`line-${activeLineIndex}`)?.classList.remove('active');
    if (newLineIndex !== -1) {
      const newEl = document.getElementById(`line-${newLineIndex}`);
      if (newEl) {
        newEl.classList.add('active');
        newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    activeLineIndex = newLineIndex;
  }
}

/* ==========================================================================
   AUDIO BEDIENING & PLAYBACK
   ========================================================================== */
function checkReady() {
  const duration = getMaxDuration();
  if (duration > 0 && !isTrackLoading) {
    if (playBtn) playBtn.disabled = false; 
    if (stopBtn) stopBtn.disabled = false; 
    if (seekSlider) seekSlider.disabled = false;
    if (fsPlayBtn) fsPlayBtn.disabled = false; 
    if (fsStopBtn) fsStopBtn.disabled = false; 
    if (fsSeekSlider) fsSeekSlider.disabled = false;
    
    const formatted = formatTime(duration);
    if (durationTimeEl) durationTimeEl.textContent = formatted;
    if (fsDurationTimeEl) fsDurationTimeEl.textContent = formatted;
  }
}

function startAudio(offset = 0) {
  if (isTrackLoading) {
    if (statusBar) statusBar.textContent = "Even geduld, sporen worden nog geladen...";
    return;
  }

  initAudio();
  stopAudioSources();

  const startTimestamp = audioCtx.currentTime + 0.05;

  if (musicBuffer) {
    musicSource = audioCtx.createBufferSource();
    musicSource.buffer = musicBuffer;
    musicSource.connect(musicGainNode);
    musicSource.start(startTimestamp, offset);
  }

  if (vocalBuffer) {
    vocalSource = audioCtx.createBufferSource();
    vocalSource.buffer = vocalBuffer;
    vocalSource.connect(vocalGainNode);
    vocalSource.start(startTimestamp, offset);
  }

  startTime = audioCtx.currentTime - offset;
  isPlaying = true;

  const pauseBtnHtml = `<svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pauze`;
  if (playBtn) playBtn.innerHTML = pauseBtnHtml;
  if (fsPlayBtn) fsPlayBtn.innerHTML = pauseBtnHtml;
  if (statusBar) statusBar.textContent = "Speelt af...";
  updateProgress();
}

function updateProgress() {
  if (!isPlaying) return;
  const currentPos = audioCtx.currentTime - startTime;
  const totalDur = getMaxDuration();

  if (currentPos >= totalDur && totalDur > 0) { 
    stopAudio(); 
    nextTrack();
    return; 
  }

  if (!isUserSeeking) {
    const val = (currentPos / totalDur) * 100;
    if (seekSlider) seekSlider.value = val || 0;
    if (fsSeekSlider) fsSeekSlider.value = val || 0;
    
    const formattedTime = formatTime(currentPos);
    if (currentTimeEl) currentTimeEl.textContent = formattedTime;
    if (fsCurrentTimeEl) fsCurrentTimeEl.textContent = formattedTime;

    updateLyricsDisplay(currentPos);
  }
  animFrame = requestAnimationFrame(updateProgress);
}

function togglePlayPause() {
  if (isTrackLoading) {
    if (statusBar) statusBar.textContent = "Even geduld, sporen worden nog geladen...";
    return;
  }

  if (isPlaying) {
    pauseOffset = audioCtx.currentTime - startTime;
    stopAudioSources();
    isPlaying = false;
    cancelAnimationFrame(animFrame);
    const resumeBtnHtml = `<svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Hervatten`;
    if (playBtn) playBtn.innerHTML = resumeBtnHtml;
    if (fsPlayBtn) fsPlayBtn.innerHTML = resumeBtnHtml;
    if (statusBar) statusBar.textContent = "Gepauzeerd.";
  } else {
    startAudio(pauseOffset);
  }
}

function stopAudioSources() {
  [musicSource, vocalSource].forEach(src => {
    if (src) { try { src.stop(); src.disconnect(); } catch(e){} }
  });
  musicSource = null; vocalSource = null;
}

function stopAudio() {
  stopAudioSources();
  isPlaying = false;
  pauseOffset = 0;
  cancelAnimationFrame(animFrame);
  
  if (seekSlider) seekSlider.value = 0; 
  if (fsSeekSlider) fsSeekSlider.value = 0;
  if (currentTimeEl) currentTimeEl.textContent = "00:00"; 
  if (fsCurrentTimeEl) fsCurrentTimeEl.textContent = "00:00";
  
  const playBtnHtml = `<svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Afspelen`;
  if (playBtn) playBtn.innerHTML = playBtnHtml;
  if (fsPlayBtn) fsPlayBtn.innerHTML = playBtnHtml;
  if (statusBar) statusBar.textContent = "Gestopt.";
}

function seekToTime(targetTime) {
  if (isTrackLoading) return;
  pauseOffset = Math.max(0, targetTime);
  const val = (pauseOffset / getMaxDuration()) * 100;
  if (seekSlider) seekSlider.value = val; 
  if (fsSeekSlider) fsSeekSlider.value = val;
  
  const formattedTime = formatTime(pauseOffset);
  if (currentTimeEl) currentTimeEl.textContent = formattedTime;
  if (fsCurrentTimeEl) fsCurrentTimeEl.textContent = formattedTime;

  updateLyricsDisplay(pauseOffset);
  if (isPlaying) startAudio(pauseOffset);
}

function setupSeekEvents(slider) {
  if (!slider) return;
  slider.addEventListener('mousedown', () => { isUserSeeking = true; });
  slider.addEventListener('touchstart', () => { isUserSeeking = true; });

  slider.addEventListener('input', (e) => {
    const targetTime = (e.target.value / 100) * getMaxDuration();
    const formattedTime = formatTime(targetTime);
    if (currentTimeEl) currentTimeEl.textContent = formattedTime;
    if (fsCurrentTimeEl) fsCurrentTimeEl.textContent = formattedTime;
    if (seekSlider) seekSlider.value = e.target.value;
    if (fsSeekSlider) fsSeekSlider.value = e.target.value;
    updateLyricsDisplay(targetTime);
  });

  slider.addEventListener('change', (e) => {
    isUserSeeking = false;
    pauseOffset = (e.target.value / 100) * getMaxDuration();
    if (isPlaying) startAudio(pauseOffset);
  });
}

function applyVocalVolume(val) {
  if (vocalGainNode && audioCtx) vocalGainNode.gain.setValueAtTime(val, audioCtx.currentTime);
  if (vocalVol) vocalVol.value = val; 
  if (fsVocalVol) fsVocalVol.value = val;
  
  const text = Math.round(val * 100) + '%';
  if (vocalVolVal) vocalVolVal.textContent = text; 
  if (fsVocalVolVal) fsVocalVolVal.textContent = text;

  document.querySelectorAll('.presets .btn-preset').forEach(btn => btn.classList.remove('active'));
  if (val === 0) {
    document.getElementById('vocalMuteBtn')?.classList.add('active');
    document.getElementById('fsVocalMuteBtn')?.classList.add('active');
  } else if (val === 1.0) {
    document.getElementById('mainPreset100')?.classList.add('active');
    document.getElementById('fsPreset100')?.classList.add('active');
  }
}

// Expose functies globaal
window.loadTrackFromPlaylist = loadTrackFromPlaylist;

/* ==========================================================================
   INITIALISATIE EN EVENT LISTENERS
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  btnAdminNav?.addEventListener('click', toggleAdminScreen);

  btnOpenLocal?.addEventListener('click', () => zipInput?.click());
  
  zipInput?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    if (statusBar) statusBar.textContent = "Bestanden verwerken...";

    const startIndex = playlist.length;

    for (const file of files) {
      const cleanTitle = file.name.replace(/\.(kar|zip)$/i, '').replace(/_/g, ' ');
      if (!playlist.some(p => p.name === file.name)) {
        playlist.push({ name: file.name, title: cleanTitle, file: file, url: null });
      }
    }

    updatePlaylistUI();
    if (playlist.length > 0) {
      loadTrackFromPlaylist(startIndex < playlist.length ? startIndex : 0, false);
    }
    zipInput.value = '';
  });

  document.getElementById('playlistHeader')?.addEventListener('click', () => {
    document.getElementById('playlistBody')?.classList.toggle('open');
  });

  document.getElementById('playlistSearch')?.addEventListener('input', filterPlaylist);

  document.getElementById('fullscreenBtn')?.addEventListener('click', toggleFullscreen);
  document.getElementById('closeFullscreenBtn')?.addEventListener('click', toggleFullscreen);

  fsToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    fsPlayerOverlay?.classList.toggle('collapsed');
    fsToggleBtn?.classList.toggle('collapsed');
  });

  playBtn?.addEventListener('click', togglePlayPause);
  fsPlayBtn?.addEventListener('click', togglePlayPause);
  stopBtn?.addEventListener('click', stopAudio);
  fsStopBtn?.addEventListener('click', stopAudio);

  nextBtn?.addEventListener('click', nextTrack);
  prevBtn?.addEventListener('click', prevTrack);
  fsNextBtn?.addEventListener('click', nextTrack);
  fsPrevBtn?.addEventListener('click', prevTrack);

  setupSeekEvents(seekSlider);
  setupSeekEvents(fsSeekSlider);

  vocalVol?.addEventListener('input', (e) => applyVocalVolume(parseFloat(e.target.value)));
  fsVocalVol?.addEventListener('input', (e) => applyVocalVolume(parseFloat(e.target.value)));

  musicVol?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (musicGainNode && audioCtx) musicGainNode.gain.setValueAtTime(val, audioCtx.currentTime);
    if (musicVolVal) musicVolVal.textContent = Math.round(val * 100) + '%';
  });

  document.getElementById('vocalMuteBtn')?.addEventListener('click', () => applyVocalVolume(0));
  document.getElementById('fsVocalMuteBtn')?.addEventListener('click', () => applyVocalVolume(0));
  document.getElementById('mainPreset30')?.addEventListener('click', () => applyVocalVolume(0.3));
  document.getElementById('fsPreset30')?.addEventListener('click', () => applyVocalVolume(0.3));
  document.getElementById('mainPreset70')?.addEventListener('click', () => applyVocalVolume(0.7));
  document.getElementById('fsPreset70')?.addEventListener('click', () => applyVocalVolume(0.7));
  document.getElementById('mainPreset100')?.addEventListener('click', () => applyVocalVolume(1.0));
  document.getElementById('fsPreset100')?.addEventListener('click', () => applyVocalVolume(1.0));

  offsetSlider?.addEventListener('input', (e) => setOffset(e.target.value));
  document.getElementById('btnOffsetMinus4')?.addEventListener('click', () => adjustOffset(-0.4));
  document.getElementById('btnOffsetMinus2')?.addEventListener('click', () => adjustOffset(-0.2));
  document.getElementById('btnOffsetMinus1')?.addEventListener('click', () => adjustOffset(-0.1));
  document.getElementById('btnOffsetReset')?.addEventListener('click', () => setOffset(0.0));
  document.getElementById('btnOffsetPlus1')?.addEventListener('click', () => adjustOffset(0.1));
  document.getElementById('btnOffsetPlus2')?.addEventListener('click', () => adjustOffset(0.2));
  document.getElementById('btnOffsetPlus4')?.addEventListener('click', () => adjustOffset(0.4));

  updateOffsetDisplay();
  checkAdminAuth();
  loadLiedjesVanNAS();
});
