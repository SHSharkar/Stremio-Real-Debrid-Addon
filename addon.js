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
        version: "1.0.1",
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
        let name = filename;

        name = name.replace(/\.[^/.]+$/, "");

        name = name.replace(/[._]/g, " ");

        let yearMatch = name.match(
            /(?:\(|\[|\{)?((?:19|20)\d{2})(?:\)|\]|\})?/
        );
        let year = yearMatch ? yearMatch[1] : null;
        if (yearMatch) {
            name = name.replace(yearMatch[0], "");
        }

        name = name.replace(/S\d{1,2}[\s.-]?E\d{1,2}(?:-\d{1,2})?/gi, "");
        name = name.replace(/Season[\s.-]?\d{1,2}/gi, "");
        name = name.replace(/\b\d{1,2}x\d{1,2}\b/gi, "");
        name = name.replace(/Episode[\s.-]?(\d{1,2})/gi, "");

        name = name.replace(
            /\b(1080p|720p|480p|2160p|4K|2K|3D|iMAX|AMZN|WEBRip|WEB[- ]?DL|BluRay|HDRip|BRRip|BDRip|BDRemux|Remux|DVDRip|DVDScr|CAM|TS|HDTS|R5|HDR|SDR|HDCAM|HC|Rip|WEB|HDR|DV|HEVC|x264|x265|H\.?264|H\.?265|AVC|DivX|XviD|10bit|Hi10P)\b/gi,
            ""
        );

        name = name.replace(
            /\b(DTS|AAC(?:[\s\d\.]+)?|AC3|DDP(?:[\s\d\.]+)?|DD(?:[\s\d\.]+)?|TrueHD|FLAC|EAC3|MP3|OGG|WMA|Atmos|MIXED|KatmovieHD|TEPES|Dolby\s?Digital\s?Plus|Dolby|DTS-HD|MA|HDTV|ATVP|Remastered|mkvCinemas|PCM|DD|DDP|5\.1|5\s1|7\.1|7\s1|2\.0|2\s0)\b/gi,
            ""
        );

        name = name.replace(
            /\b(Hindi|English|French|Spanish|German|Italian|Japanese|Korean|Dual\sAudio|Dubbed|Multi|ENG|HIN|SPA|FRE|GER|ITA|JAP|KOR)\b/gi,
            ""
        );

        name = name.replace(
            /\b(ESub|EngSub|Subbed|Subtitle|Subs|Sub|ESubs)\b/gi,
            ""
        );

        name = name.replace(/\s*\[.*?\]/g, "");
        name = name.replace(/\s*\(.*?\)/g, "");
        name = name.replace(/\s*\{.*?\}/g, "");

        name = name.replace(/[\s]*[-~][\s]*[^\s]+.*$/i, "");
        name = name.replace(/[\s]*by[\s]*[^\s]+.*$/i, "");
        name = name.replace(/[\s]*\bMVGroup\b.*$/i, "");

        name = name.replace(/\s+/g, " ").trim();

        if (year) {
            name = `${name} (${year})`;
        }

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
            return [];
        }
    }

    async function fetchDownloads() {
        if (!apiKey) return [];
        try {
            const response = await axios.get(`${API_BASE_URL}/downloads`, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            });
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
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                    },
                }
            );
            return response.data;
        } catch (error) {
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
        } catch (error) {}
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
        } catch (error) {}
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

    function parseEpisodesFromDownloads(filename) {
        const episodes = [];

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
            return null;
        }
    }

    builder.defineCatalogHandler(async (args) => {
        const { type, extra } = args;

        try {
            let torrents = await fetchTorrents();
            let downloads = await fetchDownloads();

            if (!torrents) torrents = [];
            if (!downloads) downloads = [];

            let items = [];

            if (torrents.length > 0) {
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

                items = items.concat(
                    filteredTorrents.map((torrent) => ({
                        source: "torrent",
                        data: torrent,
                    }))
                );
            }

            if (downloads.length > 0) {
                let filteredDownloads = downloads.filter((download) => {
                    const isVideoFile = VIDEO_EXTENSIONS.includes(
                        path.extname(download.filename).toLowerCase()
                    );
                    const isStreamable = download.streamable === 1;
                    const isSeriesDownload = isSeries(download.filename);
                    return (
                        isVideoFile &&
                        isStreamable &&
                        ((type === "movie" && !isSeriesDownload) ||
                            (type === "series" && isSeriesDownload))
                    );
                });

                if (extra && extra.search) {
                    const search = extra.search.toLowerCase();
                    filteredDownloads = filteredDownloads.filter((download) =>
                        download.filename.toLowerCase().includes(search)
                    );
                }

                items = items.concat(
                    filteredDownloads.map((download) => ({
                        source: "download",
                        data: download,
                    }))
                );
            }

            const metas = [];
            for (const item of items) {
                let title, year;
                if (item.source === "torrent") {
                    ({ title, year } = cleanFileName(item.data.filename));
                } else if (item.source === "download") {
                    ({ title, year } = cleanFileName(item.data.filename));
                }

                const metadata = await getMetadata(title, year, type);

                let metaItem = {
                    id: `rd:${encodeURIComponent(item.data.id)}:${item.source}`,
                    type,
                    name: title,
                    poster: "",
                    posterShape: "poster",
                    description: "No description available",
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
                                title,
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
                            name: metadata.data.Title || title,
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

                metas.push(metaItem);
            }

            return { metas };
        } catch (error) {
            return { metas: [] };
        }
    });

    builder.defineMetaHandler(async (args) => {
        const { type, id } = args;

        const idParts = id.split(":");
        const itemId = decodeURIComponent(idParts[1]);
        const source = idParts[2];

        try {
            let metaItem = null;

            if (source === "torrent") {
                const torrentInfo = await fetchTorrentInfo(itemId);
                if (!torrentInfo) {
                    return { meta: null };
                }
                const { title, year } = cleanFileName(torrentInfo.filename);
                const metadata = await getMetadata(title, year, type);

                metaItem = {
                    id,
                    type,
                    name: title,
                    poster: "",
                    posterShape: "poster",
                    description: "No description available",
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
                                title,
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
                            name: metadata.data.Title || title,
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

                if (type === "series") {
                    const episodes = parseEpisodes(torrentInfo.files);
                    metaItem.videos = episodes.map((episode) => ({
                        id: `${id}:${episode.fileId}:${episode.index}`,
                        title: `S${episode.season} E${episode.episode}`,
                        season: episode.season,
                        episode: episode.episode,
                        released: new Date().toISOString(),
                    }));
                }
            } else if (source === "download") {
                const downloads = await fetchDownloads();
                const downloadItem = downloads.find(
                    (d) => d.id === itemId && d.streamable === 1
                );
                if (!downloadItem) {
                    return { meta: null };
                }
                const { title, year } = cleanFileName(downloadItem.filename);
                const metadata = await getMetadata(title, year, type);

                metaItem = {
                    id,
                    type,
                    name: title,
                    poster: "",
                    posterShape: "poster",
                    description: "No description available",
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
                                title,
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
                            name: metadata.data.Title || title,
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

                if (type === "series") {
                    const episodes = parseEpisodesFromDownloads(
                        downloadItem.filename
                    );
                    metaItem.videos = episodes.map((episode) => ({
                        id: `${id}:${episode.index}`,
                        title: `S${episode.season} E${episode.episode}`,
                        season: episode.season,
                        episode: episode.episode,
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
            } else if (source === "download") {
                const downloads = await fetchDownloads();
                const downloadItem = downloads.find(
                    (d) => d.id === itemId && d.streamable === 1
                );
                if (!downloadItem) {
                    return { streams: [] };
                }

                if (type === "movie") {
                    const stream = {
                        title: downloadItem.filename,
                        url: encodeURI(downloadItem.download),
                    };
                    return { streams: [stream] };
                } else if (type === "series") {
                    const stream = {
                        title: downloadItem.filename,
                        url: encodeURI(downloadItem.download),
                    };
                    return { streams: [stream] };
                } else {
                    return { streams: [] };
                }
            } else {
                return { streams: [] };
            }
        } catch (error) {
            return { streams: [] };
        }
    });

    return builder.getInterface();
};
