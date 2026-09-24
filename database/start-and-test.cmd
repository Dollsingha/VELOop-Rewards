@echo off
setlocal
set "PROJECT_ROOT=%~dp0.."

where docker.exe >nul 2>&1
if errorlevel 1 (
  set "DOCKER=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe"
  if exist "%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" goto docker_found
  echo Docker Desktop is not installed or docker.exe is missing from PATH.
  echo Install Docker Desktop, start it, then run this script again.
  exit /b 1
)
set "DOCKER=docker.exe"
:docker_found

"%DOCKER%" info >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop is installed but its engine is not running.
  echo Start Docker Desktop, wait until it says Engine running, then retry.
  exit /b 1
)

echo Starting the local MongoDB replica set...
"%DOCKER%" compose -f "%PROJECT_ROOT%\database\docker-compose.yml" up -d --wait
if errorlevel 1 exit /b 1

pushd "%PROJECT_ROOT%\backend"
echo Seeding the development database...
call npm run seed
if errorlevel 1 (
  popd
  exit /b 1
)

echo Running integration tests against the separate test database...
set "MONGO_TEST_URI=mongodb://127.0.0.1:27017/veloop_wallet_test?replicaSet=rs0"
call npm test
set "RESULT=%ERRORLEVEL%"
popd
exit /b %RESULT%
