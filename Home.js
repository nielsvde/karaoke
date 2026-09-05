/**
 * Home.js - Beheert de authenticatie, rollenweergave, gebruikersinterface 
 * en synchronisatie van de muziekbibliotheek.
 */
document.addEventListener("DOMContentLoaded", () => {
  // DOM Elementen
  const btnOpenLocal = document.getElementById("btnOpenLocal");
  const zipInput = document.getElementById("zipInput");
  const btnLoginModal = document.getElementById("btnLoginModal");
  const btnLogout = document.getElementById("btnLogout");
  const authModal = document.getElementById("authModal");
  const adminModal = document.getElementById("adminModal");
  const btnCloseAdminModal = document.getElementById("btnCloseAdminModal");
  const loginForm = document.getElementById("loginForm");
  const loginUser = document.getElementById("loginUser");
  const loginPin = document.getElementById("loginPin");
  const statusBar = document.getElementById("statusBar");

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

  // Onthouden gebruikersnaam inladen
  const savedUsername = localStorage.getItem("karaoke_saved_username");
  if (savedUsername && loginUser) {
    loginUser.value = savedUsername;
  }

  // Uitloggen
  function logoutSession() {
    localStorage.removeItem("karaoke_admin_token");
    localStorage.removeItem("karaoke_role");
    localStorage.removeItem("karaoke_login_time");
    
    if (authModal) authModal.classList.remove("hidden");
    if (btnLoginModal) btnLoginModal.textContent = "🔐 Inloggen";
    if (btnLogout) btnLogout.style.display = "none";
    if (statusBar) statusBar.textContent = "Log in om te beginnen...";
  }

  // Rollenweergave toepassen (Admin vs Gebruiker)
  function applyRoleUI(role) {
    if (role === "admin") {
      if (userStartView) userStartView.style.display = "none";
      if (adminControlsView) adminControlsView.style.display = "block";
      if (advancedMixerSection) advancedMixerSection.style.display = "block";
      if (btnLoginModal) btnLoginModal.textContent = "⚙️ Gebruikersbeheer";
    } else {
      // Gebruiker met startscherm en bibliotheek
      if (userStartView) userStartView.style.display = "block";
      if (adminControlsView) adminControlsView.style.display = "none";
      if (advancedMixerSection) advancedMixerSection.style.display = "none";
      if (btnLoginModal) btnLoginModal.textContent = "👤 Ingelogd";
    }
  }

  // Authenticatie status controleren
  function checkAuthStatus() {
    const token = localStorage.getItem("karaoke_admin_token");
    const role = localStorage.getItem("karaoke_role");
    const loginTime = localStorage.getItem("karaoke_login_time");
    const now = Date.now();

    if (token && loginTime && (now - parseInt(loginTime, 10) < EXPIRATION_TIME_MS)) {
      if (authModal) authModal.classList.add("hidden");
      if (btnLogout) btnLogout.style.display = "flex";
      applyRoleUI(role);
    } else {
      logoutSession();
    }
  }

  checkAuthStatus();

  // Event Listeners voor knoppen
  if (btnLogout) {
    btnLogout.addEventListener("click", logoutSession);
  }

  if (btnOpenLocal && zipInput) {
    btnOpenLocal.addEventListener("click", () => zipInput.click());
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

  // Event voor Start-knop op de Gebruikers Hero Card
  if (userStartBtn) {
    userStartBtn.addEventListener("click", () => {
      const playBtn = document.getElementById("playBtn");
      if (playBtn) playBtn.click();
      
      // Schakel automatisch over naar Volledig Scherm
      const fullscreenBtn = document.getElementById("fullscreenBtn");
      if (fullscreenBtn) fullscreenBtn.click();
    });
  }

  // Zoekfunctionaliteit voor de Gebruikers Bibliotheek
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

  // Formulier voor inloggen
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = loginUser?.value.trim();
      const pass = loginPin?.value;

      if (!user || !pass) return;

      if (statusBar) statusBar.textContent = "Verbinden met NAS...";

      try {
        const response = await fetch("https://karaokenas.synology.me:8444/karaoke/api.php?action=login", {
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
          if (statusBar) statusBar.textContent = "Inloggen mislukt.";
        }
      } catch (err) {
        console.error("Fout tijdens inloggen:", err);
        alert("Kan geen verbinding maken met de NAS.");
        if (statusBar) statusBar.textContent = "Verbindingsfout NAS.";
      }
    });
  }

  // --- GLOBALE EXPORT FUNCTIES (Aangeroepen vanuit player.js) ---

  // Synchroniseer geselecteerde nummer naar de Hero Card bovenaan
  window.updateUserHeroCard = function(title, coverSrc) {
    if (userHeroTitle) userHeroTitle.textContent = title || "Onbekend nummer";
    if (userHeroStatus) userHeroStatus.textContent = "Klaar om af te spelen!";
    if (userStartBtn) userStartBtn.disabled = false;
    
    if (userHeroCover) {
      if (coverSrc) {
        userHeroCover.innerHTML = `<img src="${coverSrc}" alt="Cover">`;
      } else {
        userHeroCover.innerHTML = "🎵";
      }
    }
  };

  // Synchroniseer Afspeellijst naar Gebruikers Bibliotheek
  window.renderUserLibrary = function(items, onSelectCallback) {
    if (!userLibraryList) return;
    userLibraryList.innerHTML = "";
    if (userLibCount) userLibCount.textContent = `${items.length} nummers`;

    if (!items || items.length === 0) {
      userLibraryList.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 20px;">Geen nummers gevonden.</div>`;
      return;
    }

    items.forEach((item, index) => {
      const el = document.createElement("div");
      el.className = "user-library-item";
      el.innerHTML = `
        <div class="user-item-thumb">${item.cover ? `<img src="${item.cover}">` : '🎵'}</div>
        <div class="user-item-name">${item.title}</div>
      `;

      el.addEventListener("click", () => {
        document.querySelectorAll(".user-library-item").forEach(i => i.classList.remove("active"));
        el.classList.add("active");
        if (onSelectCallback) onSelectCallback(index);
      });

      userLibraryList.appendChild(el);
    });
  };
});