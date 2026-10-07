@echo off
rem tools/git.cmd -- use the git bundled with GitHub Desktop (git is not on PATH).
rem Finds the newest app-* folder so it keeps working after GitHub Desktop updates.
setlocal enabledelayedexpansion
set "GIT="
for /f "delims=" %%d in ('dir /b /o-n "C:\Users\li\AppData\Local\GitHubDesktop\app-*" 2^>nul') do (
  if not defined GIT if exist "C:\Users\li\AppData\Local\GitHubDesktop\%%d\resources\app\git\cmd\git.exe" set "GIT=C:\Users\li\AppData\Local\GitHubDesktop\%%d\resources\app\git\cmd\git.exe"
)
if not defined GIT (
  echo git.exe not found under GitHubDesktop\app-* 1>&2
  exit /b 9009
)
"%GIT%" %*
exit /b %errorlevel%
