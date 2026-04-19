# Sound It CLI

Command Line Interface for managing the Sound It music events platform.

## Installation

### From source
```bash
cd cli
pip install -e .
```

### Requirements
- Python 3.8+
- pip

## Quick Start

```bash
# Login to the platform
soundit auth login

# View dashboard statistics
soundit admin stats

# List users
soundit users list

# List events
soundit events list

# Logout
soundit auth logout
```

## Configuration

The CLI stores configuration in `~/.soundit/config.json`:
- API base URL
- Authentication tokens
- Default output format

You can also use environment variables:
```bash
export SOUNDIT_API_URL="https://api.sounditent.com"
export SOUNDIT_FORMAT="json"
```

## Commands

### Authentication
```bash
soundit auth login              # Login with email/password
soundit auth logout             # Logout and clear credentials
soundit auth me                 # Show current user info
soundit auth status             # Check login status
```

### Users
```bash
soundit users list              # List all users
soundit users list --role admin # Filter by role
soundit users get <id>          # Get user details
soundit users update <id> --role artist  # Update user
soundit users delete <id>       # Delete user
```

### Events
```bash
soundit events list             # List events
soundit events list --status pending     # Filter by status
soundit events get <id>         # Get event details
soundit events approve <id>     # Approve event
soundit events reject <id> --reason "..." # Reject event
soundit events delete <id>      # Delete event
```

### Venues
```bash
soundit venues list             # List venues
soundit venues list --city shanghai      # Filter by city
soundit venues get <id>         # Get venue details
```

### Admin
```bash
soundit admin stats             # Dashboard statistics
soundit admin pending           # Pending actions
soundit admin verifications     # List verification requests
soundit admin approve-verification <id>  # Approve verification
soundit admin reject-verification <id> --reason "..."
```

### Orders
```bash
soundit orders list             # List orders
soundit orders get <id>         # Get order details
soundit orders refund <id> --reason "..." # Refund order
```

## Output Formats

Use `--format` to change output format:
- `table` (default) - Human-readable table
- `json` - JSON format for scripting
- `csv` - CSV format for spreadsheets

```bash
soundit users list --format json
soundit events list --format csv > events.csv
```

## Global Options

```bash
--api-url URL        # Override API URL
--format FORMAT      # Default output format
--debug             # Enable debug output
```

## Examples

### Export all users to CSV
```bash
soundit users list --limit 1000 --format csv > users.csv
```

### Find pending events and approve
```bash
soundit events list --status pending --format json | jq '.[].id' | xargs -I {} soundit events approve {}
```

### Daily admin report
```bash
#!/bin/bash
echo "=== Sound It Daily Report ==="
echo ""
echo "Stats:"
soundit admin stats
echo ""
echo "Pending Actions:"
soundit admin pending
```

## API Endpoints Used

The CLI uses these API endpoints:
- `POST /api/v1/auth/login` - Authentication
- `GET /api/v1/auth/me` - Current user
- `GET /api/v1/admin/*` - Admin operations
- `GET/POST/PUT/DELETE /api/v1/events/*` - Event management
- `GET/POST/PUT/DELETE /api/v1/admin/users/*` - User management
- `GET/POST/PUT/DELETE /api/v1/clubs/*` - Venue management

## Troubleshooting

### Connection Error
```bash
# Check API URL
soundit --api-url https://api.sounditent.com auth status
```

### Authentication Error
```bash
# Re-login
soundit auth logout
soundit auth login
```

### Debug Mode
```bash
soundit --debug users list
```

## License

MIT License
