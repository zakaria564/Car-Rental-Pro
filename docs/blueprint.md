# **App Name**: Car Rental Pro

## Core Features:

- Firestore Data Models: Define Firestore data models for cars, clients, and rentals, optimizing for cost-effectiveness on the free tier.
- Firestore Security Rules: Implement strict Firestore security rules to ensure data privacy and security, while staying within the constraints of the free tier.
- Cloud Functions (Lite): Create Cloud Functions to manage key operations like rental creation (checking car availability, calculating rental price) and rental termination (setting car availability back to true).
- HTTPS API Endpoints: Develop simple HTTPS API endpoints for adding cars/clients, creating/terminating rentals, and listing cars/clients/rentals, with JSON responses.
- Web Interface (HTML/CSS/JS): Develop a lightweight web interface using HTML, CSS, and JavaScript, including login via Firebase Authentication and a menu for cars, clients, and rentals.
- PWA Features: Implement PWA functionalities (manifest.json, service-worker.js) for installability and basic offline mode.
- Car Availability: Use a tool, powered by generative AI, to intelligently decide if a car needs maintenance.

## Style Guidelines:

- Primary color: Deep blue (#2962FF), evoking trust and reliability.
- Background color: Light gray (#F0F4F8), creating a clean and professional backdrop.
- Accent color: Soft orange (#FFAB40), used sparingly to draw attention to important elements such as the call to action button.
- Body and headline font: 'Inter' (sans-serif) for a clean, modern, neutral look.
- Use minimalist icons to represent different sections of the application (cars, clients, rentals).
- Design a responsive layout that adapts to different screen sizes (PC and mobile).
- Implement subtle animations (e.g., transitions, loading indicators) to improve the user experience.