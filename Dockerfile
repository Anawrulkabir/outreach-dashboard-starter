# Small production image using Next.js standalone output.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV STANDALONE=1 NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 TZ=Asia/Dhaka \
    HOSTNAME=0.0.0.0 PORT=3000 \
    DATA_FILE=/data/outreach.json SEED_FILE=/app/seed.json
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY data/seed.json /app/seed.json
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
