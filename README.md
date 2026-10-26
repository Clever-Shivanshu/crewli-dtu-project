# Crewli Platform

Crewli is an on-demand service dispatch platform (similar to Uber for home services like electricians, plumbers, and carpenters). It consists of three main components: a powerful Node.js/Fastify backend, a React Native Customer App, and a React Native Worker App with a deeply integrated Native Android module for lock-screen job dispatching.

## Architecture Overview

```text
crewli/
├── backend/        # Fastify + MongoDB + Firebase Admin (FCM)
├── customer-app/   # React Native app for customers (Booking, AI Assistant, Tracking)
└── workers-app/    # React Native app for workers (Job Offers, OTP, Commission)
```

## Core Technologies

- **Backend:** Node.js, Fastify, MongoDB, Mongoose, Firebase Admin.
- **Mobile:** React Native, Zustand (State Management), Lucide Icons, Vanilla CSS (Stylesheets).
- **Native Android:** Kotlin, Android BroadcastReceivers, Full-Screen Intents, WakeLocks (for Incoming Job Activity).

