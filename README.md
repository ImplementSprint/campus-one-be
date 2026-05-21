# Campus One Backend

Centralized backend repository for Campus One.

## Current Phase

This repository has been created from the staging repository split. The original backend sources are preserved under:

- `sources/main-be` - platform/institution backend
- `sources/portal-be` - internal portal backend

The next backend phase is to consolidate these into one NestJS monorepo with `apps/gateway`, focused `libs/*`, and one canonical `supabase/` folder.
