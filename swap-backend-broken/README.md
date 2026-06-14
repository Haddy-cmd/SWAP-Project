# SWAP Backend

**Digital Monitoring and Application System for the Student Welfare Assistantship Program**  
Mindanao State University — Marawi

## Stack

- **PHP 8.5** · **Laravel 13**
- **PostgreSQL 17** (primary database with native ENUM types and GENERATED ALWAYS AS STORED columns)
- **Redis 7.x** (queue driver + cache)
- **Laravel Sanctum 4.x** (token-based API authentication)
- **Laravel Reverb 1.x** (WebSocket server)
- **Laravel Horizon 5.x** (queue monitoring)
- **Laravel DomPDF 3.x** (PDF generation)
- **Laravel Excel 3.x** (Excel export)
- **Pest PHP** (testing)

## Architecture

Clean Architecture with Repository + Service pattern:

```
app/
├── Http/Controllers/        # Thin orchestrators — no business logic
├── Services/                # All business logic lives here
├── Repositories/
│   ├── Contracts/           # Interfaces
│   └── *Repository.php      # PostgreSQL-specific implementations
├── Models/                  # Eloquent models with relationships
├── Events/                  # Broadcastable events
├── Listeners/               # Dispatch queued jobs
├── Jobs/                    # Queued notification dispatch
├── Notifications/           # Mail + database notifications
└── Providers/               # DI bindings in AppServiceProvider
```

## Setup

### 1. Requirements
- PHP 8.5+ with extensions: `pdo_pgsql`, `redis`, `pcntl`
- Composer
- PostgreSQL 17
- Redis 7.x
- Node.js 20+ (for Reverb asset compilation)

### 2. Install dependencies
```bash
composer install
```

### 3. Environment
```bash
cp .env.example .env
php artisan key:generate
```

Edit `.env` and configure:
- `DB_*` — PostgreSQL credentials
- `REDIS_HOST` — Redis connection
- `REVERB_*` — WebSocket configuration
- `MAIL_*` — SMTP credentials
- `AWS_*` / `FILESYSTEM_DISK=s3` — Supabase S3-compatible storage

### 4. Database
```bash
php artisan migrate --seed
```

This runs all 19 migrations in order and seeds: admin user, supervisors, offices, assignments, FAQs.

**Default credentials (from seeder):**
- Admin: `admin@msumarawi.edu.ph` / `password`
- Supervisor: `supervisor1@msumarawi.edu.ph` / `password`
- Applicant: `applicant1@msumarawi.edu.ph` / `password`

### 5. Run services
```bash
# API server
php artisan serve

# WebSocket server (Reverb)
php artisan reverb:start

# Queue worker (Horizon)
php artisan horizon

# (Optional) Horizon dashboard at /horizon
```

## API

All endpoints are prefixed with `/api`.

| Group | Auth | Example |
|---|---|---|
| Public | None | `POST /api/auth/login` |
| Authenticated | Bearer token | `GET /api/profile` |
| Applicant | `role:applicant` | `POST /api/applicant/applications` |
| Recipient | `role:recipient` | `POST /api/recipient/attendance/time-in` |
| Supervisor | `role:supervisor` | `GET /api/supervisor/students` |
| Admin | `role:admin` | `GET /api/admin/applications` |

Full route list: `routes/api.php`

## Key Design Decisions

### QR Code Security
QR tokens are HMAC-SHA256 signed: `base64(json_payload) + "." + hmac(payload, APP_KEY)`.  
Validation uses `hash_equals()` to prevent timing attacks.  
The secret can be rotated via `POST /api/admin/assignments/{id}/regenerate-qr`.

### PostgreSQL ENUM types
Created with `DB::statement("CREATE TYPE type_name AS ENUM (...)")` rather than Laravel's `->enum()` which creates a varchar constraint.

### GENERATED ALWAYS AS STORED columns
`time_logs.duration_hours` and `semester_reports.completion_rate` are computed by the database and excluded from `$fillable`.

### Narrative enforcement
`AttendanceService::timeOut()` throws HTTP 422 if no `NarrativeReport` exists for the log.

### Real-time events
| Event | Channel | When |
|---|---|---|
| `ApplicationStatusChanged` | `private-user.{id}` | Application approved/rejected |
| `InterviewScheduled` | `private-user.{id}` | Interview scheduled |
| `HoursVerified` | `private-user.{id}` | Hours verified |
| `HoursRejected` | `private-user.{id}` | Hours rejected |
| `AttendanceStarted` | `private-supervisor.{id}` | Recipient clocks in |
| `AttendanceCompleted` | `private-supervisor.{id}` | Recipient clocks out |

## Testing
```bash
# Run all tests
php artisan test

# With coverage
php artisan test --coverage
```

Key test files:
- `tests/Feature/Recipient/AttendanceTest.php` — time-in/out including 409 conflict and 422 narrative enforcement
- `tests/Unit/Services/QrCodeServiceTest.php` — HMAC token generation and validation
