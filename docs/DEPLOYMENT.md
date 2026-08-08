# Deployment Guide (No Credit Card Required)

This guide outlines how to deploy the Aegis AI Assistant completely for free using Cloud providers that **do not require a credit card** to sign up.

### Architecture Overview
1. **Database:** Supabase (Free Managed PostgreSQL with `pgvector`)
2. **Backend:** Render (Free Web Service)
3. **Frontend:** Vercel (Free Hobby Tier)

---

## 1. Setting up the Database (Supabase)

Supabase offers a generous free tier for PostgreSQL and includes the `pgvector` extension by default.

1. Go to [Supabase](https://supabase.com/) and sign in with GitHub.
2. Click **New Project**. Choose an organization and name your project (e.g., `aegis-db`).
3. Set a strong database password and save it somewhere secure.
4. Select a region close to you and click **Create new project**.
5. Once provisioned, go to **Project Settings** (gear icon) > **Database**.
6. Under **Connection string**, select **URI**. It will look like this:
   `postgresql://postgres.[YOUR_PROJECT_REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`
7. Replace `[YOUR-PASSWORD]` with your actual password. This is your `DATABASE_URL`.

**Enable pgvector:**
1. In the Supabase dashboard, go to **Database** (on the left menu).
2. Click on **Extensions**.
3. Search for `vector` and enable the **vector** extension.

---

## 2. Deploying the Backend (Render)

Render allows you to host web services for free (they spin down after 15 minutes of inactivity but wake up automatically when requested).

1. Push your Aegis repository to GitHub.
2. Go to [Render](https://render.com/) and sign in with GitHub.
3. Click **New +** and select **Web Service**.
4. Select **Build and deploy from a Git repository** and connect your Aegis repository.
5. In the configuration:
   - **Name:** `aegis-backend`
   - **Language:** `Python 3`
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** Free
6. Scroll down to **Advanced** and click **Add Environment Variable**. Add the following:
   - `DATABASE_URL`: *(Paste your Supabase Connection URI from Step 1)*
   - `GROQ_API_KEY`: *(Your Groq API key)*
   - `JWT_SECRET`: *(Generate a random string)*
   - `ALLOWED_ORIGINS`: We will update this later with your Vercel URL. For now, leave it blank or set to `*`.
   - Add any other keys you use (`GEMINI_API_KEY`, etc.)
7. Click **Create Web Service**. Render will now build and deploy your backend. 
8. Copy the Render URL (e.g., `https://aegis-backend.onrender.com`).

*Note: Before using the app, you need to run database migrations. You can do this locally by pointing your local `.env` DATABASE_URL to Supabase and running `cd backend && alembic upgrade head`.*

---

## 3. Deploying the Frontend (Vercel)

Vercel is the creator of Next.js and provides instant, free deployments.

1. Go to [Vercel](https://vercel.com) and sign in with GitHub.
2. Click **Add New...** > **Project**.
3. Import your Aegis repository.
4. **Project Settings:**
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend`
5. **Environment Variables:**
   - Expand the Environment Variables section.
   - Name: `NEXT_PUBLIC_API_URL`
   - Value: *(Your Render URL from Step 2, e.g., `https://aegis-backend.onrender.com`)*
6. Click **Deploy**.
7. Once deployed, copy your new Vercel domain (e.g., `https://aegis-frontend.vercel.app`).

---

## 4. Finalizing

Now that you have your Vercel URL, go back to **Render**:
1. Open your `aegis-backend` Web Service.
2. Go to **Environment**.
3. Update the `ALLOWED_ORIGINS` variable to exactly match your Vercel URL (e.g., `https://aegis-frontend.vercel.app`). Do not include a trailing slash.
4. Click **Save Changes** (Render will automatically redeploy).

Your app is now live, completely free, and securely deployed!
