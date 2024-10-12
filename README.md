# Stremio Real Debrid Addon

Stream your Real Debrid files in Stremio.

**Disclaimer**: This addon is not official and is not affiliated with the
[Real Debrid](https://real-debrid.com/) website.

## Table of Contents

- [Stremio Real Debrid Addon](#stremio-real-debrid-addon)
  - [Table of Contents](#table-of-contents)
  - [Description](#description)
  - [Features](#features)
  - [Installation](#installation)
    - [Production Deployment](#production-deployment)
    - [Local Deployment](#local-deployment)
      - [Prerequisites](#prerequisites)
      - [Steps](#steps)
      - [Tailwind CSS Compilation](#tailwind-css-compilation)
  - [Configuration](#configuration)
  - [Usage](#usage)
  - [Nginx Proxy Configuration](#nginx-proxy-configuration)
    - [Step 1: Install Nginx](#step-1-install-nginx)
    - [Step 2: Create Nginx Configuration](#step-2-create-nginx-configuration)
    - [Step 3: Enable the Configuration](#step-3-enable-the-configuration)
    - [Step 4: Test Nginx Configuration](#step-4-test-nginx-configuration)
    - [Step 5: Configure Firewall (if necessary)](#step-5-configure-firewall-if-necessary)
    - [Step 6: Access the Addon](#step-6-access-the-addon)
  - [Contributing](#contributing)
  - [License](#license)
  - [Disclaimer](#disclaimer)

## Description

This Stremio addon allows you to stream your Real Debrid files directly in
Stremio. Access your Real Debrid torrents and downloads seamlessly within the
Stremio interface.

## Features

- **Stream Real Debrid Torrents and Downloads**: Access and stream your Real
  Debrid torrents and downloads directly within Stremio.
- **Support for Movies and Series**: The addon supports both movies and TV
  series.
- **Metadata Fetching**: Fetches metadata from TMDb and OMDb for enriched
  content information.
- **Easy Configuration**: Configure the addon easily through a web interface.
- **Tailwind CSS Styling**: The addon interface is styled using Tailwind CSS.
- **Customizable**: You can host the addon locally or use the hosted version.
- **Nginx Proxy Support**: Instructions provided for setting up the addon behind
  an Nginx proxy.

## Installation

### Production Deployment

You can use the addon right away without installing it locally. Use the
following production domain hosted by us:

[https://stremio-real-debrid-addon.devwz.com](https://stremio-real-debrid-addon.devwz.com)

Visit the above link and follow the instructions to configure and install the
addon in Stremio.

### Local Deployment

You are welcome to host the addon locally.

#### Prerequisites

- **Node.js** (v18 or higher)
- **NPM**

#### Steps

1. **Clone the repository**:

   ```bash
   git clone https://github.com/SHSharkar/Stremio-Real-Debrid-Addon.git
   ```

2. **Navigate to the project directory**:

   ```bash
   cd Stremio-Real-Debrid-Addon
   ```

3. **Install dependencies**:

   ```bash
   npm install
   ```

4. **Compile Tailwind CSS**:

   The addon uses Tailwind CSS for styling. You need to compile the CSS before
   starting the addon.

   ```bash
   npx tailwindcss -i ./src/main.css -o ./dist/main.css --watch
   ```

   This will watch for changes in your CSS files and recompile as necessary.

5. **Start the addon**:

   ```bash
   npm start -- --launch
   ```

   The `--launch` flag will open the addon in your default browser.

6. **Configure the addon**:

   Open your browser and navigate to
   [http://localhost:62316](http://localhost:62316) if it doesn't open
   automatically. Follow the instructions to configure and install the addon in
   Stremio.

#### Tailwind CSS Compilation

For production builds, you can compile Tailwind CSS without the `--watch` flag:

```bash
npx tailwindcss -i ./src/main.css -o ./dist/main.css --minify
```

This will generate a minified CSS file suitable for production.

## Configuration

When configuring the addon, you will need:

- **Real Debrid API Key** (Required): Obtain it from
  [here](https://real-debrid.com/apitoken).
- **TMDb API Key** (Optional): For fetching additional metadata. Obtain it from
  [here](https://www.themoviedb.org/settings/api).
- **OMDb API Key** (Optional): For fetching additional metadata. Obtain it from
  [here](https://www.omdbapi.com/apikey.aspx).

## Usage

After installing the addon, you can access your Real Debrid torrents and
downloads directly in Stremio. The addon provides catalogs for movies and series
from your Real Debrid account.

## Nginx Proxy Configuration

If you want to use the addon behind an Nginx proxy, follow these step-by-step
instructions:

### Step 1: Install Nginx

If Nginx is not installed, install it using your package manager.

For Ubuntu/Debian:

```bash
sudo apt update
sudo apt install nginx
```

### Step 2: Create Nginx Configuration

Create a new Nginx server block configuration file:

```bash
sudo nano /etc/nginx/sites-available/stremio-realdebrid
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your.domain.com;

    location / {
        proxy_pass http://127.0.0.1:62316;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Replace `your.domain.com` with your actual domain.

### Step 3: Enable the Configuration

Enable the new configuration by creating a symbolic link:

```bash
sudo ln -s /etc/nginx/sites-available/stremio-realdebrid /etc/nginx/sites-enabled/
```

### Step 4: Test Nginx Configuration

Test the Nginx configuration for syntax errors:

```bash
sudo nginx -t
```

If the test is successful, restart Nginx:

```bash
sudo systemctl restart nginx
```

### Step 5: Configure Firewall (if necessary)

Ensure that your firewall allows HTTP traffic (port 80).

### Step 6: Access the Addon

Navigate to `http://your.domain.com` in your browser. Follow the instructions to
configure and install the addon in Stremio.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file
for details.

## Disclaimer

This addon is not official and is not affiliated with the
[Real Debrid](https://real-debrid.com/) website.
