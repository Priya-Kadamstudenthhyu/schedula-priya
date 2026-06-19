# 🏥 Schedula – Doctor-Patient Appointment Booking API

A production-ready RESTful backend API for a doctor-patient appointment scheduling platform built with **Node.js**, **Express**, **TypeScript**, **Prisma ORM**, and **PostgreSQL**.

> **Live API:** [https://schedula-priya.onrender.com](https://schedula-priya.onrender.com)
> **Postman Collection:** Located in the repository root at [Schedula.postman_collection.json](./Schedula.postman_collection.json)

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Language | TypeScript |
| Framework | Express.js |
| ORM | Prisma |
| Database | PostgreSQL (Neon - Hosted) |
| Validation | Zod |
| Auth | JWT (JSON Web Tokens) |
| Password Hashing | bcryptjs |
| Deployment | Render |

---

## 📁 Project Structure

```
src/
├── controllers/        # Business logic
│   ├── auth.controller.ts
│   ├── profile.controller.ts
│   ├── discovery.controller.ts
│   ├── availability.controller.ts
│   ├── slot.controller.ts
│   └── appointment.controller.ts
├── middlewares/        # Auth, role, error handlers
│   ├── auth.middleware.ts
│   ├── role.middleware.ts
│   └── error.middleware.ts
├── routes/             # API route definitions
│   ├── auth.routes.ts
│   ├── doctor.routes.ts
│   ├── patient.routes.ts
│   ├── availability.routes.ts
│   └── appointment.routes.ts
├── validators/         # Zod schemas
│   ├── auth.validator.ts
│   ├── profile.validator.ts
│   ├── availability.validator.ts
│   └── appointment.validator.ts
└── server.ts           # App entry point
prisma/
├── schema.prisma       # Database schema
└── migrations/         # Migration history
```

---

## 🛠️ Features Implemented (Up to Day 10)

### 1. Authentication & Roles (`Day 1 & Day 2`)
- JWT-based authentication with stateless login.
- Role-Based Access Control (RBAC) restricting specific endpoints to `PATIENT` or `DOCTOR` roles.

### 2. Profiles & Onboarding (`Day 3`)
- Dedicated doctor and patient onboarding forms.
- Configure specialization, experience, fees, and configurable slot durations.

### 3. Doctor Discovery & Search (`Day 4`)
- Paginated search APIs with parameters for `name`, `specialization`, and `availability`.

### 4. Availability & Slot Generation (`Day 6 & Day 7`)
- **Recurring Availability:** Weekly doctor schedules (e.g. Every Monday 09:00 - 13:00).
- **Custom Availability Overrides:** Specific single-date overrides that take precedence over recurring rules.
- **Dynamic Slot Generation:** Calculates exact time slots based on the doctor's `slotDuration` (Stream strategy), filtering out already booked or past slots.

### 5. Appointment Booking (`Day 8`)
- Patients can view available slots and book appointments.
- Prevent duplicate bookings for the same slot.

### 6. Advanced Scheduling Strategies (`Day 9`)
- **STREAM strategy:** Exact 1-on-1 time slots with optional customizable buffer times between sessions.
- **WAVE strategy:** High-volume token-based bookings where a doctor sets a capacity (e.g. max 5 patients) per entire window. Assigned sequential tokens (Token 1, 2, 3...) upon booking.

### 7. Appointment Rescheduling (`Day 10`)
- Patients can reschedule existing appointments to a new slot (Stream or Wave).
- **30-Minute Cutoff Rule:** Patients cannot reschedule or cancel an appointment if less than 30 minutes remain before its start time.
- **Auto Next-Slot Suggestions:** If a slot is booked, full, or unavailable, the response automatically computes and suggests the next available slot for that doctor.
- **Serializable Transactions:** Uses `Prisma` transactions with `Serializable` isolation level to completely prevent race conditions.

---

## 🔗 API Endpoints

Detailed endpoint routes and documentation are exported in [Schedula.postman_collection.json](./Schedula.postman_collection.json). Below is a summary:

### Auth APIs (`/api/auth`)
- `POST /api/auth/signup` - Register a user
- `POST /api/auth/login` - Authenticate user & get JWT

### Profile Onboarding (`/api/patient` & `/api/doctor`)
- `POST /api/patient/profile` - Onboard patient details
- `POST /api/doctor/profile` - Onboard doctor configurations
- `GET /api/doctor/profile` - Retrieve own doctor configurations

### Availability Management (`/api/doctor/availability`)
- `POST /api/doctor/availability/recurring` - Set recurring weekly schedule
- `POST /api/doctor/availability/custom` - Set custom date availability overrides

### Discovery & Slots (`/api/doctor`)
- `GET /api/doctor` - List and filter doctors
- `GET /api/doctor/:doctorId/slots?date=YYYY-MM-DD` - Retrieve available booking slots/waves for a specific date

### Appointment Booking & Rescheduling (`/api/appointment`)
- `POST /api/appointment` - Book a slot/wave
- `GET /api/appointment/my` - View patient appointments
- `PATCH /api/appointment/:id/cancel` - Cancel appointment (patient)
- `PATCH /api/appointment/:id/reschedule` - Reschedule appointment (patient)

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
JWT_SECRET="your_jwt_secret_key"
PORT=3000
```

---

## 🛠️ Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/Priya-Kadamstudenthhyu/schedula-priya.git
cd schedula-priya

# 2. Install dependencies
npm install

# 3. Create .env file
# Configure DATABASE_URL, JWT_SECRET, and PORT

# 4. Generate client & run database migrations
npx prisma generate
npx prisma migrate dev

# 5. Start development server
npm run dev
```

---

## 📦 Branch Strategy & Workflow
- **`main`**: Production release branch.
- **`feature/rescheduling`**: Isolated branch containing Day 10 Rescheduling APIs.

---

## 👩‍💻 Author

**Priya Kadam** – Backend Internship Program
- GitHub: [@Priya-Kadamstudenthhyu](https://github.com/Priya-Kadamstudenthhyu)
