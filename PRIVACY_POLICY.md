# Privacy Policy for Black Belt - GuardSync

Last Updated: March 26, 2026

## 1. Introduction

Black Belt - GuardSync ("GuardSync," "we," "our," or "us") provides workforce management tools for security operations, including an Admin Console, Guard App, and Staff App.

This Privacy Policy explains what personal data we collect, how we use it, who we share it with, how long we keep it, and what rights users may have.

## 2. Scope

This Privacy Policy applies to:
- Guard App users (security guards)
- Staff App users (staff/supervisors)
- Admin Console users (administrators)
- Organizations using GuardSync

## 3. Information We Collect

We collect the following categories of data:

### A. Account and Identity Data
- Name
- Phone number
- Email address
- Password (stored as a one-way hash)
- Employee ID (if assigned)
- Organization and site assignment information
- Role data (guard, staff, admin)

### B. Biometric and Identity Verification Data
- Facial descriptor templates (mathematical numeric representations derived from your face, not photographs or images)

Important:
- Face processing is performed on your device using on-device machine learning models. Only the computed numeric face descriptor is transmitted to our servers. No raw face images or photographs are stored or transmitted.
- We use facial descriptor data solely to confirm identity during clock-in and random face verification checks.
- Facial descriptors are not used for any purpose other than workforce identity verification within this app.
- Explicit user consent is obtained before any face data is collected.

### C. Attendance and Work Activity Data
- Clock-in and clock-out timestamps
- Hours worked
- Assigned site and shift information
- Face check status (for example: pending, passed, failed, expired)

### D. Location Data
- GPS coordinates (latitude, longitude)
- Accuracy metadata (if provided)
- Time of each location ping

Location data is recorded during active shifts (for example, periodic updates according to system configuration).

### E. Organization and Operational Data
- Organization profile details (such as name, invite code, contact details)
- Site details and site contact information
- Payroll records (for example: days worked, rates, deductions, net pay status)

### F. Technical and Security Data
- Authentication tokens and authorization metadata
- Basic API and system logs needed for security, troubleshooting, and reliability

## 4. How We Use Information

We use personal data to:
- Create and manage user accounts
- Authenticate users and maintain secure access
- Process guard enrollment and admin authorization workflows
- Verify identity for clock-in and random face checks
- Record attendance and generate payroll data
- Monitor shift location updates and last known guard location for operations
- Detect misuse, prevent fraud, and improve security
- Maintain, debug, and improve app performance
- Comply with legal obligations

## 5. Legal Bases for Processing

Depending on your jurisdiction, we may rely on one or more of the following legal bases:
- Performance of a contract
- Legitimate interests (for example, workforce management and security operations)
- Legal obligation
- Consent (especially where required for biometric processing)

Organizations using GuardSync are responsible for obtaining any employee notices, acknowledgments, or consent required by applicable law.

## 6. How We Share Information

We do not sell personal data.

We may share data:
- Within your organization (for example, authorized admins and staff)
- With service providers hosting or supporting GuardSync infrastructure
- If required by law, legal process, or valid government request
- To protect rights, safety, and security of users, organizations, and the public
- In connection with a merger, acquisition, or business transfer (subject to applicable safeguards)

## 7. Data Retention

We retain data for as long as needed to provide services and meet legal, operational, and security requirements.

Current app behavior includes:
- Configurable location-data retention window (default set in system configuration)
- Archival of older location records from active tables
- Cleanup of older completed or expired face check records
- Longer retention of attendance and payroll records where needed for business and compliance purposes
- Face descriptor data is retained until the user deletes their account or requests removal

Retention periods may vary by organization policy and legal requirements.

## 7A. Account and Data Deletion

Guard App users may delete their account and all associated data at any time through the app (Profile > Delete My Account & Data). This permanently deletes:
- Account and identity information
- Facial descriptor data
- Attendance and clock-in/clock-out records
- Location history and archived location data
- Face verification check records
- Payroll records

Deletion is immediate and irreversible. Users may also contact us at the email below to request data deletion.

## 8. Security Measures

We use reasonable technical and organizational safeguards, including:
- Password hashing
- Token-based authentication
- Role-based access controls
- Rate limiting for sensitive endpoints (such as login)
- Database and infrastructure controls suitable for operational security

No method of storage or transmission is completely secure. We cannot guarantee absolute security.

## 9. International Transfers

If data is stored or processed in jurisdictions outside your country, we take steps intended to provide appropriate protection as required by applicable law.

## 10. Your Rights

Depending on local law, users may have rights to:
- Access personal data
- Correct inaccurate data
- Delete data
- Restrict or object to certain processing
- Data portability
- Withdraw consent where processing is based on consent

Requests should be directed to your employer/organization administrator first, or to us using the contact details below where appropriate.

## 11. Children

GuardSync is intended for professional workforce use and is not directed to children.

## 12. Third-Party Services

GuardSync uses the following third-party technologies:
- **face-api.js**: An open-source JavaScript library used for on-device face detection and descriptor extraction. All face processing occurs locally on the user's device. No face data is sent to any third-party service.
- **Capacitor (by Ionic)**: Used for native device capabilities (camera access, GPS). Data accessed through Capacitor is used only as described in this policy and is not shared with Ionic or any third party.

GuardSync may also rely on third-party infrastructure for hosting. Their processing is governed by their own policies and contractual terms.

## 13. Changes to This Policy

We may update this Privacy Policy from time to time. Updated versions will be posted with a revised "Last Updated" date.

## 14. Contact Information

For privacy questions, data deletion requests, or other inquiries, contact:
- Privacy Contact: Black Belt Security Operations Team
- Email: privacy@blackbelt-guardsync.com
- Address: [Add company/org address]

Please replace the email and address above with your actual contact details before publishing.

---

## Organization Implementation Notes (Template Completion)

Before publishing this policy, replace bracketed placeholders and confirm:
- Legal entity name and contact details
- Exact hosting providers and regions
- Exact retention periods adopted by your organization
- Biometric consent language required by your jurisdiction
- Whether you need employee-specific policy addenda or labor-law notices
