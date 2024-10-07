const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");
const path = require("path");

const API_BASE_URL = "https://api.real-debrid.com/rest/1.0";

const VIDEO_EXTENSIONS = [
    ".3gp",
    ".avi",
    ".divx",
    ".flv",
    ".iso",
    ".m2ts",
    ".m3u8",
    ".m4v",
    ".mkv",
    ".mov",
    ".mp4",
    ".mpeg",
    ".mpg",
    ".mts",
    ".rmvb",
    ".ts",
    ".vob",
    ".webm",
    ".wmv",
    ".xvid",
];

const SAMPLE_FILE_REGEX = /sample/i;

module.exports = function (config) {
    const apiKey = config.apiKey;
    const tmdbApiKey = config.tmdbApiKey;
    const omdbApiKey = config.omdbApiKey;

    const manifest = {
        id: "community.realdebrid",
        version: "0.0.2",
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

    function isSeries(filename) {
        const patterns = [
            /S\d{1,2}[\s_,.\-]?[Ee]\d{1,2}/i,
            /Season[\s_,.\-]?\d{1,2}/i,
            /\b\d{1,2}[\s_,.\-]?[xX][\s_,.\-]?\d{1,2}\b/i,
            /Episode[\s_,.\-]?\d{1,2}/i,
        ];

        return patterns.some((pattern) => pattern.test(filename));
    }

    function cleanFileName(filename) {
        let name = filename.replace(
            /\.(mkv|mp4|avi|wmv|flv|mov|webm|mpg|mpeg|iso|m4v|ts|m2ts|mts|m3u8|3gp|rmvb|vob|divx|xvid)$/i,
            ""
        );
        name = name.replace(/[\._]/g, " ");

        name = name.replace(/S\d{1,2}[\s_.-]?E\d{1,2}(?:-\d{1,2})?/gi, "");
        name = name.replace(/Season[\s_.-]?\d{1,2}/gi, "");
        name = name.replace(/\b\d{1,2}x\d{1,2}\b/gi, "");
        name = name.replace(/Episode[\s_.-]?(\d{1,2})/gi, "");

        let yearMatch = name.match(/\b(19|20)\d{2}\b/);
        let year = yearMatch ? yearMatch[0] : null;
        if (year) {
            name = name.replace(/\b(19|20)\d{2}\b/, "");
        }

        name = name.replace(
            /\b(1080p|720p|480p|2160p|4K|WEBRip|WEB-DL|BluRay|HDRip|BRRip|x264|x265|H\.?264|H\.?265|HEVC|DVDRip|DVDScr|CAM|TS|HDTS|R5|HDR|SDR|AAC|DDP\d+\.\d+|DDP|DD|DTS|Atmos|TrueHD|MP3|FLAC|EAC3|AC3|HQ|Hi10P|10bit|AVC|DivX|XviD|Subbed|Subtitle|Hindi|Dual Audio|Dubbed|Multi|ENG|HIN|SPA|FRE|GER|ITA|JAP|KOR|VOSTFR|AMZN|NF|HDCAM|HC|Rip|_)/gi,
            ""
        );
        name = name.replace(/\s+/g, " ").trim();
        return { title: name, year };
    }

    async function fetchTorrents() {
        if (!apiKey) return [];
        try {
            const response = await axios.get(`${API_BASE_URL}/torrents`, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            });
            return response.data;
        } catch (error) {
            console.error("Fetch Torrents Error:", error.message);
            return [];
        }
    }

    async function fetchTorrentInfo(torrentId) {
        if (!apiKey) return null;
        try {
            const response = await axios.get(
                `${API_BASE_URL}/torrents/info/${torrentId}`,
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                    },
                }
            );
            return response.data;
        } catch (error) {
            console.error(
                `Fetch Torrent Info Error for Torrent ID ${torrentId}:`,
                error.message
            );
            return null;
        }
    }

    async function getMetadata(title, year, type) {
        let metadata = null;

        if (tmdbApiKey) {
            metadata = await fetchTmdbMetadata(title, year, type);
        }

        if (omdbApiKey && !metadata) {
            metadata = await fetchOmdbMetadata(title, year, type);
        }

        if (tmdbApiKey && !metadata) {
            metadata = await fetchTmdbMetadata(title, null, type);
        }

        return metadata;
    }

    async function fetchTmdbMetadata(title, year, type) {
        const tmdbBaseUrl = "https://api.themoviedb.org/3";
        const queryType = type === "movie" ? "movie" : "tv";
        try {
            const response = await axios.get(
                `${tmdbBaseUrl}/search/${queryType}`,
                {
                    params: {
                        api_key: tmdbApiKey,
                        query: title,
                        year: year || undefined,
                        include_adult: false,
                    },
                }
            );
            if (response.data.results && response.data.results.length > 0) {
                return {
                    source: "tmdb",
                    data: response.data.results[0],
                };
            }
        } catch (error) {
            console.error("TMDb API Error:", error.message);
        }
        return null;
    }

    async function fetchOmdbMetadata(title, year, type) {
        try {
            const params = {
                apikey: omdbApiKey,
                t: title,
                type: type === "movie" ? "movie" : "series",
            };
            if (year) {
                params.y = year;
            }

            const response = await axios.get("https://www.omdbapi.com/", {
                params,
            });

            if (response.data && response.data.Response !== "False") {
                return {
                    source: "omdb",
                    data: response.data,
                };
            }
        } catch (error) {
            console.error("OMDb API Error:", error.message);
        }
        return null;
    }

    function parseEpisodes(files) {
        const episodes = [];

        files.forEach((file, index) => {
            const ext = path.extname(file.path).toLowerCase();
            const filename = path.basename(file.path);

            if (
                !VIDEO_EXTENSIONS.includes(ext) ||
                SAMPLE_FILE_REGEX.test(filename)
            ) {
                return;
            }

            const patterns = [
                /S(\d{1,2})[\s_.-]?E(\d{1,2})/i,
                /Season[\s_.-]?(\d{1,2})[\s_.-]?Episode[\s_.-]?(\d{1,2})/i,
                /(\d{1,2})x(\d{1,2})/i,
                /Episode[\s_.-]?(\d{1,2})/i,
            ];

            let season = null;
            let episode = null;

            for (const pattern of patterns) {
                const match = filename.match(pattern);
                if (match) {
                    if (match[1] && match[2]) {
                        season = parseInt(match[1], 10);
                        episode = parseInt(match[2], 10);
                    } else if (match[1]) {
                        season = 1;
                        episode = parseInt(match[1], 10);
                    }
                    break;
                }
            }

            if (season !== null && episode !== null) {
                episodes.push({
                    season,
                    episode,
                    title: filename,
                    fileId: file.id,
                    index,
                });
            } else {
                episodes.push({
                    season: 1,
                    episode: episodes.length + 1,
                    title: filename,
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
            return null;
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

            let filteredTorrents = torrents.filter((torrent) => {
                const isSeriesTorrent = isSeries(torrent.filename);
                return (
                    (type === "movie" && !isSeriesTorrent) ||
                    (type === "series" && isSeriesTorrent)
                );
            });

            if (extra && extra.search) {
                const search = extra.search.toLowerCase();
                filteredTorrents = filteredTorrents.filter((torrent) =>
                    torrent.filename.toLowerCase().includes(search)
                );
            }

            const metas = [];
            for (const torrent of filteredTorrents) {
                const { title, year } = cleanFileName(torrent.filename);
                const metadata = await getMetadata(title, year, type);

                if (metadata) {
                    if (
                        metadata.source === "tmdb" &&
                        metadata.data.poster_path
                    ) {
                        metas.push({
                            id: `rd:${encodeURIComponent(torrent.id)}`,
                            type,
                            name: metadata.data.title || metadata.data.name,
                            poster: `https://image.tmdb.org/t/p/w500${metadata.data.poster_path}`,
                            posterShape: "poster",
                            description: metadata.data.overview,
                            background: metadata.data.backdrop_path
                                ? `https://image.tmdb.org/t/p/original${metadata.data.backdrop_path}`
                                : "https://via.placeholder.com/800x450",
                        });
                    } else if (
                        metadata.source === "omdb" &&
                        metadata.data.Poster &&
                        metadata.data.Poster !== "N/A"
                    ) {
                        metas.push({
                            id: `rd:${encodeURIComponent(torrent.id)}`,
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
                            id: `rd:${encodeURIComponent(torrent.id)}`,
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
                        id: `rd:${encodeURIComponent(torrent.id)}`,
                        type,
                        name: title,
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

        const idParts = id.split(":");
        const torrentId = decodeURIComponent(idParts[1]);
        const fileId = parseInt(idParts[2], 10);
        const fileIndex = parseInt(idParts[3], 10);

        try {
            const torrentInfo = await fetchTorrentInfo(torrentId);
            if (!torrentInfo) {
                return { meta: null };
            }

            const { title, year } = cleanFileName(torrentInfo.filename);
            const metadata = await getMetadata(title, year, type);

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
                        background: metadata.data.backdrop_path
                            ? `https://image.tmdb.org/t/p/original${metadata.data.backdrop_path}`
                            : "https://via.placeholder.com/800x450",
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
                    name: title,
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

        const idParts = id.split(":");
        const torrentId = decodeURIComponent(idParts[1]);
        const fileId = parseInt(idParts[2], 10);
        const fileIndex = parseInt(idParts[3], 10);

        try {
            const torrentInfo = await fetchTorrentInfo(torrentId);
            if (!torrentInfo) {
                return { streams: [] };
            }
            const files = torrentInfo.files;
            const links = torrentInfo.links;

            if (type === "movie") {
                if (files.length > 0 && links.length > 0) {
                    const videoFiles = files.filter(
                        (f) =>
                            VIDEO_EXTENSIONS.includes(
                                path.extname(f.path).toLowerCase()
                            ) && !SAMPLE_FILE_REGEX.test(f.path)
                    );
                    if (videoFiles.length > 0) {
                        const file = videoFiles[0];
                        const linkIndex = files.indexOf(file);
                        const link = links[linkIndex];

                        if (!file || !link) {
                            return { streams: [] };
                        }

                        const unrestricted = await unrestrictLink(link);
                        if (!unrestricted) return { streams: [] };
                        const stream = {
                            title: file.path,
                            url: encodeURI(unrestricted.download),
                        };
                        return { streams: [stream] };
                    } else {
                        return { streams: [] };
                    }
                } else {
                    return { streams: [] };
                }
            } else if (type === "series") {
                if (
                    !isNaN(fileId) &&
                    !isNaN(fileIndex) &&
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
                        url: encodeURI(unrestricted.download),
                    };
                    return { streams: [stream] };
                } else {
                    return { streams: [] };
                }
            } else {
                return { streams: [] };
            }
        } catch (error) {
            console.error("Stream Handler Error:", error.message);
            return { streams: [] };
        }
    });

    return builder.getInterface();
};
