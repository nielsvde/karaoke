/**
 * admin.js - Gebruikersbeheer voor Beheerders
 */

const adminModal = document.getElementById('adminModal');
const btnCloseAdminModal = document.getElementById('btnCloseAdminModal');
const userList = document.getElementById('userList');
const btnAddUser = document.getElementById('btnAddUser');

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

async function loadUsers() {
  userList.innerHTML = "<li>Laden...</li>";
  try {
    const response = await fetch(`${NAS_INDEX_URL}?action=get_users`);
    const users = await response.json();

    userList.innerHTML = '';
    users.forEach(u => {
      const li = document.createElement('li');
      li.style.padding = "6px 0";
      li.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
      li.textContent = `${u.username} (${u.role})`;
      userList.appendChild(li);
    });
  } catch (err) {
    userList.innerHTML = "<li>Fout bij laden van gebruikers.</li>";
  }
}

document.addEventListener('DOMContentLoaded', () => {
  btnCloseAdminModal.addEventListener('click', closeAdminModal);
  btnAddUser.addEventListener('click', () => {
    alert("Gebruiker toevoegen functionaliteit kan hier geplaatst worden.");
  });
});

window.AdminModule = {
  openAdminModal
};