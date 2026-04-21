# SafeDose API Documentation

Complete API documentation for the SafeDose medication management system, including backend services and AI chat services.

## Files

- **SafeDose-API.postman_collection.json** - Complete Postman collection with all API endpoints
- **SafeDose-Environment.postman_environment.json** - Postman environment with configurable variables

## Quick Start

### 1. Import the Collection and Environment into Postman

1. Open Postman
2. Click "Import" in the top left
3. Select "SafeDose-API.postman_collection.json"
4. Import the environment file: "SafeDose-Environment.postman_environment.json"
5. Select the SafeDose environment from the dropdown in the top right

### 2. Configure Environment Variables

Before making requests, set these variables in the environment:

| Variable | Description | Example |
|----------|-------------|---------|
| `base_url` | Backend API URL | `http://localhost:3001` |
| `chat_url` | Chat service URL | `http://localhost:3002` |
| `token` | JWT authentication token | (obtained from login) |
| `patient_id` | Patient MongoDB ObjectId | `507f1f77bcf86cd799439011` |
| `medication_id` | Medication MongoDB ObjectId | `507f1f77bcf86cd799439012` |
| `caregiver_id` | Caregiver user MongoDB ObjectId | `507f1f77bcf86cd799439013` |

## API Overview

### Base Services

- **Backend API** (default: http://localhost:3001)
- **Chat Service** (default: http://localhost:3002)

### Authentication

All endpoints require a JWT token in the Authorization header (except register and login):

```
Authorization: Bearer {{token}}
```

**To get a token:**
1. Use the **Register** endpoint to create an account, or
2. Use the **Login** endpoint with email/password
3. Store the returned token in the `{{token}}` environment variable

### Endpoint Categories

#### Authentication (`/api/auth`)
- `POST /register` - Create new user account
- `POST /login` - Login and get JWT token
- `POST /logout` - Logout current session

#### User Profile (`/api/user`)
- `GET /profile` - Get current user profile
- `PUT /profile` - Update profile information
- `PATCH /notifications` - Update notification preferences

#### Patient Routes (`/api/patient`)
- `GET /drugs` - Search OpenFDA for medications
- `GET /adherence` - Get adherence trends
- `GET /medications/today` - Get today's medications
- `GET /medications` - Get all medications
- `POST /medications` - Add new medication
- `PATCH /medications/:id/taken` - Mark dose as taken
- `PUT /medications/:id` - Update medication
- `PATCH /medications/:id/stop` - Stop medication

#### Caregiver Routes (`/api/caregiver`)
- `GET /patients` - Get assigned patients
- `GET /patients/:id` - Get specific patient
- `POST /patients` - Create or link patient
- `DELETE /patients/:id` - Remove patient
- `GET /adherence` - Get roster adherence overview
- `GET /patients/:id/adherence` - Get patient adherence
- `GET /patients/:id/medications/today` - Get patient's today medications
- `GET /patients/:id/medications` - Get all patient medications
- `POST /patients/:id/medications` - Add patient medication
- `PATCH /patients/:id/medications/:medId/taken` - Mark patient dose taken
- `PUT /patients/:id/medications/:medId` - Update patient medication
- `PATCH /patients/:id/medications/:medId/stop` - Stop patient medication
- `DELETE /patients/:id/medications/:medId` - Delete patient medication
- `GET /drugs` - Search OpenFDA for drugs

#### Admin Routes (`/api/admin`)
- `GET /stats` - Get system statistics
- `GET /caregivers` - List all caregivers
- `PUT /caregivers/:id` - Update caregiver
- `PUT /caregivers/:id/status` - Update caregiver status
- `DELETE /caregivers/:id` - Delete caregiver
- `GET /patients` - List all patients
- `PUT /patients/:id` - Update patient
- `DELETE /patients/:id` - Delete patient

#### Chat Service (`/api/chat`)
- `POST /` - Send message to SafeDose AI
  - Query modes: `fda`, `mydata`, `web`

#### Text-to-Speech (`/api/tts`)
- `POST /` - Convert text to speech audio

## Common Request Patterns

### Example: Login Flow

1. **Register** (if new user):
   ```json
   POST /api/auth/register
   {
     "firstName": "John",
     "lastName": "Doe",
     "email": "john@example.com",
     "password": "SecurePass123",
     "confirmPassword": "SecurePass123",
     "dateOfBirth": "1990-01-15",
     "gender": "Male",
     "role": "patient"
   }
   ```

2. **Login**:
   ```json
   POST /api/auth/login
   {
     "email": "john@example.com",
     "password": "SecurePass123"
   }
   ```

3. Copy the `token` from response to `{{token}}` environment variable

### Example: Add Medication (Patient)

```json
POST /api/patient/medications
{
  "selectedDrug": {
    "brandName": "Aspirin",
    "genericName": "Acetylsalicylic Acid",
    "rxcui": "1191"
  },
  "dosage": "500mg",
  "frequency": "twice daily",
  "scheduleTimes": ["08:00 AM", "08:00 PM"],
  "isOngoing": true,
  "startDate": "2024-04-09"
}
```

### Example: Track Medication Adherence

```
GET /api/patient/medications/today
GET /api/patient/adherence?days=30
```

### Example: Create Patient (Caregiver)

```json
POST /api/caregiver/patients
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "dateOfBirth": "1965-05-20",
  "notes": "Notes about patient",
  "mode": "new"
}
```

Or link existing registered patient:

```json
POST /api/caregiver/patients
{
  "mode": "link",
  "linkedEmail": "patient@example.com"
}
```

### Example: Chat with AI

```json
POST /api/chat
{
  "message": "What are the side effects of my medications?",
  "mode": "fda"
}
```

Chat modes:
- `"fda"` - Search MongoDB + FDA database
- `"mydata"` - Search MongoDB only
- `"web"` - Web search mode

## Frequency Values

When adding/updating medications, use these frequency values:

- `once daily`
- `twice daily`
- `three times daily`
- `four times daily`
- `once every 2 days`
- `once every 3 days`
- `once in a week`

## Role-Based Access

The system has three user roles:

| Role | Access |
|------|--------|
| **patient** | Own medications, adherence, profile |
| **caregiver** | Assigned patients, their medications, adherence |
| **admin** | All users, patients, system statistics |

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request (missing/invalid fields) |
| 401 | Unauthorized (invalid credentials) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found (resource doesn't exist) |
| 409 | Conflict (duplicate entry) |
| 500 | Internal Server Error |
| 502 | Bad Gateway (external service unavailable) |

## Notes

- All dates should be in `YYYY-MM-DD` format
- All times should be in `HH:MM AM/PM` format
- Medication IDs and Patient IDs are MongoDB ObjectIds (24-character hex strings)
- JWT tokens expire after 7 days
- The chat service has a timeout of 8 seconds
- Text-to-speech audio is returned in WAV format
