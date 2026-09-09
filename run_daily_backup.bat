@echo off
title PolyGame Local Database Backup
cd /d "c:\Users\pasca\.gemini\antigravity\scratch\PolyGame"
echo ==============================================================================
echo Running PolyGame Local Database Backup...
echo ==============================================================================
python supabase\backup_database.py
echo ==============================================================================
echo Backup completed! Backups are stored safely and privately on this PC.
echo ==============================================================================
