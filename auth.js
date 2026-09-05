/**
 * auth.js - Authenticatie & Sessiebeheer
 */

let currentUser = null;

const btnLoginModal = document.getElementById('btnLoginModal');
const authModal = document.getElementById('authModal');
const btnCloseAuthModal = document.getElementById('btnCloseAuthModal');
const loginForm = document.getElementById('loginForm');

function openAuthModal() {
  if (currentUser) {
    if (currentUser.role === 'admin') {
      window.AdminModule?.openAdminModal();
    } else {
      alert(`Ingelogd als: ${currentUser.username}`);
    }
  } else {
    authModal.classList.add('open');
  }
}

function closeAuthModal() {
  authModal.classList.remove('open');
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUser').value;
  const pin = document.getElementById('loginPin').value;

  try {
    const response = await fetch(`${NAS_INDEX_URL}?action=login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, pin })
    });

    const result = await response.json();

    if (result.success) {
      currentUser = result.user;
      closeAuthModal();
      btnLoginModal.textContent = `👤 ${currentUser.username}`;
      if (currentUser.role === 'admin') {
        window.AdminModule?.openAdminModal();
      }
    } else {
      alert("Inloggen mislukt: " + (result.message || "Onjuiste gegevens."));
    }
  } catch (err) {
    console.error("Auth Fout:", err);
    alert("Netwerkfout bij inloggen.");
  }
}

document.addEventListener('DOMContentLoaded', () => {
  btnLoginModal.addEventListener('click', openAuthModal);
  btnCloseAuthModal.addEventListener('click', closeAuthModal);
  loginForm.addEventListener('submit', handleLogin);
});

window.AuthModule = {
  getCurrentUser: () => currentUser
};