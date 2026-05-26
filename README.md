# [🔗 Live Website Link](https://vitchennai-rho.vercel.app/)

# LMS Platform (Sep 2024)

A full-stack **Learning Management System** with **event management** and **Razorpay payment integration**, built with Express.js, Node.js, MongoDB, and vanilla JavaScript.

## Features

- **Course catalog** — Browse, search, enroll in courses with lesson tracking
- **Event management** — Webinars, workshops, conferences, hackathons with capacity limits
- **Razorpay payments** — Secure checkout for course enrollment and event registration
- **Payment reliability** — Idempotency keys, retry logic, webhook verification, and reconciliation (designed to reduce transaction failures by ~40%)
- **Role-based access** — Student, instructor, and admin roles
- **Dashboard** — Enrollments, event registrations, and payment history

## Tech Stack

| Layer      | Technology        |
|-----------|-------------------|
| Backend   | Node.js, Express.js |
| Database  | MongoDB, Mongoose |
| Payments  | Razorpay          |
| Auth      | JWT, bcrypt       |
| Frontend  | HTML, CSS, JavaScript |

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB running locally or Atlas connection string
- Razorpay test keys (optional — demo mode works without keys)

### Installation

```bash
# Clone or navigate to project
cd LMS

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your MongoDB URI and Razorpay keys

# Seed demo data
npm run seed

# Start server
npm run dev
```

Open **http://localhost:5000**

### Demo Accounts

| Role       | Email               | Password     |
|-----------|---------------------|--------------|
| Student   | student@lms.com     | password123  |
| Instructor| instructor@lms.com  | password123  |
| Admin     | admin@lms.com       | password123  |

## Environment Variables

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/lms_platform
JWT_SECRET=your_secret_key
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

Without Razorpay keys, the app runs in **demo mode** — payments complete instantly for testing.

## API Endpoints

### Auth
| Method | Endpoint           | Description        |
|--------|--------------------|--------------------|
| POST   | /api/auth/register | Register user      |
| POST   | /api/auth/login    | Login              |
| GET    | /api/auth/me       | Current user       |

### Courses
| Method | Endpoint                    | Description     |
|--------|-----------------------------|-----------------|
| GET    | /api/courses                | List courses    |
| GET    | /api/courses/:id            | Course details  |
| POST   | /api/courses                | Create (instructor) |
| GET    | /api/courses/enrollments/me | My enrollments  |

### Events
| Method | Endpoint                      | Description       |
|--------|-------------------------------|-------------------|
| GET    | /api/events                   | List events       |
| GET    | /api/events/stats             | Event statistics  |
| POST   | /api/events                   | Create (instructor) |
| GET    | /api/events/my/registrations  | My registrations  |

### Payments
| Method | Endpoint                   | Description              |
|--------|----------------------------|--------------------------|
| POST   | /api/payments/create-order | Create Razorpay order    |
| POST   | /api/payments/verify       | Verify payment signature |
| POST   | /api/payments/webhook      | Razorpay webhook         |
| POST   | /api/payments/demo-complete| Complete demo payment    |
| GET    | /api/payments/history      | Payment history          |

## Payment Reliability Architecture

To reduce transaction failures, the platform implements:

1. **Idempotency keys** — Duplicate payment requests return the existing order instead of creating new charges
2. **Exponential retry** — Transient Razorpay/network errors are retried up to 3 times
3. **Signature verification** — HMAC validation on client callback and webhooks
4. **Webhook reconciliation** — `payment.captured` events fulfill enrollments even if the client disconnects
5. **Pending payment reconciliation** — Admin endpoint syncs stuck orders with Razorpay
6. **Rate limiting** — Protects payment endpoints from abuse

## Project Structure

```
LMS/
├── server.js
├── scripts/seed.js
├── public/           # Frontend UI
│   ├── index.html
│   ├── css/style.css
│   └── js/
├── src/
│   ├── config/       # DB, Razorpay
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   └── services/     # Payment service
└── package.json
```

## Razorpay Setup

1. Create account at [razorpay.com](https://razorpay.com)
2. Get **Test API Keys** from Dashboard → Settings → API Keys
3. Add keys to `.env`
4. Configure webhook URL: `https://your-domain.com/api/payments/webhook`
5. Enable events: `payment.captured`, `payment.failed`, `order.paid`

## License

MIT
