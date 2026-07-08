const axios = require("axios");
const qs = require("querystring");

let cachedID = null;

// Step 1: Ambil client_id dengan cara modern
async function getClientID() {
  if (cachedID) return cachedID;

  const homepage = await axios.get("https://soundcloud.com");
  const scriptUrls = [...homepage.data.matchAll(/<script crossorigin src="(.*?)"><\/script>/g)]
    .map(m => m[1]);

  if (!scriptUrls.length) throw new Error("Tidak menemukan bundle JS");

  // Step 2: ambil JS bundlenya satu per satu
  for (const script of scriptUrls) {
    try {
      const js = await axios.get(script);
      const match = js.data.match(/client_id:"(.*?)"/);
      if (match) {
        cachedID = match[1];
        return cachedID;
      }
    } catch (e) {}
  }

  throw new Error("Gagal mendapatkan client_id");
}

// Utility
function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}:${rem.toString().padStart(2, "0")}`;
}

function formatNumber(n) {
  if (!n) return "0";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

// Step 3: Search SoundCloud
async function searchSoundCloud(query, limit = 10) {
  const client_id = await getClientID();

  const params = {
    q: query,
    client_id,
    limit
  };

  const url = `https://api-v2.soundcloud.com/search/tracks?${qs.stringify(params)}`;

  const res = await axios.get(url);

  if (!res.data || !res.data.collection) {
      return [];
  }

  return res.data.collection.map(t => ({
    id: t.id,
    title: t.title,
    user: t.user?.username,
    duration: formatDuration(t.duration),
    plays: formatNumber(t.playback_count),
    url: t.permalink_url
  }));
}

module.exports = { searchSoundCloud };