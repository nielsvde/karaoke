/**
 * admin.js - Gebruikersbeheer voor Beheerders
 */

const adminModal = document.getElementById('adminModal');
const btnCloseAdminModal = document.getElementById('btnCloseAdminModal');
const userList = document.getElementById('userList');
const btnAddUser = document.getElementById('btnAddUser');

// Altijd expliciet naar api.php verwijzen
const API_BASE_URL = typeof NAS_LOGIN_URL !== 'undefined' 
  ? NAS_LOGIN_URL 
  : "https://karaokenas.synology.me:8444/karaoke/api.php";

function openAdminModal() {
  const role = localStorage.getItem("karaoke_role");
  if (role !== 'admin') {
    alert("Toegang geweigerd: Geen beheerder.");
    return;
  }
  if (adminModal) adminModal.classList.add('open');
  loadUsers();
}

function closeAdminModal() {
  if (adminModal) adminModal.classList.remove('open');
}

// 1. GEBRUIKERS OPHALEN & TONEN
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

        // Gebruikersnaam
        const infoSpan = document.createElement('span');
        infoSpan.textContent = `👤 ${u.username}`;
        infoSpan.style.fontWeight = "bold";
        
        // Actiecontainer
        const actionsDiv = document.createElement('div');
        actionsDiv.style.display = "flex";
        actionsDiv.style.gap = "8px";
        actionsDiv.style.alignItems = "center";

        // Rol Dropdown
        const roleSelect = document.createElement('select');
        roleSelect.style.background = "#2a2a3c";
        roleSelect.style.color = "#fff";
        roleSelect.style.border = "1px solid #444";
        roleSelect.style.borderRadius = "4px";
        roleSelect.style.padding = "2px 4px";

        ['user', 'admin'].forEach(roleOption => {
          const opt = document.createElement('option');
          opt.value = roleOption;
          opt.textContent = roleOption === 'admin' ? 'Admin' : 'Gebruiker';
          if (u.role === roleOption) opt.selected = true;
          roleSelect.appendChild(opt);
        });

        // Blokkeer het wijzigen van de hoofdadmin rol
        if (u.username === 'admin') {
          roleSelect.disabled = true;
        } else {
          roleSelect.addEventListener('change', (e) => changeUserRole(u.username, e.target.value));
        }

        // Wachtwoord Wijzigen Knop (🔑)
        const passBtn = document.createElement('button');
        passBtn.textContent = '🔑';
        passBtn.title = 'Wachtwoord wijzigen';
        passBtn.style.background = 'none';
        passBtn.style.border = 'none';
        passBtn.style.cursor = 'pointer';
        passBtn.style.fontSize = '1rem';
        passBtn.addEventListener('click', () => changeUserPassword(u.username));

        actionsDiv.appendChild(roleSelect);
        actionsDiv.appendChild(passBtn);

        // Verwijderknop (🗑️)
        if (u.username !== 'admin') {
          const deleteBtn = document.createElement('button');
          deleteBtn.textContent = '🗑️';
          deleteBtn.title = 'Gebruiker verwijderen';
          deleteBtn.style.background = 'none';
          deleteBtn.style.border = 'none';
          deleteBtn.style.cursor = 'pointer';
          deleteBtn.style.fontSize = '1rem';
          deleteBtn.addEventListener('click', () => deleteUser(u.username));
          actionsDiv.appendChild(deleteBtn);
        }

        li.appendChild(infoSpan);
        li.appendChild(actionsDiv);
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
      loadUsers();
    } else {
      alert("Fout bij aanmaken: " + (data.message || "Onbekende fout"));
    }
  } catch (err) {
    console.error("Fout tijdens toevoegen:", err);
    alert("Kan geen verbinding maken met de NAS.");
  }
}

// 3. WACHTWOORD WIJZIGEN
async function changeUserPassword(username) {
  const newPassword = prompt(`Voer een nieuw wachtwoord in voor gebruiker '${username}':`);
  if (!newPassword) return;

  try {
    const response = await fetch(`${API_BASE_URL}?action=change_password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username,
        newPassword: newPassword
      })
    });

    const data = await response.json();

    if (data.success) {
      alert(`Wachtwoord voor '${username}' is gewijzigd!`);
    } else {
      alert("Fout bij wijzigen: " + (data.message || "Onbekende fout"));
    }
  } catch (err) {
    console.error("Fout bij wijzigen wachtwoord:", err);
    alert("Kan geen verbinding maken met de NAS.");
  }
}

// 4. ROL WIJZIGEN
async function changeUserRole(username, newRole) {
  try {
    const response = await fetch(`${API_BASE_URL}?action=change_role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username,
        role: newRole
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log(`Rol van ${username} gewijzigd naar ${newRole}`);
    } else {
      alert("Fout bij aanpassen rol: " + (data.message || "Onbekende fout"));
      loadUsers(); // Reset de dropdown
    }
  } catch (err) {
    console.error("Fout bij aanpassen rol:", err);
    alert("Kan geen verbinding maken met de NAS.");
    loadUsers();
  }
}

// 5. GEBRUIKER VERWIJDEREN
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
      loadUsers();
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

// Maak functies globaal beschikbaar
window.loadAdminUsers = loadUsers;
window.AdminModule = {
  openAdminModal,
  closeAdminModal,
  loadUsers,
  changeUserPassword
};
