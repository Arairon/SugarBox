#!/bin/bash

bun db:migrate
bun dist/index.js
