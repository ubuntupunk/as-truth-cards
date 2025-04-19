# Database Seeding Documentation

This document outlines the process and considerations for seeding the database using Prisma, particularly when using Bun as the runtime.

## Seeding Script (`prisma/seed.ts`)

The `prisma/seed.ts` script is responsible for populating the database with initial data, primarily the card information from `src/data/cards.ts`.

### Top-Level Await for Bun Compatibility

Previously, the script used an `async function main()` pattern. However, when running seed scripts with Bun, there can be issues with this structure. To ensure compatibility and reliable execution with Bun, the script was refactored to use **top-level await**.

Key changes made:
- Removed the `async function main()` wrapper.
- Moved the core seeding logic (clearing existing data and creating new records) directly to the top level of the script.
- Wrapped the logic in a `try...catch...finally` block to handle errors gracefully and ensure the Prisma client disconnects (`prisma.$disconnect()`) in all scenarios.

This structure aligns better with how Bun handles asynchronous operations in scripts.

### Handling JSON Data (`sources` field)

The `Card` model has a `sources` field defined as `Json?`. When seeding, the data imported from `src/data/cards.ts` needs to be correctly formatted for Prisma's JSON type. The script uses `JSON.parse(JSON.stringify(card.sources ?? []))` to ensure the `sources` data is converted into a generic JSON structure that Prisma accepts, preventing potential type errors during seeding.

## Seeding Commands

To reset the database schema and run the seed script, use the following commands:

1.  **Push Schema Changes & Reset:** This command applies any changes from `prisma/schema.prisma` to the database. The `--force-reset` flag will drop the existing database and recreate it based on the schema, effectively clearing all data. **Use with caution, especially in production!**
    ```bash
    bunx prisma db push --force-reset
    ```

2.  **Run Seed Script:** This command executes the `prisma/seed.ts` script to populate the newly created/reset database.
    ```bash
    bunx prisma db seed
    ```

These commands should be run sequentially when you need to reset the database to its initial state based on the current schema and seed data.
