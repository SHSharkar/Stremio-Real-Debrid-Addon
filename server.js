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
        "base64",
    );

    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");

    const addonUrl = `${protocol}://${host}/${configEncoded}/manifest.json`;
    const addonInstallUrlNoProtocol = `${host}/${configEncoded}/manifest.json`;
    const currentYear = new Date().getFullYear();
    const version = `${pkg.version}`;

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <title>Install Real Debrid Addon</title>
            <meta charset="UTF-8" />
            <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
            />
            <link rel="apple-touch-icon-precomposed" sizes="57x57" href="icon/apple-touch-icon-57x57.png" />
            <link rel="apple-touch-icon-precomposed" sizes="114x114" href="icon/apple-touch-icon-114x114.png" />
            <link rel="apple-touch-icon-precomposed" sizes="72x72" href="icon/apple-touch-icon-72x72.png" />
            <link rel="apple-touch-icon-precomposed" sizes="144x144" href="icon/apple-touch-icon-144x144.png" />
            <link rel="apple-touch-icon-precomposed" sizes="60x60" href="icon/apple-touch-icon-60x60.png" />
            <link rel="apple-touch-icon-precomposed" sizes="120x120" href="icon/apple-touch-icon-120x120.png" />
            <link rel="apple-touch-icon-precomposed" sizes="76x76" href="icon/apple-touch-icon-76x76.png" />
            <link rel="apple-touch-icon-precomposed" sizes="152x152" href="icon/apple-touch-icon-152x152.png" />
            <link rel="icon" type="image/png" href="icon/favicon-196x196.png" sizes="196x196" />
            <link rel="icon" type="image/png" href="icon/favicon-96x96.png" sizes="96x96" />
            <link rel="icon" type="image/png" href="icon/favicon-32x32.png" sizes="32x32" />
            <link rel="icon" type="image/png" href="icon/favicon-16x16.png" sizes="16x16" />
            <link rel="icon" type="image/png" href="icon/favicon-128.png" sizes="128x128" />
            <link href="/dist/main.css" rel="stylesheet" />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
            <link href="https://fonts.googleapis.com/css2?family=Maven+Pro:wght@400..900&display=swap" rel="stylesheet" />
        </head>
        <body
            class="min-h-screen bg-white font-sans sm:bg-gradient-to-t sm:from-electric-violet-300 sm:from-10% sm:via-sky-300 sm:via-30% sm:to-emerald-300 sm:to-90% sm:p-6 flex items-center justify-center"
        >
            <div
                class="mx-auto w-full max-w-2xl rounded-lg border-2 border-gray-300 bg-gradient-to-r from-gray-50 to-gray-100 p-8"
            >
                <h1 class="mb-4 text-2xl md:text-3xl font-bold text-gray-700">
                    Install Real Debrid Addon
                </h1>
                <p class="mb-4 text-base font-medium text-gray-600">
                    Click the link below to install the addon in Stremio:
                </p>
                <a
                    href="stremio://${addonInstallUrlNoProtocol}"
                    class="mb-4 inline-block rounded bg-malachite-600 px-4 py-2 text-lg md:text-2xl font-semibold text-white shadow-md hover:bg-malachite-500 focus:outline-none focus:ring-2 focus:ring-malachite-600"
                >
                    Install Addon
                </a>
                <p class="mt-4 mb-2 text-base font-medium text-gray-700">
                    Or add the following URL in Stremio:
                </p>
                <p
                    class="break-all overflow-x-auto rounded border-2 border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm md:text-base text-gray-800"
                >
                    ${addonUrl}
                </p>
                <p class="mt-4 text-sm font-semibold text-pumpkin-600">
                    Disclaimer: This addon is not official and is not affiliated
                    with the
                    <a
                        href="https://real-debrid.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="underline transition duration-300 hover:text-pumpkin-700"
                    >
                        Real Debrid
                    </a>
                    website.
                </p>
                <footer class="mt-4 text-center text-sm font-medium text-gray-600">
                    &copy; ${currentYear}
                    <a
                        href="https://devwz.com"
                        target="_blank"
                        class="font-semibold text-blue-ribbon-500 hover:text-blue-ribbon-700"
                    >
                        DEV Wizard
                    </a>
                    . All rights reserved. Version ${version}
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
            "utf8",
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
