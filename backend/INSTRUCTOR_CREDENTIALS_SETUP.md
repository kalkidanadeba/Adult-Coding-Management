# Creating Instructor Credentials

The system now provides **two methods** to create instructor accounts:

## Method 1: Using the Seed Script (Quick Setup)

Run the seed script to create a default instructor account:

```bash
node src/scripts/seedinstructor.js
```

**Default Instructor Credentials:**
- Email: `instructor@aclms.com`
- Password: `Instructor@123`
- Role: `instructor`

This script will:
- Check if an instructor with email `instructor@aclms.com` already exists
- Create the account if it doesn't exist
- Print the credentials to the console
- Exit gracefully if the instructor already exists

## Method 2: Using the Admin API Endpoint

An admin can create instructor accounts via API:

**Endpoint:** `POST /api/admin/users/instructors/create`

**Headers:**
- `Authorization: Bearer <admin-token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "name": "Instructor Name",
  "email": "instructor@example.com",
  "password": "SecurePassword@123"
}
```

**Requirements:**
- Password must be at least 8 characters
- Email must be unique (not already registered)
- Name must be 2-50 characters

**Response (Success):**
```json
{
  "success": true,
  "message": "Instructor account created successfully",
  "instructor": {
    "id": "user-mongo-id",
    "name": "Instructor Name",
    "email": "instructor@example.com",
    "role": "instructor",
    "createdAt": "2026-06-26T10:30:00.000Z"
  }
}
```

## Logging In as an Instructor

After creating an instructor account, login with:

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "instructor@aclms.com",
  "password": "Instructor@123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-mongo-id",
    "name": "System Instructor",
    "email": "instructor@aclms.com",
    "role": "instructor"
  }
}
```

## Instructor Features

Once logged in as an instructor, the following endpoints become available:

- **GET** `/api/instructor/live-sessions` - Get all instructor's live sessions
- **POST** `/api/instructor/live-sessions` - Create a new live session
- **PUT** `/api/instructor/live-sessions/:id` - Update a live session
- **DELETE** `/api/instructor/live-sessions/:id` - Delete a live session
- **PATCH** `/api/instructor/live-sessions/:id/status` - Update session status

## Converting Existing User to Instructor

An admin can convert an existing student to instructor:

**Endpoint:** `PUT /api/admin/users/:id`

**Request Body:**
```json
{
  "role": "instructor"
}
```

## Security Notes

- Passwords are hashed using bcrypt (10 salt rounds)
- Only admins can create instructor accounts via API
- Each instructor email must be unique
- Instructors have separate live session management endpoints from students
