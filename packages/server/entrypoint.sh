#!/bin/bash

npx prisma migrate deploy
node -r dotenv/config dist/index.js
