# Docker Instructions

## Docker Deployment

Deploying the **Stremio Real Debrid Addon** with Docker Compose is
straightforward. The following instructions walk you through the entire process,
including optional steps for public exposure via Cloudflare Tunnel.

## Prerequisites

- **Docker** Ensure Docker is installed on your system. If not, follow the
  [official Docker installation guide](https://docs.docker.com/get-started/get-docker/).
- **Docker Compose** Verify Docker Compose is installed by running:

  ```bash
  docker compose --version
  ```

If you are using Docker Desktop, Docker Compose should already be included.

## Steps to Deploy

### **Clone the Repository**

If you have not cloned the repository yet, do so with the following commands:

```bash
git clone https://github.com/SHSharkar/Stremio-Real-Debrid-Addon.git
```

```bash
cd Stremio-Real-Debrid-Addon
```

### **Build and Start the Docker Containers**

Build the Docker image and start your containers in detached mode:

```bash
docker compose up -d --build --remove-orphans
```

**Explanation:**

- `up` creates and starts containers.
- `-d` runs containers in detached mode (in the background).
- `--build` forces a rebuild of the Docker image to incorporate any changes.
- `--remove-orphans` removes containers that are no longer defined in the Docker
  Compose file.

### **Verify the Container is Running**

Check the status of your containers:

```bash
docker compose ps
```

**Expected Output:**

```bash
Name                     Command               State               Ports
--------------------------------------------------------------------------------------
realdebrid-addon   docker-entrypoint.sh npm start   Up      0.0.0.0:62316->62316/tcp
```

### **Access the Application**

Open your browser and go to:

```bash
http://localhost:62316
```

If you are deploying on a remote server, replace `localhost` with the server’s
IP address.

## Optional: Expose the Application Publicly Using Cloudflare Tunnel

If you want to make your addon accessible over the internet without exposing
specific ports or using a custom domain, consider **Cloudflare Tunnel**.

### **Install Cloudflare Tunnel (`cloudflared`)**

Refer to the
[Cloudflare official guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
to install `cloudflared`.

### **Authenticate `cloudflared` with Your Cloudflare Account**

```bash
cloudflared login
```

This command opens a browser window where you can log in and authorize
`cloudflared`.

### **Create and Run the Tunnel**

```bash
cloudflared tunnel create stremio-realdebrid-addon
```

**Route the Tunnel:**

```bash
cloudflared tunnel route dns stremio-realdebrid-addon your-subdomain.yourdomain.com
```

Replace `your-subdomain.yourdomain.com` with the subdomain you wish to use. If
you do not have a custom domain, Cloudflare can provide a free
`*.trycloudflare.com` domain.

### **Run the Tunnel to Point to Your Docker Container**

```bash
cloudflared tunnel run stremio-realdebrid-addon
```

Make sure the tunnel points to the correct internal port (`62316`) used by your
Docker container.

## **Access the Application Publicly**

Open your browser and go to:

```bash
https://your-subdomain.yourdomain.com
```

Replace the above with the actual subdomain provided by Cloudflare.

---

## Managing the Docker Containers

- **View Logs** To see the application logs in real time:

  ```bash
  docker compose logs -f realdebrid-addon
  ```

- **Stop the Containers** Gracefully stop running containers:

  ```bash
  docker compose down --remove-orphans
  ```

- **Restart the Containers** If you need to restart your containers:

  ```bash
  docker compose restart realdebrid-addon
  ```

- **Rebuild After Code Changes** If any application code or dependencies change,
  rebuild and restart:

  ```bash
  docker compose up -d --build --remove-orphans
  ```
