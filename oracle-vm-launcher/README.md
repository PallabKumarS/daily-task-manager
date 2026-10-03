# Oracle Cloud (OCI) Always Free ARM VM Auto-Launcher

Automated script to continuously retry creating the **`VM.Standard.A1.Flex`** (Ampere ARM Always Free) instance in Oracle Cloud until capacity is provisioned.

---

## What It Matches (From Your Configuration)

- **Name:** `nodejs-servers`
- **Shape:** `VM.Standard.A1.Flex`
- **OCPU:** `1 core`
- **RAM:** `6 GB`
- **OS:** `Canonical Ubuntu 24.04 Minimal aarch64`
- **Boot Volume:** `50 GB` (Performance: `10 VPU`, In-Transit Encryption: `Enabled`)
- **Region:** `Singapore` (`ap-singapore-1`)
- **Fault Domain:** `FAULT-DOMAIN-1`
- **VCN & Subnet:** `vcn-nodejs` / `subnet-nodejs` (auto-detected or created automatically)
- **Public IP:** `true` (assigned so you can SSH directly)

---

## 3-Minute Setup Guide

### Step 1: Generate an API Key in Oracle Console

1. In Oracle Cloud Console (top right), click your **Profile icon** -> **My Profile** (or **User Settings**).
2. On the left side under **Resources**, click **API Keys**.
3. Click **Add API Key**.
4. Select **Generate API Key Pair** and click **Download Private Key** (saves a `.pem` file).
5. Click **Add**.
6. A dialog appears with a **Configuration File Preview** showing:
   - `user=ocid1.user.oc1..aaaa...`
   - `fingerprint=xx:xx:xx:...`
   - `tenancy=ocid1.tenancy.oc1..aaaa...`
   - `region=ap-singapore-1`

---

### Step 2: Configure `.env`

1. Move your downloaded `.pem` file into the `oracle-vm-launcher` folder and name it `oci_private_key.pem`.
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Fill in the 4 values from Oracle Console into `.env`:
   ```env
   OCI_USER_OCID=ocid1.user.oc1..aaaa...
   OCI_TENANCY_OCID=ocid1.tenancy.oc1..aaaa...
   OCI_FINGERPRINT=xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx
   OCI_REGION=ap-singapore-1
   OCI_PRIVATE_KEY_PATH=./oci_private_key.pem

   # Your SSH public key (e.g. from C:/Users/N3th3rLord/.ssh/id_rsa.pub or id_ed25519.pub)
   OCI_SSH_PUBLIC_KEY="ssh-rsa AAAA..."
   ```

---

### Step 3: Test Connection

Run the environment checker:
```bash
npm run check-env
```
This verifies your credentials, queries Availability Domains in Singapore, checks Ubuntu 24.04 images, and verifies your SSH key.

---

### Step 4: Start the Auto-Launcher

```bash
npm start
```
The script will attempt to create the instance every 45 seconds:
- If Oracle returns **"Out of host capacity"**, it automatically waits and retries.
- As soon as capacity is available, it provisions the instance, fetches the assigned **Public IP**, sounds a terminal alert, and exits cleanly.
- You can stop it at any time with `Ctrl + C`.
