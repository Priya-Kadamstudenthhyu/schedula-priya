# 🏥 Schedula – Doctor-Patient Appointment Booking API

A production-ready RESTful backend API for a doctor-patient appointment scheduling platform built with **Node.js**, **Express**, **TypeScript**, **Prisma ORM**, and **PostgreSQL**.

> **Live API:** [https://schedula-priya.onrender.com](https://schedula-priya.onrender.com)

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
│   └── discovery.controller.ts
├── middlewares/        # Auth, role, error handlers
│   ├── auth.middleware.ts
│   ├── role.middleware.ts
│   └── error.middleware.ts
├── routes/             # API route definitions
│   ├── auth.routes.ts
│   ├── doctor.routes.ts
│   └── patient.routes.ts
├── validators/         # Zod schemas
│   ├── auth.validator.ts
│   └── profile.validator.ts
└── server.ts           # App entry point
prisma/
├── schema.prisma       # Database schema
└── migrations/         # Migration history
```

---

## 🔗 API Endpoints

### Auth Routes (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/signup` | Register a new Doctor or Patient | ❌ |
| `POST` | `/api/auth/login` | Login and receive a JWT token | ❌ |

#### Signup Request Body
```json
{
  "name": "Dr. Priya Kadam",
  "email": "priya@gmail.com",
  "password": "password123",
  "role": "DOCTOR"
}
```

#### Login Request Body
```json
{
  "email": "priya@gmail.com",
  "password": "password123"
}
```

---

### Doctor Onboarding Routes (`/api/doctor/profile`)
> 🔒 **DOCTOR role only** | Requires `Authorization: Bearer <TOKEN>` header

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/doctor/profile` | Create doctor profile |
| `GET` | `/api/doctor/profile` | Get own doctor profile |
| `PATCH` | `/api/doctor/profile` | Update doctor profile |

#### Doctor Profile Request Body
```json
{
  "fullName": "Dr. Priya Kadam",
  "specialization": "Cardiologist",
  "experience": 10,
  "qualification": "MBBS, MD",
  "consultationFee": 1000,
  "availability": "Mon-Fri 9AM-5PM"
}
```

---

### Doctor Discovery Routes (`/api/doctor`)
> 🔒 Any logged-in user (Doctor or Patient)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/doctor` | Fetch all doctors (with filters & pagination) |
| `GET` | `/api/doctor/:id` | Get a specific doctor by ID |

#### Query Parameters for Filtering
| Parameter | Example | Description |
|---|---|---|
| `search` | `?search=priya` | Partial name search (case-insensitive) |
| `specialization` | `?specialization=cardiologist` | Filter by specialization |
| `availability` | `?availability=true` | Filter by availability |
| `page` | `?page=1` | Page number (default: 1) |
| `limit` | `?limit=10` | Results per page (default: 10) |

---

### Patient Onboarding Routes (`/api/patient/profile`)
> 🔒 **PATIENT role only** | Requires `Authorization: Bearer <TOKEN>` header

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/patient/profile` | Create patient profile |
| `GET` | `/api/patient/profile` | Get own patient profile |
| `PATCH` | `/api/patient/profile` | Update patient profile |

#### Patient Profile Request Body
```json
{
  "fullName": "Priya Kadam",
  "age": 25,
  "gender": "Female",
  "contactNumber": "9876543210",
  "healthInfo": "No known allergies"
}
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
JWT_SECRET="your_super_secret_key"
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

# 3. Set up environment variables
# Create a .env file with the values above

# 4. Run database migrations
npx prisma migrate dev

# 5. Start development server
npm run dev
```

---

## 🏗️ Build for Production

```bash
# Compile TypeScript
npm run build

# Start production server
npm start
```

---

## 📦 Branch Structure

| Branch | Purpose |
|---|---|
| `main` | Production-ready code |
| `feature/auth-roles` | Day 2 – Auth & Role-based access |
| `feature/onboarding` | Day 3 – Doctor & Patient onboarding APIs |
| `feature/discovery` | Day 4 – Doctor Discovery & Search APIs |
| `feature/deployment` | Day 5 – Production deployment configuration |

---

## 🔒 Security Features

- JWT-based stateless authentication
- Role-based access control (DOCTOR / PATIENT)
- Zod schema validation on all request bodies
- bcryptjs password hashing (salt rounds: 10)
- Environment variables for all secrets (no hardcoding)

---

## 👩‍💻 Author

**Priya Kadam** – Backend Internship Program
- GitHub: [@Priya-Kadamstudenthhyu](https://github.com/Priya-Kadamstudenthhyu)
