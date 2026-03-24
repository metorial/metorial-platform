#!/bin/bash

set -e

bun i

cd ./db 

bunx prisma generate

cd ../apps/dev

bun dev