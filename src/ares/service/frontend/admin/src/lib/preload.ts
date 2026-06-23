let data: { adminAppClientId: string; authUrl: string; adminUrl: string };

let el = document.getElementById('preload-data');
if (el?.textContent) {
  data = JSON.parse(el.textContent);
} else {
  throw new Error('Preload data not found');
}

export let preload = data!;
