const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");

const API_BASE_URL = "https://api.real-debrid.com/rest/1.0";

module.exports = function (config) {
    const apiKey = config.apiKey;
    const tmdbApiKey = config.tmdbApiKey;
    const omdbApiKey = config.omdbApiKey;

    const manifest = {
        id: "community.realdebrid",
        version: "0.0.1",
        catalogs: [
            {
                type: "movie",
                id: "realdebrid_movies",
                name: "Real Debrid Movies",
                extra: [
                    {
                        name: "search",
                        isRequired: false,
                    },
                ],
            },
            {
                type: "series",
                id: "realdebrid_series",
                name: "Real Debrid Series",
                extra: [
                    {
                        name: "search",
                        isRequired: false,
                    },
                ],
            },
        ],
        resources: ["catalog", "meta", "stream"],
        types: ["movie", "series"],
        name: "Real Debrid",
        description:
            "Stream your Real Debrid files in Stremio. Disclaimer: This addon is not official and is not affiliated with the Real Debrid website.",
        idPrefixes: ["rd:"],
        logo: "https://i.ibb.co/JHmv8p6/Real-Debrid-Icon.png",
    };

    const builder = new addonBuilder(manifest);

    function cleanFileName(filename) {
        let name = filename
            .replace(/\.(mkv|mp4|avi|wmv|flv|mov|webm|mpg|mpeg|iso)$/i, "")
            .replace(/[\._]/g, " ")
            .replace(/\b\d{4}\b/g, "")
            .replace(
                /\b(1080p|720p|480p|2160p|4K|WEBRip|BluRay|x264|x265|H\.?264|H\.?265|HEVC|HDRip|BRRip|DVD|DVDRip|CAM|TS|HDTS|R5|HDRip|HDR|SDR|AAC|DDP\d+\.\d+|DDP|DD|DTS|Atmos|TrueHD|MP3|FLAC|EAC3|AC3|HQ|Hi10P|10bit|AVC|DivX|XviD|Subbed|Hindi|Dual Audio|Dubbed|Multi|ENG|HIN|SPA|FRE|GER|ITA|JAP|KOR|VOSTFR|AMZN|NF|WEB-DL|WEBRip|WEB|HDRip|HDCAM|HC)\b/gi,
                ""
            )
            .replace(/\s+/g, " ")
            .trim();
        name = name.split(/ - | – | \[ |\(/)[0].trim();
        return name;
    }

    async function fetchTorrents() {
        if (!apiKey) return [];
        const response = await axios.get(`${API_BASE_URL}/torrents`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });
        return response.data;
    }

    async function fetchTorrentInfo(torrentId) {
        if (!apiKey) return null;
        const response = await axios.get(
            `${API_BASE_URL}/torrents/info/${torrentId}`,
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            }
        );
        return response.data;
    }

    async function getMetadata(name, type) {
        let metadata = null;

        if (tmdbApiKey) {
            const tmdbBaseUrl = "https://api.themoviedb.org/3";
            const queryType = type === "movie" ? "movie" : "tv";
            try {
                const response = await axios.get(
                    `${tmdbBaseUrl}/search/${queryType}`,
                    {
                        params: {
                            api_key: tmdbApiKey,
                            query: name,
                        },
                    }
                );
                if (response.data.results && response.data.results.length > 0) {
                    metadata = {
                        source: "tmdb",
                        data: response.data.results[0],
                    };
                    return metadata;
                }
            } catch (error) {
                console.error("TMDb API Error:", error.message);
            }
        }

        if (omdbApiKey && !metadata) {
            try {
                const response = await axios.get("http://www.omdbapi.com/", {
                    params: {
                        apikey: omdbApiKey,
                        t: name,
                        type: type,
                    },
                });
                if (response.data && response.data.Response !== "False") {
                    metadata = {
                        source: "omdb",
                        data: response.data,
                    };
                    return metadata;
                }
            } catch (error) {
                console.error("OMDb API Error:", error.message);
            }
        }

        if (tmdbApiKey && !metadata) {
            const tmdbBaseUrl = "https://api.themoviedb.org/3";
            const queryType = type === "movie" ? "movie" : "tv";
            try {
                const response = await axios.get(
                    `${tmdbBaseUrl}/search/${queryType}`,
                    {
                        params: {
                            api_key: tmdbApiKey,
                            query: name,
                            include_adult: true,
                        },
                    }
                );
                if (response.data.results && response.data.results.length > 0) {
                    metadata = {
                        source: "tmdb",
                        data: response.data.results[0],
                    };
                    return metadata;
                }
            } catch (error) {
                console.error(
                    "TMDb API Error (second attempt):",
                    error.message
                );
            }
        }

        return null;
    }

    function parseEpisodes(files) {
        const episodes = [];

        files.forEach((file, index) => {
            const match = file.path.match(/S(\d+)[\s_.-]?E(\d+)/i);
            if (match) {
                const season = parseInt(match[1], 10);
                const episode = parseInt(match[2], 10);
                episodes.push({
                    season,
                    episode,
                    title: file.path,
                    fileId: file.id,
                    index,
                });
            } else {
                episodes.push({
                    season: 1,
                    episode: index + 1,
                    title: file.path,
                    fileId: file.id,
                    index,
                });
            }
        });

        return episodes;
    }

    async function unrestrictLink(link) {
        if (!apiKey) return null;
        try {
            const data = new URLSearchParams();
            data.append("link", link);

            const response = await axios.post(
                `${API_BASE_URL}/unrestrict/link`,
                data,
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                }
            );
            return response.data;
        } catch (error) {
            console.error("Unrestrict Link Error:", error.message);
            throw error;
        }
    }

    builder.defineCatalogHandler(async (args) => {
        const { type, extra } = args;

        try {
            let torrents = await fetchTorrents();
            if (!torrents || torrents.length === 0) {
                return { metas: [] };
            }
            torrents = torrents.filter(
                (torrent) => torrent.status === "downloaded"
            );

            let filteredTorrents = torrents.filter(
                (torrent) =>
                    (type === "movie" &&
                        !torrent.filename.toLowerCase().includes("s0")) ||
                    (type === "series" &&
                        torrent.filename.toLowerCase().includes("s0"))
            );

            if (extra && extra.search) {
                const search = extra.search.toLowerCase();
                filteredTorrents = filteredTorrents.filter((torrent) =>
                    torrent.filename.toLowerCase().includes(search)
                );
            }

            const metas = [];
            for (const torrent of filteredTorrents) {
                const name = cleanFileName(torrent.filename);
                const metadata = await getMetadata(name, type);
                console.log(
                    "Catalog Handler - metadata for",
                    name,
                    ":",
                    metadata
                );
                if (metadata) {
                    if (
                        metadata.source === "tmdb" &&
                        metadata.data.poster_path
                    ) {
                        metas.push({
                            id: `rd:${torrent.id}`,
                            type,
                            name: metadata.data.title || metadata.data.name,
                            poster: `https://image.tmdb.org/t/p/w500${metadata.data.poster_path}`,
                            posterShape: "poster",
                            description: metadata.data.overview,
                            background: `https://image.tmdb.org/t/p/original${metadata.data.backdrop_path}`,
                        });
                    } else if (
                        metadata.source === "omdb" &&
                        metadata.data.Poster &&
                        metadata.data.Poster !== "N/A"
                    ) {
                        metas.push({
                            id: `rd:${torrent.id}`,
                            type,
                            name: metadata.data.Title,
                            poster: metadata.data.Poster,
                            posterShape: "poster",
                            description: metadata.data.Plot,
                            background: metadata.data.Poster,
                        });
                    } else {
                        const posterPath = metadata.data.poster_path
                            ? `https://image.tmdb.org/t/p/w500${metadata.data.poster_path}`
                            : "https://via.placeholder.com/150";

                        metas.push({
                            id: `rd:${torrent.id}`,
                            type,
                            name: metadata.data.title || metadata.data.name,
                            poster: posterPath,
                            posterShape: "poster",
                            description:
                                metadata.data.overview ||
                                "No description available",
                            background: metadata.data.backdrop_path
                                ? `https://image.tmdb.org/t/p/original${metadata.data.backdrop_path}`
                                : "https://via.placeholder.com/800x450",
                        });
                    }
                } else {
                    metas.push({
                        id: `rd:${torrent.id}`,
                        type,
                        name: name,
                        poster: "https://via.placeholder.com/150",
                        posterShape: "poster",
                        description: "No description available",
                        background: "https://via.placeholder.com/800x450",
                    });
                }
            }

            return { metas };
        } catch (error) {
            console.error("Catalog Handler Error:", error.message);
            return { metas: [] };
        }
    });

    builder.defineMetaHandler(async (args) => {
        const { type, id } = args;

        const torrentId = id.replace(/^rd:/, "").split(":")[0];

        try {
            const torrentInfo = await fetchTorrentInfo(torrentId);
            if (!torrentInfo) {
                return { meta: null };
            }

            const name = cleanFileName(torrentInfo.filename);
            const metadata = await getMetadata(name, type);
            console.log("Meta Handler - metadata:", metadata);

            let meta;
            if (metadata) {
                if (metadata.source === "tmdb" && metadata.data.poster_path) {
                    meta = {
                        id,
                        type,
                        name: metadata.data.title || metadata.data.name,
                        poster: `https://image.tmdb.org/t/p/w500${metadata.data.poster_path}`,
                        posterShape: "poster",
                        description: metadata.data.overview,
                        background: `https://image.tmdb.org/t/p/original${metadata.data.backdrop_path}`,
                        videos: [],
                    };
                } else if (
                    metadata.source === "omdb" &&
                    metadata.data.Poster &&
                    metadata.data.Poster !== "N/A"
                ) {
                    meta = {
                        id,
                        type,
                        name: metadata.data.Title,
                        poster: metadata.data.Poster,
                        posterShape: "poster",
                        description: metadata.data.Plot,
                        background: metadata.data.Poster,
                        videos: [],
                    };
                } else {
                    meta = {
                        id,
                        type,
                        name: metadata.data.title || metadata.data.name,
                        poster: metadata.data.poster_path
                            ? `https://image.tmdb.org/t/p/w500${metadata.data.poster_path}`
                            : "https://via.placeholder.com/150",
                        posterShape: "poster",
                        description:
                            metadata.data.overview ||
                            "No description available",
                        background: metadata.data.backdrop_path
                            ? `https://image.tmdb.org/t/p/original${metadata.data.backdrop_path}`
                            : "https://via.placeholder.com/800x450",
                        videos: [],
                    };
                }
            } else {
                meta = {
                    id,
                    type,
                    name: name,
                    poster: "https://via.placeholder.com/150",
                    posterShape: "poster",
                    description: "No description available",
                    background: "https://via.placeholder.com/800x450",
                    videos: [],
                };
            }

            if (type === "series") {
                const episodes = parseEpisodes(torrentInfo.files);
                meta.videos = episodes.map((episode) => ({
                    id: `${id}:${episode.fileId}:${episode.index}`,
                    title: `S${episode.season} E${episode.episode}`,
                    season: episode.season,
                    episode: episode.episode,
                    released: new Date().toISOString(),
                }));
            }

            return { meta };
        } catch (error) {
            console.error("Meta Handler Error:", error.message);
            return { meta: null };
        }
    });

    builder.defineStreamHandler(async (args) => {
        const { type, id } = args;

        const torrentId = id.replace(/^rd:/, "").split(":")[0];

        try {
            const torrentInfo = await fetchTorrentInfo(torrentId);
            if (!torrentInfo) {
                return { streams: [] };
            }
            const files = torrentInfo.files;
            const links = torrentInfo.links;

            console.log("Stream Handler - torrentId:", torrentId);
            console.log("Stream Handler - files:", files);
            console.log("Stream Handler - links:", links);

            if (type === "movie") {
                if (files.length > 0 && links.length > 0) {
                    const file = files[0];
                    const link = links[0];

                    const unrestricted = await unrestrictLink(link);
                    if (!unrestricted) return { streams: [] };
                    const stream = {
                        title: file.path,
                        url: unrestricted.download,
                    };
                    return { streams: [stream] };
                } else {
                    return { streams: [] };
                }
            } else if (type === "series") {
                const idParts = id.split(":");
                const fileId = parseInt(idParts[1], 10);
                const fileIndex = parseInt(idParts[2], 10);

                if (
                    files[fileIndex] &&
                    files[fileIndex].id === fileId &&
                    links[fileIndex]
                ) {
                    const file = files[fileIndex];
                    const link = links[fileIndex];

                    const unrestricted = await unrestrictLink(link);
                    if (!unrestricted) return { streams: [] };
                    const stream = {
                        title: file.path,
                        url: unrestricted.download,
                    };
                    return { streams: [stream] };
                } else {
                    console.error(
                        "File not found or link missing for fileId:",
                        fileId
                    );
                    return { streams: [] };
                }
            } else {
                return { streams: [] };
            }
        } catch (error) {
            console.error("Stream Handler Error:", error.message);
            console.error(error);
            return { streams: [] };
        }
    });

    return builder.getInterface();
};
