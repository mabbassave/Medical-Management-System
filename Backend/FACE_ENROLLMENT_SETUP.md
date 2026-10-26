# Local face enrollment and sign-in

Face processing runs on the backend host using OpenCV YuNet face detection and
OpenCV SFace embeddings. Frames are uploaded over the existing authenticated
API, processed in memory by the Python worker, and discarded. MongoDB stores
only a versioned AES-256-GCM encrypted embedding on the corresponding User
record. The ciphertext is authenticated with that account's ID as associated
data; a swapped template cannot authenticate another account. Enrollment and
verification are limited to active Patient and Doctor accounts, require
explicit consent, and use the existing session cookie/JWT and authorization
middleware. Face login does not bypass Doctor credential approval.

The current matcher uses cosine similarity and OpenCV's SFace example cutoff
of `0.363`. This is an example operating point, not a Medivanta-calibrated
false-accept/false-reject guarantee. There is no liveness or presentation-attack
detection; a sufficiently similar photograph or screen replay may be accepted.
Keep email/password sign-in available. Do not use this as the sole high-assurance
factor without population-specific accuracy evaluation, liveness controls,
security review, and applicable privacy/legal review.

## Windows Setup

Requirements: Windows 10/11 x64, Python 3.14 x64, Node.js 20+, npm, MongoDB,
Redis, and a browser camera. OpenCV 4.13.0.92 has a Windows wheel for the
Python 3.14 environment present in this workspace.

From PowerShell at the repository root:

```powershell
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r Backend\face-service\requirements.txt
.\.venv\Scripts\python.exe Backend\face-service\download_models.py
```

The model downloader pins OpenCV Zoo revision
`47534e27c9851bb1128ccc0102f1145e27f23f98` and checks both model SHA-256
digests. A network connection is needed only for this initial package/model
installation; inference is local and does not call a paid cloud API.

Create a random 32-byte encryption key and write it only to the ignored
`Backend/.env` file. In PowerShell from the repository root:

```powershell
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 32
$rng.GetBytes($bytes)
$key = [Convert]::ToBase64String($bytes)
Add-Content Backend\.env "BIOMETRIC_ENCRYPTION_KEY=$key"
Add-Content Backend\.env 'FACE_ENROLLMENT_ENABLED=true'
Add-Content Backend\.env 'FACE_PYTHON_PATH=C:/Madical-Managment/.venv/Scripts/python.exe'
$rng.Dispose()
```

Do not regenerate the key after templates have been enrolled: existing
templates become unreadable. Back up the key separately from MongoDB. Without
the key, biometric login fails closed and users can still use passwords.

Start MongoDB and Redis using the repository's compose services, then start the
API and web client in separate PowerShell windows:

```powershell
Set-Location Backend
docker compose up -d mongodb redis
npm ci
npm run dev
```

```powershell
Set-Location frontend
npm ci
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). Browser camera access
requires localhost or HTTPS and permission for the site. Consent is required
before the camera starts and again on each face-login attempt. Camera failures
and permission denial leave the existing password login available. Face
enrollment is limited to five attempts per 15 minutes; face verification also
has per-browser and per-IP limits.

## Verification Checklist

Use a real camera and two consenting people in a non-production database:

1. Register a Patient or Doctor, consent, and enroll a clear single-face frame.
   Existing Patient/Doctor accounts can sign in and select **Enroll face
   sign-in** in the dashboard header. Google-authenticated accounts can use
   the same signed-in dashboard action.
2. Log out and sign in with the same person. Confirm the API returns the normal
   session and the UI routes Patient to `/portal` or Doctor to `/dashboard`.
3. Attempt face sign-in using the other person's face. It must not issue a
   session cookie and must leave password sign-in available.
4. Sign in as a pending Doctor and confirm clinical routes remain blocked by
   the existing Doctor approval middleware.
5. With an authenticated Patient/Doctor session, call
   `DELETE /api/auth/face-enroll`; confirm status becomes `not_enrolled` and a
   subsequent face login fails until re-enrollment.

This checklist must be run against real camera images before describing the
feature as end-to-end verified. Unit tests for the local protocol and matching
logic are not a substitute for it.

## Face Sign-In Failure Responses

- `401` means at least one saved template was readable and comparable, but the
  camera image did not meet the existing cosine-similarity threshold.
- `409` means there is no active, consented enrollment available, or the
  enrollment has no saved template. Sign in with a password and enroll again.
- `503` means the local model service is unavailable or saved template data
  could not be decrypted or compared. Use password sign-in and contact support
  if re-enrollment does not resolve the issue.

Backend face diagnostics report model readiness/version, vector dimensions,
eligible/template counts, aggregate decryption or dimension errors, highest
cosine similarity, threshold, and outcome. They never include camera images,
embeddings, account identifiers, credentials, or encryption keys.

## Licenses And Data

- OpenCV Python distribution: Apache License 2.0.
- YuNet detector model: MIT License (OpenCV Zoo model directory).
- SFace recognition model: Apache License 2.0 (OpenCV Zoo model directory).
- Exact model revision and checksums are in `face-service/download_models.py`;
  notices are in `face-service/NOTICE.md`.

Biometric embeddings are sensitive data. Obtain explicit, revocable consent and
complete jurisdiction-specific privacy and security review before production
use. The authenticated delete endpoint removes the encrypted template, consent
timestamp, provider reference, and enrollment timestamps from the User record.
Database backups and replicas have their own retention policies and may retain
previous copies until their retention period ends. If this deployment previously
used Rekognition, deleting its MongoDB reference does not delete the remote AWS
face record. Before retiring that collection, an AWS administrator must delete
legacy faces or delete the entire collection under the applicable retention
policy; this replacement intentionally has no AWS credentials or remote-delete
path. Existing accounts with only a legacy `faceProviderFaceId` do not have a
local encrypted template and must complete local face enrollment again before
Face Login can recognize them.
