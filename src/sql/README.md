# Database Schema Update Scripts

This directory contains SQL scripts to update the database schema for the Sattva AI application.

## How to Run the Scripts

You can run these scripts in the Supabase SQL Editor:

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Create a new query
4. Copy and paste the contents of the SQL script you want to run
5. Click "Run" to execute the script

## Available Scripts

- `update_messages_table.sql`: Updates the messages table schema to ensure it has the correct columns (`is_user` instead of `role`)

## Important Notes

- These scripts are designed to be idempotent, meaning they can be run multiple times without causing issues
- The scripts check if changes are needed before making them
- Always back up your database before running schema update scripts

## Troubleshooting

If you encounter the error "Could not find the 'role' column of 'messages' in the schema cache", run the `update_messages_table.sql` script to fix the database schema. 