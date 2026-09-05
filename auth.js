// auth.js
const NAS_API_URL = "https://karaokenas.synology.me:8444/karaoke/api.php";

async function loginAdmin(username, password) {
  try {
    const response = await fetch(`${NAS_API_URL}?action=login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (data.success) {
      // Sla het token op in de browser-geheugen
      localStorage.setItem('karaoke_admin_token', data.token);
      alert('Succesvol ingelogd als admin!');
      window.location.reload(); // Of stuur door naar je beheerderspagina
    } else {
      alert('Inloggen mislukt: ' + data.message);
    }
  } catch (error) {
    console.error('Fout bij verbinden met Synology NAS:', error);
    alert('Kan geen verbinding maken met de NAS.');
  }
}

function logoutAdmin() {
  localStorage.removeItem('karaoke_admin_token');
  alert('Uitgelogd.');
  window.location.reload();
}

function isAdminLoggedIn() {
  return localStorage.getItem('karaoke_admin_token') !== null;
}
