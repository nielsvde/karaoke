/**
 * admin.js - Gebruikersbeheer voor Beheerders
 */

const adminModal = document.getElementById('adminModal');
const btnCloseAdminModal = document.getElementById('btnCloseAdminModal');
const userList = document.getElementById('userList');
const btnAddUser = document.getElementById('btnAddUser');

// Zorg ervoor dat NAS_INDEX_URL een geldige fallback heeft als deze nog niet globaal is gedefinieerd
const API_BASE_URL = typeof NAS_INDEX_URL !== 'undefined' 
  ? NAS_INDEX_URL 
  : "https://karaokenas.synology.me:8444/karaoke/api.php";

function openAdminModal() {
  const user = window.AuthModule?.getCurrentUser();
  if (!user || user.role !== 'admin') {
    alert("Toegang geweigerd: Geen beheerder.");
    return;
  }
  adminModal.classList.add('open');
  loadUsers();
}

function closeAdminModal() {
  adminModal.classList.remove('open');
}

// 1. GEBRUIKERS OPHALEN
async function loadUsers() {
  if (!userList) return;
  userList.innerHTML = "<li style='padding:8px 0; color:var(--text-muted);'>Laden...</li>";
  
  try {
    const response = await fetch(`${API_BASE_URL}?action=get_users`);
    const data = await response.json();

    if (data.success && Array.isArray(data.users)) {
      userList.innerHTML = '';
      
      data.users.forEach(u => {
        const li = document.createElement('li');
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";
        li.style.padding = "8px 0";
        li.style.borderBottom = "1px solid rgba(255,255,255,0.08)";

        const infoSpan = document.createElement('span');
        infoSpan.textContent = `👤 ${u.username} (${u.role})`;
        
        li.appendChild(infoSpan);

        // Verwijderknop toevoegen (behalve voor de hoofd-admin)
        if (u.username !== 'admin') {
          const deleteBtn = document.createElement('button');
          deleteBtn.textContent = '🗑️';
          deleteBtn.title = 'Gebruiker verwijderen';
          deleteBtn.style.background = 'none';
          deleteBtn.style.border = 'none';
          deleteBtn.style.cursor = 'pointer';
          deleteBtn.style.fontSize = '1rem';
          deleteBtn.style.padding = '2px 6px';

          deleteBtn.addEventListener('click', () => deleteUser(u.username));
          li.appendChild(deleteBtn);
        }

        userList.appendChild(li);
      });
    } else {
      userList.innerHTML = "<li style='padding:8px 0; color:#fca5a5;'>Fout bij ophalen van lijst.</li>";
    }
  } catch (err) {
    console.error("Fout bij laden gebruikers:", err);
    userList.innerHTML = "<li style='padding:8px 0; color:#fca5a5;'>Fout bij laden van gebruikers.</li>";
  }
}

// 2. NIEUWE GEBRUIKER TOEVOEGEN
async function addNewUser() {
  const username = prompt("Voer de nieuwe gebruikersnaam in:");
  if (!username || !username.trim()) return;

  const password = prompt(`Voer het wachtwoord in voor '${username.trim()}':`);
  if (!password) return;

  const isAdmin = confirm(`Moet '${username.trim()}' een Admin-account worden?\n\nKlik 'OK' voor Admin, of 'Annuleren' voor een Gewone Gebruiker.`);
  const role = isAdmin ? 'admin' : 'user';

  try {
    const response = await fetch(`${API_BASE_URL}?action=add_user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.trim(),
        password: password,
        role: role
      })
    });

    const data = await response.json();

    if (data.success) {
      alert("Gebruiker succesvol aangemaakt!");
      loadUsers(); // Ververs de lijst direct
    } else {
      alert("Fout bij aanmaken: " + (data.message || "Onbekende fout"));
    }
  } catch (err) {
    console.error("Fout tijdens toevoegen:", err);
    alert("Kan geen verbinding maken met de NAS.");
  }
}

// 3. GEBRUIKER VERWIJDEREN
async function deleteUser(username) {
  if (!confirm(`Weet je zeker dat je gebruiker '${username}' wilt verwijderen?`)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}?action=delete_user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username })
    });

    const data = await response.json();

    if (data.success) {
      loadUsers(); // Ververs de lijst
    } else {
      alert("Fout bij verwijderen: " + (data.message || "Onbekende fout"));
    }
  } catch (err) {
    console.error("Fout tijdens verwijderen:", err);
    alert("Kan geen verbinding maken met de NAS.");
  }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  if (btnCloseAdminModal) {
    btnCloseAdminModal.addEventListener('click', closeAdminModal);
  }
  
  if (btnAddUser) {
    btnAddUser.addEventListener('click', addNewUser);
  }
});

// Exporteer functies naar de window
window.AdminModule = {
  openAdminModal,
  closeAdminModal,
  loadUsers
};
