# Docker Instructions

## Docker Deployment

Deploying the **Stremio Real Debrid Addon** using Docker Compose is
straightforward. Follow the steps below to get your addon up and running
quickly.

## Prerequisites

- **Docker:** Ensure Docker is installed on your system.
  [Install Docker](https://docs.docker.com/get-started/get-docker/).
- **Docker Compose:** Typically included with Docker Desktop. Verify
  installation by running:

  ```bash
  docker compose --version
  ```

## Steps to Deploy

### **Clone the Repository**

If you haven't already, clone the repository to your local machine:

```bash
git clone https://github.com/SHSharkar/Stremio-Real-Debrid-Addon.git
```

```bash
cd Stremio-Real-Debrid-Addon
```

### **Build and Start the Docker Containers**

Execute the following command to build the Docker image and start the container
in detached mode:

```bash
docker compose up -d --build
```

**Explanation:**

- `up`: Creates and starts containers.
- `-d`: Runs containers in detached mode (in the background).
- `--build`: Forces a rebuild of the Docker image, ensuring all changes are
  incorporated.

### **Verify the Container is Running**

Check the status of your containers to ensure everything is running smoothly:

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

Open your web browser and navigate to:

```bash
http://localhost:62316
```

_If deploying on a remote server, replace `localhost` with your server's IP
address._

## Optional: Expose the Application Publicly Using Cloudflare Tunnel

To make your addon accessible from the internet without exposing specific ports
or using a public domain, you can utilize **Cloudflare Tunnel**.

### **Install Cloudflare Tunnel (`cloudflared`)**

Follow the
[official installation guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
to install `cloudflared` on your system.

### **Authenticate `cloudflared` with Your Cloudflare Account**

```bash
cloudflared login
```

This command will open a browser window prompting you to log in to your
Cloudflare account and authorize `cloudflared`.

### **Create and Run the Tunnel**

```bash
cloudflared tunnel create stremio-realdebrid-addon
```

**Route the Tunnel:**

```bash
cloudflared tunnel route dns stremio-realdebrid-addon your-subdomain.yourdomain.com
```

_Replace `your-subdomain.yourdomain.com` with your desired subdomain. If you
don't have a custom domain, Cloudflare provides a free `_.trycloudflare.com`
domain.\*

### **Run the Tunnel to Point to Your Docker Container**

```bash
cloudflared tunnel run stremio-realdebrid-addon
```

_Ensure that this command points to the correct internal port (`62316`) where
your Docker container is running._

## **Access the Application Publicly**

Navigate to your Cloudflare Tunnel URL:

```bash
https://your-subdomain.yourdomain.com
```

_Replace with your actual subdomain provided by Cloudflare._

---

## Managing the Docker Containers

- **View Logs**

  To monitor the application's logs:

  ```bash
  docker compose logs -f realdebrid-addon
  ```

- **Stop the Containers**

  Gracefully stop the running containers:

  ```bash
  docker compose down
  ```

- **Restart the Containers**

  If you need to restart the containers:

  ```bash
  docker compose restart realdebrid-addon
  ```

- **Rebuild After Code Changes**

  If you've made changes to the application code or dependencies, rebuild and
  restart the containers:

  ```bash
  docker compose up -d --build
  ```
