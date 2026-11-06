# File Attachments & Secure Media Storage

## 1. Overview
SprintSync allows team members to upload, view, download, and delete attachments associated with tasks. Attachments are isolated per workspace and stored locally in designated directory structures under `MEDIA_ROOT`.

---

## 2. Storage Architecture & Path Scoping

### Physical Storage Directory
Files are stored securely on the host filesystem:
```
backend/media/attachments/{workspace_id}/{issue_id}/{random_uuid}_{sanitized_filename}
```
- **Workspace Scoping**: Prevents cross-tenant path collisions.
- **UUID Prefix**: Avoids filename collisions while preserving the original human-readable extension.
- **Directory Path Cleansing**: Filenames are sanitized with regex to remove directory traversal characters (`..`, `/`, `\`).

---

## 3. Supported File Types & Size Limits

- **Maximum Allowed Size**: 10 Megabytes (`10 * 1024 * 1024` bytes).
- **Allowed File Extensions**:
  - Documents: `.pdf`, `.docx`, `.xlsx`, `.csv`, `.txt`
  - Images: `.png`, `.jpg`, `.jpeg`
- **Rejections**: Executable binaries (`.exe`, `.bat`, `.sh`, `.cmd`, `.bin`), scripts (`.js`, `.py`, `.php`), and unapproved file formats return `HTTP 400 Bad Request`.

---

## 4. REST API Endpoints

### `GET /api/issues/{issue_id}/attachments/`
- Lists all metadata for attachments uploaded to the specified issue.
- Returns id, original filename, file size in bytes, MIME type, uploaded_by (user object), and created_at timestamp.

### `POST /api/issues/{issue_id}/attachments/`
- **Content-Type**: `multipart/form-data`
- **Body**: `file` (binary payload)
- Validates file size and extension, persists the attachment, and records an `ATTACHMENT_ADDED` event in `IssueActivity`.

### `GET /api/attachments/{attachment_id}/download/`
- Streams the file with `Content-Disposition: attachment; filename="..."`.
- **Security Check**: Enforces active workspace membership. Cross-tenant or unauthenticated access results in `HTTP 403 Forbidden`.

### `DELETE /api/attachments/{attachment_id}/`
- Deletes the database record and cleans up the physical file on disk.
- Allowed for:
  - The user who originally uploaded the file (`uploaded_by`).
  - Workspace `OWNER` or `ADMIN`.
- Records an `ATTACHMENT_DELETED` event in `IssueActivity`.

---

## 5. Security & Lifecycle Protections
1. **Access Isolation**: Raw media directory URLs are not directly exposed to public unauthenticated traffic. Downloads are guarded by Django REST Framework authentication and workspace membership validation.
2. **Physical Cleanup**: Overriding `delete()` on `IssueAttachment` ensures disk space is reclaimed when attachments or their parent issues/workspaces are deleted.
3. **MIME & Extension Whitelist**: Rejecting unapproved file types protects the server and client machines from malware or script execution.

