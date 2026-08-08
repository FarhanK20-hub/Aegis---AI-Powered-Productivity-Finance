# Deployment Guide

This document outlines the step-by-step instructions for deploying the Aegis AI Assistant in a production environment.

## 1. Provisioning an Oracle Cloud VM

1. Log in to your Oracle Cloud Infrastructure (OCI) dashboard.
2. Go to **Compute > Instances** and click **Create Instance**.
3. Name your instance (e.g., `aegis-production`).
4. Under **Image and shape**:
   - Change the image to **Ubuntu 22.04** (or latest).
   - Change the shape to **Ampere > VM.Standard.A1.Flex**.
   - Configure for 4 OCPUs and 24 GB RAM (this fits within the Always Free tier).
5. Under **Networking**, create or select an existing Virtual Cloud Network (VCN) and assign a public IPv4 address.
6. Add your SSH key for access.
7. Click **Create** and wait for the instance to provision.
8. Once running, take note of the **Public IP Address**.

## 2. Opening Ports (443 & 80)

1. In the OCI dashboard, click on the VCN associated with your instance.
2. Navigate to **Security Lists** and select the default security list.
3. Add **Ingress Rules**:
   - Source CIDR: `0.0.0.0/0`
   - Protocol: TCP
   - Destination Port Range: `80`
   - Description: HTTP
   - Source CIDR: `0.0.0.0/0`
   - Protocol: TCP
   - Destination Port Range: `443`
   - Description: HTTPS
4. SSH into your VM and open ports in the local firewall (iptables):
   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

## 3. Installing Docker and Docker Compose

SSH into your Ubuntu VM:
```bash
ssh ubuntu@<YOUR_PUBLIC_IP>
```

Run the following commands to install Docker and Docker Compose:
```bash
# Install Docker
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker

# Add your user to the docker group
sudo usermod -aG docker $USER
```
*(Log out and log back in for the group changes to take effect).*

## 4. Getting a Free HTTPS Domain

We will use DuckDNS for a free domain and Caddy for automatic HTTPS.

1. Go to [DuckDNS](https://www.duckdns.org/) and sign in.
2. Create a domain, e.g., `aegis-api.duckdns.org`.
3. Point the domain to your Oracle VM's Public IP address.

### Setting up Caddy

Create a `Caddyfile` on your VM (e.g., in `~/aegis/Caddyfile`):
```caddyfile
aegis-api.duckdns.org {
    reverse_proxy localhost:8000
}
```

Run Caddy using Docker:
```bash
docker run -d --name caddy \
    -p 80:80 \
    -p 443:443 \
    -v $(pwd)/Caddyfile:/etc/caddy/Caddyfile \
    -v caddy_data:/data \
    -v caddy_config:/config \
    --restart always \
    --network host \
    caddy
```
*Note: Caddy will automatically provision a Let's Encrypt TLS certificate for your domain.*

## 5. Running the Backend and Postgres (Production)

Clone your repository to the VM (or copy the files over). Ensure you are in the `infra` directory containing `docker-compose.prod.yml`.

1. Create a `.env` file based on `.env.example`:
   ```bash
   cp ../.env.example ../.env
   nano ../.env
   ```
   **Crucial:** Set `ALLOWED_ORIGINS` to your Vercel frontend domain (e.g., `https://aegis-frontend.vercel.app`).

2. Start the production containers:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
   The backend will now be accessible over HTTPS via Caddy (e.g., `https://aegis-api.duckdns.org`).

## 6. Deploying the Frontend to Vercel

1. Push your monorepo to GitHub.
2. Go to [Vercel](https://vercel.com) and click **Add New Project**.
3. Import your GitHub repository.
4. **Project Settings:**
   - Framework Preset: **Next.js**
   - Root Directory: `frontend`
5. **Environment Variables:**
   - Add `NEXT_PUBLIC_API_URL` and set its value to your secure backend domain (e.g., `https://aegis-api.duckdns.org`).
6. Click **Deploy**.

Once deployed, update your backend's `.env` on the VM with the final Vercel domain in `ALLOWED_ORIGINS` and restart the backend container if necessary:
```bash
docker compose -f docker-compose.prod.yml restart backend
```
