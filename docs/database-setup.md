# PostgreSQL Setup Guide

## Database Details

- **Database Name**: `project_management_db`
- **Host**: `localhost` (127.0.0.1)
- **Port**: `5432`
- **Default Superuser**: `postgres`

---

## Option 1: Create Database Using psql (Command Line)

1. Open PowerShell or Command Prompt.
2. Run `psql` (located at `C:\Program Files\PostgreSQL\16\bin\psql.exe` on Windows):

   ```powershell
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres
   ```

3. Enter your PostgreSQL superuser password when prompted.
4. Run the SQL statement to create the database:

   ```sql
   CREATE DATABASE project_management_db;
   ```

5. Verify that the database was created:

   ```sql
   \l
   ```

6. Exit `psql`:

   ```sql
   \q
   ```

---

## Option 2: Create Database Using pgAdmin 4 (GUI)

1. Open **pgAdmin 4** from your Windows Start Menu.
2. Enter your master password to unlock pgAdmin.
3. In the left sidebar tree, expand **Servers** > **PostgreSQL 16**.
4. Enter your `postgres` password if prompted.
5. Right-click on **Databases** > Select **Create** > **Database...**.
6. Set **Database** name to: `project_management_db`.
7. Set **Owner** to: `postgres`.
8. Click **Save**.

---

## Configure Backend Environment File

Open `backend/.env` and update the `DB_PASSWORD` field with your local password:

```env
DB_ENGINE=django.db.backends.postgresql
DB_NAME=project_management_db
DB_USER=postgres
DB_PASSWORD=your_password_here
DB_HOST=localhost
DB_PORT=5432
```

---

## Run Migrations

Once your database is created and credentials are set in `backend/.env`, execute:

```powershell
cd backend
.\venv\Scripts\python.exe manage.py migrate
```

