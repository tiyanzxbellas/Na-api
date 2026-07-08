const axios = require('axios');

const BASE_URL = 'https://lahelu.com';
const CDN_URL = 'https://cache.lahelu.com';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://lahelu.com',
    'Referer': 'https://lahelu.com/',
    'Accept': 'application/json, text/plain, */*'
};

const POST_FIELDS = {
    FETCH_FRESH: 6
};

function formatMediaUrl(value) {
    if (!value) return null;
    if (value.startsWith('http')) return value;
    return `${CDN_URL}/${value}`;
}

function formatPost(post) {
    let mediaUrl = null;
    let mediaType = null; // 0 image, 1 video
    
    // Cari konten media
    if (post.content && post.content.length > 0) {
        const mediaItem = post.content.find(c => c.type === 0 || c.type === 1);
        if (mediaItem) {
            mediaUrl = formatMediaUrl(mediaItem.value);
            mediaType = mediaItem.type === 1 ? 'video' : 'image';
        }
    }

    return {
        id: post.postID,
        title: post.title,
        user: post.userUsername,
        upvotes: post.totalUpvotes,
        comments: post.totalComments,
        createTime: post.createTime,
        isSensitive: !!post.isSensitive,
        media: mediaUrl,
        mediaType: mediaType,
        thumbnail: post.thumbnail ? formatMediaUrl(post.thumbnail) : null,
        postUrl: `${BASE_URL}/post/${post.postID}`,
        tags: post.hashtags || []
    };
}

async function getFreshFeed(cursor = 0) {
    try {
        const response = await axios.get(`${BASE_URL}/api/post/get-recommendations`, {
            headers: HEADERS,
            params: {
                field: POST_FIELDS.FETCH_FRESH,
                cursor: cursor
            }
        });

        if (response.data.$CODE) {
            throw new Error(`API Error Code: ${response.data.$CODE}`);
        }

        const data = response.data;
        const posts = (data.postInfos || []).map(formatPost);

        return {
            posts,
            nextCursor: data.nextCursor,
            hasMore: data.hasMore
        };

    } catch (error) {
        throw new Error(`Lahelu Feed Error: ${error.message}`);
    }
}

async function searchMeme(query, cursor = 0) {
    try {
        const response = await axios.get(`${BASE_URL}/api/post/get-search`, {
            headers: HEADERS,
            params: {
                query: query,
                cursor: cursor
            }
        });

        const data = response.data;
        const posts = (data.postInfos || []).map(formatPost);

        return {
            posts,
            nextCursor: data.nextCursor,
            hasMore: data.hasMore
        };

    } catch (error) {
        throw new Error(`Lahelu Search Error: ${error.message}`);
    }
}

module.exports = { getFreshFeed, searchMeme };