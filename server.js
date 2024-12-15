#!/usr/bin/env node

const express = require("express");
const { getRouter } = require("stremio-addon-sdk");
const addonBuilder = require("./addon");
const app = express();
const path = require("path");
const fs = require("fs");
const pkg = require("./package.json");

app.set("trust proxy", true);

app.use(express.urlencoded({ extended: true }));
app.use("/dist", express.static(path.join(__dirname, "dist")));
app.use("/icon", express.static(path.join(__dirname, "icon")));

app.get("/", (req, res) => {
    res.redirect("/configure");
});

app.get("/configure", (req, res) => {
    fs.readFile(path.join(__dirname, "configure.html"), "utf8", (err, data) => {
        if (err) {
            res.status(500).send("Error loading configure.html");
        } else {
            const currentYear = new Date().getFullYear();
            const updatedData = data
                .replace(/{{VERSION}}/g, pkg.version)
                .replace(/{{CURRENT_YEAR}}/g, currentYear);
            res.send(updatedData);
        }
    });
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

    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");

    const addonUrl = `${protocol}://${host}/${configEncoded}/manifest.json`;
    const addonInstallUrlNoProtocol = `${host}/${configEncoded}/manifest.json`;

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Install Real Debrid Addon</title>
            <link href="/dist/main.css" rel="stylesheet" />
        </head>
        <body class="bg-white flex items-center justify-center min-h-screen">
            <div class="border-2 border-gray-300 bg-gradient-to-r from-gray-200 to-gray-300 p-8 rounded w-full max-w-md">
                <h1 class="text-2xl font-bold mb-4">Install Real Debrid Addon</h1>
                <p class="mb-4 font-medium">Click the link below to install the addon in Stremio:</p>
                <a href="stremio://${addonInstallUrlNoProtocol}" class="rounded bg-indigo-600 px-2.5 py-1.5 text-lg font-semibold text-white shadow-md hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Install Addon</a>
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
                <footer class="mt-4 text-center text-sm font-medium text-gray-600">
                    &copy; ${new Date().getFullYear()} <a href="https://devwz.com" target="_blank" class="font-semibold text-blue-500 hover:text-blue-700">DEV Wizard</a>. All rights reserved. Version ${pkg.version}
                </footer>
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
