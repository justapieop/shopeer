FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@12.4.1 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY app/package.json app/package.json
COPY case/package.json case/package.json
COPY domain/package.json domain/package.json
COPY infra/package.json infra/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build
RUN pnpm deploy --filter @shopeer/app --prod /out

FROM gcr.io/distroless/nodejs22-debian12:nonroot

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build --chown=nonroot:nonroot /out ./

EXPOSE 3000

CMD ["dist/index.js"]
