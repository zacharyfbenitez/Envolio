FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV PUBLIC_BASE=/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=5173 PUBLIC_BASE=/
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/web-security.js ./web-security.js
COPY --from=build /app/alert-delivery.js ./alert-delivery.js
COPY --from=build /app/operational-risk.js ./operational-risk.js
COPY --from=build /app/risk-audit.js /app/risk-monitor.js ./
COPY --from=build /app/takeoff-slots.js ./
COPY --from=build /app/faa-edct.js ./
COPY --from=build /app/slot-risk.js ./
COPY --from=build /app/route-search.js /app/delay-reasoning.js /app/skylink.js /app/validation.js /app/traveler-intelligence.js /app/provider-permissions.js /app/trip-strategy.js ./
EXPOSE 5173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:5173/healthz || exit 1
CMD ["node","server.js"]
