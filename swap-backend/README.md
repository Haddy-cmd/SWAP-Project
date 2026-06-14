# SWAP Backend

**Digital Monitoring and Application System for the Student Welfare Assistantship Program**
Mindanao State University — Marawi

REST API for the SWAP Portal. Handles authentication, applications, document uploads,
attendance/service hours, stipend tracking, and role-based access for applicants,
recipients, supervisors, and admins.

## Stack

- **Laravel 12** (PHP 8.2+)
- **PostgreSQL** (primary database)
- **Laravel Sanctum 4.x** — token-based API authentication
- **Laravel Tinker** — REPL / debugging
- *(optional)* **Laravel Reverb** — WebSocket broadcasting (not installed by default)

## Requirements

- PHP 8.2 or higher (with `pdo_pgsql`, `mbstring`, `openssl`, `fileinfo` extensions)
- Composer
- PostgreSQL 14+
- Node.js (only if building Reverb/broadcasting assets)

## Setup

### 1. Install dependencies
```bash
composer install
```

### 2. Environment
```bash
cp .env.example .env
php artisan key:generate
```

Edit `.env` — set your PostgreSQL connection:
```
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=swap_db
DB_USERNAME=postgres
DB_PASSWORD=your_password

FRONTEND_URL=http://localhost:3000

# Disk used for applicant document uploads (COR, grades, etc.).
# Defaults to the local "public" disk — no change needed for local dev.
DOCUMENTS_DISK=public
```

### 3. Create the database
```bash
psql -U postgres -c "CREATE DATABASE swap_db;"
```

### 4. Migrate and seed
```bash
php artisan migrate --seed
```

This creates all tables (including Sanctum's `personal_access_tokens`) and seeds
demo users, offices, and FAQ knowledge base entries.

### 5. Link storage (required for document uploads)
```bash
php artisan storage:link
```

Applicant documents are stored on the local `public` disk and served via the
`/storage` symlink. **Uploads will fail without this step.**

### 6. Run
```bash
php artisan serve
```

API available at `http://localhost:8000/api`.

## Seeded Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@msu-marawi.edu.ph` | `Admin@12345` |
| Supervisor | `supervisor1@msu-marawi.edu.ph` | `Super@12345` |
| Supervisor | `supervisor2@msu-marawi.edu.ph` | `Super@12345` |
| Applicant | `ali@student.msu-marawi.edu.ph` | `Student@12345` |
| Applicant | `fatima@student.msu-marawi.edu.ph` | `Student@12345` |
| Applicant | `amir@student.msu-marawi.edu.ph` | `Student@12345` |
| Recipient | `norhana@student.msu-marawi.edu.ph` | `Student@12345` |
| Recipient | `ibrahim@student.msu-marawi.edu.ph` | `Student@12345` |

## Authentication

Token-based via **Laravel Sanctum**:

- `POST /api/auth/login` and `POST /api/auth/register` return a plain-text bearer token.
- Clients send it as `Authorization: Bearer <token>` on every request.
- `User` uses the `HasApiTokens` trait; the `sanctum` guard is defined in `config/auth.php`.

### Role-based access

The custom `role` middleware (`App\Http\Middleware\CheckRole`, registered as the
`role` alias in `bootstrap/app.php`) gates route groups by user role:

```php
Route::middleware('role:applicant')->prefix('applicant')->group(...);
Route::middleware('role:admin')->prefix('admin')->group(...);
```

## Applicant Document Uploads

`POST /api/applicant/applications/{id}/documents` (multipart):

- `file` — `pdf`, `jpg`, `jpeg`, or `png`, max 5 MB
- `document_type` — one of:
  `birth_certificate`, `cor`, `grades`, `income_certificate`,
  `letter_of_intent`, `id_photo`, `recommendation_letter`, `other`

The four documents collected by the application form are:

| Label | `document_type` |
|---|---|
| Certificate of Registration | `cor` |
| Grade Card | `grades` |
| Letter of Intent | `letter_of_intent` |
| 2×2 Photo | `id_photo` |

Files are stored on the disk named by `DOCUMENTS_DISK` (default `public`). To use
S3 in production, set `DOCUMENTS_DISK=s3`, install
`composer require league/flysystem-aws-s3-v3`, and configure the AWS credentials in `.env`.

## API Structure

| Prefix | Middleware | Purpose |
|---|---|---|
| `/api/auth/*` | public | Login, register, password reset |
| `/api/applicant/*` | `auth:sanctum` + `role:applicant` | Applications, documents |
| `/api/recipient/*` | `auth:sanctum` + `role:recipient` | Attendance, hours, narratives |
| `/api/supervisor/*` | `auth:sanctum` + `role:supervisor` | Student verification |
| `/api/admin/*` | `auth:sanctum` + `role:admin` | Applications, users, offices, stipend, analytics |

Shared authenticated routes (profile, notifications, concerns) sit directly under
`auth:sanctum`.

## Real-time (optional)

Broadcasting via Laravel Reverb is configured in `.env` but the package is **not
installed by default**. To enable it:

```bash
composer require laravel/reverb
php artisan reverb:install
php artisan reverb:start
```

## Testing

```bash
php artisan test
```

## License

Built on the Laravel framework, open-sourced under the [MIT license](https://opensource.org/licenses/MIT).
