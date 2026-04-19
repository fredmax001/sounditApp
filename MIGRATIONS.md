# Database Migrations Guide

This project uses **Alembic** for database migrations.

## Setup

1. Ensure your database URL is set in environment:
   ```bash
   export DATABASE_URL="postgresql://user:password@localhost:5432/soundit"
   ```

2. Alembic is already initialized. The configuration is in:
   - `alembic.ini` - Main configuration
   - `alembic/env.py` - Environment setup with model imports

## Common Commands

### Create a New Migration (Auto-generate from models)
```bash
alembic revision --autogenerate -m "Description of changes"
```

### Apply Migrations (Upgrade)
```bash
# Upgrade to latest
alembic upgrade head

# Upgrade specific number of revisions
alembic upgrade +1

# Upgrade to specific revision
alembic upgrade 1c66a38847df
```

### Rollback Migrations (Downgrade)
```bash
# Downgrade one revision
alembic downgrade -1

# Downgrade to specific revision
alembic downgrade 1c66a38847df

# Downgrade all (WARNING: Destructive!)
alembic downgrade base
```

### View Current Status
```bash
# Show current revision
alembic current

# Show migration history
alembic history --verbose
```

## Production Deployment

### Zero-Downtime Migration Strategy

1. **Before deployment:**
   ```bash
   # Test migrations in staging
   alembic upgrade head --sql > migration_preview.sql
   ```

2. **During deployment:**
   ```bash
   # Apply migrations before app restart
   alembic upgrade head
   
   # Verify
   alembic current
   ```

3. **Rollback plan:**
   ```bash
   # If issues occur, rollback
   alembic downgrade -1
   ```

### Docker Deployment

In Docker, migrations run automatically on startup (if configured in entrypoint):

```dockerfile
# In Dockerfile or docker-compose
CMD alembic upgrade head && uvicorn main_production:app --host 0.0.0.0 --port 8000
```

## Best Practices

1. **Always review auto-generated migrations** before applying
2. **Test migrations on a copy of production data** first
3. **Never delete migration files** after they've been applied
4. **Keep migrations small** - one logical change per migration
5. **Use descriptive names**: `add_user_profile_fields`, `create_events_table`

## Troubleshooting

### "Can't locate revision" Error
If you get this error, the database is ahead of your migration files. Options:
- Delete the database and recreate (development only)
- Stamp the database with current revision: `alembic stamp head`
- Manually fix the revision chain

### SQLite Limitations
SQLite has limited ALTER TABLE support. For complex schema changes:
1. Create new table with new schema
2. Copy data
3. Drop old table
4. Rename new table

Or switch to PostgreSQL for production.
