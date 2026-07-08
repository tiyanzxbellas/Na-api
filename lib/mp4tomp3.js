const axios = require('axios');

async function convertMp4ToMp3(fileUrl) {
    if (!fileUrl) throw new Error("URL MP4 wajib diisi.");

    const api = axios.create({
        baseURL: 'https://api.freeconvert.com/v1',
        headers: {
            'Authorization': 'Bearer null',
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    // 1. Create Job
    const payload = {
        "tasks": {
            "import": {
                "operation": "import/url",
                "url": fileUrl,
                "filename": "video.mp4"
            },
            "convert": {
                "operation": "convert",
                "input": "import",
                "input_format": "mp4",
                "output_format": "mp3",
                "options": {
                    "audio_codec": "auto",
                    "audio_filter_volume": 100,
                    "audio_filter_fade_in": false,
                    "audio_filter_fade_out": false,
                    "audio_filter_reverse": false
                }
            },
            "export-url": {
                "operation": "export/url",
                "input": "convert"
            }
        }
    };

    const initRes = await api.post('/process/jobs', payload);
    const jobId = initRes.data.id;

    return {
        jobId,
        checkStatus: async () => {
            const statusRes = await api.get(`/process/jobs/${jobId}`);
            const jobData = statusRes.data;

            if (jobData.status === 'completed') {
                const exportTask = jobData.tasks.find(t => t.name === 'export-url');
                if (exportTask && exportTask.result) {
                    return { status: 'completed', url: exportTask.result.url };
                }
            } else if (jobData.status === 'failed') {
                throw new Error("Konversi gagal di sisi server.");
            }
            return { status: jobData.status };
        }
    };
}

module.exports = { convertMp4ToMp3 };