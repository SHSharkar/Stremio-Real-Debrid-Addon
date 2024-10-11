#!/usr/bin/env node

const express = require("express");
const { getRouter } = require("stremio-addon-sdk");
const addonBuilder = require("./addon");
const app = express();
const path = require("path");

app.set("trust proxy", true);

app.use(express.urlencoded({ extended: true }));
app.use("/dist", express.static(path.join(__dirname, "dist")));
app.use("/icon", express.static(path.join(__dirname, "icon")));

app.get("/", (req, res) => {
    res.redirect("/configure");
});

app.get("/configure", (req, res) => {
    res.sendFile(path.join(__dirname, "configure.html"));
});

app.post("/install", (req, res) => {
    const apiKey = req.body.apiKey;
    const tmdbApiKey = req.body.tmdbApiKey;
    const omdbApiKey = req.body.omdbApiKey;
    if (!apiKey) {
        return res.send("Real Debrid API Key is required.");
    }
    const config = { apiKey };
    if (tmdbApiKey) {
        config.tmdbApiKey = tmdbApiKey;
    }
    if (omdbApiKey) {
        config.omdbApiKey = omdbApiKey;
    }
    const configEncoded = Buffer.from(JSON.stringify(config)).toString(
        "base64"
    );

    const addonUrl = `${req.protocol}://${req.get("host")}/${configEncoded}/manifest.json`;
    const addonInstallUrlNoProtocol = `${req.get("host")}/${configEncoded}/manifest.json`;

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Install Real Debrid Addon</title>
            <link href="/dist/main.css" rel="stylesheet" />
        </head>
        <body class="bg-gray-100 flex items-center justify-center min-h-screen">
            <div class="bg-white p-8 rounded shadow-md w-full max-w-md">
                <h1 class="text-2xl font-bold mb-4">Install Real Debrid Addon</h1>
                <p class="mb-4 font-medium">Click the link below to install the addon in Stremio:</p>
                <a href="stremio://${addonInstallUrlNoProtocol}" class="rounded bg-indigo-600 px-2.5 py-1.5 text-lg font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Install Addon</a>
                <p class="mt-4 font-medium">Or add the following URL in Stremio:</p>
                <p class="bg-gray-100 p-3 rounded break-all overflow-wrap-anywhere overflow-x-auto my-2 font-mono text-sm">${addonUrl}</p>
                <p class="text-sm font-semibold text-orange-600 mt-4">
                    Disclaimer: This addon is not official and is not affiliated
                    with the
                    <a
                        href="https://real-debrid.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="underline transition duration-300 hover:text-orange-700"
                        >Real Debrid</a
                    >
                    website.
                </p>
            </div>
        </body>
        </html>
    `);
});

app.use("/:config", (req, res, next) => {
    const configEncoded = req.params.config;
    let config;
    try {
        const configString = Buffer.from(configEncoded, "base64").toString(
            "utf8"
        );
        config = JSON.parse(configString);
    } catch (e) {
        return res.status(400).send("Invalid configuration");
    }
    const addonInterface = addonBuilder(config);
    const router = getRouter(addonInterface);
    router(req, res, next);
});

const PORT = process.env.PORT || 62316;
app.listen(PORT, () => {
    console.log(`Addon running at http://localhost:${PORT}`);
});
