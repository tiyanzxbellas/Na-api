const axios = require('axios');

/**
 * SoundCloud Professional Scraper
 * Fitur: Dynamic Client ID Discovery + Playlist Hydration
 */
class SoundCloudScraper {
    constructor() {
        this.baseUrl = 'https://api-mobi.soundcloud.com';
        this.clientId = null;
        this.client = axios.create({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
            }
        });
    }

    /**
     * Mencari Client ID secara dinamis dari file JS SoundCloud
     */
    async findClientId() {
        try {
            const home = await this.client.get('https://soundcloud.com');
            const scriptUrls = home.data.match(/https?:\/\/[^"'>]+\.js/g) || [];
            
            for (const url of scriptUrls.reverse()) {
                try {
                    const js = await this.client.get(url);
                    const match = js.data.match(/client_id:["']([a-zA-Z0-9]{32})["']/);
                    if (match) {
                        this.clientId = match[1];
                        return this.clientId;
                    }
                } catch (e) {
                    continue;
                }
            }
            throw new Error("Tidak dapat menemukan Client ID.");
        } catch (error) {
            throw new Error(`Gagal mendapatkan Client ID: ${error.message}`);
        }
    }

    formatDuration(ms) {
        if (!ms) return "00:00";
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    async getPlaylistWithFullTracks(url) {
        if (!this.clientId) {
            await this.findClientId();
        }

        try {
            const resolve = await this.client.get(`${this.baseUrl}/resolve`, { 
                params: { url, client_id: this.clientId } 
            });
            const playlistId = resolve.data.id;
            
            const plRes = await this.client.get(`${this.baseUrl}/playlists/${playlistId}`, { 
                params: { client_id: this.clientId } 
            });

            let tracks = plRes.data.tracks || [];
            const incompleteIds = tracks.filter(t => !t.title).map(t => t.id);

            if (incompleteIds.length > 0) {
                let fullTracks = tracks.filter(t => t.title);
                
                for (let i = 0; i < incompleteIds.length; i += 50) {
                    const batch = incompleteIds.slice(i, i + 50).join(',');
                    const trackRes = await this.client.get(`${this.baseUrl}/tracks`, {
                        params: { ids: batch, client_id: this.clientId }
                    });
                    fullTracks = fullTracks.concat(trackRes.data);
                }
                
                const trackMap = new Map(fullTracks.map(t => [t.id, t]));
                tracks = tracks.map(t => trackMap.get(t.id)).filter(t => t);
            }

            return {
                title: plRes.data.title,
                user: plRes.data.user?.username,
                thumbnail: plRes.data.artwork_url?.replace('large', 't500x500'),
                count: tracks.length,
                tracks: tracks.map((t, i) => ({
                    no: i + 1,
                    title: t.title,
                    duration: this.formatDuration(t.duration),
                    url: t.permalink_url,
                    thumbnail: t.artwork_url
                }))
            };

        } catch (error) {
            if (error.response?.status === 401) {
                this.clientId = null;
                return this.getPlaylistWithFullTracks(url);
            }
            throw new Error(error.message);
        }
    }
}

module.exports = SoundCloudScraper;