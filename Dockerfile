FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node package.json *.mjs character-personas.json ./
COPY --chown=node:node public ./public
COPY --chown=node:node scripts/*.mjs ./scripts/
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV HOST=0.0.0.0 PORT=4180 DATA_DIR=/app/data
VOLUME ["/app/data"]
EXPOSE 4180
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4180/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
