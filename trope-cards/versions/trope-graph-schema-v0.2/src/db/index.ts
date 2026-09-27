// Project-specific database client goes here.
// Keep the concrete postgres/Supabase connection setup in the host application.
// The seed function imports `db` from this module so it can be wired to the
// existing project's Drizzle client without coupling this package to a driver.

export declare const db: any;
