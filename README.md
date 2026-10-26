# 🏥 Medical Management System — Backend

A full-stack **Medical Management System** backend built with **Node.js, TypeScript, and Domain-Driven Design (DDD)**. It manages patients, doctors, appointments, prescriptions, billing, pharmacy inventory, and includes a **rule-based AI vitals checker** that flags abnormal patient readings (blood pressure, sugar, temperature, heart rate, pulse rate, RBC, and WBC counts).

> ⚠️ This project is under active development. Some modules may still be incomplete.
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb+srv://mabbasmshahi2003_db_user:mabbas0008@medical-management.9rzf5w9.mongodb.net/project
JWT_SECRET=medical_management_super_secure_jwt_secret_key_32chars_minimum
REDIS_URL=redis://default:Z05Q9JR7PZV4Pb5KRLCIEKUn6b4sfdM8@kettle-ultraclean-sensory-22185.db.redis.io:17260









---
## 📖 Table of Contents
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Endpoints](#-api-endpoints)
- [AI Vitals Checker](#-ai-vitals-checker)
- [Authentication & Security](#-authentication--security)
- [Running with Docker](#-running-with-docker-optional)
- [Testing](#-testing)
- [Roadmap](#-roadmap)

---

## ✨ Features

### Core Modules
- **Patient Management** — create, update, search, and manage patient records
- **Doctor Management** — doctor profiles and specializations
- **Appointment Booking** — schedule, cancel, and track appointments between patients and doctors
- **Authentication** — register/login with JWT, Redis-based token blacklisting on logout
- **AI Vitals Checker** — analyzes Blood Pressure, Sugar, Temperature, Heart Rate, Pulse Rate, RBC & WBC counts against medical thresholds and flags abnormal results

### Extended Modules
- **Prescriptions** — doctors can prescribe medicines with dosage and instructions
- **Medical Records & History** — diagnosis, notes, and allergy tracking per patient
- **Lab Report Uploads** — upload and retrieve X-ray/blood test files (PDF/JPG/PNG)
- **Billing & Invoicing** — generate and track payment status for appointments
- **Pharmacy/Inventory** — manage medicine stock levels
- **Emergency Alerts** — critical vitals trigger email and real-time (Socket.io) notifications to doctors
- **Role-Based Access Control (RBAC)** — Admin, Doctor, Nurse, and Patient roles with route-level permissions
- **OTP / Multi-Factor Authentication** — email-based OTP verification on login
- **Patient Self-Portal** — patients can view their own profile, appointments, and vitals history
- **Admin Dashboard** — aggregate stats (total patients, doctors, appointments, critical vitals)
- **Search, Filters & CSV Export** — query and export patient data

---

## 🛠 Tech Stack

| Category | Technology |
|---|---|
| Runtime | Node.js |
| Language | TypeScript |
| Framework | Express.js |
| Database | MongoDB (Mongoose ODM) — MongoDB Atlas |
| Caching / Token Store | Redis (Redis Cloud) |
| Authentication | JWT, bcrypt, OTP (email-based) |
| Real-time | Socket.io |
| Email | Nodemailer |
| SMS | Twilio |
| File Uploads | Multer |
| Validation | Zod |
| Containerization | Docker & Docker Compose *(optional, not required for local dev)* |
| Dev Tooling | tsx, nodemon |

---

## 🏗 Architecture

This backend follows **Domain-Driven Design (DDD)** with a 4-layer structure:

```
┌─────────────────────────────┐
│  Presentation Layer         │  ← Controllers, Routes, Middlewares
├─────────────────────────────┤
│  Application Layer          │  ← Use cases / Application Services, DTOs
├─────────────────────────────┤
│  Domain Layer                │  ← Entities, Value Objects, Repository Interfaces
├─────────────────────────────┤
│  Infrastructure Layer       │  ← MongoDB Schemas, Repository Implementations, Redis, Email/SMS
└─────────────────────────────┘
```

Each business module (Patient, Doctor, Appointment, Vitals, Prescription, Billing, Pharmacy, etc.) follows this same layered pattern, keeping business logic independent of frameworks and the database.

---

## 📂 Project Structure

```
Backend/
├── src/
│   ├── domain/
│   │   ├── patient/
│   │   ├── doctor/
│   │   ├── appointment/
│   │   ├── vitals/
│   │   ├── prescription/
│   │   ├── medical-record/
│   │   ├── billing/
│   │   └── pharmacy/
│   │
│   ├── application/
│   │   └── (DTOs + Application Services per module)
│   │
│   ├── infrastructure/
│   │   ├── database/
│   │   │   ├── schemas/
│   │   │   └── repositories/
│   │   ├── auth/
│   │   ├── notifications/
│   │   ├── upload/
│   │   └── config/
│   │
│   ├── presentation/
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── middlewares/
│   │
│   └── main.ts
│
├── uploads/              # Uploaded lab report files
├── .env
├── .gitignore
├── package.json
├── tsconfig.json
├── Dockerfile
└── docker-compose.yml
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- A MongoDB Atlas connection string (or local MongoDB)
- A Redis connection (Redis Cloud or local)

### Installation

```bash
# Clone the repository
git clone https://github.com/MuhammadAbbas-coder004/Madical-Managment.git
cd Madical-Managment/Backend

# Install dependencies
npm install

# Set up environment variables (see below)
cp .env.example .env

# Run in development mode
npm run dev
```

If the server starts successfully, you should see:
```
Redis connected successfully
Redis client is ready
MongoDB connected successfully
Server running on port 5000
```

### Available Scripts
```bash
npm run dev     # Run in development mode (tsx watch)
npm run build   # Compile TypeScript to JavaScript
npm start       # Run the compiled production build
```

---

## 🔑 Environment Variables

The backend requires several environment variables for database connections, caching, authentication, and notifications.

### 1. Create Your `.env` File

Copy the template from `.env.example` in the `Backend` directory:

```bash
# On Linux / macOS:
cp .env.example .env

# On Windows (Command Prompt):
copy .env.example .env

# On Windows (PowerShell):
Copy-Item .env.example .env
```

### 2. Configure Required Variables

Fill in the `.env` file with your environment-specific credentials:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database (MongoDB)
# Local: mongodb://localhost:27017/medical_management
# Atlas: mongodb+srv://<username>:<password>@<cluster-host>/medical_management?retryWrites=true&w=majority
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/medical_management?retryWrites=true&w=majority

# Caching & Token Blacklist (Redis)
# Local: redis://localhost:6379
# Cloud: redis://:<password>@<redis-host>:<port>
REDIS_URL=redis://:<password>@<redis-host>:<port>

# Authentication (JWT)
# Generate a secure key: openssl rand -hex 32
JWT_SECRET=your_jwt_secret_key_here

# Email Notifications (Nodemailer / SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_app_password

# SMS Notifications (Twilio - Optional)
TWILIO_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE=+1234567890
```

### 3. Variable Descriptions & Setup Guidance

| Variable | Required | Description | Example / Default |
|---|:---:|---|---|
| `PORT` | No | Port on which Express server listens | `5000` |
| `NODE_ENV` | No | Runtime environment (`development`, `production`, `test`) | `development` |
| `CLIENT_URL` | No | Frontend URL for CORS origin whitelist | `http://localhost:5173` |
| `MONGODB_URI` | **Yes** | MongoDB connection URI (Atlas or local instance) | `mongodb://localhost:27017/medical_management` |
| `REDIS_URL` | **Yes** | Redis connection URI for token blacklisting & session store | `redis://localhost:6379` |
| `JWT_SECRET` | **Yes** | Secret string used to sign and verify authentication tokens | Strong random 256-bit secret string |
| `EMAIL_HOST` | No | SMTP server hostname for email alerts / OTP | `smtp.gmail.com` |
| `EMAIL_PORT` | No | SMTP server port (`587` for STARTTLS, `465` for SSL) | `587` |
| `EMAIL_USER` | No | SMTP username / email address | `your_email@example.com` |
| `EMAIL_PASS` | No | SMTP application-specific password | Google App Password |
| `TWILIO_SID` | No | Twilio Account SID for SMS alerts | Twilio console SID |
| `TWILIO_AUTH_TOKEN` | No | Twilio Auth Token for SMS alerts | Twilio auth token |
| `TWILIO_PHONE` | No | Twilio sender phone number | `+1234567890` |

> 🔒 **Security Notice:**
> - **NEVER commit `.env` or real secrets to Git.**
> - Keep `.env` listed in `.gitignore` at all times.
> - If credentials (such as database passwords or API keys) are ever accidentally committed or exposed, revoke and rotate them immediately.

---

## 📡 API Endpoints

All endpoints are prefixed with `/api`.

| Module | Method | Endpoint | Description |
|---|---|---|---|
| Health | GET | `/health` | Server health check |
| Auth | POST | `/api/auth/register` | Register a new user |
| Auth | POST | `/api/auth/login` | Login (returns JWT / sends OTP) |
| Auth | POST | `/api/auth/logout` | Logout (blacklists token in Redis) |
| Patients | POST | `/api/patients` | Create a patient |
| Patients | GET | `/api/patients` | List all patients (supports search filters) |
| Patients | GET | `/api/patients/:patientId` | Get a single patient |
| Doctors | POST | `/api/doctors` | Create a doctor |
| Doctors | GET | `/api/doctors` | List all doctors |
| Doctors | GET | `/api/doctors/:doctorId` | Get a single doctor |
| Appointments | POST | `/api/appointments` | Book an appointment |
| Appointments | GET | `/api/appointments/patient/:patientId` | Get appointments by patient |
| Appointments | GET | `/api/appointments/doctor/:doctorId` | Get appointments by doctor |
| Appointments | PUT | `/api/appointments/:id/cancel` | Cancel an appointment |
| Vitals | POST | `/api/vitals` | Record & analyze patient vitals |
| Vitals | GET | `/api/vitals/patient/:patientId` | Get vitals history for a patient |
| Prescriptions | POST | `/api/prescriptions` | Create a prescription |
| Prescriptions | GET | `/api/prescriptions/patient/:patientId` | Get prescriptions by patient |
| Medical Records | POST | `/api/medical-records` | Create a medical record |
| Medical Records | GET | `/api/medical-records/patient/:patientId` | Get records by patient |
| Lab Reports | POST | `/api/lab-reports/upload/:patientId` | Upload a lab report file |
| Lab Reports | GET | `/api/lab-reports/patient/:patientId` | Get reports by patient |
| Billing | POST | `/api/billing` | Create an invoice |
| Billing | PUT | `/api/billing/:id/pay` | Mark an invoice as paid |
| Billing | GET | `/api/billing/patient/:patientId` | Get invoices by patient |
| Pharmacy | POST | `/api/pharmacy` | Add a medicine to inventory |
| Pharmacy | GET | `/api/pharmacy` | List all medicines |
| Pharmacy | PUT | `/api/pharmacy/:id/reduce-stock` | Reduce medicine stock |

> Most routes require a valid **Bearer token** in the `Authorization` header.

---

## 🤖 AI Vitals Checker

The vitals module evaluates each submitted reading against standard medical thresholds and returns a `normal`, `warning`, or `critical` status with flagged parameters.

| Vital | Normal Range |
|---|---|
| Blood Pressure | 90–120 / 60–80 mmHg |
| Sugar Level | 70–140 mg/dL |
| Temperature | 97–99°F |
| Heart Rate | 60–100 bpm |
| Pulse Rate | 60–100 bpm |
| RBC Count | 4.2–5.9 million/µL |
| WBC Count | 4,000–11,000/µL |

**Example request:**
```json
POST /api/vitals
{
  "patientId": "083c21e1-fcbd-45a0-9600-04d73ea92ce2",
  "bloodPressureSystolic": 115,
  "bloodPressureDiastolic": 75,
  "sugarLevel": 90,
  "temperature": 98.4,
  "heartRate": 72,
  "pulseRate": 70,
  "rbcCount": 4.8,
  "wbcCount": 6500
}
```

**Example response:**
```json
{
  "success": true,
  "message": "Vitals recorded and analyzed successfully",
  "analysis": {
    "status": "normal",
    "flaggedParams": [],
    "message": "All vitals are within normal range."
  }
}
```

If vitals are flagged as `critical`, the system automatically sends an **email alert** and a **real-time Socket.io notification** to the assigned doctor.

> ⚠️ This is a rule-based engine, not a diagnostic AI. It is intended to assist, not replace, professional medical judgment.

---

## 🔐 Authentication & Security

- Passwords are hashed with **bcrypt**
- Sessions are managed with **JWT**
- Logged-out tokens are **blacklisted in Redis** so they can't be reused
- Optional **OTP verification** adds a second authentication factor on login
- **Role-Based Access Control** restricts sensitive routes (e.g., only `admin` can create doctors)
- Request bodies are validated with **Zod** before reaching business logic

---

## 🐳 Running with Docker (Optional)

Docker configuration is included for future deployment but is **not required** for local development (this project currently runs against MongoDB Atlas and Redis Cloud).

```bash
docker-compose build
docker-compose up
```

This spins up three services: `backend`, `mongodb`, and `redis`.

---

## 🧪 Testing

API endpoints can be tested with **Postman**:
1. Register a user → `POST /api/auth/register`
2. Login → `POST /api/auth/login`
3. Copy the returned token into an `Authorization: Bearer <token>` header
4. Test protected routes (Patients, Doctors, Appointments, Vitals, etc.)

Basic unit tests (Jest) are set up for core domain logic (e.g., value object validation).

---

## 🗺 Roadmap

- [ ] Frontend (React + Vite, Atomic Design)
- [ ] Swagger/OpenAPI documentation
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Expanded test coverage
- [ ] Production deployment guide

---

## 👤 Author

**Muhammad Abbas**
GitHub: [@MuhammadAbbas-coder004](https://github.com/MuhammadAbbas-coder004)

---

## 📄 License

This project currently has no license specified. All rights reserved by the author unless stated otherwise.
<!-- code -->