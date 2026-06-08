# Chest Scanner Web

A modern Next.js web application for tracking chest scanning logs, managing clan member whitelists, and correcting OCR names. Powered by Next.js, Prisma, CockroachDB, and Tailwind CSS.

---

## 🛠️ Database Setup & Migrations

This project uses **Prisma** as the ORM and **CockroachDB** as the database provider.

### 1. Environment Configuration
Ensure your `.env` or `.env.local` file contains the correct `DATABASE_URL` connection string:
```env
DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/<db_name>?sslmode=verify-full"
```

### 2. Running & Managing Migrations

Depending on your environment, use one of the following commands:

#### 🔹 Development (Generate and Apply Migrations)
When you make changes to `prisma/schema.prisma` in development, run the following command to automatically generate a new SQL migration file and apply it to your database:
```bash
npx prisma migrate dev --name <migration_name>
```
*This will also automatically run `npx prisma generate` to update the Prisma Client types.*

#### 🔹 Production / Staging (Deploy Pending Migrations)
To apply already generated migrations to a production or staging database without prompting or creating new migrations:
```bash
npx prisma migrate deploy
```

#### 🔹 Prototyping (Push Schema Directly)
If you want to quickly sync your schema with the database without creating migration history files (useful for fast prototyping):
```bash
npx prisma db push
```

#### 🔹 Troubleshooting / Verification
To check if your database is in sync with your migrations:
```bash
npx prisma migrate status
```
To open Prisma Studio (a visual interface to view and edit your database tables):
```bash
npx prisma studio
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Generate Prisma Client
If you've just cloned the repository or installed packages, generate the Prisma Client:
```bash
npx prisma generate
```

### 3. Run the Development Server
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
