const { addonBuilder } = require("stremio-addon-sdk");
const axios = require("axios");
const path = require("path");
const pkg = require("./package.json");

const METADATA_CACHE_TTL = 86400000;
const RD_CACHE_TTL = 60000;

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

const SAMPLE_FILE_REGEX = /sample|trailer|promo/i;

module.exports = function (config) {
    const apiKey = config.apiKey;
    const tmdbApiKey = config.tmdbApiKey;
    const omdbApiKey = config.omdbApiKey;

    const manifest = {
        id: "community.realdebrid",
        version: pkg.version,
        name: "Real Debrid",
        description:
            "Stream your Real Debrid files in Stremio. Disclaimer: This addon is not official and is not affiliated with the Real Debrid website.",
        resources: ["catalog", "meta", "stream"],
        types: ["movie", "series"],
        catalogs: [
            {
                type: "movie",
                id: "realdebrid_movies_torrents",
                name: "RD Movies (Torrents)",
                extra: [{ name: "search", isRequired: false }],
            },
            {
                type: "series",
                id: "realdebrid_series_torrents",
                name: "RD Series (Torrents)",
                extra: [{ name: "search", isRequired: false }],
            },
            {
                type: "movie",
                id: "realdebrid_movies_downloads",
                name: "RD Movies (Downloads)",
                extra: [{ name: "search", isRequired: false }],
            },
            {
                type: "series",
                id: "realdebrid_series_downloads",
                name: "RD Series (Downloads)",
                extra: [{ name: "search", isRequired: false }],
            },
        ],
        idPrefixes: ["rd:"],
        logo: "https://raw.githubusercontent.com/SHSharkar/Stremio-Real-Debrid-Addon/refs/heads/main/icon/logo.png",
    };

    const builder = new addonBuilder(manifest);

    const metadataCache = new Map();
    const torrentsCache = { data: null, timestamp: 0 };
    const downloadsCache = { data: null, timestamp: 0 };

    function isSeries(filename) {
        const patterns = [
            /S\d{1,2}[\s_,.\-]?[Ee]\d{1,2}/i,
            /Season[\s_,.\-]?\d{1,2}/i,
            /\b\d{1,2}[\s_,.\-]?[xX][\s_,.\-]?\d{1,2}\b/i,
            /Episode[\s_,.\-]?\d{1,2}/i,
        ];
        return patterns.some((pattern) => pattern.test(filename));
    }

    function isVideoFile(filePath) {
        if (!filePath) return false;
        const ext = path.extname(filePath).toLowerCase();
        if (!VIDEO_EXTENSIONS.includes(ext)) return false;
        const base = path.basename(filePath);
        if (SAMPLE_FILE_REGEX.test(base)) return false;
        return true;
    }

    function cleanFileName(filename) {
        let name = filename;
        name = name.replace(/\.[^/.]+$/, "");
        name = name.replace(/[._]/g, " ");
        const patterns = [
            /([\w\s]+?)[\s]*[\(\[\{]?(\d{4})[\)\]\}]?[\s]*[\-\.]?/i,
            /([\w\s]+?)[\s]*[\-\.][\s]*(\d{4})/i,
        ];
        let match = null;
        for (const pattern of patterns) {
            match = name.match(pattern);
            if (match) break;
        }
        let title = name;
        let year = null;
        if (match) {
            title = match[1].trim();
            year = match[2];
        }

        const knownPatterns = [
            /^(19|20)\d{2}$/,
            /^(1080p|720p|480p|2160p|4K|DS4K|ESP|2K|3D|iMAX|AMZN|WEBRip|WEB[- ]?DL|BluRay|HDRip|BRRip|BDRip|BDRemux|Remux|DVDRip|DVDScr|CAM|TS|HDTS|R5|HDR|SDR|HDCAM|HC|Rip|WEB|HDR|DV|HEVC|x264|x265|H\.?264|H\.?265|AVC|DivX|XviD|10bit|Hi10P)$/i,
            /^(DTS|AAC(?:[\s\d\.]+)?|AC3|DDP(?:[\s\d\.]+)?|DD(?:[\s\d\.]+)?|TrueHD|FLAC|EAC3|MP3|OGG|WMA|Atmos|MIXED|Dolby\s?Digital\s?Plus|Dolby|DTS-HD|MA|HDTV|Remastered|PCM|DD|DDP|5\.1|5\.1CH|7\.1|7\.1CH|2\.0|2\.0CH)$/i,
            /^(Hindi|English|French|Spanish|German|Italian|Japanese|Korean|Dual[\s]?Audio|Dub|Dubbed|Multi|ENG|HIN|SPA|FRE|GER|ITA|JAP|KOR|Urdu)$/i,
            /^(ESub|EngSub|Subbed|Subtitle|Subs|Sub|ESubs)$/i,
            /^(mkvCinemas|MVGroup|SP3LL|GOPIHD|KatmovieHD|CHIOS|Musafirboy)$/i,
            /^S\d{1,2}[\s.-]?E\d{1,2}(?:-\d{1,2})?$/i,
            /^Season[\s.-]?\d{1,2}$/i,
            /^\d{1,2}x\d{1,2}$/i,
            /^Episode[\s.-]?(\d{1,2})$/i,
            /^[\[\(\{].*[\]\)\}]$/,
            /^[\-~]\s*\w+/,
        ];
        let parts = title.split(/\s+/);
        parts = parts.filter(
            (part) => !knownPatterns.some((regex) => regex.test(part)),
        );
        title = parts
            .map(
                (word) =>
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
            )
            .join(" ");
        const displayName = year ? `${title} (${year})` : title;
        return { title: displayName, searchTitle: title, year };
    }

    async function fetchTorrents() {
        if (!apiKey) return [];
        if (
            torrentsCache.data &&
            Date.now() - torrentsCache.timestamp < RD_CACHE_TTL
        ) {
            return torrentsCache.data;
        }
        try {
            const response = await axios.get(`${API_BASE_URL}/torrents`, {
                headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (!response.data) return [];
            torrentsCache.data = response.data;
            torrentsCache.timestamp = Date.now();
            return response.data;
        } catch (error) {
            return [];
        }
    }

    async function fetchDownloads() {
        if (!apiKey) return [];
        if (
            downloadsCache.data &&
            Date.now() - downloadsCache.timestamp < RD_CACHE_TTL
        ) {
            return downloadsCache.data;
        }
        try {
            const response = await axios.get(`${API_BASE_URL}/downloads`, {
                headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (!response.data) return [];
            downloadsCache.data = response.data;
            downloadsCache.timestamp = Date.now();
            return response.data;
        } catch (error) {
            return [];
        }
    }

    async function fetchTorrentInfo(torrentId) {
        if (!apiKey) return null;
        try {
            const response = await axios.get(
                `${API_BASE_URL}/torrents/info/${torrentId}`,
                {
                    headers: { Authorization: `Bearer ${apiKey}` },
                },
            );
            if (!response.data) return null;
            return response.data;
        } catch (error) {
            return null;
        }
    }

    async function unrestrictLink(link) {
        if (!apiKey || !link) return null;
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
                },
            );
            if (!response.data) return null;
            return response.data;
        } catch (error) {
            return null;
        }
    }

    async function fetchTmdbMetadata(searchTitle, type, year) {
        const base = "https://api.themoviedb.org/3";
        const queryType = type === "movie" ? "movie" : "tv";
        try {
            const params = {
                api_key: tmdbApiKey,
                query: searchTitle,
                include_adult: false,
            };
            if (year) {
                if (type === "movie") params.year = year;
                else params.first_air_date_year = year;
            }
            const response = await axios.get(`${base}/search/${queryType}`, {
                params,
            });
            if (
                response.data &&
                response.data.results &&
                response.data.results.length > 0
            ) {
                return { source: "tmdb", data: response.data.results[0] };
            }
        } catch (err) {}
        return null;
    }

    async function fetchOmdbMetadata(searchTitle, type, year) {
        try {
            const params = {
                apikey: omdbApiKey,
                t: searchTitle,
                type: type === "movie" ? "movie" : "series",
            };
            if (year) params.y = year;
            const response = await axios.get("https://www.omdbapi.com/", {
                params,
            });
            if (response.data && response.data.Response !== "False") {
                return { source: "omdb", data: response.data };
            }
        } catch (err) {}
        return null;
    }

    async function getMetadata(title, type, year) {
        const cacheKey = `${type}:${title}:${year || ""}`;
        const cachedData = metadataCache.get(cacheKey);
        if (
            cachedData &&
            Date.now() - cachedData.timestamp < METADATA_CACHE_TTL
        ) {
            return cachedData.metadata;
        }
        let metadata = null;
        let searchTitle = title.toLowerCase();
        if (tmdbApiKey) {
            metadata = await fetchTmdbMetadata(searchTitle, type, year);
        }
        if (!metadata && omdbApiKey) {
            metadata = await fetchOmdbMetadata(searchTitle, type, year);
        }
        if (!metadata) {
            const words = searchTitle.split(" ");
            if (words.length > 1) {
                words.pop();
                searchTitle = words.join(" ");
                if (tmdbApiKey) {
                    metadata = await fetchTmdbMetadata(searchTitle, type, year);
                }
                if (!metadata && omdbApiKey) {
                    metadata = await fetchOmdbMetadata(searchTitle, type, year);
                }
            }
        }
        if (metadata) {
            metadataCache.set(cacheKey, { metadata, timestamp: Date.now() });
        }
        return metadata;
    }

    function formatFileSize(bytes) {
        if (!bytes || bytes <= 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    function formatDate(dateString) {
        if (!dateString) return "";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "";
        const optionsTime = {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        };
        const optionsDate = {
            day: "numeric",
            month: "long",
            year: "numeric",
        };
        const timePart = date.toLocaleString("en-US", optionsTime);
        const datePart = date.toLocaleDateString("en-US", optionsDate);
        return `${timePart} - ${datePart}`;
    }

    function parseEpisodes(files) {
        const episodes = [];
        if (!files || files.length === 0) return episodes;
        files.forEach((file, index) => {
            if (!isVideoFile(file.path)) return;
            const filename = path.basename(file.path);
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

    function parseEpisodesFromDownloads(filename) {
        const episodes = [];
        if (!filename) return episodes;
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
                index: 0,
            });
        } else {
            episodes.push({
                season: 1,
                episode: 1,
                title: filename,
                index: 0,
            });
        }
        return episodes;
    }

    builder.defineCatalogHandler(async (args) => {
        const { type, id, extra } = args;
        try {
            let items = [];
            if (
                id === "realdebrid_movies_torrents" ||
                id === "realdebrid_series_torrents"
            ) {
                let torrents = await fetchTorrents();
                if (!torrents) torrents = [];
                torrents = torrents.filter((t) => t.status === "downloaded");
                torrents.sort((a, b) => new Date(b.added) - new Date(a.added));
                let filteredTorrents = torrents.filter((t) => {
                    const seriesFlag = isSeries(t.filename);
                    return (
                        (type === "movie" && !seriesFlag) ||
                        (type === "series" && seriesFlag)
                    );
                });
                if (extra && extra.search) {
                    const searchText = extra.search.toLowerCase();
                    filteredTorrents = filteredTorrents.filter((t) =>
                        t.filename.toLowerCase().includes(searchText),
                    );
                }
                items = items.concat(
                    filteredTorrents.map((t) => ({
                        source: "torrent",
                        data: t,
                    })),
                );
            } else if (
                id === "realdebrid_movies_downloads" ||
                id === "realdebrid_series_downloads"
            ) {
                let downloads = await fetchDownloads();
                if (!downloads) downloads = [];
                downloads.sort(
                    (a, b) => new Date(b.generated) - new Date(a.generated),
                );
                let filteredDownloads = downloads.filter((d) => {
                    if (!d.filename) return false;
                    const ext = path.extname(d.filename).toLowerCase();
                    const isStreamable = d.streamable === 1;
                    const isSeriesDownload = isSeries(d.filename);
                    return (
                        VIDEO_EXTENSIONS.includes(ext) &&
                        !SAMPLE_FILE_REGEX.test(d.filename) &&
                        isStreamable &&
                        ((type === "movie" && !isSeriesDownload) ||
                            (type === "series" && isSeriesDownload))
                    );
                });
                if (extra && extra.search) {
                    const searchText = extra.search.toLowerCase();
                    filteredDownloads = filteredDownloads.filter((d) =>
                        d.filename.toLowerCase().includes(searchText),
                    );
                }
                items = items.concat(
                    filteredDownloads.map((d) => ({
                        source: "download",
                        data: d,
                    })),
                );
            } else {
                return { metas: [] };
            }

            async function processItem(item) {
                const { filename } = item.data;
                const {
                    title: displayName,
                    searchTitle,
                    year,
                } = cleanFileName(filename);
                const metadata = await getMetadata(searchTitle, type, year);
                let metaItem = {
                    id: `rd:${encodeURIComponent(item.data.id)}:${item.source}`,
                    type,
                    name: displayName,
                    poster: "",
                    posterShape: "poster",
                    description: "",
                    background: "",
                };
                if (metadata) {
                    if (
                        metadata.source === "tmdb" &&
                        metadata.data.poster_path
                    ) {
                        metaItem = {
                            ...metaItem,
                            name:
                                metadata.data.title ||
                                metadata.data.name ||
                                displayName,
                            poster: `https://image.tmdb.org/t/p/w500${metadata.data.poster_path}`,
                            description: metadata.data.overview || "",
                            background: metadata.data.backdrop_path
                                ? `https://image.tmdb.org/t/p/original${metadata.data.backdrop_path}`
                                : "",
                            genres: metadata.data.genres
                                ? metadata.data.genres.map((g) => g.name)
                                : [],
                            releaseInfo: metadata.data.release_date || "",
                            director: metadata.data.director || "",
                            cast: metadata.data.cast
                                ? metadata.data.cast.map((c) => c.name)
                                : [],
                            runtime: metadata.data.runtime
                                ? `${metadata.data.runtime} min`
                                : "",
                            language: metadata.data.original_language || "",
                            country: metadata.data.production_countries
                                ? metadata.data.production_countries
                                      .map((c) => c.name)
                                      .join(", ")
                                : "",
                        };
                    } else if (
                        metadata.source === "omdb" &&
                        metadata.data.Poster &&
                        metadata.data.Poster !== "N/A"
                    ) {
                        metaItem = {
                            ...metaItem,
                            name: metadata.data.Title || displayName,
                            poster: metadata.data.Poster || "",
                            description: metadata.data.Plot || "",
                            background: metadata.data.Poster || "",
                            genres: metadata.data.Genre
                                ? metadata.data.Genre.split(", ")
                                : [],
                            releaseInfo: metadata.data.Released || "",
                            director: metadata.data.Director || "",
                            cast: metadata.data.Actors
                                ? metadata.data.Actors.split(", ")
                                : [],
                            runtime: metadata.data.Runtime || "",
                            language: metadata.data.Language || "",
                            country: metadata.data.Country || "",
                        };
                    }
                }
                return metaItem;
            }

            const metas = await Promise.all(
                items.map((item) => processItem(item)),
            );
            return { metas };
        } catch (error) {
            return { metas: [] };
        }
    });

    builder.defineMetaHandler(async (args) => {
        const { type, id } = args;
        const parts = id.split(":");
        const itemId = decodeURIComponent(parts[1]);
        const source = parts[2];
        try {
            let metaItem = null;
            if (source === "torrent") {
                const torrentInfo = await fetchTorrentInfo(itemId);
                if (!torrentInfo) {
                    return { meta: null };
                }
                const {
                    title: displayName,
                    searchTitle,
                    year,
                } = cleanFileName(torrentInfo.filename);
                const metadata = await getMetadata(searchTitle, type, year);
                metaItem = {
                    id,
                    type,
                    name: displayName,
                    poster: "",
                    posterShape: "poster",
                    description: "",
                    background: "",
                    videos: [],
                };
                if (metadata) {
                    if (
                        metadata.source === "tmdb" &&
                        metadata.data.poster_path
                    ) {
                        metaItem = {
                            ...metaItem,
                            name:
                                metadata.data.title ||
                                metadata.data.name ||
                                displayName,
                            poster: `https://image.tmdb.org/t/p/w500${metadata.data.poster_path}`,
                            description: metadata.data.overview || "",
                            background: metadata.data.backdrop_path
                                ? `https://image.tmdb.org/t/p/original${metadata.data.backdrop_path}`
                                : "",
                            genres: metadata.data.genres
                                ? metadata.data.genres.map((g) => g.name)
                                : [],
                            releaseInfo: metadata.data.release_date || "",
                            director: metadata.data.director || "",
                            cast: metadata.data.cast
                                ? metadata.data.cast.map((c) => c.name)
                                : [],
                            runtime: metadata.data.runtime
                                ? `${metadata.data.runtime} min`
                                : "",
                            language: metadata.data.original_language || "",
                            country: metadata.data.production_countries
                                ? metadata.data.production_countries
                                      .map((c) => c.name)
                                      .join(", ")
                                : "",
                        };
                    } else if (
                        metadata.source === "omdb" &&
                        metadata.data.Poster &&
                        metadata.data.Poster !== "N/A"
                    ) {
                        metaItem = {
                            ...metaItem,
                            name: metadata.data.Title || displayName,
                            poster: metadata.data.Poster || "",
                            description: metadata.data.Plot || "",
                            background: metadata.data.Poster || "",
                            genres: metadata.data.Genre
                                ? metadata.data.Genre.split(", ")
                                : [],
                            releaseInfo: metadata.data.Released || "",
                            director: metadata.data.Director || "",
                            cast: metadata.data.Actors
                                ? metadata.data.Actors.split(", ")
                                : [],
                            runtime: metadata.data.Runtime || "",
                            language: metadata.data.Language || "",
                            country: metadata.data.Country || "",
                        };
                    }
                }
                const hostInfo = `File downloaded from: ${torrentInfo.host}`;
                const fileSize = `File size: ${formatFileSize(torrentInfo.bytes)}`;
                const addedDate = `Downloaded on: ${formatDate(torrentInfo.added)}`;
                metaItem.description = [
                    metaItem.description,
                    hostInfo,
                    fileSize,
                    addedDate,
                ]
                    .filter(Boolean)
                    .join(", ");
                if (type === "series") {
                    const episodes = parseEpisodes(torrentInfo.files);
                    metaItem.videos = episodes.map((ep) => ({
                        id: `${id}:${ep.fileId}:${ep.index}`,
                        title: `S${ep.season} E${ep.episode}`,
                        season: ep.season,
                        episode: ep.episode,
                        released: new Date().toISOString(),
                    }));
                }
            } else if (source === "download") {
                const downloads = await fetchDownloads();
                if (!downloads) {
                    return { meta: null };
                }
                const downloadItem = downloads.find(
                    (d) => d.id === itemId && d.streamable === 1,
                );
                if (!downloadItem) {
                    return { meta: null };
                }
                const {
                    title: displayName,
                    searchTitle,
                    year,
                } = cleanFileName(downloadItem.filename);
                const metadata = await getMetadata(searchTitle, type, year);
                metaItem = {
                    id,
                    type,
                    name: displayName,
                    poster: "",
                    posterShape: "poster",
                    description: "",
                    background: "",
                    videos: [],
                };
                if (metadata) {
                    if (
                        metadata.source === "tmdb" &&
                        metadata.data.poster_path
                    ) {
                        metaItem = {
                            ...metaItem,
                            name:
                                metadata.data.title ||
                                metadata.data.name ||
                                displayName,
                            poster: `https://image.tmdb.org/t/p/w500${metadata.data.poster_path}`,
                            description: metadata.data.overview || "",
                            background: metadata.data.backdrop_path
                                ? `https://image.tmdb.org/t/p/original${metadata.data.backdrop_path}`
                                : "",
                            genres: metadata.data.genres
                                ? metadata.data.genres.map((g) => g.name)
                                : [],
                            releaseInfo: metadata.data.release_date || "",
                            director: metadata.data.director || "",
                            cast: metadata.data.cast
                                ? metadata.data.cast.map((c) => c.name)
                                : [],
                            runtime: metadata.data.runtime
                                ? `${metadata.data.runtime} min`
                                : "",
                            language: metadata.data.original_language || "",
                            country: metadata.data.production_countries
                                ? metadata.data.production_countries
                                      .map((c) => c.name)
                                      .join(", ")
                                : "",
                        };
                    } else if (
                        metadata.source === "omdb" &&
                        metadata.data.Poster &&
                        metadata.data.Poster !== "N/A"
                    ) {
                        metaItem = {
                            ...metaItem,
                            name: metadata.data.Title || displayName,
                            poster: metadata.data.Poster || "",
                            description: metadata.data.Plot || "",
                            background: metadata.data.Poster || "",
                            genres: metadata.data.Genre
                                ? metadata.data.Genre.split(", ")
                                : [],
                            releaseInfo: metadata.data.Released || "",
                            director: metadata.data.Director || "",
                            cast: metadata.data.Actors
                                ? metadata.data.Actors.split(", ")
                                : [],
                            runtime: metadata.data.Runtime || "",
                            language: metadata.data.Language || "",
                            country: metadata.data.Country || "",
                        };
                    }
                }
                const hostInfo = `File downloaded from: ${downloadItem.host}`;
                const fileSize = `File size: ${formatFileSize(
                    downloadItem.filesize || downloadItem.bytes,
                )}`;
                const generatedDate = `Downloaded on: ${formatDate(
                    downloadItem.generated,
                )}`;
                metaItem.description = [
                    metaItem.description,
                    hostInfo,
                    fileSize,
                    generatedDate,
                ]
                    .filter(Boolean)
                    .join(", ");
                if (type === "series") {
                    const episodes = parseEpisodesFromDownloads(
                        downloadItem.filename,
                    );
                    metaItem.videos = episodes.map((ep) => ({
                        id: `${id}:${ep.index}`,
                        title: `S${ep.season} E${ep.episode}`,
                        season: ep.season,
                        episode: ep.episode,
                        released: new Date().toISOString(),
                    }));
                }
            }
            return { meta: metaItem };
        } catch (error) {
            return { meta: null };
        }
    });

    builder.defineStreamHandler(async (args) => {
        const { type, id } = args;
        const idParts = id.split(":");
        const itemId = decodeURIComponent(idParts[1]);
        const source = idParts[2];
        const fileId = idParts[3] ? parseInt(idParts[3], 10) : null;
        const fileIndex = idParts[4] ? parseInt(idParts[4], 10) : null;
        try {
            if (source === "torrent") {
                const torrentInfo = await fetchTorrentInfo(itemId);
                if (!torrentInfo) {
                    return { streams: [] };
                }
                const { files, links } = torrentInfo;
                if (
                    !files ||
                    !links ||
                    files.length === 0 ||
                    links.length === 0
                ) {
                    return { streams: [] };
                }
                if (type === "movie") {
                    const videoFiles = files.filter((f) => isVideoFile(f.path));
                    if (videoFiles.length === 0) {
                        return { streams: [] };
                    }
                    const file = videoFiles[0];
                    const linkIndex = files.indexOf(file);
                    const link = links[linkIndex];
                    if (!file || !link) {
                        return { streams: [] };
                    }
                    const unrestricted = await unrestrictLink(link);
                    if (!unrestricted) {
                        return { streams: [] };
                    }
                    return {
                        streams: [
                            {
                                title: file.path,
                                url: encodeURI(unrestricted.download),
                            },
                        ],
                    };
                } else if (type === "series") {
                    if (
                        fileId !== null &&
                        !isNaN(fileId) &&
                        fileIndex !== null &&
                        !isNaN(fileIndex) &&
                        files[fileIndex] &&
                        files[fileIndex].id === fileId &&
                        links[fileIndex]
                    ) {
                        const file = files[fileIndex];
                        const link = links[fileIndex];
                        if (!file || !link) {
                            return { streams: [] };
                        }
                        const unrestricted = await unrestrictLink(link);
                        if (!unrestricted) {
                            return { streams: [] };
                        }
                        return {
                            streams: [
                                {
                                    title: file.path,
                                    url: encodeURI(unrestricted.download),
                                },
                            ],
                        };
                    }
                    return { streams: [] };
                }
                return { streams: [] };
            } else if (source === "download") {
                const downloads = await fetchDownloads();
                if (!downloads) {
                    return { streams: [] };
                }
                const downloadItem = downloads.find(
                    (d) => d.id === itemId && d.streamable === 1,
                );
                if (!downloadItem) {
                    return { streams: [] };
                }
                const unrestricted = await unrestrictLink(
                    downloadItem.download,
                );
                if (!unrestricted) {
                    return { streams: [] };
                }
                if (type === "movie") {
                    return {
                        streams: [
                            {
                                title: downloadItem.filename,
                                url: encodeURI(unrestricted.download),
                            },
                        ],
                    };
                } else if (type === "series") {
                    return {
                        streams: [
                            {
                                title: downloadItem.filename,
                                url: encodeURI(unrestricted.download),
                            },
                        ],
                    };
                }
                return { streams: [] };
            }
            return { streams: [] };
        } catch (error) {
            return { streams: [] };
        }
    });

    return builder.getInterface();
};
