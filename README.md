# Stremio Real Debrid Addon

Stream your Real Debrid files in Stremio with this unofficial addon.

## Table of Contents

- [Stremio Real Debrid Addon](#stremio-real-debrid-addon)
  - [Table of Contents](#table-of-contents)
  - [Description](#description)
  - [Features](#features)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Local Development](#local-development)
    - [Production Deployment](#production-deployment)
  - [Configuration](#configuration)
  - [API Keys](#api-keys)
  - [Tailwind CSS Setup](#tailwind-css-setup)
    - [Compiling Tailwind CSS Assets](#compiling-tailwind-css-assets)
    - [Watching for Changes in Real-Time](#watching-for-changes-in-real-time)
  - [Contributing](#contributing)
  - [Disclaimer](#disclaimer)
  - [License](#license)

## Description

This addon allows Stremio users to stream their Real Debrid files directly
within the Stremio application. It provides a seamless integration between Real
Debrid and Stremio, enhancing the streaming experience with access to
high-quality content.

## Features

- Stream Real Debrid files in Stremio
- Support for movies and TV series
- Integration with TMDb and OMDb for metadata (optional)
- User-friendly configuration interface
- Tailwind CSS for modern, responsive design

## Prerequisites

- Node.js (v14 or higher recommended)
- npm (comes with Node.js)
- Real Debrid account and API key

Ensure that you have Node.js and npm installed on your machine. You can verify
the installation by running:

```shell
node --version
npm --version
```

## Installation

1. Clone the repository:

   ```shell
   git clone https://github.com/SHSharkar/Stremio-Real-Debrid-Addon.git
   ```

   OR with SSH:

   ```shell
   git clone git@github.com:SHSharkar/Stremio-Real-Debrid-Addon.git
   ```

2. Navigate to the project directory:

   ```shell
   cd stremio-addon-realdebrid
   ```

3. Install dependencies:

   ```shell
   npm install
   ```

## Usage

### Local Development

1. Start the development server:

   ```shell
   npm start
   ```

2. Open a web browser and navigate to `http://localhost:62316/configure` to set
   up the addon.

3. Enter your Real Debrid API key and optional TMDb and OMDb API keys.

4. Click "Configure Addon" to generate the installation URL.

5. Use the provided URL to install the addon in Stremio.

### Production Deployment

1. Set up a Node.js hosting environment (e.g., Heroku, DigitalOcean, AWS).

2. Deploy the code to your hosting provider.

3. Set the following environment variables:

   - `PORT`: The port on which the server will run (if not using the
     default 62316)

4. Start the server using the hosting provider's recommended method (e.g.,
   `npm start` for Heroku).

5. Access the configuration page at `https://your-domain.com/configure` and
   follow the setup process.

## Configuration

The addon can be configured through the web interface at `/configure`. You'll
need to provide:

- Real Debrid API Key (required)
- TMDb API Key (optional, for enhanced metadata)
- OMDb API Key (optional, for additional metadata)

## API Keys

- Real Debrid API Key: Obtain from
  [https://real-debrid.com/apitoken](https://real-debrid.com/apitoken)
- TMDb API Key: Sign up at
  [https://www.themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
- OMDb API Key: Request at
  [http://www.omdbapi.com/apikey.aspx](http://www.omdbapi.com/apikey.aspx)

## Tailwind CSS Setup

This project uses Tailwind CSS for styling. Follow these instructions to compile
and work with Tailwind CSS.

### Compiling Tailwind CSS Assets

To compile the Tailwind CSS assets in your project, run the following command:

```bash
npx tailwindcss -i ./src/main.css -o ./dist/main.css --minify
```

This will take the `main.css` file located in the `src` directory, process it
with Tailwind CSS, and output the minified result to the `dist` directory.

### Watching for Changes in Real-Time

If you want to make changes to your Tailwind CSS files and see the results in
real-time during local development, run the following command:

```bash
npx tailwindcss -i ./src/main.css -o ./dist/main.css --watch
```

This command will watch for any changes in the `main.css` file and recompile the
output file automatically whenever a change is detected.

For more information, refer to the
[Tailwind CSS documentation](https://tailwindcss.com/docs/installation).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Disclaimer

This addon is not official and is not affiliated with the Real Debrid website.
Use at your own risk.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.
