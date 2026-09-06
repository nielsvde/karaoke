/**
 * Home.js - Beheert de authenticatie, gebruikersinterface 
 * en synchronisatie van de NAS-afspeellijst.
 */

// Dynamische CSS-styling afhankelijk van de rol
const hideStyle = document.createElement("style");
hideStyle.id = "dynamic-hide-style";
document.head.appendChild(hideStyle);

function updateDynamicStyles(activeViewOverride = null) {
  const role = localStorage.getItem("karaoke_role");
  const isAdmin = role === "admin";
  // Als een admin tijdelijk de gebruikers-view bekijkt, behandelen we de styling als user
  const showAdminUI = isAdmin && activeViewOverride !== "user";

  hideStyle.textContent = `
    #statusBar,
    .status-bar {
      display: none !important;
    }

    /* Standaard: verberg het blokje voor tekstvertraging in fullscreen voor gewone gebruikers */
    :fullscreen .delay-control,
    :fullscreen #delayControl,
    :fullscreen #lyricDelayBox,
    :fullscreen .lyric-delay-container,
    #lyricsWrapper.fullscreen .delay-control,
    #lyricsWrapper.fullscreen #delayControl,
    #lyricsWrapper.fullscreen #lyricDelayBox,
    #lyricsWrapper.fullscreen .lyric-delay-container {
      display: none !important;
    }

    ${!showAdminUI ? `
      /* Voor gewone gebruikers (of admin in gebruikersweergave): verberg lokale knop en lyrics buiten fullscreen */
      #btnOpenLocal,
      .btn-open-local,
      #lyricsWrapper:not(.fullscreen),
      body:not(:has(:fullscreen)) #lyricsContainer,
      body:not(:has(:fullscreen)) .lyrics-container {
        display: none !important;
      }
    ` : `
      /* Voor admins in beheerdersweergave: toon de lokale knop en het lyrics-vak */
      #btnOpenLocal,
      .btn-open-local {
        display: inline-flex !important;
      }
      #lyricsWrapper,
      #lyricsContainer,
      .lyrics-container {
        display: block !important;
      }

      /* Toon het blokje van tekstvertraging wel in fullscreen wanneer ingelogd als admin */
      :fullscreen .delay-control,
      :fullscreen #delayControl,
      :fullscreen #lyricDelayBox,
      :fullscreen .lyric-delay-container,
      #lyricsWrapper.fullscreen .delay-control,
      #lyricsWrapper.fullscreen #delayControl,
      #lyricsWrapper.fullscreen #lyricDelayBox,
      #lyricsWrapper.fullscreen .lyric-delay-container {
        display: flex !important;
        position: absolute !important;
        top: 20px !important;
        right: 20px !important;
        z-index: 999999 !important;
        background: rgba(0, 0, 0, 0.7) !important;
        padding: 8px 12px !important;
        border-radius: 8px !important;
        backdrop-filter: blur(5px) !important;
      }
    `}
  `;
}

// Direct uitvoeren voor initiële weergave
updateDynamicStyles();

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elementen
  const btnLoginModal = document.getElementById("btnLoginModal");
  const btnLogout = document.getElementById("btnLogout");
  const authModal = document.getElementById("authModal");
  const adminModal = document.getElementById("adminModal");
  const btnCloseAdminModal = document.getElementById("btnCloseAdminModal");
  const loginForm = document.getElementById("loginForm");
  const loginUser = document.getElementById("loginUser");
  const loginPin = document.getElementById("loginPin");

  // Views
  const userStartView = document.getElementById("userStartView");
  const adminControlsView = document.getElementById("adminControlsView");
  const advancedMixerSection = document.getElementById("advancedMixerSection");

  // User Start View Elements
  const userHeroCover = document.getElementById("userHeroCover");
  const userHeroTitle = document.getElementById("userHeroTitle");
  const userHeroStatus = document.getElementById("userHeroStatus");
  const userStartBtn = document.getElementById("userStartBtn");
  const userSearchInput = document.getElementById("userSearchInput");
  const userLibraryList = document.getElementById("userLibraryList");
  const userLibCount = document.getElementById("userLibCount");

  const EXPIRATION_TIME_MS = 24 * 60 * 60 * 1000;
  const NAS_INDEX_URL = "https://karaokenas.synology.me:8444/karaoke/index.php";
  const NAS_LOGIN_URL = "https://karaokenas.synology.me:8444/karaoke/api.php";

  // Zorg dat de globale playlist bestaat
  if (!window.playlist) window.playlist = [];

  // Onthouden gebruikersnaam inladen
  const savedUsername = localStorage.getItem("karaoke_saved_username");
  if (savedUsername && loginUser) {
    loginUser.value = savedUsername;
  }

  // --- WISSELKNOP VOOR ADMIN MAKEN ---
  let btnToggleView = document.getElementById("btnToggleView");
  if (!btnToggleView) {
    btnToggleView = document.createElement("button");
    btnToggleView.id = "btnToggleView";
    btnToggleView.className = "btn-secondary";
    btnToggleView.style.cssText = "display: none; margin: 10px auto; position: relative; z-index: 10;";
  }

  window.setStartButtonState = function(ready, message) {
    if (userStartBtn) {
      userStartBtn.disabled = !ready;
    }
    if (userHeroStatus && message) {
      userHeroStatus.textContent = message;
    }
  };

  // --- 1. AFSPEELLIJST OPHALEN VAN DE NAS ---
  async function loadLiedjesVanNAS() {
    try {
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
          if (!window.playlist.some(p => p.url === fullUrl)) {
            window.playlist.push({
              name: fileName.split('/').pop(),
              title: cleanTitle,
              url: fullUrl,
              file: null
            });
          }
        }
      });

      if (typeof window.updatePlaylistUI === 'function') {
        window.updatePlaylistUI();
      }

      window.renderUserLibrary(window.playlist, (index) => {
        if (typeof window.loadTrackFromPlaylist === 'function') {
          window.setStartButtonState(false, "Nummer inladen...");
          window.loadTrackFromPlaylist(index);
        }
      });

      if (window.playlist.length > 0) {
        const randomIndex = Math.floor(Math.random() * window.playlist.length);
        if (typeof window.loadTrackFromPlaylist === 'function') {
          window.setStartButtonState(false, "Nummer inladen...");
          window.loadTrackFromPlaylist(randomIndex, false);
        }
      }
    } catch (err) {
      console.error("NAS ophaalfout:", err);
    }
  }

  window.loadLiedjesVanNAS = loadLiedjesVanNAS;

  // --- 2. AUTHENTICATIE EN SESSIE BEHEER ---
  function logoutSession() {
    localStorage.removeItem("karaoke_admin_token");
    localStorage.removeItem("karaoke_role");
    localStorage.removeItem("karaoke_login_time");

    if (btnToggleView) btnToggleView.style.display = "none";
    updateDynamicStyles();

    if (authModal) authModal.classList.remove("hidden");
    if (btnLoginModal) btnLoginModal.style.display = "inline-block";
    if (btnLogout) btnLogout.style.display = "none";
  }

  function applyRoleUI(role, targetView = null) {
    const mainContainer = document.querySelector(".container") || document.body;
    const isActuallyAdmin = role === "admin";
    
    // Bepaal de actieve weergave (standaard 'admin' als admin ingelogd is)
    const activeView = targetView || (isActuallyAdmin ? "admin" : "user");

    updateDynamicStyles(activeView);

    if (activeView === "admin") {
      if (userStartView) userStartView.style.display = "none";
      if (adminControlsView) adminControlsView.style.display = "block";
      if (advancedMixerSection) advancedMixerSection.style.display = "block";
      if (btnLoginModal) {
        btnLoginModal.style.display = "inline-block";
        btnLoginModal.textContent = "⚙️ Gebruikersbeheer";
      }
    } else {
      if (userStartView) userStartView.style.display = "block";
      if (adminControlsView) adminControlsView.style.display = "none";
      if (advancedMixerSection) advancedMixerSection.style.display = "none";
      if (btnLoginModal) btnLoginModal.style.display = "none";
    }

    // Configureer de wisselknop voor beheerders
    if (isActuallyAdmin) {
      btnToggleView.style.display = "flex";
      btnToggleView.textContent = activeView === "admin" ? "📱 Naar Gebruikersweergave" : "⚙️ Naar Adminweergave";
      
      if (btnToggleView.parentElement !== mainContainer) {
        mainContainer.appendChild(btnToggleView);
      }

      btnToggleView.onclick = () => {
        const newTarget = activeView === "admin" ? "user" : "admin";
        applyRoleUI(role, newTarget);
      };
    } else {
      btnToggleView.style.display = "none";
    }

    // Uitlogknop onder de container plaatsen
    if (btnLogout) {
      btnLogout.style.display = "flex";
      btnLogout.style.position = "relative";
      btnLogout.style.margin = "20px auto";
      btnLogout.style.left = "auto";
      btnLogout.style.transform = "none";
      btnLogout.style.zIndex = "10";

      if (btnLogout.parentElement !== mainContainer) {
        mainContainer.appendChild(btnLogout);
      }
    }
  }

  // Maak applyRoleUI globaal beschikbaar voor player.js
  window.applyRoleUI = applyRoleUI;

  function checkAuthStatus() {
    const token = localStorage.getItem("karaoke_admin_token");
    const role = localStorage.getItem("karaoke_role");
    const loginTime = localStorage.getItem("karaoke_login_time");
    const now = Date.now();

    if (token && loginTime && (now - parseInt(loginTime, 10) < EXPIRATION_TIME_MS)) {
      if (authModal) authModal.classList.add("hidden");
      applyRoleUI(role);
      loadLiedjesVanNAS();
    } else {
      logoutSession();
    }
  }

  checkAuthStatus();

  // --- 3. EVENT LISTENERS ---
  if (btnLogout) {
    btnLogout.addEventListener("click", logoutSession);
  }

  if (btnLoginModal) {
    btnLoginModal.addEventListener("click", () => {
      const currentRole = localStorage.getItem("karaoke_role");
      if (currentRole === "admin") {
        if (adminModal) adminModal.classList.add("open");
        if (typeof loadAdminUsers === "function") loadAdminUsers();
      } else {
        if (authModal) authModal.classList.remove("hidden");
      }
    });
  }

  const closeModal = (modal) => modal && modal.classList.remove("open");
  if (btnCloseAdminModal && adminModal) {
    btnCloseAdminModal.addEventListener("click", () => closeModal(adminModal));
  }

  // Start Karaoke Knop
  if (userStartBtn) {
    userStartBtn.addEventListener("click", () => {
      if (userStartBtn.disabled) return;

      const playBtn = document.getElementById("playBtn");
      if (playBtn) playBtn.click();

      const fullscreenBtn = document.getElementById("fullscreenBtn");
      if (fullscreenBtn) fullscreenBtn.click();
    });
  }

  if (userSearchInput) {
    userSearchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      const items = document.querySelectorAll(".user-library-item");
      items.forEach(item => {
        const title = item.querySelector(".user-item-name")?.textContent.toLowerCase() || "";
        item.style.display = title.includes(query) ? "flex" : "none";
      });
    });
  }

  // Keer automatisch terug naar het gebruikersscherm wanneer een nummer is afgelopen
  const audioPlayer = document.getElementById("audioPlayer") || document.querySelector("audio");
  if (audioPlayer) {
    audioPlayer.addEventListener("ended", () => {
      if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
        document.exitFullscreen().catch(() => {});
      }
      
      const lyricsWrapper = document.getElementById("lyricsWrapper");
      if (lyricsWrapper && lyricsWrapper.classList.contains("fullscreen")) {
        lyricsWrapper.classList.remove("fullscreen");
      }

      const role = localStorage.getItem("karaoke_role");
      applyRoleUI(role, "user");
      
      window.setStartButtonState(true, "Klaar om af te spelen!");
    });
  }

  // INLOGFORMULIER SUBMIT
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = loginUser?.value.trim();
      const pass = loginPin?.value;

      if (!user || !pass) return;

      try {
        const response = await fetch(`${NAS_LOGIN_URL}?action=login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: user, password: pass })
        });

        const data = await response.json();

        if (data.success) {
          const userRole = data.role || (user.toLowerCase() === 'admin' ? 'admin' : 'user');

          localStorage.setItem("karaoke_admin_token", data.token);
          localStorage.setItem("karaoke_role", userRole);
          localStorage.setItem("karaoke_login_time", Date.now().toString());
          localStorage.setItem("karaoke_saved_username", user);

          if (authModal) authModal.classList.add("hidden");
          if (loginPin) loginPin.value = "";

          checkAuthStatus();
        } else {
          alert("Inloggen mislukt: " + (data.message || "Onjuiste gegevens"));
        }
      } catch (err) {
        console.error("Fout tijdens inloggen:", err);
        alert("Kan geen verbinding maken met de NAS.");
      }
    });
  }

  // --- 4. GLOBALE WEERGAVE-FUNCTIES ---
  window.updateUserHeroCard = function(title, coverSrc) {
    if (userHeroTitle) userHeroTitle.textContent = title || "Onbekend nummer";

    if (userHeroCover) {
      if (coverSrc) {
        userHeroCover.innerHTML = `<img src="${coverSrc}" alt="Cover" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">`;
      } else {
        userHeroCover.innerHTML = "🎵";
      }
    }
  };

  window.renderUserLibrary = function(items, onSelectCallback) {
    if (!userLibraryList) return;
    userLibraryList.innerHTML = "";
    if (userLibCount) userLibCount.textContent = `${items.length} nummers`;

    if (!items || items.length === 0) {
      userLibraryList.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 20px;">Geen nummers gevonden op de NAS.</div>`;
      return;
    }

    items.forEach((item, index) => {
      const el = document.createElement("div");
      el.className = "user-library-item";
      el.innerHTML = `
        <div class="user-item-thumb">${item.cover ? `<img src="${item.cover}">` : '🎵'}</div>
        <div class="user-item-name">${item.title || item.name || 'Onbekend nummer'}</div>
      `;

      el.addEventListener("click", () => {
        document.querySelectorAll(".user-library-item").forEach(i => i.classList.remove("active"));
        el.classList.add("active");

        if (userHeroTitle) userHeroTitle.textContent = item.title || item.name;
        
        window.setStartButtonState(false, "Nummer inladen...");

        if (onSelectCallback) onSelectCallback(index);
      });

      userLibraryList.appendChild(el);
    });
  };
});
