# Security notes
- Key handling: server env only; rotate on exposure. (A key was pasted into a chat during development: rotate it.)
- Tenant isolation: org id from session only. Upload validation: magic bytes + size + page limit.
- Open: data-retention and confidentiality terms for OEM drawings (lead decision).
